/**
 * 管理后台网站设置控制器
 * 站点设置、浮动联系设置
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');

const WEBSITE_SETTING_KEYS = [
  'site_name',
  'site_subtitle',
  'site_description',
  'site_logo',
  'site_favicon',
  'icp_number',
  'copyright',
  'contact_phone',
  'contact_email',
  'contact_address',
  'wechat_id',
  'whatsapp',
  'seo_title',
  'seo_description',
  'seo_keywords',
  'google_analytics_id',
  'baidu_analytics',
  'custom_head_code',
  'wechat_official',
  'wechat_qr_url',
  'facebook_url',
  'instagram_url',
  'linkedin_url',
  'youtube_url',
  'xiaohongshu_url',
  // 兼容历史字段
  'site_keywords',
  'site_footer',
  'site_icp',
];

class WebsiteSettingsController {
  async getSiteSettings(req, res) {
    try {
      const placeholders = WEBSITE_SETTING_KEYS.map(() => '?').join(', ');
      const rows = await query(
        `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`,
        WEBSITE_SETTING_KEYS
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

  async saveSiteSettings(req, res) {
    try {
      const payload = req.body || {};
      for (const [key, value] of Object.entries(payload)) {
        if (WEBSITE_SETTING_KEYS.includes(key)) {
          await query(
            'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, value == null ? '' : String(value), value == null ? '' : String(value)]
          );
        }
      }
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getFloatContactSettings(req, res) {
    try {
      const rows = await query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'float_contact_%'"
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

  async saveFloatContactSettings(req, res) {
    try {
      const config = req.body;
      for (const [key, value] of Object.entries(config)) {
        if (key.startsWith('float_contact_')) {
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

module.exports = new WebsiteSettingsController();
