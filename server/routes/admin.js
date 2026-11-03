/**
 * 管理后台路由
 */
const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const AdminDashboardController = require('../controllers/admin/AdminDashboardController');
const PropertySettingsController = require('../controllers/admin/PropertySettingsController');
const SeoOperationsController = require('../controllers/admin/SeoOperationsController');

/* ---- 尝试加载可选控制器 ---- */
let ArticleController, UserManagementController, WeChatRobotController, MembershipController;
let MediaController, StorageConfigController, PaymentConfigController, AuthConfigController;
let NotificationController, HomepageSettingsController, WebsiteSettingsController;
let PropertyLibraryController, LanguageSettingsController, ThemeController;
let AdminSettingsController, MenuManagementController, OrderControllerAdmin;
let ArticleCategoryController, AdminWeChatOAController, AdminProfileController;
let FloatContactController, ExpatPropertyScraperController, ScheduledTaskController;
let FriendLinksController, PointsSettingsController, ReferralSettingsController;
let MarketingSettingsController, DemandManageController, PluginManagementController;
let SystemVersionController, DatabaseFixController;
let MobileAppController, MiniProgramController, TrialManagementController;
let FeatureModuleController, CardKeyController, PluginDashboardController;

try { ArticleController = require('../controllers/admin/ArticleController'); } catch { ArticleController = null; }
try { UserManagementController = require('../controllers/admin/UserManagementController'); } catch { UserManagementController = null; }
try { WeChatRobotController = require('../controllers/admin/WeChatRobotController'); } catch { WeChatRobotController = null; }
try { MembershipController = require('../controllers/admin/MembershipController'); } catch { MembershipController = null; }
try { MediaController = require('../controllers/admin/MediaController'); } catch { MediaController = null; }
try { StorageConfigController = require('../controllers/admin/StorageConfigController'); } catch { StorageConfigController = null; }
try { PaymentConfigController = require('../controllers/admin/PaymentConfigController'); } catch { PaymentConfigController = null; }
try { AuthConfigController = require('../controllers/admin/AuthConfigController'); } catch { AuthConfigController = null; }
try { NotificationController = require('../controllers/admin/NotificationController'); } catch { NotificationController = null; }
try { HomepageSettingsController = require('../controllers/admin/HomepageSettingsController'); } catch { HomepageSettingsController = null; }
try { WebsiteSettingsController = require('../controllers/admin/WebsiteSettingsController'); } catch { WebsiteSettingsController = null; }
try { PropertyLibraryController = require('../controllers/admin/PropertyLibraryController'); } catch { PropertyLibraryController = null; }
try { LanguageSettingsController = require('../controllers/admin/LanguageSettingsController'); } catch { LanguageSettingsController = null; }
try { ThemeController = require('../controllers/admin/ThemeController'); } catch { ThemeController = null; }
try { AdminSettingsController = require('../controllers/admin/SettingsController'); } catch { AdminSettingsController = null; }
try { MenuManagementController = require('../controllers/admin/MenuManagementController'); } catch { MenuManagementController = null; }
try { OrderControllerAdmin = require('../controllers/admin/OrderController'); } catch { OrderControllerAdmin = null; }
try { ArticleCategoryController = require('../controllers/admin/ArticleCategoryController'); } catch { ArticleCategoryController = null; }
try { AdminWeChatOAController = require('../controllers/admin/WeChatOfficialAccountController'); } catch { AdminWeChatOAController = null; }
try { AdminProfileController = require('../controllers/admin/ProfileController'); } catch { AdminProfileController = null; }
try { FloatContactController = require('../controllers/admin/FloatContactController'); } catch { FloatContactController = null; }
try { ExpatPropertyScraperController = require('../controllers/admin/ExpatPropertyScraperController'); } catch { ExpatPropertyScraperController = null; }
try { ScheduledTaskController = require('../controllers/admin/ScheduledTaskController'); } catch { ScheduledTaskController = null; }
try { FriendLinksController = require('../controllers/admin/FriendLinksController'); } catch { FriendLinksController = null; }
try { PointsSettingsController = require('../controllers/admin/PointsSettingsController'); } catch { PointsSettingsController = null; }
try { ReferralSettingsController = require('../controllers/admin/ReferralSettingsController'); } catch { ReferralSettingsController = null; }
try { MarketingSettingsController = require('../controllers/admin/MarketingSettingsController'); } catch { MarketingSettingsController = null; }
try { DemandManageController = require('../controllers/admin/DemandManageController'); } catch { DemandManageController = null; }
try { PluginManagementController = require('../controllers/admin/PluginManagementController'); } catch { PluginManagementController = null; }
try { SystemVersionController = require('../controllers/admin/SystemVersionController'); } catch { SystemVersionController = null; }
try { DatabaseFixController = require('../controllers/admin/DatabaseFixController'); } catch { DatabaseFixController = null; }
try { MobileAppController = require('../controllers/admin/MobileAppController'); } catch { MobileAppController = null; }
try { MiniProgramController = require('../controllers/admin/MiniProgramController'); } catch { MiniProgramController = null; }
try { TrialManagementController = require('../controllers/admin/TrialManagementController'); } catch { TrialManagementController = null; }
try { FeatureModuleController = require('../controllers/admin/FeatureModuleController'); } catch { FeatureModuleController = null; }
try { CardKeyController = require('../controllers/admin/CardKeyController'); } catch { CardKeyController = null; }
try { PluginDashboardController = require('../controllers/admin/PluginDashboardController'); } catch { PluginDashboardController = null; }

