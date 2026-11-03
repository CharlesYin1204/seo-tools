const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const OpenApiAdminController = require('../controllers/openapi/OpenApiAdminController');

router.use(requireAdmin);

router.get('/meta', OpenApiAdminController.meta.bind(OpenApiAdminController));
router.get('/apps', OpenApiAdminController.listApps.bind(OpenApiAdminController));
router.post('/apps', OpenApiAdminController.createApp.bind(OpenApiAdminController));
router.put('/apps/:id', OpenApiAdminController.updateApp.bind(OpenApiAdminController));
router.post('/apps/:id/reset-key', OpenApiAdminController.resetKey.bind(OpenApiAdminController));
router.get('/logs', OpenApiAdminController.logs.bind(OpenApiAdminController));

module.exports = router;
