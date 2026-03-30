function zeroBytes(bytes) {
  if (bytes) {
    bytes.fill(0);
  }
}

function commitSurface() {
  if (surfaceContext && typeof surfaceContext.commit === 'function') {
    surfaceContext.commit();
  }
}

function fillBackground(ctx, width, height, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function fillRandom(target) {
  const chunkSize = 65536;
  for (let offset = 0; offset < target.length; offset += chunkSize) {
    crypto.getRandomValues(target.subarray(offset, Math.min(offset + chunkSize, target.length)));
  }
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function b64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function assertImageShape(image) {
  if (!image || typeof image !== 'object') {
    throw new Error('Missing image payload');
  }

  const width = Number(image.width);
  const height = Number(image.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid image dimensions');
  }

  if (width > 4096 || height > 4096) {
    throw new Error('Image dimensions exceed limit');
  }

  if (image.pixel_format !== 'rgba') {
    throw new Error('Unsupported pixel format');
  }

  if (typeof image.ciphertext !== 'string' || typeof image.iv !== 'string') {
    throw new Error('Missing encrypted image fields');
  }

  return { width, height };
}

function clampPaintDelay(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(500, Math.round(numeric / 25) * 25));
}

let surface = null;
let surfaceContext = null;
let currentKeypair = null;
let activeRevealToken = null;
let activeRenderId = 0;

async function generateKeypair() {
  currentKeypair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const pubJwk = await crypto.subtle.exportKey('jwk', currentKeypair.publicKey);
  self.postMessage({ type: 'ECDH_PUBLIC_KEY', pubJwk });
}

async function deriveAesKey(serverPubJwk) {
  if (!currentKeypair) {
    throw new Error('Worker keypair is not ready');
  }

  const serverPubKey = await crypto.subtle.importKey(
    'jwk',
    serverPubJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const ecdhBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: serverPubKey },
    currentKeypair.privateKey,
    256
  );

  const hkdfKey = await crypto.subtle.importKey('raw', ecdhBits, 'HKDF', false, ['deriveKey']);

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('pii-reveal-v2-raster'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  zeroBytes(new Uint8Array(ecdhBits));
  currentKeypair = null;
  return aesKey;
}

async function renderImage(payload, paintDelayMs = 0) {
  if (!surface || !surfaceContext) {
    throw new Error('Render surface not initialised');
  }

  const {
    server_ecdh_public_key: serverPubJwk,
    image,
    reveal_token: revealToken,
  } = payload || {};

  if (!serverPubJwk) {
    throw new Error('Missing server key');
  }

  const { width, height } = assertImageShape(image);
  const renderId = ++activeRenderId;
  const delay = clampPaintDelay(paintDelayMs);
  activeRevealToken = revealToken || null;

  const aesKey = await deriveAesKey(serverPubJwk);
  const ivBytes = b64ToBytes(image.iv);
  const ciphertextBytes = b64ToBytes(image.ciphertext);
  let plainBytes = null;

  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      aesKey,
      ciphertextBytes
    );

    plainBytes = new Uint8ClampedArray(plainBuffer);
    const expectedBytes = width * height * 4;
    if (plainBytes.length !== expectedBytes) {
      throw new Error('Decrypted image length mismatch');
    }

    surface.width = width;
    surface.height = height;
    fillBackground(surfaceContext, width, height, '#f8fafc');
    commitSurface();

    const bandHeight = Math.max(1, Math.min(4, height));
    for (let y = 0; y < height; y += bandHeight) {
      if (renderId !== activeRenderId) {
        return;
      }

      const rows = Math.min(bandHeight, height - y);
      const start = y * width * 4;
      const end = start + (rows * width * 4);
      const bandBytes = plainBytes.slice(start, end);
      surfaceContext.putImageData(new ImageData(bandBytes, width, rows), 0, y);
      commitSurface();
      zeroBytes(bandBytes);

      if (delay > 0 && y + rows < height) {
        await sleep(delay);
      }
    }

    if (renderId === activeRenderId) {
      self.postMessage({
        type: 'RENDER_COMPLETE',
        reveal_token: activeRevealToken,
        width,
        height,
      });
    }
  } finally {
    zeroBytes(ivBytes);
    zeroBytes(ciphertextBytes);
    zeroBytes(plainBytes);
  }
}

async function teardownSurface() {
  activeRenderId += 1;
  if (!surface || !surfaceContext) {
    currentKeypair = null;
    activeRevealToken = null;
    return;
  }

  const noise = new Uint8ClampedArray(surface.width * surface.height * 4);
  fillRandom(noise);
  surfaceContext.putImageData(new ImageData(noise, surface.width, surface.height), 0, 0);
  surfaceContext.clearRect(0, 0, surface.width, surface.height);
  commitSurface();
  zeroBytes(noise);

  currentKeypair = null;
  activeRevealToken = null;
  self.postMessage({ type: 'TEARDOWN_COMPLETE' });
}

self.onmessage = async (event) => {
  const { type } = event.data || {};

  try {
    switch (type) {
      case 'INIT': {
        surface = event.data.offscreenCanvas;
        if (!surface) {
          throw new Error('Offscreen canvas is required');
        }
        surfaceContext = surface.getContext('2d');
        if (!surfaceContext) {
          throw new Error('2D context is unavailable');
        }
        fillBackground(surfaceContext, surface.width, surface.height, '#f8fafc');
        commitSurface();
        self.postMessage({ type: 'READY' });
        break;
      }
      case 'PREPARE_REVEAL':
        await generateKeypair();
        break;
      case 'RENDER':
        await renderImage(event.data.payload || {}, event.data.paintDelayMs || 0);
        break;
      case 'TEARDOWN':
        await teardownSurface();
        break;
      default:
        break;
    }
  } catch (error) {
    self.postMessage({
      type: 'RENDER_ERROR',
      reveal_token: activeRevealToken,
      message: error instanceof Error ? error.message : 'Unexpected worker failure',
    });
  }
};
