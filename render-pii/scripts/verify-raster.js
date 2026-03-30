const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');

const { webcrypto } = crypto;
const { subtle } = webcrypto;

const ROOT = path.resolve(__dirname, '..');
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
const REVEAL_ORIGIN = process.env.REVEAL_ORIGIN || 'http://127.0.0.1:3001';
const RECORD_ID = process.env.RECORD_ID || '11111111-1111-1111-1111-111111111111';
const CREDENTIAL = process.env.STEP_UP_CREDENTIAL || 'demo-password';
const HKDF_INFO = 'pii-reveal-v2-raster';

function log(message) {
  process.stdout.write(`${message}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseSetCookie(setCookie) {
  if (!setCookie) return null;
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!first) return null;
  return first.split(';')[0];
}

async function waitForHealth(origin, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(new URL('/healthz', origin).href);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${origin} healthz`);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  const raw = await response.text();
  let data = null;
  if (raw) {
    data = JSON.parse(raw);
  }

  return { response, data };
}

function toBase64Url(bytes) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64(value) {
  return Buffer.from(value, 'base64');
}

async function deriveRasterKey(browserKeyPair, serverPubJwk) {
  const serverPubKey = await subtle.importKey(
    'jwk',
    serverPubJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const ecdhBits = await subtle.deriveBits(
    { name: 'ECDH', public: serverPubKey },
    browserKeyPair.privateKey,
    256
  );

  const hkdfKey = await subtle.importKey('raw', ecdhBits, { name: 'HKDF' }, false, ['deriveKey']);

  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(HKDF_INFO),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

async function main() {
  log('booting server');
  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  server.stdout.on('data', (chunk) => process.stdout.write(chunk));
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));

  try {
    await waitForHealth(APP_ORIGIN);
    await waitForHealth(REVEAL_ORIGIN);

    log('seeding app session');
    const appRoot = await fetch(APP_ORIGIN, { redirect: 'manual' });
    const appSession = parseSetCookie(appRoot.headers.getSetCookie?.() || appRoot.headers.get('set-cookie'));
    assert(appSession, 'missing app_session cookie');

    log('issuing delegation token');
    const delegationResponse = await fetch(new URL('/api/pii/delegation-token', APP_ORIGIN).href, {
      method: 'POST',
      headers: { Cookie: appSession },
    });
    assert(delegationResponse.ok, `delegation token request failed (${delegationResponse.status})`);
    const delegationBody = await delegationResponse.json();
    assert(delegationBody.delegation_token, 'missing delegation_token');

    log('opening reveal session');
    const revealSessionResponse = await fetch(new URL('/api/pii/reveal-session', REVEAL_ORIGIN).href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delegation_token: delegationBody.delegation_token }),
    });
    assert(revealSessionResponse.ok, `reveal session request failed (${revealSessionResponse.status})`);
    const revealSessionCookie = parseSetCookie(revealSessionResponse.headers.getSetCookie?.() || revealSessionResponse.headers.get('set-cookie'));
    assert(revealSessionCookie, 'missing reveal_session cookie');

    log('loading record metadata');
    const metaResponse = await fetch(new URL(`/api/pii/record-meta?record_id=${encodeURIComponent(RECORD_ID)}`, REVEAL_ORIGIN).href, {
      headers: { Cookie: revealSessionCookie },
    });
    assert(metaResponse.ok, `record meta request failed (${metaResponse.status})`);
    const metaBody = await metaResponse.json();
    assert(metaBody.step_up_required === true, 'record meta did not require step-up');

    log('issuing step-up token');
    const stepUpResponse = await fetch(new URL('/api/pii/step-up', REVEAL_ORIGIN).href, {
      method: 'POST',
      headers: {
        Cookie: revealSessionCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ record_id: RECORD_ID, credential: CREDENTIAL }),
    });
    assert(stepUpResponse.ok, `step-up request failed (${stepUpResponse.status})`);
    const stepUpBody = await stepUpResponse.json();
    assert(stepUpBody.step_up_token, 'missing step_up_token');

    log('generating browser keypair');
    const browserKeyPair = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
    const browserPubJwk = await subtle.exportKey('jwk', browserKeyPair.publicKey);

    log('requesting encrypted raster reveal');
    const revealResponse = await fetch(new URL('/api/pii/reveal', REVEAL_ORIGIN).href, {
      method: 'POST',
      headers: {
        Cookie: revealSessionCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        record_id: RECORD_ID,
        purpose: 'VIEW_OWN_DATA',
        step_up_token: stepUpBody.step_up_token,
        browser_ecdh_public_key: browserPubJwk,
      }),
    });
    assert(revealResponse.ok, `reveal request failed (${revealResponse.status})`);
    const revealBody = await revealResponse.json();

    assert(revealBody.server_ecdh_public_key, 'missing server_ecdh_public_key');
    assert(revealBody.image && typeof revealBody.image === 'object', 'missing image payload');
    assert(revealBody.image.pixel_format === 'rgba', 'unexpected pixel_format');
    assert(Number.isInteger(revealBody.image.width) && revealBody.image.width > 0, 'invalid image width');
    assert(Number.isInteger(revealBody.image.height) && revealBody.image.height > 0, 'invalid image height');
    assert(typeof revealBody.image.ciphertext === 'string' && revealBody.image.ciphertext.length > 0, 'missing image ciphertext');
    assert(typeof revealBody.image.iv === 'string' && revealBody.image.iv.length > 0, 'missing image iv');

    const rasterKey = await deriveRasterKey(browserKeyPair, revealBody.server_ecdh_public_key);
    const plainBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(revealBody.image.iv) },
      rasterKey,
      fromBase64(revealBody.image.ciphertext)
    );
    const plainBytes = new Uint8Array(plainBuffer);
    const expectedLength = revealBody.image.width * revealBody.image.height * 4;
    assert(plainBytes.length === expectedLength, `unexpected raster byte length: ${plainBytes.length} !== ${expectedLength}`);

    log('hiding reveal');
    const hideResponse = await fetch(new URL('/api/pii/hide', REVEAL_ORIGIN).href, {
      method: 'POST',
      headers: {
        Cookie: revealSessionCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reveal_token: revealBody.reveal_token }),
    });
    assert(hideResponse.status === 204, `hide request failed (${hideResponse.status})`);

    log('verification complete');
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
