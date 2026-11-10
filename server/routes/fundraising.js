const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const service = require('../services/fundraisingService');
const endpoint = (action, status = 200) => (req, res) => {
  try { res.status(status).json(action(req)); }
  catch (error) { res.status(error.status || 500).json({ error: error.message }); }
};
router.use(requireAuth);
router.get('/', endpoint((req) => service.snapshot(req.user.sub)));
router.post('/prospects', endpoint((req) => service.save(req.user.sub, req.body || {}), 201));
router.patch('/prospects/:id', endpoint((req) => service.save(req.user.sub, req.body || {}, req.params.id)));
module.exports = router;
