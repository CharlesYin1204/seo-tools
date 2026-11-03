/**
 * 管理后台通用设置控制器
 * 处理系统设置、邮件设置等（区别于PropertySettings）
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class SettingsController {
  /**
   * 获取所有系统设置，按分类分组
   * GET /admin/general-settings
   */
  async getSettings(req, res) {
    try {
      const rows = await query('SELECT * FROM system_settings ORDER BY setting_group, sort_order, setting_key');
      const grouped = {};
      rows.forEach(row => {
        const cat = row.setting_group || 'general';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({
          id: row.id,
          key: row.setting_key,
          value: row.setting_value,
          type: row.setting_type || 'text',
          group: cat,
          title: row.title || '',
          description: row.description || '',
        });
      });
      return success(res, grouped);
    } catch (err) {
      logger.error('获取系统设置失败', { error: err.message });
      return error(res, '获取设置失败', 500);
    }
  }

  /**
   * 批量保存系统设置
   * POST /admin/general-settings  body: { settings: [{key, value, category}] }
   */
  async saveSettings(req, res) {
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings) || settings.length === 0) {
        return error(res, '请提供要保存的设置项', 400);
      }

      for (const item of settings) {
        await query(
          "INSERT INTO system_settings (setting_key, setting_value, setting_group, updated_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_group = VALUES(setting_group), updated_at = NOW()",
          [item.key, item.value || '', item.group || 'general']
        );
      }

      return success(res, null, '设置保存成功');
    } catch (err) {
      logger.error('保存系统设置失败', { error: err.message });
      return error(res, '保存设置失败', 500);
    }
  }

  /**
   * 获取邮件设置
   * GET /admin/mail-settings
   */
  async getMailSettings(req, res) {
    try {
      const rows = await query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_group = 'mail' OR setting_key LIKE 'mail_%'"
      );
      const settings = {};
      rows.forEach(row => { settings[row.setting_key] = row.setting_value; });
      return success(res, settings);
    } catch (err) {
      logger.error('获取邮件设置失败', { error: err.message });
      return error(res, '获取邮件设置失败', 500);
    }
  }

  /**
   * 保存邮件设置
   * POST /admin/mail-settings  body: { mail_host, mail_port, mail_username, ... }
   */
  async saveMailSettings(req, res) {
    try {
      const mailKeys = ['mail_host', 'mail_port', 'mail_username', 'mail_password', 'mail_from', 'mail_from_name', 'mail_encryption'];

      for (const key of mailKeys) {
        if (req.body[key] !== undefined) {
          await query(
            "INSERT INTO system_settings (setting_key, setting_value, setting_group, updated_at) VALUES (?, ?, 'mail', NOW()) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()",
            [key, req.body[key]]
          );
        }
      }

      return success(res, null, '邮件设置保存成功');
    } catch (err) {
      logger.error('保存邮件设置失败', { error: err.message });
      return error(res, '保存邮件设置失败', 500);
    }
  }
}

module.exports = new SettingsController();
