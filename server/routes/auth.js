/**
 * 认证路由
 */
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth/AuthController');
const { requireAuth } = require('../middleware/auth');

let OAuthController;
try { OAuthController = require('../controllers/auth/OAuthController'); } catch { OAuthController = null; }

const placeholder = (req, res) => res.json({ success: false, message: '功能开发中' });
const ctrl = (c, method) => (c && c[method]) ? c[method] : placeholder;

// 公开设置（检查注册是否开启等）
router.get('/settings', AuthController.getPublicSettings);

// 公开设置（不需要登录，供前端判断注册是否开放等）
router.get('/settings', AuthController.getPublicSettings);

// 公开设置（无需认证）
router.get('/settings', AuthController.getPublicSettings);

// 登录/注册
router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.post('/phone-login', AuthController.phoneLogin);
router.post('/phone-register', AuthController.phoneRegister || placeholder);

// 密码
router.post('/forgot-password', AuthController.forgotPassword || placeholder);
router.post('/reset-password', AuthController.resetPassword || placeholder);
router.post('/change-password', requireAuth, AuthController.changePassword);

// 会话
router.get('/logout', requireAuth, AuthController.logout);
router.get('/profile', requireAuth, AuthController.getProfile);
router.put('/profile', requireAuth, AuthController.updateProfile);

// OAuth第三方登录
router.get('/oauth/redirect', ctrl(OAuthController, 'redirect'));
router.get('/oauth/callback', ctrl(OAuthController, 'callback'));

module.exports = router;