const placeholder = (req, res) => res.json({ success: false, message: '功能开发中' });
const ctrl = (c, method) => (c && c[method]) ? c[method].bind(c) : placeholder;

router.use(requireAdmin);

// ============ 仪表盘 ============
router.get('/dashboard', (req, res) => AdminDashboardController.getDashboard(req, res));
router.get('/seo-operations/overview', SeoOperationsController.overview);
router.get('/seo-operations/authority-config', SeoOperationsController.getAuthorityConfig);
router.put('/seo-operations/authority-config', SeoOperationsController.saveAuthorityConfig);
router.post('/seo-operations/authority-config/test', SeoOperationsController.testAuthorityConfig);
router.get('/seo-operations/sites', SeoOperationsController.sites);
router.get('/seo-operations/scans', SeoOperationsController.scans);
router.get('/seo-operations/issues', SeoOperationsController.issues);
router.put('/seo-operations/issues/:id/status', SeoOperationsController.updateIssueStatus);
router.get('/seo-operations/plans', SeoOperationsController.plans);
router.put('/seo-operations/plans/:id', SeoOperationsController.updatePlan);
router.get('/seo-operations/usage', SeoOperationsController.usage);
router.get('/seo-operations/audit-logs', SeoOperationsController.auditLogs);
router.get('/seo-operations/connection-requests', SeoOperationsController.connectionRequests);
router.put('/seo-operations/connection-requests/:id', SeoOperationsController.reviewConnection);
router.get('/seo-operations/ad-programs', SeoOperationsController.adPrograms);
router.put('/seo-operations/ad-programs/:id', SeoOperationsController.reviewAdProgram);

// ============ 用户管理 ============
router.get('/users', ctrl(UserManagementController, 'getUsers'));
router.get('/users-stats', ctrl(UserManagementController, 'getStats'));
router.post('/users/batch-action', ctrl(UserManagementController, 'batchAction'));
router.post('/users/create', ctrl(UserManagementController, 'createUser'));
router.get('/users/:id', ctrl(UserManagementController, 'getUserDetail'));
router.put('/users/:id', ctrl(UserManagementController, 'updateUser'));
router.delete('/users/:id', ctrl(UserManagementController, 'deleteUser'));
router.put('/users/:id/status', ctrl(UserManagementController, 'updateStatus'));
router.put('/users/:id/role', ctrl(UserManagementController, 'updateRole'));
router.post('/users/:id/reset-password', ctrl(UserManagementController, 'resetPassword'));

// ============ 文章管理 ============
router.get('/articles', ctrl(ArticleController, 'getArticles'));
router.post('/articles', ctrl(ArticleController, 'createArticle'));
router.put('/articles/:id', ctrl(ArticleController, 'updateArticle'));
router.delete('/articles/:id', ctrl(ArticleController, 'deleteArticle'));
router.get('/article-categories', ctrl(ArticleController, 'getCategories'));
router.post('/article-categories', ctrl(ArticleController, 'saveCategory'));

