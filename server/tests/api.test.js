const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const app = require('../app');

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

async function request(path, { method = 'GET', body, token, forwardedFor } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (forwardedFor) headers['X-Forwarded-For'] = forwardedFor;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('rejects login with wrong password', async () => {
  const { status, data } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'test1@gmail.com', password: 'wrong-password' },
  });
  assert.equal(status, 401);
  assert.equal(data.error, 'Invalid credentials');
});

test('rejects login for unknown user', async () => {
  const { status } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'nobody@example.com', password: 'pass1234' },
  });
  assert.equal(status, 401);
});

test('issues a JWT for the seed user', async () => {
  const { status, data } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'test1@gmail.com', password: 'pass1234' },
  });
  assert.equal(status, 200);
  assert.ok(data.token);
  assert.equal(data.user.email, 'test1@gmail.com');
});

test('rejects login from an IP that is not on the allowlist', async () => {
  const { status, data } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'test1@gmail.com', password: 'pass1234' },
    forwardedFor: '203.0.113.50',
  });
  assert.equal(status, 403);
  assert.match(data.error || '', /not allowed to log in/i);
  assert.equal(data.token, undefined);
});

test('allows login from an IP listed in ALLOWED_LOGIN_IPS', async () => {
  const previous = process.env.ALLOWED_LOGIN_IPS;
  process.env.ALLOWED_LOGIN_IPS = '203.0.113.50,198.51.100.22';
  try {
    const { status, data } = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'test1@gmail.com', password: 'pass1234' },
      forwardedFor: '203.0.113.50',
    });
    assert.equal(status, 200);
    assert.ok(data.token);
  } finally {
    if (previous === undefined) delete process.env.ALLOWED_LOGIN_IPS;
    else process.env.ALLOWED_LOGIN_IPS = previous;
  }
});

test('properties require a bearer token', async () => {
  const { status } = await request('/api/properties');
  assert.equal(status, 401);
});

test('authenticated user can list and fetch a property', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'test1@gmail.com', password: 'pass1234' },
  });
  const token = login.data.token;

  const me = await request('/api/auth/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.email, 'test1@gmail.com');

  const list = await request('/api/properties', { token });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.data.properties));
  assert.ok(list.data.properties.length >= 1);

  const first = list.data.properties[0];
  const one = await request(`/api/properties/${first.id}`, { token });
  assert.equal(one.status, 200);
  assert.equal(one.data.property.id, first.id);
});

test('shop leftover routes are gone', async () => {
  const { status } = await request('/api/data/cryptos');
  assert.equal(status, 404);
});

test('KYC submit, admin review, and wallet bind', async () => {
  const email = `kyc-${Date.now()}@example.com`;
  const password = 'pass1234';
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: { email, password, username: 'Kyc User' },
  });
  assert.equal(registered.status, 201);

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.kycStatus, 'unverified');
  const token = login.data.token;
  const userId = login.data.user.id;

  const denied = await request('/api/kyc/admin/investors', { token });
  assert.equal(denied.status, 403);

  const incomplete = await request('/api/kyc', {
    method: 'POST',
    token,
    body: { legalName: 'Kyc User', country: 'US', accredited: false, attested: true },
  });
  assert.equal(incomplete.status, 400);

  const blocked = await request('/api/kyc', {
    method: 'POST',
    token,
    body: { legalName: 'Kyc User', country: 'KP', accredited: true, attested: true },
  });
  assert.equal(blocked.status, 400);

  const submitted = await request('/api/kyc', {
    method: 'POST',
    token,
    body: { legalName: 'Kyc User', country: 'US', accredited: true, attested: true },
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.data.user.kycStatus, 'pending');
  assert.equal(submitted.data.eligibility.canInvest, false);

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@defi.estate', password: 'admin1234' },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.data.token;

  const reviewed = await request(`/api/kyc/admin/${userId}/review`, {
    method: 'POST',
    token: adminToken,
    body: { decision: 'approved' },
  });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.data.user.kycStatus, 'approved');

  const walletAddr = `0x${Date.now().toString(16).padStart(40, '0').slice(-40)}`;
  const wallet = await request('/api/kyc/wallet', {
    method: 'POST',
    token,
    body: { address: walletAddr },
  });
  assert.equal(wallet.status, 200);
  assert.equal(wallet.data.eligibility.canInvest, true);

  const otherEmail = `kyc2-${Date.now()}@example.com`;
  await request('/api/auth/register', {
    method: 'POST',
    body: { email: otherEmail, password, username: 'Other' },
  });
  const otherLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: otherEmail, password },
  });
  const conflict = await request('/api/kyc/wallet', {
    method: 'POST',
    token: otherLogin.data.token,
    body: { address: walletAddr },
  });
  assert.equal(conflict.status, 409);
});

