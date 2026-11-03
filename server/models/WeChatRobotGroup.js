/**
 * 微信群组模型
 * 对应数据库 wechat_robot_groups 表
 */
const BaseModel = require('./BaseModel');

class WeChatRobotGroup extends BaseModel {
  constructor() {
    super('wechat_robot_groups');
  }

  async findByRobotId(robotId, options = {}) {
    const { page = 1, pageSize = 20, search = '' } = options;

    let whereSql = 'WHERE g.robot_id = ?';
    const whereParams = [robotId];
    if (search) {
      whereSql += ` AND g.name LIKE ?`;
      whereParams.push(`%${search}%`);
    }

    const countSql = `SELECT COUNT(*) as total FROM ${this.tableName} g ${whereSql}`;
    const [countResult] = await this.raw(countSql, whereParams);
    const total = countResult ? countResult.total : 0;

    const sql = `
      SELECT g.*, 
        COALESCE(tm.today_msg_count, 0) as today_message_count,
        COALESCE(am.total_msg_count, 0) as total_message_count
      FROM ${this.tableName} g
      LEFT JOIN (
        SELECT chatroom_id, COUNT(*) as today_msg_count 
        FROM wechat_robot_messages 
        WHERE robot_id = ? AND chatroom_id IS NOT NULL AND chatroom_id != '' AND DATE(created_at) = CURDATE()
        GROUP BY chatroom_id
      ) tm ON tm.chatroom_id = g.chatroom_id
      LEFT JOIN (
        SELECT chatroom_id, COUNT(*) as total_msg_count 
        FROM wechat_robot_messages 
        WHERE robot_id = ? AND chatroom_id IS NOT NULL AND chatroom_id != ''
        GROUP BY chatroom_id
      ) am ON am.chatroom_id = g.chatroom_id
      ${whereSql}
      ORDER BY g.name ASC
      LIMIT ? OFFSET ?
    `;
    const fullParams = [robotId, robotId, ...whereParams, pageSize, (page - 1) * pageSize];
    const data = await this.raw(sql, fullParams);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findByChatroomId(chatroomId) {
    return this.findOne({ chatroom_id: chatroomId });
  }
}

module.exports = new WeChatRobotGroup();
