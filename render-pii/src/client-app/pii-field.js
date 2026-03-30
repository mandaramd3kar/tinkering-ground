const DEFAULTS = {
  revealOrigin: 'http://127.0.0.1:3001',
  revealPath: '/src/client-reveal/reveal-frame.html',
  delegationTokenEndpoint: '/api/pii/delegation-token',
  purpose: 'VIEW_OWN_DATA',
  title: 'PII',
  cleartextPan: '',
  maskedDisplay: '**** **** **** 1234',
  recordId: '00000000-0000-0000-0000-000000000000',
  fieldLabel: 'Sensitive value',
  stepUpRequired: false,
  iframeClassName: 'pii-field__iframe',
  paintDelayMs: 0,
};

function buildIframeUrl(origin, path) {
  const url = new URL(path, origin);
  url.searchParams.set('parentOrigin', window.location.origin);
  url.searchParams.set('apiOrigin', origin);
  return url.toString();
}

function formatCountdown(expiresAtMs) {
  const remaining = Math.max(0, expiresAtMs - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}m ${String(rest).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

function clampPaintDelay(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(500, Math.round(numeric / 25) * 25));
}

function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'className') el.className = value;
    else if (key === 'textContent') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'hidden') el.hidden = Boolean(value);
    else if (key === 'value') el.value = String(value);
    else el.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

export class PiiField {
  constructor(root, options = {}) {
    this.root = root;
    this.options = { ...DEFAULTS, ...options };
    this.state = 'hidden';
    this.sessionState = 'idle';
    this.pendingReveal = false;
    this.revealToken = null;
    this.expiresAtMs = null;
    this.delegationToken = null;
    this.abortController = new AbortController();
    this.iframeReady = false;
    this.iframeWindow = null;
    this.countdownTimer = null;
    this.logs = [];
    this.paintDelayMs = clampPaintDelay(this.options.paintDelayMs);
    this.messageHandler = this.onMessage.bind(this);

    this.render();
    window.addEventListener('message', this.messageHandler);
    this.bootstrap();
  }

  destroy() {
    window.removeEventListener('message', this.messageHandler);
    this.abortController.abort();
    clearInterval(this.countdownTimer);
    this.countdownTimer = null;
    this.iframe?.remove();
    this.root.replaceChildren();
  }

  async bootstrap() {
    try {
      this.addLog('boot: iframe bootstrap');
      this.setSessionState('bootstrapping', '');
      this.ensureIframe();
      await this.waitForIframeReady();
      this.addLog('frame: ready');
      await this.ensureDelegationToken();
      this.addLog('token: delegation ready');
      this.postToIframe({
        type: 'SESSION_INIT',
        delegationToken: this.delegationToken,
      });
      this.addLog('session: init sent');
      this.setSessionState('waiting-session', '');
    } catch (error) {
      this.setError(error);
    }
  }

  render() {
    const { cleartextPan, maskedDisplay } = this.options;

    this.root.classList.add('pii-field');
    this.root.innerHTML = '';

    this.valueEl = createEl('div', {
      className: 'pii-field__value',
      textContent: cleartextPan || maskedDisplay,
      dataset: { state: 'hidden' },
      'aria-live': 'polite',
    });

    this.statusEl = createEl('div', {
      className: 'pii-field__status',
      textContent: '',
    });

    this.errorEl = createEl('div', {
      className: 'pii-field__error',
      hidden: true,
    });

    this.buttonEl = createEl('button', { className: 'pii-field__toggle', type: 'button' }, 'Show');
    this.buttonEl.addEventListener('click', () => {
      if (this.state === 'revealed' || this.state === 'revealing') {
        this.hide();
      } else {
        this.show();
      }
    });

    this.paintDelayValueEl = createEl('span', {
      className: 'pii-field__speed-value',
      textContent: `${this.paintDelayMs} ms`,
    });

    this.paintDelayInputEl = createEl('input', {
      className: 'pii-field__speed-slider',
      type: 'range',
      min: '0',
      max: '500',
      step: '25',
      value: this.paintDelayMs,
      'aria-label': 'Reveal paint delay',
    });
    this.paintDelayInputEl.addEventListener('input', () => {
      this.paintDelayMs = clampPaintDelay(this.paintDelayInputEl.value);
      this.paintDelayInputEl.value = String(this.paintDelayMs);
      this.paintDelayValueEl.textContent = `${this.paintDelayMs} ms`;
    });

    this.paintDelayPanelEl = createEl('label', { className: 'pii-field__speed' }, [
      createEl('span', { className: 'pii-field__speed-label', textContent: 'Paint delay' }),
      this.paintDelayInputEl,
      this.paintDelayValueEl,
    ]);

    this.iframeHost = createEl('div', { className: 'pii-field__iframe-host' });

    this.logListEl = createEl('ol', { className: 'pii-field__log-list' });
    this.logPanelEl = createEl('div', { className: 'pii-field__log' }, [this.logListEl]);

    const leftColumn = createEl('div', { className: 'pii-field__left' }, [
      this.valueEl,
      createEl('div', { className: 'pii-field__actions' }, [this.buttonEl, this.statusEl]),
      this.paintDelayPanelEl,
      this.errorEl,
      this.logPanelEl,
    ]);

    const rightColumn = createEl('div', { className: 'pii-field__right' }, [this.iframeHost]);

    const chrome = createEl('div', { className: 'pii-field__chrome' }, [leftColumn, rightColumn]);

    this.root.append(chrome);
    this.renderLogs();
    this.syncUi();
  }