// ============ 房源信息设置 ============
router.get('/property-settings/districts', PropertySettingsController.getDistricts);
router.post('/property-settings/districts', PropertySettingsController.saveDistrict);
router.delete('/property-settings/districts/:id', PropertySettingsController.deleteDistrict);
router.get('/property-settings/metro-lines', PropertySettingsController.getMetroLines);
router.post('/property-settings/metro-lines', PropertySettingsController.saveMetroLine);
router.delete('/property-settings/metro-lines/:id', PropertySettingsController.deleteMetroLine);
router.get('/property-settings/metro-stations', PropertySettingsController.getMetroStations);
router.post('/property-settings/metro-stations', PropertySettingsController.saveMetroStation);
router.delete('/property-settings/metro-stations/:id', PropertySettingsController.deleteMetroStation);
router.get('/property-settings/ai-parse-config', PropertySettingsController.getAIParseConfig);
router.post('/property-settings/ai-parse-config', PropertySettingsController.saveAIParseConfig);
router.get('/property-settings/ai-parse-logs', PropertySettingsController.getAIParseLogs);
router.delete('/property-settings/ai-parse-logs', PropertySettingsController.clearAIParseLogs);

// ============ 小区POI数据管理 ============
const multer = require('multer');
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
router.get('/property-settings/community-poi', PropertySettingsController.getCommunityPOI.bind(PropertySettingsController));
router.get('/property-settings/community-poi-recycle-bin', PropertySettingsController.getCommunityPOIRecycleBin.bind(PropertySettingsController));
router.post('/property-settings/community-poi', PropertySettingsController.saveCommunityPOI.bind(PropertySettingsController));
router.delete('/property-settings/community-poi/:id', PropertySettingsController.deleteCommunityPOI.bind(PropertySettingsController));
router.post('/property-settings/community-poi/:id/restore', PropertySettingsController.restoreCommunityPOI.bind(PropertySettingsController));
router.post('/property-settings/community-poi/restore', PropertySettingsController.restoreCommunityPOI.bind(PropertySettingsController));
router.post('/property-settings/community-poi/batch-delete', PropertySettingsController.batchDeleteCommunityPOI.bind(PropertySettingsController));
router.get('/property-settings/community-poi-stats', PropertySettingsController.getCommunityPOIStats.bind(PropertySettingsController));
router.post('/property-settings/community-poi/import', csvUpload.single('file'), PropertySettingsController.importCommunityCSV.bind(PropertySettingsController));
const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
router.post('/property-settings/community-poi/import-excel', excelUpload.single('file'), PropertySettingsController.importCommunityExcel.bind(PropertySettingsController));
router.delete('/property-settings/community-poi-clear', PropertySettingsController.clearCommunityPOI.bind(PropertySettingsController));
router.post('/property-settings/community-poi/:id/enrich', PropertySettingsController.enrichPOIFromAmap.bind(PropertySettingsController));
router.post('/property-settings/community-poi/:id/enrich-force', PropertySettingsController.enrichPOIFromAmapForce.bind(PropertySettingsController));
router.post('/property-settings/community-poi/batch-enrich', PropertySettingsController.batchEnrichPOI.bind(PropertySettingsController));

// ============ 包租公司名单管理 ============
const { rentalCompanyCtrl } = require('../controllers/admin/PropertySettingsController');
const { publisherContactCtrl } = require('../controllers/admin/PropertySettingsController');
router.get('/property-settings/rental-companies', rentalCompanyCtrl.getList.bind(rentalCompanyCtrl));
router.post('/property-settings/rental-companies', rentalCompanyCtrl.save.bind(rentalCompanyCtrl));
router.delete('/property-settings/rental-companies/:id', rentalCompanyCtrl.remove.bind(rentalCompanyCtrl));
router.post('/property-settings/rental-companies/batch-import', rentalCompanyCtrl.batchImport.bind(rentalCompanyCtrl));
router.post('/property-settings/rental-companies/batch-delete', rentalCompanyCtrl.batchDelete.bind(rentalCompanyCtrl));
router.get('/property-settings/publisher-contacts', publisherContactCtrl.getList.bind(publisherContactCtrl));
router.post('/property-settings/publisher-contacts', publisherContactCtrl.save.bind(publisherContactCtrl));
router.delete('/property-settings/publisher-contacts/:id', publisherContactCtrl.remove.bind(publisherContactCtrl));
router.post('/property-settings/publisher-contacts/batch-import', publisherContactCtrl.batchImport.bind(publisherContactCtrl));
router.post('/property-settings/publisher-contacts/batch-delete', publisherContactCtrl.batchDelete.bind(publisherContactCtrl));
router.post('/property-settings/publisher-contacts/sync', publisherContactCtrl.syncFromParsed.bind(publisherContactCtrl));

