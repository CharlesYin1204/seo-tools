/**
 * 文章分类模型
 * 对应数据库 article_categories 表
 */
const BaseModel = require('./BaseModel');

class ArticleCategory extends BaseModel {
  constructor() {
    super('article_categories');
  }

  /**
   * 查询所有分类
   * @param {Object} options - 可选 { orderBy, limit }
   * @returns {Promise<Array>}
   */
  async findAll(options = {}) {
    return super.findAll({
      ...options,
      orderBy: options.orderBy || 'sort_order ASC, id ASC',
      limit: options.limit || 100,
    });
  }

  /**
   * 查询启用的分类
   * @returns {Promise<Array>}
   */
  async findActive() {
    return this.findAll({
      where: { status: 'active' },
      orderBy: 'sort_order ASC, id ASC',
    });
  }
}

module.exports = new ArticleCategory();
