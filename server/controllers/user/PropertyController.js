/**
 * 用户端房源管理控制器
 * 与PHP版my-properties功能对齐，直接操作properties表
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');
const crypto = require('crypto');
const fsSync = require('fs');
const path = require('path');

function generateContentHash(content) {
  if (!content) return null;
  const normalized = String(content)
    .replace(/\\n/g, '\n').replace(/\s+/g, '')
    .replace(/[，。！？、；：""''（）【】《》\-\—\~\·]/g, '')
    .toLowerCase().trim();
  if (!normalized || normalized.length < 5) return null;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

const TABLE = 'properties';
const PARSED_TABLE = 'wechat_robot_expat_parsed_properties';

class PropertyController {

  /**
   * 获取用户房源列表（支持筛选、搜索、分页）
   */
  async getUserProperties(req, res) {
    try {
      const userId = req.user.id;
      const {
        page = 1, pageSize = 20,
        status = '', district = '', keyword = '',
        location_filter = '',
        priceMin, priceMax, bedrooms,
        outdoor_features, has_elevator, has_parking, is_duplex
      } = req.query;

      const limit = parseInt(pageSize, 10);
      const offset = (parseInt(page, 10) - 1) * limit;
      let where = `user_id = ?`;
      const params = [userId];

      if (status) {
        where += ` AND status = ?`;
        params.push(status);
      }
      if (district) {
        where += ` AND district = ?`;
        params.push(district);
      }
      if (keyword) {
        where += ` AND (title LIKE ? OR description LIKE ? OR district LIKE ? OR address LIKE ?)`;
        const kw = `%${keyword}%`;
        params.push(kw, kw, kw, kw);
      }
      if (priceMin && !isNaN(priceMin)) {
        where += ` AND price >= ?`;
        params.push(parseFloat(priceMin));
      }
      if (priceMax && !isNaN(priceMax)) {
        where += ` AND price <= ?`;
        params.push(parseFloat(priceMax));
      }
      if (bedrooms) {
        const bedroomArr = String(bedrooms).split(',').map(b => parseInt(b, 10)).filter(b => !isNaN(b));
        if (bedroomArr.length === 1) {
          where += ` AND bedrooms = ?`;
          params.push(bedroomArr[0]);
        } else if (bedroomArr.length > 1) {
          where += ` AND bedrooms IN (${bedroomArr.map(() => '?').join(',')})`;
          params.push(...bedroomArr);
        }
      }
      if (location_filter === 'located') {
        where += ` AND latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0 AND longitude != 0`;
      } else if (location_filter === 'pending') {
        where += ` AND (latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0)`;
      }
      if (has_elevator === 'true') {
        where += ` AND JSON_UNQUOTE(JSON_EXTRACT(features, '$.has_elevator')) = '1'`;
      }
      if (has_parking === 'true') {
        where += ` AND JSON_UNQUOTE(JSON_EXTRACT(features, '$.has_parking')) = '1'`;
      }
      if (is_duplex === 'true') {
        where += ` AND JSON_UNQUOTE(JSON_EXTRACT(features, '$.is_duplex')) = '1'`;
      }
      if (outdoor_features) {
        const outdoorArr = String(outdoor_features).split(',').filter(Boolean);
        for (const feat of outdoorArr) {
          where += ` AND JSON_UNQUOTE(JSON_EXTRACT(features, '$.outdoor_features')) LIKE ?`;
          params.push(`%${feat}%`);
        }
      }

      const [countRow] = await query(`SELECT COUNT(*) as total FROM ${TABLE} WHERE ${where}`, params);
      const total = countRow ? countRow.total : 0;

      // 兜底修复历史数据：列表里显示已发布的房源，必须同步生成公开详情页。
      await this._ensurePublishedPropertiesPublic(where, params);

      const dataParams = [...params, limit, offset];
      const data = await query(
        `SELECT p.*,
                pp.id as public_property_id,
                pp.property_code as public_property_code,
                pp.is_listed as public_is_listed,
                pp.status as public_status,
                pp.deleted_at as public_deleted_at
         FROM ${TABLE} p
         LEFT JOIN ${PARSED_TABLE} pp
           ON pp.property_id = p.id AND pp.source = 'manual_upload'
         WHERE ${where.replace(/\b(user_id|status|district|title|description|address|price|bedrooms|latitude|longitude|features)\b/g, 'p.$1')}
         ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
        dataParams
      );

      return paginated(res, data || [], total, parseInt(page, 10), limit);
    } catch (err) {
      console.error('[PropertyController.getUserProperties]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 获取统计数据
   */
  async getPropertyStats(req, res) {
    try {
      const userId = req.user.id;
      const rows = await query(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
           SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
           SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_count,
           SUM(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0 AND longitude != 0 THEN 1 ELSE 0 END) as located,
           SUM(CASE WHEN latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0 THEN 1 ELSE 0 END) as pending_location
         FROM ${TABLE} WHERE user_id = ?`,
        [userId]
      );
      const stats = rows[0] || {};
      return success(res, {
        total: stats.total || 0,
        published: stats.published || 0,
        draft: stats.draft || 0,
        today_count: stats.today_count || 0,
        located: stats.located || 0,
        pending_location: stats.pending_location || 0,
      });
    } catch (err) {
      console.error('[PropertyController.getPropertyStats]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 获取单条房源详情
   */
  async getProperty(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [property] = await query(`SELECT * FROM ${TABLE} WHERE id = ? AND user_id = ?`, [id, userId]);
      if (!property) return error(res, '房源不存在', 404);
      this._sanitizePropertyMedia(property);
      return success(res, property);
    } catch (err) {
      console.error('[PropertyController.getProperty]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 创建房源
   */
  async createProperty(req, res) {
    try {
      const userId = req.user.id;
      const data = this._extractFields(req.body);
      data.user_id = userId;

      if (!data.title && !data.description) {
        return error(res, '标题或描述不能为空', 400);
      }
      if (!data.title) {
        data.title = (data.description || '').substring(0, 100);
      }
      if (!data.city) data.city = '上海';
      if (!data.property_type) data.property_type = 'apartment';
      if (data.price === undefined || data.price === null || data.price === '') data.price = 0;
      if (!data.address) data.address = data.street || data.district || '';
      if (!data.district) data.district = data.address || '';
      if (data.latitude === '' || data.latitude === undefined) data.latitude = null;
      if (data.longitude === '' || data.longitude === undefined) data.longitude = null;
      if (data.area === '' || data.area === undefined) data.area = null;
      if (data.deposit === '' || data.deposit === undefined) data.deposit = null;

      const fields = Object.keys(data);
      const placeholders = fields.map(() => '?').join(',');
      const values = fields.map(k => data[k]);

      const result = await query(
        `INSERT INTO ${TABLE} (${fields.join(',')}) VALUES (${placeholders})`,
        values
      );

      const [property] = await query(`SELECT * FROM ${TABLE} WHERE id = ?`, [result.insertId]);

      if (property && property.status === 'published') {
        await this._syncToParsedProperties(property);
      }

      return success(res, property, '创建成功', 201);
    } catch (err) {
      console.error('[PropertyController.createProperty]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 更新房源
   */
  async updateProperty(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const [property] = await query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
      if (!property) return error(res, '房源不存在', 404);
      if (property.user_id !== userId) return error(res, '无权限修改', 403);

      const updates = this._extractFields(req.body);
      if (Object.keys(updates).length === 0) {
        return error(res, '没有要更新的字段', 400);
      }
      if (updates.latitude === '' || updates.latitude === undefined) delete updates.latitude;
      if (updates.longitude === '' || updates.longitude === undefined) delete updates.longitude;
      if (updates.latitude !== undefined && updates.latitude !== null && isNaN(Number(updates.latitude))) delete updates.latitude;
      if (updates.longitude !== undefined && updates.longitude !== null && isNaN(Number(updates.longitude))) delete updates.longitude;
      if (updates.area === '') updates.area = null;
      if (updates.deposit === '') updates.deposit = null;
      updates.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updates);
      values.push(id);

      await query(`UPDATE ${TABLE} SET ${setClauses} WHERE id = ?`, values);
      const [updated] = await query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);

      if (updated) {
        if (updated.status === 'published') {
          await this._syncToParsedProperties(updated);
        } else {
          await this._unsyncFromParsedProperties(updated.id);
        }
      }

      return success(res, updated, '更新成功');
    } catch (err) {
      console.error('[PropertyController.updateProperty]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 删除房源
   */
  async deleteProperty(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const [property] = await query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
      if (!property) return error(res, '房源不存在', 404);
      if (property.user_id !== userId) return error(res, '无权限删除', 403);

      await this._unsyncFromParsedProperties(id);
      await query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
      return success(res, null, '删除成功');
    } catch (err) {
      console.error('[PropertyController.deleteProperty]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 发布草稿房源
   */
  async publishProperty(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const [property] = await query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
      if (!property) return error(res, '房源不存在', 404);
      if (property.user_id !== userId) return error(res, '无权限操作', 403);

      await query(
        `UPDATE ${TABLE} SET status = 'published', updated_at = NOW() WHERE id = ?`,
        [id]
      );

      const [updated] = await query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
      if (updated) {
        await this._syncToParsedProperties(updated);
      }

      return success(res, null, '发布成功');
    } catch (err) {
      console.error('[PropertyController.publishProperty]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 上传图片
   */
  async uploadImages(req, res) {
    try {
      const { propertyId } = req.body;
      const urls = Array.isArray(req.body.urls) ? req.body.urls : req.body.urls ? [req.body.urls] : [];
      if (!propertyId || urls.length === 0) {
        return error(res, '缺少房源ID或图片URL', 400);
      }
      const [property] = await query(`SELECT * FROM ${TABLE} WHERE id = ?`, [propertyId]);
      if (!property) return error(res, '房源不存在', 404);
      if (property.user_id !== req.user.id) return error(res, '无权限', 403);

      let images = [];
      try {
        images = typeof property.images === 'string' ? JSON.parse(property.images || '[]') : property.images || [];
      } catch (_) {}
      images = [...images, ...urls];

      await query(
        `UPDATE ${TABLE} SET images = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(images), propertyId]
      );
      return success(res, { images }, '上传成功');
    } catch (err) {
      console.error('[PropertyController.uploadImages]', err);
      return error(res, err.message, 500);
    }
  }

  _normalizeMediaUrl(item) {
    if (!item) return '';
    if (typeof item === 'string') return item;
    return item.url || item.thumb || item.preview || '';
  }

  _isAvailableMediaUrl(url) {
    if (!url) return false;
    const value = String(url).trim();
    if (!value) return false;
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//') || value.startsWith('data:') || value.startsWith('blob:')) return true;
    const normalized = value.startsWith('/') ? value : '/' + value;
    if (!normalized.startsWith('/uploads/')) return true;
    let relPath = normalized;
    while (relPath.startsWith('/')) relPath = relPath.slice(1);
    const filePath = path.join(process.cwd(), 'public', relPath);
    return fsSync.existsSync(filePath);
  }

  _filterAvailableMediaUrls(items) {
    const list = Array.isArray(items) ? items : [];
    return list
      .map(item => this._normalizeMediaUrl(item))
      .filter(url => this._isAvailableMediaUrl(url));
  }

  _sanitizePropertyMedia(property) {
    if (!property) return property;
    for (const field of ['images', 'videos']) {
      let value = property[field];
      if (typeof value === 'string') {
        try { value = JSON.parse(value || '[]'); } catch { value = []; }
      }
      property[field] = this._filterAvailableMediaUrls(value);
    }
    return property;
  }

  /**
   * 生成房源编号，格式: EXP{YYYYMMDD}-{5位序号}
   * 序号全局递增（取整张表最大序号+1），日期为当天
   */
  async _generatePropertyCode() {
    const now = new Date();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');

    const [maxRow] = await query(
      `SELECT property_code FROM ${PARSED_TABLE} WHERE property_code IS NOT NULL AND property_code LIKE 'EXP%' ORDER BY CAST(SUBSTRING_INDEX(property_code, '-', -1) AS UNSIGNED) DESC LIMIT 1`
    );

    let seq = 1;
    if (maxRow && maxRow.property_code) {
      const match = maxRow.property_code.match(/-(\d+)$/);
      if (match) seq = parseInt(match[1], 10) + 1;
    }

    return `EXP${dateStr}-${String(seq).padStart(5, '0')}`;
  }

  /**
   * 确保历史已发布房源都有可访问的公开详情页，避免用户中心误跳编辑页。
   */
  async _ensurePublishedPropertiesPublic(where, params) {
    try {
      const syncWhere = where.replace(/\b(user_id|status|district|title|description|address|price|bedrooms|latitude|longitude|features)\b/g, 'p.$1');
      const rows = await query(
        `SELECT p.*
         FROM ${TABLE} p
         LEFT JOIN ${PARSED_TABLE} pp
           ON pp.property_id = p.id AND pp.source = 'manual_upload'
         WHERE ${syncWhere}
           AND p.status = 'published'
           AND (pp.id IS NULL OR pp.status <> 'published' OR pp.is_listed <> 1 OR pp.deleted_at IS NOT NULL)
         ORDER BY p.updated_at DESC, p.created_at DESC
         LIMIT 20`,
        params
      );

      for (const row of rows || []) {
        await this._syncToParsedProperties(row);
      }
    } catch (err) {
      console.error('[PropertyController._ensurePublishedPropertiesPublic]', err);
    }
  }

  /**
   * 将已发布的properties记录同步到wechat_robot_expat_parsed_properties，使前端可见
   * 使用 source='manual_upload' 和 property_id 关联，避免与微信机器人数据冲突
   */
  async _syncToParsedProperties(prop) {
    try {
      let mediaUrls = [];
      if (prop.images) {
        let imgs = typeof prop.images === 'string' ? JSON.parse(prop.images || '[]') : prop.images || [];
        mediaUrls = imgs.map(u => typeof u === 'string' ? u : (u.url || u.thumb || '')).filter(Boolean);
      }
      if (prop.videos) {
        let vids = typeof prop.videos === 'string' ? JSON.parse(prop.videos || '[]') : prop.videos || [];
        const vidUrls = vids.map(u => typeof u === 'string' ? u : (u.url || '')).filter(Boolean);
        mediaUrls = [...mediaUrls, ...vidUrls];
      }

      let features = {};
      if (prop.features) {
        features = typeof prop.features === 'string' ? JSON.parse(prop.features || '{}') : prop.features || {};
      }

      const syncData = {
        user_id: prop.user_id,
        property_id: prop.id,
        title: prop.title || '',
        description: prop.description || '',
        community: features.community || prop.address || '',
        price: prop.price ? `${prop.price}` : '0',
        price_value: prop.price || 0,
        bedrooms: prop.bedrooms || 0,
        livingrooms: prop.livingrooms || 1,
        bathrooms: prop.bathrooms || 0,
        district: prop.district || '',
        street: prop.address || '',
        floor_info: prop.floor || '',
        area_sqm: prop.area || null,
        latitude: prop.latitude || null,
        longitude: prop.longitude || null,
        metro_lines: prop.subway_line || prop.metro_line || '',
        metro_stations: prop.subway_station || prop.metro_station || '',
        has_elevator: features.elevator ? 1 : 0,
        has_parking: features.parking ? 1 : 0,
        has_commission: features.commission ? 1 : 0,
        publisher_name: features.publisher_name || '',
        contact_info: features.contact_info || '',
        is_duplex: features.is_duplex ? 1 : 0,
        outdoor_features: features.outdoor_features || '',
        media_urls: JSON.stringify(mediaUrls),
        source: 'manual_upload',
        status: 'published',
        is_listed: 1,
        moment_publish_time: prop.created_at || new Date(),
        deleted_at: null,
      };

      // 为手动上传的房源生成 content_hash
      const hashSource = prop.description || prop.title || '';
      if (hashSource) {
        const hash = generateContentHash(hashSource);
        if (hash) syncData.content_hash = hash;
      }

      const [existing] = await query(
        `SELECT id, property_code FROM ${PARSED_TABLE} WHERE property_id = ? AND source = 'manual_upload'`,
        [prop.id]
      );

      if (existing) {
        if (!existing.property_code) {
          syncData.property_code = await this._generatePropertyCode();
        }
        const setClauses = Object.keys(syncData).map(k => `${k} = ?`).join(', ');
        const vals = [...Object.values(syncData), existing.id];
        await query(`UPDATE ${PARSED_TABLE} SET ${setClauses} WHERE id = ?`, vals);
        console.log(`[Sync] Updated parsed property id=${existing.id} for properties.id=${prop.id}`);
      } else {
        syncData.property_code = await this._generatePropertyCode();
        const fields = Object.keys(syncData);
        const placeholders = fields.map(() => '?').join(',');
        const vals = Object.values(syncData);
        await query(`INSERT INTO ${PARSED_TABLE} (${fields.join(',')}) VALUES (${placeholders})`, vals);
        console.log(`[Sync] Inserted parsed property for properties.id=${prop.id}, code=${syncData.property_code}`);
      }
    } catch (err) {
      console.error('[PropertyController._syncToParsedProperties]', err);
    }
  }

  /**
   * 房源取消发布/删除时，从前端列表中移除（软删除）
   */
  async _unsyncFromParsedProperties(propertyId) {
    try {
      await query(
        `UPDATE ${PARSED_TABLE} SET is_listed = 0, deleted_at = NOW() WHERE property_id = ? AND source = 'manual_upload'`,
        [propertyId]
      );
      console.log(`[Sync] Unsynced parsed property for properties.id=${propertyId}`);
    } catch (err) {
      console.error('[PropertyController._unsyncFromParsedProperties]', err);
    }
  }

  /**
   * 从请求体中提取有效字段
   */
  // ============ 代理人管理（仅当前用户可见） ============

  async getAgents(req, res) {
    try {
      const userId = req.user.id;
      const agents = await query(
        `SELECT a.*, (SELECT COUNT(*) FROM property_agent_owners WHERE agent_id = a.id AND is_active = 1) as owner_count
         FROM property_agents a WHERE a.user_id = ? AND a.is_active = 1 ORDER BY a.created_at DESC`, [userId]
      );
      return success(res, agents || []);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async createAgent(req, res) {
    try {
      const userId = req.user.id;
      const { agent_name, agent_phone, agent_wechat, notes } = req.body;
      if (!agent_name) return error(res, '代理人名称不能为空', 400);
      const result = await query(
        'INSERT INTO property_agents (user_id, agent_name, agent_phone, agent_wechat, notes) VALUES (?, ?, ?, ?, ?)',
        [userId, agent_name, agent_phone || null, agent_wechat || null, notes || null]
      );
      const [agent] = await query('SELECT * FROM property_agents WHERE id = ?', [result.insertId]);
      return success(res, agent, '创建成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async updateAgent(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { agent_name, agent_phone, agent_wechat, notes } = req.body;
      const [existing] = await query('SELECT * FROM property_agents WHERE id = ? AND user_id = ?', [id, userId]);
      if (!existing) return error(res, '代理人不存在', 404);
      await query(
        'UPDATE property_agents SET agent_name = ?, agent_phone = ?, agent_wechat = ?, notes = ? WHERE id = ? AND user_id = ?',
        [agent_name || existing.agent_name, agent_phone ?? existing.agent_phone, agent_wechat ?? existing.agent_wechat, notes ?? existing.notes, id, userId]
      );
      const [updated] = await query('SELECT * FROM property_agents WHERE id = ?', [id]);
      return success(res, updated, '更新成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteAgent(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [existing] = await query(
        'SELECT id FROM property_agents WHERE id = ? AND user_id = ? AND is_active = 1',
        [id, userId]
      );
      if (!existing) return error(res, '代理人不存在', 404);
      await query('UPDATE property_agents SET is_active = 0 WHERE id = ? AND user_id = ?', [id, userId]);
      await query('UPDATE property_agent_owners SET is_active = 0 WHERE agent_id = ? AND user_id = ?', [id, userId]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getAgentOwners(req, res) {
    try {
      const userId = req.user.id;
      const { agentId } = req.params;
      const [agent] = await query('SELECT id FROM property_agents WHERE id = ? AND user_id = ? AND is_active = 1', [agentId, userId]);
      if (!agent) return error(res, '代理人不存在', 404);
      const owners = await query(
        'SELECT * FROM property_agent_owners WHERE agent_id = ? AND user_id = ? AND is_active = 1 ORDER BY created_at DESC',
        [agentId, userId]
      );
      return success(res, owners || []);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async createAgentOwner(req, res) {
    try {
      const userId = req.user.id;
      const { agentId } = req.params;
      const { owner_name, owner_phone, owner_wechat, notes } = req.body;
      if (!owner_name) return error(res, '业主名称不能为空', 400);
      const [agent] = await query('SELECT id FROM property_agents WHERE id = ? AND user_id = ? AND is_active = 1', [agentId, userId]);
      if (!agent) return error(res, '代理人不存在', 404);
      const result = await query(
        'INSERT INTO property_agent_owners (agent_id, user_id, owner_name, owner_phone, owner_wechat, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [agentId, userId, owner_name, owner_phone || null, owner_wechat || null, notes || null]
      );
      const [owner] = await query('SELECT * FROM property_agent_owners WHERE id = ?', [result.insertId]);
      return success(res, owner, '创建成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async updateAgentOwner(req, res) {
    try {
      const userId = req.user.id;
      const { ownerId } = req.params;
      const { owner_name, owner_phone, owner_wechat, notes } = req.body;
      const [existing] = await query('SELECT * FROM property_agent_owners WHERE id = ? AND user_id = ?', [ownerId, userId]);
      if (!existing) return error(res, '业主不存在', 404);
      await query(
        'UPDATE property_agent_owners SET owner_name = ?, owner_phone = ?, owner_wechat = ?, notes = ? WHERE id = ? AND user_id = ?',
        [owner_name || existing.owner_name, owner_phone ?? existing.owner_phone, owner_wechat ?? existing.owner_wechat, notes ?? existing.notes, ownerId, userId]
      );
      const [updated] = await query('SELECT * FROM property_agent_owners WHERE id = ?', [ownerId]);
      return success(res, updated, '更新成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteAgentOwner(req, res) {
    try {
      const userId = req.user.id;
      const { ownerId } = req.params;
      await query('UPDATE property_agent_owners SET is_active = 0 WHERE id = ? AND user_id = ?', [ownerId, userId]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  _extractFields(body) {
    const allowedFields = [
      'title', 'description', 'property_type', 'price', 'rent_type', 'deposit',
      'payment_method', 'bedrooms', 'livingrooms', 'kitchens', 'bathrooms',
      'area', 'floor', 'total_floors', 'furnished', 'pets_allowed',
      'address', 'city', 'district', 'subway_line', 'subway_station',
      'metro_line', 'metro_station',
      'latitude', 'longitude', 'features', 'amenities', 'images', 'videos',
      'available_from', 'source_type', 'status', 'featured',
      'agent_id', 'agent_owners'
    ];
    const jsonFields = ['features', 'amenities', 'images', 'videos', 'agent_owners'];
    const numericFields = ['latitude', 'longitude', 'price', 'deposit', 'area',
      'bedrooms', 'livingrooms', 'kitchens', 'bathrooms', 'floor', 'total_floors', 'agent_id'];
    const data = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const val = body[field];
        if (jsonFields.includes(field) && typeof val !== 'string') {
          data[field] = JSON.stringify(val || []);
        } else if (numericFields.includes(field) && (val === '' || val === null)) {
          data[field] = null;
        } else {
          data[field] = val;
        }
      }
    }
    return data;
  }
}

module.exports = new PropertyController();
