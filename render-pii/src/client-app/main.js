import { definePiiFieldElement, mountPiiField } from './pii-field.js';

definePiiFieldElement();

const config = window.__PII_DEMO_CONFIG__ || {};
const root = document.querySelector('#demo');

if (root) {
  const fields = [
    {
      title: 'PAN',
      fieldLabel: '4111 1111 1111 1111',
      cleartextPan: '4111 1111 1111 1111',
      maskedDisplay: '**** **** **** 1111',
      recordId: '11111111-1111-1111-1111-111111111111',
      purpose: 'VIEW_OWN_DATA',
    },
  ];

  root.innerHTML = '';
  for (const field of fields) {
    const host = document.createElement('section');
    host.className = 'demo-card';
    root.append(host);
    mountPiiField(host, {
      ...field,
      revealOrigin: config.revealOrigin || 'http://127.0.0.1:3001',
      revealPath: config.revealPath || '/src/client-reveal/reveal-frame.html',
      delegationTokenEndpoint:
        config.delegationTokenEndpoint || '/api/pii/delegation-token',
    });
  }
}
