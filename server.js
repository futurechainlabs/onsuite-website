const express = require('express');
const session = require('express-session');
const multer = require('multer');
let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.warn('Sharp not available, using Cloudinary for image processing'); }
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v2: cloudinary } = require('cloudinary');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_PASS = process.env.ADMIN_PASS || 'OnSuite2025!';
const UPLOAD_DIR = path.join(__dirname, 'public', 'assets', 'images');

// --- Security: HTML sanitizer ---
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// --- Rate limiter (simple in-memory) ---
const rateLimits = {};
function rateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  if (!rateLimits[key]) rateLimits[key] = [];
  rateLimits[key] = rateLimits[key].filter(t => now - t < windowMs);
  if (rateLimits[key].length >= maxRequests) return false;
  rateLimits[key].push(now);
  return true;
}

// --- Cloudinary Config ---
const CLOUDINARY_CONFIGURED = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);
if (CLOUDINARY_CONFIGURED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  console.log('Cloudinary connected:', process.env.CLOUDINARY_CLOUD_NAME);
}

// --- Supabase Config ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_CONFIGURED = !!(SUPABASE_URL && SUPABASE_KEY);
let supabase = null;
if (SUPABASE_CONFIGURED) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('Supabase connected:', SUPABASE_URL);
}

// --- Chatbot System Prompt ---
const CHATBOT_SYSTEM_PROMPT = `Sen OnSuite akilli uretim yonetim platformunun web sitesindeki yardimci asistansin. Adin "OnSuite Asistan".

OnSuite Hakkinda:
- Siskon Otomasyon tarafindan gelistirilen MES (Manufacturing Execution System) platformu
- 40+ ulke, 100+ proje, 500+ uretim hattinda kullaniliyor
- 10 urun: OnConnect (PLC & Protokol Koprusu), OnOptima (OEE & Verimlilik), OnTrace (Izlenebilirlik), OnIntegra (ERP Entegrasyonu), OnCNC (CNC Veri Toplama), OnMonitora (Makine Izleme), OnCarboniq (Enerji & ESG), OnCore (On-Premise AI), OnSmartForms (Dijital Formlar), OnTMC (Tutun Sektoru)
- Sektorler: Otomotiv, Gida & Icecek, Ilac, Tutun, Genel Uretim
- Partnerler: Microsoft, Beckhoff, GE Vernova, Ignition, SICK, Universal Robots
- Referanslar: Bosch, BSH, Haier, Unilever, Philip Morris, BorgWarner, Diageo, JTI, Maxion

Kurallarin:
- Turkce konusursun, kisa ve samimi yanit verirsin (2-3 cumle max)
- Teknik sorulara net cevap ver
- Uygun olduğunda demo talep etmeye yonlendir
- Rakip firmalar hakkinda yorum yapma
- Fiyat bilgisi verme, demo icin yonlendir
- Telefon: +90 (232) 245 00 76`;

// --- Google Gemini Config (FREE - primary) ---
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_CONFIGURED = !!GEMINI_KEY;
let geminiModel = null;
if (GEMINI_CONFIGURED) {
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  console.log('Google Gemini connected (FREE)');
}

// --- Multer (memory storage) ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|svg|webp|gif)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Desteklenmeyen dosya formati'));
  }
});

// --- Middleware ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// Static files with cache headers (1 week for assets)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 3600000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

// --- Data Helpers (Supabase or JSON file, with in-memory cache) ---
let _dataCache = null;
let _dataCacheTime = 0;
const DATA_CACHE_TTL = 60000; // 1 minute

