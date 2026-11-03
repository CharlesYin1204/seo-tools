/**
 * 用户中心路由
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireFeatureAccess, requireAnyFeatureAccess } = require('../middleware/featureAccess');
const UserDashboardController = require('../controllers/user/UserDashboardController');
const SeoWorkspaceController = require('../controllers/user/SeoWorkspaceController');
const WeChatRobotController = require('../controllers/user/WeChatRobotController');
const WeChatRobotPluginController = require('../controllers/user/WeChatRobotPluginController');

/* ---- 尝试加载可选控制器 ---- */
let PropertyController, MediaController, MembershipController, AppointmentController;
let TenantDemandController, WeChatPluginMarketController, WeChatOfficialAccountController;
let WeChatArticleController, AIPropertySearchController, AIRentalAssistantController, ReferralController;
let OrderController, BalanceController, PointsController, ServiceMarketController;
let UserNotificationController, FavoriteController, FollowController;
let PluginCenterController, PluginExecuteController;
let FeatureModuleController;

try { PropertyController = require('../controllers/user/PropertyController'); } catch { PropertyController = null; }
try { MediaController = require('../controllers/user/MediaController'); } catch { MediaController = null; }
try { MembershipController = require('../controllers/user/MembershipController'); } catch { MembershipController = null; }
try { AppointmentController = require('../controllers/user/AppointmentController'); } catch { AppointmentController = null; }
try { TenantDemandController = require('../controllers/user/TenantDemandController'); } catch { TenantDemandController = null; }
try { WeChatPluginMarketController = require('../controllers/user/WeChatPluginMarketController'); } catch { WeChatPluginMarketController = null; }
try { WeChatOfficialAccountController = require('../controllers/user/WeChatOfficialAccountController'); } catch { WeChatOfficialAccountController = null; }
try { WeChatArticleController = require('../controllers/user/WeChatArticleController'); } catch { WeChatArticleController = null; }
try { AIPropertySearchController = require('../controllers/user/AIPropertySearchController'); } catch { AIPropertySearchController = null; }
try { AIRentalAssistantController = require('../controllers/user/AIRentalAssistantController'); } catch { AIRentalAssistantController = null; }
try { ReferralController = require('../controllers/user/ReferralController'); } catch { ReferralController = null; }
try { OrderController = require('../controllers/user/OrderController'); } catch { OrderController = null; }
try { BalanceController = require('../controllers/user/BalanceController'); } catch { BalanceController = null; }
try { PointsController = require('../controllers/user/PointsController'); } catch { PointsController = null; }
try { ServiceMarketController = require('../controllers/user/ServiceMarketController'); } catch { ServiceMarketController = null; }
try { UserNotificationController = require('../controllers/user/NotificationController'); } catch { UserNotificationController = null; }
try { FavoriteController = require('../controllers/user/FavoriteController'); } catch { FavoriteController = null; }
try { FollowController = require('../controllers/user/FollowController'); } catch { FollowController = null; }
try { PluginCenterController = require('../controllers/user/PluginCenterController'); } catch { PluginCenterController = null; }
try { PluginExecuteController = require('../controllers/user/PluginExecuteController'); } catch { PluginExecuteController = null; }
try { FeatureModuleController = require('../controllers/user/FeatureModuleController'); } catch { FeatureModuleController = null; }

const placeholder = (req, res) => res.json({ success: false, message: '功能开发中' });
const ctrl = (c, method) => (c && c[method]) ? c[method].bind(c) : placeholder;

// OAuth callback is authenticated by the one-time state stored during the authorized request.
router.get('/seo/gsc/callback', SeoWorkspaceController.gscCallback.bind(SeoWorkspaceController));

// 所有用户路由需要登录
router.use(requireAuth);

