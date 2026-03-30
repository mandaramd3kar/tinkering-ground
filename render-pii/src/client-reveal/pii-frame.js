import { emitAuditEvent } from './audit-emitter.js';
import { installAntiCopyGuard } from './anti-copy-guard.js';

const DEFAULT_PARENT_ORIGIN = 'http://127.0.0.1:3000';
const DEFAULT_API_ORIGIN = 'http://127.0.0.1:3001';

const parentOrigin = resolveParentOrigin();
const apiOrigin = resolveApiOrigin();

const refs = {
  sessionStatus: document.getElementById('sessionStatus'),
  stateHint: document.getElementById('stateHint'),
  toggleButton: document.getElementById('toggleButton'),
  stepUpPanel: document.getElementById('stepUpPanel'),
  credentialInput: document.getElementById('credentialInput'),
  stepUpError: document.getElementById('stepUpError'),
  displayCanvas: document.getElementById('displayCanvas'),
};

const state = {
  sessionReady: false,
  worker: null,
  workerReady: false,
  workerPublicKey: null,
  currentRevealToken: null,
  currentRevealExpiresAt: null,
  currentRecordId: null,
  currentPurpose: 'VIEW_OWN_DATA',
  currentPaintDelayMs: 0,
  hideTimer: null,
  pendingKeypair: null,
  awaitingStepUp: null,
  printing: false,
};

function resolveParentOrigin() {
  try {
    const queryOrigin = new URLSearchParams(window.location.search).get('parentOrigin');
    if (queryOrigin) {
      return queryOrigin;
    }
    if (document.referrer) {
      return new URL(document.referrer).origin;
    }
  } catch {
    // fall through
  }
  return DEFAULT_PARENT_ORIGIN;
}

function resolveApiOrigin() {
  try {
    const queryOrigin = new URLSearchParams(window.location.search).get('apiOrigin');
    if (queryOrigin) {
      return queryOrigin;
    }
  } catch {
    // fall through
  }
  return DEFAULT_API_ORIGIN;
}

function clampPaintDelay(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(500, Math.round(numeric / 25) * 25));
}

function postToParent(message) {
  window.parent.postMessage(message, parentOrigin);
}

function setSessionStatus(text, tone = 'neutral') {
  if (!refs.sessionStatus) return;
  refs.sessionStatus.textContent = text;
  refs.sessionStatus.dataset.tone = tone;
}

function setStateHint(text, kind = 'neutral') {
  if (!refs.stateHint) return;
  refs.stateHint.textContent = text;
  refs.stateHint.dataset.kind = kind;
}

function setRevealState(stateName, extra = {}) {
  postToParent({ type: 'REVEAL_STATE', state: stateName, ...extra });
}

function setBusy(busy) {
  if (!refs.toggleButton) return;
  refs.toggleButton.disabled = busy || !state.sessionReady;
  refs.toggleButton.textContent = busy ? 'Working...' : state.currentRevealToken ? 'Hide' : 'Show';
}

function clearHideTimer() {
  if (state.hideTimer) {
    window.clearTimeout(state.hideTimer);
    state.hideTimer = null;
  }
}

function resetStepUpPanel() {
  refs.stepUpPanel.hidden = true;
  refs.credentialInput.value = '';
  refs.stepUpError.hidden = true;
  refs.stepUpError.textContent = '';
  state.awaitingStepUp = null;
}

function showStepUpPanel(meta) {
  refs.stepUpPanel.hidden = false;
  refs.credentialInput.focus();
  refs.stepUpError.hidden = true;
  refs.stepUpError.textContent = '';
  state.awaitingStepUp = meta;
}

function setPrintingMode(isPrinting) {
  state.printing = isPrinting;
  document.body.classList.toggle('is-printing', isPrinting);
}

function installPrintHooks() {
  window.addEventListener('beforeprint', () => {
    setPrintingMode(true);
    void hideReveal('print');
  });
  window.addEventListener('afterprint', () => {
    setPrintingMode(false);
  });

  if (window.matchMedia) {
    const media = window.matchMedia('print');
    const handleChange = (event) => {
      const isPrinting = Boolean(event.matches);
      setPrintingMode(isPrinting);
      if (isPrinting) {
        void hideReveal('print');
      }
    };
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange);
    } else if (typeof media.addListener === 'function') {
      media.addListener(handleChange);
    }
  }
}