// ============ 地理别名映射管理 ============
const { districtAliasCtrl } = require('../controllers/admin/PropertySettingsController');
router.get('/property-settings/district-alias', districtAliasCtrl.getList.bind(districtAliasCtrl));
router.post('/property-settings/district-alias', districtAliasCtrl.save.bind(districtAliasCtrl));
router.delete('/property-settings/district-alias/:id', districtAliasCtrl.remove.bind(districtAliasCtrl));
router.post('/property-settings/district-alias/batch-delete', districtAliasCtrl.batchDelete.bind(districtAliasCtrl));
router.post('/property-settings/district-alias/batch-import', districtAliasCtrl.batchImport.bind(districtAliasCtrl));
router.get('/property-settings/district-alias-districts', districtAliasCtrl.getDistrictOptions.bind(districtAliasCtrl));

// ============ 朋友圈数据POI校对 ============
router.post('/parsed-properties/:id/calibrate', PropertySettingsController.calibrateParsedProperty.bind(PropertySettingsController));
router.post('/parsed-properties/batch-calibrate', PropertySettingsController.batchCalibrateParsedProperties.bind(PropertySettingsController));
router.get('/parsed-properties/calibrate-stats', PropertySettingsController.getCalibrateStats.bind(PropertySettingsController));

// ============ AI模型管理 ============
router.get('/ai-models', PropertySettingsController.getAIModels);
router.post('/ai-models', PropertySettingsController.saveAIModel);
router.delete('/ai-models/:id', PropertySettingsController.deleteAIModel);
router.post('/ai-models/:id/test', PropertySettingsController.testAIModel);

// ============ 微信机器人管理 ============
router.get('/wechat-robot/accounts', ctrl(WeChatRobotController, 'getAllAccounts'));
router.get('/wechat-robot/stats', ctrl(WeChatRobotController, 'getStatistics'));
router.get('/wechat-robot/api-config', ctrl(WeChatRobotController, 'getApiConfig'));
router.post('/wechat-robot/api-config', ctrl(WeChatRobotController, 'saveApiConfig'));
router.post('/wechat-robot/accounts', ctrl(WeChatRobotController, 'addAccount'));
router.delete('/wechat-robot/accounts/:id', ctrl(WeChatRobotController, 'deleteAccount'));
router.post('/wechat-robot/accounts/:id/set-default', ctrl(WeChatRobotController, 'setDefaultAccount'));
router.get('/wechat-robot/:robotId/qrcode', ctrl(WeChatRobotController, 'getLoginQrCode'));
router.get('/wechat-robot/:robotId/login-status', ctrl(WeChatRobotController, 'checkLoginStatus'));
router.get('/wechat-robot/:robotId/device-status', ctrl(WeChatRobotController, 'checkDeviceStatus'));
router.post('/wechat-robot/:robotId/logout', ctrl(WeChatRobotController, 'logoutAccount'));
router.get('/wechat-robot/:robotId/contacts', ctrl(WeChatRobotController, 'getContactsByRobotId'));
router.post('/wechat-robot/:robotId/contacts/sync', ctrl(WeChatRobotController, 'syncContacts'));
router.get('/wechat-robot/:robotId/conversations', ctrl(WeChatRobotController, 'getConversations'));
router.get('/wechat-robot/:robotId/messages/:contactWxid', ctrl(WeChatRobotController, 'getChatHistory'));
router.post('/wechat-robot/:robotId/messages', ctrl(WeChatRobotController, 'sendMessage'));
router.get('/wechat-robot/:robotId/groups', ctrl(WeChatRobotController, 'getGroups'));
router.post('/wechat-robot/:robotId/groups/sync', ctrl(WeChatRobotController, 'syncGroups'));
router.get('/wechat-robot/:robotId/moments', ctrl(WeChatRobotController, 'getMoments'));
router.post('/wechat-robot/:robotId/moments/refresh', ctrl(WeChatRobotController, 'refreshMoments'));
router.get('/wechat-robot/:robotId/moments/refresh-settings', ctrl(WeChatRobotController, 'getMomentsRefreshSettings'));
router.post('/wechat-robot/:robotId/moments/refresh-settings', ctrl(WeChatRobotController, 'saveMomentsRefreshSettings'));
router.post('/wechat-robot/:robotId/moments/refresh-now', ctrl(WeChatRobotController, 'refreshMomentsNow'));
router.get('/wechat-robot/:robotId/moments/refresh-logs', ctrl(WeChatRobotController, 'getMomentsRefreshLogs'));
router.get('/wechat-robot/:robotId/moments/refresh-stats', ctrl(WeChatRobotController, 'getMomentsRefreshStats'));
router.get('/wechat-robot/:robotId/favorites', ctrl(WeChatRobotController, 'getFavorites'));
router.post('/wechat-robot/:robotId/favorites/sync', ctrl(WeChatRobotController, 'syncFavorites'));
router.delete('/wechat-robot/:robotId/favorites/:id', ctrl(WeChatRobotController, 'deleteFavorite'));

