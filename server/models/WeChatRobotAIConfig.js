/**
 * 微信机器人AI配置模型
 * 对应数据库 wechat_robot_ai_config 表
 */
const BaseModel = require('./BaseModel');

class WeChatRobotAIConfig extends BaseModel {
  constructor() {
    super('wechat_robot_ai_config');
  }

  /**
   * 根据机器人ID查找配置（每机器人仅一条）
   * @param {number} robotId - 机器人账号ID
   * @returns {Promise<Object|null>}
   */
  async findByRobotId(robotId) {
    return this.findOne({ robot_id: robotId });
  }

  /**
   * 保存/更新AI配置
   * @param {number} robotId - 机器人ID
   * @param {number} userId - 用户ID
   * @param {Object} configData - 配置数据
   * @returns {Promise<number>} 插入ID或影响行数
   */
  async save(robotId, userId, configData) {
    const existing = await this.findByRobotId(robotId);
    const data = {
      robot_id: robotId,
      user_id: userId,
      ...configData,
    };
    if (existing) {
      await this.update(existing.id, data);
      return existing.id;
    }
    return this.create(data);
  }
}

module.exports = new WeChatRobotAIConfig();
