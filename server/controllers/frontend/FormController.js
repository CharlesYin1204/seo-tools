/**
 * 公开表单控制器
 * 查询表单配置、提交表单数据
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error } = require('../../utils/response');

class FormController {
  /**
   * 查询表单配置
   */
  async showForm(req, res) {
    try {
      const { form_key } = req.params;

      if (!form_key) {
        return error(res, '表单标识不能为空', 400);
      }

      const settings = await query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE ? AND setting_key LIKE 'form_%'",
        [`form_${form_key}%`]
      ).catch(() => []);

      if (settings.length === 0) {
        return error(res, '表单不存在', 404);
      }

      const formConfig = {};
      settings.forEach(s => {
        const shortKey = s.setting_key.replace(`form_${form_key}_`, '');
        try {
          formConfig[shortKey] = JSON.parse(s.setting_value);
        } catch {
          formConfig[shortKey] = s.setting_value;
        }
      });

      return success(res, {
        form_key,
        config: formConfig,
      });
    } catch (err) {
      logger.error('获取表单配置失败', { error: err.message, formKey: req.params.form_key });
      return error(res, '获取表单配置失败', 500);
    }
  }

  /**
   * 提交表单数据
   */
  async submitForm(req, res) {
    try {
      const { form_key } = req.params;
      const formData = req.body;

      if (!form_key) {
        return error(res, '表单标识不能为空', 400);
      }

      if (!formData || Object.keys(formData).length === 0) {
        return error(res, '表单数据不能为空', 400);
      }

      const [formExists] = await query(
        "SELECT COUNT(*) as total FROM system_settings WHERE setting_key LIKE ?",
        [`form_${form_key}%`]
      ).catch(() => [{ total: 0 }]);

      if (!formExists || formExists.total === 0) {
        return error(res, '表单不存在', 404);
      }

      const result = await query(
        `INSERT INTO form_submissions (form_key, data, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [
          form_key,
          JSON.stringify(formData),
          req.ip || req.connection?.remoteAddress || '',
          req.headers['user-agent'] || '',
        ]
      );

      return success(res, { submission_id: result.insertId }, '提交成功');
    } catch (err) {
      logger.error('提交表单失败', { error: err.message, formKey: req.params.form_key });
      return error(res, '提交表单失败', 500);
    }
  }
}

module.exports = new FormController();
