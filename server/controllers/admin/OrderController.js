/**
 * 管理后台订单控制器
 * 管理订单查询、状态更新、统计
 */
const { success, error, paginated } = require('../../utils/response');
const { query, transaction } = require('../../config/database');
const logger = require('../../utils/logger');
const MembershipController = require('../user/MembershipController');

const ORDER_TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['completed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
};

class OrderController {
  /**
   * 获取订单列表（分页、筛选）
   * GET /admin/orders?page=1&pageSize=20&status=&start_date=&end_date=&keyword=
   */
  async getOrders(req, res) {
    try {
      const { page = 1, pageSize = 20, status, start_date, end_date, keyword } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      let fromSql = `FROM orders o LEFT JOIN users u ON o.user_id=u.id
        LEFT JOIN subscriptions s ON s.source_order_id=o.order_id
        LEFT JOIN organizations org ON org.id=s.organization_id
        LEFT JOIN plans p ON p.id=s.plan_id WHERE 1=1`;
      const params = [];

      if (status) {
        fromSql += ' AND o.status = ?';
        params.push(status);
      }
      if (start_date) {
        fromSql += ' AND o.created_at >= ?';
        params.push(start_date);
      }
      if (end_date) {
        fromSql += ' AND o.created_at <= ?';
        params.push(end_date + ' 23:59:59');
      }
      if (keyword) {
        fromSql += ' AND (o.order_id LIKE ? OR o.trade_no LIKE ? OR u.username LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }

      const [countRow] = await query(`SELECT COUNT(*) AS total ${fromSql}`, params);
      const total = countRow?.total || 0;

      const listParams = [...params, parseInt(pageSize, 10), offset];
      const orders = await query(
        `SELECT o.*,u.username,u.email,org.name AS organization_name,
          p.name AS subscription_plan_name,p.code AS subscription_plan_code,
          s.status AS subscription_status,s.current_period_end AS subscription_period_end
         ${fromSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
        listParams
      );
      return paginated(res, orders, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      logger.error('获取订单列表失败', { error: err.message });
      return error(res, '获取订单列表失败', 500);
    }
  }

  /**
   * 获取订单详情
   * GET /admin/orders/:id
   */
  async getOrderDetail(req, res) {
    try {
      const { id } = req.params;
      const [order] = await query(
        `SELECT o.*,u.username,u.email,u.phone,org.name AS organization_name,
          p.name AS subscription_plan_name,p.code AS subscription_plan_code,
          s.status AS subscription_status,s.current_period_start AS subscription_period_start,
          s.current_period_end AS subscription_period_end
         FROM orders o LEFT JOIN users u ON o.user_id=u.id
         LEFT JOIN subscriptions s ON s.source_order_id=o.order_id
         LEFT JOIN organizations org ON org.id=s.organization_id
         LEFT JOIN plans p ON p.id=s.plan_id WHERE o.id=? LIMIT 1`,
        [id]
      ).catch(() => [null]);

      if (!order) {
        return error(res, '订单不存在', 404);
      }

      const items = await query('SELECT * FROM order_items WHERE order_id = ?', [id]).catch(() => []);
      order.items = items;

      return success(res, order);
    } catch (err) {
      logger.error('获取订单详情失败', { error: err.message });
      return error(res, '获取订单详情失败', 500);
    }
  }

  /**
   * 更新订单状态
   * PUT /admin/orders/:id/status  body: { status, remark }
   */
  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status: newStatus, remark } = req.body;
      const validStatuses = ['pending', 'paid', 'completed', 'cancelled', 'refunded'];

      if (!validStatuses.includes(newStatus)) {
        return error(res, '无效的订单状态', 400);
      }

      const [order] = await query('SELECT * FROM orders WHERE id = ? LIMIT 1', [id]).catch(() => [null]);
      if (!order) {
        return error(res, '订单不存在', 404);
      }

      if (newStatus === order.status) {
        return error(res, '订单状态未改变', 400);
      }
      if (!(ORDER_TRANSITIONS[order.status] || []).includes(newStatus)) {
        return error(res, `订单不能从“${order.status}”变更为“${newStatus}”`, 409);
      }

      await transaction(async (connection) => {
        const execute = async (sql, params = []) => {
          const [rows] = await connection.query(sql, params);
          return rows;
        };
        await execute(
          `UPDATE orders SET status = ?,
            paid_at = CASE WHEN ? = 'paid' AND paid_at IS NULL THEN NOW() ELSE paid_at END,
            updated_at = NOW() WHERE id = ?`,
          [newStatus, newStatus, id]
        );

        if (newStatus === 'paid') {
          await MembershipController.reconcilePaidOrder({ ...order, status: 'paid' }, execute);
        } else if (newStatus === 'refunded') {
          await MembershipController.cancelPaidOrder(order, execute);
        }

        await execute(
          `INSERT INTO audit_logs(user_id,action,resource_type,resource_id,result,details,ip_address)
           VALUES(?,'order.status.update','order',?,'success',?,?)`,
          [req.user?.id || null, String(order.order_id), JSON.stringify({ from: order.status, to: newStatus, remark: remark || '' }), req.ip]
        );
      });

      return success(res, null, '订单状态更新成功');
    } catch (err) {
      logger.error('更新订单状态失败', { error: err.message });
      return error(res, '更新订单状态失败', 500);
    }
  }

  /**
   * 获取订单统计
   * GET /admin/orders/stats
   */
  async getOrderStats(req, res) {
    try {
      const [totalRow] = await query('SELECT COUNT(*) as total FROM orders').catch(() => [{ total: 0 }]);
      const [revenueRow] = await query("SELECT COALESCE(SUM(amount), 0) as revenue FROM orders WHERE status = 'paid'").catch(() => [{ revenue: 0 }]);
      const [pendingRow] = await query("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'").catch(() => [{ count: 0 }]);
      const [todayRow] = await query('SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURDATE()').catch(() => [{ count: 0 }]);
      const [todayRevenueRow] = await query("SELECT COALESCE(SUM(amount), 0) as revenue FROM orders WHERE status = 'paid' AND DATE(paid_at) = CURDATE()").catch(() => [{ revenue: 0 }]);

      return success(res, {
        total_orders: totalRow?.total || 0,
        total_revenue: parseFloat(revenueRow?.revenue || 0),
        pending_orders: pendingRow?.count || 0,
        today_orders: todayRow?.count || 0,
        today_revenue: parseFloat(todayRevenueRow?.revenue || 0),
      });
    } catch (err) {
      logger.error('获取订单统计失败', { error: err.message });
      return error(res, '获取订单统计失败', 500);
    }
  }
}

module.exports = new OrderController();
