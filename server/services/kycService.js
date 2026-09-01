const persistence = require('../mock/persistence');
const { sanitizeUser } = require('../models/userModel');

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const BLOCKED_COUNTRIES = new Set(['KP', 'IR', 'SY', 'CU']);

function ensureKycFields(user) {
  if (!user.kycStatus) user.kycStatus = 'unverified';
  if (typeof user.accredited !== 'boolean') user.accredited = false;
  if (user.walletAddress === undefined) user.walletAddress = null;
  if (user.kyc === undefined) user.kyc = null;
  return user;
}

function findById(id) {
  const user = persistence.data.users.find((u) => String(u.id) === String(id));
  return user ? ensureKycFields(user) : null;
}

function eligibility(user) {
  const account = ensureKycFields(user);
  const reasons = [];
  if (account.kycStatus !== 'approved') {
    reasons.push('Identity verification is not approved.');
  }
  if (!account.accredited) {
    reasons.push('Accredited-investor attestation is required.');
  }
  if (!account.walletAddress) {
    reasons.push('A wallet must be linked to this account.');
  }
  return {
    canInvest: reasons.length === 0,
    reasons,
    kycStatus: account.kycStatus,
    accredited: account.accredited,
    walletAddress: account.walletAddress,
  };
}

function getProfile(userId) {
  const user = findById(userId);
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return { user: sanitizeUser(user), eligibility: eligibility(user) };
}

function submit(userId, payload) {
  const user = findById(userId);
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  if (user.kycStatus === 'pending') {
    throw Object.assign(new Error('Verification is already pending review.'), { status: 409 });
  }
  if (user.kycStatus === 'approved') {
    throw Object.assign(new Error('This account is already verified.'), { status: 409 });
  }

  const legalName = String(payload.legalName || '').trim();
  const country = String(payload.country || '').trim().toUpperCase();
  const accredited = Boolean(payload.accredited);
  const attested = Boolean(payload.attested);

  if (legalName.length < 2) {
    throw Object.assign(new Error('Enter your legal name.'), { status: 400 });
  }
  if (!/^[A-Z]{2}$/.test(country)) {
    throw Object.assign(new Error('Enter a two-letter country code (e.g. US).'), { status: 400 });
  }
  if (BLOCKED_COUNTRIES.has(country)) {
    throw Object.assign(new Error('This jurisdiction is not supported.'), { status: 400 });
  }
  if (!accredited || !attested) {
    throw Object.assign(new Error('Accredited-investor attestation is required to continue.'), { status: 400 });
  }

  user.name = legalName;
  user.kycStatus = 'pending';
  user.accredited = true;
  user.kyc = {
    legalName,
    country,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewNote: null,
    provider: 'mock',
  };
  persistence.save();
  return { user: sanitizeUser(user), eligibility: eligibility(user) };
}

function bindWallet(userId, address) {
  const user = findById(userId);
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const raw = String(address || '').trim();
  if (!ADDRESS_RE.test(raw)) {
    throw Object.assign(new Error('Enter a valid EVM wallet address.'), { status: 400 });
  }
  const normalized = raw.toLowerCase();
  const taken = persistence.data.users.find(
    (u) => u.walletAddress && u.walletAddress.toLowerCase() === normalized && String(u.id) !== String(user.id)
  );
  if (taken) {
    throw Object.assign(new Error('That wallet is already linked to another account.'), { status: 409 });
  }
  user.walletAddress = normalized;
  persistence.save();
  return { user: sanitizeUser(user), eligibility: eligibility(user) };
}

function listInvestors() {
  return persistence.data.users.map((u) => sanitizeUser(ensureKycFields(u)));
}

function review(userId, { decision, note }) {
  const user = findById(userId);
  if (!user) throw Object.assign(new Error('Investor not found'), { status: 404 });
  if (user.kycStatus !== 'pending') {
    throw Object.assign(new Error('Only pending applications can be reviewed.'), { status: 409 });
  }
  if (decision !== 'approved' && decision !== 'rejected') {
    throw Object.assign(new Error('Decision must be approved or rejected.'), { status: 400 });
  }
  user.kycStatus = decision;
  if (decision === 'rejected') user.accredited = false;
  if (!user.kyc) user.kyc = {};
  user.kyc.reviewedAt = new Date().toISOString();
  user.kyc.reviewNote = note ? String(note).slice(0, 500) : null;
  persistence.save();
  return { user: sanitizeUser(user), eligibility: eligibility(user) };
}

module.exports = {
  ensureKycFields,
  eligibility,
  getProfile,
  submit,
  bindWallet,
  listInvestors,
  review,
};
