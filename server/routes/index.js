/**
 * 路由总入口
 * 将所有路由模块注册到Express应用
 */
const express = require('express');
const authRoutes = require('./auth');
const frontendRoutes = require('./frontend');
const userRoutes = require('./user');
const adminRoutes = require('./admin');
const apiRoutes = require('./api');

function registerRoutes(app) {
  const router = express.Router();

  router.use('/auth', authRoutes);
  router.use('/api/auth', authRoutes);
  router.use('/user', userRoutes);
  router.use('/api/user', userRoutes);
  // 管理后台：同时挂在 /admin 与 /api/admin，兼容 Nginx 仅把 /api 转发到 Node、且前端 axios baseURL=/api 的部署方式
  router.use('/admin', adminRoutes);
  router.use('/api/admin', adminRoutes);
  router.use('/api', apiRoutes);
  router.use('/api', frontendRoutes);
  router.use('/', frontendRoutes);

  app.use(router);
}

module.exports = registerRoutes;
