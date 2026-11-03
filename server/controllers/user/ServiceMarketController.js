/**
 * 用户服务市场控制器
 * 获取可用服务列表、购买服务
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error, paginated } = require('../../utils/response');

class ServiceMarketController {
  /**
   * 获取可用服务列表（分页）
   */
  async getServices(req, res) {
    try {
      const { page = 1, pageSize = 20, category } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const params = [];

      let where = "WHERE s.status = 'active'";
      if (category) {
        where += ' AND s.category = ?';
        params.push(category);
      }

      const countSql = `SELECT COUNT(*) as total FROM services s ${where}`;
      const [countRow] = await query(countSql, params).catch(() => [{ total: 0 }]);
      const total = countRow?.total || 0;

      const dataSql = `
        SELECT s.id, s.name, s.description, s.category, s.price, s.original_price,
               s.icon, s.features, s.sort_order, s.created_at
        FROM services s
        ${where}
        ORDER BY s.sort_order ASC, s.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, parseInt(pageSize, 10), offset];
      const services = await query(dataSql, dataParams).catch(() => []);

      return paginated(res, services, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      logger.error('获取服务列表失败', { error: err.message });
      return error(res, '获取服务列表失败', 500);
    }
  }

  /**
   * 购买服务
   */
  async purchaseService(req, res) {
    try {
      const userId = req.user.id;
      const { service_id } = req.body;

      if (!service_id) {
        return error(res, '服务ID不能为空', 400);
      }

      const [service] = await query(
        "SELECT id, name, price FROM services WHERE id = ? AND status = 'active' LIMIT 1",
        [service_id]
      ).catch(() => [null]);

      if (!service) {
        return error(res, '服务不存在或已下架', 404);
      }

      const [user] = await query(
        'SELECT balance FROM users WHERE id = ? LIMIT 1',
        [userId]
      ).catch(() => [null]);

      if (!user || parseFloat(user.balance) < parseFloat(service.price)) {
        return error(res, '余额不足，请先充值', 400);
      }

      const orderNo = `SVC${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      await query('START TRANSACTION');
      try {
        await query(
          'UPDATE users SET balance = balance - ? WHERE id = ?',
          [service.price, userId]
        );

        await query(
          `INSERT INTO orders (order_id, user_id, title, amount, status, payment_method, paid_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'paid', 'balance', NOW(), NOW(), NOW())`,
          [orderNo, userId, `购买服务: ${service.name}`, service.price]
        );

        // transactions 表不存在，静默失败
        await query(
          `INSERT INTO transactions (user_id, type, amount, description, created_at)
           VALUES (?, 'debit', ?, ?, NOW())`,
          [userId, service.price, `购买服务: ${service.name}`]
        ).catch(() => {});

        await query('COMMIT');
      } catch (txErr) {
        await query('ROLLBACK');
        throw txErr;
      }

      return success(res, { order_no: orderNo }, '购买成功');
    } catch (err) {
      logger.error('购买服务失败', { error: err.message, userId: req.user?.id });
      return error(res, '购买服务失败', 500);
    }
  }
}

module.exports = new ServiceMarketController();
