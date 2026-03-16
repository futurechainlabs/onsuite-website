# OnSuite Website -- Performance Benchmarker Report

**Auditor**: Performance Benchmarker (QA Agent)
**Date**: 2026-03-15
**Scope**: Full frontend and server-side performance audit
**Project**: OnSuite MES Platform Website (Express 4 + EJS)

---

## Executive Summary

The OnSuite website has several significant performance bottlenecks that will degrade Core Web Vitals scores, particularly LCP and FCP. The most critical issues are: (1) a 2.7 MB SVG hero image, (2) synchronous file reads on every page request in the main route handler, (3) render-blocking Google Fonts loaded via CSS `@import`, and (4) no static asset cache headers configured on `express.static`. Estimated total page weight for the homepage exceeds 5.5 MB before any caching.

---

## 1. Image Optimization

### 1.1 File Size Inventory

| File | Size | Format | Verdict |
|------|------|--------|---------|
| `hero/macbook-dashboard.svg` | **2,797 KB (2.7 MB)** | SVG | CRITICAL -- far exceeds 500 KB |
| `hero/factory-isometric.png` | **387 KB** | PNG | Should be WebP |
| `modules/optima-hero.png` | **347 KB** | PNG | Should be WebP |
| `modules/connect-hero.png` | **312 KB** | PNG | Should be WebP |
| `hero/hero-sphere.png` | **219 KB** | PNG | Should be WebP |
| `hero/macbook-dashboard.png` | **175 KB** | PNG | Should be WebP |
| `hero/global-connectivity.png` | **169 KB** | PNG | Should be WebP |
| `hero/macbook-custom-solutions.png` | **157 KB** | PNG | Should be WebP |
| `modules/monitora-hero.png` | **125 KB** | PNG | Should be WebP |
| `icons/tmc.png` | **101 KB** | PNG | Oversized for an icon |
| `modules/trace-hero.png` | **52 KB** | PNG | Acceptable |
| `logo.png` | **27 KB** | PNG | Acceptable |
| All other icons/logos | 1-16 KB each | PNG | Acceptable |

**Total image payload**: **5,204 KB (5.08 MB)** across 59 image files.

### 1.2 Critical Findings

**PERF-IMG-01: Hero SVG is 2.7 MB** -- Impact: **HIGH**
- File: `public/assets/images/hero/macbook-dashboard.svg`
- This single file is larger than most entire web pages. An SVG of this size likely contains embedded raster data or extremely complex paths.
- This image is loaded eagerly in the hero section (`loading="eager"` in `views/index.ejs` line 63).
- **Fix**: Convert to optimized WebP/AVIF at appropriate display dimensions. If the SVG contains vector content, simplify paths and remove metadata. Target: under 150 KB.

**PERF-IMG-02: All images are PNG, zero WebP/AVIF** -- Impact: **HIGH**
- Every raster image in the project is PNG format. No modern formats (WebP, AVIF) are used anywhere.
- WebP typically provides 25-35% smaller files than PNG at equivalent quality.
- 8 images exceed 100 KB and would benefit significantly from format conversion.
- **Fix**: Convert all PNG images to WebP with PNG fallback via `<picture>` elements. Use the existing Sharp dependency for build-time conversion.

**PERF-IMG-03: Icon `tmc.png` is 101 KB** -- Impact: **MEDIUM**
- File: `public/assets/images/icons/tmc.png`
- This is an icon file but weighs over 100 KB. Most other icons are 2-15 KB.
- **Fix**: Resize/recompress to match other icon sizes (target: under 15 KB), or convert to SVG.

### 1.3 Lazy Loading Assessment

Lazy loading is generally well-implemented:
- Hero image: correctly uses `loading="eager"` (line 63 of index.ejs)
- Below-fold images: all use `loading="lazy"` (proof-bar logos, module cards, sector tabs, partner logos)
- Module page hero: correctly uses `loading="eager"` (module.ejs line 40)
- Module feature icons: correctly use `loading="lazy"` (module.ejs line 92)

**PERF-IMG-04: Logo images in header/footer lack `loading` attribute** -- Impact: **LOW**
- `views/partials/header.ejs` line 7: `<img src="/assets/images/logo.png" ... >` -- no `loading` attribute
- `views/partials/header.ejs` line 130 (mobile menu logo): same issue
- `views/partials/footer.ejs` line 8: same issue
- `views/demo.ejs` line 22: same issue
- These are above-fold or always-visible elements, so the default `loading="eager"` behavior is actually correct. However, the footer logo could benefit from `loading="lazy"`.
- **Fix**: Add `loading="lazy"` to the footer logo.

