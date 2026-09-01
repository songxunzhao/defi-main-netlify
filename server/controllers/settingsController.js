const settingsService = require('../services/settingsService');
const authService = require('../services/authService');

async function getSettings(req, res) {
  try {
    const out = await settingsService.getSettings(req);
    res.json(out);
  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
}

async function setFlag(req, res) {
  try {
    const { serverFlag } = req.body || {};
    if (typeof serverFlag !== 'boolean') {
      return res.status(400).json({ error: 'serverFlag must be a boolean' });
    }
    const out = await settingsService.setServerFlag(serverFlag, req);
    res.json(out);
  } catch (err) {
    console.error('setFlag error:', err);
    res.status(500).json({ error: 'Failed to update server flag' });
  }
}

async function setAllowedIps(req, res) {
  try {
    const { allowedAdminIps } = req.body || {};
    if (!Array.isArray(allowedAdminIps)) {
      return res.status(400).json({ error: 'allowedAdminIps must be an array' });
    }
    const out = await settingsService.setAllowedIps(allowedAdminIps, req);
    res.json(out);
  } catch (err) {
    console.error('setAllowedIps error:', err);
    res.status(500).json({ error: 'Failed to update allowed IPs' });
  }
}

// IP-restricted admin approval: the requesting IP must be in the allowed list
// AND the supplied credentials must belong to an account with role 'admin'.
async function verifyAdmin(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing admin email or password' });
    }

    if (!(await settingsService.isRequestIpAllowed(req))) {
      return res.status(403).json({ error: 'IP address not authorized for admin approval' });
    }

    const { user } = await authService.authenticateAdmin({ email, password });
    return res.json({ ok: true, user });
  } catch (err) {
    if (err.message === 'Invalid admin credentials') {
      return res.status(401).json({ error: err.message });
    }
    console.error('verifyAdmin error:', err);
    return res.status(500).json({ error: 'Admin verification failed' });
  }
}

module.exports = { getSettings, setFlag, setAllowedIps, verifyAdmin };
