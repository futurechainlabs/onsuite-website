# API Security & Stability Audit Report

**Project**: OnSuite Website (Express 4 Application)
**Tester**: API Tester Agent
**Date**: 2026-03-15
**Server File**: `server.js`
**Test Method**: Live server started on port 9876, tested with curl
**Quality Status**: FAIL
**Release Readiness**: NO-GO -- 5 critical, 6 high, 4 medium severity issues found

---

## Executive Summary

The OnSuite Express application has **5 critical security vulnerabilities** that must be fixed before any production deployment. The most severe issues are: path traversal in file uploads allowing writes outside the intended directory, stored XSS via the demo form, hardcoded admin credentials, and missing CSRF protection on all admin endpoints. The application also exposes full stack traces on malformed requests.

---

## CRITICAL Severity Issues

### C1. Path Traversal in File Upload (`/admin/media/upload`)

**Severity**: CRITICAL
**Endpoint**: `POST /admin/media/upload`
**File**: `server.js` line 593

The `folder` parameter from the request body is used directly in `path.join()` without any sanitization or validation. An authenticated admin can write files anywhere within and above the `public/` directory.

**Evidence** (test performed and confirmed):
```
curl -b cookies -X POST http://localhost:9876/admin/media/upload \
  -F "image=@/tmp/test.png" -F "folder=../../"

Result: HTTP 302 (success)
File written to: public/assets/images/../../test.png
Verified at: C:/Users/.../Yazilim_Sitesi/public/test.png
```

**Root cause** (server.js line 593):
```javascript
const targetFolder = path.join(UPLOAD_DIR, folder || 'hero');
// No validation that targetFolder is still inside UPLOAD_DIR
```

**Impact**: An attacker with admin access can overwrite `server.js`, `data.json`, `package.json`, or any file the process can write to. Could lead to remote code execution.

---

### C2. Stored XSS via Demo Form (`/api/demo`)

**Severity**: CRITICAL
**Endpoint**: `POST /api/demo`
**File**: `server.js` lines 412-445

No input sanitization is performed on any field. XSS payloads are stored directly to `data/demo-requests.json` and rendered in the admin panel.

**Evidence**:
```
curl -X POST http://localhost:9876/api/demo \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>","email":"test@test.com",
       "phone":"123","company":"Co","sector":"auto"}'
Result: {"ok":true}
```

Stored in `data/demo-requests.json`:
```json
{
  "name": "<script>alert(1)</script>",
  "email": "test@test.com",
  ...
}
```

**Impact**: When an admin views demo requests in the admin panel, the XSS payload executes in the admin's browser. This can steal the admin session cookie and gain full admin access.

**Additional validation failures**:
- Email field accepts `not-an-email`, `<img src=x onerror=alert(1)>@test.com`, `a]b@c`
- Phone field accepts `<script>` tags
- No length limits on any field
- No sector value validation (accepts any string)

---

### C3. Hardcoded Admin Password

**Severity**: CRITICAL
**File**: `server.js` line 15

```javascript
const ADMIN_PASS = process.env.ADMIN_PASS || 'OnSuite2025!';
```

The default password `OnSuite2025!` is committed to the public GitHub repository. No `.env` file exists in the project, meaning this default is likely used in production.

**Evidence**:
```
curl -X POST http://localhost:9876/admin/login -d "password=OnSuite2025!"
Result: HTTP 302 redirect to /admin (login successful)
```

---

### C4. Hardcoded Session Secret

**Severity**: CRITICAL
**File**: `server.js` line 87

```javascript
app.use(session({
  secret: process.env.SESSION_SECRET || 'onsuite-secret-key-change-in-prod',
  ...
}));
```

The session secret `onsuite-secret-key-change-in-prod` is hardcoded and committed to the public repo. With this secret, an attacker can forge valid session cookies and bypass authentication entirely.

---

### C5. SVG Upload Allows Stored XSS

**Severity**: CRITICAL
**Endpoint**: `POST /admin/media/upload`
**File**: `server.js` lines 73-77

SVG files are accepted by the upload filter. SVG files can contain embedded JavaScript via `<script>` tags. The uploaded SVG is served as a static file with no Content-Security-Policy or content-type override.

**Evidence**:
```
Uploaded file: evil.svg containing <script>alert(document.cookie)</script>
Result: Stored at public/assets/images/hero/evil.svg
Accessible at: http://localhost:9876/assets/images/hero/evil.svg
```

**Impact**: Anyone visiting the SVG URL will have JavaScript executed in the context of the application domain, with access to session cookies.

---

## HIGH Severity Issues

### H1. No CSRF Protection on Any Admin Endpoint

