/** 公开内容 API。HTML 页面由 Vue Router 统一处理。 */
const express = require('express');
const router = express.Router();
const { success, error } = require('../utils/response');
const { query } = require('../config/database');

router.get('/blog', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 12));
    const offset = (page - 1) * pageSize;
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const where = ["a.status='published'"];
    const params = [];
    if (search) { where.push('(a.title LIKE ? OR a.summary LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (category) { where.push('c.slug=?'); params.push(category); }
    const clause = where.join(' AND ');
    const rows = await query(`SELECT a.id,a.title,a.slug,a.summary,a.cover_image,a.published_at,c.name category_name,c.slug category_slug
      FROM articles a LEFT JOIN article_categories c ON c.id=a.category_id WHERE ${clause}
      ORDER BY a.published_at DESC,a.id DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
    const [count] = await query(`SELECT COUNT(*) total FROM articles a LEFT JOIN article_categories c ON c.id=a.category_id WHERE ${clause}`, params);
    return res.json({ success: true, data: rows, pagination: { page, pageSize, total: Number(count?.total || 0) } });
  } catch (err) { return error(res, '获取文章列表失败', 500); }
});

router.get('/blog/:slug', async (req, res) => {
  try {
    const [article] = await query(`SELECT a.id,a.title,a.slug,a.summary,a.content,a.cover_image,a.published_at,c.name category_name,c.slug category_slug
      FROM articles a LEFT JOIN article_categories c ON c.id=a.category_id WHERE a.slug=? AND a.status='published' LIMIT 1`, [req.params.slug]);
    if (!article) return error(res, '文章不存在', 404);
    return success(res, article);
  } catch (err) { return error(res, '获取文章失败', 500); }
});

module.exports = router;
