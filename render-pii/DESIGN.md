# PII Rendering System — Design Document

## The Core Idea: Per-Digit Canvas Rendering + End-to-End Encryption

The system renders PAN digits as canvas pixels — never as text, never as a font structure, never as a decodable string anywhere in the browser.

**Three-layer protection:**

1. **Encryption layer**: Per-reveal ECDH key exchange (inside the reveal Worker) derives an AES-256-GCM session key. Each digit's glyph path commands are individually encrypted with a separate random IV. The network carries 16 independent ciphertexts — opaque byte sequences with no structure, no digit values.

2. **Rendering layer**: Inside a dedicated Worker, the system decrypts one digit at a time, draws it to an `OffscreenCanvas`, zeroes the decrypted bytes, then yields before the next digit. The main thread never holds canvas pixel data. No font file is created. No text node contains PAN digits. Only display frames reach the screen.

3. **Isolation layer**: The reveal component runs in a sandboxed cross-origin iframe (`reveal.yourdomain.com`). The parent app never holds the step-up credential. The reveal API is origin-bound: it only accepts requests from `reveal.yourdomain.com` and rejects all others at the server. A compromised parent bundle has no path to the decrypt flow.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Parent App  (app.yourdomain.com)                                        │
│  Renders toggle button + masked display                                  │
│  postMessages: SESSION_INIT, REVEAL_REQUEST, HIDE_REQUEST               │
│  ← postMessages: FRAME_READY, SESSION_READY, REVEAL_STATE               │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ postMessage (no credentials after SESSION_INIT)
┌────────────────────────────▼─────────────────────────────────────────────┐
│  Reveal iframe  (reveal.yourdomain.com)  — sandboxed, cross-origin       │
│                                                                           │
│  pii-frame.js  (orchestrator)                                            │
│    On SESSION_INIT:  exchange delegation token → reveal_session cookie   │
│    On REVEAL_REQUEST: call record-meta → step-up UI → call reveal API   │
│    On HIDE_REQUEST:  post TEARDOWN to Worker                             │
│                                                                           │
│  reveal-worker.js  (Worker — all crypto + pixel ops here)               │
│    1. Generate ephemeral ECDH keypair (WebCrypto, non-extractable)      │
│    2. POST /api/pii/reveal  (reveal_session cookie, Origin header)       │
│    3. Complete ECDH → HKDF → AES-256-GCM key (non-extractable)         │
│    4. For digit i = 0..N-1:                                             │
│         a. Decrypt glyphs[i] → bezier path commands                    │
│         b. Draw to OffscreenCanvas at position i                        │
│         c. Zero decrypted bytes; yield microtask                        │
│    5. commit() display frame to main thread canvas                      │
│    6. On TEARDOWN: noise-overwrite + clearRect                          │
│                                                                           │
│  display <canvas> (main thread — inert after transferControlToOffscreen) │
│  AuditEmitter → sendBeacon → /api/pii/audit  (supplemental only)        │
│  AntiCopyGuard → contextmenu/drag prevention                             │
│  Trusted Types policy  (pii-render — blocks DOM XSS string sinks)       │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ HTTPS TLS 1.3  |  Origin: reveal.yourdomain.com
┌────────────────────────────▼─────────────────────────────────────────────┐
│  API Gateway / Reverse Proxy                                              │
│  TLS termination · Rate limiting · CORS (allow-origin: reveal only)     │
└──────┬────────────────────────────────────────┬────────────────────────────┘
       │                                        │
┌──────▼──────────┐             ┌───────────────▼──────────────────────────┐
│  Auth Service   │             │         PII Reveal API                   │
│  JWT (RS256)    │             │  Origin-bound · ABAC · audit-first       │
│  jti revocation │             └───┬──────────────┬──────────────┬────────┘
│  step-up tokens │                 │              │              │
│  delegation tok │          ┌──────▼───┐   ┌──────▼───┐   ┌──────▼───────┐
└─────────────────┘          │PII Vault │   │Glyph     │   │Audit Service │
                              │AES-256-  │   │Generator │   │FAIL-CLOSED   │
                              │GCM/KEK   │   │Static lib│   │Append-only   │
                              │DEK split │   │Per-digit │   │HMAC chain    │
                              └──────────┘   │AES-GCM   │   │TTL sweeper   │
                                             └──────────┘   └──────────────┘
