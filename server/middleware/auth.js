/**
 * 认证中间件
 * 支持Session和JWT两种认证方式
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized, forbidden } = require('../utils/response');
const { query } = require('../config/database');

const ACTIVITY_INTERVAL_MS = 5 * 60 * 1000;

function formatLocalDateTime(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function touchUserActivity(req, user) {
  if (!user?.id) return;

  const now = Date.now();
  const lastTouched = req.session?.lastActivityTouchAt
    || req.session?.user?.last_login_at
    || user.last_login_at;

  if (lastTouched && now - new Date(lastTouched).getTime() < ACTIVITY_INTERVAL_MS) {
    return;
  }

  const currentTime = formatLocalDateTime();

  try {
    await query('UPDATE users SET last_login_at = ?, updated_at = NOW() WHERE id = ?', [currentTime, user.id]);
    if (req.session) {
      req.session.lastActivityTouchAt = currentTime;
      if (req.session.user) req.session.user.last_login_at = currentTime;
    }
    if (req.user) req.user.last_login_at = currentTime;
  } catch (_) {
    // 不阻塞正常鉴权链路
  }
}

/**
 * 验证用户是否已登录
 */
function requireAuth(req, res, next) {
  // 优先检查Session
  if (req.session && req.session.user) {
    req.user = req.session.user;
    touchUserActivity(req, req.user);
    return next();
  }

  // 其次检查JWT
  const token = extractToken(req);
  if (!token) {
    return unauthorized(res, '请先登录');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    touchUserActivity(req, req.user);
    return next();
  } catch (err) {
    return unauthorized(res, '登录已过期，请重新登录');
  }
}

/**
 * 验证管理员权限
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    return forbidden(res, '需要管理员权限');
  });
}

/**
 * 可选认证（不强制，但如果有token则解析用户信息）
 */
function optionalAuth(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    touchUserActivity(req, req.user);
    return next();
  }

  const token = extractToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, config.jwt.secret);
      touchUserActivity(req, req.user);
    } catch (err) {
      req.user = null;
    }
  }
  return next();
}

/**
 * 从请求中提取JWT Token
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
}

module.exports = {
  requireAuth,
  requireAdmin,
  optionalAuth,
};
