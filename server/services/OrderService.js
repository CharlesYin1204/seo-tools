/**
 * 订单服务
 */
const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');

class OrderService {
  /**
   * 创建订单
   * @param {number} userId - 用户ID
   * @param {Object} data - { product_id, amount, title, ... }
   * @returns {Promise<{ orderId: number, orderNo: string }>}
   */
  async createOrder(userId, data) {
    const orderNo = `ORD${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const result = await query(
      `INSERT INTO orders (user_id, order_no, product_id, amount, title, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        userId,
        orderNo,
        data.product_id || 0,
        data.amount || 0,
        data.title || '订单',
      ]
    );
    const orderId = result.insertId;
    logger.info('OrderService.createOrder', { orderId, orderNo, userId });
    return { orderId, orderNo };
  }

  /**
   * 更新订单状态
   * @param {number|string} orderId - 订单ID或订单号
   * @param {string} status - paid|cancelled|refunded
   * @returns {Promise<boolean>}
   */
  async updateOrderStatus(orderId, status) {
    const isNum = /^\d+$/.test(String(orderId));
    const where = isNum ? 'id = ?' : 'order_no = ?';
    const result = await query(
      `UPDATE orders SET status = ?, updated_at = NOW() WHERE ${where}`,
      [status, orderId]
    );
    const affected = result.affectedRows ?? 0;
    return affected > 0;
  }

  /**
   * 获取用户订单列表
   * @param {number} userId - 用户ID
   * @param {Object} opts - { page, pageSize }
   * @returns {Promise<{ data: Array, total: number }>}
   */
  async getOrdersByUserId(userId, opts = {}) {
    const page = opts.page || 1;
    const pageSize = opts.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const countRows = await query('SELECT COUNT(*) as total FROM orders WHERE user_id = ?', [userId]);
    const total = countRows[0]?.total || 0;

    const data = await query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
      [userId, pageSize, offset]
    );

    return { data, total, page, pageSize };
  }
}

module.exports = new OrderService();