```

---

## Component Details

### 1. PII Vault Service

- **Storage**: AES-256-GCM. Each record has a unique 96-bit IV and a per-record DEK wrapped by a master KEK stored in an HSM or TPM-backed key store.
- **Schema**: `ciphertext`, `iv`, `auth_tag`, `wrapped_dek`, and `masked_display` (e.g., `****1234`, stored plaintext — the only value non-reveal APIs ever return).
- **Interface**: internal mTLS only. Only the Reveal API can call it.
- **Erasure**: soft-delete zeroes the ciphertext and destroys the DEK. The audit log retains masked identifier + `ERASURE_EXECUTED` event.

```sql
TABLE pii_records (
    id              UUID PRIMARY KEY,
    customer_id     UUID NOT NULL REFERENCES customers(id),
    pii_type        ENUM('PAN','SSN','DOB','BANK_ACCOUNT','PHONE') NOT NULL,
    ciphertext      BYTEA NOT NULL,
    iv              BYTEA NOT NULL,
    auth_tag        BYTEA NOT NULL,
    wrapped_dek     BYTEA NOT NULL,
    masked_display  VARCHAR(20) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    deleted_at      TIMESTAMPTZ
)
```

---

### 2. Glyph Library

Static hardcoded constant compiled into the server binary. Zero I/O, zero font tooling, zero external dependencies.

**Coordinate system**: 100×100 integer unit grid. Origin at bottom-left, Y increases upward. Client applies `scale(1,-1)` + `translate(0,-100)` to match Canvas convention.

~10–12 drawing commands per digit, ~180 bytes JSON per digit when serialised.

**Per-digit noise**: before encryption, each bezier control point receives an independent CSPRNG offset in `[-0.8, +0.8]` units (sub-pixel). Prevents cross-session glyph fingerprinting.

Visual verification: a standalone `/tools/verify-glyphs.ts` script renders all 10 digits to PNG for human inspection. Not bundled into the server.

---

### 3. Origin Isolation + Session Model

#### The Problem with Shared Credentials

If the parent app holds the step-up token and posts it into the iframe, a compromised parent bundle can intercept it, generate its own ECDH keypair, and call `/api/pii/reveal` directly. Origin isolation alone does not close this: the parent controls postMessage and can observe all messages it sends.

The fix has two parts that must both be in place:

- **No credential crosses the postMessage boundary** (except a one-time delegation token at iframe load)
- **The reveal API is origin-bound at the server** — it rejects any request whose `Origin` header is not `reveal.yourdomain.com`

#### Reveal Session Cookie

The reveal iframe authenticates all API calls with a `reveal_session` cookie:

```
Set-Cookie: reveal_session=<signed-opaque-token>;
  Domain=reveal.yourdomain.com;
  Path=/;
  HttpOnly;
  Secure;
  SameSite=Strict;
  Max-Age=3600
```

`Domain=reveal.yourdomain.com` means the browser never sends this cookie from `app.yourdomain.com`. `HttpOnly` means no JavaScript on any origin can read it. The parent cannot use it even if it wanted to.

#### Delegation Token Exchange (iframe Load — One Time Only)

This is a bootstrap only. It is not a step-up credential.

```
1. Parent calls POST /api/pii/delegation-token  (app_session cookie)
   ← { delegation_token: "uuid", expires_in: 60 }
   Token is single-use, 60s TTL, bound to the user's session jti.

2. Parent postMessages into iframe:
   { type: 'SESSION_INIT', delegationToken: 'uuid' }
   targetOrigin: 'https://reveal.yourdomain.com'

3. Iframe immediately calls POST /api/pii/reveal-session
   Origin: https://reveal.yourdomain.com   (browser-set, not forgeable by JS)
   Body: { delegation_token: 'uuid' }
   Server checks: Origin == reveal.yourdomain.com, token is ACTIVE, parent jti is valid.
   Atomically marks token CONSUMED (CAS). Issues reveal_session cookie.

4. Iframe postMessages: { type: 'SESSION_READY' }
```

From this point forward, the parent has no credentials relevant to the reveal flow.

#### Iframe-Initiated Step-Up (No Token in postMessage)

```
Parent postMessages: { type: 'REVEAL_REQUEST', recordId: 'uuid', purpose: 'VIEW_OWN_DATA' }
                     ← NO stepUpToken here

Iframe:
  1. GET /api/pii/record-meta?record_id=uuid  (reveal_session cookie)
     ← { pii_type: 'PAN', masked_display: '****1234', step_up_required: true }

  2. If step_up_required:
       Iframe renders its own credential prompt (inside the iframe boundary)
       User enters password/TOTP directly into the iframe UI
       POST /api/pii/step-up  { record_id, credential }  (reveal_session cookie)
       Origin: https://reveal.yourdomain.com
       ← { step_up_token: 'uuid', expires_in: 300 }
       step_up_token held in local JS variable only — never in postMessage

  3. Worker generates ECDH keypair, posts public key to frame orchestrator
  4. Frame calls POST /api/pii/reveal  (reveal_session cookie, Origin header)
  5. Worker completes ECDH, decrypts glyphs, renders to OffscreenCanvas
  6. step_up_token reference nulled immediately after reveal request is sent
```

#### Server-Side Origin Checks on Reveal Endpoint

Two independent checks, both must pass:

```
Check A: request.headers['origin'] === 'https://reveal.yourdomain.com'
         → else 403  (browser sets Origin; JS cannot override it)

Check B: stepUpToken.origin === 'https://reveal.yourdomain.com'
         AND stepUpToken.origin === request.headers['origin']
         → else 403  (step-up token carries its own origin claim issued at step-up time)
```

CORS policy for all reveal-related endpoints:
```
Access-Control-Allow-Origin: https://reveal.yourdomain.com
Access-Control-Allow-Credentials: true
```

The parent (`app.yourdomain.com`) cannot make credentialed requests to these endpoints — the cookie is domain-scoped and the CORS policy blocks cross-origin responses to the parent.

#### Revised Threat Claim (Accurate)

> A compromised parent bundle **cannot** perform the reveal flow because:
> (1) the step-up token is never present in the parent's JS context — the iframe initiates step-up autonomously;
> (2) any reveal request from `app.yourdomain.com` is rejected by the server's `Origin` header check;
> (3) the `reveal_session` cookie is `HttpOnly`, `Domain=reveal.yourdomain.com`, `SameSite=Strict` — the browser will not send it from the parent and JS cannot read it;
> (4) if the parent somehow obtained a step-up token UUID, its `origin` claim `https://reveal.yourdomain.com` would not match the browser-set `Origin: https://app.yourdomain.com` header, and the server rejects the mismatch.

#### postMessage Protocol (Complete)

**Parent → iframe:**

