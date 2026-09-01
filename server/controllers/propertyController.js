const propertyService = require('../services/propertyService');

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('Property error:', err);
  return res.status(status).json({ error: err.message || 'Request failed' });
}

function list(req, res) {
  return res.json({ properties: propertyService.list() });
}

function get(req, res) {
  const property = propertyService.getById(req.params.id);
  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }
  return res.json({ property });
}

function create(req, res) {
  try {
    return res.status(201).json({ property: propertyService.create(req.body || {}) });
  } catch (err) {
    return sendError(res, err);
  }
}

function update(req, res) {
  try {
    return res.json({ property: propertyService.update(req.params.id, req.body || {}) });
  } catch (err) {
    return sendError(res, err);
  }
}

function remove(req, res) {
  try {
    return res.json({ property: propertyService.remove(req.params.id) });
  } catch (err) {
    return sendError(res, err);
  }
}

module.exports = { list, get, create, update, remove };
