const crypto = require('node:crypto');
const { createCipheriv, createDecipheriv, createHash } = crypto;
const { APP_ORIGIN, REVEAL_ORIGIN, deriveKeyMaterial } = require('./config');

const MASTER_KEY = deriveKeyMaterial('vault-kek');
const DEMO_USER = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'demo.user@example.com',
  displayName: 'Demo User',
  credential: 'demo-password',
  revealScopes: ['reveal:PAN'],
};

const DEMO_RECORD = {
  id: '11111111-1111-1111-1111-111111111111',
  customerId: DEMO_USER.id,
  piiType: 'PAN',
  maskedDisplay: '**** **** **** 1234',
  panFormat: '4-4-4-4',
};

function sealPan(pan) {
  const dek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const ciphertext = Buffer.concat([cipher.update(pan, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const wrap = createCipheriv('aes-256-gcm', MASTER_KEY, Buffer.alloc(12, 0));
  const wrappedDek = Buffer.concat([wrap.update(dek), wrap.final()]);
  const wrappedTag = wrap.getAuthTag();
  dek.fill(0);

  return { ciphertext, iv, authTag, wrappedDek, wrappedTag };
}

function unsealPan(record) {
  const unwrap = createDecipheriv('aes-256-gcm', MASTER_KEY, Buffer.alloc(12, 0));
  unwrap.setAuthTag(record.wrappedTag);
  const dek = Buffer.concat([unwrap.update(record.wrappedDek), unwrap.final()]);

  const decipher = createDecipheriv('aes-256-gcm', dek, record.iv);
  decipher.setAuthTag(record.authTag);
  const pan = Buffer.concat([decipher.update(record.ciphertext), decipher.final()]).toString('utf8');
  dek.fill(0);
  return pan;
}

const state = {
  users: new Map([[DEMO_USER.id, DEMO_USER]]),
  records: new Map(),
  appSessions: new Map(),
  delegationTokens: new Map(),
  revealSessions: new Map(),
  stepUpTokens: new Map(),
  revealTokens: new Map(),
  revealRateWindows: new Map(),
  auditRows: [],
  auditKey: createHash('sha256').update('render-pii-demo-audit').digest(),
};

state.records.set(DEMO_RECORD.id, {
  ...DEMO_RECORD,
  ...sealPan('4111111111111111'),
});

function now() {
  return Date.now();
}

function issueAppSession() {
  const token = crypto.randomUUID();
  const session = {
    token,
    sessionId: crypto.randomUUID(),
    userId: DEMO_USER.id,
    origin: APP_ORIGIN,
    scopes: [...DEMO_USER.revealScopes],
    expiresAt: now() + 60 * 60 * 1000,
  };
  state.appSessions.set(token, session);
  return session;
}

function getAppSession(token) {
  const session = state.appSessions.get(token);
  if (!session || session.expiresAt <= now()) return null;
  return session;
}

function issueDelegationToken(appSession) {
  const token = crypto.randomUUID();
  state.delegationTokens.set(token, {
    token,
    sessionId: appSession.sessionId,
    userId: appSession.userId,
    expiresAt: now() + 60 * 1000,
    consumedAt: null,
  });
  return token;
}

function consumeDelegationToken(token) {
  const entry = state.delegationTokens.get(token);
  if (!entry || entry.consumedAt || entry.expiresAt <= now()) return null;
  entry.consumedAt = now();
  return entry;
}

function issueRevealSession(delegation) {
  const token = crypto.randomUUID();
  const session = {
    token,
    sessionId: delegation.sessionId,
    userId: delegation.userId,
    origin: REVEAL_ORIGIN,
    scopes: [...DEMO_USER.revealScopes],
    expiresAt: now() + 60 * 60 * 1000,
  };
  state.revealSessions.set(token, session);
  return session;
}

function getRevealSession(token) {
  const session = state.revealSessions.get(token);
  if (!session || session.expiresAt <= now()) return null;
  return session;
}

function issueStepUpToken({ revealSession, recordId }) {
  const token = crypto.randomUUID();
  const entry = {
    token,
    userId: revealSession.userId,
    sessionId: revealSession.sessionId,
    recordId,
    origin: REVEAL_ORIGIN,
    expiresAt: now() + 5 * 60 * 1000,
    consumedAt: null,
  };
  state.stepUpTokens.set(token, entry);
  return entry;
}

function consumeStepUpToken(token, recordId, origin) {
  const entry = state.stepUpTokens.get(token);
  if (!entry || entry.consumedAt || entry.expiresAt <= now()) return null;
  if (entry.recordId !== recordId || entry.origin !== origin) return null;
  entry.consumedAt = now();
  return entry;
}

function issueRevealToken({ revealSession, recordId }) {
  const token = crypto.randomUUID();
  const entry = {
    token,
    userId: revealSession.userId,
    sessionId: revealSession.sessionId,
    recordId,
    status: 'ACTIVE',
    createdAt: now(),
    expiresAt: now() + 30 * 1000,
  };
  state.revealTokens.set(token, entry);
  return entry;
}

function allowReveal(userId, recordId) {
  const key = `${userId}:${recordId}`;
  const cutoff = now() - 60 * 1000;
  const recent = (state.revealRateWindows.get(key) || []).filter((ts) => ts >= cutoff);
  if (recent.length >= 3) {
    state.revealRateWindows.set(key, recent);
    return false;
  }
  recent.push(now());
  state.revealRateWindows.set(key, recent);
  return true;
}

function hideRevealToken(token) {
  const entry = state.revealTokens.get(token);
  if (!entry || entry.status !== 'ACTIVE') return null;
  entry.status = 'HIDDEN';
  entry.hiddenAt = now();
  return entry;
}

function sweepTokens() {
  const expiredReveal = [];
  for (const entry of state.revealTokens.values()) {
    if (entry.status === 'ACTIVE' && entry.expiresAt <= now()) {
      entry.status = 'EXPIRED';
      expiredReveal.push(entry);
    }
  }

  for (const [token, entry] of state.delegationTokens.entries()) {
    if (entry.expiresAt <= now() || entry.consumedAt) state.delegationTokens.delete(token);
  }
  for (const [token, entry] of state.revealSessions.entries()) {
    if (entry.expiresAt <= now()) state.revealSessions.delete(token);
  }
  for (const [token, entry] of state.stepUpTokens.entries()) {
    if (entry.expiresAt <= now() || entry.consumedAt) state.stepUpTokens.delete(token);
  }

  return expiredReveal;
}

module.exports = {
  state,
  DEMO_USER,
  DEMO_RECORD,
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
};
