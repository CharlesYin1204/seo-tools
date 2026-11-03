/**
 * 房东路由
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

let LandlordDashboardController, PropertyController, WhitelistController;

try { LandlordDashboardController = require('../controllers/landlord/LandlordDashboardController'); } catch { LandlordDashboardController = null; }
try { PropertyController = require('../controllers/landlord/PropertyController'); } catch { PropertyController = null; }
try { WhitelistController = require('../controllers/landlord/WhitelistController'); } catch { WhitelistController = null; }

const placeholder = (req, res) => res.json({ success: false, message: '功能开发中' });
const ctrl = (c, method) => (c && c[method]) ? c[method] : placeholder;

router.use(requireAuth);

router.get('/dashboard', ctrl(LandlordDashboardController, 'getDashboard'));
router.get('/properties', ctrl(PropertyController, 'getProperties'));
router.post('/properties', ctrl(PropertyController, 'createProperty'));

// ============ 白名单管理 ============
router.get('/whitelist', ctrl(WhitelistController, 'getWhitelist'));
router.post('/whitelist', ctrl(WhitelistController, 'addToWhitelist'));
router.delete('/whitelist/:id', ctrl(WhitelistController, 'removeFromWhitelist'));

module.exports = router;