// ============ 会员套餐 ============
router.get('/membership/packages', ctrl(MembershipController, 'getPackages'));
router.post('/membership/packages', ctrl(MembershipController, 'savePackage'));
router.delete('/membership/packages/:id', ctrl(MembershipController, 'deletePackage'));

// ============ 媒体管理 ============
// 注意：具体路径须写在 /media/:id 之前，避免 :id 吞掉 community-remove-image 等链式路径
router.get('/media', ctrl(MediaController, 'getAllMedia'));
router.get('/media/stats', ctrl(MediaController, 'getMediaStats'));
router.post('/media/upload', MediaController.getUploadMiddleware(), ctrl(MediaController, 'uploadMedia'));
router.get('/media/watermark', ctrl(MediaController, 'getWatermarkConfig'));
router.post('/media/watermark', ctrl(MediaController, 'saveWatermarkConfig'));
router.get('/media/community-images', ctrl(MediaController, 'getCommunityImages'));
router.post('/media/community-remove-image', ctrl(MediaController, 'removeCommunityPropertyImage'));
router.post('/media/community-add-image', MediaController.getUploadMiddleware(), ctrl(MediaController, 'addCommunityPropertyImage'));
router.post('/media/community-add-image-url', ctrl(MediaController, 'addCommunityPropertyImage'));
router.delete('/media/:id', ctrl(MediaController, 'deleteMedia'));

// ============ 存储配置 ============
router.get('/storage-config', ctrl(StorageConfigController, 'getStorageConfig'));
router.post('/storage-config', ctrl(StorageConfigController, 'saveStorageConfig'));
router.post('/storage-config/test', ctrl(StorageConfigController, 'testConnection'));

// ============ 支付配置 ============
router.get('/payment-config', ctrl(PaymentConfigController, 'getPaymentConfig'));
router.post('/payment-config', ctrl(PaymentConfigController, 'savePaymentConfig'));

// ============ 认证配置 ============
router.get('/auth-config', ctrl(AuthConfigController, 'getAuthConfig'));
router.get('/auth-config/statistics', ctrl(AuthConfigController, 'getStatistics'));
router.post('/auth-config', ctrl(AuthConfigController, 'saveAuthConfig'));
router.post('/auth-config/test-email', ctrl(AuthConfigController, 'testEmail'));

// ============ 通知 ============
router.get('/notifications', ctrl(NotificationController, 'getNotifications'));
router.post('/notifications', ctrl(NotificationController, 'createNotification'));

// ============ 首页设置 ============
router.get('/homepage-settings', ctrl(HomepageSettingsController, 'getSettings'));
router.post('/homepage-settings', ctrl(HomepageSettingsController, 'saveSettings'));

// ============ 网站设置 ============
router.get('/website-settings', ctrl(WebsiteSettingsController, 'getSiteSettings'));
router.post('/website-settings', ctrl(WebsiteSettingsController, 'saveSiteSettings'));

