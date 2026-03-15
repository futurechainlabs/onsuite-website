const express = require('express');
const session = require('express-session');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_PASS = process.env.ADMIN_PASS || 'OnSuite2025!';
const UPLOAD_DIR = path.join(__dirname, 'public', 'assets', 'images');

// --- Multer Setup (temp upload) ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|svg|webp|gif)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Desteklenmeyen dosya formati'));
    }
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

// --- Helpers ---
function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

// Scan all images in public/assets/images recursively
function scanImages(dir, base) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(base, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      results.push(...scanImages(fullPath, relPath));
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
        modified: stat.mtime.toISOString()
      });
    }
  }
  return results;
}

// --- Public Routes ---
app.get('/', (req, res) => {
  const data = loadData();
  res.render('index', { data });
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

app.get('/admin', requireAuth, (req, res) => {
  const data = loadData();
  res.render('admin', { data, success: req.query.success || null });
});

// --- Media Library ---
app.get('/admin/media', requireAuth, (req, res) => {
  const images = scanImages(UPLOAD_DIR, '');
  const folders = [...new Set(images.map(i => i.folder))].sort();
  res.render('admin-media', { images, folders, success: req.query.success || null });
});

// Upload + process image
app.post('/admin/media/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya secilmedi' });
    }

    const { folder, quality, scale, format } = req.body;
    const targetFolder = path.join(UPLOAD_DIR, folder || 'hero');

    // Ensure folder exists
    fs.mkdirSync(targetFolder, { recursive: true });

    const originalName = path.parse(req.file.originalname).name
      .replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const isSvg = req.file.mimetype === 'image/svg+xml';

    // SVG: save directly (no sharp processing)
    if (isSvg) {
      const svgPath = path.join(targetFolder, originalName + '.svg');
      fs.writeFileSync(svgPath, req.file.buffer);
      return res.redirect('/admin/media?success=svg');
    }

    // Raster image processing with Sharp
    let pipeline = sharp(req.file.buffer);
    const metadata = await pipeline.metadata();

    // Scale factor
    const scaleFactor = parseFloat(scale) || 1;
    if (scaleFactor !== 1 && metadata.width) {
      const newWidth = Math.round(metadata.width * scaleFactor);
      pipeline = pipeline.resize(newWidth, null, {
        kernel: sharp.kernel.lanczos3,
        fastShrinkOnLoad: false
      });
    }

    // Output format + quality
    const outputFormat = format || 'png';
    const qualityLevel = parseInt(quality) || 95;
    let ext = outputFormat;
    let fileName = originalName;

    if (scaleFactor > 1) {
      fileName += `@${scaleFactor}x`;
    }

    if (outputFormat === 'webp') {
      pipeline = pipeline.webp({ quality: qualityLevel, effort: 6, lossless: qualityLevel >= 100 });
      ext = 'webp';
    } else if (outputFormat === 'png') {
      pipeline = pipeline.png({ quality: qualityLevel, compressionLevel: 6, effort: 10 });
      ext = 'png';
    } else if (outputFormat === 'jpeg') {
      pipeline = pipeline.jpeg({ quality: qualityLevel, mozjpeg: true, chromaSubsampling: '4:4:4' });
      ext = 'jpg';
    }

    const outputPath = path.join(targetFolder, `${fileName}.${ext}`);
    await pipeline.toFile(outputPath);

    // Get output info
    const outStat = fs.statSync(outputPath);
    const outMeta = await sharp(outputPath).metadata();

    res.redirect(`/admin/media?success=upload&file=${fileName}.${ext}&w=${outMeta.width}&h=${outMeta.height}&size=${(outStat.size/1024).toFixed(0)}KB`);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Yukleme hatasi: ' + err.message);
  }
});

// Delete image
app.post('/admin/media/delete', requireAuth, (req, res) => {
  try {
    const imgPath = path.join(__dirname, 'public', req.body.path);
    // Prevent directory traversal
    if (!imgPath.startsWith(UPLOAD_DIR)) {
      return res.status(403).send('Yetkisiz');
    }
    if (fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
    }
    res.redirect('/admin/media?success=delete');
  } catch (err) {
    res.status(500).send('Silme hatasi: ' + err.message);
  }
});

// Image info API (for preview)
app.get('/admin/api/image-info', requireAuth, async (req, res) => {
  try {
    const imgPath = path.join(__dirname, 'public', req.query.path);
    if (!imgPath.startsWith(path.join(__dirname, 'public'))) {
      return res.status(403).json({ error: 'Yetkisiz' });
    }
    if (!fs.existsSync(imgPath)) {
      return res.status(404).json({ error: 'Dosya bulunamadi' });
    }
    const stat = fs.statSync(imgPath);
    const ext = path.extname(imgPath).toLowerCase();
    let info = { size: stat.size, ext };
    if (ext !== '.svg') {
      const meta = await sharp(imgPath).metadata();
      info.width = meta.width;
      info.height = meta.height;
      info.format = meta.format;
      info.density = meta.density;
    }
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Content Save Routes (existing) ---
app.post('/admin/save', requireAuth, (req, res) => {
  try {
    const data = loadData();
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

    saveData(data);
    res.redirect('/admin?success=1');
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).send('Kayit hatasi: ' + err.message);
  }
});

// API endpoint
app.get('/api/data', (req, res) => {
  res.json(loadData());
});

app.listen(PORT, () => {
  console.log(`OnSuite server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Media library: http://localhost:${PORT}/admin/media`);
});
