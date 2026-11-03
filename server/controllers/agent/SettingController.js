/**
 * 中介设置控制器
 * 管理中介个人设置和偏好
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class SettingController {
  /**
   * 获取中介设置
   * GET /agent/settings
   */
  async getSettings(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return error(res, '未登录', 401);
      }

      const [profile] = await query(
        'SELECT * FROM agent_profiles WHERE agent_id = ? LIMIT 1',
        [userId]
      ).catch(() => [null]);

      const systemSettings = await query(
        "SELECT setting_key, setting_value FROM system_settings WHERE category = 'agent' OR setting_key LIKE 'agent_%'"
      ).catch(() => []);

      const sysConfig = {};
      systemSettings.forEach(row => { sysConfig[row.setting_key] = row.setting_value; });

      return success(res, {
        profile: profile || {},
        system: sysConfig,
      });
    } catch (err) {
      logger.error('获取中介设置失败', { error: err.message });
      return error(res, '获取设置失败', 500);
    }
  }

  /**
   * 保存中介设置
   * POST /agent/settings  body: { company_name, license_no, service_areas, commission_rate, ... }
   */
  async saveSettings(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return error(res, '未登录', 401);
      }

      const { company_name, license_no, service_areas, commission_rate, description, contact_phone, contact_email } = req.body;

      const [existing] = await query(
        'SELECT id FROM agent_profiles WHERE agent_id = ? LIMIT 1',
        [userId]
      ).catch(() => [null]);

      if (existing) {
        await query(
          'UPDATE agent_profiles SET bio = ?, phone = ?, updated_at = NOW() WHERE agent_id = ?',
          [description || '', contact_phone || '', userId]
        );
      } else {
        await query(
          'INSERT INTO agent_profiles (agent_id, bio, phone, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [userId, description || '', contact_phone || '']
        );
      }

      return success(res, null, '设置保存成功');
    } catch (err) {
      logger.error('保存中介设置失败', { error: err.message });
      return error(res, '保存设置失败', 500);
    }
  }
}

module.exports = new SettingController();
