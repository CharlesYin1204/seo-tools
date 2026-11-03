/**
 * 用户订单管理控制器
 * 订单列表、详情、取消
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error, paginated } = require('../../utils/response');
const MembershipController = require('./MembershipController');

class OrderController {
  /**
   * 获取用户订单列表（分页）
   */
  async getOrders(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20, status } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const params = [userId];

      let where = 'WHERE o.user_id = ?';
      if (status) {
        where += ' AND o.status = ?';
        params.push(status);
      }

      const countSql = `SELECT COUNT(*) as total FROM orders o ${where}`;
      const [countRow] = await query(countSql, params).catch(() => [{ total: 0 }]);
      const total = countRow?.total || 0;

      const dataSql = `
        SELECT o.id, o.order_id AS order_no, o.title AS product_name, o.amount, o.status, o.payment_method,
               o.paid_at, o.created_at, o.updated_at
        FROM orders o
        ${where}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, parseInt(pageSize, 10), offset];
      const orders = await query(dataSql, dataParams).catch(() => []);

      return paginated(res, orders, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      logger.error('获取订单列表失败', { error: err.message, userId: req.user?.id });
      return error(res, '获取订单列表失败', 500);
    }
  }

  /**
   * 获取单个订单详情
   */
  async getOrderDetail(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const [order] = await query(
        `SELECT o.id, o.order_id, o.user_id, o.title, o.amount, o.status, o.payment_method,
                o.trade_no, o.created_at, o.paid_at, o.updated_at
         FROM orders o
         WHERE (o.id = ? OR o.order_id = ?) AND o.user_id = ?
         LIMIT 1`,
        [id, id, userId]
      ).catch(() => [null]);

      if (!order) {
        return error(res, '订单不存在', 404);
      }

      // Keep subscription state consistent when a user opens a paid order directly.
      if (order.status === 'paid') await MembershipController.reconcilePaidOrder(order);

      return success(res, order);
    } catch (err) {
      logger.error('获取订单详情失败', { error: err.message, orderId: req.params.id });
      return error(res, '获取订单详情失败', 500);
    }
  }

  /**
   * 获取订单支付状态
   */
  async getOrderStatus(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const [order] = await query(
        `SELECT id, order_id, title, amount, status, payment_method, paid_at, created_at
         FROM orders
         WHERE (id = ? OR order_id = ?) AND user_id = ?
         LIMIT 1`,
        [id, id, userId]
      ).catch(() => [null]);

      if (!order) {
        return error(res, '订单不存在', 404);
      }

      if (order.status === 'paid') await MembershipController.reconcilePaidOrder(order);
      return success(res, {
        status: order.status,
        message: order.status === 'paid' ? '支付成功' : '订单处理中',
        order,
      });
    } catch (err) {
      logger.error('获取订单状态失败', { error: err.message, orderId: req.params.id });
      return error(res, '获取订单状态失败', 500);
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const [order] = await query(
        'SELECT id, status FROM orders WHERE id = ? AND user_id = ? LIMIT 1',
        [id, userId]
      ).catch(() => [null]);

      if (!order) {
        return error(res, '订单不存在', 404);
      }

      if (order.status !== 'pending') {
        return error(res, '当前订单状态不可取消', 400);
      }

      await query(
        "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?",
        [id]
      );

      return success(res, null, '订单已取消');
    } catch (err) {
      logger.error('取消订单失败', { error: err.message, orderId: req.params.id });
      return error(res, '取消订单失败', 500);
    }
  }
}

module.exports = new OrderController();
