const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const persistence = require('../mock/persistence');
const { sanitizeUser } = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || "jwt_secret";

// Fail closed: never fall back to a weak, hardcoded signing secret.
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it in your .env file before starting the server.');
}

async function registerUser({ email, password, username, role }) {
  const { data } = persistence;
  const existing = data.users.find(u => u.email === email);
  if (existing) throw new Error('User already exists');

  const password_hash = await bcrypt.hash(password, 10);
  const id = (data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) : 0) + 1;
  const user = {
    id,
    email,
    name: username || null,
    role: role || 'user',
    password_hash,
    kycStatus: 'unverified',
    accredited: false,
    walletAddress: null,
    kyc: null,
  };
  data.users.push(user);
  persistence.save();

  return sanitizeUser(user);
}

async function authenticateUser({ email, password }) {
  const { data } = persistence;
  const user = data.users.find(u => u.email === email);
  if (!user) throw new Error('Invalid credentials');
  const ok = await bcrypt.compare(password, user.password_hash || '');
  if (!ok) throw new Error('Invalid credentials');

  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '7d' });
  return { token, user: sanitizeUser(user) };
}

// Same as authenticateUser but requires the account to hold the 'admin' role.
// Used by the IP-restricted admin approval flow.
async function authenticateAdmin({ email, password }) {
  const { data } = persistence;
  const user = data.users.find(u => u.email === email);
  if (!user || user.role !== 'admin') throw new Error('Invalid admin credentials');
  const ok = await bcrypt.compare(password, user.password_hash || '');
  if (!ok) throw new Error('Invalid admin credentials');

  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  return { token, user: sanitizeUser(user) };
}

module.exports = { registerUser, authenticateUser, authenticateAdmin };
