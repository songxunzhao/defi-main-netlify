const express = require('express');
const controller = require('../controllers/activityController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/sync', requireAuth, controller.sync);
router.get('/', requireAuth, controller.get);
router.get('/tax.csv', requireAuth, controller.taxCsv);
router.get('/tax', requireAuth, controller.tax);

module.exports = router;