**Severity**: HIGH
**Affected endpoints**: All `POST` routes under `/admin/*`

No CSRF tokens are generated or validated. An attacker can create a malicious webpage that submits forms to the admin endpoints. If an authenticated admin visits the page, the attack succeeds.

**Evidence**:
```
grep -i "csrf" in admin page output: No CSRF token found
```

**Affected operations**: content save, media upload, media delete, media assign, login.

---

### H2. No Brute-Force Protection on Admin Login

**Severity**: HIGH
**Endpoint**: `POST /admin/login`
**File**: `server.js` lines 452-458

No rate limiting, no account lockout, no CAPTCHA. An attacker can make unlimited login attempts.

**Evidence**:
```
10 consecutive failed login attempts:
Attempt 1: HTTP 200
Attempt 2: HTTP 200
...
Attempt 10: HTTP 200
All returned HTTP 200 (re-rendered login page) with no delay or blocking.
```

---

### H3. Media Assign Accepts Arbitrary External URLs

**Severity**: HIGH
**Endpoint**: `POST /admin/media/assign`
**File**: `server.js` lines 608-638

No validation on the `url` parameter. An attacker can inject external malicious URLs into the site content stored in `data.json`.

**Evidence**:
```
curl -b cookies -X POST /admin/media/assign \
  -d '{"url":"http://evil.com/shell.php","target":"hero.heroImage"}'
Result: {"ok":true,"target":"hero.heroImage","url":"http://evil.com/shell.php"}
```

After this, `data.json` contained:
```
heroImage: http://evil.com/shell.php
```

This content is rendered on the public homepage for all visitors.

---

### H4. Full Stack Trace Exposure on Malformed JSON

**Severity**: HIGH
**Trigger**: Any POST endpoint with `Content-Type: application/json` and invalid JSON body

**Evidence**:
```
curl -X POST http://localhost:9876/api/demo \
  -H "Content-Type: application/json" \
  -d '{"broken json'

Response (400 error page):
SyntaxError: Unterminated string in JSON at position 13 (line 1 column 14)
    at JSON.parse (<anonymous>)
    at parse (C:\Users\huseyin.ongoren\...\body-parser\lib\types\json.js:92:19)
    at C:\Users\huseyin.ongoren\...\body-parser\lib\read.js:128:18
    at AsyncResource.runInAsyncScope (node:async_hooks:228:14)
    ...
```

**Impact**: Exposes full file system paths (`C:\Users\huseyin.ongoren\...`), Node.js internals, and library versions. Aids attackers in targeted exploitation.

---

### H5. Missing Security Headers

**Severity**: HIGH

The application sets no security headers. Only `X-Powered-By: Express` is present (which itself is an information disclosure).

**Missing headers**:
| Header | Status |
|--------|--------|
| `X-Powered-By` | Present as `Express` (should be removed) |
| `X-Frame-Options` | MISSING (clickjacking risk) |
| `X-Content-Type-Options` | MISSING (MIME sniffing risk) |
| `Content-Security-Policy` | MISSING (XSS mitigation) |
| `Strict-Transport-Security` | MISSING (HTTPS enforcement) |
| `X-XSS-Protection` | MISSING |
| `Referrer-Policy` | MISSING |

---

### H6. No Rate Limiting on Chatbot API

**Severity**: HIGH
**Endpoint**: `POST /api/chat`
**File**: `server.js` lines 769-827

No rate limiting exists. When Gemini API is configured, an attacker can abuse this endpoint to make unlimited calls to the Google Gemini API, consuming API quota and potentially incurring costs.

**Evidence**:
```
20 rapid sequential requests to /api/chat:
200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200
All returned HTTP 200 with no throttling.
```

When `GEMINI_CONFIGURED=true`, each request triggers a Gemini API call. No per-IP or per-session limits exist.

---

## MEDIUM Severity Issues

### M1. Session Cookie Missing `Secure` and `SameSite` Flags

**Severity**: MEDIUM
**File**: `server.js` lines 86-91

```javascript
cookie: { maxAge: 3600000 }
```

The session cookie is set with `HttpOnly` (default from express-session) but lacks:
- `secure: true` -- cookie sent over HTTP, vulnerable to interception
- `sameSite: 'strict'` or `'lax'` -- increases CSRF risk

---

### M2. No File Locking on JSON Data Files

**Severity**: MEDIUM
**File**: `server.js` lines 110-116, 433-437

Both `saveData()` and the demo form handler use synchronous `fs.writeFileSync()` with a read-modify-write pattern but no file locking. Under concurrent requests, the read-modify-write cycle creates a race condition window.

