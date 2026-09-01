const express = require('express');
const controller = require('../controllers/propertyController');
const vaultController = require('../controllers/vaultController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, controller.list);
router.post('/', requireAdmin, controller.create);
router.post('/:id/documents', requireAdmin, vaultController.upload);
router.delete('/:id/documents/:index', requireAdmin, vaultController.remove);
router.get('/:id', requireAuth, controller.get);
router.patch('/:id', requireAdmin, controller.update);
router.delete('/:id', requireAdmin, controller.remove);

module.exports = router;
