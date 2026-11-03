/**
 * 微信朋友圈模型
 * 对应数据库 wechat_robot_moments 表
 */
const BaseModel = require('./BaseModel');

class WeChatRobotMoment extends BaseModel {
  constructor() {
    super('wechat_robot_moments');
  }

  async findByRobotId(robotId, options = {}) {
    const { page = 1, pageSize = 20, search = '', ownerWxid = '' } = options;
    let sql = `SELECT * FROM ${this.tableName} WHERE robot_id = ?`;
    const params = [robotId];

    if (search) {
      sql += ` AND content LIKE ?`;
      params.push(`%${search}%`);
    }

    if (ownerWxid) {
      sql += ` AND owner_wxid = ?`;
      params.push(ownerWxid);
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await this.raw(countSql, params);
    const total = countResult ? countResult.total : 0;

    sql += ` ORDER BY create_time DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    const data = await this.raw(sql, params);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findByMomentId(momentId) {
    return this.findOne({ moment_id: momentId });
  }

  async getUniqueOwners(robotId) {
    const sql = `SELECT DISTINCT owner_wxid, owner_nickname FROM ${this.tableName} WHERE robot_id = ? ORDER BY owner_nickname`;
    return this.raw(sql, [robotId]);
  }
}

module.exports = new WeChatRobotMoment();
