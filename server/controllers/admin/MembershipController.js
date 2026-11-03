/**
 * 管理后台会员套餐控制器
 * 套餐列表、保存、删除、用户会员列表
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class MembershipController {
  async getPackages(req, res) {
    try {
      const rows = await query(
        'SELECT * FROM membership_packages ORDER BY created_at DESC, price ASC'
      );
      return success(res, rows);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async savePackage(req, res) {
    try {
      const { id, name, description, price, durationDays, features, isActive } = req.body;
      if (!name) {
        return error(res, '套餐名称不能为空', 400);
      }
      const featuresStr = typeof features === 'string' ? features : JSON.stringify(features || {});
      const activeVal = isActive !== undefined ? (isActive ? 1 : 0) : 1;
      if (id) {
        await query(
          'UPDATE membership_packages SET name = ?, description = ?, price = ?, duration_days = ?, features = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
          [name, description || '', price || 0, durationDays || 30, featuresStr, activeVal, id]
        );
        const [row] = await query('SELECT * FROM membership_packages WHERE id = ?', [id]);
        return success(res, row, '更新成功');
      } else {
        await query(
          'INSERT INTO membership_packages (name, description, price, duration_days, features, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
          [name, description || '', price || 0, durationDays || 30, featuresStr, activeVal]
        );
        const [row] = await query('SELECT * FROM membership_packages ORDER BY id DESC LIMIT 1');
        return success(res, row, '创建成功', 201);
      }
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deletePackage(req, res) {
    try {
      const { id } = req.params;
      const [existing] = await query('SELECT * FROM membership_packages WHERE id = ?', [id]);
      if (!existing) {
        return error(res, '套餐不存在', 404);
      }
      await query('DELETE FROM membership_packages WHERE id = ?', [id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getUserMemberships(req, res) {
    try {
      const { page = 1, pageSize = 20, userId = '', status = '' } = req.query;
      let sql =
        'SELECT um.*, mp.name as package_name, u.username, u.display_name FROM user_memberships um LEFT JOIN membership_packages mp ON um.package_id = mp.id LEFT JOIN users u ON um.user_id = u.id WHERE 1=1';
      const params = [];
      if (userId) {
        sql += ' AND um.user_id = ?';
        params.push(userId);
      }
      if (status) {
        sql += ' AND um.status = ?';
        params.push(status);
      }
      const countSql = sql.replace(/SELECT um\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM');
      const [countResult] = await query(countSql, params);
      const total = countResult ? countResult.total : 0;
      sql += ' ORDER BY um.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10));
      const data = await query(sql, params);
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new MembershipController();
