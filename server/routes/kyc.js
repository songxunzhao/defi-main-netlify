const express = require('express');
const controller = require('../controllers/kycController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, controller.getMine);
router.post('/', requireAuth, controller.submit);
router.post('/wallet', requireAuth, controller.bindWallet);
router.get('/admin/investors', requireAdmin, controller.listInvestors);
router.post('/admin/:userId/review', requireAdmin, controller.review);

module.exports = router;
