# Accessibility Audit Report

## Audit Overview

| Field | Value |
|-------|-------|
| **Product/Feature** | OnSuite MES Platform Website (Express + EJS) |
| **Standard** | WCAG 2.1 Level AA |
| **Date** | 2026-03-16 |
| **Auditor** | AccessibilityAuditor |
| **Methodology** | Static code analysis of 10 EJS templates + 4 CSS files |

## Testing Methodology

- **Template Analysis**: All 10 EJS view files inspected for semantic HTML, ARIA usage, form labels, alt text, heading hierarchy, and landmark regions
- **CSS Analysis**: All 4 CSS files inspected for focus indicators, color contrast (computed from declared values), reduced motion support, and target sizes
- **Keyboard Navigation Audit**: Code-level review of tab order, focus traps, interactive component patterns
- **Screen Reader Compatibility**: Markup-level assessment of ARIA roles, states, properties, and live regions

## Summary

| Severity | Count |
|----------|-------|
| **Critical** | 5 |
| **High** | 11 |
| **Medium** | 12 |
| **Low** | 7 |
| **Total** | **35** |

**WCAG Conformance**: DOES NOT CONFORM (Level AA)
**Assistive Technology Compatibility**: FAIL

---

## Critical Issues

### CRIT-01: No Skip Navigation Link

**WCAG Criterion**: 2.4.1 -- Bypass Blocks (Level A)
**Severity**: Critical
**User Impact**: Keyboard and screen reader users must tab through the entire header, mega menus, and mobile menu on every page before reaching main content. With 30+ links in the header/mega menus, this is a severe barrier.
**Location**: `views/partials/header.ejs` -- missing entirely
**Evidence**: No `<a href="#main-content">` or similar skip link exists anywhere in the header partial. The `<main>` tag in `index.ejs` also lacks an `id` attribute for skip link targeting.
**Recommended Fix**:
Add a visually hidden skip link as the first child inside `<body>` or at the start of the header:
```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```
Add `id="main-content"` to the `<main>` element. Style the skip link to be visible on focus:
```css
.skip-link {
  position: absolute; left: -9999px; top: auto;
  padding: 8px 16px; background: #000; color: #fff; z-index: 1000;
}
.skip-link:focus { left: 16px; top: 16px; }
```
**Testing Verification**: Tab into the page -- first focusable element should be the skip link; pressing Enter should move focus to main content.

---

### CRIT-02: Tabs Component Missing Keyboard Navigation and ARIA Linkage

**WCAG Criterion**: 2.1.1 -- Keyboard (Level A), 4.1.2 -- Name, Role, Value (Level A)
**Severity**: Critical
**User Impact**: The sector tabs on the homepage (`index.ejs` lines 207-316) use `role="tablist"`, `role="tab"`, and `role="tabpanel"` but are missing the required `aria-controls` on tabs and `aria-labelledby` on tab panels. Additionally, there is no JavaScript evidence of arrow key navigation between tabs -- only mouse/click interaction is implied.
**Location**: `views/index.ejs`, lines 208-315
**Evidence**:
```html
<button class="tabs__tab tabs__tab--active" role="tab" aria-selected="true" data-tab="automotive">
<!-- Missing: aria-controls="panel-automotive" id="tab-automotive" -->
```
```html
<div class="tabs__panel tabs__panel--active" role="tabpanel" data-panel="automotive">
<!-- Missing: aria-labelledby="tab-automotive" id="panel-automotive" -->
```
**Recommended Fix**:
- Add `id` and `aria-controls` to each tab button
- Add `id` and `aria-labelledby` to each tab panel
- Add `tabindex="0"` to the active tab and `tabindex="-1"` to inactive tabs
- Implement arrow key navigation (Left/Right) between tabs per WAI-ARIA Authoring Practices
- Ensure Home/End keys move to first/last tab

---

### CRIT-03: Form Validation Errors Not Announced to Screen Readers

**WCAG Criterion**: 3.3.1 -- Error Identification (Level A), 4.1.3 -- Status Messages (Level AA)
**Severity**: Critical
**User Impact**: When demo form validation fails (`views/demo.ejs` lines 158-165), the error class `demo-field--error` is applied visually, but there is no `aria-invalid`, no `aria-describedby` linking to error messages, and no `aria-live` region for error announcements. The `alert()` fallback for server errors is accessible but generic validation errors are silent to screen readers.
**Location**: `views/demo.ejs`, lines 78-126 (form), lines 158-165 (validation JS)
**Evidence**:
```javascript
f.classList.add('demo-field--error'); // Visual only, no screen reader notification
```
No `aria-live`, `role="alert"`, or `aria-invalid` attributes exist anywhere in the templates.
**Recommended Fix**:
- Add `aria-invalid="false"` to required inputs, toggle to `"true"` on error
- Add inline error messages with `aria-describedby` linking each input to its error message
- Add `role="alert"` or `aria-live="assertive"` to error message containers
- Add an error summary region at the top of the form

