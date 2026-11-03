/**
 * 推荐设置管理控制器
 * 管理用户推荐/邀请相关规则与奖励配置
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class ReferralSettingsController {
  /**
   * 获取推荐设置
   * GET /admin/referral-settings
   */
  async getSettings(req, res) {
    try {
      const rows = await query(
        "SELECT * FROM system_settings WHERE setting_group = 'referral' ORDER BY sort_order, setting_key"
      );
      const settings = {};
      rows.forEach(row => {
        try {
          settings[row.setting_key] = JSON.parse(row.setting_value);
        } catch (e) {
          settings[row.setting_key] = row.setting_value;
        }
      });
      return success(res, { settings, raw: rows });
    } catch (err) {
      logger.error('获取推荐设置失败', { error: err.message });
      return error(res, '获取推荐设置失败', 500);
    }
  }

  /**
   * 保存推荐设置
   * POST /admin/referral-settings  body: { settings: [{key, value}] }
   */
  async saveSettings(req, res) {
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings) || settings.length === 0) {
        return error(res, '请提供要保存的推荐设置', 400);
      }

      for (const item of settings) {
        const val = typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value || '');
        await query(
          "INSERT INTO system_settings (setting_key, setting_value, setting_group, updated_at) VALUES (?, ?, 'referral', NOW()) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()",
          [item.key, val]
        );
      }

      logger.info('推荐设置已保存', { count: settings.length });
      return success(res, null, '推荐设置保存成功');
    } catch (err) {
      logger.error('保存推荐设置失败', { error: err.message });
      return error(res, '保存推荐设置失败', 500);
    }
  }
}

module.exports = new ReferralSettingsController();
