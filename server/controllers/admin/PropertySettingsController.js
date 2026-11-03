/**
 * 管理后台-房源设置控制器
 * 区域、地铁线路、地铁站、AI解析配置等
 */
const { query } = require('../../config/database');
const PropertySettings = require('../../models/PropertySettings');
const SystemSetting = require('../../models/SystemSetting');
const { success, error } = require('../../utils/response');

const POI_TABLE = 'property_community_dict';
const POI_RECYCLE_TABLE = 'property_community_dict_recycle_bin';

async function ensurePOIRecycleBinTable() {
  await query(`CREATE TABLE IF NOT EXISTS ${POI_RECYCLE_TABLE} LIKE ${POI_TABLE}`);
  await query(`ALTER TABLE ${POI_RECYCLE_TABLE} ADD COLUMN original_id BIGINT NULL`).catch(() => {});
  await query(`ALTER TABLE ${POI_RECYCLE_TABLE} ADD COLUMN deleted_at DATETIME NULL`).catch(() => {});
  await query(`ALTER TABLE ${POI_RECYCLE_TABLE} ADD COLUMN deleted_by BIGINT NULL`).catch(() => {});
  await query(`ALTER TABLE ${POI_RECYCLE_TABLE} ADD COLUMN delete_reason VARCHAR(50) NULL`).catch(() => {});
}

async function getTableColumns(tableName) {
  const rows = await query(`SHOW COLUMNS FROM ${tableName}`);
  const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
  return (list || []).map(col => col.Field).filter(Boolean);
}

async function movePOIToRecycleBin(ids, operatorId, deleteReason) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  await ensurePOIRecycleBinTable();
  const columns = await getTableColumns(POI_TABLE);
  if (!columns.length) return 0;
  const escapedColumns = columns.map(col => `\`${col}\``).join(', ');
  const selectedColumns = columns.map(col => `src.\`${col}\``).join(', ');
  const placeholders = ids.map(() => '?').join(',');
  await query(
    `REPLACE INTO ${POI_RECYCLE_TABLE} (${escapedColumns}, original_id, deleted_at, deleted_by, delete_reason)
     SELECT ${selectedColumns}, src.id AS original_id, NOW(), ?, ? FROM ${POI_TABLE} src WHERE src.id IN (${placeholders})`,
    [operatorId || null, deleteReason || 'delete', ...ids]
  );
  return ids.length;
}

function normalizeFailReasons(raw) {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (Array.isArray(item) && item.length >= 2) {
        return { reason: String(item[0] || '').trim(), count: Number(item[1]) || 0 };
      }
      if (item && typeof item === 'object') {
        return { reason: String(item.reason || '').trim(), count: Number(item.count) || 0 };
      }
      return null;
    })
    .filter((item) => item && item.reason)
    .sort((a, b) => b.count - a.count);
}

function normalizeRuntimeStats(rawStats, logs) {
  const stats = (rawStats && typeof rawStats === 'object') ? { ...rawStats } : {};
  stats.topFailReasons = normalizeFailReasons(stats.topFailReasons);
  if (stats.topFailReasons.length === 0 && Array.isArray(logs)) {
    const fromLog = logs.find((log) => Array.isArray(log?.failReasons) && log.failReasons.length > 0);
    if (fromLog) {
      stats.topFailReasons = normalizeFailReasons(fromLog.failReasons).slice(0, 3);
    }
  }
  return stats;
}