// ============ 仪表盘 ============
router.get('/dashboard', UserDashboardController.getDashboard);
router.get('/seo/overview', SeoWorkspaceController.overview);
// 明确的工作区别名，兼容旧客户端并避免 overview/workspace 命名歧义
router.get('/seo/workspace', SeoWorkspaceController.overview);
router.get('/seo/sites', SeoWorkspaceController.getSites);
router.get('/seo/sites/:id/score-details', SeoWorkspaceController.getScoreDetails.bind(SeoWorkspaceController));
router.get('/seo/ad-programs', SeoWorkspaceController.listAdPrograms);
router.post('/seo/sites/:id/ad-programs', SeoWorkspaceController.applyAdProgram);
router.put('/seo/ad-programs/:id', SeoWorkspaceController.updateAdProgram);
router.post('/seo/sites', SeoWorkspaceController.createSite);
router.delete('/seo/sites/:id', SeoWorkspaceController.deleteSite);
router.post('/seo/sites/:id/verify', SeoWorkspaceController.verifySite);
router.get('/seo/sites/:id/gsc/authorize', SeoWorkspaceController.gscAuthorize);
router.post('/seo/sites/:id/gsc/sync', SeoWorkspaceController.syncGsc);
router.delete('/seo/sites/:id/gsc', SeoWorkspaceController.disconnectGsc);
router.post('/seo/sites/:id/scan', SeoWorkspaceController.scanSite);
router.post('/seo/sites/:id/authority/refresh', SeoWorkspaceController.refreshAuthority.bind(SeoWorkspaceController));
router.get('/seo/sites/:id/sitemaps', SeoWorkspaceController.getSitemaps);
router.post('/seo/sites/:id/sitemap', SeoWorkspaceController.addSitemap);
router.delete('/seo/sites/:id/sitemaps/:sitemapId', SeoWorkspaceController.deleteSitemap);
router.put('/seo/sites/:id/schedule', SeoWorkspaceController.updateSchedule);
router.post('/seo/sites/:id/connection-request', SeoWorkspaceController.requestConnection);
router.post('/seo/sites/:id/connection-test', SeoWorkspaceController.testConnection);
router.get('/seo/scans', SeoWorkspaceController.getScans);
router.get('/seo/issues', SeoWorkspaceController.getIssues);
router.put('/seo/issues/:id/status', SeoWorkspaceController.updateIssue);
router.get('/seo/pages', SeoWorkspaceController.getPages);
router.get('/seo/candidates', SeoWorkspaceController.getCandidates);
router.get('/seo/publishing', SeoWorkspaceController.getPublishingWorkspace);
router.post('/seo/candidates/metadata', SeoWorkspaceController.generateMetadata);
router.post('/seo/features/:module/analyze', SeoWorkspaceController.analyzeFeature);
router.put('/seo/candidates/:id/review', SeoWorkspaceController.reviewCandidate);
router.post('/seo/candidates/:id/export', SeoWorkspaceController.exportCandidate);
router.post('/seo/candidates/:id/publish-check', SeoWorkspaceController.checkPublishCandidate.bind(SeoWorkspaceController));
router.post('/seo/candidates/:id/publish-simulated', SeoWorkspaceController.simulatePublishCandidate.bind(SeoWorkspaceController));

// ============ 个人资料 ============
router.get('/profile', ctrl({ getProfile: require('../controllers/auth/AuthController').getProfile }, 'getProfile'));
router.get('/settings', ctrl({ getProfile: require('../controllers/auth/AuthController').getProfile }, 'getProfile'));
router.put('/profile', ctrl({ updateProfile: require('../controllers/auth/AuthController').updateProfile }, 'updateProfile'));
router.put('/settings', ctrl({ updateProfile: require('../controllers/auth/AuthController').updateProfile }, 'updateProfile'));
router.post('/profile/avatar', ctrl(MediaController, 'uploadAvatar'));

// ============ 房源管理（需要「房源库管理」功能权限） ============
const propertyLibraryGuard = requireFeatureAccess('property-library');
router.get('/properties', propertyLibraryGuard, ctrl(PropertyController, 'getUserProperties'));
router.get('/properties/stats', propertyLibraryGuard, ctrl(PropertyController, 'getPropertyStats'));
router.get('/properties/:id', propertyLibraryGuard, ctrl(PropertyController, 'getProperty'));
router.post('/properties', propertyLibraryGuard, ctrl(PropertyController, 'createProperty'));
router.put('/properties/:id', propertyLibraryGuard, ctrl(PropertyController, 'updateProperty'));
router.post('/properties/:id/publish', propertyLibraryGuard, ctrl(PropertyController, 'publishProperty'));
router.delete('/properties/:id', propertyLibraryGuard, ctrl(PropertyController, 'deleteProperty'));

// 代理人管理（仅当前用户可见）
router.get('/property-agents', propertyLibraryGuard, ctrl(PropertyController, 'getAgents'));
router.post('/property-agents', propertyLibraryGuard, ctrl(PropertyController, 'createAgent'));
router.put('/property-agents/:id', propertyLibraryGuard, ctrl(PropertyController, 'updateAgent'));
router.delete('/property-agents/:id', propertyLibraryGuard, ctrl(PropertyController, 'deleteAgent'));
router.get('/property-agents/:agentId/owners', propertyLibraryGuard, ctrl(PropertyController, 'getAgentOwners'));
router.post('/property-agents/:agentId/owners', propertyLibraryGuard, ctrl(PropertyController, 'createAgentOwner'));
router.put('/property-agent-owners/:ownerId', propertyLibraryGuard, ctrl(PropertyController, 'updateAgentOwner'));
router.delete('/property-agent-owners/:ownerId', propertyLibraryGuard, ctrl(PropertyController, 'deleteAgentOwner'));

