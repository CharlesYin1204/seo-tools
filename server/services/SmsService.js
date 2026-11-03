/**
 * 短信服务
 * 支持 smsbao、阿里云、腾讯云发送验证码
 */
const axios = require('axios');
const { query } = require('../config/database');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');
const config = require('../config');

const SMS_CODE_TTL = 300; // 5分钟
const SMS_CODE_PREFIX = 'sms_code:';

class SmsService {
  /**
   * 发送验证码
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   * @returns {Promise<boolean>}
   */
  async sendCode(phone, code) {
    const provider = config.sms?.provider || process.env.SMS_PROVIDER || 'smsbao';
    try {
      let success = false;
      if (provider === 'smsbao') {
        success = await this._sendSmsBao(phone, code);
      } else if (provider === 'aliyun') {
        success = await this._sendAliyun(phone, code);
      } else if (provider === 'tencent') {
        success = await this._sendTencent(phone, code);
      } else {
        logger.warn('SmsService: 未知短信供应商', { provider });
        return false;
      }
      if (success) {
        await this._storeCode(phone, code);
      }
      return success;
    } catch (error) {
      logger.error('SmsService.sendCode 失败', { phone, error: error.message });
      throw error;
    }
  }

  /**
   * 验证验证码
   * @param {string} phone - 手机号
   * @param {string} code - 用户输入的验证码
   * @returns {Promise<boolean>}
   */
  async verifyCode(phone, code) {
    try {
      const redis = getRedisClient();
      const key = SMS_CODE_PREFIX + phone;
      const stored = await redis.get(key);
      if (stored && stored === code) {
        await redis.del(key);
        return true;
      }
      // 尝试从DB验证（降级）
      const rows = await query(
        'SELECT * FROM sms_codes WHERE phone = ? AND code = ? AND expires_at > NOW() AND used_at IS NULL LIMIT 1',
        [phone, code]
      );
      if (rows.length > 0) {
        await query('UPDATE sms_codes SET used_at = NOW() WHERE id = ?', [rows[0].id]);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('SmsService.verifyCode 失败', { phone, error: error.message });
      return false;
    }
  }

  async _sendSmsBao(phone, code) {
    const username = config.sms?.smsbao?.username || process.env.SMSBAO_USERNAME;
    const password = config.sms?.smsbao?.password || process.env.SMSBAO_PASSWORD;
    const content = encodeURIComponent(`【ExpatHome】您的验证码是${code}，5分钟内有效。`);
    const url = `https://api.smsbao.com/sms?u=${username}&p=${password}&m=${phone}&c=${content}`;
    const res = await axios.get(url, { timeout: 10000 });
    const result = String(res.data);
    if (result === '0') return true;
    logger.warn('SmsService._sendSmsBao 失败', { phone, result });
    return false;
  }

  async _sendAliyun(phone, code) {
    // 阿里云短信需 SDK，此处预留接口
    logger.warn('SmsService: 阿里云短信暂未实现');
    return false;
  }

  async _sendTencent(phone, code) {
    // 腾讯云短信需 SDK，此处预留接口
    logger.warn('SmsService: 腾讯云短信暂未实现');
    return false;
  }

  async _storeCode(phone, code) {
    try {
      const redis = getRedisClient();
      const key = SMS_CODE_PREFIX + phone;
      await redis.setex(key, SMS_CODE_TTL, code);
    } catch (e) {
      try {
        await query(
          'INSERT INTO sms_codes (phone, code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
          [phone, code]
        );
      } catch (dbErr) {
        logger.warn('SmsService._storeCode 存储失败', { phone, error: dbErr.message });
      }
    }
  }
}

module.exports = new SmsService();
