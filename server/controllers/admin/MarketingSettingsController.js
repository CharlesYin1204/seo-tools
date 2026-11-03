/**
 * 营销设置管理控制器
 * 管理营销活动、促销规则等配置
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class MarketingSettingsController {
  /**
   * 获取营销设置
   * GET /admin/marketing-settings
   */
  async getSettings(req, res) {
    try {
      const rows = await query(
        "SELECT * FROM system_settings WHERE setting_group = 'marketing' ORDER BY sort_order, setting_key"
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
      logger.error('获取营销设置失败', { error: err.message });
      return error(res, '获取营销设置失败', 500);
    }
  }

  /**
   * 保存营销设置
   * POST /admin/marketing-settings  body: { settings: [{key, value}] }
   */
  async saveSettings(req, res) {
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings) || settings.length === 0) {
        return error(res, '请提供要保存的营销设置', 400);
      }

      for (const item of settings) {
        const val = typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value || '');
        await query(
          "INSERT INTO system_settings (setting_key, setting_value, setting_group, updated_at) VALUES (?, ?, 'marketing', NOW()) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()",
          [item.key, val]
        );
      }

      logger.info('营销设置已保存', { count: settings.length });
      return success(res, null, '营销设置保存成功');
    } catch (err) {
      logger.error('保存营销设置失败', { error: err.message });
      return error(res, '保存营销设置失败', 500);
    }
  }
}

module.exports = new MarketingSettingsController();