// POI小区经纬度查询（上传房源页面使用）
router.get('/community-poi/search', propertyLibraryGuard, async (req, res) => {
  try {
    const { keyword, district } = req.query;
    if (!keyword || !keyword.trim()) {
      return res.json({ code: 0, data: [] });
    }
    const { query: dbQuery } = require('../config/database');
    let sql = `SELECT id, community_name, district, address, longitude, latitude, 
               nearest_metro_line, nearest_metro_station, nearest_metro_distance 
               FROM property_community_dict WHERE is_enabled = 1 AND community_name IS NOT NULL`;
    const params = [];
    sql += ' AND community_name LIKE ?';
    params.push(`%${keyword.trim()}%`);
    if (district && district.trim()) {
      sql += ' AND district = ?';
      params.push(district.trim());
    }
    sql += ' ORDER BY CHAR_LENGTH(community_name) ASC LIMIT 20';
    const rows = await dbQuery(sql, params);
    const data = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
    return res.json({ code: 0, data: data || [] });
  } catch (err) {
    return res.status(500).json({ code: -1, message: '查询失败' });
  }
});

// POI精确匹配查询（根据小区名获取完整POI信息，供上传房源自动填充使用）
// 支持多级回退：精确匹配 → 模糊匹配小区名 → 从原文提取地址匹配 → 地址列模糊匹配
router.get('/community-poi/geocode', propertyLibraryGuard, async (req, res) => {
  try {
    const { community, text } = req.query;
    if (!community || !community.trim()) {
      return res.json({ code: 0, data: null });
    }
    const { query: dbQuery } = require('../config/database');
    const poiFields = `id, community_name, district, board, street, address, longitude, latitude,
                       metro_lines, metro_stations, nearest_metro_line, nearest_metro_station,
                       nearest_metro_distance, property_type, ref_price_min, ref_price_max`;
    const coordCond = 'AND longitude IS NOT NULL AND latitude IS NOT NULL';

    const tryQuery = async (sql, params) => {
      const rows = await dbQuery(sql, params);
      const data = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
      return (data && data.length > 0) ? data[0] : null;
    };

    // 1) 精确匹配小区名
    let result = await tryQuery(
      `SELECT ${poiFields} FROM property_community_dict WHERE is_enabled = 1 AND community_name = ? ${coordCond} LIMIT 1`,
      [community.trim()]
    );
    if (result) return res.json({ code: 0, data: result });

    // 2) 模糊匹配小区名
    result = await tryQuery(
      `SELECT ${poiFields} FROM property_community_dict WHERE is_enabled = 1 AND community_name LIKE ? ${coordCond} ORDER BY CHAR_LENGTH(community_name) ASC LIMIT 1`,
      [`%${community.trim()}%`]
    );
    if (result) return res.json({ code: 0, data: result });

    // 3) 从原文提取"XX路XX号/弄"地址，用小区名或地址列匹配
    const sourceText = text || '';
    const addrPatterns = sourceText.match(/[\u4e00-\u9fa5]+路\d+[号弄]/g) || [];
    for (const addr of addrPatterns) {
      result = await tryQuery(
        `SELECT ${poiFields} FROM property_community_dict WHERE is_enabled = 1 AND (community_name = ? OR address = ?) ${coordCond} LIMIT 1`,
        [addr, addr]
      );
      if (result) return res.json({ code: 0, data: result });
    }

    // 4) 地址列模糊匹配小区名
    result = await tryQuery(
      `SELECT ${poiFields} FROM property_community_dict WHERE is_enabled = 1 AND address LIKE ? ${coordCond} ORDER BY CHAR_LENGTH(community_name) ASC LIMIT 1`,
      [`%${community.trim()}%`]
    );
    if (result) return res.json({ code: 0, data: result });

    return res.json({ code: 0, data: null });
  } catch (err) {
    return res.status(500).json({ code: -1, message: '查询失败' });
  }
});

// ============ 媒体库（上传需「房源库管理」权限） ============
router.get('/media', ctrl(MediaController, 'getMedia'));
router.post('/media/upload',
  propertyLibraryGuard,
  MediaController && MediaController.getUploadMiddleware ? MediaController.getUploadMiddleware() : (req, res, next) => next(),
  ctrl(MediaController, 'uploadMedia')
);
router.delete('/media/:id', ctrl(MediaController, 'deleteMedia'));

// ============ 会员 ============
router.get('/membership', ctrl(MembershipController, 'getMyMembership'));
router.get('/membership/plans', ctrl(MembershipController, 'getPlans'));
router.post('/membership/plan-orders', ctrl(MembershipController, 'createPlanOrder'));
router.get('/membership/usage-ledgers', ctrl(MembershipController, 'getUsageLedgers'));
router.get('/membership/members', ctrl(MembershipController, 'getOrganizationMembers'));
router.put('/membership/members/:id/role', ctrl(MembershipController, 'updateMemberRole'));
router.post('/membership/members/invite', ctrl(MembershipController, 'inviteMember'));
router.put('/membership/members/:id/status', ctrl(MembershipController, 'updateMemberStatus'));

// ============ 预约 ============
router.get('/appointments', ctrl(AppointmentController, 'getAppointments'));
router.post('/appointments', ctrl(AppointmentController, 'createAppointment'));
router.put('/appointments/:id', ctrl(AppointmentController, 'updateAppointment'));

// ============ 租客需求 ============
router.get('/demands', ctrl(TenantDemandController, 'getDemands'));
router.post('/demands', ctrl(TenantDemandController, 'createDemand'));
router.put('/demands/:id', ctrl(TenantDemandController, 'updateDemand'));
router.delete('/demands/:id', ctrl(TenantDemandController, 'deleteDemand'));