---

## 2. CSS Analysis

### 2.1 File Size Inventory

| File | Size (bytes) | Lines | Pages Using It |
|------|-------------|-------|----------------|
| `design-system.css` | 10,307 | 252 | All pages |
| `pages.css` | 49,247 | 2,359 | All pages |
| `module.css` | 12,119 | 661 | Module detail pages only |
| `inner.css` | 13,730 | 686 | Inner pages (sectors, about, refs) |
| `demo.css` | 6,093 | 332 | Demo page only |
| **Total** | **91,496** | **4,290** | -- |

**Total CSS payload for homepage**: 59,554 bytes (58 KB) -- `design-system.css` + `pages.css`
**Total CSS payload for module page**: 71,673 bytes (70 KB) -- adds `module.css`

### 2.2 Findings

**PERF-CSS-01: CSS is unminified** -- Impact: **MEDIUM**
- All CSS files are delivered raw with full whitespace, comments, and formatting.
- `pages.css` alone is 49 KB unminified. Minification typically achieves 20-30% reduction.
- No gzip/brotli compression configured at the Express level either.
- **Fix**: Add a CSS minification build step (e.g., cssnano, lightningcss) or enable gzip compression middleware (`compression` npm package).

**PERF-CSS-02: Duplicate `.btn` class definitions across files** -- Impact: **LOW**
- The `.btn` base class is defined in three separate files:
  - `design-system.css` (lines 135-142): Full definition with shimmer animation
  - `module.css` (lines 462-473): Redefined with different properties
  - `inner.css` (lines 9-20): Redefined again
- `.btn--primary`, `.btn--ghost` also duplicated across all three files.
- This causes cascade conflicts and adds ~1.5 KB of redundant CSS.
- **Fix**: Remove duplicate `.btn` definitions from `module.css` and `inner.css`; rely on `design-system.css` as the single source of truth.

**PERF-CSS-03: Render-blocking font `@import` in CSS** -- Impact: **HIGH**
- `design-system.css` line 6 uses `@import url(...)` to load Google Fonts.
- This is a render-blocking chain: HTML loads CSS, CSS then fetches fonts from Google. This creates a two-hop waterfall that delays First Contentful Paint.
- The same fonts are also loaded via `<link>` tags in the HTML `<head>` of index.ejs (line 12), creating a **duplicate font request**.
- **Fix**: Remove the `@import` from `design-system.css` and rely solely on the `<link>` tags in HTML. Add `rel="preload"` for the font CSS.

**PERF-CSS-04: `pages.css` at 49 KB is unusually large** -- Impact: **MEDIUM**
- This single file contains styles for the header, hero, modules, sectors, tabs, ROI calculator, chatbot, footer, and all responsive breakpoints.
- Much of this CSS is not needed on inner pages but is still loaded.
- **Fix**: Consider splitting page-specific styles or, at minimum, minify and gzip.

---

## 3. JavaScript Analysis

### 3.1 File Overview

- **File**: `public/js/main.js`
- **Size**: 23,448 bytes (23 KB), 653 lines
- **Minified**: No

### 3.2 Findings

**PERF-JS-01: JavaScript is unminified** -- Impact: **MEDIUM**
- `main.js` is 23 KB raw. Minification would reduce this to approximately 12-14 KB.
- No source maps or build step exists.
- **Fix**: Add a minification step (terser, esbuild) to the build process.

**PERF-JS-02: Cursor glow runs `requestAnimationFrame` loop indefinitely** -- Impact: **MEDIUM**
- Lines 42-48: `animateGlow()` runs a perpetual rAF loop for the cursor glow effect.
- This loop runs even when the user is not moving the mouse, consuming CPU/battery.
- The loop calls `lerp()` and sets two style properties on every frame (~60fps).
- **Fix**: Only start the rAF loop on `mousemove` and stop it after a timeout of inactivity (e.g., 2 seconds).

**PERF-JS-03: Card tilt mousemove handlers lack debounce** -- Impact: **LOW**
- Lines 618-631: Every `.bento-grid .card` has a `mousemove` listener that updates `transform` on every mouse event.
- Lines 636-649: Every `.btn--primary, .btn--secondary` has a similar `mousemove` listener.
- These fire at high frequency (60-120 events/second per element) and trigger style recalculations.
- However, the impact is mitigated by only applying on desktop (`min-width: 1024px`).
- **Fix**: Use `requestAnimationFrame` to throttle these transform updates.

