const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const readiness = require('../services/readiness');
const app = require('../app');

test('demo snapshot leaves audit, bounty, and first close open', async () => {
  const snap = await readiness.snapshot();
  assert.equal(snap.demo, true);
  assert.equal(snap.liveOfferingAllowed, false);
  const byId = Object.fromEntries(snap.checks.map((c) => [c.id, c]));
  assert.equal(byId.audit.status, 'open');
  assert.equal(byId.bounty.status, 'open');
  assert.equal(byId['first-close'].status, 'open');
  assert.equal(byId.kyc.status, 'open');
});

test('production startup blockers require jwt, rpc, and factory', () => {
  const prev = {
    APP_ENV: process.env.APP_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    CHAIN_RPC_URL: process.env.CHAIN_RPC_URL,
    PROPERTY_FACTORY_ADDRESS: process.env.PROPERTY_FACTORY_ADDRESS,
    VITE_PROPERTY_FACTORY_ADDRESS: process.env.VITE_PROPERTY_FACTORY_ADDRESS,
  };
  process.env.APP_ENV = 'production';
  delete process.env.JWT_SECRET;
  delete process.env.CHAIN_RPC_URL;
  delete process.env.PROPERTY_FACTORY_ADDRESS;
  delete process.env.VITE_PROPERTY_FACTORY_ADDRESS;
  try {
    const blockers = readiness.startupBlockers();
    assert.ok(blockers.length >= 3);
  } finally {
    if (prev.APP_ENV === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prev.APP_ENV;
    if (prev.JWT_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prev.JWT_SECRET;
    if (prev.CHAIN_RPC_URL === undefined) delete process.env.CHAIN_RPC_URL;
    else process.env.CHAIN_RPC_URL = prev.CHAIN_RPC_URL;
    if (prev.PROPERTY_FACTORY_ADDRESS === undefined) delete process.env.PROPERTY_FACTORY_ADDRESS;
    else process.env.PROPERTY_FACTORY_ADDRESS = prev.PROPERTY_FACTORY_ADDRESS;
    if (prev.VITE_PROPERTY_FACTORY_ADDRESS === undefined) delete process.env.VITE_PROPERTY_FACTORY_ADDRESS;
    else process.env.VITE_PROPERTY_FACTORY_ADDRESS = prev.VITE_PROPERTY_FACTORY_ADDRESS;
  }
});

let server;
let base;

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('health is public; readiness report is admin-only', async () => {
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.status, 'ok');

  const ready = await request('/ready');
  assert.ok([200, 503].includes(ready.status));
  assert.equal(ready.data.demo, true);

  const denied = await request('/api/ops/readiness');
  assert.equal(denied.status, 401);

  const userLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'test1@gmail.com', password: 'pass1234' },
  });
  const forbidden = await request('/api/ops/readiness', { token: userLogin.data.token });
  assert.equal(forbidden.status, 403);

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@defi.estate', password: 'admin1234' },
  });
  const report = await request('/api/ops/readiness', { token: adminLogin.data.token });
  assert.equal(report.status, 200);
  assert.equal(report.data.liveOfferingAllowed, false);
  assert.ok(report.data.checks.some((c) => c.id === 'audit' && c.status === 'open'));
});