// ============ 微信插件市场 ============
router.get('/wechat/plugin-market', ctrl(WeChatPluginMarketController, 'getPlugins'));
router.post('/wechat/plugin-market/install', ctrl(WeChatPluginMarketController, 'installPlugin'));
router.post('/wechat/plugin-market/uninstall', ctrl(WeChatPluginMarketController, 'uninstallPlugin'));

// ============ 微信公众号 ============
router.get('/wechat/accounts', ctrl(WeChatOfficialAccountController, 'getAccounts'));
router.post('/wechat/accounts', ctrl(WeChatOfficialAccountController, 'addAccount'));
router.delete('/wechat/accounts/:id', ctrl(WeChatOfficialAccountController, 'deleteAccount'));

// ============ 微信文章 ============
router.get('/wechat/articles', ctrl(WeChatArticleController, 'getArticles'));
router.post('/wechat/articles', ctrl(WeChatArticleController, 'createArticle'));
router.put('/wechat/articles/:id', ctrl(WeChatArticleController, 'updateArticle'));
router.delete('/wechat/articles/:id', ctrl(WeChatArticleController, 'deleteArticle'));

// ============ AI智能找房 ============
router.post('/ai-property-search/search', ctrl(AIPropertySearchController, 'search'));
router.get('/ai-property-search/history', ctrl(AIPropertySearchController, 'getHistory'));

// ============ AI租房助手 ============
router.post('/ai-rental-assistant/ask', ctrl(AIRentalAssistantController, 'ask'));
router.get('/ai-rental-assistant/history', ctrl(AIRentalAssistantController, 'getHistory'));

// ============ 微信机器人 ============
// 账号管理
router.get('/wechat-robot/accounts', WeChatRobotController.getAccounts);
router.post('/wechat-robot/accounts', WeChatRobotController.addAccount);
router.delete('/wechat-robot/accounts/:id', WeChatRobotController.deleteAccount);
router.post('/wechat-robot/accounts/:id/set-default', WeChatRobotController.setDefaultAccount);
router.get('/wechat-robot/login-qrcode', WeChatRobotController.getLoginQrCode);
router.get('/wechat-robot/stats', WeChatRobotController.getStats);
router.get('/wechat-robot/qrcode/:robotId', WeChatRobotController.getLoginQrCode);
router.get('/wechat-robot/check-status/:robotId', WeChatRobotController.checkLoginStatus);
router.get('/wechat-robot/check-device-status/:robotId', WeChatRobotController.checkDeviceStatus);
router.post('/wechat-robot/logout/:robotId', WeChatRobotController.logoutAccount);

// API配置
router.get('/wechat-robot/api-config', WeChatRobotController.getApiConfig);
router.post('/wechat-robot/api-config', WeChatRobotController.saveApiConfig);

// 通讯录
router.get('/wechat-robot/:robotId/contacts', WeChatRobotController.getContacts);
router.post('/wechat-robot/:robotId/contacts/sync', WeChatRobotController.syncContacts);

// 消息
router.get('/wechat-robot/:robotId/conversations', WeChatRobotController.getConversations);
router.get('/wechat-robot/:robotId/messages/:contactWxid', WeChatRobotController.getChatHistory);
router.post('/wechat-robot/:robotId/messages', WeChatRobotController.sendMessage);

// 群组
router.get('/wechat-robot/:robotId/groups', WeChatRobotController.getGroups);
router.post('/wechat-robot/:robotId/groups/sync', WeChatRobotController.syncGroups);

// 朋友圈
router.get('/wechat-robot/:robotId/moments', WeChatRobotController.getMoments);
router.post('/wechat-robot/:robotId/moments/refresh', WeChatRobotController.refreshMoments);

// 自动回复
router.get('/wechat-robot/:robotId/auto-replies', WeChatRobotController.getAutoReplies);
router.post('/wechat-robot/:robotId/auto-replies', WeChatRobotController.saveAutoReply);
router.delete('/wechat-robot/:robotId/auto-replies/:ruleId', WeChatRobotController.deleteAutoReply);

// AI配置
router.get('/wechat-robot/:robotId/ai-config', WeChatRobotController.getAiConfig || placeholder);
router.post('/wechat-robot/:robotId/ai-config', WeChatRobotController.saveAiConfig || placeholder);

// 联系人标签
router.get('/wechat-robot/contact-tags', WeChatRobotController.getContactTags || placeholder);
router.post('/wechat-robot/contact-tags', WeChatRobotController.saveContactTag || placeholder);
router.delete('/wechat-robot/contact-tags/:id', WeChatRobotController.deleteContactTag || placeholder);

// 收藏夹
router.get('/wechat-robot/:robotId/favorites', WeChatRobotController.getFavorites || placeholder);
router.post('/wechat-robot/:robotId/favorites/sync', WeChatRobotController.syncFavorites || placeholder);
router.delete('/wechat-robot/:robotId/favorites/:id', WeChatRobotController.deleteFavorite || placeholder);