async function loadData() {
  const now = Date.now();
  if (_dataCache && (now - _dataCacheTime) < DATA_CACHE_TTL) return _dataCache;

  let result;
  if (SUPABASE_CONFIGURED) {
    const { data, error } = await supabase
      .from('site_content')
      .select('content')
      .eq('id', 1)
      .single();
    if (data && data.content) { result = data.content; }
    else {
      const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      await supabase.from('site_content').upsert({ id: 1, content: fileData });
      result = fileData;
    }
  } else {
    result = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  _dataCache = result;
  _dataCacheTime = now;
  return result;
}

async function saveData(content) {
  // Always save to file as backup
  fs.writeFileSync(DATA_FILE, JSON.stringify(content, null, 2), 'utf8');
  _dataCache = content;
  _dataCacheTime = Date.now();
  if (SUPABASE_CONFIGURED) {
    await supabase.from('site_content').upsert({ id: 1, content });
  }
}

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

// --- Cloudinary Helpers ---
async function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'onsuite',
        public_id: options.publicId,
        resource_type: 'image',
        overwrite: true,
        ...options.transforms
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function getCloudinaryImages() {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'onsuite',
      max_results: 200,
      resource_type: 'image'
    });
    return (result.resources || []).map(r => ({
      name: r.public_id.split('/').pop(),
      path: r.secure_url,
      folder: r.public_id.split('/').slice(0, -1).join('/').replace('onsuite/', '') || 'root',
      size: r.bytes,
      sizeStr: r.bytes > 1024 * 1024
        ? (r.bytes / (1024 * 1024)).toFixed(1) + ' MB'
        : (r.bytes / 1024).toFixed(0) + ' KB',
      ext: r.format,
      width: r.width,
      height: r.height,
      cloudinaryId: r.public_id,
      url: r.secure_url
    }));
  } catch (e) {
    console.error('Cloudinary fetch error:', e.message);
    return [];
  }
}

// Scan local images (fallback when Cloudinary not configured)
function scanLocalImages(dir, base) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(base, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      results.push(...scanLocalImages(fullPath, relPath));
    } else if (/\.(png|jpg|jpeg|svg|webp|gif)$/i.test(entry.name)) {
      const stat = fs.statSync(fullPath);
      results.push({
        name: entry.name,
        path: 'assets/images/' + relPath,
        folder: base.replace(/\\/g, '/') || 'root',
        size: stat.size,
        sizeStr: stat.size > 1024 * 1024
          ? (stat.size / (1024 * 1024)).toFixed(1) + ' MB'
          : (stat.size / 1024).toFixed(0) + ' KB',
        ext: path.extname(entry.name).toLowerCase().slice(1),
        url: null,
        cloudinaryId: null
      });
    }
  }
  return results;
}

// --- Module Data ---
const MODULES_FILE = path.join(__dirname, 'data', 'modules.json');
let modulesData = {};
try {
  modulesData = JSON.parse(fs.readFileSync(MODULES_FILE, 'utf8'));
  console.log('Modules loaded:', Object.keys(modulesData).length);
} catch (e) {
  console.warn('modules.json not found or invalid');
}

// --- Sector Data ---
const SECTORS_FILE = path.join(__dirname, 'data', 'sectors.json');
let sectorsData = {};
try {
  sectorsData = JSON.parse(fs.readFileSync(SECTORS_FILE, 'utf8'));
  console.log('Sectors loaded:', Object.keys(sectorsData).length);
} catch (e) {
  console.warn('sectors.json not found or invalid');
}

// --- References Data ---
const REFS_FILE = path.join(__dirname, 'data', 'references.json');
let refsData = {};
try {
  refsData = JSON.parse(fs.readFileSync(REFS_FILE, 'utf8'));
  console.log('References loaded');
} catch (e) {
  console.warn('references.json not found or invalid');
}

// --- i18n & Multi-language Data ---
const i18nData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'i18n.json'), 'utf8'));
const dataEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'data-en.json'), 'utf8'));
const modulesEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'modules-en.json'), 'utf8'));
const sectorsEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'sectors-en.json'), 'utf8'));
const refsEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'references-en.json'), 'utf8'));
console.log('i18n loaded: TR + EN');