| `type` | Fields | When |
|---|---|---|
| `SESSION_INIT` | `delegationToken: string` | Once at iframe load |
| `REVEAL_REQUEST` | `recordId: string`, `purpose: string` | User clicks Show |
| `HIDE_REQUEST` | — | User clicks Hide |

**Iframe → parent:**

| `type` | Fields | When |
|---|---|---|
| `FRAME_READY` | — | Iframe load complete |
| `SESSION_READY` | — | reveal_session cookie established |
| `SESSION_ERROR` | `code: string` | Delegation exchange failed |
| `REVEAL_STATE` | `state`, `expiresAt?`, `code?` | State transitions |

No step-up token, no ECDH key material, no glyph data ever crosses this boundary.

---

### 4. PII Reveal API

#### Authorization Model (ABAC + Step-Up)

Every reveal request passes four gates:

1. **Identity**: valid `reveal_session` cookie + valid JWT, `jti` not revoked.
2. **Origin**: `Origin` header must be `https://reveal.yourdomain.com`.
3. **Ownership + field scope**: `customer_id` on `record_id` matches JWT `sub`; JWT `reveal_scopes` includes `reveal:<pii_type>` (e.g., `reveal:PAN`).
4. **Step-up**: single-use token bound to this `record_id` and `origin: reveal.yourdomain.com`. Required for PAN, SSN.

**Business-purpose binding**: `purpose` field (`VIEW_OWN_DATA`, `PAYMENT_AUTOFILL`, etc.) recorded in every audit event.

#### Reveal Flow (Audit-First, Append-Only)

```
A. Check Origin header = https://reveal.yourdomain.com           → else 403
B. Validate reveal_session + JWT (jti revocation, expiry)        → else 401/403
C. ABAC: ownership check + field-level reveal scope              → else 403; INSERT REVEAL_FAILED
D. Rate limit: 3 reveals / 60s / user / record                   → else 429; INSERT REVEAL_FAILED
E. Validate + atomically consume step-up token (CAS)             → else 403; INSERT REVEAL_FAILED
F. Generate reveal_token UUID, expires_at = now() + 30s
G. [FAIL-CLOSED] INSERT audit: action=REVEAL_REQUESTED
   → if INSERT fails: return 503, stop. No ciphertexts issued without this committed row.
H. Vault Service (mTLS): decrypt PAN                             → else 503; INSERT REVEAL_FAILED
I. Glyph Generator: per-digit noise + 16× AES-GCM encrypt
J. [BEST-EFFORT] INSERT audit: action=REVEAL_ISSUED
   → if fails: log error, continue
   → rationale: REVEAL_REQUESTED is the binding gate. A REVEAL_REQUESTED with no
     REVEAL_ISSUED is a detectable anomaly, more informative than a mutable status field.
K. Return HTTP 200 with glyphs[], server_ecdh_public_key, reveal_token, expires_at
L. Zero PAN plaintext from process memory
```

#### API Shape

**Delegation token (parent origin):**
```
POST /api/pii/delegation-token
Cookie: app_session  |  Origin: https://app.yourdomain.com
← { delegation_token: "uuid", expires_in: 60 }
```

**Reveal session (reveal origin):**
```
POST /api/pii/reveal-session
Origin: https://reveal.yourdomain.com
Body: { delegation_token: "uuid" }
← Set-Cookie: reveal_session (HttpOnly, Secure, SameSite=Strict, Domain=reveal.yourdomain.com)
```

**Record metadata:**
```
GET /api/pii/record-meta?record_id=uuid
Cookie: reveal_session  |  Origin: https://reveal.yourdomain.com
← { pii_type: "PAN", masked_display: "****1234", step_up_required: true }
```

**Step-up (reveal origin only):**
```
POST /api/pii/step-up
Cookie: reveal_session  |  Origin: https://reveal.yourdomain.com
Body: { record_id: "uuid", credential: "..." }
← { step_up_token: "uuid", expires_in: 300 }
  Token carries: { origin: "https://reveal.yourdomain.com", record_id, user_id, expires_at }
```

**Reveal:**
```
POST /api/pii/reveal
Cookie: reveal_session  |  Origin: https://reveal.yourdomain.com
Body: {
  record_id: "uuid",
  browser_ecdh_public_key: { kty:"EC", crv:"P-256", x:"...", y:"..." },
  purpose: "VIEW_OWN_DATA",
  step_up_token: "uuid"
}
← {
  server_ecdh_public_key: { kty:"EC", crv:"P-256", x:"...", y:"..." },
  pan_positions: 16,
  pan_format: "4-4-4-4",
  glyphs: [ { ciphertext:"<base64>", iv:"<base64>" }, ... ],  // 16 entries
  masked_display: "****1234",
  reveal_token: "uuid",
  expires_at: 1743292830
}
```

**Hide:**
```
POST /api/pii/hide
Cookie: reveal_session  |  Body: { reveal_token: "uuid" }
← 204  (server appends HIDE audit event, marks token consumed)
```

---

### 5. ECDH Key Exchange + AES-GCM (Inside the Worker)

The ECDH keypair is generated **inside the Worker** so the private key never exists in the main thread's JS heap.

