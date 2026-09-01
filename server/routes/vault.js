const express = require('express');
const controller = require('../controllers/vaultController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/seed/:file', requireAuth, controller.seed);
router.get('/:propertyId/:file', requireAuth, controller.propertyFile);

module.exports = router;
