/**
 * 微信机器人收藏夹模型
 * 对应数据库 wechat_robot_favorites 表
 */
const BaseModel = require('./BaseModel');

class WeChatRobotFavorite extends BaseModel {
  constructor() {
    super('wechat_robot_favorites');
  }

  /**
   * 根据机器人ID查找收藏列表
   * @param {number} robotId - 机器人账号ID
   * @param {Object} options - 可选 { limit, offset }
   * @returns {Promise<Array>}
   */
  async findByRobotId(robotId, options = {}) {
    return this.findAll({
      where: { robot_id: robotId },
      orderBy: 'updated_at DESC, created_at DESC',
      limit: options.limit || 100,
      offset: options.offset || 0,
    });
  }

  /**
   * 根据 robot_id 和 fav_id 查找单条
   * @param {number} robotId - 机器人ID
   * @param {string} favId - 收藏ID（来自朋友圈等）
   * @returns {Promise<Object|null>}
   */
  async findByRobotAndFavId(robotId, favId) {
    return this.findOne({ robot_id: robotId, fav_id: favId });
  }
}

module.exports = new WeChatRobotFavorite();
