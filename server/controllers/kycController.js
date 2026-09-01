const kycService = require('../services/kycService');

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('KYC error:', err);
  return res.status(status).json({ error: err.message || 'Request failed' });
}

function getMine(req, res) {
  try {
    return res.json(kycService.getProfile(req.user.sub));
  } catch (err) {
    return sendError(res, err);
  }
}

function submit(req, res) {
  try {
    return res.json(kycService.submit(req.user.sub, req.body || {}));
  } catch (err) {
    return sendError(res, err);
  }
}

function bindWallet(req, res) {
  try {
    return res.json(kycService.bindWallet(req.user.sub, req.body && req.body.address));
  } catch (err) {
    return sendError(res, err);
  }
}

function listInvestors(req, res) {
  try {
    return res.json({ investors: kycService.listInvestors() });
  } catch (err) {
    return sendError(res, err);
  }
}

function review(req, res) {
  try {
    return res.json(kycService.review(req.params.userId, req.body || {}));
  } catch (err) {
    return sendError(res, err);
  }
}

module.exports = { getMine, submit, bindWallet, listInvestors, review };
