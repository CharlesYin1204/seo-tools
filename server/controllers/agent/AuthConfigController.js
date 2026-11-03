/**
 * 中介认证配置控制器
 * 管理中介的认证方式配置
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class AuthConfigController {
  /**
   * 获取中介认证配置
   * GET /agent/auth-config
   */
  async getAuthConfig(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return error(res, '未登录', 401);
      }

      const rows = await query(
        'SELECT * FROM auth_configs WHERE user_id = ? ORDER BY config_key',
        [userId]
      ).catch(() => []);

      const configs = rows.map((r) => {
        const parsed = typeof r.config_value === 'string' ? JSON.parse(r.config_value || '{}') : (r.config_value || {});
        return { id: r.id, provider: r.config_key, config: parsed.config || {}, status: parsed.status };
      });

      return success(res, configs);
    } catch (err) {
      logger.error('获取中介认证配置失败', { error: err.message });
      return error(res, '获取认证配置失败', 500);
    }
  }

  /**
   * 保存中介认证配置
   * POST /agent/auth-config  body: { provider, config, status }
   */
  async saveAuthConfig(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return error(res, '未登录', 401);
      }

      const { provider, config: configData, status } = req.body;

      if (!provider) {
        return error(res, '请指定认证提供商', 400);
      }

      const configStr = typeof configData === 'string' ? configData : JSON.stringify(configData || {});

      const configKey = provider;
      const configValue = JSON.stringify({ config: configData || {}, status: status !== undefined ? status : 1 });

      const [existing] = await query(
        'SELECT id FROM auth_configs WHERE user_id = ? AND config_key = ? LIMIT 1',
        [userId, configKey]
      ).catch(() => [null]);

      if (existing) {
        await query(
          'UPDATE auth_configs SET config_value = ?, updated_at = NOW() WHERE id = ?',
          [configValue, existing.id]
        );
      } else {
        await query(
          'INSERT INTO auth_configs (user_id, config_key, config_value, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [userId, configKey, configValue]
        );
      }

      return success(res, null, '认证配置保存成功');
    } catch (err) {
      logger.error('保存中介认证配置失败', { error: err.message });
      return error(res, '保存认证配置失败', 500);
    }
  }
}

module.exports = new AuthConfigController();
