/**
 * 用户端微信插件市场控制器
 * 插件列表、安装、卸载、已安装列表
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class WeChatPluginMarketController {
  async getPlugins(req, res) {
    try {
      const { page = 1, pageSize = 20, category = '' } = req.query;
      let sql = 'SELECT * FROM wechat_plugins WHERE is_active = ?';
      const params = [1];
      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }
      const countSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*) as total');
      const [countResult] = await query(countSql, params);
      const total = countResult ? countResult.total : 0;
      sql += ' ORDER BY created_at DESC, id ASC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10));
      const data = await query(sql, params);
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async installPlugin(req, res) {
    try {
      const userId = req.user.id;
      const { pluginId } = req.body;
      if (!pluginId) {
        return error(res, '请选择插件', 400);
      }
      const [plugin] = await query('SELECT * FROM wechat_plugins WHERE id = ? AND is_active = ?', [pluginId, 1]);
      if (!plugin) {
        return error(res, '插件不存在或已下架', 404);
      }
      const [existing] = await query('SELECT * FROM user_installed_plugins WHERE user_id = ? AND plugin_id = ?', [
        userId,
        pluginId,
      ]);
      if (existing) {
        return success(res, existing, '已安装');
      }
      await query(
        'INSERT INTO user_installed_plugins (user_id, plugin_id, installed_at) VALUES (?, ?, NOW())',
        [userId, pluginId]
      );
      const [row] = await query(
        'SELECT up.*, p.plugin_name, p.plugin_description FROM user_installed_plugins up LEFT JOIN wechat_plugins p ON up.plugin_id = p.id WHERE up.user_id = ? AND up.plugin_id = ?',
        [userId, pluginId]
      );
      return success(res, row, '安装成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async uninstallPlugin(req, res) {
    try {
      const userId = req.user.id;
      const { pluginId } = req.params;
      const [existing] = await query('SELECT * FROM user_installed_plugins WHERE user_id = ? AND plugin_id = ?', [
        userId,
        pluginId,
      ]);
      if (!existing) {
        return error(res, '未安装该插件', 404);
      }
      await query('DELETE FROM user_installed_plugins WHERE user_id = ? AND plugin_id = ?', [userId, pluginId]);
      return success(res, null, '卸载成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getInstalledPlugins(req, res) {
    try {
      const userId = req.user.id;
      const rows = await query(
        'SELECT up.*, p.plugin_name, p.plugin_description, p.plugin_version, p.plugin_category FROM user_installed_plugins up LEFT JOIN wechat_plugins p ON up.plugin_id = p.id WHERE up.user_id = ? ORDER BY up.installed_at DESC',
        [userId]
      );
      return success(res, rows);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new WeChatPluginMarketController();
