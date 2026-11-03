/**
 * 管理后台支付配置控制器
 * 支付配置、订单列表、订单统计
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class PaymentConfigController {
  async getPaymentConfig(req, res) {
    try {
      const PAYMENT_KEYS = [
        'payment_methods', 'payment_enabled',
        'wechat_mch_id', 'wechat_api_key', 'wechat_app_id', 'wechat_app_secret',
        'yipay_pid', 'yipay_key', 'yipay_url', 'yipay_secret',
        'alipay_app_id', 'alipay_private_key', 'alipay_public_key',
        'paypal_client_id', 'paypal_client_secret', 'paypal_sandbox',
        'stripe_publishable_key', 'stripe_secret_key', 'stripe_webhook_secret',
      ];
      const placeholders = PAYMENT_KEYS.map(() => '?').join(',');
      const rows = await query(
        `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`,
        PAYMENT_KEYS
      );
      const config = { methods: [] };
      rows.forEach((r) => {
        if (r.setting_key === 'payment_methods') {
          try { config.methods = JSON.parse(r.setting_value); } catch { config.methods = []; }
        } else {
          config[r.setting_key] = r.setting_value;
        }
      });
      return success(res, config);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async savePaymentConfig(req, res) {
    try {
      const body = req.body || {};
      const ALLOWED_KEYS = [
        'methods', 'wechat_mch_id', 'wechat_api_key', 'wechat_app_id', 'wechat_app_secret',
        'yipay_pid', 'yipay_key', 'yipay_url',
        'alipay_app_id', 'alipay_private_key', 'alipay_public_key',
        'paypal_client_id', 'paypal_client_secret', 'paypal_sandbox',
        'stripe_publishable_key', 'stripe_secret_key', 'stripe_webhook_secret',
      ];

      for (const key of ALLOWED_KEYS) {
        if (body[key] !== undefined) {
          const dbKey = key === 'methods' ? 'payment_methods' : key;
          const dbValue = key === 'methods' ? JSON.stringify(body[key]) : String(body[key] ?? '');
          await query(
            'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [dbKey, dbValue, dbValue]
          );
          if (key === 'yipay_key') {
            await query(
              "INSERT INTO system_settings (setting_key, setting_value) VALUES ('yipay_secret', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
              [String(body[key]), String(body[key])]
            );
          }
        }
      }
      return success(res, null, '支付配置保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getOrders(req, res) {
    try {
      const { page = 1, pageSize = 20, status = '', userId = '' } = req.query;
      let sql = 'SELECT o.*, u.username, u.display_name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1';
      const params = [];
      if (status) {
        sql += ' AND o.status = ?';
        params.push(status);
      }
      if (userId) {
        sql += ' AND o.user_id = ?';
        params.push(userId);
      }
      const countSql = sql.replace(/SELECT o\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM');
      const [countResult] = await query(countSql, params);
      const total = countResult ? countResult.total : 0;
      sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10));
      const data = await query(sql, params);
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getOrderStats(req, res) {
    try {
      const [totalCount] = await query('SELECT COUNT(*) as total FROM orders');
      const [paidCount] = await query("SELECT COUNT(*) as total FROM orders WHERE status = 'paid'");
      const [totalAmount] = await query("SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status = 'paid'");
      return success(res, {
        totalOrders: totalCount?.total || 0,
        paidOrders: paidCount?.total || 0,
        totalAmount: totalAmount?.total || 0,
      });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new PaymentConfigController();
