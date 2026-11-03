const { success, error } = require('../../utils/response');
const { query, transaction } = require('../../config/database');
const logger = require('../../utils/logger');

const categoryNames = {
  integration: '平台连接', indexing: '收录推送', content: '内容增长',
  optimization: '站内优化', technical: '技术 SEO', geo: 'GEO 监测', reporting: '报告交付',
};

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function present(row) {
  const settings = parseJson(row.settings, {});
  return {
    id: row.id, name: row.plugin_name, slug: row.plugin_slug,
    description: row.plugin_description, icon: row.plugin_icon,
    version: row.plugin_version, author: row.plugin_author, category: row.plugin_category,
    monthly_price: Number(settings.monthly_price || 0),
    pricing_type: settings.pricing_type || (row.credit_type === 'free' ? 'free' : 'usage'),
    points_per_use: Number(row.credit_amount || 0),
    is_featured: Boolean(settings.featured), is_beta: row.is_beta === 1,
    install_count: Number(row.install_count || 0),
    permissions: settings.permissions || [], compatible_plans: settings.compatible_plans || [],
    data_destination: settings.data_destination || '',
    is_installed: Boolean(row.user_plugin_id) && row.user_status === 'active',
    user_active: row.user_status === 'active', usage_count: Number(row.usage_count || 0),
    last_used_at: row.last_used_at, user_settings: parseJson(row.user_settings, {}),
  };
}

class PluginCenterController {
  async getPlugins(req, res) {
    try {
      const { category = '', keyword = '' } = req.query;
      const params = [req.user.id];
      let sql = `SELECT p.*, up.id AS user_plugin_id, up.status AS user_status,
        up.usage_count, up.last_used_at, up.settings AS user_settings,
        (SELECT COUNT(*) FROM user_plugins installs WHERE installs.plugin_id = p.id AND installs.status = 'active') AS install_count
        FROM plugins p LEFT JOIN user_plugins up ON up.plugin_id = p.id AND up.user_id = ?
        WHERE p.is_installed = 1 AND p.is_active = 1`;
      if (category) { sql += ' AND p.plugin_category = ?'; params.push(category); }
      if (keyword) {
        sql += ' AND (p.plugin_name LIKE ? OR p.plugin_description LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }
      sql += " ORDER BY JSON_EXTRACT(p.settings, '$.featured') DESC, p.id ASC";
      return success(res, (await query(sql, params)).map(present));
    } catch (err) {
      logger.error('获取 SEO 插件列表失败', { error: err.message });
      return error(res, '获取插件列表失败', 500);
    }
  }

  async installPlugin(req, res) {
    const pluginId = Number(req.body.plugin_id);
    if (!Number.isInteger(pluginId) || pluginId <= 0) return error(res, '插件参数无效', 400);
    try {
      const [plugin] = await query('SELECT id, plugin_slug FROM plugins WHERE id = ? AND is_installed = 1 AND is_active = 1', [pluginId]);
      if (!plugin) return error(res, '插件不存在或已下架', 404);
      await query(`INSERT INTO user_plugins (user_id, plugin_id, plugin_slug, status, activated_at)
        VALUES (?, ?, ?, 'active', NOW()) ON DUPLICATE KEY UPDATE status = 'active', activated_at = NOW(), updated_at = NOW()`,
      [req.user.id, plugin.id, plugin.plugin_slug]);
      return success(res, null, '插件安装成功');
    } catch (err) {
      logger.error('安装 SEO 插件失败', { error: err.message });
      return error(res, '安装失败', 500);
    }
  }

  async uninstallPlugin(req, res) {
    const pluginId = Number(req.body.plugin_id);
    if (!Number.isInteger(pluginId) || pluginId <= 0) return error(res, '插件参数无效', 400);
    try {
      await transaction(async connection => {
        const [rows] = await connection.query('SELECT id FROM user_plugins WHERE user_id = ? AND plugin_id = ? FOR UPDATE', [req.user.id, pluginId]);
        if (rows.length) await connection.query("UPDATE user_plugins SET status = 'inactive', updated_at = NOW() WHERE id = ?", [rows[0].id]);
      });
      return success(res, null, '插件已停用，配置和历史用量已保留');
    } catch (err) {
      logger.error('停用 SEO 插件失败', { error: err.message });
      return error(res, '停用失败', 500);
    }
  }

  async updateSettings(req, res) {
    const pluginId = Number(req.params.id);
    if (!Number.isInteger(pluginId) || pluginId <= 0) return error(res, '插件参数无效', 400);
    const allowed = ['site_scope', 'execution_mode', 'notifications'];
    const settings = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) settings[key] = req.body[key];
    }
    if (!['manual', 'review', 'automatic'].includes(settings.execution_mode)) settings.execution_mode = 'review';
    settings.notifications = Boolean(settings.notifications);
    settings.site_scope = String(settings.site_scope || 'all').slice(0, 100);
    try {
      const result = await query(`UPDATE user_plugins SET settings=?,updated_at=NOW()
        WHERE user_id=? AND plugin_id=? AND status='active'`,
      [JSON.stringify(settings), req.user.id, pluginId]);
      if (!result.affectedRows) return error(res, '请先安装并启用该插件', 409);
      return success(res, settings, '插件配置已保存');
    } catch (err) {
      logger.error('保存插件配置失败', { error: err.message });
      return error(res, '保存配置失败', 500);
    }
  }

  async getCategories(req, res) {
    try {
      const rows = await query(`SELECT plugin_category AS slug, COUNT(*) AS count FROM plugins
        WHERE is_installed = 1 AND is_active = 1 GROUP BY plugin_category ORDER BY MIN(id)`);
      return success(res, rows.map(row => ({ ...row, name: categoryNames[row.slug] || row.slug })));
    } catch (err) {
      logger.error('获取插件分类失败', { error: err.message });
      return error(res, '获取插件分类失败', 500);
    }
  }
}

module.exports = new PluginCenterController();
