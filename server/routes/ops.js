const express = require('express');
const controller = require('../controllers/opsController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/readiness', requireAdmin, controller.report);

module.exports = router;
