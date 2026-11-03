/** 通用平台 API，仅保留 SEO 工具使用的能力。 */
const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { query } = require('../config/database');
const AIController = require('../controllers/api/AIController');
const PaymentController = require('../controllers/api/PaymentController');

router.get('/health', (req, res) => success(res, { status: 'ok', timestamp: new Date().toISOString() }));

router.get('/system/info', optionalAuth, async (req, res) => {
  try {
    const settings = await query("SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN ('site_name','site_description','site_logo')");
    return success(res, Object.fromEntries(settings.map((item) => [item.setting_key, item.setting_value])));
  } catch (err) { return error(res, '获取系统信息失败', 500); }
});

router.post('/ai/chat', AIController.chat.bind(AIController));
router.get('/ai/models', AIController.getModels.bind(AIController));

router.get('/payment/methods', async (req, res) => {
  try {
    const [row] = await query("SELECT setting_value FROM system_settings WHERE setting_key='payment_methods' LIMIT 1");
    const methods = row?.setting_value ? JSON.parse(row.setting_value) : [];
    return success(res, { methods: Array.isArray(methods) ? methods : [] });
  } catch { return success(res, { methods: [] }); }
});
router.post('/payment/notify/yipay', PaymentController.yipayNotify.bind(PaymentController));
router.get('/payment/notify/yipay', PaymentController.yipayNotify.bind(PaymentController));
router.post('/payment/notify/wechat', PaymentController.wechatPayNotify.bind(PaymentController));
router.get('/payment/check-status', PaymentController.checkStatus.bind(PaymentController));

module.exports = router;
