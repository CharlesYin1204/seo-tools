/**
 * 用户端微信文章控制器
 * 文章列表、创建、更新、删除、发布
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class WeChatArticleController {
  async getArticles(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20, accountId = '', status = '' } = req.query;
      let sql =
        'SELECT a.* FROM wechat_articles a INNER JOIN wechat_official_accounts o ON a.account_id = o.id WHERE o.user_id = ?';
      const params = [userId];
      if (accountId) {
        sql += ' AND a.account_id = ?';
        params.push(accountId);
      }
      if (status) {
        sql += ' AND a.status = ?';
        params.push(status);
      }
      const countSql = sql.replace(/SELECT a\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM');
      const [countResult] = await query(countSql, params);
      const total = countResult ? countResult.total : 0;
      sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10));
      const data = await query(sql, params);
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async createArticle(req, res) {
    try {
      const userId = req.user.id;
      const { accountId, title, content, coverUrl } = req.body;
      if (!accountId || !title) {
        return error(res, '请选择账号并填写标题', 400);
      }
      const [account] = await query('SELECT * FROM wechat_official_accounts WHERE id = ? AND user_id = ?', [
        accountId,
        userId,
      ]);
      if (!account) {
        return error(res, '账号不存在或无权限', 404);
      }
      await query(
        'INSERT INTO wechat_articles (account_id, title, content, cover_url, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [accountId, title, content || '', coverUrl || '', 'draft']
      );
      const [row] = await query(
        'SELECT * FROM wechat_articles WHERE account_id = ? ORDER BY id DESC LIMIT 1',
        [accountId]
      );
      return success(res, row, '创建成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async updateArticle(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [article] = await query(
        'SELECT a.* FROM wechat_articles a INNER JOIN wechat_official_accounts o ON a.account_id = o.id WHERE a.id = ? AND o.user_id = ?',
        [id, userId]
      );
      if (!article) {
        return error(res, '文章不存在或无权限', 404);
      }
      const { title, content, coverUrl } = req.body;
      const updates = [];
      const params = [];
      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
      }
      if (content !== undefined) {
        updates.push('content = ?');
        params.push(content);
      }
      if (coverUrl !== undefined) {
        updates.push('cover_url = ?');
        params.push(coverUrl);
      }
      if (updates.length === 0) {
        return success(res, article, '无变更');
      }
      params.push(id);
      await query(`UPDATE wechat_articles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
      const [row] = await query('SELECT * FROM wechat_articles WHERE id = ?', [id]);
      return success(res, row, '更新成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteArticle(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [article] = await query(
        'SELECT a.* FROM wechat_articles a INNER JOIN wechat_official_accounts o ON a.account_id = o.id WHERE a.id = ? AND o.user_id = ?',
        [id, userId]
      );
      if (!article) {
        return error(res, '文章不存在或无权限', 404);
      }
      await query('DELETE FROM wechat_articles WHERE id = ?', [id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async publishArticle(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [article] = await query(
        'SELECT a.* FROM wechat_articles a INNER JOIN wechat_official_accounts o ON a.account_id = o.id WHERE a.id = ? AND o.user_id = ?',
        [id, userId]
      );
      if (!article) {
        return error(res, '文章不存在或无权限', 404);
      }
      await query("UPDATE wechat_articles SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = ?", [
        id,
      ]);
      const [row] = await query('SELECT * FROM wechat_articles WHERE id = ?', [id]);
      return success(res, row, '发布成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new WeChatArticleController();
