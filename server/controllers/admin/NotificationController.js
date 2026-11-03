/**
 * 管理后台通知控制器
 * 通知列表、创建、删除
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class NotificationController {
  async getNotifications(req, res) {
    try {
      const { page = 1, pageSize = 20, type = '' } = req.query;
      let sql = 'SELECT * FROM admin_notifications WHERE 1=1';
      const params = [];
      if (type) {
        sql += ' AND type = ?';
        params.push(type);
      }
      const countSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*) as total');
      const [countResult] = await query(countSql, params);
      const total = countResult ? countResult.total : 0;
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10));
      const data = await query(sql, params);
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async createNotification(req, res) {
    try {
      const { title, content, type, relatedId, relatedType, link } = req.body;
      if (!title || !content) {
        return error(res, '标题和内容不能为空', 400);
      }
      await query(
        'INSERT INTO admin_notifications (title, content, type, related_id, related_type, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, NOW())',
        [title, content, type || 'system', relatedId || null, relatedType || null, link || null]
      );
      const [row] = await query('SELECT * FROM admin_notifications ORDER BY id DESC LIMIT 1');
      return success(res, row, '创建成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const [existing] = await query('SELECT * FROM admin_notifications WHERE id = ?', [id]);
      if (!existing) {
        return error(res, '通知不存在', 404);
      }
      await query('DELETE FROM admin_notifications WHERE id = ?', [id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new NotificationController();
