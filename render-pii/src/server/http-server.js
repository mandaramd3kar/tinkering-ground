const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { webcrypto } = crypto;
const { APP_ORIGIN, REVEAL_ORIGIN, APP_PORT, REVEAL_PORT } = require('./config');
const {
  state,
  unsealPan,
  issueAppSession,
  getAppSession,
  issueDelegationToken,
  consumeDelegationToken,
  issueRevealSession,
  getRevealSession,
  issueStepUpToken,
  consumeStepUpToken,
  issueRevealToken,
  allowReveal,
  hideRevealToken,
  sweepTokens,
} = require('./state');

const ROOT = path.resolve(__dirname, '..', '..');
const TEXT_ENCODER = new TextEncoder();
const { subtle } = webcrypto;

const DIGIT_BITMAPS = {
  '0': ['00111100', '01100110', '11000011', '11000011', '11000011', '11000011', '11000011', '11000011', '11000011', '01100110', '00111100'],
  '1': ['00011000', '00111000', '01111000', '00011000', '00011000', '00011000', '00011000', '00011000', '00011000', '01111110', '01111110'],
  '2': ['00111100', '01100110', '11000011', '00000011', '00000110', '00001100', '00011000', '00110000', '01100000', '11111111', '11111111'],
  '3': ['00111100', '01100110', '11000011', '00000011', '00001110', '00001110', '00000011', '00000011', '11000011', '01100110', '00111100'],
  '4': ['00000110', '00001110', '00011110', '00110110', '01100110', '11000110', '11111111', '11111111', '00000110', '00000110', '00000110'],
  '5': ['11111111', '11111111', '11000000', '11000000', '11111100', '11111110', '00000011', '00000011', '11000011', '01100110', '00111100'],
  '6': ['00111100', '01100110', '11000011', '11000000', '11111100', '11111110', '11000011', '11000011', '11000011', '01100110', '00111100'],
  '7': ['11111111', '11111111', '00000011', '00000110', '00001100', '00011000', '00110000', '00110000', '00110000', '00110000', '00110000'],
  '8': ['00111100', '01100110', '11000011', '11000011', '01100110', '00111100', '01100110', '11000011', '11000011', '01100110', '00111100'],
  '9': ['00111100', '01100110', '11000011', '11000011', '11000011', '01111111', '00111111', '00000011', '11000011', '01100110', '00111100'],
  ' ': ['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000'],
};

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function computeAuditHmac(row, prev) {
  return crypto.createHmac('sha256', state.auditKey).update(stableStringify(row)).update(prev).digest('hex');
}

function appendAudit(event) {
  const row = {
    audit_id: crypto.randomUUID(),
    event_time: new Date().toISOString(),
    event_source: event.event_source || event.source || 'SERVER',
    action: event.action || event.event_name || 'UNKNOWN',
    user_id: event.user_id || null,
    session_id: event.session_id || null,
    record_id: event.record_id || null,
    pii_type: event.pii_type || null,
    masked_display: event.masked_display || null,
    reveal_token: event.reveal_token || null,
    step_up_token_id: event.step_up_token_id || null,
    purpose: event.purpose || null,
    failure_reason: event.failure_reason || null,
    source_ip: event.source_ip || null,
    user_agent: event.user_agent || null,
    request_id: event.request_id || null,
  };
  const prev = state.auditRows.length ? state.auditRows[state.auditRows.length - 1].hmac : '0'.repeat(64);
  row.hmac = computeAuditHmac(row, prev);
  state.auditRows.push(row);
  return row;
}

function verifyAuditChain() {
  let prev = '0'.repeat(64);
  for (const row of state.auditRows) {
    const { hmac, ...rest } = row;
    if (computeAuditHmac(rest, prev) !== hmac) return false;
    prev = hmac;
  }
  return true;
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (!key) continue;
    cookies[key] = decodeURIComponent(rest.join('=') || '');
  }
  return cookies;
}

function cookie(name, value, options = {}) {
  const bits = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge) bits.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.httpOnly) bits.push('HttpOnly');
  if (options.sameSite) bits.push(`SameSite=${options.sameSite}`);
  if (options.path) bits.push(`Path=${options.path}`);
  return bits.join('; ');
}

function json(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

function text(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, { 'content-type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function allowOrigin(req, expectedOrigin) {
  return !req.headers.origin || new URL(req.headers.origin).origin === expectedOrigin;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
  }[ext] || 'application/octet-stream';
}

function resolveStaticPath(requestPath) {
  const normalized = path.normalize(decodeURIComponent(requestPath)).replace(/^([.][.][/\\])+/, '');
  const absolute = path.resolve(ROOT, `.${path.sep}${normalized}`);
  if (!absolute.startsWith(ROOT)) return null;
  return absolute;
}

function serveFile(res, filePath) {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'content-type': contentType(filePath), 'cache-control': 'no-store' });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