// ============ 房源库 ============
router.get('/property-library', ctrl(PropertyLibraryController, 'getProperties'));
router.get('/property-library/stats', ctrl(PropertyLibraryController, 'getStats'));
router.get('/property-library/publishers', ctrl(PropertyLibraryController, 'getPublishers'));
router.get('/property-library/recycle-bin', ctrl(PropertyLibraryController, 'getRecycleBin'));
router.get('/property-library/geocode-community', ctrl(PropertyLibraryController, 'geocodeCommunity'));
router.get('/property-library/default-image', ctrl(PropertyLibraryController, 'getDefaultImage'));
router.post('/property-library/default-image', MediaController ? MediaController.getUploadMiddleware() : (req, res, next) => next(), ctrl(PropertyLibraryController, 'setDefaultImage'));
router.get('/property-library/publish-settings', ctrl(PropertyLibraryController, 'getPublishSettings'));
router.post('/property-library/publish-settings', ctrl(PropertyLibraryController, 'savePublishSettings'));
router.get('/property-library/:id', ctrl(PropertyLibraryController, 'getPropertyDetail'));
router.put('/property-library/:id', ctrl(PropertyLibraryController, 'updateProperty'));
router.put('/property-library/:id/approve', ctrl(PropertyLibraryController, 'approveProperty'));
router.put('/property-library/:id/toggle-listing', ctrl(PropertyLibraryController, 'toggleListing'));
router.post('/property-library/:id/redownload-media', ctrl(PropertyLibraryController, 'redownloadMedia'));
router.delete('/property-library/:id', ctrl(PropertyLibraryController, 'deleteProperty'));
router.post('/property-library/batch-delete', ctrl(PropertyLibraryController, 'batchDelete'));
router.post('/property-library/batch-toggle-listing', ctrl(PropertyLibraryController, 'batchToggleListing'));
router.post('/property-library/restore', ctrl(PropertyLibraryController, 'restoreProperty'));
router.post('/property-library/batch-ai-parse', ctrl(PropertyLibraryController, 'batchAIParse'));
router.post('/property-library/batch-ai-deduplicate', ctrl(PropertyLibraryController, 'batchAIDeduplicate'));
router.post('/property-library/batch-redownload-media', ctrl(PropertyLibraryController, 'batchRedownloadMedia'));
router.post('/property-library/publish', ctrl(PropertyLibraryController, 'publishToLibrary'));
router.post('/property-library/unpublish', ctrl(PropertyLibraryController, 'unpublishFromLibrary'));
router.post('/property-library/upload-media', MediaController ? MediaController.getUploadMiddleware() : (req, res, next) => next(), ctrl(PropertyLibraryController, 'uploadPropertyMedia'));

// ============ 语言管理 ============
router.get('/languages', ctrl(LanguageSettingsController, 'getLanguages'));
router.post('/languages', ctrl(LanguageSettingsController, 'saveLanguage'));

// ============ 主题管理 ============
router.get('/themes', ctrl(ThemeController, 'getThemes'));
router.post('/themes/activate', ctrl(ThemeController, 'activateTheme'));

// ============ 系统设置 ============
router.get('/settings', PropertySettingsController.getSystemSettings);
router.post('/settings', PropertySettingsController.saveSystemSettings);

// ============ 链接页面显示设置 ============
router.get('/link-display-settings', PropertySettingsController.getLinkDisplaySettings);
router.post('/link-display-settings', PropertySettingsController.saveLinkDisplaySettings);

// ============ 通用设置（区别于PropertySettings） ============
router.get('/general-settings', ctrl(AdminSettingsController, 'getSettings'));
router.post('/general-settings', ctrl(AdminSettingsController, 'saveSettings'));
router.get('/mail-settings', ctrl(AdminSettingsController, 'getMailSettings'));
router.post('/mail-settings', ctrl(AdminSettingsController, 'saveMailSettings'));

// ============ 菜单管理 ============
router.get('/menus', ctrl(MenuManagementController, 'getMenus'));
router.post('/menus', ctrl(MenuManagementController, 'saveMenu'));
router.delete('/menus/:id', ctrl(MenuManagementController, 'deleteMenu'));
router.get('/menus/:menuId/items', ctrl(MenuManagementController, 'getMenuItems'));
router.post('/menus/:menuId/items', ctrl(MenuManagementController, 'saveMenuItem'));
router.delete('/menu-items/:id', ctrl(MenuManagementController, 'deleteMenuItem'));

// ============ 订单管理 ============
router.get('/orders', ctrl(OrderControllerAdmin, 'getOrders'));
router.get('/orders/stats', ctrl(OrderControllerAdmin, 'getOrderStats'));
router.get('/orders/:id', ctrl(OrderControllerAdmin, 'getOrderDetail'));
router.put('/orders/:id/status', ctrl(OrderControllerAdmin, 'updateOrderStatus'));

