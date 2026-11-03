/**
 * 管理后台文章控制器
 * 文章CRUD、分类管理
 */
const Article = require('../../models/Article');
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class ArticleController {
  async getArticles(req, res) {
    try {
      const { page = 1, pageSize = 20, categoryId = '', status = '', search = '' } = req.query;
      let sql = 'SELECT a.*, c.name as category_name FROM articles a LEFT JOIN article_categories c ON a.category_id = c.id WHERE 1=1';
      const params = [];
      if (categoryId) {
        sql += ' AND a.category_id = ?';
        params.push(categoryId);
      }
      if (status) {
        sql += ' AND a.status = ?';
        params.push(status);
      }
      if (search) {
        sql += ' AND (a.title LIKE ? OR a.content LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s);
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
      const { title, content, slug, categoryId, status, coverImage } = req.body;
      if (!title) {
        return error(res, '标题不能为空', 400);
      }
      const userId = req.user?.id || 1;
      const articleSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `article-${Date.now()}`;
      await query(
        'INSERT INTO articles (user_id, title, content, slug, category_id, status, cover_image, view_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())',
        [userId, title, content || '', articleSlug, categoryId || null, status || 'draft', coverImage || '']
      );
      const [row] = await query('SELECT * FROM articles ORDER BY id DESC LIMIT 1');
      return success(res, row, '创建成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async updateArticle(req, res) {
    try {
      const { id } = req.params;
      const { title, content, slug, categoryId, status, coverImage } = req.body;
      const [existing] = await query('SELECT * FROM articles WHERE id = ?', [id]);
      if (!existing) {
        return error(res, '文章不存在', 404);
      }
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
      if (slug !== undefined) {
        updates.push('slug = ?');
        params.push(slug);
      }
      if (categoryId !== undefined) {
        updates.push('category_id = ?');
        params.push(categoryId);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
      }
      if (coverImage !== undefined) {
        updates.push('cover_image = ?');
        params.push(coverImage);
      }
      if (updates.length > 0) {
        params.push(id);
        await query(`UPDATE articles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
      }
      const [row] = await query('SELECT * FROM articles WHERE id = ?', [id]);
      return success(res, row, '更新成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteArticle(req, res) {
    try {
      const { id } = req.params;
      const [existing] = await query('SELECT * FROM articles WHERE id = ?', [id]);
      if (!existing) {
        return error(res, '文章不存在', 404);
      }
      await query('DELETE FROM articles WHERE id = ?', [id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getCategories(req, res) {
    try {
      const rows = await query('SELECT * FROM article_categories ORDER BY sort_order ASC, id ASC');
      return success(res, rows);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async saveCategory(req, res) {
    try {
      const { id, name, slug, sortOrder } = req.body;
      if (!name) {
        return error(res, '分类名称不能为空', 400);
      }
      if (id) {
        await query(
          'UPDATE article_categories SET name = ?, slug = ?, sort_order = ?, updated_at = NOW() WHERE id = ?',
          [name, slug || '', sortOrder || 0, id]
        );
        const [row] = await query('SELECT * FROM article_categories WHERE id = ?', [id]);
        return success(res, row, '更新成功');
      } else {
        await query(
          'INSERT INTO article_categories (name, slug, sort_order, created_at) VALUES (?, ?, ?, NOW())',
          [name, slug || '', sortOrder || 0]
        );
        const [row] = await query('SELECT * FROM article_categories ORDER BY id DESC LIMIT 1');
        return success(res, row, '创建成功', 201);
      }
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new ArticleController();