---

### CRIT-04: Focus Not Managed After Form Submission Success

**WCAG Criterion**: 4.1.3 -- Status Messages (Level AA), 2.4.3 -- Focus Order (Level A)
**Severity**: Critical
**User Impact**: After successful demo form submission, the form card is hidden (`display:none`) and a success message is shown. Focus is not moved to the success message, leaving screen reader and keyboard users stranded with no indication that submission succeeded.
**Location**: `views/demo.ejs`, lines 129-136 (success div), line 182 (JS show/hide)
**Evidence**:
```javascript
card.style.display = 'none';
success.style.display = 'block';
// No focus management -- focus remains on now-hidden element
```
**Recommended Fix**:
- Add `role="alert"` or `aria-live="polite"` to the success container
- After showing success, set `focus()` on the success heading or container (add `tabindex="-1"` to make it focusable)

---

### CRIT-05: Mobile Menu Focus Trap Not Implemented

**WCAG Criterion**: 2.1.2 -- No Keyboard Trap (Level A), 2.4.3 -- Focus Order (Level A)
**Severity**: Critical
**User Impact**: The mobile menu overlay (`views/partials/header.ejs` lines 127-167) uses `aria-hidden="true"` when closed, but when opened there is no focus trapping code visible. Keyboard users could tab behind the overlay into the page content. When opened, focus does not appear to be moved into the menu. When closed, focus likely does not return to the hamburger trigger.
**Location**: `views/partials/header.ejs`, lines 120-167
**Recommended Fix**:
- When menu opens: move focus to the first focusable element or the close button
- Trap Tab/Shift+Tab within the mobile menu overlay
- When Escape is pressed or close button clicked: close menu and return focus to hamburger button
- Set `aria-hidden="false"` on the menu when open; set `aria-hidden="true"` on the main page content behind it

---

## High Severity Issues

### HIGH-01: Language Switcher Uses `role="radiogroup"` Incorrectly

**WCAG Criterion**: 4.1.2 -- Name, Role, Value (Level A)
**Severity**: High
**User Impact**: The header language switcher (`header.ejs` line 108) has `role="radiogroup"` but its children are `<a>` links, not elements with `role="radio"`. Screen readers will announce this as a radio group but the children won't behave as radio buttons. This creates a confusing mismatch between announced and actual behavior.
**Location**: `views/partials/header.ejs`, line 108
**Evidence**:
```html
<div class="lang-switch" role="radiogroup" aria-label="Dil secimi">
  <a href="/" class="lang-switch__btn ...">TR</a>
  <a href="/en" class="lang-switch__btn ...">EN</a>
</div>
```
**Recommended Fix**:
Remove `role="radiogroup"`. Since these are navigation links, use a simple `<nav aria-label="Language selection">` or just keep the div without a role. Mark the current language link with `aria-current="true"`.

---

### HIGH-02: Header Navigation Labels Are Hardcoded in Turkish

**WCAG Criterion**: 3.1.2 -- Language of Parts (Level AA)
**Severity**: High
**User Impact**: The `aria-label` values on the header are hardcoded in Turkish ("Ana menu", "Dil secimi") even when `lang="en"` is set. Screen readers reading the English page will announce Turkish labels, confusing English-speaking users.
**Location**: `views/partials/header.ejs`, lines 6, 10, 108, 131, 135
**Evidence**:
```html
<a href="..." aria-label="OnSuite Ana Sayfa">   <!-- Always Turkish -->
<nav ... aria-label="Ana menu">                  <!-- Always Turkish -->
<div ... aria-label="Dil secimi">                <!-- Always Turkish -->
<button ... aria-label="Kapat">                  <!-- Always Turkish -->
<nav aria-label="Mobil menu">                    <!-- Always Turkish -->
```
**Recommended Fix**:
Use the translation system (`t.` variables) for all ARIA labels:
```html
<a href="..." aria-label="<%= t.aria.homeLink %>">
<nav aria-label="<%= t.aria.mainMenu %>">
```

---

### HIGH-03: No Focus Indicator Styles for Most Interactive Elements