// ============ 文章分类管理（独立控制器） ============
router.get('/article-categories-manage', ctrl(ArticleCategoryController, 'getCategories'));
router.post('/article-categories-manage', ctrl(ArticleCategoryController, 'saveCategory'));
router.delete('/article-categories-manage/:id', ctrl(ArticleCategoryController, 'deleteCategory'));

// ============ 微信公众号管理 ============
router.get('/wechat-official-accounts', ctrl(AdminWeChatOAController, 'getAccounts'));
router.post('/wechat-official-accounts', ctrl(AdminWeChatOAController, 'addAccount'));
router.put('/wechat-official-accounts/:id', ctrl(AdminWeChatOAController, 'updateAccount'));
router.delete('/wechat-official-accounts/:id', ctrl(AdminWeChatOAController, 'deleteAccount'));
router.post('/wechat-official-accounts/:id/sync', ctrl(AdminWeChatOAController, 'syncArticles'));

// ============ 管理员个人资料 ============
router.get('/profile', ctrl(AdminProfileController, 'getProfile'));
router.put('/profile', ctrl(AdminProfileController, 'updateProfile'));
router.post('/profile/change-password', ctrl(AdminProfileController, 'changePassword'));


// ============ 悬浮联系方式 ============
router.get('/float-contact', ctrl(FloatContactController, 'getSettings'));
router.post('/float-contact', ctrl(FloatContactController, 'saveSettings'));

// ============ 房源采集管理 ============
router.get('/property-scraper/sources', ctrl(ExpatPropertyScraperController, 'getSources'));
router.post('/property-scraper/sources', ctrl(ExpatPropertyScraperController, 'saveSource'));
router.delete('/property-scraper/sources/:id', ctrl(ExpatPropertyScraperController, 'deleteSource'));
router.get('/property-scraper/tasks', ctrl(ExpatPropertyScraperController, 'getTasks'));
router.post('/property-scraper/start', ctrl(ExpatPropertyScraperController, 'startScraping'));

// ============ 友情链接 ============
router.get('/friend-links', ctrl(FriendLinksController, 'getLinks'));
router.post('/friend-links', ctrl(FriendLinksController, 'saveLink'));
router.put('/friend-links/:id', ctrl(FriendLinksController, 'saveLink'));
router.delete('/friend-links/:id', ctrl(FriendLinksController, 'deleteLink'));

// ============ 积分设置 ============
router.get('/points-settings', ctrl(PointsSettingsController, 'getSettings'));
router.post('/points-settings', ctrl(PointsSettingsController, 'saveSettings'));

// ============ 推荐设置 ============
router.get('/referral-settings', ctrl(ReferralSettingsController, 'getSettings'));
router.post('/referral-settings', ctrl(ReferralSettingsController, 'saveSettings'));

// ============ 营销设置 ============
router.get('/marketing-settings', ctrl(MarketingSettingsController, 'getSettings'));
router.post('/marketing-settings', ctrl(MarketingSettingsController, 'saveSettings'));

// ============ 租客需求管理 ============
router.get('/demands', ctrl(DemandManageController, 'getDemands'));
router.put('/demands/:id/status', ctrl(DemandManageController, 'updateStatus'));
router.delete('/demands/:id', ctrl(DemandManageController, 'deleteDemand'));

// ============ 插件管理 ============
router.get('/plugins', ctrl(PluginManagementController, 'getPlugins'));
router.post('/plugins', ctrl(PluginManagementController, 'savePlugin'));
router.put('/plugins/:id', ctrl(PluginManagementController, 'savePlugin'));
router.delete('/plugins/:id', ctrl(PluginManagementController, 'deletePlugin'));
router.get('/plugin-categories', ctrl(PluginManagementController, 'getCategories'));

// ============ 系统版本 ============
router.get('/system-version', ctrl(SystemVersionController, 'getVersions'));
router.get('/system-version/current', ctrl(SystemVersionController, 'getCurrentVersion'));
router.post('/system-version', ctrl(SystemVersionController, 'createVersion'));
router.put('/system-version/:id', ctrl(SystemVersionController, 'updateVersion'));
router.delete('/system-version/:id', ctrl(SystemVersionController, 'deleteVersion'));

