/**
 * 订单模型
 * 对应数据库 orders 表
 */
const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class Order extends BaseModel {
  constructor() {
    super('orders');
  }

  /**
   * 检查表是否存在
   * @returns {Promise<boolean>}
   */
  async tableExists() {
    try {
      const rows = await query("SHOW TABLES LIKE 'orders'");
      return rows && rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 根据用户ID查找订单
   * @param {number} userId - 用户ID
   * @param {Object} options - 可选 { status, limit }
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, options = {}) {
    const where = { user_id: userId };
    if (options.status) where.status = options.status;
    return this.findAll({
      where,
      orderBy: 'created_at DESC',
      limit: options.limit || 100,
    });
  }

  /**
   * 分页查询所有订单
   * @param {Object} options - { page, pageSize, status?, user_id? }
   * @returns {Promise<Object>}
   */
  async findAllPaginated(options = {}) {
    const { page = 1, pageSize = 20, status, userId } = options;
    const where = {};
    if (status) where.status = status;
    if (userId) where.user_id = userId;
    return this.paginate({
      where,
      orderBy: 'created_at DESC',
      page,
      pageSize,
    });
  }

  /**
   * 更新订单状态
   * @param {number} id - 订单ID
   * @param {string} status - pending|paid|cancelled|refunded
   * @param {Object} extra - 额外字段 { trade_no, payment_method, paid_at }
   * @returns {Promise<number>} 影响的行数
   */
  async updateStatus(id, status, extra = {}) {
    const data = { status, ...extra };
    return this.update(id, data);
  }
}

module.exports = new Order();
