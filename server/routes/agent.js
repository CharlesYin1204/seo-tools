/**
 * 中介/代理人路由
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

let AgentDashboardController, PropertyController, ClientController, AppointmentController;
let AgentSettingController, AgentAuthConfigController, AgentPaymentConfigController;
let DemandHallController, AgentPluginsController, AgentMarketController;

try { AgentDashboardController = require('../controllers/agent/AgentDashboardController'); } catch { AgentDashboardController = null; }
try { PropertyController = require('../controllers/agent/PropertyController'); } catch { PropertyController = null; }
try { ClientController = require('../controllers/agent/ClientController'); } catch { ClientController = null; }
try { AppointmentController = require('../controllers/agent/AppointmentController'); } catch { AppointmentController = null; }
try { AgentSettingController = require('../controllers/agent/SettingController'); } catch { AgentSettingController = null; }
try { AgentAuthConfigController = require('../controllers/agent/AuthConfigController'); } catch { AgentAuthConfigController = null; }
try { AgentPaymentConfigController = require('../controllers/agent/PaymentConfigController'); } catch { AgentPaymentConfigController = null; }
try { DemandHallController = require('../controllers/agent/DemandHallController'); } catch { DemandHallController = null; }
try { AgentPluginsController = require('../controllers/agent/AgentPluginsController'); } catch { AgentPluginsController = null; }
try { AgentMarketController = require('../controllers/agent/AgentMarketController'); } catch { AgentMarketController = null; }

const placeholder = (req, res) => res.json({ success: false, message: '功能开发中' });
const ctrl = (c, method) => (c && c[method]) ? c[method] : placeholder;

router.use(requireAuth);

router.get('/dashboard', ctrl(AgentDashboardController, 'getDashboard'));
router.get('/properties', ctrl(PropertyController, 'getProperties'));
router.post('/properties', ctrl(PropertyController, 'createProperty'));
router.get('/clients', ctrl(ClientController, 'getClients'));
router.post('/clients', ctrl(ClientController, 'addClient'));
router.get('/appointments', ctrl(AppointmentController, 'getAppointments'));

// ============ 中介设置 ============
router.get('/settings', ctrl(AgentSettingController, 'getSettings'));
router.post('/settings', ctrl(AgentSettingController, 'saveSettings'));

// ============ 中介认证配置 ============
router.get('/auth-config', ctrl(AgentAuthConfigController, 'getAuthConfig'));
router.post('/auth-config', ctrl(AgentAuthConfigController, 'saveAuthConfig'));

// ============ 中介支付配置 ============
router.get('/payment-config', ctrl(AgentPaymentConfigController, 'getPaymentConfig'));
router.post('/payment-config', ctrl(AgentPaymentConfigController, 'savePaymentConfig'));

// ============ 需求大厅 ============
router.get('/demand-hall', ctrl(DemandHallController, 'getDemands'));
router.get('/demand-hall/:id', ctrl(DemandHallController, 'viewDemand'));
router.post('/demand-hall/:id/contact', ctrl(DemandHallController, 'contactDemand'));

// ============ 中介插件 ============
router.get('/plugins', ctrl(AgentPluginsController, 'getPlugins'));
router.post('/plugins/install', ctrl(AgentPluginsController, 'installPlugin'));
router.post('/plugins/uninstall', ctrl(AgentPluginsController, 'uninstallPlugin'));

// ============ 应用市场 ============
router.get('/market', ctrl(AgentMarketController, 'getMarket'));

module.exports = router;