// 视频号
router.get('/wechat-robot/:robotId/finder', WeChatRobotController.getFinder || placeholder);
router.post('/wechat-robot/:robotId/finder/search', WeChatRobotController.searchFinder || placeholder);

// 素材库
router.get('/wechat-robot/materials', WeChatRobotController.getMaterials);
router.get('/wechat-robot/material-categories', WeChatRobotController.getMaterialCategories);
router.post('/wechat-robot/materials', WeChatRobotController.saveMaterial);
router.delete('/wechat-robot/materials/:id', WeChatRobotController.deleteMaterial);

// 定时发送
router.get('/wechat-robot/:robotId/scheduled-tasks', WeChatRobotController.getScheduledTasks);
router.post('/wechat-robot/:robotId/scheduled-tasks', WeChatRobotController.saveScheduledTask);
router.delete('/wechat-robot/:robotId/scheduled-tasks/:taskId', WeChatRobotController.deleteScheduledTask);
router.get('/wechat-robot/:robotId/scheduled-tasks/:taskId/logs', WeChatRobotController.getTaskLogs);

// ============ 地图配置（用户可读，支持Key轮换） ============
router.get('/map-settings', async (req, res) => {
  try {
    const db = require('../config/database');
    const MapKeyRotationService = require('../services/MapKeyRotationService');

    const rows = await db.query('SELECT default_center_lat, default_center_lng, default_zoom, is_enabled FROM system_map_settings LIMIT 1');
    const row = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0][0] : rows[0];

    const keyGroup = await MapKeyRotationService.getCurrentKeyGroup('js_api_key');

    if (keyGroup && keyGroup.js_api_key) {
      return res.json({ success: true, data: {
        amap_js_key: keyGroup.js_api_key,
        amap_security_key: keyGroup.security_js_key || '',
        default_lat: parseFloat(row?.default_center_lat) || 31.2304,
        default_lng: parseFloat(row?.default_center_lng) || 121.4737,
        default_zoom: parseInt(row?.default_zoom) || 12,
        enabled: row ? row.is_enabled === 1 : true,
      }});
    }

    if (!row) {
      return res.json({ success: true, data: { amap_js_key: '', amap_security_key: '', enabled: false } });
    }

    const fallbackRows = await db.query('SELECT js_api_key, security_js_key FROM system_map_settings LIMIT 1');
    const fallbackRow = Array.isArray(fallbackRows) && Array.isArray(fallbackRows[0]) ? fallbackRows[0][0] : fallbackRows[0];

    return res.json({ success: true, data: {
      amap_js_key: fallbackRow?.js_api_key || '',
      amap_security_key: fallbackRow?.security_js_key || '',
      default_lat: parseFloat(row.default_center_lat) || 31.2304,
      default_lng: parseFloat(row.default_center_lng) || 121.4737,
      default_zoom: parseInt(row.default_zoom) || 12,
      enabled: row.is_enabled === 1,
    }});
  } catch (err) {
    return res.json({ success: true, data: { amap_js_key: '', amap_security_key: '', enabled: false } });
  }
});

// ============ 朋友圈解析&房源（需要「快速找房」或「房源库管理」任一权限） ============
const parsedPropsGuard = requireAnyFeatureAccess(['quick-search', 'property-library']);
router.get('/expat/parsed-properties', parsedPropsGuard, WeChatRobotPluginController.getParsedProperties);
router.get('/expat/parsed-properties/stats', parsedPropsGuard, WeChatRobotPluginController.getParsedPropertyStats);
router.get('/expat/parsed-properties/map', parsedPropsGuard, WeChatRobotPluginController.getParsedMapProperties);
router.get('/expat/parsed-properties/filters', parsedPropsGuard, WeChatRobotPluginController.getParsedPropertyFilters);
router.get('/expat/parsed-properties/search-poi', parsedPropsGuard, WeChatRobotPluginController.searchCommunityPOI);
router.post('/expat/parsed-properties/import-to-poi', parsedPropsGuard, WeChatRobotPluginController.importToPOI);
router.post('/expat/parsed-properties/bulk-reprocess', parsedPropsGuard, WeChatRobotPluginController.bulkReprocessCommunity);
router.put('/expat/parsed-properties/:id', parsedPropsGuard, WeChatRobotPluginController.updateParsedProperty);
router.delete('/expat/parsed-properties/:id', parsedPropsGuard, WeChatRobotPluginController.deleteParsedProperty);
router.post('/expat/parsed-properties/batch-delete', parsedPropsGuard, WeChatRobotPluginController.batchDeleteParsedProperties);
router.post('/expat/parse-moments', parsedPropsGuard, WeChatRobotPluginController.parseMoments);

// 搜索列表（需要「快速找房」功能权限）
const quickSearchGuard = requireFeatureAccess('quick-search');
router.get('/expat/search-lists', quickSearchGuard, WeChatRobotPluginController.getSearchLists);
router.post('/expat/search-lists', quickSearchGuard, WeChatRobotPluginController.createSearchList);
router.delete('/expat/search-lists/:id', quickSearchGuard, WeChatRobotPluginController.deleteSearchList);

