/**
 * 微信机器人视频号/发现页模型
 * 通过 raw SQL 处理视频号相关操作（wechat_channel_qrcodes, wechat_channel_qrcode_stats 等表）
 */
const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class WeChatRobotFinder extends BaseModel {
  constructor() {
    super('wechat_channel_qrcodes');
  }

  /**
   * 根据用户ID查询视频号二维码列表
   * @param {number} userId - 用户ID
   * @param {Object} options - 可选 { limit, offset, status }
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, options = {}) {
    let sql = `SELECT * FROM wechat_channel_qrcodes WHERE user_id = ?`;
    const params = [userId];
    if (options.status) {
      sql += ` AND status = ?`;
      params.push(options.status);
    }
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(options.limit || 100, options.offset || 0);
    return query(sql, params);
  }

  /**
   * 根据ID查询单个二维码
   * @param {number} id - 二维码ID
   * @param {number} [userId] - 可选，用户ID校验
   * @returns {Promise<Object|null>}
   */
  async findById(id, userId = null) {
    let sql = `SELECT * FROM wechat_channel_qrcodes WHERE id = ?`;
    const params = [id];
    if (userId) {
      sql += ` AND user_id = ?`;
      params.push(userId);
    }
    sql += ` LIMIT 1`;
    const rows = await query(sql, params);
    return rows[0] || null;
  }

  /**
   * 创建视频号/渠道二维码
   * @param {Object} data - 二维码数据 { user_id, channel_name, channel_type?, tracking_code, ... }
   * @returns {Promise<number>} 新插入的ID
   */
  async createQrcode(data) {
    const sql = `INSERT INTO wechat_channel_qrcodes 
                 (user_id, channel_name, channel_type, tracking_code, original_qrcode_url, 
                  original_qrcode_path, generated_qrcode_url, generated_qrcode_path, redirect_url,
                  status, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const result = await query(sql, [
      data.user_id,
      data.channel_name || '',
      data.channel_type || 'personal',
      data.tracking_code || '',
      data.original_qrcode_url || null,
      data.original_qrcode_path || null,
      data.generated_qrcode_url || null,
      data.generated_qrcode_path || null,
      data.redirect_url || null,
      data.status || 'active',
      data.notes || null,
    ]);
    return result.insertId;
  }

  /**
   * 更新视频号/渠道二维码
   * @param {number} id - 二维码ID
   * @param {Object} data - 更新数据
   * @returns {Promise<number>} 影响的行数
   */
  async updateQrcode(id, data) {
    const fields = [];
    const values = [];
    const allowed = [
      'channel_name', 'channel_type', 'tracking_code', 'original_qrcode_url',
      'original_qrcode_path', 'generated_qrcode_url', 'generated_qrcode_path',
      'redirect_url', 'status', 'notes', 'group_member_count',
    ];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return 0;
    values.push(id);
    const sql = `UPDATE wechat_channel_qrcodes SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    const result = await query(sql, values);
    return result.affectedRows || 0;
  }

  /**
   * 记录二维码访问统计
   * @param {number} qrcodeId - 二维码ID
   * @param {string} trackingCode - 追踪码
   * @param {Object} extra - 额外数据 { visitor_ip, visitor_ua, referer, device_type }
   * @returns {Promise<number>}
   */
  async recordStats(qrcodeId, trackingCode, extra = {}) {
    const sql = `INSERT INTO wechat_channel_qrcode_stats 
                 (qrcode_id, tracking_code, visitor_ip, visitor_ua, referer, device_type, is_unique) 
                 VALUES (?, ?, ?, ?, ?, ?, 1)`;
    const result = await query(sql, [
      qrcodeId,
      trackingCode,
      extra.visitor_ip || null,
      extra.visitor_ua || null,
      extra.referer || null,
      extra.device_type || null,
    ]);
    return result.affectedRows || result.insertId ? 1 : 0;
  }

  /**
   * 执行自定义 raw SQL（视频号相关）
   * @param {string} sql - SQL语句
   * @param {Array} params - 参数
   * @returns {Promise<any>}
   */
  async rawQuery(sql, params = []) {
    return query(sql, params);
  }
}

module.exports = new WeChatRobotFinder();
