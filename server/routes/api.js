/**
 * API路由（供外部和内部调用）
 */
const express = require('express');
const router = express.Router();
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { query } = require('../config/database');

/* ---- 尝试加载可选控制器 ---- */
let SmsController, UploadController, WatermarkController;
let PluginAPIController, AIController, PaymentController;
let WeChatRobotCallbackController, WeChatCallbackController;
let WeChatPluginsController, LanguageController, FormController;

try { SmsController = require('../controllers/api/SmsController'); } catch { SmsController = null; }
try { UploadController = require('../controllers/api/UploadController'); } catch { UploadController = null; }
try { WatermarkController = require('../controllers/api/WatermarkController'); } catch { WatermarkController = null; }
try { PluginAPIController = require('../controllers/api/PluginAPIController'); } catch { PluginAPIController = null; }
try { AIController = require('../controllers/api/AIController'); } catch { AIController = null; }
try { PaymentController = require('../controllers/api/PaymentController'); } catch { PaymentController = null; }
try { WeChatRobotCallbackController = require('../controllers/api/WeChatRobotCallbackController'); } catch { WeChatRobotCallbackController = null; }
try { WeChatCallbackController = require('../controllers/api/WeChatCallbackController'); } catch { WeChatCallbackController = null; }
try { WeChatPluginsController = require('../controllers/api/WeChatPluginsController'); } catch { WeChatPluginsController = null; }
try { LanguageController = require('../controllers/api/LanguageController'); } catch { LanguageController = null; }
try { FormController = require('../controllers/frontend/FormController'); } catch { FormController = null; }

let HomeController;
try { HomeController = require('../controllers/frontend/HomeController'); } catch { HomeController = null; }

const placeholder = (req, res) => res.json({ success: false, message: '功能开发中' });
const ctrl = (c, method) => (c && c[method]) ? c[method].bind(c) : placeholder;
const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// ============ 微信机器人回调 ============
router.post('/wechat-robot/callback', ctrl(WeChatRobotCallbackController, 'handleCallback'));
router.get('/wechat-robot/callback', ctrl(WeChatRobotCallbackController, 'handleGet'));

// 健康检查
router.get('/health', (req, res) => {
  return success(res, { status: 'ok', timestamp: new Date().toISOString() });
});

// 地图搜索数据 - 供前端Vue调用
router.get('/map-search', async (req, res) => {
  if (HomeController && HomeController.mapSearch) {
    return HomeController.mapSearch(req, res);
  }
  return success(res, { properties: [], districts: [], metroLines: [], metroStations: [], map_config: {} });
});

// 系统信息
router.get('/system/info', optionalAuth, async (req, res) => {
  try {
    const settings = await query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('site_name', 'site_description', 'site_logo')");
    const info = {};
    settings.forEach((s) => { info[s.setting_key] = s.setting_value; });
    return success(res, info);
  } catch (err) {
    return error(res, '获取系统信息失败', 500);
  }
});

// ============ 短信验证码 ============
router.post('/sms/send-code', ctrl(SmsController, 'sendCode'));
router.post('/sms/verify-code', ctrl(SmsController, 'verifyCode'));

// ============ 文件上传 ============
router.post('/upload-image', ctrl(UploadController, 'uploadImage'));
router.post('/upload-video', ctrl(UploadController, 'uploadVideo'));

// ============ 水印图片 ============
router.get('/watermark/image', ctrl(WatermarkController, 'getImage'));

// ============ 插件API ============
router.post('/plugins/smart-writing/generate', ctrl(PluginAPIController, 'smartWriting'));
router.post('/plugins/ai-translation/translate', ctrl(PluginAPIController, 'aiTranslation'));
router.post('/plugins/code-assistant/execute', ctrl(PluginAPIController, 'codeAssistant'));

// ============ AI对话 ============
router.post('/ai/chat', ctrl(AIController, 'chat'));
router.get('/ai/models', ctrl(AIController, 'getModels'));

// ============ 启用的支付方式（公开接口，供前端动态展示） ============
router.get('/payment/methods', async (req, res) => {
  try {
    const [row] = await query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'payment_methods' LIMIT 1"
    ).catch(() => [null]);
    let methods = [];
    if (row?.setting_value) {
      try { methods = JSON.parse(row.setting_value); } catch { methods = []; }
    }
    if (!Array.isArray(methods)) methods = [];
    return success(res, { methods });
  } catch (err) {
    return success(res, { methods: [] });
  }
});

