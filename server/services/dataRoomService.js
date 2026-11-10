const { randomUUID, createHash } = require('crypto');
const persistence = require('../mock/persistence');
const vault = require('./vaultService');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const PRIVATE_PREFIX = 'private-room-';

function text(value, label, max, required = false) {
  if (value != null && typeof value !== 'string') fail(`${label} must be text.`);
  const result = (value || '').trim();
  if ((required && !result) || result.length > max) fail(`${label} ${required ? 'is required and ' : ''}must be at most ${max} characters.`);
  return result;
}
function account(id) {
  const user = persistence.data.users.find((row) => String(row.id) === String(id));
  if (!user) fail('Unauthorized.', 401);
  if (user.suspended || user.restricted) fail('This account is restricted.', 403);
  return user;
}
function emptyRoom(id) { return { propertyId: String(id), version: 0, accessMode: 'invited', invitedUserIds: [], documents: [], questions: [], history: [] }; }
function context(userId, propertyId, { manager = false, access = true } = {}) {
  const user = account(userId);
  const property = persistence.data.properties.find((row) => String(row.id) === String(propertyId));
  if (!property) fail('Property not found.', 404);
  const room = (persistence.data.propertyDataRooms || []).find((row) => row.propertyId === String(property.id)) || emptyRoom(property.id);
  const canManage = user.role === 'admin' || (user.role === 'owner' && String(property.ownerId) === String(user.id));
  const hasAccess = canManage || (['user', 'institution'].includes(user.role) && user.kycStatus === 'approved'
    && (room.accessMode === 'verified' || room.invitedUserIds.includes(String(user.id))));
  if (manager && !canManage) fail('Only this property’s owner or an admin can manage its data room.', 403);
  if (access && !hasAccess) fail('Verified investor access and a data room invitation are required.', 403);
  return { user, property, room, canManage, hasAccess };
}
function version(row, expected) {
  if (!Number.isSafeInteger(expected) || expected !== row.version) fail('This record changed. Refresh and reopen it before saving again.', 409);
}
function record(room, userId, action, reference) {
  room.version++;
  room.history.push({ at: new Date().toISOString(), actorId: String(userId), action, reference });
  if (!persistence.data.propertyDataRooms) persistence.data.propertyDataRooms = [];
  if (!persistence.data.propertyDataRooms.includes(room)) persistence.data.propertyDataRooms.push(room);
  persistence.save();
}
function snapshot(userId, propertyId) {
  const ctx = context(userId, propertyId, { access: false });
  const { room, user, canManage, hasAccess } = ctx;
  const base = { propertyId: String(ctx.property.id), propertyTitle: ctx.property.title, canManage, hasAccess };
  if (!hasAccess) return { ...base, reason: user.kycStatus !== 'approved' ? 'Complete identity verification to request access.' : 'This data room is available by invitation. Contact the property owner.' };
  return { ...base, version: room.version, accessMode: room.accessMode,
    invitations: canManage ? room.invitedUserIds.map((id) => {
      const invitee = persistence.data.users.find((row) => String(row.id) === id);
      return { id, email: invitee?.email || 'Unavailable account' };
    }) : undefined,
    documents: room.documents.filter((doc) => canManage || (!doc.archived && doc.visibility === 'investors')).map((doc) => ({
      id: doc.id, title: doc.title, category: doc.category, visibility: doc.visibility, archived: doc.archived,
      versions: doc.versions.map(({ file: _file, ...entry }) => entry),
    })),
    questions: room.questions.filter((question) => canManage || question.userId === String(userId)).map((question) => ({
      ...question, investorName: persistence.data.users.find((row) => String(row.id) === question.userId)?.name || 'Investor',
    })),
    history: canManage ? room.history : undefined,
  };
}
function settings(userId, propertyId, input) {
  const { room } = context(userId, propertyId, { manager: true }); version(room, input.version);
  if (!['invited', 'verified'].includes(input.accessMode)) fail('Choose invited investors or all verified investors.');
  if (!Array.isArray(input.emails) || input.emails.length > 100) fail('Enter at most 100 investor emails.');
  const ids = input.emails.map((value) => {
    const email = text(value, 'Email', 254, true).toLowerCase();
    const user = persistence.data.users.find((row) => row.email?.toLowerCase() === email && ['user', 'institution'].includes(row.role));
    if (!user) fail('Every invitation must use an existing investor account email.');
    if (user.suspended || user.restricted) fail('Restricted accounts cannot be invited.');
    return String(user.id);
  });
  room.accessMode = input.accessMode; room.invitedUserIds = [...new Set(ids)];
  record(room, userId, 'access_updated', room.accessMode);
  return snapshot(userId, propertyId);
}
function pdf(input) {
  const encoded = text(input.data, 'PDF data', 2_000_100, true).replace(/^data:application\/pdf;base64,/, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) fail('Upload a base64-encoded PDF.');
  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.length > vault.MAX_BYTES || buffer.length < 8 || buffer.subarray(0, 5).toString() !== '%PDF-') fail('Upload a PDF no larger than 1.5 MB.');
  return buffer;
}
function upload(userId, propertyId, input, documentId) {
  const { room } = context(userId, propertyId, { manager: true }); version(room, input.version);
  const title = text(input.title, 'Document title', 150, true);
  const category = text(input.category, 'Category', 60, true);
  if (!['investors', 'managers'].includes(input.visibility)) fail('Choose investor or manager visibility.');
  const filename = text(input.filename, 'Filename', 150, true);
  if (!/\.pdf$/i.test(filename)) fail('Choose a PDF file.');
  let document = documentId ? room.documents.find((row) => row.id === documentId) : null;
  if (documentId && !document) fail('Document not found.', 404);
  const buffer = pdf(input);
  const stored = vault.saveUpload(`${PRIVATE_PREFIX}${propertyId}`, 'document.pdf', buffer);
  if (!document) {
    document = { id: randomUUID(), title, category, visibility: input.visibility, archived: false, versions: [] };
    room.documents.unshift(document);
  }
  Object.assign(document, { title, category, visibility: input.visibility });
  document.versions.push({ version: document.versions.length + 1, filename, file: stored.url.split('/').pop(), bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'), createdAt: new Date().toISOString(), uploaderId: String(userId) });
  record(room, userId, 'document_version_uploaded', document.id);
  return snapshot(userId, propertyId);
}
function documentSettings(userId, propertyId, documentId, input) {
  const { room } = context(userId, propertyId, { manager: true }); version(room, input.version);
  const doc = room.documents.find((row) => row.id === documentId);
  if (!doc) fail('Document not found.', 404);
  if (typeof input.archived !== 'boolean' || !['investors', 'managers'].includes(input.visibility)) fail('Choose valid document access settings.');
  Object.assign(doc, { archived: input.archived, visibility: input.visibility });
  record(room, userId, 'document_access_updated', doc.id);
  return snapshot(userId, propertyId);
}
async function download(userId, propertyId, documentId, requestedVersion) {
  const { room, canManage } = context(userId, propertyId);
  const doc = room.documents.find((row) => row.id === documentId && (canManage || (!row.archived && row.visibility === 'investors')));
  const entry = doc?.versions.find((row) => String(row.version) === String(requestedVersion));
  if (!entry) fail('Document version not found.', 404);
  const buffer = await vault.readPropertyFile(`${PRIVATE_PREFIX}${propertyId}`, entry.file);
  if (!buffer) fail('Document file is unavailable.', 404);
  return { buffer, filename: entry.filename };
}
function ask(userId, propertyId, input) {
  const { room, canManage } = context(userId, propertyId);
  if (canManage) fail('Investor accounts submit questions.', 403);
  const question = text(input.question, 'Question', 3000, true);
  if (room.questions.filter((row) => row.userId === String(userId)).length >= 100) fail('This investor has reached the question limit for this property.');
  const row = { id: randomUUID(), userId: String(userId), question, createdAt: new Date().toISOString(), replies: [] };
  room.questions.unshift(row); record(room, userId, 'question_asked', row.id);
  return snapshot(userId, propertyId);
}
function reply(userId, propertyId, questionId, input) {
  const { room } = context(userId, propertyId, { manager: true });
  const question = room.questions.find((row) => row.id === questionId);
  if (!question) fail('Question not found.', 404);
  const answer = text(input.answer, 'Answer', 5000, true);
  question.replies.push({ id: randomUUID(), actorId: String(userId), answer, at: new Date().toISOString() });
  record(room, userId, 'question_answered', question.id);
  return snapshot(userId, propertyId);
}
module.exports = { snapshot, settings, upload, documentSettings, download, ask, reply, context, account, text, version, fail, PRIVATE_PREFIX };
