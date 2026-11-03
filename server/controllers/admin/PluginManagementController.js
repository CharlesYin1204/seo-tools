const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function present(row) {
  const settings = parseJson(row.settings);
  return {
    ...row, name: row.plugin_name, slug: row.plugin_slug,
    description: row.plugin_description, version: row.plugin_version,
    status: row.is_active ? 'active' : 'inactive',
    monthly_price: Number(settings.monthly_price || 0),
    pricing_type: settings.pricing_type || 'free',
    is_featured: Boolean(settings.featured),
    permissions: settings.permissions || [],
    compatible_plans: settings.compatible_plans || [],
    data_destination: settings.data_destination || '',
    install_count: Number(row.install_count || 0),
  };
}

class PluginManagementController {
  async getPlugins(req, res) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
      const params = [];
      let where = ' WHERE p.status_label <> \'legacy\'';
      if (req.query.status === 'active') where += ' AND p.is_active = 1';
      if (req.query.status === 'inactive') where += ' AND p.is_active = 0';
      if (req.query.category) { where += ' AND p.plugin_category = ?'; params.push(req.query.category); }
      const [count] = await query(`SELECT COUNT(*) AS total FROM plugins p${where}`, params);
      const rows = await query(`SELECT p.*,
        (SELECT COUNT(*) FROM user_plugins up WHERE up.plugin_id = p.id AND up.status = 'active') AS install_count
        FROM plugins p${where} ORDER BY p.id ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]);
      return paginated(res, rows.map(present), count.total, page, pageSize);
    } catch (err) {
      logger.error('获取插件列表失败', { error: err.message });
      return error(res, '获取插件列表失败', 500);
    }
  }

  async savePlugin(req, res) {
    try {
      const id = Number(req.params.id || req.body.id || 0);
      const name = String(req.body.name || '').trim();
      const slug = String(req.body.slug || '').trim().toLowerCase();
      if (!name || !slug) return error(res, '插件名称和标识不能为空', 400);
      if (!/^[a-z0-9-]+$/.test(slug)) return error(res, '插件标识只能包含小写字母、数字和连字符', 400);
      const settings = JSON.stringify({
        monthly_price: Number(req.body.monthly_price || 0),
        pricing_type: req.body.pricing_type || (Number(req.body.monthly_price) > 0 ? 'subscription' : 'free'),
        featured: Boolean(req.body.is_featured),
        permissions: Array.isArray(req.body.permissions) ? req.body.permissions.filter(Boolean) : [],
        compatible_plans: Array.isArray(req.body.compatible_plans) ? req.body.compatible_plans : [],
        data_destination: String(req.body.data_destination || ''),
      });
      const values = [
        name, slug, req.body.description || '', req.body.version || '1.0.0',
        req.body.icon || 'fas fa-puzzle-piece', req.body.category || 'integration',
        req.body.credit_type || 'free', Number(req.body.credit_amount || 0),
        req.body.status === 'active' ? 1 : 0, req.body.is_beta ? 1 : 0, settings,
      ];
      if (id) {
        const [existing] = await query('SELECT id FROM plugins WHERE id = ?', [id]);
        if (!existing) return error(res, '插件不存在', 404);
        await query(`UPDATE plugins SET plugin_name=?,plugin_slug=?,plugin_description=?,plugin_version=?,
          plugin_icon=?,plugin_category=?,credit_type=?,credit_amount=?,is_active=?,is_beta=?,
          settings=?,updated_at=NOW() WHERE id=?`, [...values, id]);
        const [updated] = await query('SELECT * FROM plugins WHERE id = ?', [id]);
        return success(res, present(updated), '插件更新成功');
      }
      const result = await query(`INSERT INTO plugins
        (plugin_name,plugin_slug,plugin_description,plugin_version,plugin_author,plugin_path,plugin_icon,
        plugin_category,target_users,credit_type,credit_amount,is_installed,is_active,is_beta,status_label,install_time,settings)
        VALUES (?,?,?,?,'SEO AI 官方',?,?,?,JSON_ARRAY('admin','user'),?,?,1,?,?,'stable',NOW(),?)`,
      [values[0], values[1], values[2], values[3], `official/${slug}`, ...values.slice(4)]);
      const [created] = await query('SELECT * FROM plugins WHERE id = ?', [result.insertId]);
      return success(res, present(created), '插件创建成功');
    } catch (err) {
      logger.error('保存插件失败', { error: err.message });
      return error(res, err.code === 'ER_DUP_ENTRY' ? '插件标识已存在' : '保存插件失败', err.code === 'ER_DUP_ENTRY' ? 409 : 500);
    }
  }

  async deletePlugin(req, res) {
    try {
      const result = await query("UPDATE plugins SET is_active=0,status_label='retired',updated_at=NOW() WHERE id=?", [req.params.id]);
      if (!result.affectedRows) return error(res, '插件不存在', 404);
      return success(res, null, '插件已下架，用户配置和审计记录已保留');
    } catch (err) {
      logger.error('下架插件失败', { error: err.message });
      return error(res, '下架插件失败', 500);
    }
  }

  async getCategories(req, res) {
    const names = { integration:'平台连接', indexing:'收录推送', content:'内容增长', optimization:'站内优化', technical:'技术 SEO', geo:'GEO 监测', reporting:'报告交付' };
    try {
      const rows = await query("SELECT plugin_category AS slug, COUNT(*) AS count FROM plugins WHERE status_label <> 'legacy' GROUP BY plugin_category ORDER BY MIN(id)");
      return success(res, rows.map(row => ({ ...row, name: names[row.slug] || row.slug })));
    } catch (err) { return error(res, '获取插件分类失败', 500); }
  }
}

module.exports = new PluginManagementController();