// Helper: get lang-specific data
function getLangData(lang) {
  const isEN = lang === 'en';
  return {
    t: i18nData[lang] || i18nData.tr,
    modules: isEN ? modulesEN : modulesData,
    sectors: isEN ? sectorsEN : sectorsData,
    refs: isEN ? refsEN : refsData,
    prefix: isEN ? '/en' : '',
    lang: lang
  };
}

async function loadDataForLang(lang) {
  if (lang === 'en') return dataEN;
  return await loadData();
}

// --- Public Routes (TR - default) ---
app.get('/', async (req, res) => {
  try {
    const data = await loadData();
    const ld = getLangData('tr');
    res.render('index', { data, ...ld });
  } catch (err) {
    console.error('Homepage error:', err);
    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      const ld = getLangData('tr');
      res.render('index', { data, ...ld });
    } catch (err2) {
      console.error('Homepage fallback error:', err2);
      res.status(500).send('Homepage error: ' + err.message + ' | Fallback: ' + err2.message);
    }
  }
});

app.get('/moduller/:slug', async (req, res) => {
  try {
    const ld = getLangData('tr');
    const mod = ld.modules[req.params.slug];
    if (!mod) return res.status(404).send('Modul bulunamadi');
    const data = await loadDataForLang('tr');
    res.render('module', { data, mod, ...ld });
  } catch (err) {
    console.error('Module page error:', err);
    res.status(500).send('Sayfa yuklenemedi');
  }
});

app.get('/demo', async (req, res) => {
  try {
    const data = await loadDataForLang('tr');
    const ld = getLangData('tr');
    res.render('demo', { data, ...ld });
  } catch (err) {
    res.status(500).send('Sayfa yuklenemedi');
  }
});

app.get('/hakkimizda', async (req, res) => {
  try {
    const data = await loadDataForLang('tr');
    const ld = getLangData('tr');
    res.render('hakkimizda', { data, ...ld });
  } catch (err) {
    res.status(500).send('Sayfa yuklenemedi');
  }
});

app.get('/sektorler', async (req, res) => {
  try {
    const data = await loadDataForLang('tr');
    const ld = getLangData('tr');
    res.render('sectors', { data, sectorsData: ld.sectors, ...ld });
  } catch (err) {
    res.status(500).send('Sayfa yuklenemedi');
  }
});

app.get('/sektorler/:slug', async (req, res) => {
  try {
    const ld = getLangData('tr');
    const sector = ld.sectors[req.params.slug];
    if (!sector) return res.status(404).send('Sektor bulunamadi');
    const data = await loadDataForLang('tr');
    res.render('sector', { data, sector, modulesData: ld.modules, ...ld });
  } catch (err) {
    res.status(500).send('Sayfa yuklenemedi');
  }
});

app.get('/referanslar', async (req, res) => {
  try {
    const data = await loadDataForLang('tr');
    const ld = getLangData('tr');
    res.render('referanslar', { data, refs: ld.refs, ...ld });
  } catch (err) {
    res.status(500).send('Sayfa yuklenemedi');
  }
});

// --- English Routes (/en/*) ---
app.get('/en', async (req, res) => {
  try {
    const data = await loadDataForLang('en');
    const ld = getLangData('en');
    res.render('index', { data, ...ld });
  } catch (err) {
    console.error('EN Homepage error:', err);
    res.status(500).send('EN Homepage error: ' + err.message);
  }
});

app.get('/en/modules/:slug', async (req, res) => {
  try {
    const ld = getLangData('en');
    const mod = ld.modules[req.params.slug];
    if (!mod) return res.status(404).send('Module not found');
    const data = await loadDataForLang('en');
    res.render('module', { data, mod, ...ld });
  } catch (err) {
    res.status(500).send('Page could not be loaded');
  }
});

app.get('/en/demo', async (req, res) => {
  try {
    const data = await loadDataForLang('en');
    const ld = getLangData('en');
    res.render('demo', { data, ...ld });
  } catch (err) {
    res.status(500).send('Page could not be loaded');
  }
});

