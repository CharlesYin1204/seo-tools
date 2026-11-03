/**
 * 中介个人资料模型
 * 对应数据库 agent_profiles 表
 */
const BaseModel = require('./BaseModel');

class AgentProfile extends BaseModel {
  constructor() {
    super('agent_profiles');
  }

  /**
   * 根据中介ID查找资料（每个中介仅一条）
   * @param {number} agentId - 中介用户ID
   * @returns {Promise<Object|null>}
   */
  async findByAgentId(agentId) {
    return this.findOne({ agent_id: agentId });
  }

  /**
   * 创建或更新中介资料
   * @param {number} agentId - 中介ID
   * @param {Object} data - 资料数据
   * @returns {Promise<number>}
   */
  async saveProfile(agentId, data) {
    const existing = await this.findByAgentId(agentId);
    const profileData = {
      agent_id: agentId,
      display_name: data.display_name,
      bio: data.bio,
      phone: data.phone,
      wechat_qr: data.wechat_qr,
      notification_email: data.notification_email,
      notification_sms: data.notification_sms,
      notification_browser: data.notification_browser,
      quick_response: data.quick_response,
      work_hours: data.work_hours,
    };
    if (existing) {
      await this.update(existing.id, profileData);
      return existing.id;
    }
    return this.create(profileData);
  }
}

module.exports = new AgentProfile();
