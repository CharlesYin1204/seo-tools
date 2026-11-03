/**
 * 系统设置模型
 * 对应数据库 system_settings 表
 */
const BaseModel = require('./BaseModel');

class SystemSetting extends BaseModel {
  constructor() {
    super('system_settings');
  }

  async get(key, defaultValue = null) {
    const row = await this.findOne({ setting_key: key });
    return row ? row.setting_value : defaultValue;
  }

  async set(key, value, type = 'text') {
    const normalizedType = type === 'string' ? 'text' : type;
    const sql = `INSERT INTO ${this.tableName} (setting_key, setting_value, setting_type, updated_at) 
                 VALUES (?, ?, ?, NOW()) 
                 ON DUPLICATE KEY UPDATE setting_value = ?, setting_type = ?, updated_at = NOW()`;
    return this.raw(sql, [key, value, normalizedType, value, normalizedType]);
  }

  async getAll() {
    const rows = await this.raw(`SELECT setting_key, setting_value, setting_type FROM ${this.tableName}`);
    const settings = {};
    rows.forEach((row) => {
      let val = row.setting_value;
      if (row.setting_type === 'json') {
        try { val = JSON.parse(val); } catch { /* keep string */ }
      } else if (row.setting_type === 'boolean') {
        val = val === '1' || val === 'true';
      } else if (row.setting_type === 'number') {
        val = Number(val);
      }
      settings[row.setting_key] = val;
    });
    return settings;
  }

  async getGroup(prefix) {
    const sql = `SELECT setting_key, setting_value, setting_type FROM ${this.tableName} WHERE setting_key LIKE ?`;
    const rows = await this.raw(sql, [`${prefix}%`]);
    const settings = {};
    rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    return settings;
  }
}

module.exports = new SystemSetting();