app.get('/en/about', async (req, res) => {
  try {
    const data = await loadDataForLang('en');
    const ld = getLangData('en');
    res.render('hakkimizda', { data, ...ld });
  } catch (err) {
    res.status(500).send('Page could not be loaded');
  }
});

app.get('/en/industries', async (req, res) => {
  try {
    const data = await loadDataForLang('en');
    const ld = getLangData('en');
    res.render('sectors', { data, sectorsData: ld.sectors, ...ld });
  } catch (err) {
    res.status(500).send('Page could not be loaded');
  }
});

app.get('/en/industries/:slug', async (req, res) => {
  try {
    const ld = getLangData('en');
    const sector = ld.sectors[req.params.slug];
    if (!sector) return res.status(404).send('Industry not found');
    const data = await loadDataForLang('en');
    res.render('sector', { data, sector, modulesData: ld.modules, ...ld });
  } catch (err) {
    res.status(500).send('Page could not be loaded');
  }
});

app.get('/en/references', async (req, res) => {
  try {
    const data = await loadDataForLang('en');
    const ld = getLangData('en');
    res.render('referanslar', { data, refs: ld.refs, ...ld });
  } catch (err) {
    res.status(500).send('Page could not be loaded');
  }
});

// Demo form submission API
app.post('/api/demo', async (req, res) => {
  try {
    // Rate limit: 5 requests per IP per 10 minutes
    const ip = req.ip || req.connection.remoteAddress;
    if (!rateLimit('demo:' + ip, 5, 600000)) {
      return res.status(429).json({ ok: false, error: 'Cok fazla istek. Lutfen bekleyin.' });
    }

    const { name, email, phone, company, sector, productionLines, message } = req.body;
    if (!name || !email || !phone || !company || !sector) {
      return res.status(400).json({ ok: false, error: 'Zorunlu alanlari doldurunuz' });
    }

    // Input validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, error: 'Gecerli bir e-posta adresi giriniz' });
    }
    if (name.length > 100 || email.length > 100 || phone.length > 30 || company.length > 100) {
      return res.status(400).json({ ok: false, error: 'Alan uzunlugu siniri asildi' });
    }

    const demoRequest = {
      name: sanitize(name.trim()),
      email: sanitize(email.trim()),
      phone: sanitize(phone.trim()),
      company: sanitize(company.trim()),
      sector: sanitize((sector || '').trim()),
      productionLines: sanitize((productionLines || '').trim()),
      message: sanitize((message || '').trim().slice(0, 500)),
      date: new Date().toISOString(),
      status: 'new'
    };

    // Save to Supabase if configured
    if (SUPABASE_CONFIGURED) {
      await supabase.from('demo_requests').insert(demoRequest);
    }

    // Always save to local JSON as backup
    const demoFile = path.join(__dirname, 'data', 'demo-requests.json');
    let demos = [];
    try { demos = JSON.parse(fs.readFileSync(demoFile, 'utf8')); } catch (e) { /* first request */ }
    demos.push(demoRequest);
    fs.writeFileSync(demoFile, JSON.stringify(demos, null, 2), 'utf8');

    console.log('New demo request:', name, company, sector);
    res.json({ ok: true });
  } catch (err) {
    console.error('Demo submit error:', err);
    res.json({ ok: false, error: 'Sunucu hatasi' });
  }
});