**PERF-JS-04: Good practices observed**
- Scroll handler uses `{ passive: true }` (line 63) -- good.
- ROI calculator correctly uses `debounce` with 80ms delay (line 437) -- good.
- IntersectionObserver used for scroll reveal and counting instead of scroll events -- good.
- Feature detection for IntersectionObserver with fallback (lines 191-206) -- good.

---

## 4. Server-Side Performance

### 4.1 Critical Findings

**PERF-SRV-01: `fs.readFileSync` on every page request (data.json)** -- Impact: **HIGH**
- File: `server.js`, lines 94-108
- The `loadData()` function is called on every route handler (`/`, `/moduller/:slug`, `/demo`, `/hakkimizda`, `/sektorler`, etc.)
- When Supabase is NOT configured (local development / fallback), line 107 executes:
  ```javascript
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  ```
- This performs a synchronous filesystem read and JSON parse on **every single HTTP request**, blocking the Node.js event loop.
- The homepage route (lines 257-267) has a fallback in the catch block (line 264) that also does `fs.readFileSync`.
- **Fix**: Cache `data.json` in memory at startup and update the cache only when data is saved via the admin panel. The data rarely changes -- it is site content managed by admins.

**PERF-SRV-02: Synchronous reads at startup for i18n and module data** -- Impact: **LOW**
- Lines 202-236: Multiple `fs.readFileSync` calls for `modules.json`, `sectors.json`, `references.json`, `i18n.json`, `data-en.json`, `modules-en.json`, `sectors-en.json`, `references-en.json`.
- These run once at server startup and are cached in module-level variables (`modulesData`, `sectorsData`, `refsData`, etc.).
- This is acceptable for startup but blocks the event loop during boot.
- **Fix**: Convert to async `fs.promises.readFile` at startup for cleaner architecture, but this is low priority.

**PERF-SRV-03: Demo form handler reads/writes JSON file synchronously** -- Impact: **MEDIUM**
- Lines 433-437: The `/api/demo` POST handler reads and writes `demo-requests.json` synchronously with `readFileSync`/`writeFileSync` on every form submission.
- Under concurrent submissions, this could cause data corruption or event loop blocking.
- **Fix**: Use async file operations or rely solely on Supabase when configured.

**PERF-SRV-04: Admin route reads demo-requests.json synchronously** -- Impact: **LOW**
- Line 471: `JSON.parse(fs.readFileSync(demoFile, 'utf8'))` on every admin panel load.
- **Fix**: Use async read or cache in memory.

**PERF-SRV-05: `scanLocalImages` does synchronous recursive directory traversal** -- Impact: **MEDIUM**
- Lines 172-198: When Cloudinary is not configured, the media library route triggers `scanLocalImages()` which recursively reads the filesystem with `readdirSync`, `statSync` -- all synchronous.
- This runs on every `/admin/media` request.
- **Fix**: Cache the scan results and invalidate on upload/delete. Use async fs methods.

### 4.2 No N+1 Query Patterns

- Supabase queries are simple single-row lookups (`select('content').eq('id', 1).single()`).
- No N+1 patterns detected. This is clean.

---

## 5. Font Loading

### 5.1 Font Families Loaded

The homepage loads **3 font families** with **13 total weight variants**:

| Family | Weights | Estimated Size |
|--------|---------|---------------|
| Plus Jakarta Sans | 300, 400, 500, 600, 700, 800 (6 weights) | ~180 KB |
| Inter | 300, 400, 500, 600 (4 weights) | ~120 KB |
| JetBrains Mono | 400, 500, 700 (3 weights) | ~90 KB |
| **Total estimated** | **13 weights** | **~390 KB** |

### 5.2 Findings

**PERF-FONT-01: Excessive font weights loaded** -- Impact: **HIGH**
- 13 font weight variants is excessive. Many of these weights are likely unused.
- Plus Jakarta Sans weight 300 is only used in reset styles or not at all.
- Inter weight 300 is likely unused.
- JetBrains Mono weight 500 appears unused (only 400 and 700 are typical for monospace).
- Estimated savings from removing unused weights: 90-120 KB.
- **Fix**: Audit actual font-weight usage in CSS and reduce to only used weights. Likely sufficient: Plus Jakarta Sans (500, 600, 700, 800), Inter (400, 500, 600), JetBrains Mono (400, 700) = 9 weights.

**PERF-FONT-02: `font-display: swap` is correctly used** -- Impact: NONE (positive)
- The Google Fonts URL includes `display=swap` parameter.
- This ensures text is visible immediately with fallback fonts while web fonts load.

