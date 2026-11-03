/**
 * 用户积分控制器
 * 查询积分、积分变动历史
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error, paginated } = require('../../utils/response');

class PointsController {
  /**
   * 获取用户积分
   */
  async getPoints(req, res) {
    try {
      const userId = req.user.id;

      const [user] = await query(
        'SELECT points FROM users WHERE id = ? LIMIT 1',
        [userId]
      ).catch(() => [null]);

      if (!user) {
        return error(res, '用户不存在', 404);
      }

      return success(res, {
        points: parseInt(user.points, 10) || 0,
      });
    } catch (err) {
      logger.error('获取积分失败', { error: err.message, userId: req.user?.id });
      return error(res, '获取积分失败', 500);
    }
  }

  /**
   * 获取积分变动历史（分页）
   */
  async getPointsHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20, type } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const params = [userId];

      let where = 'WHERE ph.user_id = ?';
      if (type) {
        where += ' AND ph.type = ?';
        params.push(type);
      }

      const countSql = `SELECT COUNT(*) as total FROM points_history ph ${where}`;
      const [countRow] = await query(countSql, params).catch(() => [{ total: 0 }]);
      const total = countRow?.total || 0;

      const dataSql = `
        SELECT ph.id, ph.type, ph.points, ph.balance_after, ph.description, ph.created_at
        FROM points_history ph
        ${where}
        ORDER BY ph.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, parseInt(pageSize, 10), offset];
      const history = await query(dataSql, dataParams).catch(() => []);

      return paginated(res, history, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      logger.error('获取积分历史失败', { error: err.message, userId: req.user?.id });
      return error(res, '获取积分历史失败', 500);
    }
  }
}

module.exports = new PointsController();
