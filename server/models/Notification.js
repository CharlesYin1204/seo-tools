/**
 * 用户通知模型
 * 对应数据库 notifications 表
 */
const BaseModel = require('./BaseModel');

class Notification extends BaseModel {
  constructor() {
    super('notifications');
  }

  /**
   * 根据用户ID查找通知
   * @param {number} userId - 用户ID
   * @param {Object} options - 可选 { page, pageSize, unreadOnly }
   * @returns {Promise<Array|Object>}
   */
  async findByUserId(userId, options = {}) {
    const where = { user_id: userId };
    if (options.unreadOnly) {
      where.read_at = null;
    }
    if (options.page && options.pageSize) {
      return this.paginate({
        where,
        orderBy: 'created_at DESC',
        page: options.page,
        pageSize: options.pageSize,
      });
    }
    return this.findAll({
      where,
      orderBy: 'created_at DESC',
      limit: options.limit || 50,
    });
  }

  /**
   * 标记单条通知为已读
   * @param {number} id - 通知ID
   * @param {number} userId - 用户ID（可选，用于校验归属）
   * @returns {Promise<number>} 影响的行数
   */
  async markAsRead(id, userId = null) {
    const where = { id };
    if (userId) where.user_id = userId;
    return this.updateWhere(where, {
      read_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
  }

  /**
   * 标记用户所有通知为已读
   * @param {number} userId - 用户ID
   * @returns {Promise<number>} 影响的行数
   */
  async markAllAsRead(userId) {
    return this.updateWhere(
      { user_id: userId, read_at: null },
      { read_at: new Date().toISOString().slice(0, 19).replace('T', ' ') }
    );
  }

  /**
   * 统计未读通知数量
   * @param {number} userId - 用户ID
   * @returns {Promise<number>}
   */
  async countUnread(userId) {
    return this.count({ user_id: userId, read_at: null });
  }
}

module.exports = new Notification();
