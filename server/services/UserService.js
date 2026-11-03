/**
 * 用户服务
 * 用户统计、积分等（与 Auth 区分）
 */
const User = require('../models/User');
const { query } = require('../config/database');
const logger = require('../utils/logger');

class UserService {
  /**
   * 获取用户统计
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>}
   */
  async getUserStats(userId) {
    const stats = {
      parsedCount: 0,
      favoriteCount: 0,
      robotCount: 0,
    };
    try {
      const [parsed] = await query(
        'SELECT COUNT(*) as c FROM wechat_robot_expat_parsed_properties WHERE user_id = ? AND deleted_at IS NULL',
        [userId]
      );
      stats.parsedCount = parsed?.c || 0;

      const [fav] = await query(
        'SELECT COUNT(*) as c FROM wechat_robot_favorites WHERE user_id = ?',
        [userId]
      );
      stats.favoriteCount = fav?.c || 0;

      const [robot] = await query(
        'SELECT COUNT(*) as c FROM wechat_robot_accounts WHERE user_id = ?',
        [userId]
      );
      stats.robotCount = robot?.c || 0;
    } catch (e) {
      logger.warn('UserService.getUserStats 部分查询失败', { userId, error: e.message });
    }
    return stats;
  }

  /**
   * 更新用户积分
   * @param {number} userId - 用户ID
   * @param {number} amount - 变化量（正加负减）
   * @param {string} description - 说明
   * @returns {Promise<boolean>}
   */
  async updatePoints(userId, amount, description = '') {
    try {
      await query(
        'INSERT INTO user_points (user_id, amount, description, created_at) VALUES (?, ?, ?, NOW())',
        [userId, amount, description]
      );
      await query(
        'UPDATE users SET points = COALESCE(points, 0) + ? WHERE id = ?',
        [amount, userId]
      );
      return true;
    } catch (error) {
      logger.error('UserService.updatePoints 失败', { userId, amount, error: error.message });
      return false;
    }
  }

  /**
   * 获取积分流水
   * @param {number} userId - 用户ID
   * @param {Object} opts - { page, pageSize }
   * @returns {Promise<{ data: Array, total: number }>}
   */
  async getPointsHistory(userId, opts = {}) {
    const page = opts.page || 1;
    const pageSize = opts.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const countRows = await query('SELECT COUNT(*) as total FROM user_points WHERE user_id = ?', [userId]);
    const total = countRows[0]?.total || 0;

    const data = await query(
      'SELECT * FROM user_points WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
      [userId, pageSize, offset]
    );

    return { data, total, page, pageSize };
  }
}

module.exports = new UserService();