// ============ 朋友圈同步房源（定时任务） ============
router.get('/scheduled-tasks/running', ctrl(ScheduledTaskController, 'getRunningTasks'));
router.post('/scheduled-tasks/stop-all', ctrl(ScheduledTaskController, 'stopAllTasks'));
router.get('/scheduled-tasks/robots', ctrl(ScheduledTaskController, 'getRobots'));
router.get('/scheduled-tasks/friends/:robotId', ctrl(ScheduledTaskController, 'getFriends'));
router.get('/scheduled-tasks/tags/:robotId', ctrl(ScheduledTaskController, 'getTags'));
router.get('/scheduled-tasks', ctrl(ScheduledTaskController, 'getTasks'));
router.post('/scheduled-tasks', ctrl(ScheduledTaskController, 'saveTask'));
router.get('/scheduled-tasks/:id', ctrl(ScheduledTaskController, 'getTaskDetail'));
router.delete('/scheduled-tasks/:id', ctrl(ScheduledTaskController, 'deleteTask'));
router.post('/scheduled-tasks/:id/toggle', ctrl(ScheduledTaskController, 'toggleTask'));
router.post('/scheduled-tasks/:id/run', ctrl(ScheduledTaskController, 'runTask'));
router.get('/scheduled-tasks/:id/logs', ctrl(ScheduledTaskController, 'getTaskLogs'));
router.post('/scheduled-tasks/:id/stop', ctrl(ScheduledTaskController, 'stopTask'));

// ============ 数据库修复 ============
router.get('/database-fix/status', ctrl(DatabaseFixController, 'getStatus'));
router.post('/database-fix/fix', ctrl(DatabaseFixController, 'fixTables'));

// ============ 移动端APP管理 ============
router.get('/mobile-app', ctrl(MobileAppController, 'getConfigs'));
router.get('/mobile-app/:id', ctrl(MobileAppController, 'getConfig'));
router.post('/mobile-app', ctrl(MobileAppController, 'saveConfig'));
router.put('/mobile-app/:id', ctrl(MobileAppController, 'saveConfig'));
router.post('/mobile-app/:id/build', ctrl(MobileAppController, 'buildApp'));
router.delete('/mobile-app/:id', ctrl(MobileAppController, 'deleteConfig'));

// ============ 微信小程序管理 ============
router.get('/mini-program', ctrl(MiniProgramController, 'getConfigs'));
router.get('/mini-program/:id', ctrl(MiniProgramController, 'getConfig'));
router.post('/mini-program', ctrl(MiniProgramController, 'saveConfig'));
router.put('/mini-program/:id', ctrl(MiniProgramController, 'saveConfig'));
router.put('/mini-program/:id/status', ctrl(MiniProgramController, 'updateStatus'));
router.delete('/mini-program/:id', ctrl(MiniProgramController, 'deleteConfig'));

// ============ 用户试用管理 ============
router.put('/users/:id/trial', ctrl(TrialManagementController, 'setTrial'));
router.delete('/users/:id/trial', ctrl(TrialManagementController, 'cancelTrial'));
router.get('/trial-users', ctrl(TrialManagementController, 'getTrialUsers'));
router.post('/users/batch-trial', ctrl(TrialManagementController, 'batchSetTrial'));

// ============ 功能模块管理（会员中心设置） ============
router.get('/feature-modules', ctrl(FeatureModuleController, 'getModules'));
router.post('/feature-modules', ctrl(FeatureModuleController, 'saveModule'));
router.delete('/feature-modules/:id', ctrl(FeatureModuleController, 'deleteModule'));
router.post('/feature-modules/plans', ctrl(FeatureModuleController, 'savePlans'));
router.post('/feature-modules/trial-days', ctrl(FeatureModuleController, 'saveTrialDays'));
router.get('/feature-modules/subscriptions', ctrl(FeatureModuleController, 'getUserSubscriptions'));

// ============ 卡密管理 ============
router.get('/card-keys', ctrl(CardKeyController, 'getCardKeys'));
router.get('/card-keys/stats', ctrl(CardKeyController, 'getCardKeyStats'));
router.get('/card-keys/batches', ctrl(CardKeyController, 'getBatches'));
router.post('/card-keys/generate-feature', ctrl(CardKeyController, 'generateFeatureKeys'));
router.post('/card-keys/generate-balance', ctrl(CardKeyController, 'generateBalanceKeys'));
router.put('/card-keys/:id/disable', ctrl(CardKeyController, 'disableCardKey'));

// ============ 插件数据看板 ============
router.get('/plugin-dashboard', ctrl(PluginDashboardController, 'getDashboard'));

module.exports = router;