**WCAG Criterion**: 2.4.7 -- Focus Visible (Level AA)
**Severity**: High
**User Impact**: Across all CSS files, there are almost no `:focus` or `:focus-visible` styles defined. The only focus styles found are on the ROI calculator select (`pages.css:1594`) and demo form fields (`demo.css:180-182`), but these use `outline: none` and replace it with only a `border-color` change. All buttons, links, cards, tab buttons, navigation links, mega menu items, mobile menu items, chatbot controls, and social links have zero custom focus styles. Browser defaults may be suppressed by the button reset (`border: none; background: none`).
**Location**: `public/css/design-system.css`, `public/css/pages.css` -- throughout
**Evidence**:
```css
/* design-system.css line 110 */
button { font-family: inherit; cursor: pointer; border: none; background: none; }
/* No :focus or :focus-visible rules anywhere for buttons */

/* pages.css:1594-1596 */
.roi-calc__select:focus {
  border-color: var(--blue-400);
  outline: none;  /* Removes native focus indicator! */
}
```
**Recommended Fix**:
Add a global focus-visible style and specific styles for interactive elements:
```css
:focus-visible {
  outline: 3px solid var(--blue-500);
  outline-offset: 2px;
}
a:focus-visible, button:focus-visible {
  outline: 3px solid var(--blue-500);
  outline-offset: 2px;
  border-radius: 4px;
}
```
Remove all `outline: none` declarations or ensure they are accompanied by equivalent visible focus indicators.

---

### HIGH-04: Multiple Pages Missing `<main>` Landmark

**WCAG Criterion**: 1.3.1 -- Info and Relationships (Level A), 2.4.1 -- Bypass Blocks (Level A)
**Severity**: High
**User Impact**: Screen reader users rely on landmarks to navigate page structure. Several pages have no `<main>` element: `module.ejs`, `hakkimizda.ejs`, `sectors.ejs`, `sector.ejs`, `referanslar.ejs`. Only `index.ejs` and `demo.ejs` wrap content in `<main>`.
**Location**: `views/module.ejs`, `views/hakkimizda.ejs`, `views/sectors.ejs`, `views/sector.ejs`, `views/referanslar.ejs`
**Recommended Fix**:
Wrap the main content area (everything between header and footer includes) in a `<main>` element on all pages.

---

### HIGH-05: Footer Accordion Headings Missing Keyboard/ARIA Support

**WCAG Criterion**: 2.1.1 -- Keyboard (Level A), 4.1.2 -- Name, Role, Value (Level A)
**Severity**: High
**User Impact**: Footer headings have a `data-accordion` attribute suggesting they act as accordion toggles on mobile, but they are `<h6>` elements with no `role="button"`, no `tabindex`, no `aria-expanded`, and no `aria-controls`. They are not keyboard operable.
**Location**: `views/partials/footer.ejs`, lines 13, 22, 35, 41
**Evidence**:
```html
<h6 class="footer__heading" data-accordion><%= t.footer.platform %></h6>
```
**Recommended Fix**:
Use the disclosure pattern:
```html
<h6 class="footer__heading">
  <button aria-expanded="false" aria-controls="footer-platform-links">
    <%= t.footer.platform %>
  </button>
</h6>
<ul class="footer__links" id="footer-platform-links">
```

---

### HIGH-06: Chatbot Panel Not Announced When Opened

**WCAG Criterion**: 4.1.3 -- Status Messages (Level AA)
**Severity**: High
**User Impact**: When the chatbot trigger is clicked, the chatbot panel (`chatbot.ejs` line 12) becomes visible but focus does not move into it, and there is no `aria-live` region. Screen reader users will not know the panel opened. Bot response messages are also not in a live region, so replies are never announced.
**Location**: `views/partials/chatbot.ejs`, lines 4-33
**Recommended Fix**:
- Move focus to the chatbot input when the panel opens
- Add `aria-live="polite"` to the messages container (`chatbot__messages`)
- Add `aria-expanded` to the trigger button to communicate panel state
- Ensure Escape closes the panel and returns focus to the trigger

---

### HIGH-07: SVG Icons Inside Links/Buttons Missing Accessible Names

**WCAG Criterion**: 1.1.1 -- Non-text Content (Level A)
**Severity**: High
**User Impact**: Multiple SVG icons inside buttons and links lack any accessible text. While some have `aria-hidden="true"` (correct), many decorative SVGs in standalone buttons do not. The arrow SVGs inside `.btn` elements across all pages are not hidden from the accessibility tree but also have no title or role.
**Location**: Multiple files -- `index.ejs` (lines 53, 432, 450), `module.ejs` (line 34), `sector.ejs` (line 29), `sectors.ejs` (line 53)
**Evidence**:
```html
<!-- Arrow SVG in button has no aria-hidden, will be announced as graphic -->
<svg class="btn__arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path ... />
</svg>
```
**Recommended Fix**:
Add `aria-hidden="true"` to all decorative SVGs within buttons/links that already have text labels. For standalone icon-only buttons, ensure `aria-label` is present (which is correctly done on chatbot buttons).