// ============ 推荐返利 ============
router.get('/referral', ctrl(ReferralController, 'getReferralCode'));
router.get('/referral/stats', ctrl(ReferralController, 'getReferralStats'));

// ============ 订单管理 ============
router.get('/orders', ctrl(OrderController, 'getOrders'));
router.get('/orders/:id/status', ctrl(OrderController, 'getOrderStatus'));
router.get('/orders/:id', ctrl(OrderController, 'getOrderDetail'));
router.post('/orders/:id/cancel', ctrl(OrderController, 'cancelOrder'));

// ============ 账户余额 ============
router.get('/balance', ctrl(BalanceController, 'getBalance'));
router.get('/balance/transactions', ctrl(BalanceController, 'getTransactions'));
router.post('/balance/recharge', ctrl(BalanceController, 'createRechargeOrder'));

// ============ 积分 ============
router.get('/points', ctrl(PointsController, 'getPoints'));
router.get('/points/history', ctrl(PointsController, 'getPointsHistory'));

// ============ 服务市场 ============
router.get('/service-market', ctrl(ServiceMarketController, 'getServices'));
router.post('/service-market/purchase', ctrl(ServiceMarketController, 'purchaseService'));

// ============ 通知 ============
router.get('/notifications', ctrl(UserNotificationController, 'getNotifications'));
router.put('/notifications/:id/read', ctrl(UserNotificationController, 'markRead'));
router.put('/notifications/read-all', ctrl(UserNotificationController, 'markAllRead'));
router.delete('/notifications/:id', ctrl(UserNotificationController, 'deleteNotification'));

// ============ 收藏 ============
router.get('/favorites', ctrl(FavoriteController, 'getFavorites'));
router.get('/favorites/check', ctrl(FavoriteController, 'checkFavorite'));
router.post('/favorites', ctrl(FavoriteController, 'addFavorite'));
router.delete('/favorites/:id', ctrl(FavoriteController, 'removeFavorite'));

// ============ 关注经纪人 ============
router.get('/followed-agents', ctrl(FollowController, 'getFollowedAgents'));
router.post('/follow-agent', ctrl(FollowController, 'followAgent'));
router.post('/unfollow-agent', ctrl(FollowController, 'unfollowAgent'));

// ============ 插件中心 ============
router.get('/plugin-center', ctrl(PluginCenterController, 'getPlugins'));
router.get('/plugin-center/categories', ctrl(PluginCenterController, 'getCategories'));
router.post('/plugin-center/install', ctrl(PluginCenterController, 'installPlugin'));
router.post('/plugin-center/uninstall', ctrl(PluginCenterController, 'uninstallPlugin'));
router.put('/plugin-center/:id/settings', ctrl(PluginCenterController, 'updateSettings'));

// ============ 插件功能执行（固定路由在前，参数路由在后） ============
router.post('/plugin-exec/parse-media', ctrl(PluginExecuteController, 'parseMediaUrl'));
router.post('/plugin-exec/ai-description', ctrl(PluginExecuteController, 'generateAiDescription'));
router.post('/plugin-exec/translate', ctrl(PluginExecuteController, 'translateText'));
router.get('/plugin-exec/crm/clients', ctrl(PluginExecuteController, 'getCrmClients'));
router.get('/plugin-exec/crm/client/:clientId', ctrl(PluginExecuteController, 'getCrmClientDetail'));
router.post('/plugin-exec/crm/client', ctrl(PluginExecuteController, 'saveCrmClient'));
router.post('/plugin-exec/crm/client/:clientId/followup', ctrl(PluginExecuteController, 'addCrmFollowup'));
router.delete('/plugin-exec/crm/client/:clientId/followup/:followupId', ctrl(PluginExecuteController, 'deleteCrmFollowup'));
router.put('/plugin-exec/crm/client/:clientId/pin', ctrl(PluginExecuteController, 'toggleCrmPin'));
router.put('/plugin-exec/crm/client/:clientId/importance', ctrl(PluginExecuteController, 'setCrmImportance'));
router.put('/plugin-exec/crm/reorder', ctrl(PluginExecuteController, 'reorderCrmClients'));
router.post('/plugin-exec/crm/client/:clientId/properties', ctrl(PluginExecuteController, 'saveCrmSentProperties'));
router.get('/plugin-exec/crm/properties-search', ctrl(PluginExecuteController, 'searchCrmProperties'));

// ============ 需求订阅插件 ============
router.get('/plugin-exec/subscribe/list', ctrl(PluginExecuteController, 'getSubscriptions'));
router.post('/plugin-exec/subscribe/save', ctrl(PluginExecuteController, 'saveSubscription'));
router.put('/plugin-exec/subscribe/:subId/status', ctrl(PluginExecuteController, 'toggleSubscriptionStatus'));
router.post('/plugin-exec/subscribe/:subId/match', ctrl(PluginExecuteController, 'runSubscriptionMatch'));
router.post('/plugin-exec/subscribe/:subId/read', ctrl(PluginExecuteController, 'markSubscriptionRead'));