// ============ 支付回调 ============
router.post('/payment/notify/yipay', ctrl(PaymentController, 'yipayNotify'));
router.get('/payment/notify/yipay', ctrl(PaymentController, 'yipayNotify'));
router.post('/payment/notify/wechat', ctrl(PaymentController, 'wechatPayNotify'));
router.get('/payment/check-status', ctrl(PaymentController, 'checkStatus'));

// ============ 支付同步回调（return_url）============
// API文档：return_url 和 notify_url 参数格式完全一致，请求方式 GET
// 易支付服务器也会用 got 库 GET 访问 return_url 做验证
// 后端先验签并更新订单，再 302 重定向到前端 PaymentSuccess 页面
router.get('/payment/return/yipay', ctrl(PaymentController, 'yipayReturn'));

// ============ 支付跳转（POST表单方式，API文档推荐） ============
router.get('/payment/redirect/:orderNo', requireAuth, async (req, res) => {
  try {
    const { orderNo } = req.params;
    const payType = ['alipay', 'wxpay'].includes(req.query.type) ? req.query.type : 'alipay';
    const YiPayService = require('../services/YiPayService');
    await YiPayService.loadConfigFromDB();
    const [order] = await query(
      'SELECT * FROM orders WHERE order_id = ? AND user_id = ? LIMIT 1',
      [orderNo, req.user.id]
    );
    if (!order) return res.status(404).send('订单不存在');
    if (order.status === 'paid') return res.send('该订单已支付');
    if (order.status !== 'pending') return res.status(409).send('当前订单状态不可支付');
    if (order.payment_method !== 'yipay') {
      await query("UPDATE orders SET payment_method = 'yipay', updated_at = NOW() WHERE id = ? AND status = 'pending'", [order.id]);
    }
    const formParams = YiPayService.getPaymentFormParams({
      outTradeNo: order.order_id,
      money: order.amount,
      name: order.title || 'ExpatHome',
      type: payType,
    });
    const submitUrl = YiPayService.submitUrl || 'https://epay.iyunxuan.com/submit.php';
    const inputs = Object.entries(formParams)
      .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
      .join('\n      ');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>正在跳转到支付页面...</title></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#666;">
  <div style="text-align:center;">
    <p style="font-size:16px;">正在跳转到支付页面，请稍候...</p>
    <form id="payForm" action="${escapeHtml(submitUrl)}" method="POST">
      ${inputs}
    </form>
    <script>document.getElementById('payForm').submit();</script>
  </div>
</body></html>`);
  } catch (err) {
    logger.error('支付跳转失败', { orderNo: req.params.orderNo, error: err.message });
    res.status(500).send('支付跳转失败: ' + err.message);
  }
});

// ============ 微信开放平台回调 ============
router.post('/wechat/component/callback', ctrl(WeChatCallbackController, 'componentCallback'));
router.post('/wechat/callback/:appid', ctrl(WeChatCallbackController, 'messageCallback'));

// ============ 微信公众号矩阵插件API ============
router.post('/plugins/wechat-article-collector/collect', ctrl(WeChatPluginsController, 'collectArticle'));
router.post('/plugins/wechat-article-collector/search', ctrl(WeChatPluginsController, 'searchArticles'));
router.get('/plugins/wechat-article-collector/stats', ctrl(WeChatPluginsController, 'getPluginStats'));
router.post('/plugins/ai-viral-title-generator/generate', ctrl(WeChatPluginsController, 'generateTitles'));
router.get('/plugins/ai-viral-title-generator/stats', ctrl(WeChatPluginsController, 'getPluginStats'));
router.get('/plugins/ai-trending-tracker/topics', ctrl(WeChatPluginsController, 'getHotTopics'));
router.post('/plugins/ai-trending-tracker/analyze', ctrl(WeChatPluginsController, 'getHotTopics'));
router.post('/plugins/ai-content-optimizer/optimize', ctrl(WeChatPluginsController, 'optimizeContent'));
router.post('/plugins/ai-cover-image-generator/generate', ctrl(WeChatPluginsController, 'generateImages'));
router.post('/plugins/ai-image-assistant/generate', ctrl(WeChatPluginsController, 'generateImages'));

// ============ 更多插件API ============
router.post('/plugins/video-generator/generate', ctrl(PluginAPIController, 'videoGenerator'));
router.get('/plugins/video-generator/status', ctrl(PluginAPIController, 'videoGeneratorStatus'));
router.get('/plugins/video-generator/history', ctrl(PluginAPIController, 'videoGeneratorHistory'));
router.post('/plugins/doc-assistant/process', ctrl(PluginAPIController, 'docAssistant'));
router.post('/plugins/voice-assistant/generate', ctrl(PluginAPIController, 'voiceAssistant'));
router.post('/plugins/data-analysis/analyze', ctrl(PluginAPIController, 'dataAnalysis'));
router.post('/plugins/mindmap-generator/generate', ctrl(PluginAPIController, 'mindmapGenerator'));
router.post('/plugins/ppt-generator/generate', ctrl(PluginAPIController, 'pptGenerator'));
router.get('/plugins/ppt-generator/list', ctrl(PluginAPIController, 'getPPTList'));

// ============ 语言API ============
router.get('/languages', ctrl(LanguageController, 'getLanguages'));
router.post('/translate', ctrl(LanguageController, 'translate'));

// ============ 公开表单 ============
router.get('/form/:slug', ctrl(FormController, 'showForm'));
router.post('/form/:slug/submit', ctrl(FormController, 'submitForm'));

// ============ 支付创建 ============
router.post('/payment/wechat/create', ctrl(PaymentController, 'createWechatPayment'));
router.get('/payment/wechat/query', ctrl(PaymentController, 'queryWechatPayment'));
router.get('/payment/wechat/jsapi-auth-url', ctrl(PaymentController, 'getWechatJsapiAuthUrl'));
router.get('/payment/wechat/jsapi-openid', ctrl(PaymentController, 'getWechatOpenid'));
router.get('/payment/wechat/saved-openid', optionalAuth, ctrl(PaymentController, 'getSavedOpenid'));

// ============ 手机验证别名 ============
router.post('/send-sms-verification', ctrl(SmsController, 'sendCode'));
router.post('/verify-phone-code', ctrl(SmsController, 'verifyCode'));

// ============ 图片代理（解决微信图片防盗链 + S3预签名） ============
const https = require('https');
const http = require('http');
router.get('/proxy/image', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ success: false, message: 'Missing url parameter' });

  const allowedDomains = ['qpic.cn', 'wx.qlogo.cn', 'wechat.com', 'weixin.qq.com', 'mmbiz.qpic.cn', 'video.qq.com', 'rains3.com', 'szangels.com', 'imgcache.qq.com', 'hkimg.qq.com', 'wtimg.qq.com', 'smartgaga.com'];
  try {
    const parsed = new URL(targetUrl);
    if (!allowedDomains.some(d => parsed.hostname.endsWith(d))) {
      return res.status(403).json({ success: false, message: 'Domain not allowed' });
    }
    // 对S3 URL自动生成预签名
    if (parsed.hostname.includes('rains3.com') && !targetUrl.includes('X-Amz-Signature')) {
      try {
        const { getPresignedUrl } = require('../services/S3ProxyService');
        targetUrl = await getPresignedUrl(targetUrl);
      } catch { /* 使用原始URL */ }
    }
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid URL' });
  }

  const client = targetUrl.startsWith('https') ? https : http;
  const proxyReq = client.get(targetUrl, { timeout: 15000, headers: { 'Referer': '' } }, (proxyRes) => {
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      return res.redirect(proxyRes.headers.location);
    }
    const upstreamCT = (proxyRes.headers['content-type'] || '').toLowerCase();
    if (proxyRes.statusCode >= 400 || (!upstreamCT.startsWith('image/') && !upstreamCT.startsWith('video/'))) {
      proxyRes.resume();
      return res.status(proxyRes.statusCode >= 400 ? proxyRes.statusCode : 502)
        .json({ success: false, message: 'Upstream returned non-image content' });
    }
    res.set('Content-Type', upstreamCT || 'image/jpeg');
    if (proxyRes.headers['content-length']) {
      res.set('Content-Length', proxyRes.headers['content-length']);
    }
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Access-Control-Allow-Origin', '*');
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => {
    if (!res.headersSent) res.status(502).json({ success: false, message: 'Proxy fetch failed' });
  });
  proxyReq.on('timeout', () => { proxyReq.destroy(); });
});

// ============ 公开接口：检查用户试用状态（通过username） ============
router.get('/check-user-trial/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const [user] = await query(
      'SELECT is_trial, trial_end_date FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    if (!user) return res.json({ success: true, data: { is_trial: false, expired: false } });
    if (!user.is_trial) return res.json({ success: true, data: { is_trial: false, expired: false } });
    const expired = user.trial_end_date ? new Date() > new Date(user.trial_end_date) : false;
    return res.json({ success: true, data: { is_trial: true, expired } });
  } catch {
    return res.json({ success: true, data: { is_trial: false, expired: false } });
  }
});

module.exports = router;