---

### HIGH-08: Heading Hierarchy Broken on Module Page

**WCAG Criterion**: 1.3.1 -- Info and Relationships (Level A)
**Severity**: High
**User Impact**: On `module.ejs`, heading levels skip and are inconsistent. The page goes: `h1` (hero title) then `h2` (problem title) then `h3` (problem/solution labels) then `h2` (features title) then `h3` (feature card titles) then `h2` (integrations title) then `h2` (sectors title) then `h2` (CTA title). However, the "How it Works" section in `index.ejs` uses `h4` directly under `h2`, skipping `h3`.
**Location**: `views/index.ejs` lines 168 (h4 under h2), `views/module.ejs` (generally OK but problem/solution uses h3 correctly)
**Evidence**:
```html
<!-- index.ejs: h2 section title, then directly h4 for step titles -->
<h2 class="section__title">...</h2>
...
<h4 class="step__title"><%= step.title %></h4>
```
The bento grid module cards also jump from `h2` to `h4` for wide/small cards while large cards use `h3`.
**Recommended Fix**:
Ensure heading levels are sequential: `h2` section titles should have `h3` sub-items, not `h4`. Change `step__title` and small/wide card titles from `h4` to `h3`.

---

### HIGH-09: Inline Styles Override User Preferences for Colors

**WCAG Criterion**: 1.4.1 -- Use of Color (Level A), 1.4.12 -- Text Spacing (Level AA)
**Severity**: High
**User Impact**: Multiple templates use inline `style` attributes for colors (e.g., `style="color:var(--cyan-200)"`, `style="color:#fff"`, `style="color:var(--success-light)"`). Inline styles override user stylesheets and forced-colors/high-contrast mode, making content invisible for users who depend on these accessibility features.
**Location**: `views/index.ejs` lines 424-427, 444-446; `views/hakkimizda.ejs` line 44; `views/partials/footer.ejs` lines 59-61
**Recommended Fix**:
Move all color declarations from inline `style` attributes to CSS classes. Use CSS custom properties or classes that can be overridden by user stylesheets and respect `forced-colors` mode.

---

### HIGH-10: Demo Page Missing Footer and Complete Navigation

**WCAG Criterion**: 3.2.3 -- Consistent Navigation (Level AA)
**Severity**: High
**User Impact**: The demo page (`demo.ejs`) has a completely different header structure with no footer at all. The header uses a simplified `demo-header` with only a logo and back link, while all other pages use the full header/footer partials. This breaks consistent navigation expectations.
**Location**: `views/demo.ejs`, lines 18-37
**Recommended Fix**:
Either include the standard footer partial or add a minimal footer with key navigation links. Ensure the demo page header provides equivalent navigation options.

---

### HIGH-11: ROI Calculator Sliders Missing Accessible Value Announcements

**WCAG Criterion**: 4.1.2 -- Name, Role, Value (Level A), 1.3.1 -- Info and Relationships (Level A)
**Severity**: High
**User Impact**: The ROI calculator range sliders (`index.ejs` lines 386-413) have `<label>` elements, but the labels are not programmatically associated via `for`/`id` pairing. The current value display spans (e.g., `roiLinesVal`) are not linked to the sliders via `aria-valuetext` or `aria-describedby`. Screen reader users cannot determine the current slider value.
**Location**: `views/index.ejs`, lines 384-415
**Evidence**:
```html
<label class="roi-calc__label"><%= t.home.roiLines %></label>
<input type="range" class="roi-calc__slider" id="roiLines" min="1" max="50" value="8">
<!-- Label not linked via for="roiLines" -->
```
**Recommended Fix**:
Add `for` attributes to labels matching input `id` values. Add `aria-valuetext` to sliders that gets updated by JavaScript when the value changes (e.g., `aria-valuetext="8 production lines"`).

---

## Medium Severity Issues

### MED-01: Breadcrumb Separator Spans Missing `aria-hidden`

**WCAG Criterion**: 1.3.1 -- Info and Relationships (Level A)
**Severity**: Medium
**User Impact**: In `sector.ejs` (line 22-23), breadcrumb separators are plain `<span>/</span>` without `aria-hidden="true"`. Screen readers will announce "slash" between breadcrumb items. The `module.ejs` breadcrumb correctly uses `aria-hidden="true"` on separators, but `sector.ejs` does not.
**Location**: `views/sector.ejs`, lines 22-23
**Recommended Fix**:
Add `aria-hidden="true"` to separator spans:
```html
<span aria-hidden="true">/</span>
```