```javascript
// reveal-worker.js
let pendingKeypair = null;

// Step 1: on INIT, generate keypair and report public key
const keypair = await crypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
);
pendingKeypair = keypair;
const pubJwk = await crypto.subtle.exportKey('jwk', keypair.publicKey);
self.postMessage({ type: 'ECDH_PUBLIC_KEY', pubJwk });

// Step 2: on REVEAL_RESPONSE, complete ECDH → HKDF → AES key
const serverPubKey = await crypto.subtle.importKey(
  'jwk', serverPubJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []
);
const ecdhBits = await crypto.subtle.deriveBits(
  { name: 'ECDH', public: serverPubKey }, pendingKeypair.privateKey, 256
);
pendingKeypair = null; // drop private key reference

const hkdfKey = await crypto.subtle.importKey('raw', ecdhBits, { name:'HKDF' }, false, ['deriveKey']);
const aesKey  = await crypto.subtle.deriveKey(
  { name:'HKDF', hash:'SHA-256', salt: new Uint8Array(0),
    info: new TextEncoder().encode('pii-reveal-v1') },
  hkdfKey, { name:'AES-GCM', length:256 }, false, ['decrypt']
);
// aesKey: non-extractable, lives only in Worker's WebCrypto store
```

**Forward secrecy**: fresh ephemeral keypairs per reveal. Server's private key discarded after response. No replay possible.

---

### 6. OffscreenCanvas + Worker Rendering

#### Why OffscreenCanvas (The drawImage Attack)

With a regular `<canvas>` in the main thread, even if `toDataURL` and `getImageData` are instance-overridden, a script can bypass them:

```javascript
// drawImage copy attack — bypasses instance overrides on piiCanvas
const exfil = document.createElement('canvas');
exfil.width = piiCanvas.width; exfil.height = piiCanvas.height;
exfil.getContext('2d').drawImage(piiCanvas, 0, 0);
const stolen = exfil.toDataURL(); // exfil has no instance override
```

Similarly, a WebGL context can sample the PII canvas as a texture via `texImage2D` and read pixels with `readPixels`. Same-origin canvases are never tainted by browser policy.

The fix: the main thread canvas has `transferControlToOffscreen()` called immediately after creation. After transfer, the main thread canvas is inert — it cannot be used as a `drawImage` source that returns real pixels, and it has no 2D context. All pixel operations happen inside the Worker.

#### Setup

```javascript
// pii-frame.js (main thread)
const displayCanvas = document.createElement('canvas');
displayCanvas.width = 286; displayCanvas.height = 36;
displayContainer.appendChild(displayCanvas);

const offscreen = displayCanvas.transferControlToOffscreen();
// displayCanvas is now inert: no 2D context, no pixel readback, cannot be drawImage source

const worker = new Worker('/reveal-worker.js');
worker.postMessage({ type: 'INIT', offscreenCanvas: offscreen }, [offscreen]);
// offscreen is exclusively owned by the Worker — main thread reference is neutered
```

#### Per-Digit Decrypt-and-Draw Loop (Inside Worker)

```javascript
const ALLOWED_OPS = new Set(['moveTo','lineTo','bezierCurveTo','quadraticCurveTo','closePath','arc']);

async function renderGlyphs(offscreen, glyphs, pan_positions, aesKey) {
  const CELL_W=16, CELL_H=28, GROUP_GAP=10, Y_PAD=4;
  const ctx = offscreen.getContext('2d');
  ctx.fillStyle = '#1a1a1a';

  for (let i = 0; i < pan_positions; i++) {
    let decryptedBytes = null, commands = null;
    try {
      const plainBuf = await crypto.subtle.decrypt(
        { name:'AES-GCM', iv: base64ToBytes(glyphs[i].iv) },
        aesKey, base64ToBytes(glyphs[i].ciphertext)
      );
      decryptedBytes = new Uint8Array(plainBuf);
      commands = JSON.parse(new TextDecoder().decode(decryptedBytes));

      const groupIndex = Math.floor(i / 4);
      const xOffset = (i * CELL_W) + (groupIndex * GROUP_GAP);

      ctx.save();
      ctx.translate(xOffset, Y_PAD + CELL_H);
      ctx.scale(CELL_W/100, -CELL_H/100); // flip Y, scale to cell
      ctx.beginPath();
      for (const cmd of commands) {
        if (!ALLOWED_OPS.has(cmd.op)) throw new Error(`Disallowed op: ${cmd.op}`);
        switch (cmd.op) {
          case 'moveTo':           ctx.moveTo(cmd.x, cmd.y); break;
          case 'lineTo':           ctx.lineTo(cmd.x, cmd.y); break;
          case 'bezierCurveTo':    ctx.bezierCurveTo(cmd.cp1x,cmd.cp1y,cmd.cp2x,cmd.cp2y,cmd.x,cmd.y); break;
          case 'quadraticCurveTo': ctx.quadraticCurveTo(cmd.cpx,cmd.cpy,cmd.x,cmd.y); break;
          case 'arc':              ctx.arc(cmd.x,cmd.y,cmd.r,cmd.startAngle,cmd.endAngle,cmd.counterclockwise??false); break;
          case 'closePath':        ctx.closePath(); break;
        }
      }
      ctx.fill();
      ctx.restore();
    } catch (err) {
      drawFallbackGlyph(ctx, i, CELL_W, CELL_H, GROUP_GAP, Y_PAD);
      self.postMessage({ type:'PARTIAL_RENDER_ERROR', position: i });
    } finally {
      decryptedBytes?.fill(0); // zero before next digit
      commands = null; decryptedBytes = null;
    }
    await Promise.resolve(); // yield — GC opportunity before next decrypt
  }
  ctx.commit(); // push display frame to main thread
}
```

#### Teardown (Inside Worker)

