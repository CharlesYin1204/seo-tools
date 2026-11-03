/**
 * 前端文章控制器
 * 处理博客文章列表、详情等公开页面
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class ArticleController {
  async publicIndex(req, res) {
    try {
      const { page = 1, pageSize = 12, category, search } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      let sql = "SELECT a.*, ac.name as category_name FROM articles a LEFT JOIN article_categories ac ON a.category_id = ac.id WHERE a.status = 'published'";
      const params = [];

      if (category) {
        sql += ' AND a.category_id = ?';
        params.push(category);
      }
      if (search) {
        sql += ' AND (a.title LIKE ? OR a.content LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      const countSql = sql.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
      const [countRow] = await query(countSql, params).catch(() => [{ total: 0 }]);
      const total = countRow?.total || 0;

      sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize, 10), offset);
      const articles = await query(sql, params).catch(() => []);

      return paginated(res, articles, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, '获取文章列表失败', 500);
    }
  }

  async publicShow(req, res) {
    try {
      const { slug } = req.params;
      const [article] = await query(
        "SELECT a.*, ac.name as category_name FROM articles a LEFT JOIN article_categories ac ON a.category_id = ac.id WHERE a.slug = ? AND a.status = 'published' LIMIT 1",
        [slug]
      ).catch(() => [null]);

      if (!article) return error(res, '文章不存在', 404);

      await query('UPDATE articles SET view_count = IFNULL(view_count, 0) + 1 WHERE id = ?', [article.id]).catch(() => {});
      return success(res, article);
    } catch (err) {
      return error(res, '获取文章详情失败', 500);
    }
  }
}

module.exports = new ArticleController();