  ensureIframe() {
    if (this.iframe) return this.iframe;
    const { revealOrigin, revealPath, iframeClassName } = this.options;

    this.iframe = createEl('iframe', {
      className: iframeClassName,
      src: buildIframeUrl(revealOrigin, revealPath),
      title: 'Secure PII reveal',
      sandbox: 'allow-scripts allow-forms allow-same-origin',
      referrerpolicy: 'no-referrer',
      loading: 'eager',
    });

    this.iframe.addEventListener('load', () => {
      this.iframeWindow = this.iframe.contentWindow;
      this.iframeReady = true;
      this.addLog('frame: loaded');
      this.setSessionState('iframe-ready', '');
      if (this.pendingReveal) {
        this.reveal();
      }
    });

    this.iframeHost.append(this.iframe);
    return this.iframe;
  }

  waitForIframeReady() {
    if (this.iframeReady) return Promise.resolve();
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.iframeReady) {
          clearInterval(interval);
          resolve();
        }
      }, 25);
      this.abortController.signal.addEventListener(
        'abort',
        () => {
          clearInterval(interval);
          resolve();
        },
        { once: true }
      );
    });
  }

  async ensureDelegationToken() {
    if (this.delegationToken) return this.delegationToken;
    const { delegationToken, delegationTokenEndpoint } = this.options;
    if (delegationToken) {
      this.delegationToken = delegationToken;
      return delegationToken;
    }

    const response = await fetch(delegationTokenEndpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId: this.options.recordId }),
      signal: this.abortController.signal,
    });
    if (!response.ok) {
      throw new Error(`delegation token request failed (${response.status})`);
    }
    const payload = await response.json();
    if (!payload?.delegation_token) {
      throw new Error('delegation token missing from response');
    }
    this.delegationToken = payload.delegation_token;
    return this.delegationToken;
  }

  postToIframe(message) {
    if (!this.iframeWindow) {
      this.addLog(`post failed: ${message.type}`, 'error');
      return false;
    }
    this.iframeWindow.postMessage(message, this.options.revealOrigin);
    return true;
  }

  async show() {
    this.pendingReveal = true;
    this.buttonEl.disabled = true;
    this.clearError();
    this.addLog('show: clicked');
    this.addLog(`paint: ${this.paintDelayMs}ms per band`);
    this.setStatus('');
    this.syncUi();
    try {
      await this.bootstrapIfNeeded();
      if (this.sessionState === 'ready') {
        this.reveal();
      }
    } catch (error) {
      this.setError(error);
    } finally {
      this.buttonEl.disabled = false;
    }
  }

  async hide() {
    this.pendingReveal = false;
    this.addLog('hide: requested');
    this.postToIframe({ type: 'HIDE_REQUEST' });
    this.state = 'hidden';
    this.revealToken = null;
    this.expiresAtMs = null;
    this.setStatus('');
    this.syncUi();
  }

  async reveal() {
    if (this.sessionState !== 'ready') {
      this.addLog('reveal: waiting for session');
      this.pendingReveal = true;
      return;
    }
    this.pendingReveal = false;
    this.addLog('reveal: request sent');
    this.postToIframe({
      type: 'REVEAL_REQUEST',
      recordId: this.options.recordId,
      purpose: this.options.purpose,
      paintDelayMs: this.paintDelayMs,
    });
    this.state = 'revealing';
    this.syncUi();
  }

  async bootstrapIfNeeded() {
    if (!this.iframeReady) {
      this.addLog('frame: waiting');
      await this.waitForIframeReady();
    }
    if (!this.delegationToken) {
      this.addLog('token: fetching');
      await this.ensureDelegationToken();
      this.postToIframe({
        type: 'SESSION_INIT',
        delegationToken: this.delegationToken,
      });
      this.addLog('session: init resent');
    }
  }

  onMessage(event) {
    if (event.origin !== this.options.revealOrigin) return;
    if (!this.iframeWindow || event.source !== this.iframeWindow) return;

    const { type } = event.data || {};
    if (!type) return;

    switch (type) {
      case 'FRAME_READY':
        this.iframeReady = true;
        this.iframeWindow = event.source;
        this.addLog('frame: ready');
        this.setSessionState('iframe-ready', '');
        break;
      case 'SESSION_READY':
        this.addLog('session: ready');
        this.setSessionState('ready', '');
        if (this.pendingReveal) this.reveal();
        break;
      case 'SESSION_ERROR':
        this.setError(new Error(event.data.message || event.data.code || 'session error'));
        break;
      case 'REVEAL_STATE':
        this.onRevealState(event.data);
        break;
      default:
        break;
    }
  }

  onRevealState(data) {
    const rawState = typeof data?.state === 'string' ? data.state.toLowerCase() : '';
    const { expiresAt, code, message } = data || {};
    if (rawState === 'log') {
      if (message) {
        this.addLog(message);
      }
      return;
    }
    if (rawState === 'revealed') {
      this.addLog('reveal: painted');
      this.state = 'revealed';
      this.revealToken = data.revealToken || null;
      this.expiresAtMs = typeof expiresAt === 'number' ? expiresAt * 1000 : null;
      this.setStatus(code ? `${code}` : '');
      this.startCountdown();
    } else if (rawState === 'hidden') {
      this.addLog('reveal: cleared');
      this.state = 'hidden';
      this.revealToken = null;
      this.expiresAtMs = null;
      this.setStatus('');
      clearInterval(this.countdownTimer);
    } else if (rawState === 'loading') {
      this.addLog('reveal: loading');
      this.state = 'revealing';
      this.setStatus('');
    } else if (rawState === 'step_up_required') {
      this.addLog('step-up: password required');
      this.state = 'revealing';
      this.setStatus('');
    } else if (rawState === 'error') {
      this.setError(new Error(message || code || 'reveal failed'));
      return;
    }
    this.syncUi();
  }

  startCountdown() {
    clearInterval(this.countdownTimer);
    if (!this.expiresAtMs) return;
    this.countdownTimer = setInterval(() => {
      if (this.state !== 'revealed') {
        clearInterval(this.countdownTimer);
        return;
      }
      const suffix = formatCountdown(this.expiresAtMs);
      this.setStatus(suffix);
      if (Date.now() >= this.expiresAtMs) {
        this.hide();
      }
    }, 1000);
  }

  setSessionState(state, message) {
    this.sessionState = state;
    this.setStatus(message);
    this.syncUi();
  }

  setStatus(message) {
    this.statusText = message;
    if (this.statusEl) {
      this.statusEl.textContent = message;
    }
  }

  setError(error) {
    this.state = 'error';
    this.error = error;
    this.addLog(`error: ${error.message || 'unexpected error'}`, 'error');
    this.setStatus('');
    this.syncUi();
  }

  clearError() {
    this.error = null;
    this.syncUi();
  }

  addLog(message, level = 'info') {
    this.logs.unshift({ message, level });
    this.logs = this.logs.slice(0, 10);
    this.renderLogs();
  }

  renderLogs() {
    if (!this.logListEl) return;
    this.logListEl.replaceChildren(
      ...this.logs.map((entry) =>
        createEl('li', { className: 'pii-field__log-item', dataset: { level: entry.level }, textContent: entry.message })
      )
    );
  }

  syncUi() {
    this.valueEl.dataset.state = this.state;
    this.valueEl.textContent = this.options.cleartextPan || this.options.maskedDisplay;
    this.paintDelayInputEl.value = String(this.paintDelayMs);
    this.paintDelayValueEl.textContent = `${this.paintDelayMs} ms`;
    this.buttonEl.textContent = this.state === 'revealed' ? 'Hide' : 'Show';
    this.buttonEl.setAttribute('aria-pressed', String(this.state === 'revealed'));
    this.root.dataset.state = this.state;
    this.root.dataset.session = this.sessionState;
    this.root.dataset.ready = String(Boolean(this.iframeReady));
    this.root.dataset.error = String(Boolean(this.error));
    if (this.errorEl) {
      this.errorEl.hidden = !this.error;
      this.errorEl.textContent = this.error ? this.error.message || 'Unexpected error' : '';
    }
  }
}

