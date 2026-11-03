/**
 * 管理后台微信机器人插件控制器
 * 解析房源、解析队列、插件管理
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');
const { RETENTION_DATE_CONDITION_P } = require('../../services/MomentRetentionService');

class WeChatRobotPluginController {
  async getParsedProperties(req, res) {
    try {
      const { page = 1, pageSize = 20, status = '', userId = '' } = req.query;
      let sql =
        'SELECT p.*, u.username, u.display_name FROM wechat_robot_expat_parsed_properties p LEFT JOIN users u ON p.user_id = u.id WHERE p.deleted_at IS NULL';
      sql += ` AND ${RETENTION_DATE_CONDITION_P}`;
      const params = [];
      if (status) {
        sql += ' AND p.status = ?';
        params.push(status);
      }
      if (userId) {
        sql += ' AND p.user_id = ?';
        params.push(userId);
      }
      const countSql = sql.replace(/SELECT p\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM');
      const [countResult] = await query(countSql, params);
      const total = countResult ? countResult.total : 0;
      sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10));
      const data = await query(sql, params);
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getParseQueue(req, res) {
    try {
      const { page = 1, pageSize = 20 } = req.query;
      const countSql = 'SELECT COUNT(*) as total FROM wechat_robot_expat_parse_queue';
      const [countResult] = await query(countSql);
      const total = countResult ? countResult.total : 0;
      const data = await query(
        'SELECT * FROM wechat_robot_expat_parse_queue ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10)]
      );
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async managePlugins(req, res) {
    try {
      const { action, pluginId } = req.body;
      if (action === 'toggle') {
        const [plugin] = await query('SELECT * FROM wechat_plugins WHERE id = ?', [pluginId]);
        if (!plugin) {
          return error(res, '插件不存在', 404);
        }
        const newActive = plugin.is_active ? 0 : 1;
        await query('UPDATE wechat_plugins SET is_active = ?, updated_at = NOW() WHERE id = ?', [newActive, pluginId]);
        const [row] = await query('SELECT * FROM wechat_plugins WHERE id = ?', [pluginId]);
        return success(res, row, `已${newActive ? '启用' : '停用'}`);
      }
      const rows = await query('SELECT * FROM wechat_plugins ORDER BY id ASC');
      return success(res, rows);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new WeChatRobotPluginController();
