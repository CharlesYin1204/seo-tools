/**
 * 微信机器人联系人标签模型
 * 对应数据库 wechat_robot_contact_tags 表
 * 关联表: wechat_robot_contact_tag_relations (联系人-标签多对多)
 */
const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class WeChatRobotContactTag extends BaseModel {
  constructor() {
    super('wechat_robot_contact_tags');
  }

  /** 关联表名 */
  static get RELATIONS_TABLE() {
    return 'wechat_robot_contact_tag_relations';
  }

  /**
   * 根据用户ID查找标签列表
   * @param {number} userId - 用户ID
   * @param {Object} options - 可选 { limit }
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, options = {}) {
    return this.findAll({
      where: { user_id: userId },
      orderBy: 'sort_order ASC, id ASC',
      limit: options.limit || 100,
    });
  }

  /**
   * 创建标签
   * @param {Object} data - { user_id, name, color?, description?, sort_order? }
   * @returns {Promise<number>} 新插入的ID
   */
  async createTag(data) {
    return this.create({
      user_id: data.user_id,
      name: data.name,
      color: data.color || '#07C160',
      description: data.description || null,
      contact_count: 0,
      sort_order: data.sort_order || 0,
    });
  }

  /**
   * 删除标签（同时删除关联关系）
   * @param {number} tagId - 标签ID
   * @param {number} userId - 用户ID（用于校验归属）
   * @returns {Promise<number>} 影响的行数
   */
  async deleteTag(tagId, userId) {
    const tag = await this.findOne({ id: tagId, user_id: userId });
    if (!tag) return 0;
    await query(
      `DELETE FROM ${WeChatRobotContactTag.RELATIONS_TABLE} WHERE tag_id = ?`,
      [tagId]
    );
    return this.delete(tagId);
  }

  /**
   * 为联系人添加标签
   * @param {number} robotId - 机器人ID
   * @param {number} contactId - 联系人ID
   * @param {number} tagId - 标签ID
   * @returns {Promise<number>} 插入ID
   */
  async addContactTag(robotId, contactId, tagId) {
    const sql = `INSERT IGNORE INTO ${WeChatRobotContactTag.RELATIONS_TABLE} 
                 (robot_id, contact_id, tag_id) VALUES (?, ?, ?)`;
    const result = await query(sql, [robotId, contactId, tagId]);
    return result.insertId;
  }

  /**
   * 移除联系人的标签
   * @param {number} robotId - 机器人ID
   * @param {number} contactId - 联系人ID
   * @param {number} tagId - 标签ID
   * @returns {Promise<number>} 影响的行数
   */
  async removeContactTag(robotId, contactId, tagId) {
    const sql = `DELETE FROM ${WeChatRobotContactTag.RELATIONS_TABLE} 
                 WHERE robot_id = ? AND contact_id = ? AND tag_id = ?`;
    const result = await query(sql, [robotId, contactId, tagId]);
    return result.affectedRows || 0;
  }
}

module.exports = new WeChatRobotContactTag();
