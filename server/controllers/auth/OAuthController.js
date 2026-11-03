/**
 * OAuth登录控制器
 * 处理第三方OAuth登录（彩虹登录等）
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const crypto = require('crypto');

class OAuthController {
  /**
   * 重定向到OAuth授权页
   * GET /auth/oauth/redirect?provider=rainbow
   */
  async redirect(req, res) {
    try {
      const provider = req.query.provider || 'rainbow';

      const [config] = await query(
        'SELECT * FROM auth_configs WHERE config_key = ? LIMIT 1',
        [provider]
      ).catch(() => [null]);

      if (!config) {
        return error(res, '未配置该登录方式', 400);
      }

      const parsed = typeof config.config_value === 'string' ? JSON.parse(config.config_value || '{}') : (config.config_value || {});
      if (parsed.status !== 1 && parsed.status !== '1') {
        return error(res, '未配置该登录方式', 400);
      }
      const configData = parsed.config || {};
      const state = crypto.randomBytes(16).toString('hex');

      const callbackUrl = configData.callback_url || `${req.protocol}://${req.get('host')}/auth/oauth/callback`;
      const authUrl = `${configData.auth_url || configData.authorize_url}?` +
        `app_id=${configData.app_id || configData.client_id}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&state=${state}` +
        `&response_type=code`;

      if (req.session) {
        req.session.oauth_state = state;
        req.session.oauth_provider = provider;
      }

      return res.redirect(authUrl);
    } catch (err) {
      logger.error('OAuth重定向失败', { error: err.message });
      return error(res, 'OAuth登录失败', 500);
    }
  }

  /**
   * OAuth回调处理 - 创建/登录用户，返回token
   * GET /auth/oauth/callback?code=xxx&state=xxx
   */
  async callback(req, res) {
    try {
      const { code, state } = req.query;

      if (!code) {
        return error(res, '授权失败，缺少授权码', 400);
      }

      const provider = (req.session && req.session.oauth_provider) || req.query.provider || 'rainbow';

      const [config] = await query(
        'SELECT * FROM auth_configs WHERE config_key = ? LIMIT 1',
        [provider]
      ).catch(() => [null]);

      if (!config) {
        return error(res, '未配置该登录方式', 400);
      }

      const parsed = typeof config.config_value === 'string' ? JSON.parse(config.config_value || '{}') : (config.config_value || {});
      if (parsed.status !== 1 && parsed.status !== '1') {
        return error(res, '未配置该登录方式', 400);
      }
      const configData = parsed.config || {};

      logger.info('OAuth回调', { provider, code: code.substring(0, 10) + '...' });

      const oauthUserId = `${provider}_${code}`;
      let [user] = await query(
        'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ? LIMIT 1',
        [provider, oauthUserId]
      ).catch(() => [null]);

      if (!user) {
        const username = `${provider}_user_${Date.now()}`;
        await query(
          'INSERT INTO users (username, oauth_provider, oauth_id, status, created_at, updated_at) VALUES (?, ?, ?, 1, NOW(), NOW())',
          [username, provider, oauthUserId]
        );
        [user] = await query(
          'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ? LIMIT 1',
          [provider, oauthUserId]
        );
      }

      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role || 'user' },
        process.env.JWT_SECRET || 'expatshome_secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return success(res, {
        token,
        user: { id: user.id, username: user.username, email: user.email, role: user.role },
      }, '登录成功');
    } catch (err) {
      logger.error('OAuth回调处理失败', { error: err.message });
      return error(res, 'OAuth登录失败', 500);
    }
  }
}

module.exports = new OAuthController();
