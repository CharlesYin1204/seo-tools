/**
 * 微信公众号授权模型
 * 对应数据库 wechat_official_accounts 表
 */
const BaseModel = require('./BaseModel');

class WeChatOfficialAccount extends BaseModel {
  constructor() {
    super('wechat_official_accounts');
  }

  /**
   * 根据用户ID查找公众号列表
   * @param {number} userId - 用户ID
   * @param {Object} options - 可选 { activeOnly, limit }
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, options = {}) {
    const where = { user_id: userId };
    if (options.activeOnly) {
      where.is_active = 1;
    }
    return this.findAll({
      where,
      orderBy: 'created_at DESC',
      limit: options.limit || 50,
    });
  }

  /**
   * 根据 app_id 查找
   * @param {string} appId - 公众号 AppID
   * @returns {Promise<Object|null>}
   */
  async findByAppId(appId) {
    return this.findOne({ app_id: appId });
  }
}

module.exports = new WeChatOfficialAccount();
