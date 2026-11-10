const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const service = require('../services/dataRoomService');
const endpoint = (action, status = 200) => async (req, res) => {
  try { res.set('Cache-Control', 'no-store'); res.status(status).json(await action(req)); }
  catch (error) { res.status(error.status || 500).json({ error: error.message }); }
};
router.use(requireAuth);
router.get('/:propertyId', endpoint((req) => service.snapshot(req.user.sub, req.params.propertyId)));
router.patch('/:propertyId/settings', endpoint((req) => service.settings(req.user.sub, req.params.propertyId, req.body || {})));
router.post('/:propertyId/documents', endpoint((req) => service.upload(req.user.sub, req.params.propertyId, req.body || {}), 201));
router.post('/:propertyId/documents/:documentId/versions', endpoint((req) => service.upload(req.user.sub, req.params.propertyId, req.body || {}, req.params.documentId), 201));
router.patch('/:propertyId/documents/:documentId', endpoint((req) => service.documentSettings(req.user.sub, req.params.propertyId, req.params.documentId, req.body || {})));
router.get('/:propertyId/documents/:documentId/versions/:version/file', async (req, res) => {
  try {
    const { buffer, filename } = await service.download(req.user.sub, req.params.propertyId, req.params.documentId, req.params.version);
    res.set({ 'Cache-Control': 'private, no-store', 'Content-Type': 'application/pdf', 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}` }).send(buffer);
  } catch (error) { res.status(error.status || 500).json({ error: error.message }); }
});
router.post('/:propertyId/questions', endpoint((req) => service.ask(req.user.sub, req.params.propertyId, req.body || {}), 201));
router.post('/:propertyId/questions/:questionId/replies', endpoint((req) => service.reply(req.user.sub, req.params.propertyId, req.params.questionId, req.body || {}), 201));
module.exports = router;
