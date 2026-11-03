/**
 * 会员订阅服务
 * 管理会员状态、套餐订阅、微信机器人限额等
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

class MembershipService {
  /**
   * 检查会员状态
   * @param {number} userId - 用户ID
   * @returns {Promise<{ isMember: boolean, expireAt?: string, planName?: string }>}
   */
  async checkMemberStatus(userId) {
    try {
      const rows = await query(
        `SELECT m.*, p.name as plan_name 
         FROM user_memberships m 
         LEFT JOIN membership_packages p ON m.package_id = p.id 
         WHERE m.user_id = ? AND m.status = 'active' AND (m.expire_at IS NULL OR m.expire_at > NOW()) 
         ORDER BY m.expire_at DESC LIMIT 1`,
        [userId]
      );
      const m = rows[0];
      if (m) {
        return {
          isMember: true,
          expireAt: m.expire_at,
          planName: m.plan_name || '会员',
        };
      }
      return { isMember: false };
    } catch (error) {
      logger.warn('MembershipService.checkMemberStatus 查询失败，可能表不存在', { userId, error: error.message });
      return { isMember: true };
    }
  }

  /**
   * 订阅套餐
   * @param {number} userId - 用户ID
   * @param {number} packageId - 套餐ID
   * @param {Object} opts - { orderId, months }
   * @returns {Promise<boolean>}
   */
  async subscribePlan(userId, packageId, opts = {}) {
    try {
      const plan = await query('SELECT * FROM membership_packages WHERE id = ?', [packageId]);
      if (!plan.length) throw new Error('套餐不存在');
      const months = opts.months || 1;
      const expireAt = new Date();
      expireAt.setMonth(expireAt.getMonth() + months);

      await query(
        `INSERT INTO user_memberships (user_id, package_id, status, expire_at, order_id, created_at) 
         VALUES (?, ?, 'active', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE status = 'active', expire_at = ?, order_id = ?`,
        [userId, packageId, expireAt, opts.orderId || null, expireAt, opts.orderId || null]
      );
      logger.info('MembershipService.subscribePlan 成功', { userId, packageId });
      return true;
    } catch (error) {
      logger.error('MembershipService.subscribePlan 失败', { userId, packageId, error: error.message });
      throw error;
    }
  }

  /**
   * 获取用户微信机器人数量限额
   * @param {number} userId - 用户ID
   * @returns {Promise<number>}
   */
  async getWeChatRobotLimit(userId) {
    try {
      const rows = await query(
        `SELECT COALESCE(p.wechat_robot_limit, 1) as limit_count
         FROM user_memberships m
         LEFT JOIN membership_packages p ON m.package_id = p.id
         WHERE m.user_id = ? AND m.status = 'active' AND (m.expire_at IS NULL OR m.expire_at > NOW())
         ORDER BY m.expire_at DESC LIMIT 1`,
        [userId]
      );
      if (rows[0] && rows[0].limit_count != null) {
        return parseInt(rows[0].limit_count, 10) || 1;
      }
      return 1;
    } catch (error) {
      logger.warn('MembershipService.getWeChatRobotLimit 查询失败', { userId, error: error.message });
      return 1;
    }
  }
}

module.exports = new MembershipService();
