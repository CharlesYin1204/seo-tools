/**
 * 用户端租户需求控制器
 * 需求列表、创建、更新、删除
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class TenantDemandController {
  async getDemands(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20 } = req.query;
      const countSql = 'SELECT COUNT(*) as total FROM tenant_demands WHERE user_id = ?';
      const [countResult] = await query(countSql, [userId]);
      const total = countResult ? countResult.total : 0;
      const data = await query(
        'SELECT * FROM tenant_demands WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [userId, parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10)]
      );
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async createDemand(req, res) {
    try {
      const userId = req.user.id;
      const { title, description, district, budgetMin, budgetMax, bedrooms, bathrooms, propertyType, moveInDate, note, name, phone, wechat, email } = req.body;
      if (!district && !budgetMin && !budgetMax) {
        return error(res, '请至少填写区域或预算', 400);
      }
      const userName = name || req.user.display_name || req.user.username || '';
      const userPhone = phone || req.user.phone || '';
      await query(
        'INSERT INTO tenant_demands (user_id, name, phone, wechat, email, district, budget_min, budget_max, bedrooms, bathrooms, property_type, move_in_date, requirements, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [userId, userName, userPhone, wechat || '', email || '', district || '', budgetMin || 0, budgetMax || 0, bedrooms || 0, bathrooms || 0, propertyType || '', moveInDate || null, note || description || '', 'open', 'user_center']
      );
      const [row] = await query('SELECT * FROM tenant_demands WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
      return success(res, row, '创建成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async updateDemand(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [existing] = await query('SELECT * FROM tenant_demands WHERE id = ? AND user_id = ?', [id, userId]);
      if (!existing) {
        return error(res, '需求不存在或无权限', 404);
      }
      const { district, budgetMin, budgetMax, bedrooms, moveInDate, note, status } = req.body;
      const updates = [];
      const params = [];
      if (district !== undefined) {
        updates.push('district = ?');
        params.push(district);
      }
      if (budgetMin !== undefined) {
        updates.push('budget_min = ?');
        params.push(budgetMin);
      }
      if (budgetMax !== undefined) {
        updates.push('budget_max = ?');
        params.push(budgetMax);
      }
      if (bedrooms !== undefined) {
        updates.push('bedrooms = ?');
        params.push(bedrooms);
      }
      if (moveInDate !== undefined) {
        updates.push('move_in_date = ?');
        params.push(moveInDate);
      }
      if (note !== undefined) {
        updates.push('requirements = ?');
        params.push(note);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
      }
      if (updates.length === 0) {
        return success(res, existing, '无变更');
      }
      params.push(id);
      await query(`UPDATE tenant_demands SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND user_id = ?`, [
        ...params,
        userId,
      ]);
      const [row] = await query('SELECT * FROM tenant_demands WHERE id = ?', [id]);
      return success(res, row, '更新成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteDemand(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [existing] = await query('SELECT * FROM tenant_demands WHERE id = ? AND user_id = ?', [id, userId]);
      if (!existing) {
        return error(res, '需求不存在或无权限', 404);
      }
      await query('DELETE FROM tenant_demands WHERE id = ? AND user_id = ?', [id, userId]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new TenantDemandController();