**PERF-FONT-03: Duplicate font loading -- CSS `@import` AND HTML `<link>`** -- Impact: **HIGH**
- The homepage loads fonts TWICE:
  1. `index.ejs` line 12: `<link href="https://fonts.googleapis.com/css2?family=...">` (all 3 families)
  2. `design-system.css` line 6: `@import url('https://fonts.googleapis.com/css2?family=...')` (same 3 families)
- While browsers typically deduplicate the actual font file downloads, the CSS `@import` still creates a render-blocking waterfall: HTML -> CSS file -> font CSS -> font files (3 network hops).
- **Fix**: Remove the `@import` from `design-system.css`.

**PERF-FONT-04: Inner pages only load Inter but `design-system.css` imports all 3 families** -- Impact: **MEDIUM**
- Module page (`module.ejs` line 10) loads only Inter via `<link>`.
- But it also loads `design-system.css` which `@import`s all 3 families.
- This means inner pages load Plus Jakarta Sans and JetBrains Mono unnecessarily via the CSS import even though they are not in the HTML `<link>`.
- **Fix**: Remove the `@import` from `design-system.css` and ensure each page loads only the fonts it needs.

---

## 6. Static Asset Caching

### 6.1 Express Static Configuration

**File**: `server.js`, line 83:
```javascript
app.use(express.static(path.join(__dirname, 'public')));
```

### 6.2 Findings

**PERF-CACHE-01: No cache headers on static assets** -- Impact: **HIGH**
- `express.static` is used with default options, which means:
  - No `Cache-Control` header is set (defaults to no caching)
  - No `ETag` configuration (Express enables weak ETags by default, which helps but is not sufficient)
  - No `maxAge` setting
  - No `immutable` flag
- Every repeat visit re-downloads all CSS, JS, images, and fonts from the server.
- **Fix**: Configure `express.static` with cache headers:
  ```javascript
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '7d',        // Cache static assets for 7 days
    etag: true,
    lastModified: true
  }));
  ```
  For production, consider fingerprinted filenames with `maxAge: '1y', immutable: true`.

**PERF-CACHE-02: No gzip/brotli compression middleware** -- Impact: **HIGH**
- The Express server has no compression middleware installed.
- CSS (91 KB), JS (23 KB), and HTML responses are sent uncompressed.
- Text assets typically compress 60-80% with gzip.
- The `compression` package is not in `package.json` dependencies.
- **Fix**: Install and use the `compression` middleware:
  ```javascript
  const compression = require('compression');
  app.use(compression());
  ```
  Expected savings: ~70 KB on CSS alone, ~14 KB on JS.

---

## 7. Third-Party Dependencies

### 7.1 package.json Analysis

| Dependency | Size Contribution | Verdict |
|-----------|------------------|---------|
| `express` (4.22.1) | ~2 MB | Required -- core framework |
| `ejs` (3.1.10) | ~200 KB | Required -- template engine |
| `express-session` (1.19.0) | ~100 KB | Required -- admin auth |
| `multer` (2.1.1) | ~300 KB | Required -- file uploads |
| `sharp` (0.34.5) | ~25 MB | Heavy but justified -- image processing |
| `cloudinary` (2.9.0) | ~3 MB | Required when using Cloudinary CDN |
| `@supabase/supabase-js` (2.99.1) | ~5 MB | Required when using Supabase |
| `@google/generative-ai` (0.24.1) | ~2 MB | Required for chatbot |

**Total node_modules**: 51 MB

### 7.2 Findings

**PERF-DEP-01: `sharp` installs native binaries (~25 MB)** -- Impact: **MEDIUM**
- Sharp is the largest dependency by far. It includes platform-specific native binaries.
- It is used only for local image processing (when Cloudinary is not configured).
- The server already has a try/catch fallback (line 4-5) for when Sharp is not available.
- On a production deployment using Cloudinary, Sharp is dead weight.
- **Fix**: Make `sharp` an optional dependency (`optionalDependencies`) or exclude it in production Cloudinary deployments.

**PERF-DEP-02: Missing `compression` middleware** -- Impact: **HIGH**
- As noted in section 6.2, the `compression` package is not installed.
- This is the single highest-ROI fix for reducing transfer sizes.
- **Fix**: `npm install compression` and add `app.use(compression())` before routes.

**PERF-DEP-03: No unnecessary/bloated dependencies found** -- Impact: NONE (positive)
- All 8 dependencies serve a clear purpose. No unused packages detected.
- No heavy utility libraries (lodash, moment.js, etc.) are present.

---

## 8. Consolidated Issue Summary

### Critical (must fix before launch)

