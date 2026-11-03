const express = require('express');
const router = express.Router();
const { requireOpenApi } = require('../middleware/openApiAuth');
const MomentPropertyOpenApiController = require('../controllers/openapi/MomentPropertyOpenApiController');

router.get('/v1/health', requireOpenApi('health:read'), MomentPropertyOpenApiController.health.bind(MomentPropertyOpenApiController));
router.get('/v1/moments/properties', requireOpenApi('properties:list'), MomentPropertyOpenApiController.list.bind(MomentPropertyOpenApiController));
router.get('/v1/moments/properties/:id', requireOpenApi('properties:detail'), MomentPropertyOpenApiController.detail.bind(MomentPropertyOpenApiController));
router.get('/v1/moments/filters', requireOpenApi('filters:read'), MomentPropertyOpenApiController.filters.bind(MomentPropertyOpenApiController));

module.exports = router;
