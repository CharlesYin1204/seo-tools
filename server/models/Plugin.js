/**
 * 微信机器人插件模型
 * 对应数据库 wechat_robot_plugins 表
 */
const BaseModel = require('./BaseModel');

class Plugin extends BaseModel {
  constructor() {
    super('wechat_robot_plugins');
  }

  /**
   * 根据分类查找插件
   * @param {string|number} category - 分类 slug 或 category_id
   * @param {Object} options - 可选 { limit }
   * @returns {Promise<Array>}
   */
  async findByCategory(category, options = {}) {
    const where =
      typeof category === 'number'
        ? { category_id: category }
        : { plugin_category: category };
    return this.findAll({
      where: { ...where, is_active: 1 },
      orderBy: 'id ASC',
      limit: options.limit || 100,
    });
  }

  /**
   * 查询推荐插件
   * @param {Object} options - 可选 { limit }
   * @returns {Promise<Array>}
   */
  async findFeatured(options = {}) {
    return this.findAll({
      where: { is_active: 1, is_featured: 1 },
      orderBy: 'install_count DESC, id ASC',
      limit: options.limit || 20,
    });
  }

  /**
   * 根据 slug 查找插件
   * @param {string} slug - 插件标识符
   * @returns {Promise<Object|null>}
   */
  async findBySlug(slug) {
    return this.findOne({ plugin_slug: slug });
  }
}

module.exports = new Plugin();
