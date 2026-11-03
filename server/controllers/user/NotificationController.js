/**
 * 用户通知控制器
 * 通知列表、标记已读、删除通知
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error, paginated } = require('../../utils/response');

class NotificationController {
  /**
   * 获取通知列表（分页）
   */
  async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20, is_read } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const params = [userId];

      let where = 'WHERE n.user_id = ?';
      if (is_read !== undefined && is_read !== '') {
        where += parseInt(is_read, 10) === 1 ? ' AND n.read_at IS NOT NULL' : ' AND n.read_at IS NULL';
      }

      const countSql = `SELECT COUNT(*) as total FROM notifications n ${where}`;
      const [countRow] = await query(countSql, params).catch(() => [{ total: 0 }]);
      const total = countRow?.total || 0;

      const [unreadRow] = await query(
        'SELECT COUNT(*) as total FROM notifications WHERE user_id = ? AND read_at IS NULL',
        [userId]
      ).catch(() => [{ total: 0 }]);

      const dataSql = `
        SELECT n.id, n.type, n.title, n.message, (n.read_at IS NOT NULL) as is_read, n.created_at
        FROM notifications n
        ${where}
        ORDER BY n.read_at ASC, n.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, parseInt(pageSize, 10), offset];
      const notifications = await query(dataSql, dataParams).catch(() => []);

      return res.status(200).json({
        success: true,
        message: '获取成功',
        data: notifications,
        unread_count: unreadRow?.total || 0,
        pagination: {
          total,
          page: parseInt(page, 10),
          pageSize: parseInt(pageSize, 10),
          totalPages: Math.ceil(total / parseInt(pageSize, 10)),
        },
      });
    } catch (err) {
      logger.error('获取通知列表失败', { error: err.message, userId: req.user?.id });
      return error(res, '获取通知列表失败', 500);
    }
  }

  /**
   * 标记通知为已读（支持单条和全部）
   */
  async markRead(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      if (id === 'all') {
        await query(
          'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
          [userId]
        );
        return success(res, null, '全部标记已读');
      }

      const result = await query(
        'UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (result.affectedRows === 0) {
        return error(res, '通知不存在', 404);
      }

      return success(res, null, '已标记已读');
    } catch (err) {
      logger.error('标记已读失败', { error: err.message, userId: req.user?.id });
      return error(res, '标记已读失败', 500);
    }
  }

  /**
   * 删除通知
   */
  async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const result = await query(
        'DELETE FROM notifications WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (result.affectedRows === 0) {
        return error(res, '通知不存在', 404);
      }

      return success(res, null, '通知已删除');
    } catch (err) {
      logger.error('删除通知失败', { error: err.message, userId: req.user?.id });
      return error(res, '删除通知失败', 500);
    }
  }
}

module.exports = new NotificationController();
