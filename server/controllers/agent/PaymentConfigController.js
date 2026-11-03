/**
 * 中介支付配置控制器
 * 管理中介的支付方式配置
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class PaymentConfigController {
  /**
   * 获取中介支付配置
   * GET /agent/payment-config
   */
  async getPaymentConfig(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return error(res, '未登录', 401);
      }

      const rows = await query(
        'SELECT * FROM payment_configs WHERE user_id = ? ORDER BY config_key',
        [userId]
      ).catch(() => []);

      const safeConfigs = rows.map((c) => {
        const parsed = typeof c.config_value === 'string' ? JSON.parse(c.config_value || '{}') : (c.config_value || {});
        const config = parsed.config || {};
        const safeConfig = { ...config };
        if (safeConfig.secret) safeConfig.secret = '***';
        if (safeConfig.api_key) safeConfig.api_key = safeConfig.api_key.substring(0, 6) + '***';
        return { id: c.id, provider: c.config_key, config: safeConfig, status: parsed.status };
      });

      return success(res, safeConfigs);
    } catch (err) {
      logger.error('获取中介支付配置失败', { error: err.message });
      return error(res, '获取支付配置失败', 500);
    }
  }

  /**
   * 保存中介支付配置
   * POST /agent/payment-config  body: { provider, config, status }
   */
  async savePaymentConfig(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return error(res, '未登录', 401);
      }

      const { provider, config: configData, status } = req.body;

      if (!provider) {
        return error(res, '请指定支付提供商', 400);
      }

      const configKey = provider;
      const configValue = JSON.stringify({ config: configData || {}, status: status !== undefined ? status : 1 });

      const [existing] = await query(
        'SELECT id FROM payment_configs WHERE user_id = ? AND config_key = ? LIMIT 1',
        [userId, configKey]
      ).catch(() => [null]);

      if (existing) {
        await query(
          'UPDATE payment_configs SET config_value = ?, updated_at = NOW() WHERE id = ?',
          [configValue, existing.id]
        );
      } else {
        await query(
          'INSERT INTO payment_configs (user_id, config_key, config_value, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [userId, configKey, configValue]
        );
      }

      return success(res, null, '支付配置保存成功');
    } catch (err) {
      logger.error('保存中介支付配置失败', { error: err.message });
      return error(res, '保存支付配置失败', 500);
    }
  }
}

module.exports = new PaymentConfigController();
