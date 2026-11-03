/**
 * 管理后台 - 插件数据看板控制器
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class PluginDashboardController {
  /**
   * 获取插件总览数据
   */
  async getDashboard(req, res) {
    try {
      const [pluginStats] = await query(`
        SELECT 
          COUNT(*) as total_plugins,
          SUM(is_active = 1) as active_plugins,
          SUM(JSON_EXTRACT(settings, '$.monthly_price') > 0) as premium_plugins
        FROM plugins
        WHERE status_label <> 'legacy'
      `).catch(() => [{}]);

      const [subStats] = await query(`
        SELECT 
          COUNT(*) as total_subscriptions,
          SUM(status = 'active') as active_subscriptions
        FROM user_plugin_subscriptions
      `).catch(() => [{}]);

      const [userPluginStats] = await query(`
        SELECT COUNT(DISTINCT user_id) as active_users
        FROM user_plugins
        WHERE status = 'active'
      `).catch(() => [{}]);

      const topPlugins = await query(`
        SELECT p.id, p.plugin_name, p.plugin_slug, p.plugin_icon,
               (SELECT COUNT(*) FROM user_plugins up WHERE up.plugin_id=p.id AND up.status='active') AS install_count,
               (SELECT COALESCE(SUM(up.usage_count),0) FROM user_plugins up WHERE up.plugin_id=p.id) AS total_usage,
               JSON_UNQUOTE(JSON_EXTRACT(p.settings, '$.monthly_price')) AS monthly_price,
               (JSON_EXTRACT(p.settings, '$.monthly_price') > 0) AS is_premium,
               (SELECT COUNT(*) FROM user_plugin_subscriptions ups WHERE ups.plugin_id = p.id AND ups.status = 'active') as active_subs
        FROM plugins p
        WHERE p.is_active = 1
        ORDER BY install_count DESC
        LIMIT 10
      `).catch(() => []);

      const recentUsers = await query(`
        SELECT up.user_id, u.username, u.display_name, u.avatar,
               p.plugin_name, p.plugin_slug, up.activated_at AS installed_at, up.usage_count
        FROM user_plugins up
        LEFT JOIN users u ON up.user_id = u.id
        LEFT JOIN plugins p ON up.plugin_id = p.id
        WHERE up.status = 'active'
        ORDER BY up.activated_at DESC
        LIMIT 20
      `).catch(() => []);

      const paidPluginUsers = await query(`
        SELECT ups.user_id, u.username, u.display_name, 
               p.plugin_name, ups.start_time, ups.end_time, ups.status
        FROM user_plugin_subscriptions ups
        LEFT JOIN users u ON ups.user_id = u.id
        LEFT JOIN plugins p ON ups.plugin_id = p.id
        ORDER BY ups.created_at DESC
        LIMIT 30
      `).catch(() => []);

      return success(res, {
        overview: {
          total_plugins: pluginStats?.total_plugins || 0,
          active_plugins: pluginStats?.active_plugins || 0,
          premium_plugins: pluginStats?.premium_plugins || 0,
          total_installs: topPlugins.reduce((sum, item) => sum + Number(item.install_count || 0), 0),
          total_usage: topPlugins.reduce((sum, item) => sum + Number(item.total_usage || 0), 0),
          total_subscriptions: subStats?.total_subscriptions || 0,
          active_subscriptions: subStats?.active_subscriptions || 0,
          active_users: userPluginStats?.active_users || 0,
        },
        topPlugins,
        recentUsers,
        paidPluginUsers,
      });
    } catch (err) {
      logger.error('获取插件看板数据失败', { error: err.message });
      return error(res, '获取插件看板数据失败', 500);
    }
  }
}

module.exports = new PluginDashboardController();
