/**
 * 多语言设置模型
 * 对应数据库 languages 表
 */
const BaseModel = require('./BaseModel');

class Language extends BaseModel {
  constructor() {
    super('languages');
  }

  /**
   * 查询启用的语言列表
   * @param {Object} options - 可选 { limit }
   * @returns {Promise<Array>}
   */
  async findEnabled(options = {}) {
    return this.findAll({
      where: { is_enabled: 1 },
      orderBy: 'sort_order ASC, id ASC',
      limit: options.limit || 50,
    });
  }

  /**
   * 查询所有语言
   * @param {Object} options - 可选 { limit }
   * @returns {Promise<Array>}
   */
  async findAll(options = {}) {
    return super.findAll({
      orderBy: 'sort_order ASC, id ASC',
      limit: options.limit || 50,
    });
  }

  /**
   * 根据语言代码查找
   * @param {string} code - 语言代码，如 en-US, zh-CN
   * @returns {Promise<Object|null>}
   */
  async findByCode(code) {
    return this.findOne({ code });
  }
}

module.exports = new Language();