---

### MED-02: Chatbot Teaser Close Button Has English-Only Label

**WCAG Criterion**: 3.1.2 -- Language of Parts (Level AA)
**Severity**: Medium
**User Impact**: The chatbot teaser close button (`chatbot.ejs` line 10) has `aria-label="Close"` hardcoded in English, even when the page is in Turkish.
**Location**: `views/partials/chatbot.ejs`, line 10
**Recommended Fix**:
Use a translatable label: `aria-label="<%= t.common.close %>"`.

---

### MED-03: Decorative Images in Module Feature Cards Have Empty Alt But Could Be Informative

**WCAG Criterion**: 1.1.1 -- Non-text Content (Level A)
**Severity**: Medium
**User Impact**: Feature card icons in `module.ejs` line 92 have `alt=""`, which marks them as decorative. If these icons convey meaning about the feature type, they need descriptive alt text. However, since a heading and description follow, `alt=""` may be acceptable.
**Location**: `views/module.ejs`, line 92
**Recommended Fix**:
Verify whether icons are purely decorative. If they convey unique information not repeated in the heading/description, add meaningful alt text. If decorative, `alt=""` is correct.

---

### MED-04: Color Contrast Issues -- Gray Text on White Backgrounds

**WCAG Criterion**: 1.4.3 -- Contrast (Minimum) (Level AA)
**Severity**: Medium
**User Impact**: Multiple text elements use `#6b7280` (gray-500 equivalent) on white `#FFFFFF` backgrounds. The computed contrast ratio is approximately 4.6:1, which barely passes for normal text (4.5:1 minimum) but fails for large text standard at AAA. More critically, `#9ca3af` is used in the demo page language switcher and chatbot placeholder -- this color on white yields approximately 3.0:1, which fails AA for normal text.
**Location**: `views/demo.ejs` lines 26, 28 (inline `color: #9ca3af`); `public/css/inner.css` line 87 (`color: #6b7280`)
**Evidence**:
```html
<!-- demo.ejs: #9ca3af on white = ~3.0:1 contrast, FAILS 4.5:1 -->
<a href="/demo" style="...color:<%= lang === 'tr' ? '#0089CF' : '#9ca3af' %>">TR</a>
```
**Recommended Fix**:
Replace `#9ca3af` with at least `#6b7280` (4.6:1) or darker. For AAA compliance, use `#4b5563` or darker.

---

### MED-05: Mega Menu Not Accessible via Keyboard-Only Activation

**WCAG Criterion**: 2.1.1 -- Keyboard (Level A)
**Severity**: Medium
**User Impact**: The CSS shows mega menus open on `:hover` of the parent `nav__item--dropdown` (pages.css line 222). While buttons have `aria-expanded` and `aria-haspopup`, the CSS rule `.nav__item--dropdown:hover .mega-menu` suggests hover-dependent display. If JavaScript does not also handle Enter/Space key activation and `aria-expanded` toggling, keyboard users may not be able to open the dropdown.
**Location**: `public/css/pages.css`, line 222; `views/partials/header.ejs`, lines 12-43
**Recommended Fix**:
Ensure JavaScript toggles `aria-expanded` on Enter/Space keypress and that the CSS selector `.nav__link[aria-expanded="true"] + .mega-menu` (which exists at line 223) is the primary mechanism, not hover alone. The hover-based rule should be a secondary convenience for mouse users.

---

### MED-06: Link Purpose Not Clear -- Multiple "Learn More" Links

**WCAG Criterion**: 2.4.4 -- Link Purpose (In Context) (Level A)
**Severity**: Medium
**User Impact**: The bento grid module cards in `index.ejs` (lines 124, 132, 140) all use identical link text via `<%= t.common.learnMore %>` (likely "Learn More" or "Daha Fazla"). When listed in a screen reader link list, multiple identical links provide no context about which module they relate to.
**Location**: `views/index.ejs`, lines 124, 132, 140
**Recommended Fix**:
Add `aria-label` with the module name or use visually hidden text:
```html
<a href="#" class="card__link">
  <%= t.common.learnMore %>
  <span class="sr-only"><%= mod.name %></span>
  <span class="btn__arrow" aria-hidden="true">&rarr;</span>
</a>
```

---

### MED-07: ROI Calculator Results Not Announced When Updated