function maybeSetAppSession(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  const existing = cookies.app_session ? getAppSession(cookies.app_session) : null;
  if (existing) return existing;
  const session = issueAppSession();
  res.setHeader('set-cookie', cookie('app_session', session.token, { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 60 * 60 }));
  return session;
}

function revealOriginOk(req) {
  return allowOrigin(req, REVEAL_ORIGIN);
}

function appOriginOk(req) {
  return allowOrigin(req, APP_ORIGIN);
}

function getRevealSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies.reveal_session ? getRevealSession(cookies.reveal_session) : null;
}

function fillRect(pixels, width, height, x, y, rectW, rectH, color) {
  const [r, g, b, a] = color;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + rectW));
  const y1 = Math.min(height, Math.ceil(y + rectH));
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const idx = ((py * width) + px) * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = a;
    }
  }
}

function renderPanRaster(pan) {
  const characters = String(pan || '').split('');
  const glyphWidth = 8;
  const glyphHeight = 11;
  const glyphScale = 2;
  const charGap = 3;
  const spaceAdvance = 8;
  const padX = 14;
  const padY = 10;
  const background = [248, 250, 252, 255];
  const ink = [17, 24, 39, 255];

  let cursorX = padX;
  const placements = [];
  for (const character of characters) {
    const bitmap = DIGIT_BITMAPS[character] || DIGIT_BITMAPS['0'];
    placements.push({ bitmap, x: cursorX, character });
    cursorX += character === ' ' ? spaceAdvance : ((glyphWidth * glyphScale) + charGap);
  }

  const width = Math.max((padX * 2) + 1, cursorX + padX - charGap);
  const height = (padY * 2) + (glyphHeight * glyphScale);
  const pixels = new Uint8Array(width * height * 4);

  for (let idx = 0; idx < pixels.length; idx += 4) {
    pixels[idx] = background[0];
    pixels[idx + 1] = background[1];
    pixels[idx + 2] = background[2];
    pixels[idx + 3] = background[3];
  }

  for (const entry of placements) {
    if (entry.character === ' ') continue;
    entry.bitmap.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] === '1') {
          fillRect(
            pixels,
            width,
            height,
            entry.x + (x * glyphScale),
            padY + (y * glyphScale),
            glyphScale,
            glyphScale,
            ink
          );
        }
      }
    });
  }

  return { width, height, pixels };
}

async function encryptRasterBundle(pan, clientPubJwk) {
  const keyPair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPubJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  const clientPubKey = await subtle.importKey('jwk', clientPubJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await subtle.deriveBits({ name: 'ECDH', public: clientPubKey }, keyPair.privateKey, 256);
  const hkdfKey = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  const aesKey = await subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: TEXT_ENCODER.encode('pii-reveal-v2-raster') },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const image = renderPanRaster(pan);
  const iv = crypto.randomBytes(12);
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, image.pixels);
  image.pixels.fill(0);

  return {
    serverPubJwk,
    image: {
      ciphertext: Buffer.from(ciphertext).toString('base64'),
      iv: iv.toString('base64'),
      width: image.width,
      height: image.height,
      pixel_format: 'rgba',
    },
  };
}

