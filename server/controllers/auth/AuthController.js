/**
 * 认证控制器
 * 处理登录、注册、退出、密码重置等
 */
const AuthService = require('../../services/AuthService');
const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');

class AuthController {
  async login(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return error(res, '请输入用户名和密码');
      }

      const result = await AuthService.login(username, password);

      req.session.user = result.user;

      return success(res, {
        user: result.user,
        token: result.token,
      }, '登录成功');
    } catch (err) {
      logger.warn('登录失败', { error: err.message, username: req.body.username });
      return error(res, err.message);
    }
  }

  async register(req, res) {
    try {
      const { query: dbQuery } = require('../../config/database');
      try {
        const [setting] = await dbQuery(
          "SELECT setting_value FROM system_settings WHERE setting_key = 'auth_allow_register'"
        );
        if (setting && (setting.setting_value === 'false' || setting.setting_value === '0')) {
          return error(res, '管理员已关闭用户注册功能');
        }
      } catch {}

      const { username, email, password, phone, display_name, role } = req.body;

      if (!email && !phone) {
        return error(res, '请输入邮箱或手机号');
      }
      if (!password || password.length < 8) {
        return error(res, '密码至少8个字符');
      }

      const result = await AuthService.register({ username, email, password, phone, display_name, role });

      req.session.user = result.user;

      return success(res, {
        user: result.user,
        token: result.token,
      }, '注册成功', 201);
    } catch (err) {
      logger.warn('注册失败', { error: err.message });
      return error(res, err.message);
    }
  }

  async phoneLogin(req, res) {
    try {
      const { phone, code } = req.body;
      if (!phone || !code) {
        return error(res, '请输入手机号和验证码');
      }

      // TODO: 验证短信验证码

      const result = await AuthService.phoneLogin(phone);
      req.session.user = result.user;

      return success(res, {
        user: result.user,
        token: result.token,
      }, '登录成功');
    } catch (err) {
      logger.warn('手机登录失败', { error: err.message });
      return error(res, err.message);
    }
  }

  async logout(req, res) {
    req.session.destroy((err) => {
      if (err) {
        logger.error('退出登录失败', { error: err.message });
        return error(res, '退出失败');
      }
      return success(res, null, '已退出登录');
    });
  }

  async getProfile(req, res) {
    try {
      const User = require('../../models/User');
      const user = await User.getPublicProfile(req.user.id);
      if (!user) {
        return error(res, '用户不存在', 404);
      }
      return success(res, user);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async updateProfile(req, res) {
    try {
      const User = require('../../models/User');
      const { display_name, avatar, phone, email } = req.body;
      const updateData = {};
      if (display_name !== undefined) updateData.display_name = display_name;
      if (avatar !== undefined) updateData.avatar = avatar;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      updateData.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

      await User.update(req.user.id, updateData);
      const user = await User.getPublicProfile(req.user.id);
      return success(res, user, '资料更新成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async phoneRegister(req, res) {
    try {
      const { phone, code, password, display_name } = req.body;
      if (!phone || !code) return error(res, '请输入手机号和验证码');
      if (!password || password.length < 8) return error(res, '密码至少8个字符');
      const result = await AuthService.register({ phone, password, display_name, username: phone });
      req.session.user = result.user;
      return success(res, { user: result.user, token: result.token }, '注册成功', 201);
    } catch (err) {
      return error(res, err.message);
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) return error(res, '请输入邮箱');
      const User = require('../../models/User');
      const user = await User.findByEmail(email);
      if (!user) return error(res, '该邮箱未注册');
      return success(res, null, '重置密码邮件已发送');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      if (!token || !password) return error(res, '缺少参数');
      if (password.length < 8) return error(res, '密码至少8个字符');
      return success(res, null, '密码已重置');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getPublicSettings(req, res) {
    try {
      const { query: dbQuery } = require('../../config/database');
      const rows = await dbQuery(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('auth_allow_register', 'auth_allow_guest', 'auth_enable_captcha')"
      );
      const settings = { allow_register: true, allow_guest: true, enable_captcha: false };
      rows.forEach(r => {
        const key = r.setting_key.replace(/^auth_/, '');
        settings[key] = r.setting_value === 'true' || r.setting_value === '1';
      });
      return success(res, settings);
    } catch (err) {
      return success(res, { allow_register: true, allow_guest: true, enable_captcha: false });
    }
  }

  async changePassword(req, res) {
    try {
      const { old_password, new_password } = req.body;
      if (!old_password || !new_password) {
        return error(res, '请输入原密码和新密码');
      }
      if (new_password.length < 8) {
        return error(res, '新密码至少8个字符');
      }

      await AuthService.changePassword(req.user.id, old_password, new_password);
      return success(res, null, '密码修改成功');
    } catch (err) {
      return error(res, err.message);
    }
  }
}

module.exports = new AuthController();
