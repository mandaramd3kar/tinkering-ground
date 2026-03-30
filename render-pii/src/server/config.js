const { createHash } = require('node:crypto');

const APP_ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
const REVEAL_ORIGIN = process.env.REVEAL_ORIGIN || 'http://127.0.0.1:3001';
const APP_PORT = Number(new URL(APP_ORIGIN).port || 3000);
const REVEAL_PORT = Number(new URL(REVEAL_ORIGIN).port || 3001);
const SERVER_SECRET = process.env.SERVER_SECRET || 'render-pii-demo-secret';

function deriveKeyMaterial(label) {
  return createHash('sha256').update(`${SERVER_SECRET}:${label}`).digest();
}

module.exports = {
  APP_ORIGIN,
  REVEAL_ORIGIN,
  APP_PORT,
  REVEAL_PORT,
  SERVER_SECRET,
  deriveKeyMaterial,
};
