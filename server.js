const express = require('express');
const session = require('express-session');
const multer = require('multer');
let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.warn('Sharp not available, using Cloudinary for image processing'); }
const path = require('path');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_PASS = process.env.ADMIN_PASS || 'OnSuite2025!';
const UPLOAD_DIR = path.join(__dirname, 'public', 'assets', 'images');

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

// --- Google Gemini Config (FREE - primary) ---
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_CONFIGURED = !!GEMINI_KEY;
let geminiModel = null;
if (GEMINI_CONFIGURED) {
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  console.log('Google Gemini connected (FREE)');
}

const CHATBOT_SYSTEM_PROMPT = `Sen OnSuite akilli uretim yonetim platformunun web sitesindeki yardimci asistansin. Adin "OnSuite Asistan".

OnSuite Hakkinda:
- Siskon Otomasyon tarafindan gelistirilen MES (Manufacturing Execution System) platformu
- 40+ ulke, 100+ proje, 500+ uretim hattinda kullaniliyor
- 8 modul: OnTrace (Izlenebilirlik), OnOptima (Uretim Optimizasyonu), OnOEE (Performans Analizi), OnIntegra (ERP Entegrasyonu), OnCNC (CNC Veri Toplama), OnTMC (Tutun Sektoru), OnSmartForms (Dijital Formlar), OnMonitora (Makine Izleme)
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
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'onsuite-secret-key-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 }
}));

// --- Data Helpers (Supabase or JSON file) ---
async function loadData() {
  if (SUPABASE_CONFIGURED) {
    const { data, error } = await supabase
      .from('site_content')
      .select('content')
      .eq('id', 1)
      .single();
    if (data && data.content) return data.content;
    // Fallback: if no row exists, seed from file
    const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    await supabase.from('site_content').upsert({ id: 1, content: fileData });
    return fileData;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

async function saveData(content) {
  // Always save to file as backup
  fs.writeFileSync(DATA_FILE, JSON.stringify(content, null, 2), 'utf8');
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

// --- Public Routes ---
app.get('/', async (req, res) => {
  try {
    const data = await loadData();
    res.render('index', { data });
  } catch (err) {
    console.error('Homepage error:', err);
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.render('index', { data });
  }
});

// --- Admin Routes ---
app.get('/admin/login', (req, res) => {
  res.render('admin-login', { error: null });
});

app.post('/admin/login', (req, res) => {
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
  res.render('admin', { data, success: req.query.success || null });
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

    const { folder, quality, scale, format } = req.body;
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

      const targetFolder = path.join(UPLOAD_DIR, folder || 'hero');
      fs.mkdirSync(targetFolder, { recursive: true });
      const outputPath = path.join(targetFolder, `${fileName}.${ext}`);
      fs.writeFileSync(outputPath, processedBuffer);
      resultUrl = `assets/images/${folder || 'hero'}/${fileName}.${ext}`;
    }

    res.redirect(`/admin/media?success=upload&url=${encodeURIComponent(resultUrl)}`);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Yukleme hatasi: ' + err.message);
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
    const { message, history } = req.body;
    if (!message || typeof message !== 'string' || message.length > 500) {
      return res.status(400).json({ error: 'Gecersiz mesaj' });
    }

    // Static fallback function
    const staticReply = (msg) => {
      const fallbacks = {
        modul: 'OnSuite 8 modulden olusur: OnTrace, OnOptima, OnOEE, OnIntegra, OnCNC, OnTMC, OnSmartForms ve OnMonitora. Detayli bilgi icin demo talep edebilirsiniz.',
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
        const chatHistory = [];
        if (Array.isArray(history)) {
          history.slice(-6).forEach(h => {
            if (h.role === 'user') chatHistory.push({ role: 'user', parts: [{ text: h.content.slice(0, 300) }] });
            if (h.role === 'assistant') chatHistory.push({ role: 'model', parts: [{ text: h.content.slice(0, 300) }] });
          });
        }

        const chat = geminiModel.startChat({
          history: chatHistory,
          systemInstruction: CHATBOT_SYSTEM_PROMPT
        });

        const result = await chat.sendMessage(message);
        const reply = result.response.text() || 'Uzgunum, yanit uretemiyorum.';
        return res.json({ reply });
      } catch (geminiErr) {
        console.error('Gemini error, falling back to static:', geminiErr.message);
        return res.json({ reply: '[Gemini Debug] ' + geminiErr.message });
      }
    }

    // Static fallback
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
