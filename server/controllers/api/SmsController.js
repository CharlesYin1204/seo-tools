/**
 * API短信控制器
 * 发送验证码、验证
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');

class SmsController {
  async sendCode(req, res) {
    try {
      const { phone } = req.body;
      if (!phone) {
        return error(res, '请输入手机号', 400);
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await query(
        'INSERT INTO sms_codes (phone, code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
        [phone, code]
      );
      // 实际发送短信由外部服务实现
      return success(res, { expiresIn: 300 }, '验证码已发送');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async verifyCode(req, res) {
    try {
      const { phone, code } = req.body;
      if (!phone || !code) {
        return error(res, '请输入手机号和验证码', 400);
      }
      const [row] = await query(
        'SELECT * FROM sms_codes WHERE phone = ? AND code = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
        [phone, code]
      );
      if (!row) {
        return error(res, '验证码无效或已过期', 400);
      }
      await query('DELETE FROM sms_codes WHERE phone = ?', [phone]);
      return success(res, { verified: true }, '验证成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new SmsController();
