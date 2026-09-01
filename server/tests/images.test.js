const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const app = require('../app');
const { DEFAULT_PHOTO } = require('../services/imageService');

const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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

async function request(path, { method = 'GET', body, token, raw = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function adminToken() {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@defi.estate', password: 'admin1234' },
  });
  return login.data.token;
}

test('landing hero is served from the image service', async () => {
  const res = await request('/api/images/seed/hero.jpg', { raw: true });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /jpeg/i);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  assert.ok(bytes.length > 10_000);
});

test('seed listings keep photography URLs, not generated SVGs', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'test1@gmail.com', password: 'pass1234' },
  });
  const list = await request('/api/properties', { token: login.data.token });
  assert.equal(list.status, 200);
  const first = list.data.properties.find((p) => p.id === '1') || list.data.properties[0];
  assert.match(first.imageUrl, /^https:\/\/images\.unsplash\.com\//);
  assert.doesNotMatch(first.imageUrl, /\.svg(\?|$)/);
});

test('missing and traversal image paths 404', async () => {
  const missing = await request('/api/images/missing.png');
  assert.equal(missing.status, 404);
  const traversal = await request('/api/images/../app.js');
  assert.equal(traversal.status, 404);
});

test('investors cannot upload listing images', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'test1@gmail.com', password: 'pass1234' },
  });
  const denied = await request('/api/images', {
    method: 'POST',
    token: login.data.token,
    body: { filename: 'dot.png', data: PNG_B64 },
  });
  assert.equal(denied.status, 403);
});

test('admin can upload a listing image and fetch it', async () => {
  const token = await adminToken();
  const created = await request('/api/images', {
    method: 'POST',
    token,
    body: { filename: 'dot.png', data: PNG_B64 },
  });
  assert.equal(created.status, 201);
  assert.match(created.data.url, /^\/api\/images\/.+\.png$/);
  assert.equal(created.data.contentType, 'image/png');

  const res = await request(created.data.url, { raw: true });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /png/i);
});

test('new catalog rows default to a photography URL', async () => {
  const token = await adminToken();
  const created = await request('/api/properties', {
    method: 'POST',
    token,
    body: { title: `Image listing ${Date.now()}`, location: 'Austin, TX', price: 100000, totalTokens: 1000 },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.property.imageUrl, DEFAULT_PHOTO);
  await request(`/api/properties/${created.data.property.id}`, { method: 'DELETE', token });
});

test('scripted SVG uploads are rejected', async () => {
  const token = await adminToken();
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
  const blocked = await request('/api/images', {
    method: 'POST',
    token,
    body: { filename: 'x.svg', data: svg },
  });
  assert.equal(blocked.status, 400);
});

test('local image ingest is blocked', async () => {
  const token = await adminToken();
  const blocked = await request('/api/images', {
    method: 'POST',
    token,
    body: { sourceUrl: 'http://127.0.0.1:4000/health' },
  });
  assert.equal(blocked.status, 400);
});