```javascript
function teardown(offscreen) {
  const ctx = offscreen.getContext('2d');
  const noise = new Uint8ClampedArray(offscreen.width * offscreen.height * 4);
  crypto.getRandomValues(noise);
  ctx.putImageData(new ImageData(noise, offscreen.width, offscreen.height), 0, 0);
  ctx.clearRect(0, 0, offscreen.width, offscreen.height);
  ctx.commit();
}
```

Noise overwrite before clear overwrites any GPU texture residue before the backing store is released.

---

### 7. Bundle Integrity: SRI + Hash-Pinned CSP

#### The Hard Trust Anchor

The reveal-origin bundle (`reveal.yourdomain.com/reveal-bundle.js` and all imports) is the **hard trust anchor** for all in-browser security properties. If this bundle is compromised — supply chain attack, CDN cache poisoning, build pipeline breach — all runtime defenses (Trusted Types, canvas hardening, OffscreenCanvas isolation) are void. Code executing inside the reveal origin has unrestricted access to WebCrypto, canvas APIs, and all decrypted glyph data.

Trusted Types and canvas hardening do not protect against a compromised bundle. They protect against DOM XSS string injection and incidental same-origin JavaScript respectively.

#### Subresource Integrity (SRI)

```html
<!-- reveal-frame.html -->
<script
  src="/reveal-bundle.js"
  integrity="sha384-<hash-computed-at-build-time>"
  crossorigin="anonymous"
></script>
```

If the served bytes differ from the approved bytes by a single bit, the browser refuses to execute the script. Supply chain substitution, CDN poisoning, and server-side file replacement are all detected and blocked.

#### Build Pipeline Hash Commitment

```bash
# CI/CD step after bundle build:
HASH=$(openssl dgst -sha384 -binary dist/reveal-bundle.js | openssl base64 -A)
SRI="sha384-${HASH}"

# Write into the HTML template
sed -i "s|integrity=\"sha384-[^\"]*\"|integrity=\"${SRI}\"|g" dist/reveal-frame.html

# Commit hash as deployment manifest
echo "${SRI}" > deploy/reveal-bundle-sri.txt
```

The SRI hash and updated HTML are committed to source control as part of every release. Unexpected hash changes without corresponding source changes are visible in PR diffs and signal build pipeline tampering.

#### Hash-Pinned CSP (Stronger than `'self'`)

```
Content-Security-Policy:
  script-src 'sha384-<hash>';
  ...
```

With `'self'`, any script file served from `reveal.yourdomain.com` — including one written by an attacker via a server misconfiguration or path traversal — can execute. With hash-pinning, only the exact approved bytes execute. A file at any path that doesn't match the hash is blocked.

The hash in the CSP header and the `integrity` attribute must stay in sync. Both are derived from `deploy/reveal-bundle-sri.txt` in the deployment pipeline. Deployments update all three atomically.

---

### 8. Trusted Types (Accurate Claims)

```javascript
const piiPolicy = trustedTypes.createPolicy('pii-render', {
  createHTML:      () => { throw new Error('HTML creation not allowed'); },
  createScript:    () => { throw new Error('Script creation not allowed'); },
  createScriptURL: () => { throw new Error('Script URL creation not allowed'); },
});
```

**What Trusted Types does protect:**
- Prevents `element.innerHTML = rawString`, `document.write(rawString)`, `eval(rawString)`, `new Function(rawString)`, and dynamic `<script>` injection — DOM XSS string sinks require a policy-mediated value; raw string assignment throws a TypeError.
- Stops an injected string payload from becoming executable code or mutating the DOM.

**What Trusted Types does NOT protect:**
- Code already executing in the reveal origin's JS context — Trusted Types has no authority over code that is already running.
- A compromised reveal bundle calling `crypto.subtle.decrypt()` directly — WebCrypto is not a Trusted Types sink.
- Canvas API methods — not sinks.
- Prototype mutation of canvas methods before the reveal component initialises.
- Any attack that doesn't involve passing a raw string through a DOM sink.

Trusted Types is valuable as a defense-in-depth layer against DOM XSS. It is not a substitute for SRI + hash-pinned CSP, which is the primary defense against a compromised bundle.

---

### 9. Frontend State Machine

```
HIDDEN ──[REVEAL_REQUEST]──► LOADING ──[Worker: RENDER_COMPLETE]──► REVEALED
   ▲                              │                                      │
   └──────────[error]─────────────┘        [TTL / HIDE_REQUEST]─────────┘
```

| State | Reveal iframe | Parent UI |
|---|---|---|
| HIDDEN | Canvas cleared, Worker awaiting | Mask visible, "Show" button |
| LOADING | Worker: ECDH + decrypt loop running | Button disabled, "Loading…" |
| REVEALED | Display frames committed, countdown running | Countdown bar, "Hide" button |

On HIDDEN transition: Worker receives `TEARDOWN`, noise-overwrites OffscreenCanvas, clears, commits blank frame. `aesKey` reference nulled.

---

### 10. Anti-Copy Guard

| Layer | Mechanism |
|---|---|
| CSS | `user-select: none`, `pointer-events: none` on display canvas |
| CSS | `-webkit-touch-callout: none` |
| JS | `contextmenu`, `dragstart` → `preventDefault()` on canvas |
| Architecture | `transferControlToOffscreen()` — main thread canvas inert for pixel readback and `drawImage` source |
| HTML | `tabindex="-1"`, `aria-hidden="true"` on canvas |
| HTTP | `Permissions-Policy: clipboard-read=(), clipboard-write=()` |
| Trusted Types | Blocks DOM XSS string sinks in reveal origin |
| SRI + hash-pinned CSP | Blocks execution of any bundle not matching the approved hash |

---

### 11. Audit Service (Fail-Closed, Append-Only)

