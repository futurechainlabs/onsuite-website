const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_PASS = process.env.ADMIN_PASS || 'OnSuite2025!';

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
  cookie: { maxAge: 3600000 } // 1 hour
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

// API endpoint for data.json (read-only for frontend)
app.get('/api/data', (req, res) => {
  res.json(loadData());
});

app.listen(PORT, () => {
  console.log(`OnSuite server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
