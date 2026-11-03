/**
 * 移动端APP生成管理控制器
 * 管理Android/iOS APP配置、构建和发布
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class MobileAppController {
  /**
   * 获取APP配置列表
   */
  async getConfigs(req, res) {
    try {
      const rows = await query('SELECT * FROM mobile_app_config ORDER BY platform ASC, updated_at DESC');
      return success(res, rows);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return success(res, []);
      logger.error('获取APP配置失败', { error: err.message });
      return error(res, '获取APP配置失败', 500);
    }
  }

  /**
   * 获取单个APP配置
   */
  async getConfig(req, res) {
    try {
      const { id } = req.params;
      const [row] = await query('SELECT * FROM mobile_app_config WHERE id = ?', [id]);
      if (!row) return error(res, '配置不存在', 404);
      return success(res, row);
    } catch (err) {
      logger.error('获取APP配置详情失败', { error: err.message });
      return error(res, '获取失败', 500);
    }
  }

  /**
   * 保存APP配置
   */
  async saveConfig(req, res) {
    try {
      const { id, platform, app_name, app_id, package_name, version, description,
        icon_url, splash_url, api_base_url, theme_color, config_json, push_config, signing_config } = req.body;

      if (!platform || !app_name) {
        return error(res, '平台和应用名称不能为空', 400);
      }

      const configStr = typeof config_json === 'object' ? JSON.stringify(config_json) : (config_json || '{}');
      const pushStr = typeof push_config === 'object' ? JSON.stringify(push_config) : (push_config || '{}');
      const signStr = typeof signing_config === 'object' ? JSON.stringify(signing_config) : (signing_config || '{}');

      if (id) {
        await query(
          `UPDATE mobile_app_config SET platform=?, app_name=?, app_id=?, package_name=?, version=?,
           description=?, icon_url=?, splash_url=?, api_base_url=?, theme_color=?,
           config_json=?, push_config=?, signing_config=?, updated_at=NOW() WHERE id=?`,
          [platform, app_name, app_id || '', package_name || '', version || '1.0.0',
           description || '', icon_url || '', splash_url || '', api_base_url || '', theme_color || '#4879FF',
           configStr, pushStr, signStr, id]
        );
        const [updated] = await query('SELECT * FROM mobile_app_config WHERE id = ?', [id]);
        return success(res, updated, '配置更新成功');
      }

      const result = await query(
        `INSERT INTO mobile_app_config (platform, app_name, app_id, package_name, version, description,
         icon_url, splash_url, api_base_url, theme_color, config_json, push_config, signing_config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [platform, app_name, app_id || '', package_name || '', version || '1.0.0',
         description || '', icon_url || '', splash_url || '', api_base_url || '', theme_color || '#4879FF',
         configStr, pushStr, signStr]
      );
      const [created] = await query('SELECT * FROM mobile_app_config WHERE id = ?', [result.insertId]);
      return success(res, created, '配置创建成功');
    } catch (err) {
      logger.error('保存APP配置失败', { error: err.message });
      return error(res, '保存失败: ' + err.message, 500);
    }
  }

  /**
   * 构建APP（模拟触发构建流程）
   */
  async buildApp(req, res) {
    try {
      const { id } = req.params;
      const [config] = await query('SELECT * FROM mobile_app_config WHERE id = ?', [id]);
      if (!config) return error(res, '配置不存在', 404);

      await query('UPDATE mobile_app_config SET status = ?, build_log = ?, updated_at = NOW() WHERE id = ?',
        ['building', JSON.stringify({ started_at: new Date().toISOString(), message: '构建任务已提交，正在排队中...' }), id]);

      setTimeout(async () => {
        try {
          const downloadUrl = config.platform === 'android'
            ? `/downloads/app-${config.app_name}-v${config.version}.apk`
            : `/downloads/app-${config.app_name}-v${config.version}.ipa`;
          await query('UPDATE mobile_app_config SET status = ?, download_url = ?, build_log = ?, updated_at = NOW() WHERE id = ?',
            ['published', downloadUrl,
             JSON.stringify({ started_at: new Date().toISOString(), completed_at: new Date().toISOString(), message: '构建完成' }), id]);
        } catch (e) {
          logger.error('构建回调失败', { error: e.message });
        }
      }, 5000);

      return success(res, { status: 'building' }, '构建任务已提交');
    } catch (err) {
      logger.error('构建APP失败', { error: err.message });
      return error(res, '构建失败', 500);
    }
  }

  /**
   * 删除APP配置
   */
  async deleteConfig(req, res) {
    try {
      const { id } = req.params;
      await query('DELETE FROM mobile_app_config WHERE id = ?', [id]);
      return success(res, null, '删除成功');
    } catch (err) {
      logger.error('删除APP配置失败', { error: err.message });
      return error(res, '删除失败', 500);
    }
  }
}

module.exports = new MobileAppController();
