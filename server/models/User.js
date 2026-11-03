/**
 * 用户模型
 * 对应数据库 users 表
 */
const BaseModel = require('./BaseModel');
const bcrypt = require('bcryptjs');

class User extends BaseModel {
  constructor() {
    super('users');
  }

  async findByUsername(username) {
    return this.findOne({ username });
  }

  async findByEmail(email) {
    return this.findOne({ email });
  }

  async findByPhone(phone) {
    return this.findOne({ phone });
  }

  /**
   * 创建用户（自动加密密码）
   */
  async createUser(userData) {
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }
    if (!userData.created_at) {
      userData.created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    return this.create(userData);
  }

  /**
   * 验证密码
   */
  async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * 更新密码
   */
  async updatePassword(userId, newPassword) {
    const hashed = await bcrypt.hash(newPassword, 10);
    return this.update(userId, { password: hashed });
  }

  /**
   * 获取用户信息（不包含密码）
   */
  async getPublicProfile(userId) {
    const user = await this.findById(userId);
    if (user) {
      delete user.password;
    }
    return user;
  }

  /**
   * 获取用户设置
   */
  async getUserSettings(userId) {
    const sql = `SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?`;
    const rows = await this.raw(sql, [userId]);
    const settings = {};
    rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    return settings;
  }

  /**
   * 更新用户设置
   */
  async setUserSetting(userId, key, value) {
    const sql = `INSERT INTO user_settings (user_id, setting_key, setting_value) 
                 VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?`;
    return this.raw(sql, [userId, key, value, value]);
  }
}

module.exports = new User();
