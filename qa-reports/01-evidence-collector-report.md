# QA Evidence Collector Report - OnSuite Website

**Date**: 2026-03-15
**Auditor**: EvidenceQA
**Scope**: All CSS files (design-system.css, pages.css, inner.css, module.css, demo.css) and all EJS templates
**Status**: ISSUES FOUND - 19 issues catalogued

---

## AREA 1: CSS Conflicts and Selector Overrides

### ISSUE #1 - CRITICAL: Triple `.btn` definition creates specificity wars

**Files affected**:
- `css/design-system.css` line 135-142 (defines `.btn` with `justify-content:center`, `position:relative`, `overflow:hidden`, `isolation:isolate`)
- `css/inner.css` line 9-20 (redefines `.btn` WITHOUT `justify-content`, `position`, `overflow`, `isolation`)
- `css/module.css` line 462-473 (redefines `.btn` again, identical to inner.css copy)

**Problem**: Three separate `.btn` definitions exist with different property sets. The design-system.css version includes `justify-content:center`, `position:relative`, `overflow:hidden`, `isolation:isolate`, and the shimmer `::after` pseudo-element sweep animation. The inner.css and module.css versions strip these properties out, which means:

1. On pages that load `design-system.css` + `inner.css` (sectors.ejs, sector.ejs, referanslar.ejs, hakkimizda.ejs), inner.css wins for `.btn` base styles because it loads later. The button loses `position:relative`, `overflow:hidden`, and `isolation:isolate`. This breaks the shimmer `::after` sweep animation defined in design-system.css because the pseudo-element needs `position:relative` on the parent.
2. On pages loading `design-system.css` + `module.css` (module.ejs), the same override happens.
3. The `min-width:200px` on `.btn--primary` in inner.css/module.css is NOT present in design-system.css, causing different button widths on different pages.

**Severity**: CRITICAL

---

### ISSUE #2 - HIGH: `.btn--primary` inconsistent padding between files

**Files affected**:
- `css/design-system.css` line 152-155: `.btn--primary` has `padding:16px 32px` (inherited from base `.btn`)
- `css/inner.css` line 21: `.btn--primary` adds `min-width:200px; justify-content:center`
- `css/module.css` line 475-480: same as inner.css

**Problem**: On the homepage (design-system.css + pages.css only), `.btn--primary` has no `min-width`. On inner pages and module pages, it gets `min-width:200px`. This creates visually inconsistent buttons across the site. A user navigating from homepage to a module page will see buttons change width.

**Severity**: HIGH

---

### ISSUE #3 - MEDIUM: `.btn--ghost` hover states differ between files

**Files affected**:
- `css/design-system.css` line 175: `.btn--ghost:hover` includes `color:#fff`
- `css/inner.css` line 24: `.btn--ghost:hover` does NOT set `color:#fff`
- `css/module.css` line 507-510: `.btn--ghost:hover` does NOT set `color:#fff`

**Problem**: Ghost buttons on homepage have explicit white text on hover. On inner/module pages, the hover text color is not explicitly set, relying on the cascade. Since inner.css redefines `.btn--ghost` with `color:#fff` in the base state, the hover might still work -- but the `background:rgba(255,255,255,.1)` IS different from design-system's version.

**Severity**: MEDIUM

---

### ISSUE #4 - MEDIUM: demo.css resets `*` box model and `body` font, conflicting with design-system.css

**File**: `css/demo.css` line 5-6
```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', system-ui, sans-serif; background: #FAFBFC; color: #1a1a2e; line-height: 1.6; }
```

