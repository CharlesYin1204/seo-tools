/**
 * OAuth 服务 - Rainbow 登录等第三方登录集成
 */
const axios = require('axios');
const logger = require('../utils/logger');

class OAuthService {
  constructor() {
    this.rainbowEnabled = process.env.RAINBOW_LOGIN_ENABLED === 'true';
    this.rainbowAppId = process.env.RAINBOW_APP_ID || '';
    this.rainbowAppKey = process.env.RAINBOW_APP_KEY || '';
    this.rainbowApiUrl = (process.env.RAINBOW_API_URL || '').replace(/\/$/, '');
  }

  /**
   * 获取授权 URL
   * @param {string} type - rainbow|wechat|google
   * @returns {Promise<string>}
   */
  async getAuthUrl(type = 'rainbow') {
    if (type === 'rainbow' && this.rainbowEnabled) {
      const state = this._generateState();
      const redirectUri = encodeURIComponent(process.env.RAINBOW_REDIRECT_URI || `${process.env.APP_URL}/auth/rainbow/callback`);
      return `${this.rainbowApiUrl}/oauth/authorize?client_id=${this.rainbowAppId}&redirect_uri=${redirectUri}&response_type=code&state=${state}&scope=user_info`;
    }
    if (type === 'wechat') {
      const appId = process.env.WECHAT_APP_ID || '';
      const redirectUri = encodeURIComponent(process.env.WECHAT_REDIRECT_URI || '');
      return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=wechat`;
    }
    throw new Error(`不支持的登录类型: ${type}`);
  }

  /**
   * 处理 OAuth 回调，用 code 换取 token 和用户信息
   * @param {string} code - 授权码
   * @param {string} type - rainbow|wechat
   * @returns {Promise<{ openId: string, nickname?: string, avatar?: string }>}
   */
  async handleCallback(code, type = 'rainbow') {
    if (!code) {
      throw new Error('缺少授权码');
    }
    if (type === 'rainbow') {
      return this._rainbowCallback(code);
    }
    if (type === 'wechat') {
      return this._wechatCallback(code);
    }
    throw new Error(`不支持的登录类型: ${type}`);
  }

  async _rainbowCallback(code) {
    try {
      const redirectUri = process.env.RAINBOW_REDIRECT_URI || `${process.env.APP_URL}/auth/rainbow/callback`;
      const tokenRes = await axios.post(`${this.rainbowApiUrl}/oauth/token`, {
        client_id: this.rainbowAppId,
        client_secret: this.rainbowAppKey,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }, { timeout: 10000 });

      const { access_token } = tokenRes.data || {};
      if (!access_token) throw new Error('获取 token 失败');

      const userRes = await axios.get(`${this.rainbowApiUrl}/api/user/info`, {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 10000,
      });

      const user = userRes.data?.data || userRes.data;
      return {
        openId: user.id || user.open_id || user.user_id,
        nickname: user.nickname || user.name,
        avatar: user.avatar || user.headimgurl,
      };
    } catch (error) {
      logger.error('OAuthService._rainbowCallback 失败', { error: error.message });
      throw error;
    }
  }

  async _wechatCallback(code) {
    const appId = process.env.WECHAT_APP_ID || '';
    const appSecret = process.env.WECHAT_APP_SECRET || '';
    const tokenRes = await axios.get(
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`,
      { timeout: 10000 }
    );
    const { access_token, openid } = tokenRes.data || {};
    if (!openid) throw new Error('微信授权失败');

    const userRes = await axios.get(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`,
      { timeout: 10000 }
    );
    const user = userRes.data || {};
    return {
      openId: user.openid,
      nickname: user.nickname,
      avatar: user.headimgurl,
    };
  }

  _generateState() {
    return require('crypto').randomBytes(16).toString('hex');
  }
}

module.exports = new OAuthService();
