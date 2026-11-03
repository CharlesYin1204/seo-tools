/**
 * 管理员个人资料控制器
 * 管理管理员个人信息、密码修改
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class ProfileController {
  /**
   * 获取管理员个人资料
   * GET /admin/profile
   */
  async getProfile(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return error(res, '未登录', 401);
      }

      const [user] = await query(
        'SELECT id, username, email, phone, avatar, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
        [userId]
      ).catch(() => [null]);

      if (!user) {
        return error(res, '用户不存在', 404);
      }

      return success(res, user);
    } catch (err) {
      logger.error('获取管理员资料失败', { error: err.message });
      return error(res, '获取个人资料失败', 500);
    }
  }

  /**
   * 更新管理员个人资料
   * PUT /admin/profile  body: { username, email, phone, avatar }
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return error(res, '未登录', 401);
      }

      const { username, email, phone, avatar } = req.body;

      if (username) {
        const [existing] = await query(
          'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1',
          [username, userId]
        ).catch(() => [null]);
        if (existing) {
          return error(res, '用户名已被使用', 400);
        }
      }

      const fields = [];
      const params = [];

      if (username) { fields.push('username = ?'); params.push(username); }
      if (email !== undefined) { fields.push('email = ?'); params.push(email); }
      if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
      if (avatar !== undefined) { fields.push('avatar = ?'); params.push(avatar); }

      if (fields.length === 0) {
        return error(res, '没有要更新的内容', 400);
      }

      fields.push('updated_at = NOW()');
      params.push(userId);

      await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
      return success(res, null, '个人资料更新成功');
    } catch (err) {
      logger.error('更新管理员资料失败', { error: err.message });
      return error(res, '更新个人资料失败', 500);
    }
  }

  /**
   * 修改密码
   * POST /admin/profile/change-password  body: { old_password, new_password }
   */
  async changePassword(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return error(res, '未登录', 401);
      }

      const { old_password, new_password } = req.body;
      if (!old_password || !new_password) {
        return error(res, '请填写旧密码和新密码', 400);
      }
      if (new_password.length < 6) {
        return error(res, '新密码长度不能少于6位', 400);
      }

      const [user] = await query('SELECT id, password FROM users WHERE id = ? LIMIT 1', [userId]).catch(() => [null]);
      if (!user) {
        return error(res, '用户不存在', 404);
      }

      const bcrypt = require('bcryptjs');
      const isMatch = await bcrypt.compare(old_password, user.password);
      if (!isMatch) {
        return error(res, '旧密码不正确', 400);
      }

      const hashedPassword = await bcrypt.hash(new_password, 10);
      await query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, userId]);

      return success(res, null, '密码修改成功');
    } catch (err) {
      logger.error('修改密码失败', { error: err.message });
      return error(res, '修改密码失败', 500);
    }
  }
}

module.exports = new ProfileController();