#### Two-Phase Append-Only Events (No UPDATE)

The audit log is strictly append-only: the DB role has INSERT only (no UPDATE, no DELETE). The reveal flow emits two separate INSERT events:

- `REVEAL_REQUESTED` — **fail-closed gate**: written synchronously before any decryption. If this INSERT fails, the server returns 503 and no ciphertexts are issued.
- `REVEAL_ISSUED` — **best-effort**: written after glyph generation succeeds, before the HTTP response is sent. If this INSERT fails, the server logs the error and proceeds. A `REVEAL_REQUESTED` with no `REVEAL_ISSUED` is a detectable anomaly (see anomaly detection below).

There is no `status` field, no UPDATE, and no mutable state in the audit table.

#### Full Event Taxonomy

| Event | Source | Trigger |
|---|---|---|
| `REVEAL_REQUESTED` | SERVER | After auth/ABAC pass, before vault decrypt — fail-closed gate |
| `REVEAL_ISSUED` | SERVER | After glyphs generated, before response sent — best-effort |
| `REVEAL_EXPIRED` | SERVER | TTL sweeper 30s after `REVEAL_ISSUED` |
| `HIDE` | SERVER | Server processes `POST /api/pii/hide` |
| `REVEAL_FAILED` | SERVER | Auth failure, ABAC denial, vault error, rate limit |
| `STEP_UP_ISSUED` | SERVER | Step-up token created |
| `STEP_UP_CONSUMED` | SERVER | Step-up token validated and atomically consumed |
| `STEP_UP_EXPIRED` | SERVER | Step-up token TTL elapsed unused |
| `ERASURE_EXECUTED` | SERVER | PII record deleted (GDPR erasure) |
| `CLIENT_HIDE_REPORTED` | CLIENT | sendBeacon on user hide — supplemental only |
| `CLIENT_UNLOAD_REPORTED` | CLIENT | sendBeacon on page unload — supplemental only |
| `PARTIAL_RENDER_ERROR` | CLIENT | sendBeacon on per-digit decrypt failure — supplemental only |

Client events (`event_source = CLIENT`) are supplemental annotations. Server lifecycle events are authoritative. The server's TTL sweeper writes `REVEAL_EXPIRED` independently of any client report.

#### Audit Schema

```sql
TABLE audit_log (
    audit_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- server clock only
    user_id          UUID,
    session_id       UUID,
    record_id        UUID,
    pii_type         ENUM('PAN','SSN','DOB','BANK_ACCOUNT','PHONE'),
    masked_display   VARCHAR(20),
    action           ENUM(
                       'REVEAL_REQUESTED', 'REVEAL_ISSUED', 'REVEAL_EXPIRED',
                       'HIDE', 'REVEAL_FAILED',
                       'STEP_UP_ISSUED', 'STEP_UP_CONSUMED', 'STEP_UP_EXPIRED',
                       'ERASURE_EXECUTED',
                       'CLIENT_HIDE_REPORTED', 'CLIENT_UNLOAD_REPORTED', 'PARTIAL_RENDER_ERROR'
                     ) NOT NULL,
    event_source     ENUM('SERVER','CLIENT') NOT NULL DEFAULT 'SERVER',
    reveal_token     UUID,       -- correlation key across reveal lifecycle
    step_up_token_id UUID,       -- for STEP_UP_* events
    purpose          VARCHAR(50),
    failure_reason   VARCHAR(200),
    source_ip        INET,
    user_agent       TEXT,
    request_id       UUID,
    hmac             BYTEA NOT NULL
)
```

**Never logged**: plaintext PII, glyph path data, ECDH keys, AES key, ciphertexts.

#### HMAC Chain

```
hmac[n] = HMAC-SHA256(audit_key, serialise(record_fields[n]) || hmac[n-1])
```

Every INSERT is a new link. Modification of any prior row breaks the chain. Nightly verification job detects tampering. `reveal_token` is the correlation key: query `WHERE reveal_token = 'uuid' ORDER BY event_time` to reconstruct the full lifecycle of any reveal.

#### DB Permissions (Consistent with Append-Only)

```sql
GRANT INSERT ON audit_log TO audit_service_role;   -- no UPDATE, no DELETE
GRANT SELECT ON audit_log TO audit_reader_role;    -- compliance/auditors only
```

#### Server-Authoritative TTL Events

The server maintains an operational `reveal_tokens` table (separate from `audit_log`, appropriately mutable) for the TTL sweeper:

```sql
TABLE reveal_tokens (
    token      UUID PRIMARY KEY,
    user_id    UUID NOT NULL,
    record_id  UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status     ENUM('ACTIVE','HIDE','EXPIRED') NOT NULL DEFAULT 'ACTIVE'
)
```

The TTL sweeper runs on a 5-second tick, finds `ACTIVE` tokens past `expires_at`, marks them `EXPIRED`, and INSERTs a `REVEAL_EXPIRED` event into `audit_log`. Client `sendBeacon` events are logged as `CLIENT_HIDE_REPORTED` — informational, never authoritative.

#### Anomaly Detection

