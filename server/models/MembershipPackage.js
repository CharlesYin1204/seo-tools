/**
 * 会员套餐模型
 * 对应数据库 membership_packages 表
 */
const BaseModel = require('./BaseModel');

class MembershipPackage extends BaseModel {
  constructor() {
    super('membership_packages');
  }

  /**
   * 查询启用的套餐
   * @param {Object} options - 可选 { limit }
   * @returns {Promise<Array>}
   */
  async findActive(options = {}) {
    return this.findAll({
      where: { is_active: 1 },
      orderBy: 'price ASC, id ASC',
      limit: options.limit || 50,
    });
  }

  /**
   * 根据ID查找套餐
   * @param {number} id - 套餐ID
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    return super.findById(id);
  }
}

module.exports = new MembershipPackage();