**Evidence**: Tested with 10 concurrent demo form submissions. All 10 entries were saved in this test, but the race window exists: if two requests read the file simultaneously before either writes, one write will overwrite the other's data.

The `loadData()` + `saveData()` pattern in `/admin/save` and `/admin/media/assign` has the same issue -- two simultaneous admin edits can lose data.

---

### M3. `/api/data` Exposes All Site Configuration

**Severity**: MEDIUM
**Endpoint**: `GET /api/data`
**File**: `server.js` lines 764-766

This public endpoint returns the entire `data.json` content with no authentication required.

**Evidence**:
```
curl http://localhost:9876/api/data
Keys exposed: ['site', 'hero', 'proofBar', 'modules', 'steps', 'metrics', 'testimonial', 'cta']
```

While this may be intentional for frontend rendering, it exposes the complete admin-editable configuration publicly.

---

### M4. Demo Form Error Response Returns 200 Instead of 500

**Severity**: MEDIUM
**File**: `server.js` lines 441-444

```javascript
} catch (err) {
    console.error('Demo submit error:', err);
    res.json({ ok: false, error: 'Sunucu hatasi' });
    // Returns HTTP 200 with error body instead of HTTP 500
}
```

Server errors return HTTP 200 with `ok: false`, making it harder for monitoring systems to detect failures.

---

## LOW Severity Issues

### L1. No Input Length Validation on Demo Form Fields

Fields like `name`, `company`, `message` accept arbitrarily long strings. While Express `body-parser` has a default 100KB limit, individual field limits would prevent abuse.

### L2. Media Assign Accepts Out-of-Bounds Array Indices

```
target: "modules.9999.image" -> {"ok":true}
target: "modules.-1.image"   -> {"ok":true}
```

These silently succeed without modifying anything, but indicate missing validation. With certain JavaScript engine behaviors, negative indices could have unexpected effects.

### L3. No Custom 404 Page

Unknown routes return Express's default HTML error page, which is unprofessional and reveals the framework.

### L4. Chatbot History Parameter Not Length-Limited

The `history` array in `/api/chat` is sliced to last 4 entries (line 800), but each entry's content is only truncated to 200 chars. A large history array (thousands of entries) could consume memory before the slice.

---

## Summary Table

| ID | Severity | Issue | Endpoint |
|----|----------|-------|----------|
| C1 | CRITICAL | Path traversal in file upload | `POST /admin/media/upload` |
| C2 | CRITICAL | Stored XSS via demo form | `POST /api/demo` |
| C3 | CRITICAL | Hardcoded admin password | `server.js:15` |
| C4 | CRITICAL | Hardcoded session secret | `server.js:87` |
| C5 | CRITICAL | SVG upload allows stored XSS | `POST /admin/media/upload` |
| H1 | HIGH | No CSRF protection | All admin POST routes |
| H2 | HIGH | No brute-force protection | `POST /admin/login` |
| H3 | HIGH | Arbitrary external URL injection | `POST /admin/media/assign` |
| H4 | HIGH | Stack trace exposure | All JSON POST routes |
| H5 | HIGH | Missing security headers | All routes |
| H6 | HIGH | No rate limiting on chatbot | `POST /api/chat` |
| M1 | MEDIUM | Insecure session cookie flags | Session config |
| M2 | MEDIUM | No file locking on JSON writes | Multiple routes |
| M3 | MEDIUM | Public data endpoint exposes config | `GET /api/data` |
| M4 | MEDIUM | Error responses return HTTP 200 | `POST /api/demo` |

---

## Recommended Fix Priority

**Immediate (before any deployment)**:
1. C3/C4: Move all secrets to environment variables, remove defaults from code
2. C1: Validate `folder` parameter -- resolve the path and verify it starts with `UPLOAD_DIR`
3. C2: Sanitize all demo form inputs (strip HTML tags, validate email format)
4. C5: Either reject SVG uploads or serve them with `Content-Type: image/svg+xml` and `Content-Disposition: attachment`
5. H4: Add global error handler that hides stack traces in production
6. H5: Add `helmet` middleware for security headers

**Before public launch**:
7. H1: Add CSRF token middleware (e.g., `csurf` or `csrf-csrf`)
8. H2: Add rate limiting on login (e.g., `express-rate-limit`)
9. H6: Add rate limiting on chatbot endpoint
10. H3: Validate URLs in media assign (whitelist domains or require relative paths)
11. M1: Add `secure: true` and `sameSite: 'lax'` to session cookie config

---

**Test artifacts cleaned up**: All test-uploaded files removed, `data.json` restored from git, `demo-requests.json` deleted, server process terminated.
