/**
 * 房东白名单管理控制器
 * 管理房东白名单列表
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class WhitelistController {
  /**
   * 获取白名单列表
   * GET /landlord/whitelist?page=1&pageSize=20
   * 表 landlord_whitelist 列：id, landlord_id, agent_id, created_at（注意：无 user_id 列）
   */
  async getWhitelist(req, res) {
    try {
      const landlordId = req.user.id;
      const { page = 1, pageSize = 20 } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

      const [countRow] = await query('SELECT COUNT(*) as total FROM landlord_whitelist WHERE landlord_id = ?', [landlordId]).catch(() => [{ total: 0 }]);
      const total = countRow?.total || 0;

      const list = await query(
        'SELECT lw.*, u.username as landlord_name, u2.username as agent_name FROM landlord_whitelist lw LEFT JOIN users u ON lw.landlord_id = u.id LEFT JOIN users u2 ON lw.agent_id = u2.id WHERE lw.landlord_id = ? ORDER BY lw.created_at DESC LIMIT ? OFFSET ?',
        [landlordId, parseInt(pageSize, 10), offset]
      );

      return paginated(res, list, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      logger.error('获取白名单失败', { error: err.message });
      return error(res, '获取白名单失败', 500);
    }
  }

  /**
   * 添加到白名单
   * POST /landlord/whitelist  body: { user_id, phone, email, remark }
   */
  async addToWhitelist(req, res) {
    try {
      const landlordId = req.user.id;
      const { agent_id } = req.body;

      if (!agent_id) {
        return error(res, '请提供中介ID', 400);
      }

      const [existing] = await query(
        'SELECT id FROM landlord_whitelist WHERE landlord_id = ? AND agent_id = ? LIMIT 1',
        [landlordId, agent_id]
      ).catch(() => [null]);
      if (existing) {
        return error(res, '该中介已在白名单中', 400);
      }

      const result = await query(
        'INSERT INTO landlord_whitelist (landlord_id, agent_id, created_at) VALUES (?, ?, NOW())',
        [landlordId, agent_id]
      );

      return success(res, { id: result.insertId }, '添加白名单成功');
    } catch (err) {
      logger.error('添加白名单失败', { error: err.message });
      return error(res, '添加白名单失败', 500);
    }
  }

  /**
   * 从白名单移除
   * DELETE /landlord/whitelist/:id
   * 仅允许删除自己的白名单记录
   */
  async removeFromWhitelist(req, res) {
    try {
      const landlordId = req.user.id;
      const { id } = req.params;
      const [row] = await query('SELECT id FROM landlord_whitelist WHERE id = ? AND landlord_id = ?', [id, landlordId]);
      if (!row) {
        return error(res, '白名单记录不存在或无权限删除', 404);
      }
      await query('DELETE FROM landlord_whitelist WHERE id = ? AND landlord_id = ?', [id, landlordId]);
      return success(res, null, '已从白名单移除');
    } catch (err) {
      logger.error('移除白名单失败', { error: err.message });
      return error(res, '移除白名单失败', 500);
    }
  }
}

module.exports = new WhitelistController();
