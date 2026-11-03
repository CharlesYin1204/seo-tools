/**
 * 管理后台用户管理控制器
 * 用户列表、创建、更新、删除、重置密码、角色、统计、批量操作
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const bcrypt = require('bcryptjs');

class UserManagementController {
  async getUsers(req, res) {
    try {
      const { page = 1, pageSize = 20, search = '', role = '', status = '' } = req.query;
      const conditions = ['1=1'];
      const params = [];

      if (search) {
        conditions.push('(username LIKE ? OR email LIKE ? OR display_name LIKE ? OR phone LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }
      if (role) { conditions.push('role = ?'); params.push(role); }
      if (status) { conditions.push('status = ?'); params.push(status); }

      const whereClause = conditions.join(' AND ');
      const [countResult] = await query(`SELECT COUNT(*) as total FROM users WHERE ${whereClause}`, [...params]);
      const total = countResult?.total || 0;

      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const data = await query(
        `SELECT id, username, email, display_name, phone, avatar, role, status, last_login_at, created_at, updated_at
         FROM users WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(pageSize, 10), offset]
      );

      return success(res, { data, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getStats(req, res) {
    try {
      const [row] = await query(`
        SELECT
          COUNT(*) as totalUsers,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeUsers,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as adminCount,
          SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as userCount
        FROM users
      `);
      return success(res, {
        totalUsers: row?.totalUsers || 0,
        activeUsers: row?.activeUsers || 0,
        adminCount: row?.adminCount || 0,
        userCount: row?.userCount || 0,
      });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async createUser(req, res) {
    try {
      const { username, email, password, display_name, phone, role = 'user', status = 'active' } = req.body;
      if (!username || !email || !password) {
        return error(res, '用户名、邮箱、密码不能为空', 400);
      }
      if (password.length < 6) return error(res, '密码至少6位', 400);

      const [existing] = await query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
      if (existing) return error(res, '用户名或邮箱已存在', 400);

      const hashed = await bcrypt.hash(password, 10);
      const result = await query(
        'INSERT INTO users (username, email, password, display_name, phone, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [username, email, hashed, display_name || username, phone || null, role, status]
      );
      return success(res, { id: result.insertId }, '用户创建成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getUserDetail(req, res) {
    try {
      const { id } = req.params;
      const [user] = await query(
        'SELECT id, username, email, display_name, phone, avatar, role, status, last_login_at, created_at, updated_at FROM users WHERE id = ?',
        [id]
      );
      if (!user) return error(res, '用户不存在', 404);
      return success(res, user);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { displayName, display_name, email, phone, status, role } = req.body;
      const [existing] = await query('SELECT * FROM users WHERE id = ?', [id]);
      if (!existing) return error(res, '用户不存在', 404);

      const updates = [];
      const params = [];
      const name = displayName || display_name;
      if (name !== undefined) { updates.push('display_name = ?'); params.push(name); }
      if (email !== undefined) { updates.push('email = ?'); params.push(email); }
      if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
      if (status !== undefined) { updates.push('status = ?'); params.push(status); }
      if (role !== undefined) { updates.push('role = ?'); params.push(role); }

      if (updates.length > 0) {
        params.push(id);
        await query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
      }
      const [row] = await query(
        'SELECT id, username, email, display_name, phone, avatar, role, status, last_login_at, created_at, updated_at FROM users WHERE id = ?',
        [id]
      );
      return success(res, row, '更新成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status: newStatus } = req.body;
      if (!newStatus) return error(res, '状态不能为空', 400);
      await query('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [newStatus, id]);
      return success(res, null, '状态已更新');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      if (parseInt(id, 10) === req.user?.id) return error(res, '不能删除当前登录用户', 400);
      const [existing] = await query('SELECT * FROM users WHERE id = ?', [id]);
      if (!existing) return error(res, '用户不存在', 404);
      await query('DELETE FROM users WHERE id = ?', [id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async resetPassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) return error(res, '密码至少6位', 400);
      const [existing] = await query('SELECT * FROM users WHERE id = ?', [id]);
      if (!existing) return error(res, '用户不存在', 404);
      const hashed = await bcrypt.hash(newPassword, 10);
      await query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashed, id]);
      return success(res, null, '密码已重置');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async updateRole(req, res) {
    try {
      const { id } = req.params;
      const { role } = req.body;
      if (!role) return error(res, '角色不能为空', 400);
      if (parseInt(id, 10) === req.user?.id) return error(res, '不能修改自己的角色', 400);
      await query('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?', [role, id]);
      const [row] = await query('SELECT id, username, role FROM users WHERE id = ?', [id]);
      return success(res, row, '角色已更新');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async batchAction(req, res) {
    try {
      const { ids, action, status: newStatus } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) return error(res, '请选择用户', 400);

      const currentUserId = req.user?.id;
      const safeIds = ids.filter(id => parseInt(id, 10) !== currentUserId);
      if (safeIds.length === 0) return error(res, '不能对自己执行批量操作', 400);

      const placeholders = safeIds.map(() => '?').join(',');

      if (action === 'delete') {
        await query(`DELETE FROM users WHERE id IN (${placeholders})`, safeIds);
        return success(res, null, `成功删除 ${safeIds.length} 个用户`);
      } else if (action === 'status' && newStatus) {
        await query(`UPDATE users SET status = ?, updated_at = NOW() WHERE id IN (${placeholders})`, [newStatus, ...safeIds]);
        return success(res, null, `成功更新 ${safeIds.length} 个用户状态`);
      }

      return error(res, '无效操作', 400);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new UserManagementController();
