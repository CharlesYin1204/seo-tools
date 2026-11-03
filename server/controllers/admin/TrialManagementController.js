/**
 * 用户试用管理控制器
 * 管理用户试用期设置
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class TrialManagementController {
  /**
   * 设置用户试用期
   * PUT /admin/users/:id/trial
   */
  async setTrial(req, res) {
    try {
      const { id } = req.params;
      const { trial_days } = req.body;

      if (!trial_days || trial_days < 1) {
        return error(res, '试用天数必须大于0', 400);
      }

      const [user] = await query('SELECT id, username FROM users WHERE id = ?', [id]);
      if (!user) return error(res, '用户不存在', 404);

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + parseInt(trial_days));

      await query(
        `UPDATE users SET is_trial = 1, trial_days = ?, trial_start_date = ?, trial_end_date = ?, updated_at = NOW() WHERE id = ?`,
        [parseInt(trial_days), startDate, endDate, id]
      );

      logger.info('设置用户试用期', { userId: id, trialDays: trial_days });
      return success(res, {
        user_id: id,
        is_trial: true,
        trial_days: parseInt(trial_days),
        trial_start_date: startDate,
        trial_end_date: endDate,
      }, '试用期设置成功');
    } catch (err) {
      logger.error('设置试用期失败', { error: err.message });
      return error(res, '设置失败: ' + err.message, 500);
    }
  }

  /**
   * 取消用户试用期
   * DELETE /admin/users/:id/trial
   */
  async cancelTrial(req, res) {
    try {
      const { id } = req.params;
      await query(
        'UPDATE users SET is_trial = 0, trial_days = 0, trial_start_date = NULL, trial_end_date = NULL, updated_at = NOW() WHERE id = ?',
        [id]
      );
      logger.info('取消用户试用期', { userId: id });
      return success(res, null, '试用期已取消');
    } catch (err) {
      logger.error('取消试用期失败', { error: err.message });
      return error(res, '取消失败', 500);
    }
  }

  /**
   * 获取所有试用用户
   * GET /admin/trial-users
   */
  async getTrialUsers(req, res) {
    try {
      const rows = await query(
        `SELECT id, username, display_name, email, avatar, is_trial, trial_days, trial_start_date, trial_end_date,
         CASE WHEN trial_end_date IS NOT NULL AND trial_end_date < NOW() THEN 'expired' ELSE 'active' END as trial_status
         FROM users WHERE is_trial = 1 ORDER BY trial_end_date ASC`
      );
      return success(res, rows);
    } catch (err) {
      logger.error('获取试用用户失败', { error: err.message });
      return error(res, '获取失败', 500);
    }
  }

  /**
   * 批量设置试用
   * POST /admin/users/batch-trial
   */
  async batchSetTrial(req, res) {
    try {
      const { user_ids, trial_days } = req.body;
      if (!user_ids || !user_ids.length || !trial_days) {
        return error(res, '参数缺失', 400);
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + parseInt(trial_days));

      const placeholders = user_ids.map(() => '?').join(',');
      await query(
        `UPDATE users SET is_trial = 1, trial_days = ?, trial_start_date = ?, trial_end_date = ?, updated_at = NOW() WHERE id IN (${placeholders})`,
        [parseInt(trial_days), startDate, endDate, ...user_ids]
      );

      return success(res, { affected: user_ids.length }, '批量设置成功');
    } catch (err) {
      logger.error('批量设置试用失败', { error: err.message });
      return error(res, '批量设置失败', 500);
    }
  }
}

module.exports = new TrialManagementController();