// --- Admin Routes ---
app.get('/admin/login', (req, res) => {
  res.render('admin-login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const loginIp = req.ip || req.connection.remoteAddress;
  if (!rateLimit('login:' + loginIp, 5, 900000)) {
    return res.render('admin-login', { error: 'Cok fazla deneme. 15 dakika bekleyin.' });
  }
  if (req.body.password === ADMIN_PASS) {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  res.render('admin-login', { error: 'Yanlis sifre!' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

app.get('/admin', requireAuth, async (req, res) => {
  const data = await loadData();
  // Load demo requests
  let demoRequests = [];
  try {
    const demoFile = path.join(__dirname, 'data', 'demo-requests.json');
    demoRequests = JSON.parse(fs.readFileSync(demoFile, 'utf8'));
  } catch (e) { /* no requests yet */ }
  res.render('admin', { data, success: req.query.success || null, modulesData, demoRequests });
});

// --- Media Library ---
app.get('/admin/media', requireAuth, async (req, res) => {
  let images = [];
  let storageMode = 'local';

  if (CLOUDINARY_CONFIGURED) {
    images = await getCloudinaryImages();
    storageMode = 'cloudinary';
  }

  // Also include local images
  const localImages = scanLocalImages(UPLOAD_DIR, '');
  // Merge: cloudinary images first, then locals not in cloud
  const cloudPaths = new Set(images.map(i => i.name));
  const allImages = [...images, ...localImages.filter(l => !cloudPaths.has(l.name))];

  const folders = [...new Set(allImages.map(i => i.folder))].sort();
  res.render('admin-media', {
    images: allImages,
    folders,
    success: req.query.success || null,
    storageMode,
    cloudinaryConfigured: CLOUDINARY_CONFIGURED
  });
});

// Upload + process image
app.post('/admin/media/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('Dosya secilmedi');

    const { quality, scale, format } = req.body;
    // Sanitize folder name to prevent path traversal
    const folder = (req.body.folder || 'hero').replace(/[^a-zA-Z0-9_-]/g, '');
    const originalName = path.parse(req.file.originalname).name
      .replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const scaleFactor = parseFloat(scale) || 1;
    const qualityLevel = parseInt(quality) || 95;
    const outputFormat = format || 'png';
    let fileName = originalName;
    if (scaleFactor > 1) fileName += `@${scaleFactor}x`;

    let resultUrl = '';
    const cloudFolder = 'onsuite/' + (folder || 'hero');

    if (CLOUDINARY_CONFIGURED) {
      // Upload raw file to Cloudinary — let Cloudinary handle transformations
      const transforms = {};

      // Cloudinary eager transformations for quality/scale/format
      const eager = [];
      const t = {};
      if (qualityLevel < 100) t.quality = qualityLevel;
      if (scaleFactor > 1) t.width = 'iw_mul_' + scaleFactor; // scale width
      if (outputFormat === 'webp') t.format = 'webp';
      else if (outputFormat === 'jpeg') t.format = 'jpg';
      // else keep original format

      const result = await uploadToCloudinary(req.file.buffer, {
        folder: cloudFolder,
        publicId: fileName,
        transforms
      });

      // Build optimized URL with Cloudinary transformations
      let url = result.secure_url;
      if (outputFormat === 'webp') {
        url = url.replace(/\.\w+$/, '.webp');
      } else if (outputFormat === 'jpeg') {
        url = url.replace(/\.\w+$/, '.jpg');
      }
      // Add quality param via URL
      const parts = url.split('/upload/');
      if (parts.length === 2) {
        const transforms = [];
        if (qualityLevel < 100) transforms.push(`q_${qualityLevel}`);
        if (scaleFactor > 1) transforms.push(`w_${scaleFactor}.0,c_scale`);
        if (transforms.length > 0) {
          url = parts[0] + '/upload/' + transforms.join(',') + '/' + parts[1];
        }
      }

      resultUrl = url;
    } else {
      // Local fallback with Sharp (only when running locally)
      let processedBuffer = req.file.buffer;
      let ext = path.extname(req.file.originalname).slice(1).toLowerCase();
      const isSvg = req.file.mimetype === 'image/svg+xml';

      // Block SVGs containing script tags
      if (isSvg) {
        const svgContent = req.file.buffer.toString('utf8');
        if (/<script|javascript:|on\w+\s*=/i.test(svgContent)) {
          return res.status(400).send('SVG dosyasi guvenlik kontrolunu gecemedi');
        }
      }

      if (!isSvg && sharp) {
        try {
          let pipeline = sharp(req.file.buffer);
          const metadata = await pipeline.metadata();

          if (scaleFactor > 1 && metadata.width) {
            pipeline = pipeline.resize(Math.round(metadata.width * scaleFactor), null, {
              kernel: sharp.kernel.lanczos3,
              fastShrinkOnLoad: false
            });
          }

          if (outputFormat === 'webp') {
            pipeline = pipeline.webp({ quality: qualityLevel, effort: 6 });
            ext = 'webp';
          } else if (outputFormat === 'png') {
            pipeline = pipeline.png({ quality: qualityLevel, compressionLevel: 6 });
            ext = 'png';
          } else if (outputFormat === 'jpeg') {
            pipeline = pipeline.jpeg({ quality: qualityLevel, mozjpeg: true });
            ext = 'jpg';
          }

          processedBuffer = await pipeline.toBuffer();
        } catch (sharpErr) {
          console.warn('Sharp processing failed, saving original:', sharpErr.message);
          // Save original if Sharp fails
        }
      }

      const targetFolder = path.join(UPLOAD_DIR, folder);
      // Verify target is within UPLOAD_DIR
      if (!targetFolder.startsWith(UPLOAD_DIR)) {
        return res.status(400).send('Gecersiz klasor');
      }
      fs.mkdirSync(targetFolder, { recursive: true });
      const outputPath = path.join(targetFolder, `${fileName}.${ext}`);
      fs.writeFileSync(outputPath, processedBuffer);
      resultUrl = `assets/images/${folder || 'hero'}/${fileName}.${ext}`;
    }

    res.redirect(`/admin/media?success=upload&url=${encodeURIComponent(resultUrl)}`);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Yukleme hatasi. Lutfen tekrar deneyin.');
  }
});

// Assign image to a site section
app.post('/admin/media/assign', requireAuth, async (req, res) => {
  try {
    const { url, target } = req.body;
    if (!url || !target) return res.json({ ok: false, error: 'Eksik parametre' });

    const data = await loadData();
    const parts = target.split('.');

    // Navigate to target: e.g. "hero.heroImage", "modules.0.image", "steps.2.icon"
    if (parts[0] === 'hero') {
      data.hero[parts[1]] = url;
    } else if (parts[0] === 'modules') {
      const idx = parseInt(parts[1]);
      if (data.modules.items[idx]) data.modules.items[idx][parts[2]] = url;
    } else if (parts[0] === 'steps') {
      const idx = parseInt(parts[1]);
      if (data.steps.items[idx]) data.steps.items[idx][parts[2]] = url;
    } else if (parts[0] === 'metrics') {
      const idx = parseInt(parts[1]);
      if (data.metrics[idx]) data.metrics[idx][parts[2]] = url;
    } else {
      return res.json({ ok: false, error: 'Bilinmeyen hedef: ' + target });
    }

    await saveData(data);
    res.json({ ok: true, target, url });
  } catch (err) {
    console.error('Assign error:', err);
    res.json({ ok: false, error: err.message });
  }
});

// Delete image
app.post('/admin/media/delete', requireAuth, async (req, res) => {
  try {
    const { cloudinaryId, localPath } = req.body;

    if (cloudinaryId && CLOUDINARY_CONFIGURED) {
      await cloudinary.uploader.destroy(cloudinaryId);
    }

    if (localPath) {
      const imgPath = path.join(__dirname, 'public', localPath);
      if (imgPath.startsWith(UPLOAD_DIR) && fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }

    res.redirect('/admin/media?success=delete');
  } catch (err) {
    res.status(500).send('Silme hatasi: ' + err.message);
  }
});

// --- Content Save ---
app.post('/admin/save', requireAuth, async (req, res) => {
  try {
    const data = await loadData();
    const { section } = req.body;

    if (section === 'hero') {
      data.hero.badge = req.body.badge;
      data.hero.titleLine1 = req.body.titleLine1;
      data.hero.titleHighlight = req.body.titleHighlight;
      data.hero.titleLine3 = req.body.titleLine3;
      data.hero.description = req.body.description;
      data.hero.ctaPrimary = req.body.ctaPrimary;
      data.hero.ctaSecondary = req.body.ctaSecondary;
      data.hero.heroImage = req.body.heroImage;
    }

    if (section === 'site') {
      data.site.title = req.body.siteTitle;
      data.site.description = req.body.siteDescription;
      data.site.phone = req.body.phone;
      data.site.copyright = req.body.copyright;
    }

    if (section === 'metrics') {
      data.metrics = data.metrics.map((m, i) => ({
        ...m,
        count: parseInt(req.body[`metric_count_${i}`]) || m.count,
        suffix: req.body[`metric_suffix_${i}`] || m.suffix,
        label: req.body[`metric_label_${i}`] || m.label
      }));
    }

    if (section === 'proofBar') {
      data.proofBar.metrics = data.proofBar.metrics.map((m, i) => ({
        ...m,
        count: parseInt(req.body[`proof_count_${i}`]) || m.count,
        label: req.body[`proof_label_${i}`] || m.label
      }));
    }

    if (section === 'testimonial') {
      data.testimonial.quote = req.body.quote;
      data.testimonial.name = req.body.name;
      data.testimonial.role = req.body.role;
      data.testimonial.initials = req.body.initials;
    }

    if (section === 'cta') {
      data.cta.title = req.body.ctaTitle;
      data.cta.titleHighlight = req.body.ctaTitleHighlight;
      data.cta.titleEnd = req.body.ctaTitleEnd;
      data.cta.subtitle = req.body.ctaSubtitle;
    }

    if (section === 'steps') {
      data.steps.overline = req.body.stepsOverline;
      data.steps.title = req.body.stepsTitle;
      data.steps.titleHighlight = req.body.stepsTitleHighlight;
      data.steps.items = data.steps.items.map((s, i) => ({
        ...s,
        title: req.body[`step_title_${i}`] || s.title,
        desc: req.body[`step_desc_${i}`] || s.desc
      }));
    }

    if (section === 'modules') {
      data.modules.overline = req.body.modulesOverline;
      data.modules.title = req.body.modulesTitle;
      data.modules.titleHighlight = req.body.modulesTitleHighlight;
      data.modules.subtitle = req.body.modulesSubtitle;
      data.modules.items = data.modules.items.map((m, i) => ({
        ...m,
        name: req.body[`mod_name_${i}`] || m.name,
        desc: req.body[`mod_desc_${i}`] || m.desc,
        metric: req.body[`mod_metric_${i}`] || m.metric
      }));
    }

    if (section === 'moduleDetail') {
      const slug = req.body.modSlug;
      if (modulesData[slug]) {
        modulesData[slug].name = req.body.modDetailName || modulesData[slug].name;
        modulesData[slug].tagline = req.body.modDetailTagline || modulesData[slug].tagline;
        modulesData[slug].description = req.body.modDetailDesc || modulesData[slug].description;
        modulesData[slug].color = req.body.modDetailColor || modulesData[slug].color;
        modulesData[slug].ctaTitle = req.body.modDetailCtaTitle || modulesData[slug].ctaTitle;
        modulesData[slug].ctaDesc = req.body.modDetailCtaDesc || modulesData[slug].ctaDesc;
        // Save modules.json
        fs.writeFileSync(MODULES_FILE, JSON.stringify(modulesData, null, 2), 'utf8');
      }
    }

    await saveData(data);
    res.redirect('/admin?success=1');
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).send('Kayit hatasi: ' + err.message);
  }
});

// API
app.get('/api/data', async (req, res) => {
  res.json(await loadData());
});

// --- Chatbot API ---
app.post('/api/chat', async (req, res) => {
  try {
    // Rate limit: 20 messages per IP per 5 minutes
    const chatIp = req.ip || req.connection.remoteAddress;
    if (!rateLimit('chat:' + chatIp, 20, 300000)) {
      return res.json({ reply: 'Cok fazla mesaj gonderdiniz. Lutfen biraz bekleyin.' });
    }

    const { message, history } = req.body;
    if (!message || typeof message !== 'string' || message.length > 500) {
      return res.status(400).json({ error: 'Gecersiz mesaj' });
    }

    // Static fallback function
    const staticReply = (msg) => {
      const fallbacks = {
        modul: 'OnSuite 10 urunden olusur: OnConnect, OnOptima, OnTrace, OnIntegra, OnCNC, OnMonitora, OnCarboniq, OnCore, OnSmartForms ve OnTMC. Detayli bilgi icin demo talep edebilirsiniz.',
        demo: 'Demo icin +90 (232) 245 00 76 numarasini arayabilir veya sayfadaki formu doldurabilirsiniz.',
        fiyat: 'Fiyatlandirma tesisinizin buyuklugune gore belirlenir. Demo talep etmenizi oneririm.',
        entegrasyon: 'OnSuite; SAP, Microsoft Dynamics, Oracle gibi ERP sistemleriyle sorunsuz entegre olur.',
        default: 'Size yardimci olabilirim. Demo talep edebilir veya +90 (232) 245 00 76 numarasindan arayabilirsiniz.'
      };
      const lower = msg.toLowerCase();
      if (lower.includes('modul') || lower.includes('ontrace') || lower.includes('oee')) return fallbacks.modul;
      if (lower.includes('demo') || lower.includes('goster')) return fallbacks.demo;
      if (lower.includes('fiyat') || lower.includes('ucret') || lower.includes('maliyet')) return fallbacks.fiyat;
      if (lower.includes('entegrasyon') || lower.includes('erp') || lower.includes('sap')) return fallbacks.entegrasyon;
      return fallbacks.default;
    };

    // Gemini AI → Static fallback
    if (GEMINI_CONFIGURED) {
      try {
        // Build context with last few messages
        let context = CHATBOT_SYSTEM_PROMPT + '\n\n';
        if (Array.isArray(history) && history.length > 0) {
          context += 'Onceki konusma:\n';
          history.slice(-4).forEach(h => {
            if (h.role === 'user') context += 'Kullanici: ' + h.content.slice(0, 200) + '\n';
            if (h.role === 'assistant') context += 'Sen: ' + h.content.slice(0, 200) + '\n';
          });
          context += '\n';
        }
        context += 'Kullanici sorusu: ' + message;

        const result = await geminiModel.generateContent(context);
        const reply = result.response?.text() || 'Uzgunum, su an yanit uretemiyorum.';
        return res.json({ reply });
      } catch (geminiErr) {
        console.error('Gemini error:', geminiErr.message);
        // Rate limit or quota exceeded - tell user to wait
        if (geminiErr.message && (geminiErr.message.includes('429') || geminiErr.message.includes('quota') || geminiErr.message.includes('RESOURCE_EXHAUSTED'))) {
          return res.json({ reply: 'Suanda cok fazla soru geldi, lutfen birka\u00e7 saniye sonra tekrar deneyin.' });
        }
      }
    }

    // Static fallback (Gemini not configured or all AI failed)
    console.log('Using static fallback for:', message.slice(0, 50));
    return res.json({ reply: staticReply(message) });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.json({ reply: staticReply(message) });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    cloudinary: CLOUDINARY_CONFIGURED,
    supabase: SUPABASE_CONFIGURED,
    gemini: GEMINI_CONFIGURED,
    chatbot: GEMINI_CONFIGURED ? 'gemini' : 'static',
    storage: CLOUDINARY_CONFIGURED ? 'cloudinary' : 'local'
  });
});

app.listen(PORT, () => {
  console.log(`OnSuite server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Media library: http://localhost:${PORT}/admin/media`);
  console.log(`Storage: ${CLOUDINARY_CONFIGURED ? 'Cloudinary CDN' : 'Local filesystem'}`);
  console.log(`Database: ${SUPABASE_CONFIGURED ? 'Supabase PostgreSQL' : 'Local JSON file'}`);
});
