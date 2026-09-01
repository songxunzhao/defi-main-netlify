const images = require('../services/imageService');

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('Image error:', err);
  return res.status(status).json({ error: err.message || 'Request failed' });
}

function sendImage(res, payload) {
  if (!payload || !payload.buffer) return res.status(404).json({ error: 'Image not found' });
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Content-Type', payload.contentType || 'application/octet-stream');
  return res.send(payload.buffer);
}

async function seed(req, res) {
  try {
    const payload = await images.readSeed(req.params.file);
    if (payload) return sendImage(res, payload);
    if (req.params.file === 'hero.jpg' || req.params.file === 'hero.svg') {
      return res.redirect(302, images.DEFAULT_PHOTO);
    }
    return res.status(404).json({ error: 'Image not found' });
  } catch (err) {
    return sendError(res, err);
  }
}

async function file(req, res) {
  try {
    return sendImage(res, await images.readUpload(req.params.file));
  } catch (err) {
    return sendError(res, err);
  }
}

async function upload(req, res) {
  try {
    const sourceUrl = String(req.body?.sourceUrl || '').trim();
    if (sourceUrl) {
      return res.status(201).json(await images.ingestRemote(sourceUrl));
    }
    const filename = String(req.body?.filename || 'image.jpg');
    const stored = images.saveBuffer(images.decodeUpload(req.body?.data), filename);
    return res.status(201).json(stored);
  } catch (err) {
    return sendError(res, err);
  }
}

module.exports = { seed, file, upload };
