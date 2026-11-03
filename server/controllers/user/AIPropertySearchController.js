/**
 * 用户端AI房源搜索控制器
 * 搜索、历史记录
 */
const Property = require('../../models/Property');
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class AIPropertySearchController {
  async index(req, res) {
    try {
      return success(res, { message: 'AI房源搜索页面' });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async search(req, res) {
    try {
      const userId = req.user?.id;
      const { q, page = 1, pageSize = 20 } = req.body;
      if (!q || typeof q !== 'string') {
        return error(res, '请输入搜索关键词', 400);
      }
      const searchTerms = q.trim().split(/\s+/).filter(Boolean);
      if (searchTerms.length === 0) {
        return error(res, '请输入有效关键词', 400);
      }
      let sql = "SELECT id, title, price, bedrooms, bathrooms, district, address, images FROM properties WHERE status = 'published'";
      const params = [];
      const conditions = searchTerms.map(() => '(title LIKE ? OR address LIKE ? OR district LIKE ?)').join(' AND ');
      searchTerms.forEach((t) => {
        const s = `%${t}%`;
        params.push(s, s, s);
      });
      sql += ` AND (${conditions})`;
      const countSql = sql.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
      const [countResult] = await query(countSql, params);
      const total = countResult ? countResult.total : 0;
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10));
      const data = await query(sql, params);
      if (userId) {
        await query(
          'INSERT INTO ai_property_search_history (user_id, query, created_at) VALUES (?, ?, NOW())',
          [userId, q.trim()]
        ).catch(() => {});
      }
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getHistory(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 10 } = req.query;
      const rows = await query(
        'SELECT id, query, created_at FROM ai_property_search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
        [userId, parseInt(limit, 10)]
      );
      return success(res, rows);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new AIPropertySearchController();
