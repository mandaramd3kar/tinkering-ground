const AUDIT_URL = '/api/pii/audit';

function toPayload(eventName, detail = {}) {
  return {
    event_name: eventName,
    event_time: new Date().toISOString(),
    source: 'CLIENT',
    ...detail,
  };
}

export function emitAuditEvent(eventName, detail = {}) {
  const payload = JSON.stringify(toPayload(eventName, detail));
  const body = new Blob([payload], { type: 'application/json' });

  if (navigator.sendBeacon && navigator.sendBeacon(AUDIT_URL, body)) {
    return true;
  }

  void fetch(AUDIT_URL, {
    method: 'POST',
    body: payload,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    keepalive: true,
  }).catch(() => {});

  return false;
}
