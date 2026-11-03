/**
 * 微信 JS-SDK 签名服务
 * 获取 access_token → jsapi_ticket → 生成 JS-SDK 权限签名
 */
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');

const TOKEN_TTL = 7000;
const TICKET_TTL = 7000;

class WeChatJsSdkService {
  constructor() {
    this.appId = process.env.WECHAT_APP_ID || process.env.WECHAT_PAY_APP_ID || '';
    this.appSecret = process.env.WECHAT_APP_SECRET || '';

    this._tokenCache = { value: null, expireAt: 0 };
    this._ticketCache = { value: null, expireAt: 0 };
  }

  /**
   * 获取 JS-SDK 签名配置
   * @param {string} url - 当前页面 URL（不含 # 及后面部分）
   * @returns {Promise<{ appId: string, timestamp: number, nonceStr: string, signature: string }>}
   */
  async getSignature(url) {
    if (!url) throw new Error('url 参数不能为空');

    try {
      const accessToken = await this.getAccessToken();
      const ticket = await this.getJsApiTicket(accessToken);

      const nonceStr = this._generateNonce();
      const timestamp = Math.floor(Date.now() / 1000);

      const signStr = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
      const signature = crypto.createHash('sha1').update(signStr, 'utf8').digest('hex');

      logger.info('WeChatJsSdkService.getSignature 签名成功', { url: url.substring(0, 80) });

      return {
        appId: this.appId,
        timestamp,
        nonceStr,
        signature,
      };
    } catch (error) {
      logger.error('WeChatJsSdkService.getSignature 失败', { url, error: error.message });
      throw error;
    }
  }

  /**
   * 获取 access_token（带内存缓存，优先尝试 Redis）
   * @returns {Promise<string>}
   */
  async getAccessToken() {
    if (this._tokenCache.value && Date.now() < this._tokenCache.expireAt) {
      return this._tokenCache.value;
    }

    const cachedToken = await this._getFromRedis('wechat_jssdk_token');
    if (cachedToken) {
      this._tokenCache = { value: cachedToken, expireAt: Date.now() + 60 * 1000 };
      return cachedToken;
    }

    try {
      const res = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
        params: {
          grant_type: 'client_credential',
          appid: this.appId,
          secret: this.appSecret,
        },
        timeout: 10000,
      });

      if (res.data?.errcode) {
        throw new Error(`微信API错误: ${res.data.errcode} ${res.data.errmsg}`);
      }

      const token = res.data.access_token;
      if (!token) throw new Error('access_token 为空');

      this._tokenCache = { value: token, expireAt: Date.now() + TOKEN_TTL * 1000 };
      await this._setToRedis('wechat_jssdk_token', token, TOKEN_TTL);

      logger.info('WeChatJsSdkService.getAccessToken 获取成功');
      return token;
    } catch (error) {
      logger.error('WeChatJsSdkService.getAccessToken 失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 获取 jsapi_ticket（带内存缓存，优先尝试 Redis）
   * @param {string} accessToken
   * @returns {Promise<string>}
   */
  async getJsApiTicket(accessToken) {
    if (this._ticketCache.value && Date.now() < this._ticketCache.expireAt) {
      return this._ticketCache.value;
    }

    const cachedTicket = await this._getFromRedis('wechat_jssdk_ticket');
    if (cachedTicket) {
      this._ticketCache = { value: cachedTicket, expireAt: Date.now() + 60 * 1000 };
      return cachedTicket;
    }

    try {
      const res = await axios.get('https://api.weixin.qq.com/cgi-bin/ticket/getticket', {
        params: {
          access_token: accessToken,
          type: 'jsapi',
        },
        timeout: 10000,
      });

      if (res.data?.errcode !== 0) {
        throw new Error(`获取 ticket 失败: ${res.data?.errcode} ${res.data?.errmsg}`);
      }

      const ticket = res.data.ticket;
      if (!ticket) throw new Error('jsapi_ticket 为空');

      this._ticketCache = { value: ticket, expireAt: Date.now() + TICKET_TTL * 1000 };
      await this._setToRedis('wechat_jssdk_ticket', ticket, TICKET_TTL);

      logger.info('WeChatJsSdkService.getJsApiTicket 获取成功');
      return ticket;
    } catch (error) {
      logger.error('WeChatJsSdkService.getJsApiTicket 失败', { error: error.message });
      throw error;
    }
  }

  _generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  async _getFromRedis(key) {
    try {
      const { getRedisClient } = require('../config/redis');
      const redis = getRedisClient();
      return await redis.get(key);
    } catch {
      return null;
    }
  }

  async _setToRedis(key, value, ttl) {
    try {
      const { getRedisClient } = require('../config/redis');
      const redis = getRedisClient();
      await redis.setex(key, ttl, value);
    } catch (error) {
      logger.warn('WeChatJsSdkService._setToRedis 缓存写入失败', { key, error: error.message });
    }
  }
}

module.exports = new WeChatJsSdkService();
