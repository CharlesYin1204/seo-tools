/**
 * 微信消息模型
 * 对应数据库 wechat_robot_messages 表
 */
const BaseModel = require('./BaseModel');

class WeChatRobotMessage extends BaseModel {
  constructor() {
    super('wechat_robot_messages');
  }

  async getConversations(robotId) {
    const sql = `
      SELECT m.id, m.robot_id, m.from_wxid, m.to_wxid, m.chatroom_id, m.content, m.msg_type, m.direction, m.created_at,
        CASE 
          WHEN m.chatroom_id IS NOT NULL AND m.chatroom_id != '' THEN m.chatroom_id
          WHEN m.direction = 'receive' THEN m.from_wxid 
          ELSE m.to_wxid 
        END as wxid,
        COALESCE(c.nickname, g.name, 
          CASE WHEN m.direction = 'receive' THEN m.from_wxid ELSE m.to_wxid END
        ) as nickname,
        COALESCE(c.avatar, '') as avatar,
        COALESCE(c.remark, '') as remark,
        m.content as last_message,
        m.created_at as last_time,
        CASE WHEN m.chatroom_id IS NOT NULL AND m.chatroom_id != '' THEN 'group' ELSE 'private' END as chat_type
      FROM ${this.tableName} m
      INNER JOIN (
        SELECT MAX(id) as max_id
        FROM ${this.tableName} 
        WHERE robot_id = ?
        GROUP BY CASE 
          WHEN chatroom_id IS NOT NULL AND chatroom_id != '' THEN chatroom_id 
          WHEN direction = 'receive' THEN from_wxid 
          ELSE to_wxid 
        END
      ) latest ON m.id = latest.max_id
      LEFT JOIN wechat_robot_contacts c ON c.wxid = (
        CASE WHEN m.direction = 'receive' THEN m.from_wxid ELSE m.to_wxid END
      ) AND c.robot_id = m.robot_id
      LEFT JOIN wechat_robot_groups g ON g.chatroom_id = m.chatroom_id AND g.robot_id = m.robot_id
      ORDER BY m.created_at DESC
      LIMIT 100
    `;
    return this.raw(sql, [robotId]);
  }

  async getChatHistory(robotId, contactWxid, options = {}) {
    const { page = 1, pageSize = 50 } = options;
    let sql = `SELECT * FROM ${this.tableName} WHERE robot_id = ? AND (from_wxid = ? OR to_wxid = ?)`;
    const params = [robotId, contactWxid, contactWxid];

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await this.raw(countSql, params);
    const total = countResult ? countResult.total : 0;

    sql += ` ORDER BY created_at ASC LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    const data = await this.raw(sql, params);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}

module.exports = new WeChatRobotMessage();