**WCAG Criterion**: 4.1.3 -- Status Messages (Level AA)
**Severity**: Medium
**User Impact**: When users adjust sliders in the ROI calculator, the result values update dynamically but the results container has no `aria-live` region. Screen reader users will not know that the calculated ROI amount, OEE gain, downtime reduction, etc. have changed.
**Location**: `views/index.ejs`, lines 417-435
**Recommended Fix**:
Add `aria-live="polite"` to the results container:
```html
<div class="roi-calc__results" aria-live="polite" aria-atomic="true">
```

---

### MED-08: Footer `<h6>` Headings Inappropriate in Document Outline

**WCAG Criterion**: 1.3.1 -- Info and Relationships (Level A)
**Severity**: Medium
**User Impact**: Footer column headings use `<h6>` elements regardless of the heading hierarchy context. After main content that typically reaches `h2` or `h3`, jumping to `h6` creates confusing gaps in the document outline for screen reader users navigating by headings.
**Location**: `views/partials/footer.ejs`, lines 13, 22, 35, 41
**Recommended Fix**:
Use a more appropriate heading level (e.g., `h2` or `h3` for top-level footer sections) or use `<strong>` or `<p>` with `role="heading" aria-level="2"` if semantic headings would disrupt the hierarchy. Alternatively, footer section headings can remain visual-only with appropriate ARIA if desired.

---

### MED-09: `prefers-reduced-motion` Does Not Cover All Animations

**WCAG Criterion**: 2.3.3 -- Animation from Interactions (Level AAA, but best practice for AA)
**Severity**: Medium
**User Impact**: The `design-system.css` includes a `prefers-reduced-motion` media query (line 248-252) that sets `animation-duration` and `transition-duration` to near-zero and removes reveal transforms. However, the `perspective` and `rotateY` transforms on module hero images (`module.css` line 86), card hover transforms (`translateY(-6px)`), and button hover transforms are not addressed. The `glow-pulse` keyframe animation on badges is covered.
**Location**: `public/css/design-system.css`, lines 248-252
**Recommended Fix**:
Extend the reduced motion query to disable all `transform` transitions on hover:
```css
@media (prefers-reduced-motion: reduce) {
  .card:hover, .btn:hover, .mod-hero__mockup img {
    transform: none !important;
  }
}
```

---

### MED-10: Form `novalidate` Attribute Without Accessible Custom Validation

**WCAG Criterion**: 3.3.1 -- Error Identification (Level A)
**Severity**: Medium
**User Impact**: The demo form uses `novalidate` (`demo.ejs` line 78), disabling native browser validation. The custom validation (lines 158-165) only adds/removes a CSS class. There are no visible error messages displayed -- only visual border styling changes. Users who cannot see color changes (color blindness, low vision) will not know which fields have errors.
**Location**: `views/demo.ejs`, line 78
**Recommended Fix**:
Add visible text error messages below each field. Use both color and text/icon indicators for errors. Ensure error messages are programmatically linked via `aria-describedby`.

---

### MED-11: Multiple `<section>` Elements Missing Accessible Names

**WCAG Criterion**: 1.3.1 -- Info and Relationships (Level A)
**Severity**: Medium
**User Impact**: Most `<section>` elements across all pages lack `aria-label` or `aria-labelledby` attributes. The proof-bar in `index.ejs` correctly has `aria-label`, but sections like `mod-problem`, `mod-features`, `mod-integrations`, `mod-sectors`, `about-story`, `about-values`, `about-contact`, etc. have no accessible names. Screen reader users navigating by landmarks will hear "region" without any identifying label.
**Location**: All template files -- most `<section>` elements
**Recommended Fix**:
Add `aria-labelledby` pointing to the section heading, or `aria-label` for sections without visible headings:
```html
<section class="mod-features" id="features" aria-labelledby="features-heading">
  <h2 id="features-heading">...</h2>
```

---

### MED-12: Proof Bar Counter Animation Starts from Zero

**WCAG Criterion**: 1.3.1 -- Info and Relationships (Level A)
**Severity**: Medium
**User Impact**: The proof bar metrics (`index.ejs` line 89) and result metrics (line 188) display "0" initially with `data-count` attributes for JavaScript animation. If JavaScript fails or is slow, screen readers read "0" for all metrics. The meaningful values are only in `data-count`, which is not exposed to assistive technology.
**Location**: `views/index.ejs`, lines 89, 188
**Evidence**:
```html
<span class="proof-bar__number" data-count="<%= m.count %>">0</span>
```
**Recommended Fix**:
Set the initial text content to the actual value and animate from there, or use `aria-label` on the metric container with the real value:
```html
<span class="proof-bar__number" data-count="<%= m.count %>" aria-label="<%= m.count %>">0</span>
```

