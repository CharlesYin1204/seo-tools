/**
 * 预约看房模型
 * 对应数据库 appointments 表
 */
const BaseModel = require('./BaseModel');

class Appointment extends BaseModel {
  constructor() {
    super('appointments');
  }

  /**
   * 根据中介ID查找预约
   * @param {number} agentId - 中介用户ID
   * @param {Object} options - 可选 { status, limit }
   * @returns {Promise<Array>}
   */
  async findByAgentId(agentId, options = {}) {
    const where = { agent_id: agentId };
    if (options.status) where.status = options.status;
    return this.findAll({
      where,
      orderBy: 'appointment_date DESC, created_at DESC',
      limit: options.limit || 100,
    });
  }

  /**
   * 根据客户ID查找预约
   * @param {number} clientId - 客户ID (clients表)
   * @param {Object} options - 可选 { limit }
   * @returns {Promise<Array>}
   */
  async findByClientId(clientId, options = {}) {
    return this.findAll({
      where: { client_id: clientId },
      orderBy: 'appointment_date DESC, created_at DESC',
      limit: options.limit || 100,
    });
  }

  /**
   * 根据房源ID查找预约
   * @param {number} propertyId - 房源ID
   * @param {Object} options - 可选 { limit }
   * @returns {Promise<Array>}
   */
  async findByPropertyId(propertyId, options = {}) {
    return this.findAll({
      where: { property_id: propertyId },
      orderBy: 'appointment_date DESC, created_at DESC',
      limit: options.limit || 100,
    });
  }

  /**
   * 更新预约状态
   * @param {number} id - 预约ID
   * @param {string} status - pending|confirmed|completed|cancelled
   * @param {Object} extra - 额外字段 { cancelled_by, cancel_reason, rating, feedback }
   * @returns {Promise<number>} 影响的行数
   */
  async updateStatus(id, status, extra = {}) {
    const data = { status, ...extra };
    return this.update(id, data);
  }
}

module.exports = new Appointment();
