/**
 * 管理后台语言设置控制器
 * 语言列表、保存、启用/禁用
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');

class LanguageSettingsController {
  async getLanguages(req, res) {
    try {
      const rows = await query(
        'SELECT * FROM languages ORDER BY is_default DESC, sort_order ASC'
      );
      return success(res, rows);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async saveLanguage(req, res) {
    try {
      const { id, code, name, isDefault, sortOrder } = req.body;
      if (!code || !name) {
        return error(res, '语言代码和名称不能为空', 400);
      }
      if (id) {
        if (isDefault) {
          await query("UPDATE languages SET is_default = 0 WHERE 1=1");
        }
        await query(
          'UPDATE languages SET code = ?, name = ?, is_default = ?, sort_order = ?, updated_at = NOW() WHERE id = ?',
          [code, name, isDefault ? 1 : 0, sortOrder || 0, id]
        );
        const [row] = await query('SELECT * FROM languages WHERE id = ?', [id]);
        return success(res, row, '更新成功');
      } else {
        if (isDefault) {
          await query("UPDATE languages SET is_default = 0 WHERE 1=1");
        }
        await query(
          'INSERT INTO languages (code, name, is_default, sort_order, created_at) VALUES (?, ?, ?, ?, NOW())',
          [code, name, isDefault ? 1 : 0, sortOrder || 0]
        );
        const [row] = await query('SELECT * FROM languages ORDER BY id DESC LIMIT 1');
        return success(res, row, '创建成功', 201);
      }
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async toggleLanguage(req, res) {
    try {
      const { id } = req.params;
      const [existing] = await query('SELECT * FROM languages WHERE id = ?', [id]);
      if (!existing) {
        return error(res, '语言不存在', 404);
      }
      const newStatus = existing.is_enabled ? 0 : 1;
      await query('UPDATE languages SET is_enabled = ?, updated_at = NOW() WHERE id = ?', [newStatus, id]);
      const [row] = await query('SELECT * FROM languages WHERE id = ?', [id]);
      return success(res, row, newStatus ? '已启用' : '已禁用');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new LanguageSettingsController();