function normalizeModelIdList(raw) {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        list = JSON.parse(trimmed);
      } catch {
        list = trimmed.split(',');
      }
    } else {
      list = trimmed.split(',');
    }
  }
  if (!Array.isArray(list)) list = [list];
  const seen = new Set();
  const normalized = [];
  for (const item of list) {
    const id = String(item ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

function extractAIResponseText(data) {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? choice?.delta?.content ?? choice?.text;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((item) => item?.text || item?.content || '').join('').trim();
  }
  if (typeof data?.output_text === 'string') return data.output_text.trim();
  if (Array.isArray(data?.output)) {
    return data.output
      .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
      .map((item) => item?.text || '')
      .join('')
      .trim();
  }
  return '';
}

class PropertySettingsController {
  // ============ 区域管理 ============

  async getDistricts(req, res) {
    try {
      const districts = await PropertySettings.getDistricts();
      return success(res, districts);
    } catch (err) {
      return error(res, '获取区域列表失败', 500);
    }
  }

  async saveDistrict(req, res) {
    try {
      const { id, name_cn, name_en, city, sort_order } = req.body;
      if (id) {
        await query('UPDATE property_districts SET name_cn = ?, name_en = ?, city = ?, sort_order = ?, updated_at = NOW() WHERE id = ?', [name_cn, name_en, city, sort_order || 0, id]);
      } else {
        await query('INSERT INTO property_districts (name_cn, name_en, city, sort_order, created_at) VALUES (?, ?, ?, ?, NOW())', [name_cn, name_en, city || '上海', sort_order || 0]);
      }
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteDistrict(req, res) {
    try {
      await query('DELETE FROM property_districts WHERE id = ?', [req.params.id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 地铁线路管理 ============

  async getMetroLines(req, res) {
    try {
      const lines = await PropertySettings.getMetroLines();
      return success(res, lines);
    } catch (err) {
      return error(res, '获取地铁线路失败', 500);
    }
  }

  async saveMetroLine(req, res) {
    try {
      const { id, name_cn, name_en, line_color, city, sort_order } = req.body;
      if (id) {
        await query('UPDATE property_metro_lines SET name_cn = ?, name_en = ?, line_color = ?, city = ?, sort_order = ?, updated_at = NOW() WHERE id = ?', [name_cn, name_en, line_color, city, sort_order || 0, id]);
      } else {
        await query('INSERT INTO property_metro_lines (name_cn, name_en, line_color, city, sort_order, created_at) VALUES (?, ?, ?, ?, ?, NOW())', [name_cn, name_en, line_color, city || '上海', sort_order || 0]);
      }
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteMetroLine(req, res) {
    try {
      await query('DELETE FROM property_metro_lines WHERE id = ?', [req.params.id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 地铁站点管理 ============

  async getMetroStations(req, res) {
    try {
      const lineId = req.query.lineId || req.query.metro_line_id || null;
      const stations = await PropertySettings.getMetroStations(lineId);
      return success(res, stations);
    } catch (err) {
      return error(res, '获取地铁站点失败', 500);
    }
  }

  async saveMetroStation(req, res) {
    try {
      const { id, name_cn, name_en, is_transfer, sort_order } = req.body;
      const line_id = req.body.line_id || req.body.metro_line_id;
      if (!line_id) return error(res, '请选择所属线路', 400);
      if (id) {
        await query('UPDATE property_metro_stations SET line_id = ?, name_cn = ?, name_en = ?, is_transfer = ?, sort_order = ?, updated_at = NOW() WHERE id = ?', [line_id, name_cn, name_en, is_transfer || 0, sort_order || 0, id]);
      } else {
        await query('INSERT INTO property_metro_stations (line_id, name_cn, name_en, is_transfer, sort_order, created_at) VALUES (?, ?, ?, ?, ?, NOW())', [line_id, name_cn, name_en, is_transfer || 0, sort_order || 0]);
      }
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteMetroStation(req, res) {
    try {
      await query('DELETE FROM property_metro_stations WHERE id = ?', [req.params.id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 小区POI数据管理 ============

  async getCommunityPOI(req, res) {
    try {
      const { page = 1, pageSize = 20, search = '', district = '', hasMetro = '', nameOnly = '', dateStart = '', dateEnd = '' } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const limit = parseInt(pageSize, 10);

      let where = '1=1';
      const params = [];

      if (search) {
        if (nameOnly === '1') {
          where += ' AND community_name LIKE ?';
          params.push(`%${search}%`);
        } else {
          where += ' AND (community_name LIKE ? OR alias_names LIKE ? OR board LIKE ?)';
          const kw = `%${search}%`;
          params.push(kw, kw, kw);
        }
      }
      if (district) {
        where += ' AND district = ?';
        params.push(district);
      }
      if (hasMetro === '1') {
        where += ' AND nearest_metro_station IS NOT NULL AND nearest_metro_station != ""';
      } else if (hasMetro === '0') {
        where += ' AND (nearest_metro_station IS NULL OR nearest_metro_station = "")';
      }
      if (dateStart) {
        where += ' AND DATE(created_at) >= ?';
        params.push(dateStart);
      }
      if (dateEnd) {
        where += ' AND DATE(created_at) <= ?';
        params.push(dateEnd);
      }

      const [countResult] = await query(`SELECT COUNT(*) as total FROM property_community_dict WHERE ${where}`, params);
      const total = countResult.total;

      const orderBy = (dateStart || dateEnd)
        ? 'created_at DESC, id DESC'
        : 'district ASC, listing_count DESC, community_name ASC';
      const data = await query(
        `SELECT * FROM property_community_dict WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return success(res, { data, total, page: parseInt(page, 10), pageSize: limit, totalPages: Math.ceil(total / limit) });
    } catch (err) {
      return error(res, '获取小区POI数据失败: ' + err.message, 500);
    }
  }

  async getCommunityPOIRecycleBin(req, res) {
    try {
      await ensurePOIRecycleBinTable();
      const { page = 1, pageSize = 20, search = '', district = '' } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const limit = parseInt(pageSize, 10);

      let where = '1=1';
      const params = [];
      if (search) {
        where += ' AND (community_name LIKE ? OR alias_names LIKE ? OR board LIKE ?)';
        const kw = `%${search}%`;
        params.push(kw, kw, kw);
      }
      if (district) {
        where += ' AND district = ?';
        params.push(district);
      }

      const [countResult] = await query(`SELECT COUNT(*) as total FROM ${POI_RECYCLE_TABLE} WHERE ${where}`, params);
      const data = await query(
        `SELECT * FROM ${POI_RECYCLE_TABLE} WHERE ${where} ORDER BY deleted_at DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      const total = countResult?.total || 0;
      return success(res, { data, total, page: parseInt(page, 10), pageSize: limit, totalPages: Math.ceil(total / limit) });
    } catch (err) {
      return error(res, '获取POI回收站失败: ' + err.message, 500);
    }
  }

  async saveCommunityPOI(req, res) {
    try {
      const { id, community_name, district, board, alias_names, address, latitude, longitude, property_type, nearest_metro_line, nearest_metro_station, nearest_metro_distance, ref_price_min, ref_price_max, is_enabled } = req.body;
      if (!community_name || !district) return error(res, '小区名和区域为必填项');

      const VALID_DISTRICTS = ['黄浦区','徐汇区','长宁区','静安区','普陀区','虹口区','杨浦区','闵行区','宝山区','嘉定区','浦东新区','金山区','松江区','青浦区','奉贤区','崇明区'];
      if (!VALID_DISTRICTS.includes(district)) {
        return error(res, `区域「${district}」不在标准16区范围内，请选择正确区域`, 400);
      }

      const lat = latitude ? parseFloat(latitude) : null;
      const lng = longitude ? parseFloat(longitude) : null;

      const dupCheck = await query(
        'SELECT id, community_name, district FROM property_community_dict WHERE community_name = ? AND district = ? AND id != ? LIMIT 1',
        [community_name, district, id || 0]
      );
      const dupRows = Array.isArray(dupCheck[0]) ? dupCheck[0] : dupCheck;
      if (dupRows && dupRows.length > 0) {
        return error(res, `「${community_name}」在「${district}」下已存在（ID: ${dupRows[0].id}），请勿重复添加`, 400);
      }

      if (id) {
        await query(
          `UPDATE property_community_dict SET community_name=?, district=?, board=?, alias_names=?, address=?, latitude=?, longitude=?, property_type=?, nearest_metro_line=?, nearest_metro_station=?, nearest_metro_distance=?, ref_price_min=?, ref_price_max=?, is_enabled=?, updated_at=NOW() WHERE id=?`,
          [community_name, district, board || null, alias_names || null, address || null, lat, lng, property_type || '住宅', nearest_metro_line || null, nearest_metro_station || null, nearest_metro_distance || null, ref_price_min || null, ref_price_max || null, is_enabled !== undefined ? is_enabled : 1, id]
        );
      } else {
        await query(
          `INSERT INTO property_community_dict (community_name, district, board, alias_names, address, latitude, longitude, property_type, nearest_metro_line, nearest_metro_station, nearest_metro_distance, ref_price_min, ref_price_max, source, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, NOW(), NOW())`,
          [community_name, district, board || null, alias_names || null, address || null, lat, lng, property_type || '住宅', nearest_metro_line || null, nearest_metro_station || null, nearest_metro_distance || null, ref_price_min || null, ref_price_max || null, is_enabled !== undefined ? is_enabled : 1]
        );
        query('INSERT INTO poi_operation_log (operation_type, affected_count, operator_id, detail) VALUES (?, 1, ?, ?)',
          ['add', req.user?.id || null, JSON.stringify({ community_name, district, source: 'manual' })]
        ).catch(() => {});
      }

      if (!lat || !lng) {
        autoGeocodePOI(community_name, district, address).catch(() => {});
      }

      return success(res, null, '保存成功');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return error(res, `「${req.body.community_name}」在「${req.body.district}」下已存在，请勿重复添加`, 400);
      }
      return error(res, err.message, 500);
    }
  }

  async deleteCommunityPOI(req, res) {
    try {
      const rows = await query('SELECT community_name, district FROM property_community_dict WHERE id = ? LIMIT 1', [req.params.id]);
      const row = Array.isArray(rows[0]) ? rows[0][0] : rows[0];
      await movePOIToRecycleBin([Number(req.params.id)], req.user?.id || null, 'delete');
      await query('DELETE FROM property_community_dict WHERE id = ?', [req.params.id]);
      query('INSERT INTO poi_operation_log (operation_type, affected_count, operator_id, detail) VALUES (?, 1, ?, ?)',
        ['delete', req.user?.id || null, JSON.stringify({ id: req.params.id, community_name: row?.community_name, district: row?.district })]
      ).catch(() => {});
      return success(res, null, '已移入回收站');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async batchDeleteCommunityPOI(req, res) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) return error(res, '请选择要删除的记录', 400);
      const placeholders = ids.map(() => '?').join(',');
      await movePOIToRecycleBin(ids.map(Number), req.user?.id || null, 'batch_delete');
      const result = await query(`DELETE FROM property_community_dict WHERE id IN (${placeholders})`, ids);
      const affected = result?.affectedRows || (Array.isArray(result) ? result[0]?.affectedRows : 0) || 0;
      if (affected > 0) {
        query('INSERT INTO poi_operation_log (operation_type, affected_count, operator_id, detail) VALUES (?, ?, ?, ?)',
          ['batch_delete', affected, req.user?.id || null, JSON.stringify({ ids, count: affected })]
        ).catch(() => {});
      }
      return success(res, { deleted: affected }, `成功移入回收站 ${affected} 条记录`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async restoreCommunityPOI(req, res) {
    try {
      await ensurePOIRecycleBinTable();
      const restoreIds = Array.isArray(req.body?.ids) && req.body.ids.length
        ? req.body.ids.map(Number)
        : [Number(req.params.id)];
      const validIds = restoreIds.filter(id => Number.isInteger(id) && id > 0);
      if (!validIds.length) return error(res, '请选择要恢复的记录', 400);

      const columns = await getTableColumns(POI_TABLE);
      if (!columns.length) return error(res, 'POI表结构读取失败', 500);
      const escapedColumns = columns.map(col => `\`${col}\``).join(', ');
      const selectedColumns = columns.map(col => `rb.\`${col}\``).join(', ');
      const placeholders = validIds.map(() => '?').join(',');

      await query(
        `REPLACE INTO ${POI_TABLE} (${escapedColumns})
         SELECT ${selectedColumns} FROM ${POI_RECYCLE_TABLE} rb WHERE rb.id IN (${placeholders})`,
        validIds
      );
      const result = await query(`DELETE FROM ${POI_RECYCLE_TABLE} WHERE id IN (${placeholders})`, validIds);
      const restored = result?.affectedRows || (Array.isArray(result) ? result[0]?.affectedRows : 0) || validIds.length;

      query('INSERT INTO poi_operation_log (operation_type, affected_count, operator_id, detail) VALUES (?, ?, ?, ?)',
        ['restore', restored, req.user?.id || null, JSON.stringify({ ids: validIds, count: restored })]
      ).catch(() => {});

      return success(res, { restored }, `成功恢复 ${restored} 条记录`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getCommunityPOIStats(req, res) {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN latitude IS NOT NULL AND latitude != 0 THEN 1 END) as with_coords,
          COUNT(CASE WHEN nearest_metro_station IS NOT NULL AND nearest_metro_station != '' THEN 1 END) as with_metro,
          COUNT(CASE WHEN ref_price_min IS NOT NULL THEN 1 END) as with_price,
          COUNT(CASE WHEN alias_names IS NOT NULL AND alias_names != '' THEN 1 END) as with_alias,
          COUNT(DISTINCT district) as district_count
        FROM property_community_dict
      `);
      const districtStats = await query(`
        SELECT district, COUNT(*) as count FROM property_community_dict GROUP BY district ORDER BY count DESC
      `);

      const timeStats = await query(`
        SELECT
          SUM(CASE WHEN operation_type IN ('add','import') AND DATE(created_at) = CURDATE() THEN affected_count ELSE 0 END) as today_added,
          SUM(CASE WHEN operation_type IN ('delete','batch_delete','clear') AND DATE(created_at) = CURDATE() THEN affected_count ELSE 0 END) as today_deleted,
          SUM(CASE WHEN operation_type IN ('add','import') AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1) THEN affected_count ELSE 0 END) as week_added,
          SUM(CASE WHEN operation_type IN ('delete','batch_delete','clear') AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1) THEN affected_count ELSE 0 END) as week_deleted,
          SUM(CASE WHEN operation_type IN ('add','import') AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN affected_count ELSE 0 END) as month_added,
          SUM(CASE WHEN operation_type IN ('delete','batch_delete','clear') AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN affected_count ELSE 0 END) as month_deleted
        FROM poi_operation_log
      `);

      // 按来源分类的时间维度统计（直接从property_community_dict的source和created_at统计）
      const sourceBreakdown = await query(`
        SELECT
          CASE 
            WHEN source IN ('manual') THEN 'manual'
            WHEN source IN ('manual_import') THEN 'manual_import'
            WHEN source IN ('csv_import','fangtianxia_csv') THEN 'csv_import'
            WHEN source IN ('national_poi_excel') THEN 'excel_import'
            WHEN source IN ('auto_parse','auto_enrich','auto_calibrate') THEN 'auto'
            ELSE 'other'
          END as source_group,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_count,
          SUM(CASE WHEN YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1) THEN 1 ELSE 0 END) as week_count,
          SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN 1 ELSE 0 END) as month_count,
          COUNT(*) as total_count
        FROM property_community_dict
        GROUP BY source_group
        ORDER BY total_count DESC
      `);
      const sourceMap = {};
      const srcRows = Array.isArray(sourceBreakdown[0]) ? sourceBreakdown[0] : sourceBreakdown;
      for (const row of srcRows) {
        sourceMap[row.source_group] = {
          today: Number(row.today_count) || 0,
          week: Number(row.week_count) || 0,
          month: Number(row.month_count) || 0,
          total: Number(row.total_count) || 0
        };
      }

      return success(res, {
        summary: stats[0],
        districts: districtStats,
        timeStats: timeStats[0] || { today_added: 0, today_deleted: 0, week_added: 0, week_deleted: 0, month_added: 0, month_deleted: 0 },
        sourceBreakdown: sourceMap
      });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async importCommunityCSV(req, res) {
    try {
      if (!req.file) return error(res, '请上传CSV文件');

      const iconv = require('iconv-lite');
      const rawBuffer = req.file.buffer;

      let content;
      try {
        content = iconv.decode(rawBuffer, 'gbk');
        if (!content.includes('房源') && !content.includes('小区') && !content.includes('位置')) {
          content = rawBuffer.toString('utf-8');
        }
      } catch {
        content = rawBuffer.toString('utf-8');
      }

      const lines = content.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return error(res, 'CSV文件为空或格式错误');

      const DISTRICT_MAP = {
        '浦东': '浦东新区', '黄浦': '黄浦区', '徐汇': '徐汇区', '长宁': '长宁区',
        '静安': '静安区', '普陀': '普陀区', '虹口': '虹口区', '杨浦': '杨浦区',
        '闵行': '闵行区', '宝山': '宝山区', '嘉定': '嘉定区', '金山': '金山区',
        '松江': '松江区', '青浦': '青浦区', '奉贤': '奉贤区', '崇明': '崇明区',
      };

      function parseCSVLine(line) {
        const fields = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQuotes = !inQuotes; }
          else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
          else { current += ch; }
        }
        fields.push(current.trim());
        return fields;
      }

      const communityMap = new Map();
      let parseErrors = 0;

      for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        if (fields.length < 7) { parseErrors++; continue; }

        const location = fields[5];
        if (!location || !location.includes('-')) { parseErrors++; continue; }
        const parts = location.split('-');
        if (parts.length < 3) { parseErrors++; continue; }

        const districtShort = parts[0].trim();
        const board = parts[1].trim();
        const communityRaw = parts.slice(2).join('-').trim().replace(/\s+/g, '');
        if (!communityRaw || communityRaw.length < 2 || communityRaw.length > 50) { parseErrors++; continue; }

        const district = DISTRICT_MAP[districtShort] || districtShort + '区';

        const metroStr = fields[6] || '';
        let metroLine = null, metroStation = null, metroDistance = null;
        const metroMatch = metroStr.match(/(\d+)号线(?:\([^)]*\))?\s*(.+?)站(?:约(\d+)米)?/);
        if (metroMatch) {
          metroLine = metroMatch[1] + '号线';
          metroStation = metroMatch[2].replace(/[(\(（].*$/, '').trim() + '站';
          metroDistance = metroMatch[3] ? parseInt(metroMatch[3], 10) : null;
        }

        const priceStr = fields[7] || '';
        const priceMatch = priceStr.match(/(\d+)\s*元\/月/);
        const price = priceMatch ? parseInt(priceMatch[1], 10) : null;

        const key = `${communityRaw}__${district}`;
        if (communityMap.has(key)) {
          const existing = communityMap.get(key);
          existing.listing_count++;
          if (price) existing.prices.push(price);
          if (metroLine && !existing.metroLine) {
            existing.metroLine = metroLine;
            existing.metroStation = metroStation;
            existing.metroDistance = metroDistance;
          }
        } else {
          communityMap.set(key, {
            community_name: communityRaw, district, board,
            metroLine, metroStation, metroDistance,
            prices: price ? [price] : [],
            listing_count: 1,
          });
        }
      }

      const clearOld = req.body?.clearOld === 'true' || req.body?.clearOld === true;
      if (clearOld) {
        await query('DELETE FROM property_community_dict');
      }

      let inserted = 0, errors = 0;
      for (const [, data] of communityMap) {
        try {
          const priceMin = data.prices.length > 0 ? Math.min(...data.prices) : null;
          const priceMax = data.prices.length > 0 ? Math.max(...data.prices) : null;

          await query(
            `INSERT INTO property_community_dict 
              (community_name, district, board, nearest_metro_line, nearest_metro_station, nearest_metro_distance, ref_price_min, ref_price_max, listing_count, source, is_enabled, created_at, updated_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'csv_import', 1, NOW(), NOW())
              ON DUPLICATE KEY UPDATE 
                board = VALUES(board), nearest_metro_line = COALESCE(VALUES(nearest_metro_line), nearest_metro_line),
                nearest_metro_station = COALESCE(VALUES(nearest_metro_station), nearest_metro_station),
                nearest_metro_distance = COALESCE(VALUES(nearest_metro_distance), nearest_metro_distance),
                ref_price_min = VALUES(ref_price_min), ref_price_max = VALUES(ref_price_max),
                listing_count = VALUES(listing_count), updated_at = NOW()`,
            [data.community_name, data.district, data.board, data.metroLine, data.metroStation, data.metroDistance, priceMin, priceMax, data.listing_count]
          );
          inserted++;
        } catch (e) {
          errors++;
        }
      }

      if (inserted > 0) {
        query('INSERT INTO poi_operation_log (operation_type, affected_count, operator_id, detail) VALUES (?, ?, ?, ?)',
          ['import', inserted, req.user?.id || null, JSON.stringify({ source: 'csv', inserted, errors })]
        ).catch(() => {});
      }
      if (clearOld) {
        query('INSERT INTO poi_operation_log (operation_type, affected_count, operator_id, detail) VALUES (?, ?, ?, ?)',
          ['clear', 0, req.user?.id || null, JSON.stringify({ reason: 'csv_import_clear_old' })]
        ).catch(() => {});
      }

      return success(res, {
        total_lines: lines.length - 1,
        communities_found: communityMap.size,
        inserted,
        errors,
        parse_errors: parseErrors,
        cleared_old: clearOld,
      }, `导入完成: ${inserted} 个小区`);
    } catch (err) {
      return error(res, '导入失败: ' + err.message, 500);
    }
  }

  async importCommunityExcel(req, res) {
    try {
      if (!req.file) return error(res, '请上传Excel文件');

      const XLSX = require('xlsx');
      const wb = XLSX.read(req.file.buffer, { type: 'buffer', sheetRows: 0 });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const allData = XLSX.utils.sheet_to_json(ws, { header: 1 });

      let headerIdx = -1;
      for (let i = 0; i < Math.min(5, allData.length); i++) {
        const row = allData[i];
        if (row && row[0] === 'name' && row[1] === 'province') { headerIdx = i; break; }
      }
      if (headerIdx === -1) return error(res, 'Excel格式不正确，找不到表头行(name, province, city...)');

      const DISTRICT_MAP = {
        '浦东': '浦东新区', '浦东新区': '浦东新区',
        '静安': '静安区', '静安区': '静安区',
        '徐汇': '徐汇区', '徐汇区': '徐汇区',
        '闵行': '闵行区', '闵行区': '闵行区',
        '黄浦': '黄浦区', '黄浦区': '黄浦区',
        '虹口': '虹口区', '虹口区': '虹口区',
        '杨浦': '杨浦区', '杨浦区': '杨浦区',
        '松江': '松江区', '松江区': '松江区',
        '宝山': '宝山区', '宝山区': '宝山区',
        '嘉定': '嘉定区', '嘉定区': '嘉定区',
        '长宁': '长宁区', '长宁区': '长宁区',
        '普陀': '普陀区', '普陀区': '普陀区',
        '青浦': '青浦区', '青浦区': '青浦区',
        '奉贤': '奉贤区', '奉贤区': '奉贤区',
        '金山': '金山区', '金山区': '金山区',
        '崇明': '崇明区', '崇明区': '崇明区',
      };
      const SKIP_AREAS = new Set(['上海周边', '龙口市', '博山', '鲅鱼圈', '高淳区', '阆中', '寿县', '花桥', '利州', '海宁', '嘉善']);

      function cleanVal(v) {
        if (v == null) return '';
        const s = String(v).trim();
        return (s === '暂无数据' || s === '无' || s === 'None') ? '' : s;
      }

      function extractBoard(addr) {
        if (!addr) return '';
        const parts = addr.split('-');
        return parts.length >= 2 ? parts[1].trim() : '';
      }

      function extractAddress(addr) {
        if (!addr) return '';
        const parts = addr.split('-');
        return parts.length >= 3 ? parts.slice(2).join('-').trim() : addr;
      }

      const shanghaiRecords = [];
      const seenKeys = new Set();
      let skipped = 0;

      for (let i = headerIdx + 1; i < allData.length; i++) {
        const row = allData[i];
        if (!row || !row[2]) continue;
        const city = String(row[2]);
        if (!city.includes('上海')) continue;

        const area = cleanVal(row[3]);
        if (SKIP_AREAS.has(area)) { skipped++; continue; }
        const district = DISTRICT_MAP[area];
        if (!district) { skipped++; continue; }

        const name = cleanVal(row[0]);
        if (!name) continue;

        const dedupKey = `${name}||${district}`;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);

        const addressRaw = cleanVal(row[4]);
        const lat = cleanVal(row[5]) ? parseFloat(row[5]) : null;
        const lng = cleanVal(row[6]) ? parseFloat(row[6]) : null;
        const propertyType = cleanVal(row[9]) || '住宅';

        const yearMatch = cleanVal(row[13]).match(/(\d{4})/);
        const buildYear = yearMatch ? parseInt(yearMatch[1]) : null;

        const roomMatch = cleanVal(row[12]).match(/(\d+)/);
        const totalUnits = roomMatch ? parseInt(roomMatch[1]) : null;

        shanghaiRecords.push({
          community_name: name,
          district,
          board: extractBoard(addressRaw),
          address: extractAddress(addressRaw),
          latitude: lat,
          longitude: lng,
          property_type: propertyType === '公寓' ? '公寓' : propertyType === '别墅' ? '别墅' : '住宅',
          build_year: buildYear,
          total_units: totalUnits,
        });
      }

      if (shanghaiRecords.length === 0) {
        return error(res, '未在Excel中找到上海小区数据');
      }

      const [existing] = await query(
        'SELECT id, community_name, district, latitude, longitude, address, board, property_type, build_year, total_units FROM property_community_dict'
      );
      const existingMap = new Map();
      existing.forEach(r => existingMap.set(`${r.community_name}||${r.district}`, r));

      let updated = 0, inserted = 0, unchanged = 0, errors = 0;

      for (const rec of shanghaiRecords) {
        const key = `${rec.community_name}||${rec.district}`;
        const existRow = existingMap.get(key);

        if (existRow) {
          const updates = {};
          if ((!existRow.latitude || parseFloat(existRow.latitude) === 0) && rec.latitude) updates.latitude = rec.latitude;
          if ((!existRow.longitude || parseFloat(existRow.longitude) === 0) && rec.longitude) updates.longitude = rec.longitude;
          if (!existRow.address && rec.address) updates.address = rec.address;
          if (!existRow.board && rec.board) updates.board = rec.board;
          if ((!existRow.property_type || existRow.property_type === '住宅') && rec.property_type !== '住宅') updates.property_type = rec.property_type;
          if (!existRow.build_year && rec.build_year) updates.build_year = rec.build_year;
          if (!existRow.total_units && rec.total_units) updates.total_units = rec.total_units;

          if (Object.keys(updates).length > 0) {
            try {
              const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
              await query(`UPDATE property_community_dict SET ${setClauses} WHERE id = ?`, [...Object.values(updates), existRow.id]);
              updated++;
            } catch { errors++; }
          } else {
            unchanged++;
          }
        } else {
          try {
            await query(
              `INSERT IGNORE INTO property_community_dict 
               (community_name, district, board, address, latitude, longitude, property_type, build_year, total_units, source, is_enabled) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'national_poi_excel', 1)`,
              [rec.community_name, rec.district, rec.board || null, rec.address || null, rec.latitude, rec.longitude, rec.property_type, rec.build_year, rec.total_units]
            );
            inserted++;
          } catch { errors++; }
        }
      }

      if (inserted > 0) {
        query('INSERT INTO poi_operation_log (operation_type, affected_count, operator_id, detail) VALUES (?, ?, ?, ?)',
          ['import', inserted, req.user?.id || null, JSON.stringify({ source: 'excel', inserted, updated, errors })]
        ).catch(() => {});
      }

      return success(res, {
        total_excel_rows: allData.length - headerIdx - 1,
        shanghai_communities: shanghaiRecords.length,
        skipped,
        updated,
        inserted,
        unchanged,
        errors,
      }, `Excel导入完成: 更新${updated}条, 新增${inserted}条`);
    } catch (err) {
      return error(res, '导入失败: ' + err.message, 500);
    }
  }

  async clearCommunityPOI(req, res) {
    try {
      const [result] = await query('SELECT COUNT(*) as cnt FROM property_community_dict');
      const cnt = result[0]?.cnt || result?.cnt || 0;
      await query('DELETE FROM property_community_dict');
      if (cnt > 0) {
        query('INSERT INTO poi_operation_log (operation_type, affected_count, operator_id, detail) VALUES (?, ?, ?, ?)',
          ['clear', cnt, req.user?.id || null, JSON.stringify({ reason: 'manual_clear', count: cnt })]
        ).catch(() => {});
      }
      return success(res, { deleted: cnt }, `已清除 ${cnt} 条POI数据`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ AI解析配置 ============

  async getAIParseConfig(req, res) {
    try {
      const aiModels = await query('SELECT id, model_name, model_code, model_provider, model_type, api_url, is_enabled, priority, status FROM ai_models ORDER BY priority ASC, id ASC');
      const aiParseEnabled = await SystemSetting.get('ai_parse_enabled', '0');
      const aiParseModelId = await SystemSetting.get('ai_parse_model_id', '');
      const aiParseModelIds = normalizeModelIdList(await SystemSetting.get('ai_parse_model_ids', '[]'));
      const aiParsePrompt = await SystemSetting.get('ai_parse_prompt', '');
      const aiParseBatchSize = await SystemSetting.get('ai_parse_batch_size', '50');
      const aiParseMultiThread = await SystemSetting.get('ai_parse_multi_thread', '0');
      const aiParseThreadCount = await SystemSetting.get('ai_parse_thread_count', '8');

      // 解析统计（区分有原文/无原文，与定时任务队列口径一致）
      let parseStats = {};
      try {
        const [statsRow] = await query(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN is_ai_parsed = 1 THEN 1 ELSE 0 END) as parsed,
            SUM(CASE WHEN (is_ai_parsed = 0 OR is_ai_parsed IS NULL) THEN 1 ELSE 0 END) as unparsed,
            SUM(CASE WHEN (is_ai_parsed = 0 OR is_ai_parsed IS NULL) AND original_content IS NOT NULL AND LENGTH(TRIM(original_content)) > 0 THEN 1 ELSE 0 END) as unparsed_with_content,
            SUM(CASE WHEN (is_ai_parsed = 0 OR is_ai_parsed IS NULL) AND (original_content IS NULL OR LENGTH(TRIM(original_content)) = 0) THEN 1 ELSE 0 END) as unparsed_no_content,
            SUM(CASE WHEN price_value > 0 THEN 1 ELSE 0 END) as has_price,
            SUM(CASE WHEN community IS NOT NULL AND community != '' THEN 1 ELSE 0 END) as has_community
          FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL
        `);
        parseStats = statsRow || {};
      } catch {}

      // 待解析记录的时间范围
      let unparsedTimeRange = {};
      try {
        const [rangeRow] = await query(`
          SELECT 
            MIN(created_at) as oldest_created,
            MAX(created_at) as newest_created
          FROM wechat_robot_expat_parsed_properties
          WHERE deleted_at IS NULL
            AND (is_ai_parsed = 0 OR is_ai_parsed IS NULL)
            AND original_content IS NOT NULL AND LENGTH(TRIM(original_content)) > 0
        `);
        unparsedTimeRange = rangeRow || {};
      } catch {}

      // 获取自动AI解析定时任务的实时运行状态（从数据库读取，cluster模式下内存不共享）
      let runtimeStats = {};
      try {
        const raw = await SystemSetting.get('ai_parse_runtime_stats', '');
        if (raw) runtimeStats = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {}

      let parseLogs = [];
      try {
        const rawLogs = await SystemSetting.get('ai_parse_job_logs', '');
        if (rawLogs) parseLogs = typeof rawLogs === 'string' ? JSON.parse(rawLogs) : rawLogs;
      } catch {}
      if (!Array.isArray(parseLogs)) parseLogs = [];
      runtimeStats = normalizeRuntimeStats(runtimeStats, parseLogs);

      return success(res, {
        aiModels,
        config: {
          ai_parse_enabled: aiParseEnabled,
          ai_parse_model_id: aiParseModelId,
          ai_parse_model_ids: aiParseModelIds,
          ai_parse_prompt: aiParsePrompt,
          ai_parse_batch_size: aiParseBatchSize,
          ai_parse_multi_thread: aiParseMultiThread,
          ai_parse_thread_count: aiParseThreadCount,
        },
        parseStats,
        unparsedTimeRange,
        runtimeStats,
      });
    } catch (err) {
      logger.error('获取AI解析配置失败', { error: err.message });
      return error(res, '获取AI解析配置失败', 500);
    }
  }

  async getAIParseLogs(req, res) {
    try {
      const raw = await SystemSetting.get('ai_parse_job_logs', '');
      let logs = [];
      if (raw) {
        try { logs = JSON.parse(raw); } catch { logs = []; }
      }
      if (!Array.isArray(logs)) logs = [];
      logs = logs.map((log) => ({
        ...log,
        failReasons: normalizeFailReasons(log?.failReasons),
      }));
      return success(res, logs);
    } catch (err) {
      logger.error('获取AI解析日志失败', { error: err.message });
      return error(res, '获取AI解析日志失败', 500);
    }
  }

  async clearAIParseLogs(req, res) {
    try {
      await SystemSetting.set('ai_parse_job_logs', '[]', 'json');
      return success(res, null, '日志已清空');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async saveAIParseConfig(req, res) {
    try {
      const {
        ai_parse_enabled,
        ai_parse_model_id,
        ai_parse_model_ids,
        ai_parse_prompt,
        ai_parse_batch_size,
        ai_parse_multi_thread,
        ai_parse_thread_count,
      } = req.body;
      if (ai_parse_model_id !== undefined && ai_parse_model_id !== null && String(ai_parse_model_id).trim() !== '') {
        const [model] = await query('SELECT id FROM ai_models WHERE id = ? AND is_enabled = 1 LIMIT 1', [ai_parse_model_id]);
        if (!model) {
          return error(res, '所选AI模型不存在或未启用，请重新选择', 400);
        }
      }
      if (ai_parse_model_ids !== undefined) {
        const primaryModelId = String(ai_parse_model_id || '').trim();
        const modelIds = normalizeModelIdList(ai_parse_model_ids).filter((id) => id !== primaryModelId);
        if (modelIds.length > 0) {
          const placeholders = modelIds.map(() => '?').join(',');
          const rows = await query(`SELECT id FROM ai_models WHERE is_enabled = 1 AND id IN (${placeholders})`, modelIds);
          const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
          const validSet = new Set((Array.isArray(list) ? list : []).map((r) => String(r.id)));
          const invalid = modelIds.filter((id) => !validSet.has(String(id)));
          if (invalid.length > 0) {
            return error(res, `以下轮训模型不存在或未启用: ${invalid.join(',')}`, 400);
          }
        }
      }
      if (ai_parse_enabled !== undefined) await SystemSetting.set('ai_parse_enabled', ai_parse_enabled, 'boolean');
      if (ai_parse_model_id !== undefined) await SystemSetting.set('ai_parse_model_id', ai_parse_model_id, 'text');
      if (ai_parse_model_ids !== undefined) {
        const primaryModelId = String(ai_parse_model_id || '').trim();
        const modelIds = normalizeModelIdList(ai_parse_model_ids).filter((id) => id !== primaryModelId);
        await SystemSetting.set('ai_parse_model_ids', JSON.stringify(modelIds), 'text');
      }
      if (ai_parse_prompt !== undefined) await SystemSetting.set('ai_parse_prompt', ai_parse_prompt, 'textarea');
      if (ai_parse_batch_size !== undefined) await SystemSetting.set('ai_parse_batch_size', ai_parse_batch_size, 'number');
      if (ai_parse_multi_thread !== undefined) await SystemSetting.set('ai_parse_multi_thread', ai_parse_multi_thread, 'boolean');
      if (ai_parse_thread_count !== undefined) await SystemSetting.set('ai_parse_thread_count', ai_parse_thread_count, 'number');
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ AI模型管理 ============

  async getAIModels(req, res) {
    try {
      const models = await query('SELECT * FROM ai_models ORDER BY priority ASC, id ASC');
      return success(res, models);
    } catch (err) {
      return error(res, '获取AI模型列表失败', 500);
    }
  }

  async saveAIModel(req, res) {
    try {
      const { id, model_name, model_code, api_url, api_key, model_provider, model_type, is_enabled, priority } = req.body;
      if (id) {
        await query('UPDATE ai_models SET model_name = ?, model_code = ?, api_url = ?, api_key = ?, model_provider = ?, model_type = ?, is_enabled = ?, priority = ?, updated_at = NOW() WHERE id = ?',
          [model_name, model_code, api_url, api_key, model_provider, model_type, is_enabled, priority || 10, id]);
      } else {
        await query('INSERT INTO ai_models (model_name, model_code, api_url, api_key, model_provider, model_type, is_enabled, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
          [model_name, model_code, api_url, api_key, model_provider, model_type, is_enabled !== undefined ? is_enabled : 1, priority || 10]);
      }
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteAIModel(req, res) {
    try {
      await query('DELETE FROM ai_models WHERE id = ?', [req.params.id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async testAIModel(req, res) {
    try {
      const { id } = req.params;
      const [model] = await query('SELECT * FROM ai_models WHERE id = ?', [id]);
      if (!model) return error(res, 'AI模型不存在', 404);

      const axios = require('axios');
      const response = await axios.post(model.api_url, {
        model: model.model_code,
        messages: [{ role: 'user', content: 'Return only this JSON object: {"ok":true}' }],
        max_tokens: 50,
        response_format: { type: 'json_object' },
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${model.api_key}`,
        },
        timeout: 60000,
      });
      const aiText = extractAIResponseText(response.data);
      const jsonText = (aiText.match(/\{[\s\S]*\}/) || [])[0];
      if (!jsonText) {
        return error(res, '模型测试失败: 模型未返回可解析JSON内容', 400);
      }
      try {
        JSON.parse(jsonText);
      } catch (e) {
        return error(res, `模型测试失败: JSON解析失败 ${e.message}`, 400);
      }

      return success(res, { response: response.data, parsed: JSON.parse(jsonText) }, '模型测试成功');
    } catch (err) {
      return error(res, `模型测试失败: ${err.message}`);
    }
  }

  // ============ 系统设置 ============

  async getSystemSettings(req, res) {
    try {
      const settings = await SystemSetting.getAll();
      return success(res, settings);
    } catch (err) {
      return error(res, '获取系统设置失败', 500);
    }
  }

  async saveSystemSettings(req, res) {
    try {
      const settings = req.body;
      for (const [key, value] of Object.entries(settings)) {
        await SystemSetting.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getLinkDisplaySettings(req, res) {
    try {
      const raw = await SystemSetting.get('link_display_settings');
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return success(res, parsed);
      }
      return success(res, {
        images: true, community: false, price: true, property_code: true, district: true,
        bedrooms: true, bathrooms: true, is_duplex: false, outdoor_features: true,
        has_elevator: true, has_parking: true, has_commission: false,
        metro_lines: true, metro_stations: true,
        publisher_name: false, contact_info: false, publish_time: false,
        show_contact_us: true, default_language: 'en',
      });
    } catch (err) {
      return error(res, '获取链接页面设置失败', 500);
    }
  }

  async saveLinkDisplaySettings(req, res) {
    try {
      await SystemSetting.set('link_display_settings', JSON.stringify(req.body));
      return success(res, null, '链接页面设置保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 高德地图一键补充：用小区名从高德POI搜索+地理编码获取完整信息
   * 包括：区域、板块、经纬度、详细地址、最近地铁站/线路/距离
   */
  async enrichPOIFromAmap(req, res) {
    try {
      const { id } = req.params;
      const poiRow = await query('SELECT * FROM property_community_dict WHERE id = ? LIMIT 1', [id]);
      if (!poiRow || poiRow.length === 0) return error(res, '未找到该POI记录');
      const poi = poiRow[0];

      const result = await amapEnrichCommunity(poi.community_name, poi.district);
      if (!result.success) return success(res, { enriched: {}, notFound: true, message: result.message || '高德地图未找到该小区' });

      const updateFields = [];
      const updateParams = [];
      const enriched = {};

      if (result.district && (!poi.district || poi.district === '')) {
        updateFields.push('district = ?');
        updateParams.push(result.district);
        enriched.district = result.district;
      }
      if (result.board && (!poi.board || poi.board === '')) {
        updateFields.push('board = ?');
        updateParams.push(result.board);
        enriched.board = result.board;
      }
      if (result.address && (!poi.address || poi.address === '')) {
        updateFields.push('address = ?');
        updateParams.push(result.address);
        enriched.address = result.address;
      }
      if (result.latitude && result.longitude && (!poi.latitude || parseFloat(poi.latitude) === 0)) {
        updateFields.push('latitude = ?, longitude = ?');
        updateParams.push(result.latitude, result.longitude);
        enriched.latitude = result.latitude;
        enriched.longitude = result.longitude;
      }
      if (result.metro_station && (!poi.nearest_metro_station || poi.nearest_metro_station === '')) {
        updateFields.push('nearest_metro_station = ?');
        updateParams.push(result.metro_station);
        enriched.nearest_metro_station = result.metro_station;
      }
      if (result.metro_line && (!poi.nearest_metro_line || poi.nearest_metro_line === '')) {
        updateFields.push('nearest_metro_line = ?');
        updateParams.push(result.metro_line);
        enriched.nearest_metro_line = result.metro_line;
      }
      if (result.metro_distance != null && (!poi.nearest_metro_distance || poi.nearest_metro_distance === 0)) {
        updateFields.push('nearest_metro_distance = ?');
        updateParams.push(result.metro_distance);
        enriched.nearest_metro_distance = result.metro_distance;
      }
      if (result.street && (!poi.street || poi.street === '')) {
        updateFields.push('street = ?');
        updateParams.push(result.street);
        enriched.street = result.street;
      }

      if (updateFields.length === 0) {
        return success(res, { enriched: {}, message: '该小区信息已完整，无需补充' });
      }

      updateParams.push(id);
      await query(`UPDATE property_community_dict SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`, updateParams);

      return success(res, { enriched, fieldsUpdated: Object.keys(enriched).length }, `成功补充 ${Object.keys(enriched).length} 项信息`);
    } catch (err) {
      return error(res, '高德补充失败: ' + err.message, 500);
    }
  }

  /**
   * 高德地图一键补充（强制覆盖模式）：覆盖已有数据重新从高德获取
   */
  async enrichPOIFromAmapForce(req, res) {
    try {
      const { id } = req.params;
      const poiRow = await query('SELECT * FROM property_community_dict WHERE id = ? LIMIT 1', [id]);
      if (!poiRow || poiRow.length === 0) return error(res, '未找到该POI记录');
      const poi = poiRow[0];

      // 强制模式不传已有区域，避免错误区域干扰搜索结果
      const result = await amapEnrichCommunity(poi.community_name, null);
      if (!result.success) return success(res, { enriched: {}, notFound: true, message: result.message || '高德地图未找到该小区' });

      const updateFields = [];
      const updateParams = [];
      const enriched = {};

      if (result.district) {
        updateFields.push('district = ?');
        updateParams.push(result.district);
        enriched.district = result.district;
      }
      if (result.board) {
        updateFields.push('board = ?');
        updateParams.push(result.board);
        enriched.board = result.board;
      }
      if (result.address) {
        updateFields.push('address = ?');
        updateParams.push(result.address);
        enriched.address = result.address;
      }
      if (result.latitude && result.longitude) {
        updateFields.push('latitude = ?, longitude = ?');
        updateParams.push(result.latitude, result.longitude);
        enriched.latitude = result.latitude;
        enriched.longitude = result.longitude;
      }
      if (result.metro_station) {
        updateFields.push('nearest_metro_station = ?');
        updateParams.push(result.metro_station);
        enriched.nearest_metro_station = result.metro_station;
      }
      if (result.metro_line) {
        updateFields.push('nearest_metro_line = ?');
        updateParams.push(result.metro_line);
        enriched.nearest_metro_line = result.metro_line;
      }
      if (result.metro_distance != null) {
        updateFields.push('nearest_metro_distance = ?');
        updateParams.push(result.metro_distance);
        enriched.nearest_metro_distance = result.metro_distance;
      }
      if (result.street) {
        updateFields.push('street = ?');
        updateParams.push(result.street);
        enriched.street = result.street;
      }

      if (updateFields.length === 0) {
        return success(res, { enriched: {}, message: '高德地图未查到更多信息' });
      }

      updateParams.push(id);
      await query(`UPDATE property_community_dict SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`, updateParams);

      return success(res, { enriched, fieldsUpdated: Object.keys(enriched).length }, `成功补充 ${Object.keys(enriched).length} 项信息`);
    } catch (err) {
      return error(res, '高德补充失败: ' + err.message, 500);
    }
  }

  /**
   * 批量高德补充：补充缺少信息的POI记录（分批处理避免API限流）
   * 支持模式：missing(缺失补充)、no_coords(缺坐标)、no_metro(缺地铁)、all(全量校验)、verify(智能校验)
   */
  async batchEnrichPOI(req, res) {
    try {
      const { mode = 'missing', district = '', limit: batchLimit = 50 } = req.body;
      const maxBatch = Math.min(parseInt(batchLimit, 10) || 50, 200);

      const COORD_THRESHOLD = 0.005;

      let whereConditions = ['is_enabled = 1'];
      const params = [];

      if (district) {
        whereConditions.push('district = ?');
        params.push(district);
      }

      if (mode === 'all' || mode === 'verify') {
        // 全量校验 / 智能校验：不加额外筛选
      } else if (mode === 'no_coords') {
        whereConditions.push('(latitude IS NULL OR latitude = 0)');
      } else if (mode === 'no_metro') {
        whereConditions.push('(nearest_metro_station IS NULL OR nearest_metro_station = "")');
      } else {
        whereConditions.push('((latitude IS NULL OR latitude = 0) OR (nearest_metro_station IS NULL OR nearest_metro_station = "") OR district IS NULL OR district = "")');
      }

      const DISTRICT_ORDER = [
        '黄浦区', '静安区', '徐汇区', '虹口区', '长宁区', '杨浦区', '普陀区',
        '浦东新区', '闵行区', '宝山区', '嘉定区', '松江区', '青浦区', '奉贤区', '金山区', '崇明区'
      ];
      const orderClause = district ? 'id ASC' :
        `FIELD(district, ${DISTRICT_ORDER.map((_, i) => '?').join(',')}) ASC, id ASC`;
      const orderParams = district ? [] : [...DISTRICT_ORDER];

      const rows = await query(
        `SELECT id, community_name, district, board, address, latitude, longitude, 
                nearest_metro_line, nearest_metro_station, nearest_metro_distance, street
         FROM property_community_dict 
         WHERE ${whereConditions.join(' AND ')} 
         ORDER BY ${orderClause} LIMIT ?`,
        [...params, ...orderParams, maxBatch]
      );

      if (rows.length === 0) {
        return success(res, { processed: 0, enrichedCount: 0, message: '没有需要补充的记录' });
      }

      let enrichedCount = 0;
      let failedCount = 0;
      const results = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          if (i > 0) await new Promise(r => setTimeout(r, 250));

          const result = await amapEnrichCommunity(row.community_name, row.district);
          if (!result.success) {
            failedCount++;
            results.push({ id: row.id, name: row.community_name, district: row.district, status: 'failed', message: result.message });
            continue;
          }

          const isForceMode = (mode === 'all');
          const isVerifyMode = (mode === 'verify' || mode === 'all');
          const updateFields = [];
          const updateParams = [];
          const changes = [];

          if (result.district && result.district !== row.district) {
            if (isVerifyMode && DISTRICT_ORDER.includes(result.district)) {
              updateFields.push('district = ?');
              updateParams.push(result.district);
              changes.push(`区域: ${row.district} → ${result.district}`);
            }
          }

          if (result.latitude && result.longitude) {
            const oldLat = parseFloat(row.latitude) || 0;
            const oldLng = parseFloat(row.longitude) || 0;
            const newLat = parseFloat(result.latitude);
            const newLng = parseFloat(result.longitude);

            if (oldLat === 0 || oldLng === 0) {
              updateFields.push('latitude = ?, longitude = ?');
              updateParams.push(newLat, newLng);
              changes.push(`坐标: 补充 ${newLat.toFixed(6)},${newLng.toFixed(6)}`);
            } else if (isVerifyMode) {
              const latDiff = Math.abs(oldLat - newLat);
              const lngDiff = Math.abs(oldLng - newLng);
              if (latDiff > COORD_THRESHOLD || lngDiff > COORD_THRESHOLD) {
                updateFields.push('latitude = ?, longitude = ?');
                updateParams.push(newLat, newLng);
                const distMeters = Math.round(Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000);
                changes.push(`坐标偏差${distMeters}m: ${oldLat.toFixed(6)},${oldLng.toFixed(6)} → ${newLat.toFixed(6)},${newLng.toFixed(6)}`);
              }
            } else if (!isVerifyMode) {
              updateFields.push('latitude = ?, longitude = ?');
              updateParams.push(newLat, newLng);
            }
          }

          if (result.metro_station && result.metro_station !== '无') {
            const oldStation = row.nearest_metro_station || '';
            const oldLine = row.nearest_metro_line || '';

            if (!oldStation || oldStation === '无') {
              updateFields.push('nearest_metro_station = ?');
              updateParams.push(result.metro_station);
              if (result.metro_line) {
                updateFields.push('nearest_metro_line = ?');
                updateParams.push(result.metro_line);
              }
              if (result.metro_distance != null) {
                updateFields.push('nearest_metro_distance = ?');
                updateParams.push(result.metro_distance);
              }
              changes.push(`地铁: 补充 ${result.metro_line || ''}/${result.metro_station}`);
            } else {
              if (result.metro_line && !oldLine) {
                updateFields.push('nearest_metro_line = ?');
                updateParams.push(result.metro_line);
                changes.push(`线路: 补充 ${result.metro_line}`);
              }
              if (isForceMode || isVerifyMode) {
                if (result.metro_station !== oldStation && result.metro_line) {
                  updateFields.push('nearest_metro_station = ?');
                  updateParams.push(result.metro_station);
                  changes.push(`站点: ${oldStation} → ${result.metro_station}`);
                }
                if (result.metro_line && result.metro_line !== oldLine && oldLine) {
                  updateFields.push('nearest_metro_line = ?');
                  updateParams.push(result.metro_line);
                  changes.push(`线路: ${oldLine} → ${result.metro_line}`);
                }
                if (result.metro_distance != null) {
                  updateFields.push('nearest_metro_distance = ?');
                  updateParams.push(result.metro_distance);
                }
              }
            }
          }

          if (result.board && (!row.board || row.board === '')) {
            updateFields.push('board = ?');
            updateParams.push(result.board);
            changes.push(`板块: 补充 ${result.board}`);
          }
          if (result.address && (!row.address || row.address === '')) {
            updateFields.push('address = ?');
            updateParams.push(result.address);
          }
          if (result.street && (!row.street || row.street === '')) {
            updateFields.push('street = ?');
            updateParams.push(result.street);
          }

          if (updateFields.length > 0) {
            updateParams.push(row.id);
            await query(`UPDATE property_community_dict SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`, updateParams);
            enrichedCount++;
            results.push({ id: row.id, name: row.community_name, district: row.district, status: 'enriched', fields: updateFields.length, changes: changes.length > 0 ? changes : undefined });
          } else {
            results.push({ id: row.id, name: row.community_name, district: row.district, status: 'no_change' });
          }
        } catch (e) {
          failedCount++;
          results.push({ id: row.id, name: row.community_name, district: row.district, status: 'error', message: e.message });
        }
      }

      return success(res, {
        processed: rows.length,
        enrichedCount,
        failedCount,
        results,
      }, `批量补充完成：处理${rows.length}条，成功${enrichedCount}条，失败${failedCount}条`);
    } catch (err) {
      return error(res, '批量补充失败: ' + err.message, 500);
    }
  }

  /**
   * 单条校对：根据POI数据库校对解析房源的小区信息
   * 更新区域、地铁线路、地铁站点、经纬度等
   */
  async calibrateParsedProperty(req, res) {
    try {
      const { id } = req.params;
      const row = await query(
        'SELECT id, community, district, metro_lines, metro_stations, metro_distance, latitude, longitude FROM wechat_robot_expat_parsed_properties WHERE id = ?',
        [id]
      );
      const prop = Array.isArray(row[0]) ? row[0][0] : row[0];
      if (!prop) return error(res, '记录不存在', 404);
      if (!prop.community) return error(res, '该记录无小区名称，无法校对', 400);

      let poiRows = await query(
        `SELECT community_name, district, nearest_metro_line, nearest_metro_station, nearest_metro_distance, latitude, longitude, board
         FROM property_community_dict
         WHERE community_name = ? AND is_enabled = 1 ORDER BY id LIMIT 5`,
        [prop.community]
      );
      let poiList = Array.isArray(poiRows[0]) ? poiRows[0] : poiRows;

      // POI不存在时，提示管理员手动添加，禁止自动创建
      if (!poiList || poiList.length === 0) return error(res, `POI数据库中未找到小区"${prop.community}"，请先在POI数据中手动添加该小区`, 404);

      const poi = poiList.find(p => p.district === prop.district) || poiList[0];
      const updates = {};
      const changes = [];

      if (poi.district && poi.district !== prop.district) {
        updates.district = poi.district;
        changes.push(`区域: ${prop.district || '空'} → ${poi.district}`);
      }
      if (poi.nearest_metro_station && poi.nearest_metro_station !== '无') {
        if (poi.nearest_metro_station !== prop.metro_stations) {
          updates.metro_stations = poi.nearest_metro_station;
          changes.push(`地铁站: ${prop.metro_stations || '空'} → ${poi.nearest_metro_station}`);
        }
        if (poi.nearest_metro_line && poi.nearest_metro_line !== prop.metro_lines) {
          updates.metro_lines = poi.nearest_metro_line;
          changes.push(`地铁线: ${prop.metro_lines || '空'} → ${poi.nearest_metro_line}`);
        }
        if (poi.nearest_metro_distance && poi.nearest_metro_distance !== prop.metro_distance) {
          updates.metro_distance = poi.nearest_metro_distance;
        }
      }
      if (poi.latitude && poi.longitude && poi.latitude !== 0) {
        const poiLat = parseFloat(poi.latitude);
        const poiLng = parseFloat(poi.longitude);
        const propLat = parseFloat(prop.latitude) || 0;
        const propLng = parseFloat(prop.longitude) || 0;
        if (Math.abs(poiLat - propLat) > 0.0001 || Math.abs(poiLng - propLng) > 0.0001) {
          updates.latitude = poiLat;
          updates.longitude = poiLng;
          changes.push(`坐标已更新`);
        }
      }

      if (Object.keys(updates).length === 0) {
        return success(res, { changed: false, message: '数据已与POI一致，无需更新' });
      }

      updates.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const vals = [...Object.values(updates), id];
      await query(`UPDATE wechat_robot_expat_parsed_properties SET ${setClauses} WHERE id = ?`, vals);

      return success(res, { changed: true, changes, updates });
    } catch (err) {
      logger.error('校对解析房源失败', { error: err.message, id: req.params.id });
      return error(res, '校对失败: ' + err.message, 500);
    }
  }

  /**
   * 批量校对：根据POI数据库批量校对解析房源的小区信息
   */
  async batchCalibrateParsedProperties(req, res) {
    try {
      const { ids, mode, district, limit: batchLimit } = req.body;
      let targetIds = [];

      if (ids && Array.isArray(ids) && ids.length > 0) {
        targetIds = ids;
      } else {
        let sql = `SELECT p.id FROM wechat_robot_expat_parsed_properties p
          INNER JOIN property_community_dict poi ON poi.community_name = p.community AND poi.is_enabled = 1
          WHERE p.community IS NOT NULL AND p.community != '' AND p.deleted_at IS NULL AND (`;

        const conditions = [];
        if (mode === 'missing_metro') {
          conditions.push(`(p.metro_stations IS NULL OR p.metro_stations = '') AND poi.nearest_metro_station IS NOT NULL AND poi.nearest_metro_station != '' AND poi.nearest_metro_station != '无'`);
        } else if (mode === 'missing_coords') {
          conditions.push(`(p.latitude IS NULL OR p.latitude = 0) AND poi.latitude IS NOT NULL AND poi.latitude != 0`);
        } else if (mode === 'district_mismatch') {
          conditions.push(`p.district != poi.district`);
        } else {
          conditions.push(
            `((p.metro_stations IS NULL OR p.metro_stations = '') AND poi.nearest_metro_station IS NOT NULL AND poi.nearest_metro_station != '' AND poi.nearest_metro_station != '无')`,
            `((p.latitude IS NULL OR p.latitude = 0) AND poi.latitude IS NOT NULL AND poi.latitude != 0)`,
            `(p.district != poi.district AND poi.district IS NOT NULL AND poi.district != '')`
          );
        }
        sql += conditions.join(' OR ') + ')';

        if (district) {
          sql += ` AND p.district = ${query.escape ? "'" + district + "'" : "'" + district.replace(/'/g, "''") + "'"}`;
        }
        sql += ` GROUP BY p.id ORDER BY p.id DESC LIMIT ${parseInt(batchLimit, 10) || 500}`;

        const rows = await query(sql);
        const list = Array.isArray(rows[0]) ? rows[0] : rows;
        targetIds = list.map(r => r.id);
      }

      if (targetIds.length === 0) {
        return success(res, { total: 0, updated: 0, message: '没有找到需要校对的记录（缺少POI的小区请先在POI数据中手动添加）' });
      }

      let updated = 0, skipped = 0;
      const BATCH = 100;
      for (let i = 0; i < targetIds.length; i += BATCH) {
        const batch = targetIds.slice(i, i + BATCH);
        const placeholders = batch.map(() => '?').join(',');

        const rows = await query(
          `SELECT p.id, p.community, p.district, p.metro_lines, p.metro_stations, p.metro_distance, p.latitude, p.longitude,
            poi.district AS poi_district, poi.nearest_metro_line AS poi_metro_line, poi.nearest_metro_station AS poi_metro_station,
            poi.nearest_metro_distance AS poi_metro_distance, poi.latitude AS poi_lat, poi.longitude AS poi_lng
          FROM wechat_robot_expat_parsed_properties p
          INNER JOIN property_community_dict poi ON poi.community_name = p.community AND poi.is_enabled = 1
          WHERE p.id IN (${placeholders})
          GROUP BY p.id`,
          batch
        );
        const list = Array.isArray(rows[0]) ? rows[0] : rows;

        for (const r of list) {
          const u = {};
          if (r.poi_district && r.poi_district !== r.district) u.district = r.poi_district;
          if (r.poi_metro_station && r.poi_metro_station !== '无' && r.poi_metro_station !== r.metro_stations) u.metro_stations = r.poi_metro_station;
          if (r.poi_metro_line && r.poi_metro_line !== r.metro_lines) u.metro_lines = r.poi_metro_line;
          if (r.poi_metro_distance && r.poi_metro_distance !== r.metro_distance) u.metro_distance = r.poi_metro_distance;
          const poiLat = parseFloat(r.poi_lat) || 0;
          const poiLng = parseFloat(r.poi_lng) || 0;
          const propLat = parseFloat(r.latitude) || 0;
          const propLng = parseFloat(r.longitude) || 0;
          if (poiLat > 0 && (Math.abs(poiLat - propLat) > 0.0001 || Math.abs(poiLng - propLng) > 0.0001)) {
            u.latitude = poiLat;
            u.longitude = poiLng;
          }
          if (Object.keys(u).length === 0) { skipped++; continue; }
          u.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const set = Object.keys(u).map(k => `${k} = ?`).join(', ');
          await query(`UPDATE wechat_robot_expat_parsed_properties SET ${set} WHERE id = ?`, [...Object.values(u), r.id]);
          updated++;
        }
      }

      return success(res, {
        total: targetIds.length,
        updated,
        skipped,
        message: `校对完成：共${targetIds.length}条，更新${updated}条，无需更新${skipped}条`
      });
    } catch (err) {
      logger.error('批量校对失败', { error: err.message });
      return error(res, '批量校对失败: ' + err.message, 500);
    }
  }

  /**
   * 获取可校对的统计信息
   */
  async getCalibrateStats(req, res) {
    try {
      const result = await query(`
        SELECT
          COUNT(DISTINCT p.id) as total_with_community,
          COUNT(DISTINCT CASE WHEN (p.metro_stations IS NULL OR p.metro_stations = '') AND poi.nearest_metro_station IS NOT NULL AND poi.nearest_metro_station != '' AND poi.nearest_metro_station != '无' THEN p.id END) as missing_metro,
          COUNT(DISTINCT CASE WHEN (p.latitude IS NULL OR p.latitude = 0) AND poi.latitude IS NOT NULL AND poi.latitude != 0 THEN p.id END) as missing_coords
        FROM wechat_robot_expat_parsed_properties p
        INNER JOIN property_community_dict poi ON poi.community_name = p.community AND poi.is_enabled = 1
        WHERE p.community IS NOT NULL AND p.community != '' AND p.deleted_at IS NULL
      `);
      const districtResult = await query(`
        SELECT COUNT(*) as district_mismatch
        FROM wechat_robot_expat_parsed_properties p
        WHERE p.community IS NOT NULL AND p.community != '' AND p.deleted_at IS NULL
          AND p.district IS NOT NULL AND p.district != ''
          AND NOT EXISTS (
            SELECT 1 FROM property_community_dict poi
            WHERE poi.community_name = p.community AND poi.is_enabled = 1 AND poi.district = p.district
          )
          AND EXISTS (
            SELECT 1 FROM property_community_dict poi
            WHERE poi.community_name = p.community AND poi.is_enabled = 1
          )
      `);
      // 统计缺少POI记录的房源数量
      const noPOIResult = await query(`
        SELECT COUNT(DISTINCT p.community) as missing_poi_communities,
               COUNT(DISTINCT p.id) as missing_poi_properties
        FROM wechat_robot_expat_parsed_properties p
        LEFT JOIN property_community_dict poi ON poi.community_name = p.community AND poi.is_enabled = 1
        WHERE p.community IS NOT NULL AND p.community != '' AND p.deleted_at IS NULL
          AND poi.id IS NULL
      `);
      const row = Array.isArray(result[0]) ? result[0][0] : result[0];
      const distRow = Array.isArray(districtResult[0]) ? districtResult[0][0] : districtResult[0];
      const noPOIRow = Array.isArray(noPOIResult[0]) ? noPOIResult[0][0] : noPOIResult[0];
      const missingMetro = Number(row?.missing_metro || 0);
      const missingCoords = Number(row?.missing_coords || 0);
      const districtMismatch = Number(distRow?.district_mismatch || 0);
      const missingPOICommunities = Number(noPOIRow?.missing_poi_communities || 0);
      const missingPOIProperties = Number(noPOIRow?.missing_poi_properties || 0);
      return success(res, {
        total_with_community: Number(row?.total_with_community || 0),
        missing_metro: missingMetro,
        missing_coords: missingCoords,
        district_mismatch: districtMismatch,
        missing_poi_communities: missingPOICommunities,
        missing_poi_properties: missingPOIProperties,
        total_calibratable: missingMetro + missingCoords + districtMismatch + missingPOIProperties,
      });
    } catch (err) {
      logger.error('获取校对统计失败', { error: err.message });
      return error(res, '获取统计失败', 500);
    }
  }
}

/**
 * 高德地图综合查询：通过小区名获取经纬度+区域+地址+周边地铁
 * 多轮搜索策略保证准确率：
 *   第1轮：纯小区名 POI 搜索（宽类型，不带区域限制）
 *   第2轮：带区域前缀 POI 搜索（如有区域信息）
 *   第3轮：纯小区名地理编码
 *   第4轮：带区域地理编码
 * 每轮结果通过名称相似度评分，选最佳匹配
 */
async function amapEnrichCommunity(communityName, existingDistrict) {
  const [settings] = await query('SELECT api_key FROM system_map_settings WHERE is_enabled = 1 LIMIT 1');
  if (!settings?.api_key) return { success: false, message: 'API密钥未配置' };
  const apiKey = settings.api_key;

  function safeStr(val) {
    if (!val || Array.isArray(val)) return '';
    return typeof val === 'string' ? val.trim() : String(val).trim();
  }

  // 名称相似度评分：完全匹配>包含>部分匹配
  function nameScore(poiName, target) {
    if (!poiName || !target) return 0;
    const a = poiName.toLowerCase().replace(/\s+/g, '');
    const b = target.toLowerCase().replace(/\s+/g, '');
    if (a === b) return 100;
    if (a.includes(b) || b.includes(a)) return 80;
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    let matches = 0;
    for (const ch of shorter) { if (longer.includes(ch)) matches++; }
    return Math.round((matches / longer.length) * 60);
  }

  const result = { success: false };
  let location = null;

  // 宽类型：住宅+商业+写字楼+酒店+公寓
  const WIDE_TYPES = '120000|120100|120200|120300|120201|120302|060000|060100|100000|100100';

  async function poiSearch(keyword) {
    try {
      return await amapRequest(
        `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(keyword)}&types=${WIDE_TYPES}&city=上海&citylimit=true&offset=10&output=JSON`
      );
    } catch { return null; }
  }

  async function geoSearch(addr) {
    try {
      return await amapRequest(
        `https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${encodeURIComponent(addr)}&city=上海`
      );
    } catch { return null; }
  }

  function extractFromPOI(poi) {
    const loc = safeStr(poi.location);
    if (!loc) return null;
    const [lng, lat] = loc.split(',').map(Number);
    if (!(lat > 30 && lat < 32 && lng > 120 && lng < 123)) return null;
    const info = { latitude: lat, longitude: lng, location: loc };
    const adname = safeStr(poi.adname);
    if (adname) info.district = adname;
    const addr = safeStr(poi.address);
    if (addr && addr.length > 2) {
      info.address = addr;
      const sm = addr.match(/([^\s,，]+路\d*弄?)/);
      if (sm) info.street = sm[1];
    }
    const biz = safeStr(poi.business);
    if (biz) info.board = biz.split(';')[0];
    info.score = nameScore(poi.name, communityName);
    return info;
  }

  // === 多轮搜索 ===
  let bestCandidate = null;

  // 第1轮：纯小区名 POI 搜索
  const data1 = await poiSearch(`上海${communityName}`);
  if (data1?.status === '1' && data1.pois?.length > 0) {
    for (const p of data1.pois) {
      const c = extractFromPOI(p);
      if (c && (!bestCandidate || c.score > bestCandidate.score)) bestCandidate = c;
      if (c?.score === 100) break;
    }
  }

  // 第2轮：带区域 POI 搜索（如果第1轮无完美匹配且有区域信息）
  if ((!bestCandidate || bestCandidate.score < 100) && existingDistrict) {
    const data2 = await poiSearch(`上海${existingDistrict}${communityName}`);
    if (data2?.status === '1' && data2.pois?.length > 0) {
      for (const p of data2.pois) {
        const c = extractFromPOI(p);
        if (c && (!bestCandidate || c.score > bestCandidate.score)) bestCandidate = c;
        if (c?.score === 100) break;
      }
    }
  }

  // 第3轮：地理编码（纯小区名）— 验证返回地址与小区名的相关性
  if (!bestCandidate || bestCandidate.score < 60) {
    const geo1 = await geoSearch(`上海市${communityName}`);
    if (geo1?.status === '1' && geo1.geocodes?.[0]) {
      const geo = geo1.geocodes[0];
      const fa = safeStr(geo.formatted_address);
      const geoScore = nameScore(fa, communityName);
      // 地理编码结果必须与搜索名有最低相关性（>20），防止返回完全无关的地点
      if (geoScore > 20) {
        const loc = safeStr(geo.location);
        if (loc) {
          const [lng, lat] = loc.split(',').map(Number);
          if (lat > 30 && lat < 32 && lng > 120 && lng < 123) {
            const c = { latitude: lat, longitude: lng, location: loc, score: geoScore };
            const dist = safeStr(geo.district);
            if (dist) c.district = dist;
            const st = safeStr(geo.street);
            if (st) c.street = st;
            const nbName = safeStr(geo.neighborhood?.name);
            if (nbName) c.board = nbName;
            if (!bestCandidate || c.score > bestCandidate.score) bestCandidate = c;
          }
        }
      }
    }
  }

  // 第4轮：带区域地理编码 — 同样验证相关性
  if (!bestCandidate && existingDistrict) {
    const geo2 = await geoSearch(`上海市${existingDistrict}${communityName}`);
    if (geo2?.status === '1' && geo2.geocodes?.[0]) {
      const geo = geo2.geocodes[0];
      const fa = safeStr(geo.formatted_address);
      const geoScore = nameScore(fa, communityName);
      if (geoScore > 20) {
        const loc = safeStr(geo.location);
        if (loc) {
          const [lng, lat] = loc.split(',').map(Number);
          if (lat > 30 && lat < 32 && lng > 120 && lng < 123) {
            const c = { latitude: lat, longitude: lng, location: loc, score: geoScore };
            const dist = safeStr(geo.district);
            if (dist) c.district = dist;
            const st = safeStr(geo.street);
            if (st) c.street = st;
            if (!bestCandidate) bestCandidate = c;
          }
        }
      }
    }
  }

  if (!bestCandidate) {
    return { success: false, message: `高德地图未找到「${communityName}」，请手动填写信息` };
  }

  if (bestCandidate.latitude) result.latitude = bestCandidate.latitude;
  if (bestCandidate.longitude) result.longitude = bestCandidate.longitude;
  if (bestCandidate.district) result.district = bestCandidate.district;
  if (bestCandidate.address) result.address = bestCandidate.address;
  if (bestCandidate.street) result.street = bestCandidate.street;
  if (bestCandidate.board) result.board = bestCandidate.board;
  location = bestCandidate.location;

  // 第5步：用坐标搜索周边最近地铁站（3km，按距离排序取最近）
  if (location) {
    try {
      const metroData = await amapRequest(
        `https://restapi.amap.com/v3/place/around?key=${apiKey}&location=${location}&types=150500&radius=3000&offset=20&output=JSON&sortrule=distance`
      );
      if (metroData?.status === '1' && metroData.pois?.length > 0) {
        const stations = metroData.pois.filter(p => p.typecode === '150500');
        if (stations.length > 0) {
          // 直接取距离最近的站点，不做区域偏好（避免错误区域干扰）
          const chosen = stations[0];

          const rawStation = chosen.name
            .replace(/\d+号口$/g, '')
            .replace(/[（(]地铁站[）)]/g, '')
            .replace(/地铁站$/g, '')
            .replace(/^(一大会址[·.]?)/, '')
            .replace(/^支线/, '')
            .trim();

          let rawLines = '';
          if (chosen.address && typeof chosen.address === 'string') {
            const lineMatches = chosen.address.match(/(\d+号线|浦江线|磁浮线)/g);
            if (lineMatches) rawLines = [...new Set(lineMatches)].join(',');
          }

          const matched = await matchStandardMetroStation(rawStation, rawLines);
          result.metro_station = matched.station;
          result.metro_line = matched.line;
          result.metro_distance = chosen.distance ? parseInt(chosen.distance, 10) : null;
        }
      }
    } catch { /* 地铁搜索失败不阻塞 */ }
  }

  result.success = true;
  return result;
}

/**
 * 将高德返回的地铁站名与后台标准站点数据匹配
 * 确保站名和线路格式与 property_metro_stations / property_metro_lines 一致
 * 匹配策略：精确匹配 → 去"站"后缀匹配 → 模糊匹配 → 原始名称
 */
async function matchStandardMetroStation(rawStation, rawLines) {
  try {
    const cleanedStation = rawStation.replace(/站$/, '');

    const stdStations = await query(
      `SELECT ms.name_cn AS station_name, ml.name_cn AS line_name
       FROM property_metro_stations ms
       JOIN property_metro_lines ml ON ms.line_id = ml.id
       WHERE ms.name_cn = ? OR ms.name_cn = ? OR ms.name_cn LIKE ? OR ms.name_cn LIKE ?
       ORDER BY ms.name_cn = ? DESC, ms.name_cn = ? DESC, LENGTH(ms.name_cn) ASC`,
      [rawStation, cleanedStation, `%${cleanedStation}%`, `%${rawStation}%`, rawStation, cleanedStation]
    );

    if (stdStations.length > 0) {
      const exactMatch = stdStations.find(s => s.station_name === rawStation);
      if (exactMatch) {
        const lineNames = [...new Set(stdStations.filter(s => s.station_name === rawStation).map(s => s.line_name))].join(',');
        return { station: rawStation, line: lineNames };
      }
      const cleanMatch = stdStations.find(s => s.station_name === cleanedStation);
      if (cleanMatch) {
        const lineNames = [...new Set(stdStations.filter(s => s.station_name === cleanedStation).map(s => s.line_name))].join(',');
        return { station: cleanedStation, line: lineNames };
      }
      const station = stdStations[0].station_name;
      const sameNameMatches = stdStations.filter(s => s.station_name === station);
      const lineNames = [...new Set(sameNameMatches.map(s => s.line_name))].join(',');
      return { station, line: lineNames };
    }

    return { station: cleanedStation !== rawStation ? cleanedStation : rawStation, line: rawLines || null };
  } catch {
    return { station: rawStation, line: rawLines || null };
  }
}

/**
 * 高德地图HTTP请求封装（Promise化）
 */
function amapRequest(url) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

/**
 * 异步地理编码：新增或编辑POI时自动补充经纬度
 */
async function autoGeocodePOI(communityName, district, address) {
  try {
    const [settings] = await query('SELECT api_key FROM system_map_settings WHERE is_enabled = 1 LIMIT 1');
    if (!settings?.api_key) return;

    const https = require('https');
    const addr = address || `上海市${district || ''}${communityName}`;
    const url = `https://restapi.amap.com/v3/geocode/geo?key=${settings.api_key}&address=${encodeURIComponent(addr)}&city=上海`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === '1' && json.geocodes?.[0]?.location) {
            const [lng, lat] = json.geocodes[0].location.split(',').map(Number);
            if (lat > 30 && lat < 32 && lng > 120 && lng < 123) {
              query(
                'UPDATE property_community_dict SET latitude = ?, longitude = ?, updated_at = NOW() WHERE community_name = ? AND district = ? AND (latitude IS NULL OR latitude = 0)',
                [lat, lng, communityName, district]
              ).catch(() => {});
            }
          }
        } catch { /* 地理编码失败不阻塞 */ }
      });
    }).on('error', () => {});
  } catch { /* 不阻塞主流程 */ }
}

const logger = require('../../utils/logger');

// ============ 包租公司名单管理 ============

function _invalidateRentalCache() {
  try {
    const ctrl = require('../user/WeChatRobotPluginController');
    if (ctrl && ctrl.invalidateRentalCompanyCache) ctrl.invalidateRentalCompanyCache();
  } catch {}
}

class RentalCompanyController {
  async getList(req, res) {
    try {
      const { keyword, page = 1, per_page = 100 } = req.query;
      let sql = 'SELECT * FROM rental_companies WHERE 1=1';
      const params = [];
      if (keyword) {
        sql += ' AND (name LIKE ? OR alias_names LIKE ? OR remark LIKE ?)';
        const kw = `%${keyword}%`;
        params.push(kw, kw, kw);
      }
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as cnt');
      const countRows = await query(countSql, params);
      const total = (Array.isArray(countRows[0]) ? countRows[0][0] : countRows[0])?.cnt || 0;

      sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      const limit = parseInt(per_page, 10) || 100;
      const offset = (Math.max(1, parseInt(page, 10)) - 1) * limit;
      params.push(limit, offset);

      const rows = await query(sql, params);
      const data = Array.isArray(rows[0]) ? rows[0] : rows;
      return success(res, { list: data || [], total, page: parseInt(page, 10), per_page: limit });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async save(req, res) {
    try {
      const { id, name, alias_names, remark, is_enabled } = req.body;
      if (!name || !name.trim()) return error(res, '公司名称不能为空');
      const trimmedName = name.trim();

      if (id) {
        await query(
          'UPDATE rental_companies SET name = ?, alias_names = ?, remark = ?, is_enabled = ?, updated_at = NOW() WHERE id = ?',
          [trimmedName, alias_names || null, remark || null, is_enabled ?? 1, id]
        );
      } else {
        const existing = await query('SELECT id FROM rental_companies WHERE name = ?', [trimmedName]);
        const existRows = Array.isArray(existing[0]) ? existing[0] : existing;
        if (existRows && existRows.length > 0) return error(res, `"${trimmedName}"已存在`);
        await query(
          'INSERT INTO rental_companies (name, alias_names, remark, is_enabled) VALUES (?, ?, ?, ?)',
          [trimmedName, alias_names || null, remark || null, is_enabled ?? 1]
        );
      }
      _invalidateRentalCache();
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async remove(req, res) {
    try {
      await query('DELETE FROM rental_companies WHERE id = ?', [req.params.id]);
      _invalidateRentalCache();
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async batchImport(req, res) {
    try {
      const { names } = req.body;
      if (!names || !names.trim()) return error(res, '请提供公司名称列表');
      const nameList = names.split(/[,，\n\r;；|]+/).map(n => n.trim()).filter(n => n.length >= 2);
      if (nameList.length === 0) return error(res, '未识别到有效名称');

      let inserted = 0;
      let skipped = 0;
      for (const name of nameList) {
        try {
          await query('INSERT IGNORE INTO rental_companies (name) VALUES (?)', [name]);
          inserted++;
        } catch {
          skipped++;
        }
      }
      _invalidateRentalCache();
      return success(res, { inserted, skipped, total: nameList.length }, `成功导入${inserted}条，跳过${skipped}条重复`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async batchDelete(req, res) {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) return error(res, '请选择要删除的记录');
      await query('DELETE FROM rental_companies WHERE id IN (?)', [ids]);
      _invalidateRentalCache();
      return success(res, { deleted: ids.length }, `已删除${ids.length}条`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /** 获取所有启用的包租公司名（含别名），供解析逻辑使用 */
  static async getAllNames() {
    try {
      const rows = await query('SELECT name, alias_names FROM rental_companies WHERE is_enabled = 1');
      const data = Array.isArray(rows[0]) ? rows[0] : rows;
      const names = new Set();
      if (data) {
        for (const row of data) {
          if (row.name) names.add(row.name.trim());
          if (row.alias_names) {
            row.alias_names.split(/[,，;；|]+/).forEach(a => {
              const t = a.trim();
              if (t.length >= 2) names.add(t);
            });
          }
        }
      }
      return names;
    } catch {
      return new Set();
    }
  }
}

const rentalCompanyCtrl = new RentalCompanyController();

const PUBLISHER_CONTACT_TABLE = 'publisher_contact_directory';

async function ensurePublisherContactTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS ${PUBLISHER_CONTACT_TABLE} (
      id BIGINT NOT NULL AUTO_INCREMENT,
      publisher_name VARCHAR(120) NOT NULL,
      contact_info VARCHAR(255) NULL,
      remark VARCHAR(255) NULL,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_publisher_name (publisher_name),
      KEY idx_enabled_name (is_enabled, publisher_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function extractContactFromPublisherName(publisherName) {
  const text = String(publisherName || '').trim();
  if (!text) return '';
  const phoneMatch = text.match(/1[3-9]\d{9}/);
  if (phoneMatch) return phoneMatch[0];
  return '';
}

function buildPublisherSourceSql() {
  return `
    SELECT
      COALESCE(NULLIF(TRIM(p.publisher_name), ''), NULLIF(TRIM(m.owner_nickname), ''), NULLIF(TRIM(m2.owner_nickname), '')) AS publisher_name,
      NULLIF(TRIM(p.contact_info), '') AS contact_info,
      p.id AS parsed_id
    FROM wechat_robot_expat_parsed_properties p
    LEFT JOIN wechat_robot_expat_properties op ON p.property_id = op.id
    LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
    LEFT JOIN wechat_robot_moments m2 ON op.moment_id = m2.moment_id AND p.moment_id IS NULL
    WHERE p.deleted_at IS NULL
  `;
}

async function syncPublisherContactsFromParsed() {
  await ensurePublisherContactTable();
  const sourceSql = buildPublisherSourceSql();
  const rows = await query(`
    SELECT publisher_name,
           NULLIF(SUBSTRING_INDEX(MAX(CONCAT(LPAD(parsed_id, 12, '0'), '|', COALESCE(contact_info, ''))), '|', -1), '') AS contact_info
    FROM (${sourceSql}) src
    WHERE publisher_name IS NOT NULL AND publisher_name != ''
    GROUP BY publisher_name
  `);
  const data = Array.isArray(rows[0]) ? rows[0] : rows;
  let affected = 0;
  for (const row of (data || [])) {
    const publisherName = String(row.publisher_name || '').trim();
    if (!publisherName) continue;
    const derivedContact = String(row.contact_info || '').trim() || extractContactFromPublisherName(publisherName);
    const result = await query(
      `INSERT INTO ${PUBLISHER_CONTACT_TABLE} (publisher_name, contact_info, remark, is_enabled, created_at, updated_at)
       VALUES (?, ?, NULL, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         contact_info = CASE
           WHEN VALUES(contact_info) IS NULL OR VALUES(contact_info) = '' THEN ${PUBLISHER_CONTACT_TABLE}.contact_info
           WHEN ${PUBLISHER_CONTACT_TABLE}.contact_info IS NULL OR ${PUBLISHER_CONTACT_TABLE}.contact_info = '' THEN VALUES(contact_info)
           WHEN ${PUBLISHER_CONTACT_TABLE}.remark IS NULL OR ${PUBLISHER_CONTACT_TABLE}.remark = '' THEN VALUES(contact_info)
           ELSE ${PUBLISHER_CONTACT_TABLE}.contact_info
         END,
         remark = CASE
           WHEN ${PUBLISHER_CONTACT_TABLE}.remark IS NULL OR ${PUBLISHER_CONTACT_TABLE}.remark = '' THEN NULL
           ELSE ${PUBLISHER_CONTACT_TABLE}.remark
         END,
         is_enabled = 1,
         updated_at = NOW()`,
      [publisherName, derivedContact || null]
    );
    affected += result?.affectedRows || 0;
  }

  return { total: (data || []).length, affected };
}

class PublisherContactController {
  async getList(req, res) {
    try {
      await ensurePublisherContactTable();
      const tableCountRows = await query(`SELECT COUNT(*) AS total FROM ${PUBLISHER_CONTACT_TABLE}`);
      const tableCount = (Array.isArray(tableCountRows[0]) ? tableCountRows[0][0] : tableCountRows[0])?.total || 0;
      if (!tableCount) {
        await syncPublisherContactsFromParsed();
      }
      const { keyword, page = 1, per_page = 100, contact_status } = req.query;
      let sql = `SELECT * FROM ${PUBLISHER_CONTACT_TABLE} WHERE 1=1`;
      const params = [];
      if (keyword) {
        sql += ' AND (publisher_name LIKE ? OR contact_info LIKE ? OR remark LIKE ?)';
        const kw = `%${keyword}%`;
        params.push(kw, kw, kw);
      }
      if (contact_status === 'empty') {
        sql += ` AND (contact_info IS NULL OR TRIM(contact_info) = '')`;
      } else if (contact_status === 'filled') {
        sql += ` AND (contact_info IS NOT NULL AND TRIM(contact_info) != '')`;
      }
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as cnt');
      const countRows = await query(countSql, params);
      const total = (Array.isArray(countRows[0]) ? countRows[0][0] : countRows[0])?.cnt || 0;

      sql += ' ORDER BY is_enabled DESC, updated_at DESC, id DESC LIMIT ? OFFSET ?';
      const limit = parseInt(per_page, 10) || 100;
      const offset = (Math.max(1, parseInt(page, 10)) - 1) * limit;
      params.push(limit, offset);

      const rows = await query(sql, params);
      const data = Array.isArray(rows[0]) ? rows[0] : rows;
      return success(res, { list: data || [], total, page: parseInt(page, 10), per_page: limit });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async save(req, res) {
    try {
      await ensurePublisherContactTable();
      const { id, publisher_name, contact_info, remark, is_enabled } = req.body;
      const trimmedName = String(publisher_name || '').trim();
      if (!trimmedName) return error(res, '发布人昵称不能为空');

      const normalizedContact = String(contact_info || '').trim();
      const normalizedRemark = String(remark || '').trim();

      if (id) {
        await query(
          `UPDATE ${PUBLISHER_CONTACT_TABLE}
           SET publisher_name = ?, contact_info = ?, remark = ?, is_enabled = ?, updated_at = NOW()
           WHERE id = ?`,
          [trimmedName, normalizedContact || null, normalizedRemark || null, is_enabled ?? 1, id]
        );
      } else {
        const existing = await query(`SELECT id FROM ${PUBLISHER_CONTACT_TABLE} WHERE publisher_name = ?`, [trimmedName]);
        const existRows = Array.isArray(existing[0]) ? existing[0] : existing;
        if (existRows && existRows.length > 0) return error(res, `"${trimmedName}" 已存在`);
        await query(
          `INSERT INTO ${PUBLISHER_CONTACT_TABLE} (publisher_name, contact_info, remark, is_enabled)
           VALUES (?, ?, ?, ?)`,
          [trimmedName, normalizedContact || null, normalizedRemark || null, is_enabled ?? 1]
        );
      }

      return success(res, null, '保存成功');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return error(res, '该发布人昵称已存在');
      return error(res, err.message, 500);
    }
  }

  async remove(req, res) {
    try {
      await ensurePublisherContactTable();
      await query(`DELETE FROM ${PUBLISHER_CONTACT_TABLE} WHERE id = ?`, [req.params.id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async batchImport(req, res) {
    try {
      await ensurePublisherContactTable();
      const { items, names } = req.body;
      let rows = Array.isArray(items) ? items : [];

      if (rows.length === 0 && names && String(names).trim()) {
        rows = String(names)
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const parts = line.split(/\t|,|，/).map(part => part.trim());
            return {
              publisher_name: parts[0] || '',
              contact_info: parts[1] || '',
              remark: parts.slice(2).join(' ')
            };
          });
      }

      if (!rows.length) return error(res, '请提供要导入的联系人数据');

      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      for (const item of rows) {
        const publisherName = String(item?.publisher_name || item?.name || '').trim();
        const contactInfo = String(item?.contact_info || item?.contact || '').trim();
        const remark = String(item?.remark || '').trim();
        if (!publisherName) {
          skipped++;
          continue;
        }

        const existing = await query(`SELECT id FROM ${PUBLISHER_CONTACT_TABLE} WHERE publisher_name = ? LIMIT 1`, [publisherName]);
        const existRows = Array.isArray(existing[0]) ? existing[0] : existing;
        if (existRows && existRows.length > 0) {
          await query(
            `UPDATE ${PUBLISHER_CONTACT_TABLE}
             SET contact_info = ?, remark = ?, is_enabled = 1, updated_at = NOW()
             WHERE id = ?`,
            [contactInfo || null, remark || null, existRows[0].id]
          );
          updated++;
        } else {
          await query(
            `INSERT INTO ${PUBLISHER_CONTACT_TABLE} (publisher_name, contact_info, remark, is_enabled)
             VALUES (?, ?, ?, 1)`,
            [publisherName, contactInfo || null, remark || null]
          );
          inserted++;
        }
      }

      return success(res, { inserted, updated, skipped, total: rows.length }, `导入完成：新增${inserted}条，更新${updated}条`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async batchDelete(req, res) {
    try {
      await ensurePublisherContactTable();
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) return error(res, '请选择要删除的记录');
      await query(`DELETE FROM ${PUBLISHER_CONTACT_TABLE} WHERE id IN (?)`, [ids]);
      return success(res, { deleted: ids.length }, `已删除${ids.length}条`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async syncFromParsed(req, res) {
    try {
      const result = await syncPublisherContactsFromParsed();
      return success(res, result, `已同步 ${result.total} 位发布人联系人`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

const publisherContactCtrl = new PublisherContactController();

/* ==================== 地理别名映射管理 ==================== */
const ALIAS_TABLE = 'district_alias_dict';
const ALIAS_TYPES = ['landmark', 'road', 'metro', 'area'];

class DistrictAliasController {
  async getList(req, res) {
    try {
      const { page = 1, pageSize = 50, search, type, district } = req.query;
      const offset = (Math.max(1, +page) - 1) * +pageSize;
      let where = '1=1';
      const params = [];
      if (search) { where += ' AND alias_name LIKE ?'; params.push(`%${search}%`); }
      if (type) { where += ' AND alias_type = ?'; params.push(type); }
      if (district) { where += ' AND district = ?'; params.push(district); }
      const countRows = await query(`SELECT COUNT(*) as total FROM ${ALIAS_TABLE} WHERE ${where}`, params);
      const total = (Array.isArray(countRows[0]) ? countRows[0] : countRows)[0]?.total || 0;
      const rows = await query(
        `SELECT * FROM ${ALIAS_TABLE} WHERE ${where} ORDER BY alias_type, district, priority DESC, alias_name LIMIT ? OFFSET ?`,
        [...params, +pageSize, offset]
      );
      const data = Array.isArray(rows[0]) ? rows[0] : rows;
      const statsRows = await query(
        `SELECT alias_type, COUNT(*) as cnt FROM ${ALIAS_TABLE} WHERE is_enabled=1 GROUP BY alias_type`
      );
      const statsData = Array.isArray(statsRows[0]) ? statsRows[0] : statsRows;
      const stats = {};
      let statsTotal = 0;
      if (statsData) statsData.forEach(r => { stats[r.alias_type] = r.cnt; statsTotal += r.cnt; });
      stats.total = statsTotal;
      return success(res, { data: data || [], total, stats });
    } catch (err) {
      return error(res, '获取列表失败: ' + err.message, 500);
    }
  }

  async save(req, res) {
    try {
      const { id, alias_name, alias_type, district, priority, is_enabled, remark } = req.body;
      if (!alias_name?.trim()) return error(res, '别名不能为空', 400);
      if (!ALIAS_TYPES.includes(alias_type)) return error(res, '无效的类型', 400);
      if (!district?.trim()) return error(res, '区域不能为空', 400);
      const name = alias_name.trim();
      const dist = district.trim();
      if (id) {
        await query(
          `UPDATE ${ALIAS_TABLE} SET alias_name=?, alias_type=?, district=?, priority=?, is_enabled=?, remark=? WHERE id=?`,
          [name, alias_type, dist, priority || 0, is_enabled !== undefined ? (is_enabled ? 1 : 0) : 1, remark || null, id]
        );
        return success(res, { id }, '保存成功');
      }
      const result = await query(
        `INSERT INTO ${ALIAS_TABLE} (alias_name, alias_type, district, priority, is_enabled, remark) VALUES (?,?,?,?,?,?)`,
        [name, alias_type, dist, priority || 0, is_enabled !== undefined ? (is_enabled ? 1 : 0) : 1, remark || null]
      );
      return success(res, { id: result.insertId }, '添加成功');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return error(res, '该别名+类型+区域已存在', 400);
      return error(res, '保存失败: ' + err.message, 500);
    }
  }

  async remove(req, res) {
    try {
      await query(`DELETE FROM ${ALIAS_TABLE} WHERE id=?`, [req.params.id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, '删除失败: ' + err.message, 500);
    }
  }

  async batchDelete(req, res) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || !ids.length) return error(res, '请选择要删除的数据', 400);
      await query(`DELETE FROM ${ALIAS_TABLE} WHERE id IN (?)`, [ids]);
      return success(res, null, `已删除 ${ids.length} 条`);
    } catch (err) {
      return error(res, '批量删除失败: ' + err.message, 500);
    }
  }

  async batchImport(req, res) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || !items.length) return error(res, '无导入数据', 400);
      let added = 0;
      for (const item of items) {
        if (!item.alias_name?.trim() || !item.district?.trim()) continue;
        const t = ALIAS_TYPES.includes(item.alias_type) ? item.alias_type : 'landmark';
        try {
          await query(
            `INSERT IGNORE INTO ${ALIAS_TABLE} (alias_name, alias_type, district, priority, is_enabled, remark) VALUES (?,?,?,?,1,?)`,
            [item.alias_name.trim(), t, item.district.trim(), item.priority || 0, item.remark || null]
          );
          added++;
        } catch {}
      }
      return success(res, { added }, `成功导入 ${added} 条`);
    } catch (err) {
      return error(res, '导入失败: ' + err.message, 500);
    }
  }

  async getDistrictOptions(req, res) {
    try {
      const rows = await query(`SELECT DISTINCT district FROM ${ALIAS_TABLE} WHERE is_enabled=1 ORDER BY district`);
      const data = Array.isArray(rows[0]) ? rows[0] : rows;
      return success(res, (data || []).map(r => r.district));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /** 供解析引擎调用：一次性加载全部启用的别名，按类型分组返回 */
  static async loadAllEnabled() {
    try {
      const rows = await query(`SELECT alias_name, alias_type, district, priority FROM ${ALIAS_TABLE} WHERE is_enabled=1 ORDER BY priority DESC`);
      const data = Array.isArray(rows[0]) ? rows[0] : rows;
      const maps = { landmark: {}, road: {}, metro: {}, area: {} };
      if (data) {
        for (const r of data) {
          const m = maps[r.alias_type] || maps.landmark;
          if (!m[r.alias_name] || r.priority > (m[r.alias_name]._p || 0)) {
            m[r.alias_name] = r.district;
            m[r.alias_name + '__p'] = r.priority;
          }
        }
      }
      for (const t of Object.keys(maps)) {
        for (const k of Object.keys(maps[t])) {
          if (k.endsWith('__p')) delete maps[t][k];
        }
      }
      return maps;
    } catch {
      return { landmark: {}, road: {}, metro: {}, area: {} };
    }
  }
}

const districtAliasCtrl = new DistrictAliasController();

module.exports = new PropertySettingsController();
module.exports.rentalCompanyCtrl = rentalCompanyCtrl;
module.exports.RentalCompanyController = RentalCompanyController;
module.exports.publisherContactCtrl = publisherContactCtrl;
module.exports.PublisherContactController = PublisherContactController;
module.exports.districtAliasCtrl = districtAliasCtrl;
module.exports.DistrictAliasController = DistrictAliasController;
