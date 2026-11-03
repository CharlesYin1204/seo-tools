/**
 * 管理后台 - 功能模块管理控制器
 * 管理"快速找房"、"房源库管理"等功能模块及其套餐价格
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class FeatureModuleController {
  /**
   * 获取所有功能模块（含套餐价格）
   */
  async getModules(req, res) {
    try {
      const modules = await query('SELECT * FROM feature_modules ORDER BY sort_order ASC, id ASC');
      for (const mod of modules) {
        mod.plans = await query(
          'SELECT * FROM feature_module_plans WHERE module_id = ? ORDER BY sort_order ASC, duration_months ASC',
          [mod.id]
        );
      }

      const [trialSetting] = await query(
        "SELECT setting_value FROM system_settings WHERE setting_key = 'feature_trial_days'"
      ).catch(() => [null]);
      const parsed = trialSetting ? parseInt(trialSetting.setting_value, 10) : NaN;
      const trialDays = Number.isNaN(parsed) ? 7 : parsed;

      return success(res, { modules, trialDays });
    } catch (err) {
      logger.error('获取功能模块列表失败', { error: err.message });
      return error(res, '获取功能模块失败', 500);
    }
  }

  /**
   * 保存功能模块基本信息
   */
  async saveModule(req, res) {
    try {
      const { id, name, slug, description, icon, is_active } = req.body;
      if (!name || !slug) {
        return error(res, '模块名称和标识不能为空', 400);
      }

      if (id) {
        await query(
          'UPDATE feature_modules SET name=?, slug=?, description=?, icon=?, is_active=?, updated_at=NOW() WHERE id=?',
          [name, slug, description || '', icon || 'fas fa-cube', is_active !== false ? 1 : 0, id]
        );
      } else {
        await query(
          'INSERT INTO feature_modules (name, slug, description, icon, is_active) VALUES (?,?,?,?,?)',
          [name, slug, description || '', icon || 'fas fa-cube', is_active !== false ? 1 : 0]
        );
      }

      return success(res, null, id ? '更新成功' : '创建成功');
    } catch (err) {
      logger.error('保存功能模块失败', { error: err.message });
      return error(res, '保存功能模块失败', 500);
    }
  }

  /**
   * 删除功能模块
   */
  async deleteModule(req, res) {
    try {
      const { id } = req.params;
      await query('DELETE FROM feature_module_plans WHERE module_id = ?', [id]);
      await query('DELETE FROM feature_modules WHERE id = ?', [id]);
      return success(res, null, '删除成功');
    } catch (err) {
      logger.error('删除功能模块失败', { error: err.message });
      return error(res, '删除功能模块失败', 500);
    }
  }

  /**
   * 保存套餐价格（批量保存某模块的所有套餐）
   */
  async savePlans(req, res) {
    try {
      const { module_id, plans } = req.body;
      if (!module_id || !Array.isArray(plans)) {
        return error(res, '参数错误', 400);
      }

      const existingIds = plans.filter(p => p.id).map(p => p.id);
      if (existingIds.length > 0) {
        const placeholders = existingIds.map(() => '?').join(',');
        await query(
          `DELETE FROM feature_module_plans WHERE module_id = ? AND id NOT IN (${placeholders})`,
          [module_id, ...existingIds]
        );
      } else {
        await query('DELETE FROM feature_module_plans WHERE module_id = ?', [module_id]);
      }

      for (let i = 0; i < plans.length; i++) {
        const p = plans[i];
        if (p.id) {
          await query(
            'UPDATE feature_module_plans SET duration_months=?, price=?, original_price=?, label=?, is_active=?, sort_order=?, updated_at=NOW() WHERE id=? AND module_id=?',
            [p.duration_months || 1, p.price || 0, p.original_price || null, p.label || '', p.is_active !== false ? 1 : 0, i, p.id, module_id]
          );
        } else {
          await query(
            'INSERT INTO feature_module_plans (module_id, duration_months, price, original_price, label, is_active, sort_order) VALUES (?,?,?,?,?,?,?)',
            [module_id, p.duration_months || 1, p.price || 0, p.original_price || null, p.label || '', p.is_active !== false ? 1 : 0, i]
          );
        }
      }

      return success(res, null, '套餐价格保存成功');
    } catch (err) {
      logger.error('保存套餐价格失败', { error: err.message });
      return error(res, '保存套餐价格失败', 500);
    }
  }

  /**
   * 保存试用天数设置
   * 同步更新 system_settings、users 表试用字段、trial 类型的功能订阅
   */
  async saveTrialDays(req, res) {
    try {
      const { trial_days } = req.body;
      const days = Number.isFinite(parseInt(trial_days, 10)) ? parseInt(trial_days, 10) : 7;
      await query(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('feature_trial_days', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
        [String(days), String(days)]
      );

      if (days === 0) {
        await query(
          "UPDATE users SET is_trial = 0, trial_days = 0, trial_start_date = NULL, trial_end_date = NULL, updated_at = NOW() WHERE is_trial = 1"
        );
        await query(
          "UPDATE user_feature_subscriptions SET status = 'expired', end_date = NOW() WHERE source = 'trial' AND status = 'active'"
        );
        logger.info('试用天数设为0，已清除所有用户试用状态及试用订阅');
      } else {
        await query(
          "UPDATE users SET trial_days = ?, updated_at = NOW() WHERE is_trial = 1",
          [days]
        );
        logger.info('试用天数已更新为 ' + days + '，已同步到所有试用中用户');
      }

      return success(res, { trial_days: days }, '试用天数设置成功');
    } catch (err) {
      logger.error('保存试用天数失败', { error: err.message });
      return error(res, '保存试用天数失败', 500);
    }
  }

  /**
   * 获取用户功能订阅列表
   */
  async getUserSubscriptions(req, res) {
    try {
      const { page = 1, pageSize = 20, user_id, module_id, status } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const params = [];
      let where = '1=1';

      if (user_id) { where += ' AND ufs.user_id = ?'; params.push(user_id); }
      if (module_id) { where += ' AND ufs.module_id = ?'; params.push(module_id); }
      if (status) { where += ' AND ufs.status = ?'; params.push(status); }

      const [countRow] = await query(
        `SELECT COUNT(*) as total FROM user_feature_subscriptions ufs WHERE ${where}`, params
      );
      const total = countRow?.total || 0;

      const rows = await query(
        `SELECT ufs.*, fm.name as module_name, fm.slug as module_slug, 
                u.username, u.display_name, u.email
         FROM user_feature_subscriptions ufs
         LEFT JOIN feature_modules fm ON ufs.module_id = fm.id
         LEFT JOIN users u ON ufs.user_id = u.id
         WHERE ${where}
         ORDER BY ufs.created_at DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(pageSize, 10), offset]
      );

      return success(res, { list: rows, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
    } catch (err) {
      logger.error('获取用户功能订阅列表失败', { error: err.message });
      return error(res, '获取数据失败', 500);
    }
  }
}

module.exports = new FeatureModuleController();