async function handleReveal(req, res, session, body, requestMeta) {
  const record = state.records.get(body.record_id);
  if (!record || record.customerId !== session.userId) {
    appendAudit({ action: 'REVEAL_FAILED', user_id: session.userId, session_id: session.sessionId, record_id: body.record_id, failure_reason: 'record not found or unauthorized', ...requestMeta });
    return json(res, 403, { error: 'unauthorized' });
  }

  if (!session.scopes.includes(`reveal:${record.piiType}`)) {
    appendAudit({ action: 'REVEAL_FAILED', user_id: session.userId, session_id: session.sessionId, record_id: record.id, pii_type: record.piiType, failure_reason: 'missing reveal scope', ...requestMeta });
    return json(res, 403, { error: 'missing scope' });
  }

  if (!allowReveal(session.userId, record.id)) {
    appendAudit({ action: 'REVEAL_FAILED', user_id: session.userId, session_id: session.sessionId, record_id: record.id, pii_type: record.piiType, failure_reason: 'rate limit exceeded', ...requestMeta });
    return json(res, 429, { error: 'rate limit exceeded' });
  }

  const stepUp = consumeStepUpToken(body.step_up_token, record.id, REVEAL_ORIGIN);
  if (!stepUp) {
    appendAudit({ action: 'REVEAL_FAILED', user_id: session.userId, session_id: session.sessionId, record_id: record.id, pii_type: record.piiType, failure_reason: 'invalid step-up token', ...requestMeta });
    return json(res, 403, { error: 'invalid step-up token' });
  }

  const pan = unsealPan(record);
  appendAudit({ action: 'STEP_UP_CONSUMED', user_id: session.userId, session_id: session.sessionId, record_id: record.id, pii_type: record.piiType, step_up_token_id: stepUp.token, ...requestMeta });
  const revealToken = issueRevealToken({ revealSession: session, recordId: record.id });
  appendAudit({ action: 'REVEAL_REQUESTED', user_id: session.userId, session_id: session.sessionId, record_id: record.id, pii_type: record.piiType, masked_display: record.maskedDisplay, reveal_token: revealToken.token, step_up_token_id: stepUp.token, purpose: body.purpose || 'VIEW_OWN_DATA', ...requestMeta });
  const encrypted = await encryptRasterBundle(pan, body.browser_ecdh_public_key);
  appendAudit({ action: 'REVEAL_ISSUED', user_id: session.userId, session_id: session.sessionId, record_id: record.id, pii_type: record.piiType, masked_display: record.maskedDisplay, reveal_token: revealToken.token, step_up_token_id: stepUp.token, purpose: body.purpose || 'VIEW_OWN_DATA', ...requestMeta });

  return json(res, 200, {
    server_ecdh_public_key: encrypted.serverPubJwk,
    image: encrypted.image,
    reveal_token: revealToken.token,
    expires_at: Math.floor(revealToken.expiresAt / 1000),
    record_id: record.id,
  });
}

