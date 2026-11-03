/**
 * 需求大厅控制器
 * 中介查看租客需求，查看详情，提交联系记录
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error, paginated } = require('../../utils/response');

class DemandHallController {
  /**
   * 获取需求列表（分页）
   */
  async getDemands(req, res) {
    try {
      const { page = 1, pageSize = 20, keyword, district, budget_min, budget_max } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const params = [];

      let where = "WHERE td.status = 'open'";

      if (keyword) {
        where += ' AND (td.title LIKE ? OR td.description LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }
      if (district) {
        where += ' AND td.district = ?';
        params.push(district);
      }
      if (budget_min) {
        where += ' AND td.budget_max >= ?';
        params.push(Number(budget_min));
      }
      if (budget_max) {
        where += ' AND td.budget_min <= ?';
        params.push(Number(budget_max));
      }

      const countSql = `SELECT COUNT(*) as total FROM tenant_demands td ${where}`;
      const [countRow] = await query(countSql, params).catch(() => [{ total: 0 }]);
      const total = countRow?.total || 0;

      const dataSql = `
        SELECT td.*, u.nickname as tenant_name, u.avatar as tenant_avatar
        FROM tenant_demands td
        LEFT JOIN users u ON td.user_id = u.id
        ${where}
        ORDER BY td.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, parseInt(pageSize, 10), offset];
      const demands = await query(dataSql, dataParams).catch(() => []);

      return paginated(res, demands, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      logger.error('获取需求列表失败', { error: err.message });
      return error(res, '获取需求列表失败', 500);
    }
  }

  /**
   * 查看需求详情
   */
  async viewDemand(req, res) {
    try {
      const { id } = req.params;

      const [demand] = await query(
        `SELECT td.*, u.nickname as tenant_name, u.avatar as tenant_avatar, u.phone as tenant_phone
         FROM tenant_demands td
         LEFT JOIN users u ON td.user_id = u.id
         WHERE td.id = ? AND td.status = 'open'
         LIMIT 1`,
        [id]
      ).catch(() => [null]);

      if (!demand) {
        return error(res, '需求不存在或已关闭', 404);
      }

      await query('UPDATE tenant_demands SET views = IFNULL(views, 0) + 1 WHERE id = ?', [id]).catch(() => {});

      return success(res, demand);
    } catch (err) {
      logger.error('查看需求详情失败', { error: err.message, demandId: req.params.id });
      return error(res, '查看需求详情失败', 500);
    }
  }

  /**
   * 中介提交联系记录
   */
  async contactDemand(req, res) {
    try {
      const agentId = req.user.id;
      const { demand_id, message } = req.body;

      if (!demand_id) {
        return error(res, '需求ID不能为空', 400);
      }

      const [demand] = await query(
        "SELECT id, user_id FROM tenant_demands WHERE id = ? AND status = 'open' LIMIT 1",
        [demand_id]
      ).catch(() => [null]);

      if (!demand) {
        return error(res, '需求不存在或已关闭', 404);
      }

      const [existing] = await query(
        'SELECT id FROM demand_contacts WHERE demand_id = ? AND agent_id = ? LIMIT 1',
        [demand_id, agentId]
      ).catch(() => [null]);

      if (existing) {
        return error(res, '您已提交过联系记录，请勿重复提交', 400);
      }

      await query(
        `INSERT INTO demand_contacts (demand_id, agent_id, contact_message, status, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', NOW(), NOW())`,
        [demand_id, agentId, message || '']
      );

      return success(res, null, '联系记录已提交');
    } catch (err) {
      logger.error('提交联系记录失败', { error: err.message, agentId: req.user?.id });
      return error(res, '提交联系记录失败', 500);
    }
  }
}

module.exports = new DemandHallController();
