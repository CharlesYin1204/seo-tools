/**
 * 微信机器人账号模型
 * 对应数据库 wechat_robot_accounts 表
 */
const BaseModel = require('./BaseModel');

class WeChatRobotAccount extends BaseModel {
  constructor() {
    super('wechat_robot_accounts');
  }

  async findByUserId(userId) {
    return this.findAll({
      where: { user_id: userId },
      orderBy: 'is_default DESC, created_at DESC',
    });
  }

  async setDefault(accountId, userId) {
    const { query: dbQuery } = require('../config/database');
    await dbQuery('UPDATE wechat_robot_accounts SET is_default = 0 WHERE user_id = ?', [userId]);
    await dbQuery('UPDATE wechat_robot_accounts SET is_default = 1 WHERE id = ? AND user_id = ?', [accountId, userId]);
  }

  async clearDefault(accountId, userId) {
    const { query: dbQuery } = require('../config/database');
    await dbQuery('UPDATE wechat_robot_accounts SET is_default = 0 WHERE id = ? AND user_id = ?', [accountId, userId]);
  }

  async findByWxid(wxid) {
    return this.findOne({ wxid });
  }

  async findActiveByUserId(userId) {
    return this.findAll({
      where: { user_id: userId, status: 'online' },
    });
  }

  async updateStatus(id, status) {
    return this.update(id, {
      status,
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
  }

  async getAccountWithApiConfig(accountId, userId, isAdmin = false) {
    let sql, params;
    if (isAdmin) {
      sql = `
        SELECT a.*, c.api_url as config_api_url, c.api_key as config_api_key, c.token as config_token
        FROM wechat_robot_accounts a
        LEFT JOIN wechat_robot_api_config c ON c.user_id = a.user_id
        WHERE a.id = ?
        LIMIT 1
      `;
      params = [accountId];
    } else {
      sql = `
        SELECT a.*, c.api_url as config_api_url, c.api_key as config_api_key, c.token as config_token
        FROM wechat_robot_accounts a
        LEFT JOIN wechat_robot_api_config c ON c.user_id = a.user_id
        WHERE a.id = ? AND a.user_id = ?
        LIMIT 1
      `;
      params = [accountId, userId];
    }
    const rows = await this.raw(sql, params);
    return rows[0] || null;
  }
}

module.exports = new WeChatRobotAccount();
