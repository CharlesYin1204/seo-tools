/**
 * 中介插件管理控制器
 * 查看已安装插件、安装、卸载
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error } = require('../../utils/response');

class AgentPluginsController {
  /**
   * 获取用户已安装的插件列表
   */
  async getPlugins(req, res) {
    try {
      const userId = req.user.id;

      const plugins = await query(
        `SELECT up.id as install_id, up.installed_at, up.settings as config, IF(up.is_active = 1, 'active', 'inactive') as install_status,
                p.id as plugin_id, p.plugin_name as name, p.plugin_slug as slug, p.plugin_description as description, p.plugin_icon as icon, p.plugin_version as version, p.plugin_category as category
         FROM wechat_robot_user_plugins up
         JOIN wechat_robot_plugins p ON up.plugin_id = p.id
         WHERE up.user_id = ?
         ORDER BY up.installed_at DESC`,
        [userId]
      ).catch(() => []);

      return success(res, plugins);
    } catch (err) {
      logger.error('获取已安装插件失败', { error: err.message, userId: req.user?.id });
      return error(res, '获取已安装插件失败', 500);
    }
  }

  /**
   * 安装插件
   */
  async installPlugin(req, res) {
    try {
      const userId = req.user.id;
      const { plugin_id } = req.body;

      if (!plugin_id) {
        return error(res, '插件ID不能为空', 400);
      }

      const [plugin] = await query(
        'SELECT id, plugin_name as name FROM wechat_robot_plugins WHERE id = ? AND is_active = 1 LIMIT 1',
        [plugin_id]
      ).catch(() => [null]);

      if (!plugin) {
        return error(res, '插件不存在或已下架', 404);
      }

      const [existing] = await query(
        'SELECT id FROM wechat_robot_user_plugins WHERE user_id = ? AND plugin_id = ? LIMIT 1',
        [userId, plugin_id]
      ).catch(() => [null]);

      if (existing) {
        return error(res, '该插件已安装', 400);
      }

      await query(
        `INSERT INTO wechat_robot_user_plugins (user_id, plugin_id, is_active, installed_at)
         VALUES (?, ?, 1, NOW())`,
        [userId, plugin_id]
      );

      return success(res, null, `插件「${plugin.name}」安装成功`);
    } catch (err) {
      logger.error('安装插件失败', { error: err.message, userId: req.user?.id });
      return error(res, '安装插件失败', 500);
    }
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin(req, res) {
    try {
      const userId = req.user.id;
      const { plugin_id } = req.params;

      if (!plugin_id) {
        return error(res, '插件ID不能为空', 400);
      }

      const [record] = await query(
        'SELECT id FROM wechat_robot_user_plugins WHERE user_id = ? AND plugin_id = ? LIMIT 1',
        [userId, plugin_id]
      ).catch(() => [null]);

      if (!record) {
        return error(res, '未安装该插件', 404);
      }

      await query(
        'DELETE FROM wechat_robot_user_plugins WHERE user_id = ? AND plugin_id = ?',
        [userId, plugin_id]
      );

      return success(res, null, '插件已卸载');
    } catch (err) {
      logger.error('卸载插件失败', { error: err.message, userId: req.user?.id });
      return error(res, '卸载插件失败', 500);
    }
  }
}

module.exports = new AgentPluginsController();
