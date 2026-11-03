/**
 * 功能模块访问控制中间件
 * 检查用户是否有权访问"快速找房"或"房源库管理"功能
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

function requireFeatureAccess(slug) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: '请先登录', code: 'LOGIN_REQUIRED' });
      }

      const [userRow] = await query('SELECT role FROM users WHERE id = ?', [userId]).catch(() => [null]);
      if (userRow?.role === 'admin') return next();

      const [mod] = await query(
        'SELECT id, name FROM feature_modules WHERE slug = ? AND is_active = 1', [slug]
      ).catch(() => [null]);

      if (!mod) return next();

      const [sub] = await query(
        "SELECT id FROM user_feature_subscriptions WHERE user_id = ? AND module_id = ? AND status = 'active' AND end_date >= NOW() LIMIT 1",
        [userId, mod.id]
      ).catch(() => [null]);

      if (sub) return next();

      const [user] = await query(
        'SELECT is_trial, trial_end_date FROM users WHERE id = ?', [userId]
      ).catch(() => [null]);

      if (user?.is_trial && user.trial_end_date && new Date(user.trial_end_date) > new Date()) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `您需要购买「${mod.name}」功能后才能使用`,
        code: 'FEATURE_REQUIRED',
        data: { module_id: mod.id, module_name: mod.name, slug },
      });
    } catch (err) {
      logger.error('功能权限检查失败', { error: err.message, userId: req.user?.id, slug });
      return res.status(403).json({
        success: false,
        message: '功能权限验证异常，请稍后重试',
        code: 'FEATURE_CHECK_ERROR',
      });
    }
  };
}

/** 任一功能模块有权限即可通过（用于 parsed-properties：快速找房与房源库管理共用） */
function requireAnyFeatureAccess(slugs) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: '请先登录', code: 'LOGIN_REQUIRED' });
      }

      const [userRow] = await query('SELECT role FROM users WHERE id = ?', [userId]).catch(() => [null]);
      if (userRow?.role === 'admin') return next();

      for (const slug of slugs) {
        const [mod] = await query(
          'SELECT id, name FROM feature_modules WHERE slug = ? AND is_active = 1', [slug]
        ).catch(() => [null]);
        if (!mod) continue;

        const [sub] = await query(
          "SELECT id FROM user_feature_subscriptions WHERE user_id = ? AND module_id = ? AND status = 'active' AND end_date >= NOW() LIMIT 1",
          [userId, mod.id]
        ).catch(() => [null]);
        if (sub) return next();

        const [user] = await query(
          'SELECT is_trial, trial_end_date FROM users WHERE id = ?', [userId]
        ).catch(() => [null]);
        if (user?.is_trial && user.trial_end_date && new Date(user.trial_end_date) > new Date()) {
          return next();
        }
      }

      const [firstMod] = await query(
        'SELECT name FROM feature_modules WHERE slug = ? AND is_active = 1', [slugs[0]]
      ).catch(() => [null]);
      return res.status(403).json({
        success: false,
        message: `您需要购买「${firstMod?.name || '相关功能'}」后才能使用`,
        code: 'FEATURE_REQUIRED',
        data: { slugs },
      });
    } catch (err) {
      logger.error('功能权限检查失败', { error: err.message, userId: req.user?.id, slugs });
      return res.status(403).json({
        success: false,
        message: '功能权限验证异常，请稍后重试',
        code: 'FEATURE_CHECK_ERROR',
      });
    }
  };
}

module.exports = { requireFeatureAccess, requireAnyFeatureAccess };
