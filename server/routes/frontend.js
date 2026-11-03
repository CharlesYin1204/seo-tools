/**
 * 前端公开路由
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const HomeController = require('../controllers/frontend/HomeController');
const WeChatRobotPluginController = require('../controllers/user/WeChatRobotPluginController');
const { query: dbQuery } = require('../config/database');
const logger = require('../utils/logger');
const { buildListedPropertyFilter } = require('../utils/publishFilter');

/* ---- 尝试加载可选控制器，不存在时提供占位 ---- */
let ArticleController, FrontendPropertyController, AIPropertySearchController, AIRentalAssistantController;
try { ArticleController = require('../controllers/frontend/ArticleController'); } catch { ArticleController = null; }
try { FrontendPropertyController = require('../controllers/frontend/PropertyController'); } catch { FrontendPropertyController = null; }
try { AIPropertySearchController = require('../controllers/user/AIPropertySearchController'); } catch { AIPropertySearchController = null; }
try { AIRentalAssistantController = require('../controllers/user/AIRentalAssistantController'); } catch { AIRentalAssistantController = null; }

const placeholder = (req, res) => res.json({ success: false, message: '功能开发中' });

const INDEX_PATH = path.resolve(__dirname, '..', '..', 'client', 'dist', 'index.html');

const serveSpa = (req, res, next) => {
  const accepts = req.headers.accept || '';
  const wantsHtml = req.method === 'GET' && accepts.includes('text/html');
  if (!wantsHtml || req.xhr) {
    return next();
  }

  if (fs.existsSync(INDEX_PATH)) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.sendFile(INDEX_PATH);
  }
  return next();
};

