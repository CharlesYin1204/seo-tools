/**
 * 邮件服务
 * 使用 nodemailer 发送各类邮件
 */
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const config = require('../config');

class EmailService {
  constructor() {
    this._transporter = null;
  }

  _getTransporter() {
    if (this._transporter) return this._transporter;
    const mailConfig = config.mail || {};
    this._transporter = nodemailer.createTransport({
      host: mailConfig.host || process.env.MAIL_HOST || 'smtp.qq.com',
      port: mailConfig.port || parseInt(process.env.MAIL_PORT, 10) || 587,
      secure: false,
      auth: {
        user: mailConfig.username || process.env.MAIL_USERNAME,
        pass: mailConfig.password || process.env.MAIL_PASSWORD,
      },
    });
    return this._transporter;
  }

  /**
   * 发送通用邮件
   * @param {string} to - 收件人
   * @param {string} subject - 主题
   * @param {string} html - HTML内容
   */
  async sendMail(to, subject, html) {
    try {
      const fromEmail = config.mail?.fromEmail || process.env.MAIL_FROM_EMAIL || 'noreply@expatshome.cn';
      const fromName = config.mail?.fromName || process.env.MAIL_FROM_NAME || 'ExpatHome';
      await this._getTransporter().sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
      });
      logger.info('EmailService.sendMail 成功', { to, subject });
      return true;
    } catch (error) {
      logger.error('EmailService.sendMail 失败', { to, subject, error: error.message });
      throw error;
    }
  }

  /**
   * 发送验证码/验证链接邮件
   * @param {string} to - 邮箱
   * @param {string} code - 验证码或链接
   * @param {string} type - verification|reset
   */
  async sendVerificationEmail(to, code, type = 'verification') {
    const subject = type === 'verification' ? '邮箱验证 - ExpatHome' : '验证码 - ExpatHome';
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2>ExpatHome 邮箱验证</h2>
        <p>您的验证码是：<strong style="font-size:24px;color:#2F80ED;">${code}</strong></p>
        <p>验证码5分钟内有效，请勿泄露。</p>
        <p style="color:#999;">如非本人操作，请忽略此邮件。</p>
      </div>
    `;
    return this.sendMail(to, subject, html);
  }

  /**
   * 发送重置密码邮件
   * @param {string} to - 邮箱
   * @param {string} resetLink - 重置链接
   */
  async sendResetPasswordEmail(to, resetLink) {
    const subject = '重置密码 - ExpatHome';
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2>ExpatHome 重置密码</h2>
        <p>请点击以下链接重置您的密码：</p>
        <p><a href="${resetLink}" style="color:#2F80ED;">${resetLink}</a></p>
        <p>链接24小时内有效。</p>
        <p style="color:#999;">如非本人操作，请忽略此邮件。</p>
      </div>
    `;
    return this.sendMail(to, subject, html);
  }
}

module.exports = new EmailService();