**Problem**: demo.ejs loads both `design-system.css` AND `demo.css`. The demo.css universal reset re-applies `* { box-sizing: border-box; margin: 0; padding: 0; }` which is already done in design-system.css line 103. More critically, demo.css overrides `body` to use `'Inter'` only (no Plus Jakarta Sans for headings), `background: #FAFBFC` instead of `var(--surface-0)` (#FFFFFF), `line-height: 1.6` instead of `1.65`, and `color: #1a1a2e` instead of `var(--gray-700)`. This means the demo page has a subtly different base typography and background than the rest of the site.

**Severity**: MEDIUM

---

### ISSUE #5 - MEDIUM: demo.css redefines `.container` with different padding

**File**: `css/demo.css` line 8
```css
.container { max-width: 1280px; margin: 0 auto; padding: 0 64px; }
```

**Problem**: design-system.css defines `.container` with `padding: 0 var(--page-px)` where `--page-px: clamp(1.25rem, 4vw, 4rem)`. demo.css hardcodes `padding: 0 64px`. On mobile, demo.css does override this to `24px` and `16px` at its breakpoints. However, the desktop padding of 64px is significantly larger than design-system's max of 4rem (64px) -- in this case they happen to match at max, but the responsive scaling behavior is lost because clamp() is replaced with a fixed value.

**Severity**: MEDIUM

---

## AREA 2: Font Loading Inconsistencies

### ISSUE #6 - HIGH: Plus Jakarta Sans loaded but unused on 5 pages

**Evidence**:
- `views/index.ejs` line 12: Loads `Plus+Jakarta+Sans` + `Inter` + `JetBrains+Mono` -- CORRECT, all three used
- `views/module.ejs` line 10: Loads ONLY `Inter:wght@400;500;600;700` -- MISSING Plus Jakarta Sans and JetBrains Mono
- `views/demo.ejs` line 10: Loads ONLY `Inter:wght@400;500;600;700` -- MISSING Plus Jakarta Sans and JetBrains Mono
- `views/sectors.ejs` line 9: Loads ONLY `Inter:wght@400;500;600;700` -- MISSING Plus Jakarta Sans and JetBrains Mono
- `views/sector.ejs` line 10: Loads ONLY `Inter:wght@400;500;600;700` -- MISSING Plus Jakarta Sans and JetBrains Mono
- `views/referanslar.ejs` line 9: Loads ONLY `Inter:wght@400;500;600;700` -- MISSING Plus Jakarta Sans and JetBrains Mono
- `views/hakkimizda.ejs` line 9: Loads ONLY `Inter:wght@400;500;600;700` -- MISSING Plus Jakarta Sans and JetBrains Mono

**Problem**: design-system.css (loaded on ALL pages) defines `--font-h: 'Plus Jakarta Sans'` and `--font-d: 'JetBrains Mono'`. These CSS custom properties are used in the header, footer, buttons, badges, and other shared components rendered via partials/header.ejs and partials/footer.ejs. Since Plus Jakarta Sans is NOT loaded via Google Fonts on 6 out of 7 pages, ALL headings, nav links, buttons, and section titles will fall back to `system-ui, sans-serif` on these pages. This creates a jarring font inconsistency between the homepage and every other page.

Additionally, `JetBrains Mono` is used in inner.css for `.inner-stats__value` (line 96) and `.inner-listing__stat-val` (line 358), and `.about-story__year` (line 535). These monospace elements will also fall back on inner pages.

**Severity**: HIGH -- this is a visible cross-page inconsistency that users WILL notice.

---

### ISSUE #7 - MEDIUM: Font weight mismatch between Google Fonts load and CSS usage

**File**: `views/module.ejs` line 10 (and all inner pages)
```html
<link href="...css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Problem**: design-system.css loads Inter with weights `300;400;500;600` (line 6) -- note weight 300 included, 700 NOT included. Inner pages load Inter with `400;500;600;700` -- weight 700 included, 300 NOT included. CSS uses `font-weight:700` for h2, h3 headings (under Plus Jakarta Sans which falls back, see Issue #6). If Inter is the fallback, weight 700 IS available on inner pages but NOT on the homepage for Inter text. Meanwhile, Inter weight 300 is loaded on homepage but not inner pages.

**Severity**: MEDIUM

---

### ISSUE #8 - LOW: Potential FOUT due to `display=swap` on all font loads

**Files**: All EJS templates use `&display=swap` for Google Fonts.

**Problem**: With `display=swap`, text will render immediately in the fallback font (system-ui), then swap to the loaded font. This causes a Flash of Unstyled Text (FOUT). Given the font weight and family differences documented in Issues #6 and #7, the FOUT will be more pronounced on pages that only load Inter but use Plus Jakarta Sans CSS rules -- the system font will show, then stay as system font (since Plus Jakarta Sans never loads on these pages).

**Severity**: LOW -- this is standard behavior with `display=swap`, but the font inconsistency makes it worse.

---

## AREA 3: Image Path Inconsistencies

### ISSUE #9 - HIGH: Mixed relative and absolute image paths in index.ejs

**File**: `views/index.ejs`

**Absolute paths (with leading slash `/`)**: NONE in index.ejs content area (only in `<link>` tags for CSS/favicon)

**Relative paths (without leading slash)**:
- Lines 76-84: `src="assets/images/logos/references/..."` (9 images)
- Lines 221-302: `src="assets/images/sectors/..."` and `src="assets/images/modules/..."` (10 images)
- Lines 333-341: `src="assets/images/logos/partners/..."` (9 images)

**Absolute paths in other templates**:
- `views/partials/header.ejs` line 7: `src="/assets/images/logo.png"` (leading slash)
- `views/partials/header.ejs` line 130: `src="/assets/images/logo.png"` (leading slash)
- `views/partials/footer.ejs` line 8: `src="/assets/images/logo.png"` (leading slash)
- `views/demo.ejs` line 22: `src="/assets/images/logo.png"` (leading slash)

**Module images use dynamic path with leading slash**:
- `views/module.ejs` line 40: `src="/<%= mod.heroImage %>"` (leading slash prepended)
- `views/module.ejs` line 92: `src="/<%= feat.icon %>"` (leading slash prepended)

**Problem**: The 28 hardcoded images in index.ejs use relative paths (`assets/images/...`) while the shared partials (header, footer) and module page use absolute paths (`/assets/images/...`).

Express serves static files from `public/` directory (server.js line 83). Relative paths like `assets/images/logos/references/bosch.png` resolve relative to the current page URL. On the root page `/`, this resolves to `/assets/images/logos/references/bosch.png` which works. But if the index.ejs were ever rendered at a different route (e.g., `/en`), the relative path would resolve to `/en/assets/images/logos/references/bosch.png` which would 404.

Currently, the English homepage IS rendered at `/en` (server.js line 336), which means ALL 28 images in index.ejs will 404 on the English version of the homepage.

**Severity**: HIGH -- broken images on the English homepage.

---

### ISSUE #10 - LOW: `btn--link` class used in HTML but defined inconsistently

**File**: `views/index.ejs` lines 232, 252, 272, 292, 312
```html
<a href="..." class="btn--link">...</a>
```

**Problem**: The class `btn--link` is used WITHOUT the base `btn` class. In design-system.css, `.btn--link` is defined as a modifier (line 178-180) that inherits from `.btn`. Without the `.btn` base class, properties like `display:inline-flex`, `align-items:center`, `gap:8px`, `font-weight:600` will NOT be applied. The element will render as a plain anchor link. This is likely intentional (it works as a styled text link), but it breaks BEM convention where modifiers should always be paired with the block class.

**Severity**: LOW

---

## AREA 4: Responsive Breakpoint Gaps

### ISSUE #11 - HIGH: No tablet breakpoint (768px-1023px) for proof-bar metrics

**File**: `css/pages.css`

**Evidence**: The `.proof-bar__metrics` section (lines 890-927) has NO tablet breakpoint. The only responsive rule is at `max-width:767px` (line 929) which adjusts logos. On tablets (768px-1023px), the proof-bar metrics remain in a flex row with `gap: var(--s8)` (2rem). With 3-4 metric items, each containing a large `clamp(2.5rem, 4vw + 1rem, 4rem)` number, there is no wrapping or size reduction. The metrics may overflow or appear cramped on narrow tablets.

**Severity**: HIGH

---

### ISSUE #12 - MEDIUM: `ref-clients__grid` 5-column layout has no intermediate breakpoint

**File**: `css/inner.css` line 376-379
```css
.ref-clients__grid {
  grid-template-columns: repeat(5, 1fr);
}
```

**Responsive rules**:
- At 1023px: changes to `repeat(3, 1fr)` (line 656)
- At 767px: changes to `repeat(2, 1fr)` (line 675)

**Problem**: There is no breakpoint between 1024px and full desktop. A 5-column grid of client cards may be too narrow per card on 1024px-1200px screens. Each card gets approximately 200px at 1024px viewport, which may be tight for the card content.

**Severity**: MEDIUM

---

### ISSUE #13 - MEDIUM: `about-story__grid` 4-column layout jumps directly to 2-column

**File**: `css/inner.css` lines 516-518, 655
```css
.about-story__grid { grid-template-columns: repeat(4, 1fr); gap: 32px; }
/* At 1023px: */ .about-story__grid { grid-template-columns: repeat(2, 1fr); }
/* At 767px: */ .about-story__grid { grid-template-columns: 1fr; }
```

**Problem**: Going from 4 columns to 2 columns at 1023px is a large visual jump. There is no 3-column intermediate layout for the 1024px-1279px range where the 4-column layout may already be too cramped.

**Severity**: MEDIUM

---

### ISSUE #14 - MEDIUM: `partner-grid` 9 items in 4-column grid leaves orphan row

**File**: `css/pages.css` lines 1351-1357 and `views/index.ejs` lines 333-341

**Problem**: The partner-grid has 9 partner cards in a `repeat(4, 1fr)` grid. This produces 2 full rows of 4 + 1 orphan card in a third row, left-aligned. This looks unbalanced. At tablet (3-column), 9 items divide evenly into 3 rows. At mobile (2-column), there is 1 orphan. The 4-column desktop layout is the worst case visually.

**Severity**: MEDIUM

---

## AREA 5: Animation Performance

### ISSUE #15 - MEDIUM: Hero particles use `top` and `left` for positioning (not animatable performance issue)

**File**: `css/pages.css` lines 524-557

**Evidence**: The particles use `top`, `left`, and `right` for initial POSITIONING (not animation). The actual animation at line 559-564 uses `transform: translateY()` and `scale()`, which IS GPU-accelerated. The initial positions are set once and do not change. No performance issue with the animation itself.

However, the `float-particle` animation animates `opacity` alongside `transform`. Opacity changes cause compositing layer creation but are generally well-optimized. The `will-change` property is NOT set on particles, unlike `.cursor-glow` which has `will-change: transform` (line 2354).

**Severity**: MEDIUM -- minor optimization opportunity

---

### ISSUE #16 - LOW: `hero-mesh` animation uses `transform: scale() translate()` on `::before` pseudo

**File**: `css/pages.css` lines 454-457
```css
@keyframes hero-mesh {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: .7; transform: scale(1.1) translate(2%, -1%); }
}
```

**Problem**: Animating `opacity` and `transform` on a pseudo-element that also has a large `radial-gradient` background is fine for performance but creates a 600px gradient that scales to 1.1x on every frame. On lower-end devices, this could be a minor performance concern.

**Severity**: LOW

---

## AREA 6: Z-Index Stacking Order

### ISSUE #17 - MEDIUM: Mobile menu z-index (99) is BELOW header z-index (100)

**File**: `css/pages.css`
- `.header` z-index: 100 (line 14)
- `.mobile-menu` z-index: 99 (line 304)
- `.mega-menu` z-index: 200 (line 215)
- `.chatbot` z-index: 1000 (line 1920)

**Problem**: The mobile menu (z-index: 99) sits BELOW the header (z-index: 100). When the mobile menu slides in from the right, the fixed header will overlay on top of the mobile menu content. The mobile menu's close button and top section may be partially obscured by the header. The mobile menu should be z-index 101 or higher to properly cover the header when open.

**Severity**: MEDIUM -- mobile navigation usability issue

---

### ISSUE #18 - LOW: `.cursor-glow` z-index of 0 may interact with stacking contexts

**File**: `css/pages.css` line 2351

**Problem**: The cursor glow div has `z-index: 0`. Since it is `position: fixed`, it creates a new stacking context. With z-index 0, it sits at the same level as the default stacking context. This works because content with `position: relative` and no z-index will naturally stack above it, but any element with `z-index: -1` (like `.card::before` glow borders in design-system.css line 197) will render BELOW the cursor-glow, which may cause the card border glow to be hidden behind it.

**Severity**: LOW

---

## AREA 7: Missing/Broken HTML-CSS References

### ISSUE #19 - MEDIUM: `.dashboard-preview` component defined in CSS but unused in templates

**File**: `css/pages.css` lines 589-852

**Problem**: The CSS defines an elaborate `.dashboard-preview` component with `.dash-mock__header`, `.dash-mock__body`, `.gauge`, `.mini-chart`, `.dash-mock__line` sub-components spanning 263 lines of CSS. However, none of these classes appear in any EJS template. The homepage hero section (index.ejs lines 58-66) uses `.hero-image` instead. This is approximately 7KB of dead CSS being loaded on every page.

The `.dashboard-preview__screen` hover effect uses `perspective(1200px) rotateY(-3deg) rotateX(2deg)` which suggests a 3D tilt card -- this functionality exists in CSS but is never rendered in HTML.

**Severity**: MEDIUM -- dead code bloat, no functional issue

---

## AREA 8: Bento Grid Layout Analysis

The bento grid (pages.css lines 937-997) uses `grid-template-columns: repeat(4, 1fr)` at desktop, `repeat(2, 1fr)` at 1023px tablet, and `1fr` at 767px mobile.

Cards can be `--large` (span 2) or `--wide` (span 2) or default (span 1). At desktop with 4 columns, this works well if the data provides the right mix. At tablet with 2 columns, both `--large` and `--wide` span the full 2 columns (their `span 2` fits perfectly). At mobile, all spans are overridden to `span 1`.

**No issues found** with the bento grid layout itself. The responsive breakpoints are properly handled.

---

## Summary

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 1 | Triple `.btn` definition breaks shimmer animation | CRITICAL | design-system.css:135, inner.css:9, module.css:462 |
| 2 | `.btn--primary` inconsistent min-width | HIGH | inner.css:21, module.css:475 |
| 3 | `.btn--ghost` hover color inconsistency | MEDIUM | design-system.css:175, inner.css:24, module.css:507 |
| 4 | demo.css resets body/font conflicting with design-system | MEDIUM | demo.css:5-6 |
| 5 | demo.css redefines `.container` padding | MEDIUM | demo.css:8 |
| 6 | Plus Jakarta Sans not loaded on 6/7 pages | HIGH | module.ejs:10, demo.ejs:10, etc. |
| 7 | Font weight mismatch between pages | MEDIUM | All inner page templates |
| 8 | FOUT compounded by missing fonts | LOW | All templates |
| 9 | Relative image paths break on /en route | HIGH | index.ejs:76-341 |
| 10 | `btn--link` used without base `btn` class | LOW | index.ejs:232 |
| 11 | No tablet breakpoint for proof-bar metrics | HIGH | pages.css:890-927 |
| 12 | ref-clients 5-col has no intermediate breakpoint | MEDIUM | inner.css:376 |
| 13 | about-story 4-col jumps to 2-col abruptly | MEDIUM | inner.css:516 |
| 14 | Partner grid 9 items in 4-col leaves orphan | MEDIUM | pages.css:1351, index.ejs:333 |
| 15 | Hero particles missing `will-change` | MEDIUM | pages.css:524-557 |
| 16 | Hero mesh animation performance | LOW | pages.css:454 |
| 17 | Mobile menu z-index below header | MEDIUM | pages.css:14, pages.css:304 |
| 18 | Cursor-glow z-index interaction | LOW | pages.css:2351 |
| 19 | 263 lines of dead dashboard-preview CSS | MEDIUM | pages.css:589-852 |

**CRITICAL**: 1
**HIGH**: 4
**MEDIUM**: 10
**LOW**: 4
**Total**: 19 issues

---

**Next steps**: Issues #1 (btn conflicts), #6 (font loading), #9 (image paths on /en), #11 (proof-bar responsive), and #17 (mobile menu z-index) should be prioritized for immediate fix. These affect cross-page consistency, the English site functionality, and mobile navigation usability.
