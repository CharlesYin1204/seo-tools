/**
 * 房源爬虫数据源模型
 * 对应数据库 property_scraper_sources 表
 */
const BaseModel = require('./BaseModel');

class PropertyScraperSource extends BaseModel {
  constructor() {
    super('property_scraper_sources');
  }

  /**
   * 查询所有数据源
   * @param {Object} options - 可选 { limit }
   * @returns {Promise<Array>}
   */
  async findAll(options = {}) {
    return super.findAll({
      ...options,
      orderBy: options.orderBy || 'id ASC',
      limit: options.limit || 100,
    });
  }

  /**
   * 查询启用的数据源
   * @returns {Promise<Array>}
   */
  async findActive() {
    return super.findAll({
      where: { status: 'active' },
      orderBy: 'id ASC',
      limit: 100,
    });
  }

  /**
   * 根据 slug 查找数据源
   * @param {string} slug - 数据源标识
   * @returns {Promise<Object|null>}
   */
  async findBySlug(slug) {
    return this.findOne({ slug });
  }
}

module.exports = new PropertyScraperSource();
