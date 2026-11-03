/**
 * 管理员通知模型
 * 对应数据库 admin_notifications 表
 */
const BaseModel = require('./BaseModel');

class AdminNotification extends BaseModel {
  constructor() {
    super('admin_notifications');
  }

  /**
   * 查询所有管理员通知
   * @param {Object} options - 可选 { page, pageSize, unreadOnly }
   * @returns {Promise<Array|Object>}
   */
  async findAll(options = {}) {
    const where = {};
    if (options.unreadOnly) {
      where.is_read = 0;
    }
    if (options.page && options.pageSize) {
      return this.paginate({
        where,
        orderBy: 'created_at DESC',
        page: options.page,
        pageSize: options.pageSize,
      });
    }
    return super.findAll({
      where,
      orderBy: 'created_at DESC',
      limit: options.limit || 100,
    });
  }

  /**
   * 标记通知为已读
   * @param {number} id - 通知ID
   * @returns {Promise<number>} 影响的行数
   */
  async markAsRead(id) {
    return this.update(id, {
      is_read: 1,
      read_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
  }
}

module.exports = new AdminNotification();
