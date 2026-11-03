/**
 * 微信小程序管理控制器
 * 管理小程序配置、提交审核和发布
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class MiniProgramController {
  /**
   * 获取小程序配置列表
   */
  async getConfigs(req, res) {
    try {
      const rows = await query('SELECT * FROM mini_program_config ORDER BY updated_at DESC');
      return success(res, rows);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return success(res, []);
      logger.error('获取小程序配置失败', { error: err.message });
      return error(res, '获取失败', 500);
    }
  }

  /**
   * 获取单个小程序配置
   */
  async getConfig(req, res) {
    try {
      const { id } = req.params;
      const [row] = await query('SELECT * FROM mini_program_config WHERE id = ?', [id]);
      if (!row) return error(res, '配置不存在', 404);
      return success(res, row);
    } catch (err) {
      logger.error('获取小程序详情失败', { error: err.message });
      return error(res, '获取失败', 500);
    }
  }

  /**
   * 保存小程序配置
   */
  async saveConfig(req, res) {
    try {
      const { id, app_id, app_secret, app_name, original_id, description, version,
        category, server_domain, business_domain, payment_mch_id, payment_key,
        template_id, config_json, pages_config, tabbar_config } = req.body;

      if (!app_name) return error(res, '小程序名称不能为空', 400);

      const configStr = typeof config_json === 'object' ? JSON.stringify(config_json) : (config_json || '{}');
      const pagesStr = typeof pages_config === 'object' ? JSON.stringify(pages_config) : (pages_config || '{}');
      const tabbarStr = typeof tabbar_config === 'object' ? JSON.stringify(tabbar_config) : (tabbar_config || '{}');

      if (id) {
        await query(
          `UPDATE mini_program_config SET app_id=?, app_secret=?, app_name=?, original_id=?,
           description=?, version=?, category=?, server_domain=?, business_domain=?,
           payment_mch_id=?, payment_key=?, template_id=?, config_json=?, pages_config=?, tabbar_config=?,
           updated_at=NOW() WHERE id=?`,
          [app_id || '', app_secret || '', app_name, original_id || '',
           description || '', version || '1.0.0', category || '', server_domain || '', business_domain || '',
           payment_mch_id || '', payment_key || '', template_id || '', configStr, pagesStr, tabbarStr, id]
        );
        const [updated] = await query('SELECT * FROM mini_program_config WHERE id = ?', [id]);
        return success(res, updated, '配置更新成功');
      }

      const result = await query(
        `INSERT INTO mini_program_config (app_id, app_secret, app_name, original_id, description, version,
         category, server_domain, business_domain, payment_mch_id, payment_key, template_id,
         config_json, pages_config, tabbar_config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [app_id || '', app_secret || '', app_name, original_id || '',
         description || '', version || '1.0.0', category || '', server_domain || '', business_domain || '',
         payment_mch_id || '', payment_key || '', template_id || '', configStr, pagesStr, tabbarStr]
      );
      const [created] = await query('SELECT * FROM mini_program_config WHERE id = ?', [result.insertId]);
      return success(res, created, '配置创建成功');
    } catch (err) {
      logger.error('保存小程序配置失败', { error: err.message });
      return error(res, '保存失败: ' + err.message, 500);
    }
  }

  /**
   * 更新小程序状态（提交审核/发布）
   */
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ['draft', 'submitted', 'approved', 'rejected', 'published'];
      if (!validStatuses.includes(status)) return error(res, '无效的状态', 400);

      await query('UPDATE mini_program_config SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
      const [updated] = await query('SELECT * FROM mini_program_config WHERE id = ?', [id]);
      const statusMap = { draft: '草稿', submitted: '已提交审核', approved: '审核通过', rejected: '审核不通过', published: '已发布' };
      return success(res, updated, `状态已更新为: ${statusMap[status] || status}`);
    } catch (err) {
      logger.error('更新小程序状态失败', { error: err.message });
      return error(res, '状态更新失败', 500);
    }
  }

  /**
   * 删除小程序配置
   */
  async deleteConfig(req, res) {
    try {
      const { id } = req.params;
      await query('DELETE FROM mini_program_config WHERE id = ?', [id]);
      return success(res, null, '删除成功');
    } catch (err) {
      logger.error('删除小程序配置失败', { error: err.message });
      return error(res, '删除失败', 500);
    }
  }
}

module.exports = new MiniProgramController();
