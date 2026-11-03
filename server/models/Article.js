/**
 * 文章模型
 * 对应数据库 articles 表
 * 字段: id, user_id, title, content, slug, category_id, status, cover_image, views, created_at, updated_at
 */
const BaseModel = require('./BaseModel');

class Article extends BaseModel {
  constructor() {
    super('articles');
  }

  /**
   * 分页查询已发布文章
   * @param {Object} options - 分页选项 { page, pageSize }
   * @returns {Promise<Object>} 分页结果
   */
  async findPublished(options = {}) {
    const { page = 1, pageSize = 20 } = options;
    return this.paginate({
      where: { status: 'published' },
      orderBy: 'created_at DESC',
      page,
      pageSize,
    });
  }

  /**
   * 根据 slug 查找文章
   * @param {string} slug - 文章别名
   * @returns {Promise<Object|null>}
   */
  async findBySlug(slug) {
    return this.findOne({ slug });
  }

  /**
   * 根据用户ID查找文章列表
   * @param {number} userId - 用户ID
   * @param {Object} options - 可选 { limit, offset }
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, options = {}) {
    return this.findAll({
      where: { user_id: userId },
      orderBy: 'created_at DESC',
      limit: options.limit || 100,
      offset: options.offset || 0,
    });
  }
}

module.exports = new Article();