| ID | Issue | Impact | Est. Savings |
|----|-------|--------|-------------|
| PERF-IMG-01 | Hero SVG is 2.7 MB | HIGH | ~2.6 MB |
| PERF-SRV-01 | `readFileSync` on every request | HIGH | Event loop unblocking |
| PERF-CACHE-01 | No cache headers on static assets | HIGH | Repeat visit: ~5 MB saved |
| PERF-CACHE-02 | No gzip compression | HIGH | ~80 KB per page load |
| PERF-FONT-03 | Duplicate font loading (import + link) | HIGH | Eliminates waterfall |

### High Priority

| ID | Issue | Impact | Est. Savings |
|----|-------|--------|-------------|
| PERF-IMG-02 | All images PNG, zero WebP | HIGH | ~30% image size reduction |
| PERF-FONT-01 | 13 font weights, many unused | HIGH | ~90-120 KB |
| PERF-CSS-03 | Render-blocking @import in CSS | HIGH | Eliminates 1 waterfall hop |

### Medium Priority

| ID | Issue | Impact | Est. Savings |
|----|-------|--------|-------------|
| PERF-CSS-01 | CSS unminified (91 KB total) | MEDIUM | ~20-25 KB |
| PERF-JS-01 | JS unminified (23 KB) | MEDIUM | ~10 KB |
| PERF-JS-02 | Perpetual rAF loop for cursor glow | MEDIUM | CPU/battery savings |
| PERF-SRV-03 | Sync file I/O in demo form handler | MEDIUM | Event loop health |
| PERF-SRV-05 | Sync recursive dir scan for media | MEDIUM | Event loop health |
| PERF-CSS-04 | pages.css is 49 KB monolith | MEDIUM | Reduced unused CSS |
| PERF-IMG-03 | tmc.png icon is 101 KB | MEDIUM | ~85 KB |
| PERF-DEP-01 | Sharp adds 25 MB to deployment | MEDIUM | 25 MB deploy size |
| PERF-FONT-04 | Inner pages load all 3 font families via @import | MEDIUM | ~180 KB on inner pages |

### Low Priority

| ID | Issue | Impact | Est. Savings |
|----|-------|--------|-------------|
| PERF-CSS-02 | Duplicate .btn definitions | LOW | ~1.5 KB |
| PERF-JS-03 | Card tilt mousemove not throttled | LOW | Minor CPU savings |
| PERF-IMG-04 | Footer logo lacks loading="lazy" | LOW | Marginal |
| PERF-SRV-02 | Sync reads at startup | LOW | Cleaner architecture |
| PERF-SRV-04 | Admin sync read on each load | LOW | Admin-only impact |

---

## 9. Estimated Core Web Vitals Impact

### Current Estimated Performance (3G, mobile)

| Metric | Estimated Value | Target | Status |
|--------|----------------|--------|--------|
| LCP | ~6-8s | < 2.5s | FAIL |
| FID/INP | ~80ms | < 200ms | PASS |
| CLS | ~0.02 | < 0.1 | PASS |
| FCP | ~3-4s | < 1.8s | FAIL |
| Total Page Weight | ~5.5 MB | < 1.5 MB | FAIL |
| Time to Interactive | ~5s | < 3.8s | FAIL |

### After Recommended Fixes

| Metric | Estimated Value | Target | Status |
|--------|----------------|--------|--------|
| LCP | ~1.5-2.0s | < 2.5s | PASS |
| FID/INP | ~50ms | < 200ms | PASS |
| CLS | ~0.02 | < 0.1 | PASS |
| FCP | ~1.2-1.5s | < 1.8s | PASS |
| Total Page Weight | ~800 KB | < 1.5 MB | PASS |
| Time to Interactive | ~2.5s | < 3.8s | PASS |

---

## 10. Recommended Fix Priority Order

1. **Install `compression` middleware** -- 5 minutes, highest ROI
2. **Add `maxAge` to `express.static`** -- 2 minutes
3. **Remove `@import` from `design-system.css`** -- 1 minute
4. **Cache `data.json` in memory** instead of reading on every request -- 15 minutes
5. **Convert hero SVG to optimized WebP** -- 10 minutes
6. **Reduce font weights to only those used** -- 10 minutes
7. **Convert all PNG images to WebP** -- 30 minutes (script with Sharp)
8. **Minify CSS and JS** -- 20 minutes (add build step)
9. **Stop perpetual rAF loop** when mouse is idle -- 5 minutes
10. **Make Sharp an optional dependency** -- 5 minutes

---

**Performance Status**: FAILS performance SLA requirements
**Scalability Assessment**: Server-side sync I/O will not scale under concurrent load. Must be fixed before production traffic.
**Total Issues Found**: 19 (5 Critical, 3 High, 7 Medium, 4 Low)