---

## Low Severity Issues

### LOW-01: Card Links Point to `#` (Non-functional Links)

**WCAG Criterion**: 2.4.4 -- Link Purpose (In Context) (Level A)
**Severity**: Low
**User Impact**: Module card "Learn More" links in `index.ejs` (lines 124, 132, 140) all point to `href="#"`, which navigates to the top of the page rather than to a module detail page. This is confusing for all users but especially disorienting for screen reader users.
**Location**: `views/index.ejs`, lines 124, 132, 140
**Recommended Fix**:
Link to the actual module detail pages: `href="<%= prefix %>/<%= modPath %>/<%= mod.slug %>"`.

---

### LOW-02: Footer Privacy and Cookie Links Point to `#`

**WCAG Criterion**: 2.4.4 -- Link Purpose (In Context) (Level A)
**Severity**: Low
**User Impact**: Privacy and cookie policy links in the footer (`footer.ejs` lines 52, 54) point to `#`, providing no actual content.
**Location**: `views/partials/footer.ejs`, lines 52, 54
**Recommended Fix**:
Create actual privacy/cookie policy pages or remove the links until content exists.

---

### LOW-03: Social Media Links Point to `#`

**WCAG Criterion**: 2.4.4 -- Link Purpose (In Context) (Level A)
**Severity**: Low
**User Impact**: LinkedIn and YouTube links in the footer (`footer.ejs` lines 64-65) point to `#` despite having proper `aria-label` attributes. Clicking these navigates to page top.
**Location**: `views/partials/footer.ejs`, lines 64-65
**Recommended Fix**:
Update with actual social media URLs or remove until available.

---

### LOW-04: `data-theme="light"` Only on Homepage

**WCAG Criterion**: Best practice (not a specific WCAG violation)
**Severity**: Low
**User Impact**: Only `index.ejs` sets `data-theme="light"` on the `<html>` element. If theme switching were to be implemented, other pages would not respond consistently.
**Location**: `views/index.ejs`, line 2
**Recommended Fix**:
Add `data-theme` consistently across all pages or remove if unused.

---

### LOW-05: `<blockquote>` in Testimonial Missing `<cite>` Element

**WCAG Criterion**: 1.3.1 -- Info and Relationships (Level A)
**Severity**: Low
**User Impact**: The testimonial quote (`index.ejs` line 358-360) uses `<blockquote>` but the attribution is outside the blockquote in separate divs. Adding a `<cite>` or `<footer>` within the blockquote would improve semantic meaning.
**Location**: `views/index.ejs`, lines 358-367
**Recommended Fix**:
Include the attribution inside the blockquote:
```html
<blockquote>
  <p><%= data.testimonial.quote %></p>
  <footer><cite><%= data.testimonial.name %></cite>, <%= data.testimonial.role %></footer>
</blockquote>
```

---

### LOW-06: Touch Target Sizes May Be Too Small

**WCAG Criterion**: 2.5.8 -- Target Size (Minimum) (Level AA, WCAG 2.2)
**Severity**: Low
**User Impact**: Language switcher links are styled with `padding: 2px` (`pages.css` line 140), and the font size is `var(--body-s)` (0.875rem / 14px). The resulting touch target is likely below the 24x24px minimum required by WCAG 2.2 Target Size.
**Location**: `public/css/pages.css`, lines 133-142
**Recommended Fix**:
Increase padding on language switcher buttons to ensure at least 24x24px target size, or increase overall clickable area.

---

### LOW-07: Badge Dot Animation May Cause Distraction

**WCAG Criterion**: 2.2.2 -- Pause, Stop, Hide (Level A)
**Severity**: Low
**User Impact**: The `glow-pulse` animation on `.badge__dot` (`design-system.css` line 237) runs infinitely. While subtle, continuous animations can be distracting for users with attention-related disabilities. The `prefers-reduced-motion` media query does cover this animation, which is good.
**Location**: `public/css/design-system.css`, line 237
**Recommended Fix**:
Already handled by `prefers-reduced-motion`. No change required, but consider adding a visible pause control for users who do not use OS-level reduced motion settings.

---

## What Is Working Well