async function fetchJson(path, options = {}) {
  const response = await fetch(new URL(path, apiOrigin).href, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  const raw = await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    const message = data && typeof data === 'object'
      ? (data.message || data.error || `Request failed (${response.status})`)
      : `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function ensureWorker() {
  if (state.worker) {
    return state.worker;
  }

  if (!window.OffscreenCanvas) {
    throw new Error('OffscreenCanvas is required');
  }

  const worker = new Worker(new URL('./reveal-worker.js', import.meta.url), { type: 'module' });
  state.worker = worker;

  const offscreen = refs.displayCanvas.transferControlToOffscreen();
  worker.postMessage({ type: 'INIT', offscreenCanvas: offscreen }, [offscreen]);

  worker.addEventListener('message', (event) => {
    const { type } = event.data || {};

    if (type === 'READY') {
      state.workerReady = true;
      setSessionStatus(state.sessionReady ? 'ready' : 'frame', 'ok');
      return;
    }

    if (type === 'ECDH_PUBLIC_KEY') {
      state.workerPublicKey = event.data.pubJwk;
      if (state.pendingKeypair) {
        state.pendingKeypair.resolve(event.data.pubJwk);
        state.pendingKeypair = null;
      }
      return;
    }

    if (type === 'RENDER_COMPLETE') {
      setBusy(false);
      setRevealState('REVEALED', {
        revealToken: state.currentRevealToken,
        expiresAt: state.currentRevealExpiresAt,
      });
      setStateHint('', 'ok');
      return;
    }

    if (type === 'TEARDOWN_COMPLETE') {
      state.workerPublicKey = null;
      return;
    }

    if (type === 'RENDER_ERROR') {
      if (state.pendingKeypair) {
        state.pendingKeypair.reject(new Error(event.data.message || 'Render failed'));
        state.pendingKeypair = null;
      }
      setBusy(false);
      setRevealState('ERROR', { code: 'RENDER_ERROR', message: event.data.message });
      setStateHint('', 'danger');
    }
  });

  worker.addEventListener('error', (event) => {
    if (state.pendingKeypair) {
      state.pendingKeypair.reject(new Error(event.message || 'Worker failed'));
      state.pendingKeypair = null;
    }
    setBusy(false);
    setRevealState('ERROR', { code: 'WORKER_ERROR', message: event.message || 'Worker failed' });
    setStateHint('', 'danger');
  });

  return worker;
}

async function requestWorkerPublicKey() {
  const worker = await ensureWorker();
  if (state.pendingKeypair) {
    return state.pendingKeypair.promise;
  }

  let timeoutId = null;
  const entry = {
    promise: null,
    resolve: null,
    reject: null,
  };

  const promise = new Promise((resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      if (state.pendingKeypair === entry) {
        state.pendingKeypair = null;
        reject(new Error('Timed out waiting for worker keypair'));
      }
    }, 4000);

    entry.resolve = (pubJwk) => {
      window.clearTimeout(timeoutId);
      resolve(pubJwk);
    };

    entry.reject = (error) => {
      window.clearTimeout(timeoutId);
      reject(error);
    };
  });

  entry.promise = promise;
  state.pendingKeypair = entry;
  worker.postMessage({ type: 'PREPARE_REVEAL' });
  return promise;
}

async function bootstrapSession(delegationToken) {
  await fetchJson('/api/pii/reveal-session', {
    method: 'POST',
    body: JSON.stringify({ delegation_token: delegationToken }),
  });

  state.sessionReady = true;
  setSessionStatus('ready', 'ok');
  setStateHint('', 'ok');
  if (refs.toggleButton) {
    refs.toggleButton.disabled = false;
  }
  postToParent({ type: 'SESSION_READY' });
}

async function loadRecordMeta(recordId) {
  const params = new URLSearchParams({ record_id: recordId });
  return fetchJson(`/api/pii/record-meta?${params.toString()}`, { method: 'GET' });
}

async function submitStepUp(recordId, credential) {
  return fetchJson('/api/pii/step-up', {
    method: 'POST',
    body: JSON.stringify({ record_id: recordId, credential }),
  });
}

async function requestReveal(recordId, purpose, paintDelayMs = 0) {
  const delay = clampPaintDelay(paintDelayMs);
  setRevealState('LOG', { message: 'record-meta: loading' });
  clearHideTimer();
  resetStepUpPanel();
  state.currentRecordId = recordId;
  state.currentPurpose = purpose;
  state.currentPaintDelayMs = delay;
  setBusy(true);
  setRevealState('LOADING');

  try {
    const meta = await loadRecordMeta(recordId);

    if (meta.step_up_required) {
      showStepUpPanel(meta);
      setBusy(false);
      setRevealState('LOG', { message: 'step-up: password required' });
      setRevealState('STEP_UP_REQUIRED', { piiType: meta.pii_type });
      return;
    }

    await revealWithWorker(recordId, purpose, null, delay);
  } catch (error) {
    setBusy(false);
    setRevealState('ERROR', {
      code: 'RECORD_META_FAILED',
      message: error instanceof Error ? error.message : 'Record lookup failed',
    });
  }
}

async function revealWithWorker(recordId, purpose, stepUpToken, paintDelayMs = state.currentPaintDelayMs) {
  const delay = clampPaintDelay(paintDelayMs);
  state.currentPaintDelayMs = delay;
  setRevealState('LOG', { message: `worker: preparing key (${delay}ms)` });
  const browser_ecdh_public_key = await requestWorkerPublicKey();
  setRevealState('LOG', { message: 'reveal: requesting raster' });
  const revealResponse = await fetchJson('/api/pii/reveal', {
    method: 'POST',
    body: JSON.stringify({
      record_id: recordId,
      browser_ecdh_public_key,
      purpose,
      step_up_token: stepUpToken,
    }),
  });

  state.currentRevealToken = revealResponse.reveal_token;
  state.currentRevealExpiresAt = revealResponse.expires_at;
  setRevealState('LOADING', { revealToken: revealResponse.reveal_token, expiresAt: revealResponse.expires_at });

  const worker = await ensureWorker();
  setRevealState('LOG', { message: `worker: painting raster (${delay}ms)` });
  worker.postMessage({ type: 'RENDER', payload: revealResponse, paintDelayMs: delay });

  clearHideTimer();
  if (revealResponse.expires_at) {
    const delayUntilHide = Math.max(0, (revealResponse.expires_at * 1000) - Date.now());
    state.hideTimer = window.setTimeout(() => {
      void hideReveal('ttl');
    }, delayUntilHide);
  }
}

async function hideReveal(reason = 'manual') {
  clearHideTimer();
  resetStepUpPanel();
  const revealToken = state.currentRevealToken;
  state.currentRevealToken = null;
  state.currentRevealExpiresAt = null;

  try {
    if (revealToken) {
      await fetchJson('/api/pii/hide', {
        method: 'POST',
        body: JSON.stringify({ reveal_token: revealToken }),
      }).catch(() => {});
    }
  } finally {
    if (state.worker) {
      state.worker.postMessage({ type: 'TEARDOWN' });
    }
    emitAuditEvent('CLIENT_HIDE_REPORTED', { reveal_token: revealToken, reason });
    setBusy(false);
    setRevealState('HIDDEN', { reason });
  }
}

async function handleToggle() {
  if (state.currentRevealToken) {
    await hideReveal('manual');
  }
}

async function handleStepUpSubmit(event) {
  event.preventDefault();

  if (!state.awaitingStepUp) {
    return;
  }

  const credential = refs.credentialInput.value.trim();
  if (!credential) {
    refs.stepUpError.hidden = false;
    refs.stepUpError.textContent = 'required';
    return;
  }

  try {
    refs.stepUpError.hidden = true;
    setBusy(true);
    setRevealState('LOG', { message: 'step-up: verifying password' });
    const stepUp = await submitStepUp(state.currentRecordId, credential);
    resetStepUpPanel();
    await revealWithWorker(state.currentRecordId, state.currentPurpose, stepUp.step_up_token, state.currentPaintDelayMs);
  } catch (error) {
    setBusy(false);
    refs.stepUpError.hidden = false;
    refs.stepUpError.textContent = error instanceof Error ? error.message : 'step-up failed';
    setRevealState('ERROR', {
      code: 'STEP_UP_FAILED',
      message: error instanceof Error ? error.message : 'Step-up failed',
    });
  }
}

function handleParentMessage(event) {
  if (event.origin !== parentOrigin) {
    return;
  }

  const message = event.data || {};

  switch (message.type) {
    case 'SESSION_INIT':
      if (!message.delegationToken) {
        postToParent({ type: 'SESSION_ERROR', code: 'MISSING_DELEGATION_TOKEN' });
        return;
      }
      bootstrapSession(message.delegationToken).catch((error) => {
        postToParent({
          type: 'SESSION_ERROR',
          code: 'SESSION_INIT_FAILED',
          message: error instanceof Error ? error.message : 'Session bootstrap failed',
        });
        setSessionStatus('error', 'danger');
      });
      break;
    case 'REVEAL_REQUEST':
      if (!state.sessionReady) {
        postToParent({ type: 'SESSION_ERROR', code: 'SESSION_NOT_READY' });
        return;
      }
      void requestReveal(message.recordId, message.purpose || 'VIEW_OWN_DATA', message.paintDelayMs || 0);
      break;
    case 'HIDE_REQUEST':
      void hideReveal('parent');
      break;
    default:
      break;
  }
}

async function initialRender() {
  installAntiCopyGuard(document);
  installPrintHooks();

  if (refs.toggleButton) {
    refs.toggleButton.addEventListener('click', handleToggle);
    refs.toggleButton.disabled = true;
  }
  refs.stepUpPanel.addEventListener('submit', handleStepUpSubmit);
  window.addEventListener('message', handleParentMessage);
  window.addEventListener('pagehide', () => {
    emitAuditEvent('CLIENT_UNLOAD_REPORTED', { reveal_token: state.currentRevealToken });
    if (state.worker) {
      state.worker.postMessage({ type: 'TEARDOWN' });
    }
  });

  refs.displayCanvas.width = 360;
  refs.displayCanvas.height = 56;
  setSessionStatus('frame', 'neutral');
  setStateHint('', 'neutral');

  await ensureWorker();
  postToParent({ type: 'FRAME_READY' });
}

void initialRender();