/**
 * 为房源详情页注入 OG meta 标签，让微信分享卡片显示封面图和摘要
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getFirstImageUrl(mediaUrls, req) {
  if (!mediaUrls) return '';
  try {
    const urls = typeof mediaUrls === 'string' ? JSON.parse(mediaUrls) : mediaUrls;
    if (!Array.isArray(urls) || urls.length === 0) return '';
    const first = urls[0];
    let url = typeof first === 'object' ? (first.thumb || first.url) : first;
    if (!url) return '';
    if (url.includes('mmbiz.qpic.cn') || url.includes('wx.qlogo.cn') || url.includes('qpic.cn') || url.includes('wechat') || url.includes('rains3.com') || url.includes('szangels') || url.includes('imgcache.qq.com') || url.includes('hkimg.qq.com') || url.includes('wtimg.qq.com') || url.includes('smartgaga')) {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'expatshome.cn';
      url = `${proto}://${host}/api/proxy/image?url=${encodeURIComponent(url)}`;
    }
    if (url.startsWith('/')) {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'expatshome.cn';
      url = `${proto}://${host}${url}`;
    }
    return url;
  } catch { return ''; }
}

function buildCardTitle(row) {
  const parts = [];
  if (row.district) parts.push(row.district);
  if (row.bedrooms) parts.push(row.bedrooms + 'BR');
  const pv = Number(row.custom_price || row.price_value);
  if (Number.isFinite(pv) && pv > 0) {
    parts.push('¥' + pv.toLocaleString());
  } else if (row.price) {
    const num = String(row.price).replace(/[^0-9.]/g, '');
    if (num && !isNaN(num)) parts.push('¥' + Number(num).toLocaleString());
  }
  if (row.metro_lines) parts.push(row.metro_lines);
  if (row.metro_stations) parts.push(row.metro_stations);
  return parts.length > 0 ? parts.join(' · ') : (row.community || row.title || 'ExpatHome Property');
}

function buildDescription(row) {
  const parts = [];
  if (row.community) parts.push(row.community);
  if (row.district) parts.push(row.district);
  if (row.bedrooms) parts.push(row.bedrooms + ' Bedroom');
  const pv = Number(row.custom_price || row.price_value);
  if (Number.isFinite(pv) && pv > 0) parts.push('¥' + pv.toLocaleString() + '/mo');
  if (row.area_sqm) parts.push(row.area_sqm + '㎡');
  if (row.metro_stations) parts.push('Near ' + row.metro_stations);
  return parts.length > 0 ? parts.join(' | ') : 'Find your perfect home in Shanghai - ExpatHome';
}

const servePropertySpa = async (req, res, next) => {
  const accepts = req.headers.accept || '';
  const wantsHtml = req.method === 'GET' && accepts.includes('text/html');
  if (!wantsHtml || req.xhr) return next();
  if (!fs.existsSync(INDEX_PATH)) return next();

  const propertyId = parseInt(req.params.id, 10);
  if (!propertyId) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(INDEX_PATH);
  }

  try {
    const pf = await buildListedPropertyFilter('p', { includeDedup: true });
    const detailWhere = ['p.id = ?', 'p.deleted_at IS NULL', "p.status = 'published'", ...pf.conditions].join(' AND ');
    const [row] = await dbQuery(
      `SELECT p.id, p.title, p.community, p.district, p.street, p.bedrooms, p.price_value, p.custom_price, p.price, p.area_sqm, p.metro_lines, p.metro_stations, p.media_urls, p.local_images, p.description, p.original_content, p.moment_id,
              m.media_list as moment_media_list, m.local_media_urls as moment_local_media
       FROM wechat_robot_expat_parsed_properties p
       LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
       WHERE ${detailWhere} LIMIT 1`,
      [propertyId, ...pf.params]
    );
    if (row) {
      const { mergeMomentMedia } = require('../utils/propertyMediaMerge');
      mergeMomentMedia(row);
    }

    if (!row) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(INDEX_PATH);
    }

    let html = fs.readFileSync(INDEX_PATH, 'utf-8');

    const ogTitle = escapeHtml(buildCardTitle(row));
    const ogDesc = escapeHtml(buildDescription(row));
    const ogImage = escapeHtml(getFirstImageUrl(row.media_urls, req));
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'expatshome.cn';
    const ogUrl = escapeHtml(`${proto}://${host}/properties/${propertyId}`);

    const ogTags = [
      `<meta property="og:type" content="article" />`,
      `<meta property="og:title" content="${ogTitle}" />`,
      `<meta property="og:description" content="${ogDesc}" />`,
      `<meta property="og:url" content="${ogUrl}" />`,
      ogImage ? `<meta property="og:image" content="${ogImage}" />` : '',
      `<meta name="description" content="${ogDesc}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${ogTitle}" />`,
      `<meta name="twitter:description" content="${ogDesc}" />`,
      ogImage ? `<meta name="twitter:image" content="${ogImage}" />` : '',
      `<title>${ogTitle} - ExpatHome</title>`,
    ].filter(Boolean).join('\n    ');

    html = html.replace(
      '<title>ExpatHome - Find Your Perfect Home in Shanghai</title>',
      ogTags
    );

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    logger.warn('OG meta注入失败，返回默认SPA', { error: err.message, propertyId });
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(INDEX_PATH);
  }
};

// 首页 & 搜索
router.get('/home', HomeController.index);
router.get('/map-search', serveSpa, HomeController.mapSearch.bind(HomeController));
router.get('/map/properties', HomeController.mapPropertiesApi);
router.get('/properties/api-search', FrontendPropertyController ? FrontendPropertyController.apiSearch : placeholder);
router.get('/properties/search', HomeController.searchProperties);
router.get('/properties/:id', optionalAuth, servePropertySpa, HomeController.propertyDetail.bind(HomeController));
router.get('/districts', HomeController.getDistricts);
router.get('/metro-lines', HomeController.getMetroLines);
router.get('/metro-stations', HomeController.getMetroStations);
router.get('/search-suggestions', HomeController.searchSuggestions || placeholder);

// 静态页面
router.get('/about', serveSpa, HomeController.about || placeholder);
router.get('/contact', serveSpa, HomeController.contact || placeholder);
router.get('/services', serveSpa, HomeController.services || placeholder);
router.get('/wechat-robot', serveSpa, HomeController.wechatRobotHome || placeholder);
router.get('/wechat-matrix', serveSpa, HomeController.wechatMatrixHome || placeholder);

// 语言切换
router.post('/switch-language', HomeController.switchLanguage || placeholder);

// 博客
router.get('/blog', serveSpa, ArticleController ? ArticleController.publicIndex : placeholder);
router.get('/blog/:slug', serveSpa, ArticleController ? ArticleController.publicShow : placeholder);

// 前端房源列表（公开）
router.get('/properties', serveSpa, FrontendPropertyController ? FrontendPropertyController.index : placeholder);
router.post('/properties/favorite', requireAuth, FrontendPropertyController ? FrontendPropertyController.favorite : placeholder);
router.post('/properties/contact-agent', requireAuth, FrontendPropertyController ? FrontendPropertyController.contactAgent : placeholder);

// 中介列表
router.get('/agents', serveSpa, HomeController.agents || placeholder);
router.get('/agents/:id', serveSpa, HomeController.agentProfile || placeholder);

// 房源分享（公开访问）
router.get('/share/expat-property/:token', serveSpa, WeChatRobotPluginController.shareProperty);
router.get('/share/parsed-property/:token', serveSpa, WeChatRobotPluginController.shareParsedProperty || placeholder);
router.get('/property/share/:code', serveSpa, WeChatRobotPluginController.sharePropertyByCode || placeholder);
router.get('/property/:username/share/:code', serveSpa, WeChatRobotPluginController.sharePropertyByUserAndCode || placeholder);
router.get('/property/:username/:id(\\d+)', servePropertySpa, HomeController.propertyDetail.bind(HomeController));
router.get('/property/:username', serveSpa, WeChatRobotPluginController.userPropertyListPage);

// AI搜索（前台入口）
router.get('/ai-property-search', serveSpa, AIPropertySearchController ? AIPropertySearchController.index : placeholder);
router.get('/ai-rental-assistant', serveSpa, AIRentalAssistantController ? AIRentalAssistantController.index : placeholder);

// 关注/取消关注中介（公开但需要登录）
router.post('/agents/follow', HomeController.followAgent || placeholder);
router.post('/agents/unfollow', HomeController.unfollowAgent || placeholder);

// 房源咨询表单
router.post('/submit-property-inquiry', optionalAuth, FrontendPropertyController ? FrontendPropertyController.submitPropertyInquiry : placeholder);

// 文章别名路由
router.get('/articles', serveSpa, ArticleController ? ArticleController.publicIndex : placeholder);
router.get('/articles/:slug', serveSpa, ArticleController ? ArticleController.publicShow : placeholder);

module.exports = router;
