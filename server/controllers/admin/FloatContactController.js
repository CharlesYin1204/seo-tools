/**
 * 悬浮联系方式管理控制器
 * 适配实际表结构: float_contact_settings (wechat_id, wechat_qrcode, social_links JSON, custom_links JSON, pc_enabled, mobile_enabled, icon_style, position_right, position_top)
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

function parseJsonField(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return value === true || value === 1 || value === '1' || value === 'true';
}

function mapPositionFromDb(positionTop, positionRight) {
  // 兼容旧数据：position_top 小于等于 300 视为 top，反之 bottom
  const vertical = Number(positionTop) > 300 ? 'bottom' : 'top';
  // position_right 小于等于 50 视为 right，反之 left
  const horizontal = Number(positionRight) > 50 ? 'left' : 'right';
  return `${vertical}-${horizontal}`;
}

function mapPositionToDb(position) {
  const pos = typeof position === 'string' ? position : 'bottom-right';
  const [vertical, horizontal] = pos.split('-');
  return {
    position_top: vertical === 'top' ? 120 : 420,
    position_right: horizontal === 'left' ? 360 : 20,
  };
}

class FloatContactController {
  async getSettings(req, res) {
    try {
      let data = {};

      try {
        const rows = await query('SELECT * FROM float_contact_settings ORDER BY id ASC LIMIT 1');
        if (rows.length > 0) {
          const row = rows[0];
          const socialLinks = parseJsonField(row.social_links, {});
          const customLinks = parseJsonField(row.custom_links, []);

          data = {
            wechat_id: row.wechat_id || '',
            wechat_qr_url: row.wechat_qrcode || '',
            phone: socialLinks.phone || '',
            email: socialLinks.email || '',
            whatsapp: socialLinks.whatsapp || '',
            telegram: socialLinks.telegram || '',
            facebook_messenger: socialLinks.facebook_messenger || '',
            chat_url: socialLinks.chat_url || '',
            position: mapPositionFromDb(row.position_top, row.position_right),
            enabled: toBoolean(row.pc_enabled, true),
            show_on_mobile: toBoolean(row.mobile_enabled, true),
            auto_expand: toBoolean(socialLinks.auto_expand, false),
            animation: socialLinks.animation || 'bounce',
            theme_color: socialLinks.theme_color || '#2F80ED',
            custom_links: Array.isArray(customLinks) ? customLinks : [],
            icon_style: row.icon_style || 'default',
          };
        }
      } catch (e) {
        if (e.code !== 'ER_NO_SUCH_TABLE') {
          logger.warn('查询 float_contact_settings 失败, 尝试 system_settings', { error: e.message });
        }
        try {
          const rows = await query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'float_contact_%' OR setting_key = 'float_contact_config'");
          rows.forEach(r => {
            if (r.setting_key === 'float_contact_config') {
              const fullConfig = parseJsonField(r.setting_value, {});
              if (fullConfig && typeof fullConfig === 'object') {
                data = { ...data, ...fullConfig };
              }
              return;
            }
            const key = r.setting_key.replace('float_contact_', '');
            data[key] = parseJsonField(r.setting_value, r.setting_value);
          });
        } catch (e2) {
          logger.warn('从 system_settings 读取悬浮设置也失败', { error: e2.message });
        }
      }

      return success(res, data);
    } catch (err) {
      logger.error('获取悬浮联系设置失败', { error: err.message });
      return error(res, '获取设置失败', 500);
    }
  }

  async saveSettings(req, res) {
    try {
      const body = req.body || {};
      const { position_top, position_right } = mapPositionToDb(body.position);
      const socialLinks = JSON.stringify({
        phone: body.phone || '',
        email: body.email || '',
        whatsapp: body.whatsapp || '',
        telegram: body.telegram || '',
        facebook_messenger: body.facebook_messenger || '',
        chat_url: body.chat_url || '',
        auto_expand: toBoolean(body.auto_expand, false),
        animation: body.animation || 'bounce',
        theme_color: body.theme_color || '#2F80ED',
      });
      const customLinks = JSON.stringify(Array.isArray(body.custom_links) ? body.custom_links : []);

      try {
        const rows = await query('SELECT id FROM float_contact_settings LIMIT 1');
        if (rows.length > 0) {
          await query(
            `UPDATE float_contact_settings SET 
              wechat_id = ?, wechat_qrcode = ?, social_links = ?, custom_links = ?,
              pc_enabled = ?, mobile_enabled = ?, icon_style = ?, position_right = ?, position_top = ?,
              updated_at = NOW() WHERE id = ?`,
            [
              body.wechat_id || '',
              body.wechat_qr_url || '',
              socialLinks,
              customLinks,
              toBoolean(body.enabled, true) ? 1 : 0,
              toBoolean(body.show_on_mobile, true) ? 1 : 0,
              body.icon_style || 'default',
              position_right,
              position_top,
              rows[0].id,
            ]
          );
        } else {
          await query(
            `INSERT INTO float_contact_settings 
              (wechat_id, wechat_qrcode, social_links, custom_links, pc_enabled, mobile_enabled, icon_style, position_right, position_top) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              body.wechat_id || '',
              body.wechat_qr_url || '',
              socialLinks,
              customLinks,
              toBoolean(body.enabled, true) ? 1 : 0,
              toBoolean(body.show_on_mobile, true) ? 1 : 0,
              body.icon_style || 'default',
              position_right,
              position_top,
            ]
          );
        }
      } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
          const allData = JSON.stringify(body);
          await query(
            "INSERT INTO system_settings (setting_key, setting_value, setting_group, updated_at) VALUES ('float_contact_config', ?, 'float_contact', NOW()) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()",
            [allData]
          );
        } else {
          throw e;
        }
      }

      logger.info('悬浮联系设置已保存');
      return success(res, null, '设置保存成功');
    } catch (err) {
      logger.error('保存悬浮联系设置失败', { error: err.message });
      return error(res, '保存设置失败', 500);
    }
  }
}

module.exports = new FloatContactController();