async function route(req, res, role) {
  const requestMeta = {
    source_ip: req.socket.remoteAddress || null,
    user_agent: req.headers['user-agent'] || null,
    request_id: req.headers['x-request-id'] || crypto.randomUUID(),
  };
  const base = role === 'app' ? APP_ORIGIN : REVEAL_ORIGIN;
  const url = new URL(req.url, base);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': REVEAL_ORIGIN,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-credentials': 'true',
    });
    return res.end();
  }

  if (url.pathname === '/healthz') {
    return json(res, 200, { ok: true, audit_rows: state.auditRows.length, audit_chain_valid: verifyAuditChain() });
  }

  if (role === 'app' && req.method === 'GET' && (url.pathname === '/' || url.pathname === '/app.html' || url.pathname === '/index.html')) {
    maybeSetAppSession(req, res);
    return serveFile(res, path.resolve(ROOT, 'app.html')) || text(res, 404, 'Missing app.html');
  }

  if (role === 'reveal' && req.method === 'GET' && url.pathname === '/') {
    return redirect(res, '/src/client-reveal/reveal-frame.html');
  }

  const staticPath = resolveStaticPath(url.pathname);
  if (req.method === 'GET' && staticPath && fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    return serveFile(res, staticPath) || text(res, 404, 'Not found');
  }

  if (req.method === 'POST' && url.pathname === '/api/pii/delegation-token') {
    if (role !== 'app') return text(res, 404, 'Not found');
    if (!appOriginOk(req)) return text(res, 403, 'Forbidden');
    const cookies = parseCookies(req.headers.cookie || '');
    const session = cookies.app_session ? getAppSession(cookies.app_session) : null;
    if (!session) return json(res, 401, { error: 'missing app_session' });
    const delegation_token = issueDelegationToken(session);
    appendAudit({ action: 'DELEGATION_TOKEN_ISSUED', user_id: session.userId, session_id: session.sessionId, ...requestMeta });
    return json(res, 200, { delegation_token, expires_in: 60 });
  }

  if (req.method === 'POST' && url.pathname === '/api/pii/reveal-session') {
    if (role !== 'reveal') return text(res, 404, 'Not found');
    if (!revealOriginOk(req)) return text(res, 403, 'Forbidden');
    const body = JSON.parse(await readBody(req) || '{}');
    const delegation = consumeDelegationToken(body.delegation_token);
    if (!delegation) {
      appendAudit({ action: 'REVEAL_FAILED', failure_reason: 'invalid delegation token', ...requestMeta });
      return json(res, 403, { error: 'invalid delegation token' });
    }
    const session = issueRevealSession(delegation);
    res.setHeader('set-cookie', cookie('reveal_session', session.token, { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 60 * 60 }));
    appendAudit({ action: 'REVEAL_SESSION_ISSUED', user_id: session.userId, session_id: session.sessionId, ...requestMeta });
    return json(res, 200, { reveal_session: session.token, expires_in: 60 * 60 });
  }

  if (req.method === 'GET' && url.pathname === '/api/pii/record-meta') {
    if (role !== 'reveal') return text(res, 404, 'Not found');
    if (!revealOriginOk(req)) return text(res, 403, 'Forbidden');
    const session = getRevealSessionFromRequest(req);
    if (!session) return json(res, 401, { error: 'missing reveal_session' });
    const record = state.records.get(url.searchParams.get('record_id'));
    if (!record || record.customerId !== session.userId) return json(res, 403, { error: 'unauthorized' });
    return json(res, 200, { pii_type: record.piiType, masked_display: record.maskedDisplay, step_up_required: true, record_id: record.id });
  }

  if (req.method === 'POST' && url.pathname === '/api/pii/step-up') {
    if (role !== 'reveal') return text(res, 404, 'Not found');
    if (!revealOriginOk(req)) return text(res, 403, 'Forbidden');
    const session = getRevealSessionFromRequest(req);
    if (!session) return json(res, 401, { error: 'missing reveal_session' });
    const body = JSON.parse(await readBody(req) || '{}');
    const record = state.records.get(body.record_id);
    if (!record || record.customerId !== session.userId) return json(res, 403, { error: 'unauthorized' });
    const user = state.users.get(session.userId);
    if (!user || body.credential !== user.credential) {
      appendAudit({ action: 'REVEAL_FAILED', user_id: session.userId, session_id: session.sessionId, record_id: body.record_id, failure_reason: 'step-up credential rejected', ...requestMeta });
      return json(res, 403, { error: 'step-up failed', message: 'credential rejected' });
    }
    const stepUp = issueStepUpToken({ revealSession: session, recordId: record.id });
    appendAudit({ action: 'STEP_UP_ISSUED', user_id: session.userId, session_id: session.sessionId, record_id: record.id, pii_type: record.piiType, step_up_token_id: stepUp.token, ...requestMeta });
    return json(res, 200, { step_up_token: stepUp.token, expires_in: 300 });
  }

  if (req.method === 'POST' && url.pathname === '/api/pii/reveal') {
    if (role !== 'reveal') return text(res, 404, 'Not found');
    if (!revealOriginOk(req)) return text(res, 403, 'Forbidden');
    const session = getRevealSessionFromRequest(req);
    if (!session) return json(res, 401, { error: 'missing reveal_session' });
    const body = JSON.parse(await readBody(req) || '{}');
    return handleReveal(req, res, session, body, requestMeta);
  }

  if (req.method === 'POST' && url.pathname === '/api/pii/hide') {
    if (role !== 'reveal') return text(res, 404, 'Not found');
    if (!revealOriginOk(req)) return text(res, 403, 'Forbidden');
    const session = getRevealSessionFromRequest(req);
    if (!session) return json(res, 401, { error: 'missing reveal_session' });
    const body = JSON.parse(await readBody(req) || '{}');
    const token = hideRevealToken(body.reveal_token);
    if (!token) return json(res, 404, { error: 'unknown reveal token' });
    appendAudit({ action: 'HIDE', user_id: session.userId, session_id: session.sessionId, record_id: token.recordId, reveal_token: token.token, ...requestMeta });
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && url.pathname === '/api/pii/audit') {
    if (!allowOrigin(req, role === 'app' ? APP_ORIGIN : REVEAL_ORIGIN)) return text(res, 403, 'Forbidden');
    const payload = JSON.parse(await readBody(req) || '{}');
    const events = Array.isArray(payload) ? payload : [payload];
    for (const event of events) appendAudit({ ...event, ...requestMeta });
    res.writeHead(204);
    return res.end();
  }

  return text(res, 404, 'Not found');
}

function startSweep() {
  setInterval(() => {
    const expired = sweepTokens();
    for (const entry of expired) {
      appendAudit({ action: 'REVEAL_EXPIRED', user_id: entry.userId, session_id: entry.sessionId, record_id: entry.recordId, reveal_token: entry.token });
    }
  }, 5000).unref();
}

function startServers() {
  const appServer = http.createServer((req, res) => route(req, res, 'app'));
  const revealServer = http.createServer((req, res) => route(req, res, 'reveal'));
  appServer.listen(APP_PORT, '127.0.0.1', () => {
    console.log(`app origin: ${APP_ORIGIN}`);
  });
  revealServer.listen(REVEAL_PORT, '127.0.0.1', () => {
    console.log(`reveal origin: ${REVEAL_ORIGIN}`);
  });
  startSweep();
  return { appServer, revealServer };
}

module.exports = { startServers };


