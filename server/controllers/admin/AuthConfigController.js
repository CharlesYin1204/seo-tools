/**
 * 管理后台认证配置控制器
 * OAuth、彩虹登录等认证设置、安全设置、用户统计
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const nodemailer = require('nodemailer');

const AUTH_KEYS = [
  'allow_register', 'require_phone', 'require_email', 'default_role',
  'allow_guest', 'enable_captcha', 'enable_login_limit',
  'sms_provider', 'sms_aliyun_key', 'sms_aliyun_secret', 'sms_aliyun_sign', 'sms_aliyun_template',
  'sms_smsbao_user', 'sms_smsbao_pass',
  'smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_username', 'smtp_password',
  'from_email', 'from_name',
  'wechat_login', 'wechat_app_id', 'wechat_app_secret', 'wechat_callback_url',
  'google_login', 'google_client_id', 'google_client_secret', 'google_gsc_callback_url',
  'rainbow_login', 'rainbow_app_id', 'rainbow_app_key', 'rainbow_callback_url',
];

class AuthConfigController {
  async getAuthConfig(req, res) {
    try {
      const rows = await query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'auth_%' OR setting_key LIKE 'oauth_%' OR setting_key IN ('email_config','sms_config')"
      );
      const config = {};
      rows.forEach((r) => {
        const rawKey = r.setting_key;
        const val = r.setting_value;

        if (rawKey === 'oauth_config' && typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            if (parsed && typeof parsed === 'object') {
              if (parsed.enabled === '1' || parsed.enabled === true) config.rainbow_login = true;
              if (parsed.app_id) config.rainbow_app_id = parsed.app_id;
              if (parsed.app_key) config.rainbow_app_key = parsed.app_key;
              if (parsed.rainbow_url) config.rainbow_callback_url = parsed.rainbow_url;
              if (parsed.enabled_types && Array.isArray(parsed.enabled_types)) {
                if (parsed.enabled_types.includes('wx')) config.wechat_login = true;
              }
            }
          } catch {}
          return;
        }

        if (rawKey === 'email_config' && typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            if (parsed && typeof parsed === 'object') {
              if (parsed.smtp_host) config.smtp_host = parsed.smtp_host;
              if (parsed.smtp_port) config.smtp_port = parsed.smtp_port;
              if (parsed.smtp_username) config.smtp_username = parsed.smtp_username;
              if (parsed.smtp_password) config.smtp_password = parsed.smtp_password;
              if (parsed.smtp_encryption) config.smtp_encryption = parsed.smtp_encryption;
              if (parsed.from_email) config.from_email = parsed.from_email;
              if (parsed.from_name) config.from_name = parsed.from_name;
              if (parsed.enabled === '1' || parsed.enabled === true) config.email_enabled = true;
              if (parsed.registration_enabled === '1') config.require_email = true;
            }
          } catch {}
          return;
        }

        if (rawKey === 'sms_config' && typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            if (parsed && typeof parsed === 'object') {
              if (parsed.provider) config.sms_provider = parsed.provider;
              if (parsed.smsbao_username) config.sms_smsbao_user = parsed.smsbao_username;
              if (parsed.smsbao_password) config.sms_smsbao_pass = parsed.smsbao_password;
              if (parsed.aliyun_key) config.sms_aliyun_key = parsed.aliyun_key;
              if (parsed.aliyun_secret) config.sms_aliyun_secret = parsed.aliyun_secret;
              if (parsed.aliyun_sign_name) config.sms_aliyun_sign = parsed.aliyun_sign_name;
              if (parsed.aliyun_template_code) config.sms_aliyun_template = parsed.aliyun_template_code;
              if (parsed.enabled === '1' || parsed.enabled === true) config.sms_enabled = true;
            }
          } catch {}
          return;
        }

        const key = rawKey.replace(/^auth_/, '').replace(/^oauth_/, '');
        if (val === 'true' || val === '1') config[key] = true;
        else if (val === 'false' || val === '0') config[key] = false;
        else config[key] = val;
      });
      return success(res, config);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async saveAuthConfig(req, res) {
    try {
      const body = req.body || {};

      for (const key of AUTH_KEYS) {
        if (body[key] !== undefined) {
          const dbKey = 'auth_' + key;
          const val = String(body[key] ?? '');
          await query(
            'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [dbKey, val, val]
          );
        }
      }

      for (const [key, value] of Object.entries(body)) {
        if (key.startsWith('auth_') || key.startsWith('oauth_')) {
          await query(
            'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, String(value), String(value)]
          );
        }
      }

      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getStatistics(req, res) {
    try {
      let totalUsers = 0, todayUsers = 0, activeUsers = 0, loginMethods = 0;

      try {
        const [r1] = await query('SELECT COUNT(*) as c FROM users');
        totalUsers = r1 ? r1.c : 0;
      } catch {}

      try {
        const [r2] = await query("SELECT COUNT(*) as c FROM users WHERE DATE(created_at) = CURDATE()");
        todayUsers = r2 ? r2.c : 0;
      } catch {}

      try {
        const [r3] = await query("SELECT COUNT(*) as c FROM users WHERE last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
        activeUsers = r3 ? r3.c : 0;
      } catch {}

      let methods = 1;
      try {
        const rows = await query("SELECT setting_value FROM system_settings WHERE setting_key IN ('auth_wechat_login','auth_rainbow_login','auth_google_login','auth_sms_aliyun_key','auth_smtp_host')");
        rows.forEach(r => { if (r.setting_value && r.setting_value !== 'false' && r.setting_value !== '0') methods++ });
      } catch {}
      loginMethods = methods;

      return res.json({
        success: true,
        total_users: totalUsers,
        today_users: todayUsers,
        active_users: activeUsers,
        login_methods: loginMethods
      });
    } catch (err) {
      return res.json({ success: true, total_users: 0, today_users: 0, active_users: 0, login_methods: 0 });
    }
  }

  async testEmail(req, res) {
    try {
      const body = req.body || {};
      const savedRows = await query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('auth_smtp_host','auth_smtp_port','auth_smtp_encryption','auth_smtp_username','auth_smtp_password','auth_from_email','auth_from_name')"
      );

      const saved = {};
      savedRows.forEach((row) => {
        saved[row.setting_key.replace(/^auth_/, '')] = row.setting_value;
      });

      const mailConfig = {
        smtp_host: body.smtp_host || saved.smtp_host || '',
        smtp_port: body.smtp_port || saved.smtp_port || '465',
        smtp_encryption: body.smtp_encryption || saved.smtp_encryption || 'ssl',
        smtp_username: body.smtp_username || saved.smtp_username || '',
        smtp_password: body.smtp_password || saved.smtp_password || '',
        from_email: body.from_email || saved.from_email || '',
        from_name: body.from_name || saved.from_name || 'ExpatHome',
      };

      const targetEmail = body.email || body.test_email || mailConfig.from_email || mailConfig.smtp_username;

      if (!targetEmail) {
        return error(res, '缺少测试收件邮箱，请先填写发件人邮箱或测试邮箱', 400);
      }

      const requiredFields = ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'from_email'];
      for (const field of requiredFields) {
        if (!mailConfig[field]) {
          return error(res, '邮件配置不完整，请先填写SMTP配置', 400);
        }
      }

      const port = Number(mailConfig.smtp_port) || 465;
      const secure = mailConfig.smtp_encryption === 'ssl' || port === 465;
      const transporter = nodemailer.createTransport({
        host: mailConfig.smtp_host,
        port,
        secure,
        auth: {
          user: mailConfig.smtp_username,
          pass: mailConfig.smtp_password,
        },
      });

      await transporter.sendMail({
        from: `"${mailConfig.from_name}" <${mailConfig.from_email}>`,
        to: targetEmail,
        subject: 'ExpatHome 邮件配置测试',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
            <h2 style="margin:0 0 16px;color:#2F80ED;">邮件配置测试成功</h2>
            <p>这是一封来自 ExpatHome 管理后台的测试邮件。</p>
            <p>发送时间：${new Date().toLocaleString('zh-CN', { hour12: false })}</p>
            <p style="color:#666;">如果你收到了这封邮件，说明当前 SMTP 配置可以正常使用。</p>
          </div>
        `,
      });

      return success(res, { to: targetEmail }, `测试邮件已发送至 ${targetEmail}`);
    } catch (err) {
      return error(res, `测试邮件发送失败：${err.message}`, 500);
    }
  }
}

module.exports = new AuthConfigController();