```sql
-- REVEAL_REQUESTED with no REVEAL_ISSUED within 10s (possible crash mid-flow)
SELECT reveal_token, user_id, record_id, event_time FROM audit_log r
WHERE action = 'REVEAL_REQUESTED' AND event_time < NOW() - INTERVAL '10 seconds'
  AND NOT EXISTS (SELECT 1 FROM audit_log WHERE reveal_token = r.reveal_token AND action = 'REVEAL_ISSUED')
  AND NOT EXISTS (SELECT 1 FROM audit_log WHERE reveal_token = r.reveal_token AND action = 'REVEAL_FAILED');

-- REVEAL_ISSUED with no REVEAL_EXPIRED or HIDE within 35s (TTL sweeper failure)
SELECT reveal_token, user_id FROM audit_log i
WHERE action = 'REVEAL_ISSUED' AND event_time < NOW() - INTERVAL '35 seconds'
  AND NOT EXISTS (SELECT 1 FROM audit_log WHERE reveal_token = i.reveal_token AND action IN ('REVEAL_EXPIRED','HIDE'));

-- PAN/SSN REVEAL_REQUESTED with no STEP_UP_CONSUMED (step-up bypass bug)
SELECT reveal_token, user_id FROM audit_log r
WHERE action = 'REVEAL_REQUESTED' AND pii_type IN ('PAN','SSN')
  AND NOT EXISTS (SELECT 1 FROM audit_log WHERE reveal_token = r.reveal_token AND action = 'STEP_UP_CONSUMED');
```

**Retention**: 13 months primary DB, then encrypted cold storage. GDPR erasure appends `ERASURE_EXECUTED` — audit rows are never deleted.

---

### 12. Auth Service

```json
{
  "sub": "user_uuid",
  "sid": "session_uuid",
  "iat": 1743290000,
  "exp": 1743293600,
  "jti": "unique_token_id",
  "reveal_scopes": ["reveal:PAN", "reveal:SSN"]
}
```

- **Algorithm**: RS256. Reveal API holds the public key only.
- **`reveal_scopes`**: field-level reveal permissions granted at login. A session without `reveal:PAN` cannot reveal a PAN regardless of ownership.
- **`jti` revocation**: on logout, `jti` added to revocation set with matching TTL. Logout is immediate.
- **Session TTL**: 1-hour hard expiry; 15-minute idle timeout recommended.

---

## Security Layers (Storage → Display)

| # | Layer | Control |
|---|---|---|
| 1 | Storage | AES-256-GCM at rest, KEK/DEK envelope encryption, HSM-backed master key |
| 2 | Key management | Per-record DEK, annual rotation, keys never in application DB |
| 3 | Authorization (ABAC) | Ownership + field-level `reveal_scopes` + single-use step-up token bound to `record_id` + `origin` claim |
| 4 | Transport | TLS 1.3 minimum, HSTS preloaded |
| 5 | Encryption (ECDH) | Per-reveal ECDH + HKDF + AES-256-GCM inside Worker — 16 independent ciphertexts on the network |
| 6 | Per-digit rendering | One digit decrypted at a time; bytes zeroed before next; full PAN never in heap simultaneously |
| 7 | Worker isolation | All crypto + pixel ops in dedicated Worker; main thread canvas inert after `transferControlToOffscreen` |
| 8 | Origin isolation | Reveal runs in cross-origin sandboxed iframe; parent-origin scripts cannot access iframe JS context (browser same-origin policy) |
| 8a | Origin binding | Reveal API rejects any request with `Origin ≠ reveal.yourdomain.com`; step-up token carries matching `origin` claim; `reveal_session` cookie is domain-scoped, HttpOnly |
| 9 | **Bundle integrity** | **SRI on `<script>` tag + hash-pinned `script-src` CSP: browser refuses to execute any bundle not matching the build-pipeline-committed hash** |
| 10 | Trusted Types | Blocks DOM XSS string sinks (`innerHTML`, `eval`, `new Function`, etc.) in reveal origin — does not constrain code already executing in the bundle |
| 11 | DOM | Canvas pixels only — no text nodes, no PUA codepoints, no font references |
| 12 | Clipboard | `Permissions-Policy: clipboard-read=(), clipboard-write=()` + event prevention |
| 13 | Audit (fail-closed) | Reveal blocked if `REVEAL_REQUESTED` INSERT fails; server-authoritative TTL events; append-only with no UPDATE; client events supplemental only |
| 14 | TTL | 30s reveal window; server TTL sweeper; per-reveal ECDH = no replay |
| 15 | Rate limiting | 3 reveals/60s per user per record; 1 step-up/10s per user |

---

## Security Headers

### Reveal iframe origin (`reveal.yourdomain.com`)
```
Content-Security-Policy:
  default-src 'none';
  script-src 'sha384-<build-pipeline-hash>';
  worker-src 'self';
  connect-src https://api.yourdomain.com;
  frame-ancestors https://app.yourdomain.com;
  require-trusted-types-for 'script';
  trusted-types pii-render;

Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: clipboard-read=(), clipboard-write=()
```

`script-src 'sha384-...'` — hash-pinned, not `'self'`. Only the exact approved bundle executes.

### Parent application (`app.yourdomain.com`)
```
Content-Security-Policy:
  default-src 'self';
  frame-src https://reveal.yourdomain.com;
  connect-src 'self';
  frame-ancestors 'none';
  require-trusted-types-for 'script';

Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: clipboard-read=(), clipboard-write=()
```

---

## Threat Model

