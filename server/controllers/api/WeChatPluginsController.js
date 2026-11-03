/**
 * 微信公众号矩阵插件API控制器
 * 文章采集、搜索、统计、标题生成、热门话题、内容优化、图片生成
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error, paginated } = require('../../utils/response');

class WeChatPluginsController {
  /**
   * 采集文章
   */
  async collectArticle(req, res) {
    try {
      const userId = req.user.id;
      const { url, account_id } = req.body;

      if (!url) {
        return error(res, '文章URL不能为空', 400);
      }

      const [existing] = await query(
        'SELECT id FROM wechat_articles WHERE source_url = ? LIMIT 1',
        [url]
      ).catch(() => [null]);

      if (existing) {
        return error(res, '该文章已被采集', 400);
      }

      const result = await query(
        `INSERT INTO wechat_articles (user_id, account_id, source_url, status, created_at)
         VALUES (?, ?, ?, 'pending', NOW())`,
        [userId, account_id || null, url]
      );

      return success(res, { id: result.insertId, status: 'pending' }, '采集任务已提交');
    } catch (err) {
      logger.error('采集文章失败', { error: err.message, userId: req.user?.id });
      return error(res, '采集文章失败', 500);
    }
  }

  /**
   * 搜索文章
   */
  async searchArticles(req, res) {
    try {
      const userId = req.user.id;
      const { keyword, page = 1, pageSize = 20, account_id } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const params = [userId];

      let where = 'WHERE wa.user_id = ?';

      if (keyword) {
        where += ' AND (wa.title LIKE ? OR wa.content LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }
      if (account_id) {
        where += ' AND wa.account_id = ?';
        params.push(account_id);
      }

      const countSql = `SELECT COUNT(*) as total FROM wechat_articles wa ${where}`;
      const [countRow] = await query(countSql, params).catch(() => [{ total: 0 }]);
      const total = countRow?.total || 0;

      const dataSql = `
        SELECT wa.id, wa.title, wa.author, wa.source_url, wa.cover_image,
               wa.status, wa.created_at
        FROM wechat_articles wa
        ${where}
        ORDER BY wa.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, parseInt(pageSize, 10), offset];
      const articles = await query(dataSql, dataParams).catch(() => []);

      return paginated(res, articles, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      logger.error('搜索文章失败', { error: err.message, userId: req.user?.id });
      return error(res, '搜索文章失败', 500);
    }
  }

  /**
   * 获取插件统计
   */
  async getPluginStats(req, res) {
    try {
      const userId = req.user.id;

      const [articleCount] = await query(
        'SELECT COUNT(*) as total FROM wechat_articles WHERE user_id = ?',
        [userId]
      ).catch(() => [{ total: 0 }]);

      const [accountCount] = await query(
        'SELECT COUNT(*) as total FROM wechat_official_accounts WHERE user_id = ?',
        [userId]
      ).catch(() => [{ total: 0 }]);

      const [todayCount] = await query(
        'SELECT COUNT(*) as total FROM wechat_articles WHERE user_id = ? AND DATE(created_at) = CURDATE()',
        [userId]
      ).catch(() => [{ total: 0 }]);

      return success(res, {
        total_articles: articleCount?.total || 0,
        total_accounts: accountCount?.total || 0,
        today_articles: todayCount?.total || 0,
      });
    } catch (err) {
      logger.error('获取插件统计失败', { error: err.message, userId: req.user?.id });
      return error(res, '获取插件统计失败', 500);
    }
  }

  /**
   * AI生成标题
   */
  async generateTitles(req, res) {
    try {
      const { content, count = 5, style } = req.body;

      if (!content) {
        return error(res, '请输入内容', 400);
      }

      // TODO: 对接AI服务生成标题，当前返回占位数据
      const titles = Array.from({ length: count }, (_, i) => ({
        title: `AI生成标题${i + 1}（需对接AI服务）`,
        score: Math.round(Math.random() * 40 + 60),
      }));

      return success(res, { titles });
    } catch (err) {
      logger.error('生成标题失败', { error: err.message });
      return error(res, '生成标题失败', 500);
    }
  }

  /**
   * 获取热门话题
   */
  async getHotTopics(req, res) {
    try {
      const { category, limit = 20 } = req.query;
      const params = [];

      let where = "WHERE ht.status = 'active'";
      if (category) {
        where += ' AND ht.category = ?';
        params.push(category);
      }

      const topics = await query(
        `SELECT ht.id, ht.title, ht.category, ht.heat_score, ht.source, ht.created_at
         FROM hot_topics ht
         ${where}
         ORDER BY ht.heat_score DESC
         LIMIT ?`,
        [...params, parseInt(limit, 10)]
      ).catch(() => []);

      return success(res, topics);
    } catch (err) {
      logger.error('获取热门话题失败', { error: err.message });
      return error(res, '获取热门话题失败', 500);
    }
  }

  /**
   * AI优化内容
   */
  async optimizeContent(req, res) {
    try {
      const { content, type = 'rewrite' } = req.body;

      if (!content) {
        return error(res, '请输入待优化内容', 400);
      }

      // TODO: 对接AI服务优化内容
      return success(res, {
        original: content,
        optimized: content,
        type,
        message: '需对接AI服务',
      });
    } catch (err) {
      logger.error('优化内容失败', { error: err.message });
      return error(res, '优化内容失败', 500);
    }
  }

  /**
   * AI生成图片
   */
  async generateImages(req, res) {
    try {
      const { prompt, count = 1, size = '1024x1024' } = req.body;

      if (!prompt) {
        return error(res, '请输入图片描述', 400);
      }

      // TODO: 对接AI图片生成服务
      return success(res, {
        images: [],
        prompt,
        message: '需对接AI图片生成服务',
      });
    } catch (err) {
      logger.error('生成图片失败', { error: err.message });
      return error(res, '生成图片失败', 500);
    }
  }
}

module.exports = new WeChatPluginsController();
