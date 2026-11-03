/**
 * C端租客中心路由
 * 只服务普通租客，不复用中介 /user 工作台，避免影响现有管理员和中介功能。
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const TenantController = require('../controllers/tenant/TenantController');

router.use(requireAuth);

router.get('/dashboard', TenantController.getDashboard.bind(TenantController));
router.get('/profile', TenantController.getProfile.bind(TenantController));
router.put('/profile', TenantController.updateProfile.bind(TenantController));

router.get('/demands', TenantController.getDemands.bind(TenantController));
router.post('/demands', TenantController.createDemand.bind(TenantController));
router.put('/demands/:id', TenantController.updateDemand.bind(TenantController));
router.delete('/demands/:id', TenantController.deleteDemand.bind(TenantController));

router.get('/favorites', TenantController.getFavorites.bind(TenantController));
router.post('/favorites', TenantController.addFavorite.bind(TenantController));
router.delete('/favorites/:propertyId', TenantController.removeFavorite.bind(TenantController));

router.get('/conversations', TenantController.getConversations.bind(TenantController));
router.post('/conversations', TenantController.createConversation.bind(TenantController));
router.get('/conversations/:id/messages', TenantController.getMessages.bind(TenantController));
router.post('/conversations/:id/messages', TenantController.sendMessage.bind(TenantController));

router.get('/appointments', TenantController.getAppointments.bind(TenantController));
router.post('/appointments', TenantController.createAppointment.bind(TenantController));

router.get('/applications', TenantController.getApplications.bind(TenantController));
router.get('/contracts', TenantController.getContracts.bind(TenantController));
router.get('/bills', TenantController.getBills.bind(TenantController));
router.get('/documents', TenantController.getDocuments.bind(TenantController));
router.get('/service-tickets', TenantController.getServiceTickets.bind(TenantController));

module.exports = router;