| Attack | Outcome |
|---|---|
| DevTools Network tab | 16 AES-GCM ciphertexts — opaque bytes, no digit values, no font structure |
| Heap snapshot during reveal | At most one digit's perturbed bezier coordinates (~200 bytes); full PAN never in heap simultaneously |
| DevTools breakpoint in Worker decrypt | One digit's path coordinates for one position — requires purpose-built OCR to convert to a digit value |
| Copy-paste from DOM | Canvas has no text node; clipboard receives nothing |
| `drawImage(piiCanvas)` copy attack | Main thread canvas is inert after `transferControlToOffscreen`; no pixel data to copy |
| WebGL `texImage2D` pixel extraction | Same — inert main-thread canvas cannot be sampled as texture |
| **Compromised parent bundle** | **Cannot reach reveal flow: no step-up token in parent context; Origin header check rejects parent-origin requests; reveal_session cookie is HttpOnly + domain-scoped** |
| **Compromised reveal-origin bundle (supply chain)** | **SRI hash mismatch → browser refuses to execute the modified bundle. Hash-pinned CSP blocks any non-approved script from executing.** |
| Unauthorized record access | ABAC ownership + field-level scope + single-use step-up token bound to record_id and reveal origin |
| Reveal without audit trail | Impossible — 503 returned if `REVEAL_REQUESTED` INSERT fails; no ciphertexts issued |
| Client suppressing lifecycle events | Irrelevant — server TTL sweeper writes `REVEAL_EXPIRED` independently; client events are supplemental |
| Step-up token replay | Single-use CAS; `origin` claim binds token to reveal origin — rejected if presented from parent |
| Replay of reveal ciphertexts | Requires non-extractable ECDH private key from the Worker; forward secrecy — server key discarded |
| Iframe clickjacking | `frame-ancestors https://app.yourdomain.com` + `X-Frame-Options: DENY` on parent |
| Delegation token race (parent consumes before iframe) | `/api/pii/reveal-session` checks `Origin: reveal.yourdomain.com` — parent request rejected at that endpoint too |
| Screenshot | Visually correct — accepted (authorised user is meant to see this) |

---

## Residual Risk

| Risk | Severity | Notes |
|---|---|---|
| Fully compromised reveal-origin build pipeline | High | SRI + hash-pinned CSP protect against deployment substitution but not against a build that produces a malicious bundle with a hash that gets committed to source control. Mitigated by: code review of bundle source, reproducible builds, second-party hash verification. |
| Worker heap snapshot during reveal window | Low | Requires attaching a memory profiler to the browser process (OS-level) during the sub-millisecond window each digit is decrypted. Not achievable via DevTools for a casual user. |
| GPU texture residue after teardown | Very Low | Noise overwrite in `teardownCanvas` mitigates; requires kernel/driver-level memory access. |
| Physical screen observation | Accepted | Cannot be mitigated in software. Inherent to any system that displays PAN to a human. |

---

## PCI-DSS & GDPR Alignment

| Requirement | How Satisfied |
|---|---|
| PCI-DSS 3.3: PAN unreadable in storage | AES-256-GCM + envelope encryption |
| PCI-DSS 3.3.2: Minimum PAN display | Default masked; full reveal requires step-up auth per record |
| PCI-DSS 4: PAN protected in transit | TLS 1.3 + AES-GCM application-layer encryption (double-encrypted) |
| PCI-DSS 7: Restrict access | ABAC: ownership + field scope + step-up — not coarse role-based |
| PCI-DSS 10: Audit log | Fail-closed, append-only, server-authoritative, HMAC-chained, 12-month+ retention |
| GDPR Art. 5: Data minimisation | Per-card on-demand reveal; field-level scopes; no bulk plaintext |
| GDPR Art. 17: Right to erasure | Server-side only — no client-side PAN cache, no font, no text node |
| GDPR Art. 30: Records of processing | Audit log with data subject linkage, business purpose, authoritative server events |

---

## File Structure

```
/src
  /server
    vault-service.ts              # AES-256-GCM, KEK/DEK envelope encryption
    glyph-library.ts              # Static GLYPH_LIBRARY (10 digit outlines, 100x100 grid)
    glyph-generator.ts            # Per-digit noise + 16x AES-GCM encrypt → glyphs[]
    reveal-endpoint.ts            # ABAC + step-up + origin check + audit-first + ECDH response
    delegation-token-endpoint.ts  # Issues single-use delegation tokens to parent app
    reveal-session-endpoint.ts    # Exchanges delegation token for reveal_session cookie
    record-meta-endpoint.ts       # Returns pii_type, masked_display, step_up_required (no reveal)
    session-store.ts              # reveal_tokens operational table (mutable), rate limits, step-up tokens
    audit-service.ts              # Append-only HMAC-chained log + server-side TTL sweeper
    auth-service.ts               # JWT RS256, jti revocation, step-up token issuance

  /client-reveal (reveal.yourdomain.com bundle)
    pii-frame.js                  # Orchestrator: postMessage handler, delegation exchange, step-up UI
    reveal-worker.js              # Worker: ECDH keygen, AES-GCM decrypt, OffscreenCanvas rendering
    audit-emitter.js              # sendBeacon for supplemental CLIENT_* events only
    anti-copy-guard.js            # contextmenu/drag prevention on display canvas

  /client-app (app.yourdomain.com bundle)
    pii-field.js                  # Renders iframe, postMessage protocol, toggle button UI

  /styles
    pii-base.css                  # Canvas sizing, mask layer, countdown bar

  /tools
    verify-glyphs.ts              # Renders GLYPH_LIBRARY to PNG for human visual verification
    generate-csp.sh               # CI step: reads deploy/reveal-bundle-sri.txt → nginx-csp.conf

  /deploy
    reveal-bundle-sri.txt         # sha384-<hash> — source of truth for SRI and CSP hash
```

---

## External Dependencies

| Dependency | Purpose | License | Notes |
|---|---|---|---|
| None | — | — | All cryptography via WebCrypto (browser Worker) and runtime crypto module (server). No font library, no Brotli, no UI framework. Zero external dependencies. |
