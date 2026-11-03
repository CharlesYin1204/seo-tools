/**
 * 管理后台主题控制器
 * 主题列表、激活、设置
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');

class ThemeController {
  async getThemes(req, res) {
    try {
      const rows = await query(
        'SELECT * FROM themes ORDER BY is_active DESC, created_at DESC'
      );
      return success(res, rows);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async activateTheme(req, res) {
    try {
      const { id } = req.params;
      const [theme] = await query('SELECT * FROM themes WHERE id = ?', [id]);
      if (!theme) {
        return error(res, '主题不存在', 404);
      }
      await query("UPDATE themes SET is_active = 0 WHERE 1=1");
      await query('UPDATE themes SET is_active = 1, updated_at = NOW() WHERE id = ?', [id]);
      await query("UPDATE system_settings SET setting_value = ? WHERE setting_key = 'active_theme_id'", [id]);
      const [row] = await query('SELECT * FROM themes WHERE id = ?', [id]);
      return success(res, row, '主题已激活');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getThemeSettings(req, res) {
    try {
      const { themeId } = req.params;
      const [theme] = await query('SELECT directory FROM themes WHERE id = ? LIMIT 1', [themeId]);
      if (!theme || !theme.directory) {
        return error(res, '主题不存在', 404);
      }
      const rows = await query(
        'SELECT * FROM theme_settings WHERE theme_directory = ?',
        [theme.directory]
      );
      const settings = {};
      rows.forEach((r) => {
        settings[r.setting_key] = r.setting_value;
      });
      return success(res, settings);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async saveThemeSettings(req, res) {
    try {
      const { themeId } = req.params;
      const [theme] = await query('SELECT directory FROM themes WHERE id = ? LIMIT 1', [themeId]);
      if (!theme || !theme.directory) {
        return error(res, '主题不存在', 404);
      }
      const themeDirectory = theme.directory;
      const config = req.body;
      for (const [key, value] of Object.entries(config)) {
        await query(
          'INSERT INTO theme_settings (theme_directory, setting_key, setting_value, setting_type) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, setting_type = ?',
          [themeDirectory, key, String(value), 'string', String(value), 'string']
        );
      }
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new ThemeController();
