const express = require('express');
const controller = require('../controllers/imageController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAdmin, controller.upload);
router.get('/seed/:file', controller.seed);
router.get('/:file', controller.file);

module.exports = router;