- **Language attribute**: All pages correctly set `lang="<%= lang %>"` on the `<html>` element, dynamically matching the content language
- **Viewport meta tag**: All pages include proper viewport configuration for responsive design
- **Image alt text on homepage**: Logo images, partner logos, reference logos, and hero images all have descriptive alt text
- **ARIA on decorative elements**: Particle divs, separators, and decorative arrows correctly use `aria-hidden="true"` throughout
- **Semantic header structure**: The header uses `<nav>` with `aria-label`, dropdown buttons use `aria-expanded` and `aria-haspopup`
- **Form labels on demo page**: All form fields have properly associated `<label>` elements with `for`/`id` pairing
- **Chatbot buttons have ARIA labels**: Trigger, minimize, and send buttons all have `aria-label` attributes
- **Breadcrumb navigation**: Module page breadcrumb correctly uses `aria-label="Breadcrumb"` and `aria-hidden="true"` on separators
- **`prefers-reduced-motion` support**: The design system includes a media query that disables animations and transitions for users who prefer reduced motion
- **`.sr-only` utility class available**: A screen-reader-only utility class is defined in the design system CSS
- **Hidden tab panels**: Non-active tab panels correctly use the `hidden` attribute
- **Semantic HTML for content structure**: Good use of `<section>`, `<nav>`, `<header>`, `<footer>`, and heading elements throughout

---

## Remediation Priority

### Immediate -- Fix Before Release (Critical + High)

1. **CRIT-01**: Add skip navigation link to all pages
2. **CRIT-02**: Complete tab component ARIA attributes and keyboard navigation
3. **CRIT-03**: Add accessible form validation with error announcements
4. **CRIT-04**: Manage focus after form submission success
5. **CRIT-05**: Implement focus trapping in mobile menu overlay
6. **HIGH-03**: Add `:focus-visible` styles for all interactive elements
7. **HIGH-04**: Add `<main>` landmark to all pages
8. **HIGH-02**: Translate all hardcoded Turkish ARIA labels
9. **HIGH-11**: Associate ROI slider labels with inputs and add `aria-valuetext`
10. **HIGH-06**: Add `aria-live` to chatbot messages and manage panel focus
11. **HIGH-01**: Fix incorrect `role="radiogroup"` on language switcher
12. **HIGH-05**: Make footer accordion headings keyboard accessible with ARIA
13. **HIGH-07**: Add `aria-hidden="true"` to decorative SVG arrows in buttons
14. **HIGH-08**: Fix heading hierarchy (h2 to h4 skips)
15. **HIGH-09**: Move inline color styles to CSS classes
16. **HIGH-10**: Add footer to demo page for consistent navigation

### Short-term -- Fix Within Next Sprint (Medium)

1. **MED-04**: Fix color contrast for `#9ca3af` text
2. **MED-10**: Add visible error messages to form validation
3. **MED-06**: Differentiate "Learn More" links with module context
4. **MED-07**: Add `aria-live` to ROI calculator results
5. **MED-05**: Ensure mega menu opens on keyboard activation, not just hover
6. **MED-01**: Add `aria-hidden` to breadcrumb separators in sector.ejs
7. **MED-11**: Add accessible names to `<section>` elements
8. **MED-12**: Set real initial values for counter animations
9. **MED-02**: Translate chatbot teaser close button label
10. **MED-08**: Fix `h6` heading levels in footer
11. **MED-09**: Extend `prefers-reduced-motion` to cover hover transforms
12. **MED-03**: Verify feature card icon alt text appropriateness

### Ongoing -- Address in Regular Maintenance (Low)

1. **LOW-01**: Replace `href="#"` links with actual module URLs
2. **LOW-02**: Create privacy/cookie policy pages
3. **LOW-03**: Add real social media URLs
4. **LOW-06**: Increase touch target sizes on language switcher
5. **LOW-04**: Standardize `data-theme` attribute across pages
6. **LOW-05**: Improve blockquote semantics in testimonial section
7. **LOW-07**: No action required (already handled by reduced motion)

---

## Recommended Next Steps

1. **Global focus style implementation**: Create a single `:focus-visible` rule in `design-system.css` that provides a clear, high-contrast focus indicator on all interactive elements. This is the single highest-impact change.

2. **Accessibility testing integration**: Add `@axe-core/cli` or `pa11y` to the development workflow to catch regressions automatically. Run against all page templates after each change.

3. **Screen reader testing session**: Conduct a manual testing session with VoiceOver (macOS/iOS) and NVDA (Windows) covering the demo request form flow end-to-end, the module browsing journey, and the ROI calculator interaction.

4. **ARIA translation system**: Extend the existing `t.` translation object with an `aria` namespace containing all accessibility-related labels so they are properly localized for both TR and EN.

5. **Keyboard navigation E2E test**: Create a manual testing checklist that walks through every interactive flow using only the keyboard (Tab, Enter, Space, Escape, Arrow keys). Document the expected focus order for each page.

6. **Re-audit timeline**: After implementing Critical and High fixes, schedule a re-audit within 2 weeks to verify fixes and catch any regressions.
