/**
 * 微信机器人通讯录模型
 * 对应数据库 wechat_robot_contacts 表
 */
const BaseModel = require('./BaseModel');

class WeChatRobotContact extends BaseModel {
  constructor() {
    super('wechat_robot_contacts');
  }

  async findByRobotId(robotId, options = {}) {
    const { page = 1, pageSize = 20, search = '', contactType = '' } = options;
    let sql = `SELECT * FROM ${this.tableName} WHERE robot_id = ?`;
    const params = [robotId];

    if (search) {
      sql += ` AND (nickname LIKE ? OR remark LIKE ? OR wxid LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (contactType) {
      sql += ` AND contact_type = ?`;
      params.push(contactType);
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await this.raw(countSql, params);
    const total = countResult ? countResult.total : 0;

    sql += ` ORDER BY nickname ASC LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    const data = await this.raw(sql, params);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async syncContacts(robotId, userId, contacts) {
    return this.transaction(async (conn) => {
      for (const contact of contacts) {
        const wxid = contact.wxid || null;
        if (!wxid) continue;
        const nickname = contact.nickname ?? null;
        const avatar = contact.avatar ?? null;
        const remark = contact.remark ?? null;
        const contactType = contact.contact_type || 'friend';
        const isBlocked = contact.is_blocked === undefined || contact.is_blocked === null
          ? null
          : (Number(contact.is_blocked) ? 1 : 0);
        const [existing] = await conn.execute(
          `SELECT id FROM ${this.tableName} WHERE robot_id = ? AND wxid = ? LIMIT 1`,
          [robotId, wxid]
        );
        if (existing.length > 0) {
          if (nickname || avatar || remark || isBlocked !== null) {
            await conn.execute(
              `UPDATE ${this.tableName}
               SET nickname = COALESCE(?, nickname),
                   avatar = COALESCE(?, avatar),
                   remark = COALESCE(?, remark),
                   is_blocked = COALESCE(?, is_blocked),
                   updated_at = NOW()
               WHERE id = ?`,
              [nickname, avatar, remark, isBlocked, existing[0].id]
            );
          }
        } else {
          await conn.execute(
            `INSERT INTO ${this.tableName} (robot_id, user_id, wxid, nickname, avatar, remark, contact_type, is_blocked, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [robotId, userId, wxid, nickname, avatar, remark, contactType, isBlocked || 0]
          );
        }
      }
    });
  }
}

module.exports = new WeChatRobotContact();
