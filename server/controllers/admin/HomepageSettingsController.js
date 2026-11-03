/**
 * 管理后台首页设置控制器
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');

class HomepageSettingsController {
  async getSettings(req, res) {
    try {
      const rows = await query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'homepage_%'"
      );
      const config = {};
      rows.forEach((r) => {
        config[r.setting_key] = r.setting_value;
      });
      return success(res, config);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async saveSettings(req, res) {
    try {
      const config = req.body;
      for (const [key, value] of Object.entries(config)) {
        if (key.startsWith('homepage_')) {
          await query(
            'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, String(value), String(value)]
          );
        }
      }
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new HomepageSettingsController();
