import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { makeServer } from '../src/server.js';

test('Anna origin allowlist permits preflight but never bypasses authentication', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exceptionos-cors-'));
  const server = makeServer({ dbFile: path.join(dir, 'db.sqlite'), allowedOrigins: ['http://localhost:5180'] });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/cases`;
  try {
    const preflight = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5180', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5180');
    const anonymous = await fetch(url, { headers: { Origin: 'http://localhost:5180' } });
    assert.equal(anonymous.status, 401);
    for (const origin of ['null', 'https://evil.example', 'http://localhost:5181']) {
      const denied = await fetch(url, { method: 'OPTIONS', headers: { Origin: origin } });
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get('access-control-allow-origin'), null);
    }
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); }
});
