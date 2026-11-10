const { randomUUID } = require('crypto');
const persistence = require('../mock/persistence');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

function operator(userId) {
  const user = persistence.data.users.find((row) => String(row.id) === String(userId));
  if (!user) fail('Unauthorized.', 401);
  if (!['owner', 'admin'].includes(user.role) || user.suspended || user.restricted) fail('Active owner or admin access required.', 403);
  return user;
}
function visible(user, property) { return user.role === 'admin' || String(property.ownerId) === String(user.id); }
function propertyFor(user, id) {
  const property = persistence.data.properties.find((row) => String(row.id) === String(id) && visible(user, row));
  if (!property) fail('Property not found.', 404);
  return property;
}
function text(value, label, max, required = false) {
  if (value != null && typeof value !== 'string') fail(`${label} must be text.`);
  const result = (value || '').trim();
  if ((required && !result) || result.length > max) fail(`${label} ${required ? 'is required and ' : ''}must be at most ${max} characters.`);
  return result;
}
function fields(input) {
  const name = text(input.name, 'Investor name', 120, true);
  const email = text(input.email, 'Email', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid investor email.');
  const stage = input.stage;
  if (!['interested', 'signed', 'withdrawn'].includes(stage)) fail('Choose interested, signed, or withdrawn.');
  if (!['string', 'number'].includes(typeof input.amount) || !/^\d+(\.\d{1,2})?$/.test(String(input.amount))) fail('Enter a positive USD amount with at most two decimals.');
  const amountCents = Math.round(Number(input.amount) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100_000_000_000) fail('Amount must be between $0.01 and $1 billion.');
  const documentReference = text(input.documentReference, 'Signed document reference', 300);
  if (stage === 'signed' && !documentReference) fail('A signed commitment requires a document reference.');
  const followUpDate = text(input.followUpDate, 'Follow-up date', 10);
  if (followUpDate && (!/^\d{4}-\d{2}-\d{2}$/.test(followUpDate) || !Number.isFinite(Date.parse(followUpDate)) || new Date(followUpDate).toISOString().slice(0, 10) !== followUpDate)) fail('Enter a valid follow-up date.');
  return { name, email, stage, amountCents, documentReference, followUpDate, notes: text(input.notes, 'Notes', 2000) };
}
function snapshot(userId) {
  const user = operator(userId);
  const properties = persistence.data.properties.filter((row) => visible(user, row));
  const ids = new Set(properties.map((row) => String(row.id)));
  return {
    properties: properties.map((row) => ({ id: String(row.id), title: row.title, campaign: row.offering?.campaign ? {
      target: row.offering.campaign.target, received: row.offering.campaign.raised || 0,
      deadline: row.offering.campaign.deadline, status: row.offering.campaign.status,
    } : null })),
    prospects: (persistence.data.fundraisingProspects || []).filter((row) => ids.has(row.propertyId)),
  };
}
function save(userId, input, id) {
  const user = operator(userId);
  const rows = persistence.data.fundraisingProspects || [];
  const existing = id ? rows.find((row) => row.id === id) : null;
  if (id && !existing) fail('Prospect not found.', 404);
  const property = propertyFor(user, existing ? existing.propertyId : input.propertyId);
  if (existing && input.version !== existing.version) fail('This prospect changed. Refresh and reopen it before saving again.', 409);
  const next = fields(input);
  if (rows.some((row) => row.id !== id && row.propertyId === String(property.id) && row.email === next.email)) fail('This investor already has a prospect record for this property.', 409);
  const now = new Date().toISOString();
  const history = { ...next, at: now, actorId: String(userId) };
  if (existing) {
    Object.assign(existing, next, { updatedAt: now, version: existing.version + 1 });
    existing.history.push(history);
  } else {
    rows.unshift({ id: randomUUID(), propertyId: String(property.id), ...next, createdAt: now, updatedAt: now, version: 1, history: [history] });
    persistence.data.fundraisingProspects = rows;
  }
  persistence.save();
  return snapshot(userId);
}
module.exports = { snapshot, save };
