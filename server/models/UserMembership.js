/**
 * 用户会员记录模型
 * 对应数据库 user_memberships 表
 */
const BaseModel = require('./BaseModel');

class UserMembership extends BaseModel {
  constructor() {
    super('user_memberships');
  }

  /**
   * 查询用户当前有效的会员
   * @param {number} userId - 用户ID
   * @returns {Promise<Object|null>}
   */
  async findActiveByUserId(userId) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sql = `SELECT * FROM ${this.tableName} 
                 WHERE user_id = ? AND status = 'active' 
                 AND end_date > ? 
                 ORDER BY end_date DESC 
                 LIMIT 1`;
    const rows = await this.raw(sql, [userId, now]);
    return rows[0] || null;
  }

  /**
   * 创建会员记录
   * @param {Object} data - { user_id, package_id, start_date, end_date, status?, payment_id?, payment_method?, price_paid? }
   * @returns {Promise<number>} 新插入的ID
   */
  async createMembership(data) {
    return this.create({
      user_id: data.user_id,
      package_id: data.package_id,
      start_date: data.start_date,
      end_date: data.end_date,
      status: data.status || 'active',
      payment_id: data.payment_id || null,
      payment_method: data.payment_method || null,
      price_paid: data.price_paid || null,
    });
  }

  /**
   * 使会员过期
   * @param {number} id - 会员记录ID
   * @returns {Promise<number>} 影响的行数
   */
  async expire(id) {
    return this.update(id, { status: 'expired' });
  }

  /**
   * 批量使过期会员更新状态（end_date < 当前时间）
   * @returns {Promise<number>} 影响的行数
   */
  async expireOverdue() {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sql = `UPDATE ${this.tableName} SET status = 'expired' 
                 WHERE status = 'active' AND end_date < ?`;
    const result = await this.raw(sql, [now]);
    return result.affectedRows || 0;
  }
}

module.exports = new UserMembership();
