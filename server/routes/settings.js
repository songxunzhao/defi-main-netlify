const express = require('express');
const controller = require('../controllers/settingsController');

const router = express.Router();

router.get('/', controller.getSettings);
router.post('/flag', controller.setFlag);
router.post('/allowed-ips', controller.setAllowedIps);
router.post('/admin/verify', controller.verifyAdmin);

module.exports = router;
