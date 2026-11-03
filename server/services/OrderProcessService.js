/**
 * 订单处理服务
 * 处理支付成功后的订单状态更新、会员激活、退款等流程
 */
const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');

class OrderProcessService {
  /**
   * 处理支付成功回调
   * @param {number|string} orderId - 订单ID 或 订单号
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async processPaymentSuccess(orderId) {
    try {
      const order = await this._getOrder(orderId);
      if (!order) {
        logger.warn('OrderProcessService.processPaymentSuccess 订单不存在', { orderId });
        return { success: false, message: '订单不存在' };
      }

      if (order.status === 'paid') {
        logger.info('OrderProcessService.processPaymentSuccess 订单已支付，跳过', { orderId });
        return { success: true, message: '订单已处理' };
      }

      if (order.status !== 'pending') {
        logger.warn('OrderProcessService.processPaymentSuccess 订单状态异常', {
          orderId,
          status: order.status,
        });
        return { success: false, message: `订单状态异常: ${order.status}` };
      }

      await transaction(async (conn) => {
        await conn.execute(
          'UPDATE orders SET status = ?, paid_at = NOW(), updated_at = NOW() WHERE id = ?',
          ['paid', order.id]
        );

        if (order.product_id) {
          await this._activateProduct(conn, order);
        }
      });

      logger.info('OrderProcessService.processPaymentSuccess 处理成功', {
        orderId: order.id,
        orderNo: order.order_no,
        userId: order.user_id,
      });

      return { success: true, message: '支付处理成功' };
    } catch (error) {
      logger.error('OrderProcessService.processPaymentSuccess 失败', {
        orderId,
        error: error.message,
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * 处理退款
   * @param {number|string} orderId - 订单ID 或 订单号
   * @param {Object} opts - { reason, operator }
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async processRefund(orderId, opts = {}) {
    try {
      const order = await this._getOrder(orderId);
      if (!order) {
        return { success: false, message: '订单不存在' };
      }

      if (order.status !== 'paid') {
        return { success: false, message: `仅已支付订单可退款，当前状态: ${order.status}` };
      }

      await transaction(async (conn) => {
        await conn.execute(
          'UPDATE orders SET status = ?, refund_reason = ?, refunded_at = NOW(), updated_at = NOW() WHERE id = ?',
          ['refunded', opts.reason || null, order.id]
        );

        if (order.product_id) {
          await this._deactivateProduct(conn, order);
        }
      });

      logger.info('OrderProcessService.processRefund 退款成功', {
        orderId: order.id,
        orderNo: order.order_no,
        reason: opts.reason,
      });

      return { success: true, message: '退款处理成功' };
    } catch (error) {
      logger.error('OrderProcessService.processRefund 失败', {
        orderId,
        error: error.message,
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * 取消未支付订单
   * @param {number|string} orderId
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async cancelOrder(orderId) {
    try {
      const order = await this._getOrder(orderId);
      if (!order) {
        return { success: false, message: '订单不存在' };
      }

      if (order.status !== 'pending') {
        return { success: false, message: `仅待支付订单可取消，当前状态: ${order.status}` };
      }

      await query(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
        ['cancelled', order.id]
      );

      logger.info('OrderProcessService.cancelOrder 取消成功', { orderId: order.id });
      return { success: true, message: '订单已取消' };
    } catch (error) {
      logger.error('OrderProcessService.cancelOrder 失败', { orderId, error: error.message });
      return { success: false, message: error.message };
    }
  }

  async _getOrder(orderId) {
    const isNum = /^\d+$/.test(String(orderId));
    const where = isNum ? 'id = ?' : 'order_no = ?';
    const rows = await query(`SELECT * FROM orders WHERE ${where} LIMIT 1`, [orderId]);
    return rows[0] || null;
  }

  /**
   * 支付成功后根据产品类型激活对应权益（会员等）
   */
  async _activateProduct(conn, order) {
    try {
      const [product] = await conn.execute(
        'SELECT * FROM membership_packages WHERE id = ? LIMIT 1',
        [order.product_id]
      );
      const pkg = product[0];
      if (!pkg) return;

      const months = pkg.duration_months || 1;
      const expireAt = new Date();
      expireAt.setMonth(expireAt.getMonth() + months);

      await conn.execute(
        `INSERT INTO user_memberships (user_id, package_id, status, expire_at, order_id, created_at)
         VALUES (?, ?, 'active', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE status = 'active', expire_at = ?, order_id = ?, updated_at = NOW()`,
        [order.user_id, order.product_id, expireAt, order.id, expireAt, order.id]
      );

      logger.info('OrderProcessService._activateProduct 会员激活成功', {
        userId: order.user_id,
        packageId: order.product_id,
        expireAt,
      });
    } catch (error) {
      logger.warn('OrderProcessService._activateProduct 激活失败（非致命）', {
        orderId: order.id,
        error: error.message,
      });
    }
  }

  /**
   * 退款后取消对应权益
   */
  async _deactivateProduct(conn, order) {
    try {
      await conn.execute(
        "UPDATE user_memberships SET status = 'cancelled', updated_at = NOW() WHERE order_id = ?",
        [order.id]
      );
      logger.info('OrderProcessService._deactivateProduct 权益已取消', { orderId: order.id });
    } catch (error) {
      logger.warn('OrderProcessService._deactivateProduct 取消失败（非致命）', {
        orderId: order.id,
        error: error.message,
      });
    }
  }
}

module.exports = new OrderProcessService();
