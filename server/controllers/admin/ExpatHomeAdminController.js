/**
 * 涉外租赁管理后台控制器
 * 管理expatshome房源、联系人、预约、中介、房东及相关设置
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class ExpatHomeAdminController {
  /**
   * 获取仪表盘统计数据
   * GET /admin/expathome/dashboard
   */
  async getDashboard(req, res) {
    try {
      const [totalResult] = await query(
        'SELECT COUNT(*) as total FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL'
      );
      const [listedResult] = await query(
        'SELECT COUNT(*) as total FROM wechat_robot_expat_parsed_properties WHERE is_listed = 1 AND deleted_at IS NULL'
      );
      const [pendingResult] = await query(
        "SELECT COUNT(*) as total FROM wechat_robot_expat_parsed_properties WHERE (is_listed = 0 OR is_listed IS NULL) AND deleted_at IS NULL"
      );
      const [contactResult] = await query(
        'SELECT COUNT(*) as total FROM contact_agent_records'
      );
      const [appointmentResult] = await query(
        'SELECT COUNT(*) as total FROM appointments'
      );
      const [agentResult] = await query(
        'SELECT COUNT(*) as total FROM agent_profiles'
      );
      const [landlordResult] = await query(
        "SELECT COUNT(*) as total FROM users WHERE role = 'landlord'"
      );
      const [todayResult] = await query(
        'SELECT COUNT(*) as total FROM wechat_robot_expat_parsed_properties WHERE DATE(created_at) = CURDATE() AND deleted_at IS NULL'
      );

      return success(res, {
        total_properties: totalResult.total || 0,
        listed_properties: listedResult.total || 0,
        pending_properties: pendingResult.total || 0,
        total_contacts: contactResult.total || 0,
        total_appointments: appointmentResult.total || 0,
        total_agents: agentResult.total || 0,
        total_landlords: landlordResult.total || 0,
        today_new: todayResult.total || 0,
      });
    } catch (err) {
      logger.error('获取expatshome仪表盘失败', { error: err.message });
      return error(res, '获取仪表盘数据失败', 500);
    }
  }

  /**
   * 分页查询房源列表
   * GET /admin/expathome/properties?page=1&pageSize=20&search=&district=&bedrooms=&price_min=&price_max=
   */
  async getProperties(req, res) {
    try {
      const {
        page = 1,
        pageSize = 20,
        search = '',
        district = '',
        bedrooms = '',
        price_min = '',
        price_max = '',
        is_listed = '',
      } = req.query;

      let sql = 'SELECT * FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL';
      const params = [];

      if (search) {
        sql += ' AND (title LIKE ? OR address LIKE ? OR description LIKE ?)';
        const keyword = `%${search}%`;
        params.push(keyword, keyword, keyword);
      }
      if (district) {
        sql += ' AND district = ?';
        params.push(district);
      }
      if (bedrooms) {
        sql += ' AND bedrooms = ?';
        params.push(parseInt(bedrooms, 10));
      }
      if (price_min) {
        sql += ' AND price >= ?';
        params.push(parseFloat(price_min));
      }
      if (price_max) {
        sql += ' AND price <= ?';
        params.push(parseFloat(price_max));
      }
      if (is_listed !== '') {
        sql += ' AND is_listed = ?';
        params.push(parseInt(is_listed, 10));
      }

      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
      const [countResult] = await query(countSql, params);
      const total = countResult ? countResult.total : 0;

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      const limit = parseInt(pageSize, 10);
      const offset = (parseInt(page, 10) - 1) * limit;
      params.push(limit, offset);

      const data = await query(sql, params);
      return paginated(res, data, total, parseInt(page, 10), limit);
    } catch (err) {
      logger.error('获取expatshome房源列表失败', { error: err.message });
      return error(res, '获取房源列表失败', 500);
    }
  }

  /**
   * 更新单条房源信息
   * PUT /admin/expathome/properties/:id
   */
  async updateProperty(req, res) {
    try {
      const { id } = req.params;
      const {
        title, price, district, bedrooms, bathrooms,
        address, description, is_listed, status,
      } = req.body;

      const [existing] = await query(
        'SELECT * FROM wechat_robot_expat_parsed_properties WHERE id = ? AND deleted_at IS NULL', [id]
      );
      if (!existing) {
        return error(res, '房源不存在', 404);
      }

      const fields = [];
      const values = [];

      if (title !== undefined) { fields.push('title = ?'); values.push(title); }
      if (price !== undefined) { fields.push('price = ?'); values.push(price); }
      if (district !== undefined) { fields.push('district = ?'); values.push(district); }
      if (bedrooms !== undefined) { fields.push('bedrooms = ?'); values.push(bedrooms); }
      if (bathrooms !== undefined) { fields.push('bathrooms = ?'); values.push(bathrooms); }
      if (address !== undefined) { fields.push('address = ?'); values.push(address); }
      if (description !== undefined) { fields.push('description = ?'); values.push(description); }
      if (is_listed !== undefined) { fields.push('is_listed = ?'); values.push(is_listed); }
      if (status !== undefined) { fields.push('status = ?'); values.push(status); }

      if (fields.length === 0) {
        return error(res, '没有需要更新的字段', 400);
      }

      fields.push('updated_at = NOW()');
      values.push(id);

      await query(
        `UPDATE wechat_robot_expat_parsed_properties SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      const [updated] = await query(
        'SELECT * FROM wechat_robot_expat_parsed_properties WHERE id = ?', [id]
      );
      return success(res, updated, '房源更新成功');
    } catch (err) {
      logger.error('更新expatshome房源失败', { error: err.message, id: req.params.id });
      return error(res, '更新房源失败', 500);
    }
  }

  /**
   * 软删除房源
   * DELETE /admin/expathome/properties/:id
   */
  async deleteProperty(req, res) {
    try {
      const { id } = req.params;
      const [existing] = await query(
        'SELECT * FROM wechat_robot_expat_parsed_properties WHERE id = ? AND deleted_at IS NULL', [id]
      );
      if (!existing) {
        return error(res, '房源不存在', 404);
      }

      await query(
        'UPDATE wechat_robot_expat_parsed_properties SET deleted_at = NOW() WHERE id = ?', [id]
      );
      return success(res, null, '房源删除成功');
    } catch (err) {
      logger.error('删除expatshome房源失败', { error: err.message, id: req.params.id });
      return error(res, '删除房源失败', 500);
    }
  }

  /**
   * 查询联系记录
   * GET /admin/expathome/contacts?page=1&pageSize=20
   */
  async getContacts(req, res) {
    try {
      const { page = 1, pageSize = 20 } = req.query;
      const limit = parseInt(pageSize, 10);
      const offset = (parseInt(page, 10) - 1) * limit;

      const [countResult] = await query('SELECT COUNT(*) as total FROM contact_agent_records');
      const total = countResult ? countResult.total : 0;

      const data = await query(
        'SELECT c.*, u.username, u.display_name FROM contact_agent_records c LEFT JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
      return paginated(res, data, total, parseInt(page, 10), limit);
    } catch (err) {
      logger.error('获取联系记录失败', { error: err.message });
      return error(res, '获取联系记录失败', 500);
    }
  }

  /**
   * 查询预约记录
   * GET /admin/expathome/appointments?page=1&pageSize=20
   */
  async getAppointments(req, res) {
    try {
      const { page = 1, pageSize = 20, status = '' } = req.query;
      const limit = parseInt(pageSize, 10);
      const offset = (parseInt(page, 10) - 1) * limit;

      let countSql = 'SELECT COUNT(*) as total FROM appointments';
      let dataSql = 'SELECT a.*, u.username, u.display_name FROM appointments a LEFT JOIN users u ON a.user_id = u.id';
      const params = [];

      if (status) {
        countSql += ' WHERE status = ?';
        dataSql += ' WHERE a.status = ?';
        params.push(status);
      }

      const [countResult] = await query(countSql, params);
      const total = countResult ? countResult.total : 0;

      dataSql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
      const dataParams = [...params, limit, offset];

      const data = await query(dataSql, dataParams);
      return paginated(res, data, total, parseInt(page, 10), limit);
    } catch (err) {
      logger.error('获取预约记录失败', { error: err.message });
      return error(res, '获取预约记录失败', 500);
    }
  }

  /**
   * 查询中介列表
   * GET /admin/expathome/agents?page=1&pageSize=20
   */
  async getAgents(req, res) {
    try {
      const { page = 1, pageSize = 20 } = req.query;
      const limit = parseInt(pageSize, 10);
      const offset = (parseInt(page, 10) - 1) * limit;

      const [countResult] = await query('SELECT COUNT(*) as total FROM agent_profiles');
      const total = countResult ? countResult.total : 0;

      const data = await query(
        'SELECT ap.*, u.username, u.display_name, u.email FROM agent_profiles ap LEFT JOIN users u ON ap.agent_id = u.id ORDER BY ap.created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
      return paginated(res, data, total, parseInt(page, 10), limit);
    } catch (err) {
      logger.error('获取中介列表失败', { error: err.message });
      return error(res, '获取中介列表失败', 500);
    }
  }

  /**
   * 查询房东列表
   * GET /admin/expathome/landlords?page=1&pageSize=20
   */
  async getLandlords(req, res) {
    try {
      const { page = 1, pageSize = 20 } = req.query;
      const limit = parseInt(pageSize, 10);
      const offset = (parseInt(page, 10) - 1) * limit;

      const [countResult] = await query(
        "SELECT COUNT(*) as total FROM users WHERE role = 'landlord'"
      );
      const total = countResult ? countResult.total : 0;

      const data = await query(
        "SELECT id, username, display_name, email, phone, status, created_at, updated_at FROM users WHERE role = 'landlord' ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [limit, offset]
      );
      return paginated(res, data, total, parseInt(page, 10), limit);
    } catch (err) {
      logger.error('获取房东列表失败', { error: err.message });
      return error(res, '获取房东列表失败', 500);
    }
  }

  /**
   * 获取expatshome相关设置
   * GET /admin/expathome/settings
   */
  async getSettings(req, res) {
    try {
      const rows = await query(
        "SELECT * FROM system_settings WHERE setting_group = 'expatshome' ORDER BY sort_order, setting_key"
      );
      const settings = {};
      rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
      });
      return success(res, { settings, raw: rows });
    } catch (err) {
      logger.error('获取expatshome设置失败', { error: err.message });
      return error(res, '获取设置失败', 500);
    }
  }

  /**
   * 保存expatshome相关设置
   * POST /admin/expathome/settings  body: { settings: [{key, value}] }
   */
  async saveSettings(req, res) {
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings) || settings.length === 0) {
        return error(res, '请提供要保存的设置项', 400);
      }

      for (const item of settings) {
        await query(
          "INSERT INTO system_settings (setting_key, setting_value, setting_group, updated_at) VALUES (?, ?, 'expatshome', NOW()) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()",
          [item.key, item.value || '']
        );
      }

      logger.info('expatshome设置已保存', { count: settings.length });
      return success(res, null, '设置保存成功');
    } catch (err) {
      logger.error('保存expatshome设置失败', { error: err.message });
      return error(res, '保存设置失败', 500);
    }
  }

  /**
   * 获取地图设置（含Key组和轮训配置）
   */
  async getMapSettings(req, res) {
    try {
      const rows = await query('SELECT * FROM system_map_settings LIMIT 1');
      const keyGroups = await query(
        'SELECT * FROM system_map_key_groups ORDER BY is_default DESC, sort_order ASC, id ASC'
      );

      const row = rows[0] || {};
      const defaultGroup = keyGroups.find(g => g.is_default) || keyGroups[0] || {};

      return success(res, {
        settings: {
          amap_api_key: defaultGroup.api_key || row.api_key || '',
          amap_js_api_key: defaultGroup.js_api_key || row.js_api_key || '',
          amap_security_js_key: defaultGroup.security_js_key || row.security_js_key || '',
          default_lat: parseFloat(row.default_center_lat) || 31.2304,
          default_lng: parseFloat(row.default_center_lng) || 121.4737,
          default_zoom: parseInt(row.default_zoom) || 12,
          enabled: row.is_enabled === 1,
          rotation_mode: row.rotation_mode || 'default_first',
        },
        key_groups: keyGroups.map(g => ({
          id: g.id,
          group_name: g.group_name,
          api_key: g.api_key,
          js_api_key: g.js_api_key,
          security_js_key: g.security_js_key,
          is_default: g.is_default === 1,
          is_enabled: g.is_enabled === 1,
          daily_limit: g.daily_limit || 0,
          used_count: g.used_count || 0,
          used_date: g.used_date,
          status: g.status || 'normal',
          sort_order: g.sort_order || 0,
          last_check_at: g.last_check_at,
          check_result: g.check_result ? JSON.parse(g.check_result) : null,
          created_at: g.created_at,
        })),
      });
    } catch (err) {
      logger.error('获取地图设置失败', { error: err.message });
      return error(res, '获取地图设置失败', 500);
    }
  }

  /**
   * 保存地图基础设置（中心点、缩放、启用状态、轮训模式）
   */
  async saveMapSettings(req, res) {
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings)) return error(res, '请提供设置项', 400);

      const data = {};
      settings.forEach(item => { data[item.key] = item.value; });

      const rows = await query('SELECT id FROM system_map_settings LIMIT 1');

      const defaultGroup = await query(
        'SELECT * FROM system_map_key_groups WHERE is_default = 1 LIMIT 1'
      );
      const apiKey = defaultGroup[0]?.api_key || data.amap_api_key || '';
      const jsApiKey = defaultGroup[0]?.js_api_key || data.amap_js_api_key || '';
      const securityKey = defaultGroup[0]?.security_js_key || data.amap_security_js_key || '';

      if (rows.length > 0) {
        await query(
          `UPDATE system_map_settings SET 
            api_key = ?, js_api_key = ?, security_js_key = ?,
            default_center_lat = ?, default_center_lng = ?, default_zoom = ?,
            is_enabled = ?, rotation_mode = ?, updated_at = NOW()
          WHERE id = ?`,
          [
            apiKey, jsApiKey, securityKey,
            parseFloat(data.default_lat) || 31.2304, parseFloat(data.default_lng) || 121.4737,
            parseInt(data.default_zoom) || 12, data.enabled === '1' ? 1 : 0,
            data.rotation_mode || 'default_first',
            rows[0].id
          ]
        );
      } else {
        await query(
          `INSERT INTO system_map_settings (provider, api_key, js_api_key, security_js_key, default_center_lat, default_center_lng, default_zoom, is_enabled, rotation_mode, created_at, updated_at)
           VALUES ('amap', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            apiKey, jsApiKey, securityKey,
            parseFloat(data.default_lat) || 31.2304, parseFloat(data.default_lng) || 121.4737,
            parseInt(data.default_zoom) || 12, data.enabled === '1' ? 1 : 0,
            data.rotation_mode || 'default_first',
          ]
        );
      }

      const MapKeyRotationService = require('../../services/MapKeyRotationService');
      MapKeyRotationService.clearCache();

      logger.info('地图设置已保存');
      return success(res, null, '保存成功');
    } catch (err) {
      logger.error('保存地图设置失败', { error: err.message });
      return error(res, '保存设置失败', 500);
    }
  }

  /**
   * 获取所有Key组列表
   */
  async getMapKeyGroups(req, res) {
    try {
      const groups = await query(
        'SELECT * FROM system_map_key_groups ORDER BY is_default DESC, sort_order ASC, id ASC'
      );
      return success(res, {
        groups: groups.map(g => ({
          id: g.id,
          group_name: g.group_name,
          api_key: g.api_key,
          js_api_key: g.js_api_key,
          security_js_key: g.security_js_key,
          is_default: g.is_default === 1,
          is_enabled: g.is_enabled === 1,
          daily_limit: g.daily_limit || 0,
          used_count: g.used_count || 0,
          used_date: g.used_date,
          status: g.status || 'normal',
          sort_order: g.sort_order || 0,
          last_check_at: g.last_check_at,
          check_result: g.check_result ? JSON.parse(g.check_result) : null,
          created_at: g.created_at,
        })),
      });
    } catch (err) {
      logger.error('获取Key组列表失败', { error: err.message });
      return error(res, '获取Key组列表失败', 500);
    }
  }

  /**
   * 添加/更新Key组
   */
  async saveMapKeyGroup(req, res) {
    try {
      const { id, group_name, api_key, js_api_key, security_js_key, is_default, is_enabled, daily_limit, sort_order } = req.body;

      if (!group_name || !group_name.trim()) return error(res, '请填写组名称', 400);
      if (!api_key && !js_api_key) return error(res, '至少填写一个API Key', 400);

      if (is_default) {
        await query('UPDATE system_map_key_groups SET is_default = 0');
      }

      if (id) {
        await query(
          `UPDATE system_map_key_groups SET
            group_name = ?, api_key = ?, js_api_key = ?, security_js_key = ?,
            is_default = ?, is_enabled = ?, daily_limit = ?, sort_order = ?, updated_at = NOW()
          WHERE id = ?`,
          [
            group_name.trim(), api_key || '', js_api_key || '', security_js_key || '',
            is_default ? 1 : 0, is_enabled !== false ? 1 : 0,
            parseInt(daily_limit) || 0, parseInt(sort_order) || 0, id,
          ]
        );
      } else {
        await query(
          `INSERT INTO system_map_key_groups 
            (group_name, api_key, js_api_key, security_js_key, is_default, is_enabled, daily_limit, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            group_name.trim(), api_key || '', js_api_key || '', security_js_key || '',
            is_default ? 1 : 0, is_enabled !== false ? 1 : 0,
            parseInt(daily_limit) || 0, parseInt(sort_order) || 0,
          ]
        );
      }

      if (is_default) {
        await this._syncDefaultKeyToSettings();
      }

      const MapKeyRotationService = require('../../services/MapKeyRotationService');
      MapKeyRotationService.clearCache();

      logger.info('Key组已保存', { id, group_name });
      return success(res, null, id ? '更新成功' : '添加成功');
    } catch (err) {
      logger.error('保存Key组失败', { error: err.message });
      return error(res, '保存Key组失败', 500);
    }
  }

  /**
   * 删除Key组
   */
  async deleteMapKeyGroup(req, res) {
    try {
      const { id } = req.params;
      const [group] = await query('SELECT is_default FROM system_map_key_groups WHERE id = ?', [id]);
      if (!group) return error(res, 'Key组不存在', 404);
      if (group.is_default) return error(res, '不能删除默认组，请先设置其他组为默认', 400);

      await query('DELETE FROM system_map_key_groups WHERE id = ?', [id]);

      const MapKeyRotationService = require('../../services/MapKeyRotationService');
      MapKeyRotationService.clearCache();

      logger.info('Key组已删除', { id });
      return success(res, null, '删除成功');
    } catch (err) {
      logger.error('删除Key组失败', { error: err.message });
      return error(res, '删除Key组失败', 500);
    }
  }

  /**
   * 设置默认Key组
   */
  async setDefaultMapKeyGroup(req, res) {
    try {
      const { id } = req.params;
      const [group] = await query('SELECT id FROM system_map_key_groups WHERE id = ?', [id]);
      if (!group) return error(res, 'Key组不存在', 404);

      await query('UPDATE system_map_key_groups SET is_default = 0');
      await query('UPDATE system_map_key_groups SET is_default = 1 WHERE id = ?', [id]);

      await this._syncDefaultKeyToSettings();

      const MapKeyRotationService = require('../../services/MapKeyRotationService');
      MapKeyRotationService.clearCache();

      logger.info('默认Key组已设置', { id });
      return success(res, null, '设置成功');
    } catch (err) {
      logger.error('设置默认Key组失败', { error: err.message });
      return error(res, '设置默认Key组失败', 500);
    }
  }

  /**
   * 检测Key组额度状态
   */
  async checkMapKeyGroup(req, res) {
    try {
      const { id } = req.params;
      const MapKeyRotationService = require('../../services/MapKeyRotationService');
      const result = await MapKeyRotationService.checkKeyStatus(parseInt(id));
      return success(res, result);
    } catch (err) {
      logger.error('检测Key组失败', { error: err.message });
      return error(res, '检测失败', 500);
    }
  }

  /**
   * 将默认组的Key同步到system_map_settings主表
   */
  async _syncDefaultKeyToSettings() {
    try {
      const [defaultGroup] = await query(
        'SELECT api_key, js_api_key, security_js_key FROM system_map_key_groups WHERE is_default = 1 LIMIT 1'
      );
      if (defaultGroup) {
        await query(
          `UPDATE system_map_settings SET 
            api_key = ?, js_api_key = ?, security_js_key = ?, updated_at = NOW()
          WHERE id = (SELECT id FROM (SELECT id FROM system_map_settings LIMIT 1) t)`,
          [defaultGroup.api_key || '', defaultGroup.js_api_key || '', defaultGroup.security_js_key || '']
        );
      }
    } catch (err) {
      logger.error('同步默认Key到主表失败', { error: err.message });
    }
  }
}

module.exports = new ExpatHomeAdminController();

module.exports = new ExpatHomeAdminController();