test('admin can create, patch, and delete a property', async () => {
  const userLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'test1@gmail.com', password: 'pass1234' },
  });
  const denied = await request('/api/properties', {
    method: 'POST',
    token: userLogin.data.token,
    body: { title: 'Nope', location: 'Austin, TX', price: 100000, totalTokens: 1000 },
  });
  assert.equal(denied.status, 403);

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@defi.estate', password: 'admin1234' },
  });
  const adminToken = adminLogin.data.token;

  const created = await request('/api/properties', {
    method: 'POST',
    token: adminToken,
    body: {
      title: `Test Listing ${Date.now()}`,
      location: 'Austin, TX',
      description: 'Admin-created catalog row.',
      price: 500000,
      totalTokens: 1000,
      returnRate: 8.1,
      occupancyPercent: 94,
      capRate: 6.2,
      rentRollExcerpt: 'Stabilized NNN tenants on 5-year leases.',
      grossRentMonthly: 2800,
      opexMonthly: 700,
      reservesMonthly: 150,
      lat: 30.2672,
      lng: -97.7431,
      unitMix: '1× 2,000 sq ft retail',
      comps: [{ address: '100 Congress Ave, Austin, TX', soldDate: '2026-01-15', priceUsd: 490000, sqft: 1900, note: 'Illustrative' }],
      documents: [{ name: 'PPM', url: 'https://example.com/ppm.pdf' }],
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.property.status, 'Coming Soon');
  assert.equal(created.data.property.sharePriceUsdc, 500);
  assert.equal(created.data.property.grossRentMonthly, 2800);
  assert.equal(created.data.property.lat, 30.2672);
  assert.equal(created.data.property.unitMix, '1× 2,000 sq ft retail');
  assert.equal(created.data.property.comps.length, 1);
  const id = created.data.property.id;

  const patched = await request(`/api/properties/${id}`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      status: 'Available',
      tokenAddress: '0x1111111111111111111111111111111111111111',
      offeringAddress: '0x2222222222222222222222222222222222222222',
      occupancyPercent: 91,
      nextAppraisalAt: '2026-12-01',
      appraisals: [{ date: '2026-06-01', valueUsd: 520000, note: 'Desktop' }],
      lat: 30.27,
      lng: -97.74,
      comps: [{ address: '200 Congress Ave, Austin, TX', soldDate: '2026-04-01', priceUsd: 505000, sqft: 1950 }],
    },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.data.property.status, 'Available');
  assert.equal(patched.data.property.offeringAddress, '0x2222222222222222222222222222222222222222');
  assert.equal(patched.data.property.occupancyPercent, 91);
  assert.equal(patched.data.property.appraisals[0].valueUsd, 520000);
  assert.equal(patched.data.property.lat, 30.27);
  assert.equal(patched.data.property.comps[0].priceUsd, 505000);

  const removed = await request(`/api/properties/${id}`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert.equal(removed.status, 200);
  const missing = await request(`/api/properties/${id}`, { token: adminToken });
  assert.equal(missing.status, 404);
});
