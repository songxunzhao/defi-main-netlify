const settingsService = require('../services/settingsService');

async function getSettings(req, res) {
  try {
    const out = await settingsService.getSettings(req);
    res.json(out);
  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ error: 'Failed to load settings' });
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
    res.status(err.status || 500).json({ error: err.message || 'Failed to update allowed IPs' });
  }
}

async function allowCurrentIp(req, res) {
  try {
    const out = await settingsService.allowCurrentIp(req);
    res.json(out);
  } catch (err) {
    console.error('allowCurrentIp error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to allow this IP' });
  }
}

module.exports = { getSettings, setAllowedIps, allowCurrentIp };
