/**
 * 文章分类管理控制器
 * 独立的文章分类CRUD管理
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class ArticleCategoryController {
  /**
   * 获取所有文章分类
   * GET /admin/article-categories
   */
  async getCategories(req, res) {
    try {
      const categories = await query(
        'SELECT ac.*, COUNT(a.id) as article_count FROM article_categories ac LEFT JOIN articles a ON ac.id = a.category_id GROUP BY ac.id ORDER BY ac.sort_order, ac.id'
      );
      return success(res, categories);
    } catch (err) {
      logger.error('获取文章分类失败', { error: err.message });
      return error(res, '获取文章分类失败', 500);
    }
  }

  /**
   * 创建/更新文章分类
   * POST /admin/article-categories  body: { id?, name, slug, description, sort_order, status }
   */
  async saveCategory(req, res) {
    try {
      const { id, name, slug, description, sort_order, status } = req.body;

      if (!name) {
        return error(res, '分类名称不能为空', 400);
      }

      const categorySlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '');

      if (id) {
        await query(
          'UPDATE article_categories SET name = ?, slug = ?, description = ?, sort_order = ?, status = ?, updated_at = NOW() WHERE id = ?',
          [name, categorySlug, description || '', sort_order || 0, status !== undefined ? status : 1, id]
        );
        return success(res, { id }, '分类更新成功');
      }

      const [existing] = await query('SELECT id FROM article_categories WHERE slug = ? LIMIT 1', [categorySlug]).catch(() => [null]);
      if (existing) {
        return error(res, '分类别名已存在', 400);
      }

      const result = await query(
        'INSERT INTO article_categories (name, slug, description, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [name, categorySlug, description || '', sort_order || 0, status !== undefined ? status : 1]
      );
      return success(res, { id: result.insertId }, '分类创建成功');
    } catch (err) {
      logger.error('保存文章分类失败', { error: err.message });
      return error(res, '保存文章分类失败', 500);
    }
  }

  /**
   * 删除文章分类（检查是否有文章关联）
   * DELETE /admin/article-categories/:id
   */
  async deleteCategory(req, res) {
    try {
      const { id } = req.params;

      const [articleCount] = await query(
        'SELECT COUNT(*) as count FROM articles WHERE category_id = ?',
        [id]
      ).catch(() => [{ count: 0 }]);

      if (articleCount && articleCount.count > 0) {
        return error(res, `该分类下有 ${articleCount.count} 篇文章，无法删除。请先转移文章后再删除。`, 400);
      }

      await query('DELETE FROM article_categories WHERE id = ?', [id]);
      return success(res, null, '分类删除成功');
    } catch (err) {
      logger.error('删除文章分类失败', { error: err.message });
      return error(res, '删除文章分类失败', 500);
    }
  }
}

module.exports = new ArticleCategoryController();