export function mountPiiField(root, options = {}) {
  return new PiiField(root, options);
}

export function definePiiFieldElement() {
  if (customElements.get('pii-field')) return;
  class PiiFieldElement extends HTMLElement {
    connectedCallback() {
      if (this.controller) return;
      this.controller = mountPiiField(this, {
        title: this.getAttribute('title') || DEFAULTS.title,
        fieldLabel: this.getAttribute('field-label') || DEFAULTS.fieldLabel,
        cleartextPan: this.getAttribute('cleartext-pan') || DEFAULTS.cleartextPan,
        maskedDisplay: this.getAttribute('masked-display') || DEFAULTS.maskedDisplay,
        recordId: this.getAttribute('record-id') || DEFAULTS.recordId,
        purpose: this.getAttribute('purpose') || DEFAULTS.purpose,
        revealOrigin: this.getAttribute('reveal-origin') || DEFAULTS.revealOrigin,
        revealPath: this.getAttribute('reveal-path') || DEFAULTS.revealPath,
        delegationTokenEndpoint:
          this.getAttribute('delegation-token-endpoint') || DEFAULTS.delegationTokenEndpoint,
        delegationToken: this.getAttribute('delegation-token') || '',
        paintDelayMs: this.getAttribute('paint-delay-ms') || DEFAULTS.paintDelayMs,
      });
    }

    disconnectedCallback() {
      this.controller?.destroy();
      this.controller = null;
    }
  }
  customElements.define('pii-field', PiiFieldElement);
}
