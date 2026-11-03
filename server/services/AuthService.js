/**
 * 认证服务
 * 处理用户登录、注册、密码重置等
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require('../models/User');
const logger = require('../utils/logger');

class AuthService {
  async markUserActivity(userId, timestamp = new Date()) {
    if (!userId) return null;

    const formatted = this.formatLocalDateTime(timestamp);
    await User.update(userId, {
      last_login_at: formatted,
      updated_at: formatted,
    });

    return User.getPublicProfile(userId);
  }

  formatLocalDateTime(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * 用户登录
   */
  async login(usernameOrEmail, password) {
    const user = await User.findOne({
      ...(usernameOrEmail.includes('@')
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail }),
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.status === 'banned') {
      throw new Error('账号已被封禁');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('密码错误');
    }

    const refreshedUser = await this.markUserActivity(user.id);
    const token = this.generateToken(refreshedUser || user);
    const userInfo = { ...(refreshedUser || user) };
    delete userInfo.password;

    return { user: userInfo, token };
  }

  /**
   * 用户注册
   */
  async register(userData) {
    const { username, email, password, phone, display_name } = userData;
    const requestedRole = String(userData.role || '').trim();
    const role = requestedRole === 'tenant' ? 'tenant' : 'user';

    if (username) {
      const existingUsername = await User.findByUsername(username);
      if (existingUsername) throw new Error('用户名已存在');
    }

    if (email) {
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) throw new Error('邮箱已被注册');
    }

    if (phone) {
      const existingPhone = await User.findByPhone(phone);
      if (existingPhone) throw new Error('手机号已被注册');
    }

    const userId = await User.createUser({
      username: username || email,
      email,
      password,
      phone: phone || null,
      display_name: display_name || username || email.split('@')[0],
      role,
      status: 'active',
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    const user = await User.getPublicProfile(userId);
    const token = this.generateToken(user);

    return { user, token };
  }

  /**
   * 手机号登录/注册
   */
  async phoneLogin(phone) {
    let user = await User.findByPhone(phone);

    if (!user) {
      const userId = await User.createUser({
        username: `user_${phone}`,
        phone,
        display_name: `用户${phone.slice(-4)}`,
        role: 'user',
        status: 'active',
        password: Math.random().toString(36).slice(-8),
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
      user = await User.getPublicProfile(userId);
    } else {
      delete user.password;
    }

    user = await this.markUserActivity(user.id) || user;

    const token = this.generateToken(user);
    return { user, token };
  }

  /**
   * 生成JWT Token
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  /**
   * 修改密码
   */
  async changePassword(userId, oldPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) throw new Error('用户不存在');

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) throw new Error('原密码错误');

    await User.updatePassword(userId, newPassword);
    return true;
  }
}

module.exports = new AuthService();
