const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const persistence = require('../mock/persistence');
const { indexWallet, taxPack, taxCsv } = require('../services/activityIndex');
const activityService = require('../services/activityService');
const app = require('../app');

const WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function event(partial) {
  return {
    id: partial.id,
    type: partial.type,
    propertyId: partial.propertyId || '1',
    wallet: (partial.wallet || WALLET).toLowerCase(),
    counterparty: partial.counterparty || null,
    shares: String(partial.shares ?? '0'),
    usdc: String(partial.usdc ?? '0'),
    txHash: partial.txHash || `0x${partial.id}`,
    logIndex: partial.logIndex || 0,
    blockNumber: partial.blockNumber || 1,
    timestamp: partial.timestamp || 1_703_000_000,
  };
}

test('average cost basis tracks buys, rent, and redemption', () => {
  const indexed = indexWallet(
    [
      event({ id: '1', type: 'buy', shares: 4, usdc: 4_000_000, blockNumber: 1 }),
      event({ id: '2', type: 'claim', usdc: 500_000, blockNumber: 2 }),
      event({ id: '3', type: 'redeem', shares: 2, usdc: 3_000_000, blockNumber: 3 }),
      event({ id: '4', type: 'buy', wallet: OTHER, shares: 8, usdc: 8_000_000, blockNumber: 1 }),
    ],
    WALLET,
    { 1: 'Downtown Apt' }
  );
  assert.equal(indexed.events.length, 3);
  assert.equal(indexed.holdings.length, 1);
  assert.equal(indexed.holdings[0].shares, 2);
  assert.equal(indexed.holdings[0].costUsdc, 2);
  assert.equal(indexed.holdings[0].rentClaimedUsdc, 0.5);
  assert.equal(indexed.holdings[0].redeemProceedsUsdc, 3);
});

test('P2P transfer adds shares at zero basis; fill sell realizes proceeds', () => {
  const indexed = indexWallet(
    [
      event({ id: '1', type: 'buy', shares: 10, usdc: 10_000_000, blockNumber: 1 }),
      event({ id: '2', type: 'transfer_in', shares: 2, blockNumber: 2 }),
      event({ id: '3', type: 'fill_sell', shares: 6, usdc: 9_000_000, blockNumber: 3 }),
    ],
    WALLET
  );
  const row = indexed.holdings[0];
  assert.equal(row.shares, 6);
  assert.equal(Number(row.costUsdc.toFixed(6)), 5);
  assert.equal(row.secondaryProceedsUsdc, 9);
});

test('tax pack CSV is labeled as a demo worksheet', () => {
  activityService.mergeEvents([
    event({
      id: `tax-${Date.now()}`,
      type: 'buy',
      shares: 1,
      usdc: 1_000_000,
      timestamp: Date.UTC(2026, 5, 1) / 1000,
    }),
  ]);
  const pack = taxPack(persistence.data.activity.events, WALLET, 2026, { 1: 'Downtown Apt' });
  const csv = taxCsv(pack);
  assert.match(pack.disclaimer, /not a Schedule K-1/i);
  assert.match(csv, /Demo tax worksheet/);
  assert.match(csv, /ending-position/);
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
  return { status: res.status, data, headers: res.headers };
}

test('activity and vault require auth; seed deed downloads after login', async () => {
  const denied = await request('/api/activity');
  assert.equal(denied.status, 401);

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'test1@gmail.com', password: 'pass1234' },
  });
  const token = login.data.token;
  const noWallet = await request('/api/activity', { token });
  assert.equal(noWallet.status, 400);

  const list = await request('/api/properties', { token });
  const property = list.data.properties.find((p) => p.id === '1') || list.data.properties[0];
  const deed = (property.documents || []).find((d) => /deed/i.test(d.name)) || property.documents[0];
  assert.ok(deed.url.startsWith('/api/vault/'));
  assert.notEqual(deed.url, '#');

  const file = await fetch(`${base}${deed.url}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(file.status, 200);
  const bytes = Buffer.from(await file.arrayBuffer());
  assert.match(bytes.slice(0, 5).toString(), /%PDF/);
});

test('admin can upload and delete a vault file', async () => {
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@defi.estate', password: 'admin1234' },
  });
  const adminToken = adminLogin.data.token;
  const created = await request('/api/properties', {
    method: 'POST',
    token: adminToken,
    body: {
      title: `Vault ${Date.now()}`,
      location: 'Austin, TX',
      price: 100000,
      totalTokens: 100,
    },
  });
  assert.equal(created.status, 201);
  const id = created.data.property.id;
  const pdf = Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n').toString('base64');
  const uploaded = await request(`/api/properties/${id}/documents`, {
    method: 'POST',
    token: adminToken,
    body: { name: 'Insurance', filename: 'insurance.pdf', data: pdf },
  });
  assert.equal(uploaded.status, 201);
  const docs = uploaded.data.property.documents;
  const insurance = docs.find((d) => d.name === 'Insurance');
  assert.ok(insurance);
  const index = docs.findIndex((d) => d.name === 'Insurance');
  const removed = await request(`/api/properties/${id}/documents/${index}`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.data.property.documents.some((d) => d.name === 'Insurance'), false);
  await request(`/api/properties/${id}`, { method: 'DELETE', token: adminToken });
});
