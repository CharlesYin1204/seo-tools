/**
 * 微信文章草稿模型
 * 对应数据库 wechat_articles 表
 */
const BaseModel = require('./BaseModel');

class WeChatArticle extends BaseModel {
  constructor() {
    super('wechat_articles');
  }

  /**
   * 根据用户ID查找文章
   * @param {number} userId - 用户ID
   * @param {Object} options - 可选 { status, page, pageSize }
   * @returns {Promise<Array|Object>}
   */
  async findByUserId(userId, options = {}) {
    const where = { user_id: userId };
    if (options.status) where.status = options.status;
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
      limit: options.limit || 100,
    });
  }

  /**
   * 根据公众号ID查找文章
   * @param {number} accountId - 公众号ID
   * @param {Object} options - 可选 { status, limit }
   * @returns {Promise<Array>}
   */
  async findByAccountId(accountId, options = {}) {
    const where = { account_id: accountId };
    if (options.status) where.status = options.status;
    return this.findAll({
      where,
      orderBy: 'created_at DESC',
      limit: options.limit || 100,
    });
  }
}

module.exports = new WeChatArticle();
