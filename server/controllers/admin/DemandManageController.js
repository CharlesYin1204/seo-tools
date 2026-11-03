/**
 * 租客需求管理控制器
 * 管理租客发布的租房需求，支持分页、状态更新与删除
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class DemandManageController {
  /**
   * 分页查询租客需求列表
   * GET /admin/demands?page=1&pageSize=20&status=&search=
   */
  async getDemands(req, res) {
    try {
      const { page = 1, pageSize = 20, status = '', search = '' } = req.query;

      let sql = 'SELECT d.*, u.username, u.display_name, u.email, u.phone FROM tenant_demands d LEFT JOIN users u ON d.user_id = u.id WHERE 1=1';
      const params = [];

      if (status) {
        sql += ' AND d.status = ?';
        params.push(status);
      }
      if (search) {
        sql += ' AND (d.title LIKE ? OR d.description LIKE ? OR u.username LIKE ?)';
        const kw = `%${search}%`;
        params.push(kw, kw, kw);
      }

      const countSql = sql.replace(/SELECT d\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM');
      const [countResult] = await query(countSql, params);
      const total = countResult ? countResult.total : 0;

      sql += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
      const limit = parseInt(pageSize, 10);
      const offset = (parseInt(page, 10) - 1) * limit;
      params.push(limit, offset);

      const data = await query(sql, params);
      return paginated(res, data, total, parseInt(page, 10), limit);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return paginated(res, [], 0, 1, 20);
      }
      logger.error('获取租客需求列表失败', { error: err.message });
      return error(res, '获取需求列表失败', 500);
    }
  }

  /**
   * 更新需求状态
   * PUT /admin/demands/:id/status  body: { status }
   */
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status: newStatus } = req.body;

      if (!newStatus) {
        return error(res, '请提供新状态', 400);
      }

      const [existing] = await query('SELECT id FROM tenant_demands WHERE id = ?', [id]);
      if (!existing) {
        return error(res, '需求不存在', 404);
      }

      await query(
        'UPDATE tenant_demands SET status = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, id]
      );

      const [updated] = await query('SELECT * FROM tenant_demands WHERE id = ?', [id]);
      logger.info('租客需求状态已更新', { id, status: newStatus });
      return success(res, updated, '状态更新成功');
    } catch (err) {
      logger.error('更新需求状态失败', { error: err.message, id: req.params.id });
      return error(res, '更新状态失败', 500);
    }
  }

  /**
   * 删除租客需求
   * DELETE /admin/demands/:id
   */
  async deleteDemand(req, res) {
    try {
      const { id } = req.params;
      const [existing] = await query('SELECT id FROM tenant_demands WHERE id = ?', [id]);
      if (!existing) {
        return error(res, '需求不存在', 404);
      }

      await query('DELETE FROM tenant_demands WHERE id = ?', [id]);
      logger.info('租客需求已删除', { id });
      return success(res, null, '需求删除成功');
    } catch (err) {
      logger.error('删除租客需求失败', { error: err.message, id: req.params.id });
      return error(res, '删除需求失败', 500);
    }
  }
}

module.exports = new DemandManageController();
