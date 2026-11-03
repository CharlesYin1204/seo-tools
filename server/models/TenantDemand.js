/**
 * 租客需求模型
 * 对应数据库 tenant_demands 表
 */
const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class TenantDemand extends BaseModel {
  constructor() {
    super('tenant_demands');
  }

  /**
   * 检查表是否存在
   * @returns {Promise<boolean>}
   */
  async tableExists() {
    try {
      const rows = await query(
        "SHOW TABLES LIKE 'tenant_demands'"
      );
      return rows && rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 根据用户ID查找租客需求
   * @param {number} userId - 用户ID
   * @param {Object} options - 可选 { limit }
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, options = {}) {
    return this.findAll({
      where: { user_id: userId },
      orderBy: 'created_at DESC',
      limit: options.limit || 100,
    });
  }

  /**
   * 查询有效/活跃的租客需求
   * @param {Object} options - 可选 { limit, page, pageSize }
   * @returns {Promise<Array|Object>}
   */
  async findActive(options = {}) {
    const where = { status: 'active' };
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
}

module.exports = new TenantDemand();
