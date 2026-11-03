/**
 * 用户已安装的微信机器人插件模型
 * 对应数据库 wechat_robot_user_plugins 表
 */
const BaseModel = require('./BaseModel');

class UserPlugin extends BaseModel {
  constructor() {
    super('wechat_robot_user_plugins');
  }

  /**
   * 根据用户ID查找已安装插件
   * @param {number} userId - 用户ID
   * @param {Object} options - 可选 { robotId }
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, options = {}) {
    const where = { user_id: userId };
    if (options.robotId) {
      where.robot_id = options.robotId;
    }
    return this.findAll({
      where,
      orderBy: 'installed_at DESC',
      limit: options.limit || 100,
    });
  }

  /**
   * 检查用户是否已安装某插件
   * @param {number} userId - 用户ID
   * @param {number} pluginId - 插件ID
   * @param {number} [robotId] - 可选，机器人ID
   * @returns {Promise<Object|null>}
   */
  async isInstalled(userId, pluginId, robotId = null) {
    const where = { user_id: userId, plugin_id: pluginId };
    if (robotId) {
      where.robot_id = robotId;
    }
    return this.findOne(where);
  }

  /**
   * 安装插件
   * @param {Object} data - { user_id, plugin_id, robot_id?, is_active?, settings? }
   * @returns {Promise<number>} 新插入的ID
   */
  async install(data) {
    return this.create({
      user_id: data.user_id,
      plugin_id: data.plugin_id,
      robot_id: data.robot_id || null,
      is_active: data.is_active !== undefined ? data.is_active : 1,
      settings: data.settings || null,
    });
  }

  /**
   * 卸载插件（根据 user_id + plugin_id 删除）
   * @param {number} userId - 用户ID
   * @param {number} pluginId - 插件ID
   * @param {number} [robotId] - 可选，机器人ID
   * @returns {Promise<number>} 影响的行数
   */
  async uninstall(userId, pluginId, robotId = null) {
    const where = { user_id: userId, plugin_id: pluginId };
    if (robotId) {
      where.robot_id = robotId;
    }
    return this.deleteWhere(where);
  }
}

module.exports = new UserPlugin();
