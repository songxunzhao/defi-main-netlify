const express = require('express');
const controller = require('../controllers/settingsController');

const router = express.Router();

router.get('/', controller.getSettings);
router.post('/allowed-ips', controller.setAllowedIps);
router.post('/allow-current-ip', controller.allowCurrentIp);

module.exports = router;