router.get('/plugin-exec/analytics', ctrl(PluginExecuteController, 'getAnalytics'));
router.post('/plugin-exec/seo-analyze', ctrl(PluginExecuteController, 'analyzeSeo'));
router.get('/plugin-exec/:slug/data', ctrl(PluginExecuteController, 'getData'));
router.post('/plugin-exec/:slug/data', ctrl(PluginExecuteController, 'saveData'));
router.delete('/plugin-exec/:slug/data/:dataId', ctrl(PluginExecuteController, 'deleteData'));

// ============ 试用状态检查 ============
router.get('/trial-status', async (req, res) => {
  try {
    const db = require('../config/database');
    const [user] = await db.query(
      'SELECT is_trial, trial_days, trial_start_date, trial_end_date FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user || !user.is_trial) {
      return res.json({ success: true, data: { is_trial: false, expired: false } });
    }
    const now = new Date();
    const endDate = user.trial_end_date ? new Date(user.trial_end_date) : null;
    const expired = endDate ? now > endDate : false;
    const remainingDays = endDate ? Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))) : 0;
    return res.json({ success: true, data: {
      is_trial: true,
      expired,
      trial_days: user.trial_days,
      remaining_days: remainingDays,
      trial_start_date: user.trial_start_date,
      trial_end_date: user.trial_end_date,
    }});
  } catch (e) {
    return res.json({ success: true, data: { is_trial: false, expired: false } });
  }
});

// ============ 功能模块（会员中心） ============
router.get('/feature-modules', ctrl(FeatureModuleController, 'getModules'));
router.get('/feature-modules/check/:slug', ctrl(FeatureModuleController, 'checkAccess'));
router.get('/feature-modules/subscriptions', ctrl(FeatureModuleController, 'getMySubscriptions'));
router.post('/feature-modules/redeem', ctrl(FeatureModuleController, 'redeemCardKey'));
router.post('/feature-modules/redeem-balance', ctrl(FeatureModuleController, 'redeemBalanceCardKey'));
router.post('/feature-modules/order', ctrl(FeatureModuleController, 'createOrder'));

// ============ 链接设置（需要「房源库管理」功能权限） ============
router.get('/link-settings', propertyLibraryGuard, async (req, res) => {
  try {
    const db = require('../config/database');
    const userId = req.user.id;
    let rows = await db.query(
      'SELECT settings FROM wechat_robot_expat_link_settings WHERE user_id = ? AND robot_id = 0 LIMIT 1',
      [userId]
    );
    if (!rows || !rows.length) {
      rows = await db.query(
        'SELECT settings FROM wechat_robot_expat_link_settings WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
        [userId]
      );
    }
    let dbData = {};
    if (rows && rows.length && rows[0].settings) {
      dbData = typeof rows[0].settings === 'string' ? JSON.parse(rows[0].settings) : rows[0].settings;
    }
    const data = {
      display_fields: dbData.fields || dbData.display_fields || {},
      show_contact_us: dbData.showContactUs !== undefined ? dbData.showContactUs : (dbData.show_contact_us !== undefined ? dbData.show_contact_us : true),
      contact: dbData.contact || {},
      default_language: dbData.defaultLanguage || dbData.default_language || 'en',
    };
    res.json({ success: true, data });
  } catch (e) {
    console.error('[link-settings GET] error:', e.message);
    res.json({ success: true, data: {} });
  }
});
router.post('/link-settings', propertyLibraryGuard, async (req, res) => {
  try {
    const db = require('../config/database');
    const userId = req.user.id;
    const settingsObj = {
      fields: req.body.display_fields || {},
      showContactUs: req.body.show_contact_us !== undefined ? req.body.show_contact_us : true,
      contact: req.body.contact || {},
      defaultLanguage: req.body.default_language || 'en',
    };
    const settingsJson = JSON.stringify(settingsObj);

    const existing = await db.query(
      'SELECT id FROM wechat_robot_expat_link_settings WHERE user_id = ? AND robot_id = 0 LIMIT 1',
      [userId]
    );

    if (existing && existing.length) {
      await db.query(
        'UPDATE wechat_robot_expat_link_settings SET settings = ?, updated_at = NOW() WHERE user_id = ? AND robot_id = 0',
        [settingsJson, userId]
      );
    } else {
      await db.query(
        'INSERT INTO wechat_robot_expat_link_settings (user_id, robot_id, settings, created_at, updated_at) VALUES (?, 0, ?, NOW(), NOW())',
        [userId, settingsJson]
      );
    }

    res.json({ success: true, message: '保存成功' });
  } catch (e) {
    console.error('[link-settings POST] error:', e.message);
    res.status(500).json({ success: false, message: '保存失败: ' + e.message });
  }
});

