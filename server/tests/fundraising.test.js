const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const persistence = { data: {}, saves: 0, save() { this.saves++; } };
require.cache[require.resolve('../mock/persistence')] = { exports: persistence };
const service = require('../services/fundraisingService');
const input = (overrides = {}) => ({ propertyId: 'p1', name: 'Investor', email: 'investor@example.com', stage: 'interested', amount: '1250.50', followUpDate: '2027-01-12', notes: 'Requested financials', ...overrides });

beforeEach(() => {
  persistence.saves = 0;
  persistence.data = {
    users: [{ id: 1, role: 'owner', cashCents: 10000 }, { id: 2, role: 'owner' }, { id: 3, role: 'admin' }, { id: 4, role: 'user' }],
    properties: [
      { id: 'p1', title: 'First property', ownerId: 1, offering: { campaign: { target: 10000, raised: 2000, deadline: '2027-01-31', status: 'open', pledges: [{ userId: 4, amount: 2000 }] } } },
      { id: 'p2', title: 'Other owner property', ownerId: 2 },
    ],
  };
});

test('pipeline interest and signed commitments never credit funding, cash, or shares', () => {
  const before = structuredClone({ users: persistence.data.users, properties: persistence.data.properties });
  const created = service.save(1, input()).prospects[0];
  assert.equal(created.amountCents, 125050);
  assert.equal(created.version, 1);
  const next = service.save(1, input({ version: 1, stage: 'signed', documentReference: 'Subscription-001' }), created.id);
  assert.equal(next.prospects[0].stage, 'signed');
  assert.equal(next.properties[0].campaign.received, 2000);
  assert.deepEqual({ users: persistence.data.users, properties: persistence.data.properties }, before);
  assert.equal(persistence.saves, 2);
});

test('owners see only their properties and prospect data; admins can inspect both', () => {
  service.save(1, input());
  const other = service.save(2, input({ propertyId: 'p2', email: 'private@example.com', notes: 'Private' }));
  assert.equal(other.prospects.length, 1);
  const own = service.snapshot(1);
  assert.equal(own.properties.length, 1);
  assert.ok(!JSON.stringify(own).includes('private@example.com'));
  assert.ok(!JSON.stringify(own).includes('pledges'));
  assert.equal(service.snapshot(3).prospects.length, 2);
  assert.throws(() => service.save(1, input({ propertyId: 'p2' })), { status: 404 });
  assert.throws(() => service.save(1, input({ version: 1 }), other.prospects[0].id), { status: 404 });
});

test('investors, missing accounts, and restricted operators cannot read or write prospects', () => {
  assert.throws(() => service.snapshot(4), { status: 403 });
  assert.throws(() => service.save(4, input()), { status: 403 });
  assert.throws(() => service.snapshot(999), { status: 401 });
  persistence.data.users[0].suspended = true;
  assert.throws(() => service.snapshot(1), { status: 403 });
  persistence.data.users[2].restricted = true;
  assert.throws(() => service.save(3, input()), { status: 403 });
});

test('invalid money, dates, stages and unsigned commitments fail without saving', () => {
  for (const override of [
    { amount: 0 }, { amount: -1 }, { amount: '1.001' }, { amount: 'NaN' }, { amount: Infinity }, { amount: 1000000001 },
    { followUpDate: '2027-02-29' }, { followUpDate: '2027-13-01' }, { followUpDate: 'tomorrow' },
    { stage: 'received' }, { stage: 'signed' }, { email: 'bad' }, { name: '' }, { notes: 'x'.repeat(2001) },
  ]) assert.throws(() => service.save(1, input(override)), { status: 400 });
  assert.equal(persistence.saves, 0);
  assert.equal(service.snapshot(1).prospects.length, 0);
});

test('duplicate contacts are rejected per property, including case differences', () => {
  const first = service.save(1, input()).prospects[0];
  assert.throws(() => service.save(1, input({ email: ' INVESTOR@EXAMPLE.COM ' })), { status: 409 });
  service.save(2, input({ propertyId: 'p2' }));
  assert.equal(service.snapshot(3).prospects.length, 2);
  service.save(1, input({ version: first.version }), first.id);
  assert.equal(service.snapshot(1).prospects.length, 1);
});

test('edits preserve attributed history and reject stale writes without overwriting', () => {
  const first = structuredClone(service.save(1, input()).prospects[0]);
  service.save(3, input({ version: 1, stage: 'signed', documentReference: 'Signed-v1', notes: 'Countersigned' }), first.id);
  assert.throws(() => service.save(1, input({ version: 1, notes: 'Stale' }), first.id), { status: 409 });
  const saved = service.snapshot(1).prospects[0];
  assert.equal(saved.version, 2);
  assert.equal(saved.history.length, 2);
  assert.equal(saved.history[0].notes, 'Requested financials');
  assert.equal(saved.history[1].actorId, '3');
  assert.equal(saved.notes, 'Countersigned');
  service.save(1, input({ version: 2, stage: 'withdrawn', notes: 'Investor declined' }), first.id);
  assert.equal(service.snapshot(1).prospects[0].history.length, 3);
});

test('authenticated HTTP routes create, update and reload persisted prospects', async () => {
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const app = express();
  app.use(express.json());
  app.use('/api/fundraising', require('../routes/fundraising'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/fundraising`;
    assert.equal((await fetch(base)).status, 401);
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ sub: '1' }, process.env.JWT_SECRET || 'jwt_secret')}` };
    const created = await fetch(`${base}/prospects`, { method: 'POST', headers, body: JSON.stringify(input()) });
    assert.equal(created.status, 201);
    const row = (await created.json()).prospects[0];
    const updated = await fetch(`${base}/prospects/${row.id}`, { method: 'PATCH', headers, body: JSON.stringify(input({ version: 1, stage: 'signed', documentReference: 'Agreement-1' })) });
    assert.equal(updated.status, 200);
    const reloaded = await (await fetch(base, { headers })).json();
    assert.equal(reloaded.prospects[0].stage, 'signed');
    assert.equal(reloaded.properties[0].campaign.received, 2000);
    assert.equal(persistence.saves, 2);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
