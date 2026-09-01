const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    const persistence = require('../mock/persistence');
    const account = persistence.data.users.find((u) => String(u.id) === String(req.user.sub));
    if (!account || account.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.account = account;
    return next();
  });
}

module.exports = { requireAuth, requireAdmin };