// ============ 分享记录 ============
router.get('/expat/share-history', async (req, res) => {
  try {
    const db = require('../config/database');
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 20;
    const offset = (page - 1) * pageSize;

    const [countRows] = await db.query(
      'SELECT COUNT(*) as total FROM wechat_robot_share_history WHERE user_id = ?',
      [userId]
    );
    const total = countRows[0]?.total || 0;

    let items = [];
    if (total > 0) {
      const [rows] = await db.query(
        'SELECT * FROM wechat_robot_share_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [userId, pageSize, offset]
      );
      items = rows;
    }

    res.json({ success: true, data: { items, total, page, page_size: pageSize } });
  } catch (e) {
    res.json({ success: true, data: { items: [], total: 0 } });
  }
});

// ============ 朋友圈刷新设置 ============
router.get('/wechat-robot/:robotId/moments/refresh-settings', async (req, res) => {
  try {
    const db = require('../config/database');
    const rows = await db.query(
      'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
      [`moments_refresh_${req.user.id}_${req.params.robotId}`]
    );
    const resultRows = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
    const data = resultRows && resultRows.length ? JSON.parse(resultRows[0].setting_value || '{}') : {};
    res.json({ success: true, data });
  } catch {
    res.json({ success: true, data: {} });
  }
});
router.post('/wechat-robot/:robotId/moments/refresh-settings', async (req, res) => {
  try {
    const db = require('../config/database');
    const key = `moments_refresh_${req.user.id}_${req.params.robotId}`;
    const value = JSON.stringify(req.body);
    await db.query(
      'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
      [key, value, value]
    );
    res.json({ success: true, message: '保存成功' });
  } catch {
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

router.post('/wechat-robot/:robotId/moments/refresh-now', async (req, res) => {
  try {
    const WeChatRobotAccount = require('../models/WeChatRobotAccount');
    const WeChatRobotService = require('../services/WeChatRobotService');
    const account = await WeChatRobotAccount.findById(req.params.robotId);
    if (!account) return res.status(404).json({ success: false, message: '账号不存在' });

    const { query: dbQuery } = require('../config/database');
    const isAdmin = req.user && req.user.role === 'admin';
    let config = await WeChatRobotService.getApiConfig(isAdmin ? account.user_id : req.user.id);
    if (!config || !config.api_url) {
      const rows = await dbQuery('SELECT * FROM wechat_robot_api_config WHERE user_id = 0 LIMIT 1');
      config = rows && rows.length > 0 ? rows[0] : null;
    }
    if (!config || !config.api_url) return res.status(400).json({ success: false, message: '请先配置API' });

    const appId = account.device_id || account.app_id || '';
    if (!appId) return res.status(400).json({ success: false, message: '设备ID不存在' });
    const result = await WeChatRobotService.getMoments(config.api_url, config.token, appId);
    res.json({ success: true, data: result, message: '刷新成功' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || '刷新失败' });
  }
});

router.get('/wechat-robot/:robotId/moments/refresh-logs', async (req, res) => {
  try {
    const db = require('../config/database');
    const { page = 1, pageSize = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const countRows = await db.query(
      'SELECT COUNT(*) as total FROM wechat_robot_moments_refresh_logs WHERE robot_id = ?',
      [req.params.robotId]
    );
    const totalArr = Array.isArray(countRows) && Array.isArray(countRows[0]) ? countRows[0] : countRows;
    const total = totalArr && totalArr[0] ? totalArr[0].total : 0;
    let items = [];
    if (total > 0) {
      const rows = await db.query(
        `SELECT id, refresh_type, status, moments_count, new_count, duration_ms, error_message, created_at
         FROM wechat_robot_moments_refresh_logs
         WHERE robot_id = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [req.params.robotId, parseInt(pageSize), offset]
      );
      items = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : (rows || []);
    }
    res.json({ success: true, data: items, total, pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (e) {
    res.json({ success: true, data: [], total: 0 });
  }
});

router.get('/wechat-robot/:robotId/moments/refresh-stats', async (req, res) => {
  try {
    const db = require('../config/database');
    const countRows = await db.query(
      'SELECT COUNT(*) as cnt FROM wechat_robot_moments_refresh_logs WHERE robot_id = ? AND DATE(created_at) = CURDATE()',
      [req.params.robotId]
    );
    const countArr = Array.isArray(countRows) && Array.isArray(countRows[0]) ? countRows[0] : countRows;
    const newRows = await db.query(
      'SELECT COALESCE(SUM(new_count), 0) as cnt FROM wechat_robot_moments_refresh_logs WHERE robot_id = ? AND DATE(created_at) = CURDATE()',
      [req.params.robotId]
    );
    const newArr = Array.isArray(newRows) && Array.isArray(newRows[0]) ? newRows[0] : newRows;
    res.json({
      success: true,
      data: {
        today_refresh_count: countArr && countArr[0] ? countArr[0].cnt : 0,
        today_new_moments: newArr && newArr[0] ? newArr[0].cnt : 0,
      },
    });
  } catch {
    res.json({ success: true, data: { today_refresh_count: 0, today_new_moments: 0 } });
  }
});

module.exports = router;
