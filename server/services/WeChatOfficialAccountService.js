/**
 * 微信公众号服务
 * 账号管理、文章同步、发布
 */
const axios = require('axios');
const { query } = require('../config/database');
const logger = require('../utils/logger');

class WeChatOfficialAccountService {
  /**
   * 获取用户的公众号账号列表
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>}
   */
  async getAccounts(userId) {
    try {
      const rows = await query(
        'SELECT * FROM wechat_official_accounts WHERE user_id = ? AND deleted_at IS NULL ORDER BY id DESC',
        [userId]
      );
      return rows;
    } catch (error) {
      logger.warn('WeChatOfficialAccountService.getAccounts 失败', { userId, error: error.message });
      return [];
    }
  }

  /**
   * 同步公众号已发文章
   * @param {number} accountId - 账号ID
   * @returns {Promise<{ synced: number }>}
   */
  async syncArticles(accountId) {
    const account = await query('SELECT * FROM wechat_official_accounts WHERE id = ?', [accountId]);
    if (!account[0]) throw new Error('账号不存在');

    const { app_id, app_secret } = account[0];
    const token = await this._getAccessToken(app_id, app_secret);
    if (!token) throw new Error('获取 access_token 失败');

    try {
      const res = await axios.get(
        `https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=${token}`,
        {
          params: { type: 'news', offset: 0, count: 20 },
          timeout: 15000,
        }
      );
      const items = res.data?.item || [];
      let synced = 0;
      for (const item of items) {
        const news = item.content?.news_item || [];
        for (const n of news) {
          await query(
            `INSERT INTO wechat_official_articles (account_id, title, author, digest, content_url, thumb_url, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE updated_at = NOW()`,
            [accountId, n.title, n.author, n.digest, n.url, n.thumb_url]
          );
          synced++;
        }
      }
      logger.info('WeChatOfficialAccountService.syncArticles', { accountId, synced });
      return { synced };
    } catch (error) {
      logger.error('WeChatOfficialAccountService.syncArticles 失败', { accountId, error: error.message });
      throw error;
    }
  }

  /**
   * 发布文章到公众号
   * @param {number} accountId - 账号ID
   * @param {number} articleId - 文章ID
   * @returns {Promise<{ msgId?: string }>}
   */
  async publishArticle(accountId, articleId) {
    const [acc] = await query('SELECT * FROM wechat_official_accounts WHERE id = ?', [accountId]);
    const [art] = await query('SELECT * FROM articles WHERE id = ?', [articleId]);
    if (!acc || !art) throw new Error('账号或文章不存在');

    const token = await this._getAccessToken(acc.app_id, acc.app_secret);
    if (!token) throw new Error('获取 access_token 失败');

    const res = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${token}`,
      {
        media_id: art.wechat_media_id || '',
      },
      { timeout: 15000 }
    );

    const err = res.data?.errcode;
    if (err && err !== 0) throw new Error(res.data?.errmsg || '发布失败');
    return { msgId: res.data?.publish_id };
  }

  async _getAccessToken(appId, appSecret) {
    const cacheKey = `wx_oa_token:${appId}`;
    const { getRedisClient } = require('../config/redis');
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    const res = await axios.get(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`,
      { timeout: 10000 }
    );
    const token = res.data?.access_token;
    if (token) await redis.setex(cacheKey, 7000, token);
    return token;
  }
}

module.exports = new WeChatOfficialAccountService();
