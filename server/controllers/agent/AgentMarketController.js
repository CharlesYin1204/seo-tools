/**
 * 中介应用市场控制器
 * 查询可用插件列表
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error, paginated } = require('../../utils/response');

class AgentMarketController {
  /**
   * 获取应用市场可用插件列表
   */
  async getMarket(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20, category, keyword } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const params = [];

      let where = 'WHERE p.is_active = 1';

      if (category) {
        where += ' AND p.plugin_category = ?';
        params.push(category);
      }
      if (keyword) {
        where += ' AND (p.plugin_name LIKE ? OR p.plugin_description LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }

      const countSql = `SELECT COUNT(*) as total FROM wechat_robot_plugins p ${where}`;
      const [countRow] = await query(countSql, params).catch(() => [{ total: 0 }]);
      const total = countRow?.total || 0;

      const dataSql = `
        SELECT p.*,
               (SELECT COUNT(*) FROM wechat_robot_user_plugins up WHERE up.plugin_id = p.id) as install_count,
               IF(myup.id IS NOT NULL, 1, 0) as is_installed
        FROM wechat_robot_plugins p
        LEFT JOIN wechat_robot_user_plugins myup ON myup.plugin_id = p.id AND myup.user_id = ?
        ${where}
        ORDER BY p.id ASC, p.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [userId, ...params, parseInt(pageSize, 10), offset];
      const plugins = await query(dataSql, dataParams).catch(() => []);

      return paginated(res, plugins, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      logger.error('获取应用市场失败', { error: err.message });
      return error(res, '获取应用市场失败', 500);
    }
  }
}

module.exports = new AgentMarketController();
