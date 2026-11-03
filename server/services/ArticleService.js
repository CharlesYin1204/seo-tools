/**
 * 文章服务
 * 文章 CRUD 与发布
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

class ArticleService {
  /**
   * 创建文章
   * @param {Object} data - { user_id, title, content, excerpt, cover_url, status }
   * @returns {Promise<number>} 文章ID
   */
  async createArticle(data) {
    const { user_id, title, content, excerpt, cover_url, status } = data;
    const rows = await query(
      `INSERT INTO articles (user_id, title, content, excerpt, cover_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [user_id || 0, title || '', content || '', excerpt || '', cover_url || '', status || 'draft']
    );
    return rows.insertId;
  }

  /**
   * 更新文章
   * @param {number} id - 文章ID
   * @param {Object} data - 更新字段
   * @returns {Promise<number>} 影响行数
   */
  async updateArticle(id, data) {
    const fields = ['title', 'content', 'excerpt', 'cover_url', 'status'];
    const set = [];
    const vals = [];
    for (const f of fields) {
      if (data[f] !== undefined) {
        set.push(`${f} = ?`);
        vals.push(data[f]);
      }
    }
    if (set.length === 0) return 0;
    vals.push(id);
    const sql = `UPDATE articles SET ${set.join(', ')}, updated_at = NOW() WHERE id = ?`;
    const result = await query(sql, vals);
    return result.affectedRows ?? 0;
  }

  /**
   * 发布文章
   * @param {number} id - 文章ID
   * @returns {Promise<boolean>}
   */
  async publishArticle(id) {
    const result = await query(
      'UPDATE articles SET status = ?, published_at = NOW(), updated_at = NOW() WHERE id = ?',
      ['published', id]
    );
    const affected = result.affectedRows ?? 0;
    logger.info('ArticleService.publishArticle', { id, affected });
    return (affected ?? 0) > 0;
  }
}

module.exports = new ArticleService();
