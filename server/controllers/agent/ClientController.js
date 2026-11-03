/**
 * 经纪人客户控制器
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class ClientController {
  async getClients(req, res) {
    try {
      const agentId = req.user.id;
      const { page = 1, pageSize = 20 } = req.query;
      const countSql = 'SELECT COUNT(*) as total FROM clients WHERE agent_id = ?';
      const [countResult] = await query(countSql, [agentId]).catch(() => [{ total: 0 }]);
      const total = countResult ? countResult.total : 0;
      const data = await query(
        'SELECT * FROM clients WHERE agent_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [agentId, parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10)]
      ).catch(() => []);
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async addClient(req, res) {
    try {
      const agentId = req.user.id;
      const { name, phone, email, notes } = req.body;
      if (!name || !phone) {
        return error(res, '姓名和手机号不能为空', 400);
      }
      await query(
        'INSERT INTO clients (agent_id, name, phone, email, notes, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [agentId, name, phone, email || '', notes || '']
      );
      const [row] = await query('SELECT * FROM clients WHERE agent_id = ? ORDER BY id DESC LIMIT 1', [agentId]);
      return success(res, row, '添加成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async updateClient(req, res) {
    try {
      const agentId = req.user.id;
      const { id } = req.params;
      const [existing] = await query('SELECT * FROM clients WHERE id = ? AND agent_id = ?', [id, agentId]);
      if (!existing) {
        return error(res, '客户不存在或无权限', 404);
      }
      const { name, phone, email, notes } = req.body;
      const updates = [];
      const params = [];
      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (phone !== undefined) {
        updates.push('phone = ?');
        params.push(phone);
      }
      if (email !== undefined) {
        updates.push('email = ?');
        params.push(email);
      }
      if (notes !== undefined) {
        updates.push('notes = ?');
        params.push(notes);
      }
      if (updates.length > 0) {
        params.push(id);
        await query(`UPDATE clients SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND agent_id = ?`, [
          ...params,
          agentId,
        ]);
      }
      const [row] = await query('SELECT * FROM clients WHERE id = ?', [id]);
      return success(res, row, '更新成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new ClientController();
