/**
 * 管理后台房源库控制器
 * 对应PHP版本 PropertyLibraryController - 管理 wechat_robot_expat_parsed_properties 表
 * 支持：列表、高级筛选、详情、编辑、删除、批量操作、AI解析、AI去重、上下架、回收站
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const SystemSetting = require('../../models/SystemSetting');
const { presignMediaUrls, isS3Url } = require('../../services/S3ProxyService');
const { buildListedPropertyFilter } = require('../../utils/publishFilter');

function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes' || value === '是' || value === '有';
}

function normalizeText(value) {
  return String(value || '')
    .replace(/[\s\r\n\t,，。.;；:：!！?？、\-_/\\()[\]{}【】"']/g, '')
    .toLowerCase()
    .trim();
}

function safeNumber(value, min = null, max = null) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (min !== null && num < min) return null;
  if (max !== null && num > max) return null;
  return num;
}

/**
 * 合并 local_images、media_urls、朋友圈媒体（列表/详情/编辑与小区图片逻辑一致，去重保序）
 */
function mergePropertyMediaForApi(row) {
  const seen = new Set();
  const out = [];
  function normItem(item) {
    if (typeof item === 'string') return item.trim();
    return String(item?.url || item?.thumb || item?.file_url || '').trim();
  }
  function consumeRaw(raw) {
    if (raw == null || raw === '') return;
    let arr = [];
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      try {
        const v = JSON.parse(raw);
        arr = Array.isArray(v) ? v : [];
      } catch {
        // 兼容列里存「单个 URL 字符串」非 JSON 的情况
        if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('data:')) {
          arr = [trimmed];
        } else {
          return;
        }
      }
    } else return;
    for (const item of arr) {
      const val = normItem(item);
      if (!val || val.length < 4 || seen.has(val)) continue;
      seen.add(val);
      out.push(val);
    }
  }
  consumeRaw(row.local_images);
  consumeRaw(row.media_urls);
  if (out.length === 0) {
    let momentMedia = row.moment_local_media || row.moment_media_list;
    if (momentMedia) {
      if (typeof momentMedia === 'string') {
        try { momentMedia = JSON.parse(momentMedia); } catch { momentMedia = []; }
      }
      if (Array.isArray(momentMedia)) {
        for (const item of momentMedia) {
          const val = normItem(item);
          if (!val || val.length < 4 || seen.has(val)) continue;
          seen.add(val);
          out.push(val);
        }
      }
    }
  }
  return out;
}

async function loadAIParseConfig() {
  const aiModelId = await SystemSetting.get('ai_parse_model_id', '');
  const aiPrompt = await SystemSetting.get('ai_parse_prompt', '');
  if (!aiModelId || !aiPrompt) return null;

  const [aiModel] = await query(
    'SELECT id, model_code, model_name, api_url, api_key, api_headers, max_tokens, temperature FROM ai_models WHERE id = ? AND is_enabled = 1 LIMIT 1',
    [aiModelId]
  );

  if (!aiModel) return null;
  return { aiModel, aiPrompt };
}

async function callAIParse(aiModel, promptTemplate, content, retryCount = 0) {
  const systemPrompt = String(promptTemplate || '').replace(/\{CONTENT\}/g, '').trim();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${aiModel.api_key}`,
  };

  if (aiModel.api_headers) {
    try {
      Object.assign(headers, typeof aiModel.api_headers === 'string' ? JSON.parse(aiModel.api_headers) : aiModel.api_headers);
    } catch {}
  }

  const response = await axios.post(
    aiModel.api_url,
    {
      model: aiModel.model_code || aiModel.model_name,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `房源描述：\n${content}` },
      ],
      temperature: Number(aiModel.temperature || 0.1),
      max_tokens: Number(aiModel.max_tokens || 3000),
      response_format: { type: 'json_object' },
    },
    { headers, timeout: 60000 }
  );

  const aiText = response.data?.choices?.[0]?.message?.content || '';
  const jsonMatch = aiText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    if (retryCount < 1) return callAIParse(aiModel, promptTemplate, content, retryCount + 1);
    return null;
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    if (retryCount < 1) return callAIParse(aiModel, promptTemplate, content, retryCount + 1);
    return null;
  }
}

function buildAIUpdatePayload(parsed = {}) {
  const updateData = {};

  if (parsed.community) updateData.community = String(parsed.community).trim().slice(0, 200);
  if (parsed.title) updateData.title = String(parsed.title).trim().slice(0, 500);
  if (parsed.district) updateData.district = String(parsed.district).trim().slice(0, 100);
  if (parsed.street) updateData.street = String(parsed.street).trim().slice(0, 200);
  if (parsed.publisher_name) updateData.publisher_name = String(parsed.publisher_name).trim().slice(0, 100);
  if (parsed.contact_info) updateData.contact_info = String(parsed.contact_info).trim().slice(0, 200);
  if (parsed.metro_lines) updateData.metro_lines = String(parsed.metro_lines).trim().slice(0, 200);
  if (parsed.metro_stations) updateData.metro_stations = String(parsed.metro_stations).trim().slice(0, 200);
  if (parsed.floor_info) updateData.floor_info = String(parsed.floor_info).trim().slice(0, 100);
  if (parsed.decoration) updateData.decoration = String(parsed.decoration).trim().slice(0, 50);
  if (parsed.orientation) updateData.orientation = String(parsed.orientation).trim().slice(0, 50);
  if (parsed.outdoor_features) updateData.outdoor_features = String(parsed.outdoor_features).trim().slice(0, 255);
  if (parsed.description) updateData.description = String(parsed.description).trim();

  const priceValue = safeNumber(parsed.price_value, 0, 99999999);
  if (priceValue !== null) {
    updateData.price_value = priceValue;
    if (!parsed.price) updateData.price = String(Math.round(priceValue));
  }
  if (parsed.price) updateData.price = String(parsed.price).trim().slice(0, 100);

  const bedrooms = safeNumber(parsed.bedrooms, 0, 20);
  const livingrooms = safeNumber(parsed.livingrooms ?? parsed.living_rooms, 0, 20);
  const bathrooms = safeNumber(parsed.bathrooms, 0, 20);
  const areaSqm = safeNumber(parsed.area_sqm, 0, 99999);
  const latitude = safeNumber(parsed.latitude, -90, 90);
  const longitude = safeNumber(parsed.longitude, -180, 180);

  if (bedrooms !== null) updateData.bedrooms = bedrooms;
  if (livingrooms !== null) updateData.livingrooms = livingrooms;
  if (bathrooms !== null) updateData.bathrooms = bathrooms;
  if (areaSqm !== null) updateData.area_sqm = areaSqm;
  if (latitude !== null) updateData.latitude = latitude;
  if (longitude !== null) updateData.longitude = longitude;

  if (parsed.has_elevator !== undefined) updateData.has_elevator = normalizeBoolean(parsed.has_elevator) ? 1 : 0;
  if (parsed.has_parking !== undefined) updateData.has_parking = normalizeBoolean(parsed.has_parking) ? 1 : 0;
  if (parsed.has_commission !== undefined) updateData.has_commission = normalizeBoolean(parsed.has_commission) ? 1 : 0;
  if (parsed.is_duplex !== undefined) updateData.is_duplex = normalizeBoolean(parsed.is_duplex) ? 1 : 0;

  if (Array.isArray(parsed.media_urls)) {
    updateData.media_urls = JSON.stringify(parsed.media_urls);
  }

  updateData.is_ai_parsed = 1;
  updateData.parse_status = 'ai_parsed';
  updateData.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

  return updateData;
}

const PROPERTY_LIBRARY_PUBLISH_SETTINGS_KEY = 'property_library_publish_settings';

/**
 * 读取房源库发布规则（与朋友圈解析列表同源筛选，存于 system_settings）
 */
async function loadPublishSettings() {
  try {
    const raw = await SystemSetting.get(PROPERTY_LIBRARY_PUBLISH_SETTINGS_KEY, '');
    if (!raw && raw !== 0) return { enabled: false };
    const obj = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
    if (!obj || typeof obj !== 'object') return { enabled: false };
    return obj;
  } catch {
    return { enabled: false };
  }
}

/**
 * 根据发布规则拼接 WHERE 子句（别名 p）
 */
function applyPublishRulesToQuery(pubCfg, conditions, params) {
  if (!pubCfg || pubCfg.enabled !== true || !pubCfg.robot_id) return;
  const idx = conditions.indexOf('p.is_listed = 1');
  if (idx !== -1) conditions.splice(idx, 1);
  conditions.push('p.robot_id = ?');
  params.push(parseInt(pubCfg.robot_id, 10));
  if (Array.isArray(pubCfg.friend_wxids) && pubCfg.friend_wxids.length) {
    conditions.push(`p.publisher_wxid IN (${pubCfg.friend_wxids.map(() => '?').join(',')})`);
    params.push(...pubCfg.friend_wxids);
  }
  if (pubCfg.publish_time_start) {
    conditions.push('COALESCE(p.moment_publish_time, p.created_at) >= ?');
    params.push(`${pubCfg.publish_time_start} 00:00:00`);
  }
  if (pubCfg.publish_time_end) {
    conditions.push('COALESCE(p.moment_publish_time, p.created_at) <= ?');
    params.push(`${pubCfg.publish_time_end} 23:59:59`);
  }
}

function buildDuplicateCandidates(properties = []) {
  const groups = new Map();

  properties.forEach((property) => {
    const priceBucket = property.price_value ? Math.round(Number(property.price_value) / 500) * 500 : 'noprice';
    const normalizedCommunity = normalizeText(property.community);
    const normalizedDescription = normalizeText(String(property.description || '').slice(0, 120));
    const fallbackKey = [
      normalizedCommunity || 'nocommunity',
      normalizeText(property.district) || 'nodistrict',
      property.bedrooms || 'nobedrooms',
      priceBucket,
      normalizedDescription.slice(0, 50) || 'nodesc',
    ].join('|');
    const key = property.content_hash ? `hash:${property.content_hash}` : `fallback:${fallbackKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(property);
  });

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .map((group) => {
      const sorted = [...group].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      const recommendedKeepId = sorted[0]?.id || null;
      return {
        recommended_keep_id: recommendedKeepId,
        items: sorted.map((item) => ({
          id: item.id,
          community: item.community,
          district: item.district,
          price: item.price,
          price_value: item.price_value,
          bedrooms: item.bedrooms,
          publisher_name: item.publisher_name,
          property_code: item.property_code,
          created_at: item.created_at,
          description: String(item.description || '').slice(0, 160),
        })),
      };
    });
}

class PropertyLibraryController {

  /**
   * 获取房源列表（支持高级筛选）
   */
  async getProperties(req, res) {
    try {
      const {
        page = 1, pageSize = 25, search = '', status = '', listing_status = '',
        district = '', bedrooms = '', price_min = '', price_max = '',
        property_codes = '', metro_lines = '', metro_stations = '',
        publisher = '', publish_time_start = '', publish_time_end = '',
        has_elevator = '', has_parking = '', has_commission = '',
        is_duplex = '', outdoor_features = '', exclude_keywords = '',
        user_id = '',         robot_id = '', sort_order = 'desc'
      } = req.query;

      const publishSortAsc = String(sort_order || 'desc').toLowerCase() === 'asc';
      const orderDir = publishSortAsc ? 'ASC' : 'DESC';
      const orderSecondary = publishSortAsc ? 'ASC' : 'DESC';

      const conditions = ["p.deleted_at IS NULL"];
      const params = [];

      const hasActiveLibraryFilter = [
        search, status, listing_status, district, bedrooms, price_min, price_max,
        property_codes, metro_lines, metro_stations, publisher,
        publish_time_start, publish_time_end, has_elevator, has_parking,
        has_commission, is_duplex, outdoor_features, exclude_keywords,
        user_id, robot_id,
      ].some(value => String(value ?? '').trim() !== '');

      // 管理后台房源库要能单独查看/搜回已下架房源，方便重新上架、编辑、删除；
      // 前台公开页面仍由 buildListedPropertyFilter 严格控制，只展示已上架房源。
      if (listing_status === 'unlisted') {
        conditions.push('(p.is_listed = 0 AND p.status = ? AND p.property_code IS NOT NULL AND p.property_code != \'\')');
        params.push('draft');
      } else if (listing_status === 'listed') {
        const listedFilter = await buildListedPropertyFilter('p', { includeDedup: true });
        conditions.push(...listedFilter.conditions);
        params.push(...listedFilter.params);
      } else if (hasActiveLibraryFilter) {
        conditions.push('(p.is_listed = 1 OR (p.is_listed = 0 AND p.status = ? AND p.property_code IS NOT NULL AND p.property_code != \'\'))');
        params.push('draft');
      } else {
        const listedFilter = await buildListedPropertyFilter('p', { includeDedup: true });
        conditions.push(...listedFilter.conditions);
        params.push(...listedFilter.params);
      }

      if (status) { conditions.push('p.status = ?'); params.push(status); }
      if (user_id) { conditions.push('p.user_id = ?'); params.push(user_id); }
      if (robot_id) { conditions.push('p.robot_id = ?'); params.push(robot_id); }

      if (district) {
        const distList = String(district).split(',').map(s => s.trim()).filter(Boolean);
        if (distList.length === 1) {
          const clean = distList[0].replace(/新区$/, '').replace(/区$/, '');
          conditions.push('p.district LIKE ?');
          params.push(`%${clean}%`);
        } else if (distList.length > 1) {
          const parts = distList.map(() => 'p.district LIKE ?');
          conditions.push(`(${parts.join(' OR ')})`);
          distList.forEach(d => {
            const clean = d.replace(/新区$/, '').replace(/区$/, '');
            params.push(`%${clean}%`);
          });
        }
      }

      if (bedrooms) {
        const brArr = String(bedrooms).split(',').map(b => parseInt(b.trim())).filter(b => !isNaN(b));
        if (brArr.length === 1) {
          if (brArr[0] >= 5) {
            conditions.push('p.bedrooms >= ?');
          } else {
            conditions.push('p.bedrooms = ?');
          }
          params.push(brArr[0]);
        } else if (brArr.length > 1) {
          const has5Plus = brArr.includes(5);
          const normalVals = brArr.filter(b => b < 5);
          const parts = [];
          if (normalVals.length) {
            parts.push(`p.bedrooms IN (${normalVals.map(() => '?').join(',')})`);
            params.push(...normalVals);
          }
          if (has5Plus) { parts.push('p.bedrooms >= 5'); }
          conditions.push(`(${parts.join(' OR ')})`);
        }
      }

      if (price_min) { conditions.push('p.price_value >= ?'); params.push(parseFloat(price_min)); }
      if (price_max) { conditions.push('p.price_value <= ?'); params.push(parseFloat(price_max)); }

      if (property_codes) {
        const codes = property_codes.split(',').map(c => c.trim()).filter(Boolean);
        if (codes.length) {
          conditions.push(`(${codes.map(() => 'p.property_code = ?').join(' OR ')})`);
          params.push(...codes);
        }
      }

      if (search) {
        conditions.push('(p.description LIKE ? OR p.community LIKE ? OR p.publisher_name LIKE ? OR p.street LIKE ?)');
        const term = `%${search}%`;
        params.push(term, term, term, term);
      }

      if (metro_lines) {
        const lines = metro_lines.split(',').map(l => l.trim()).filter(Boolean);
        if (lines.length) {
          const conds = lines.map(() => '(p.metro_lines = ? OR FIND_IN_SET(?, p.metro_lines) > 0)');
          conditions.push(`(${conds.join(' OR ')})`);
          lines.forEach(l => { params.push(l, l); });
        }
      }

      if (metro_stations) {
        const stations = metro_stations.split(',').map(s => s.trim()).filter(Boolean);
        if (stations.length) {
          const conds = stations.map(() => '(p.metro_stations = ? OR FIND_IN_SET(?, p.metro_stations) > 0)');
          conditions.push(`(${conds.join(' OR ')})`);
          stations.forEach(s => { params.push(s, s); });
        }
      }

      if (publisher) { conditions.push('p.publisher_name = ?'); params.push(publisher); }
      // 与列表排序一致：按朋友圈发布时间优先，否则录入时间
      if (publish_time_start) { conditions.push('DATE(COALESCE(p.moment_publish_time, p.created_at)) >= ?'); params.push(publish_time_start); }
      if (publish_time_end) { conditions.push('DATE(COALESCE(p.moment_publish_time, p.created_at)) <= ?'); params.push(publish_time_end); }
      if (has_elevator !== '') { conditions.push('p.has_elevator = ?'); params.push(parseInt(has_elevator)); }
      if (has_parking !== '') { conditions.push('p.has_parking = ?'); params.push(parseInt(has_parking)); }
      if (has_commission !== '') { conditions.push('p.has_commission = ?'); params.push(parseInt(has_commission)); }
      if (is_duplex !== '') { conditions.push('p.is_duplex = ?'); params.push(parseInt(is_duplex)); }

      if (outdoor_features) {
        const feats = outdoor_features.split(',').map(f => f.trim()).filter(Boolean);
        if (feats.length) {
          const oConds = feats.map(() => 'p.outdoor_features LIKE ?');
          conditions.push(`(${oConds.join(' OR ')})`);
          feats.forEach(f => params.push(`%${f}%`));
        }
      }

      if (exclude_keywords) {
        const kws = exclude_keywords.split(',').map(k => k.trim()).filter(Boolean);
        kws.forEach(kw => {
          conditions.push('(p.description NOT LIKE ? AND IFNULL(p.community, \'\') NOT LIKE ?)');
          params.push(`%${kw}%`, `%${kw}%`);
        });
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      let tableExists = true;
      try {
        await query('SELECT 1 FROM wechat_robot_expat_parsed_properties LIMIT 1');
      } catch {
        tableExists = false;
      }

      if (!tableExists) {
        return res.json({
          success: true,
          data: [],
          pagination: { total: 0, page: 1, pages: 0, pageSize: parseInt(pageSize, 10) || 25 },
        });
      }

      const countParams = [...params];
      const [countRow] = await query(
        `SELECT COUNT(*) as total FROM wechat_robot_expat_parsed_properties p ${whereClause}`,
        countParams
      );
      const total = countRow ? countRow.total : 0;

      const limit = parseInt(pageSize);
      const offset = (parseInt(page) - 1) * limit;
      const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

      const idRows = await query(`
        SELECT p.id
        FROM wechat_robot_expat_parsed_properties p
        ${whereClause}
        ORDER BY COALESCE(p.moment_publish_time, p.created_at) ${orderDir}, p.id ${orderSecondary}
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);
      const idList = (idRows || []).map(row => row.id).filter(Boolean);
      let rows = [];
      if (idList.length > 0) {
        const idPlaceholders = idList.map(() => '?').join(',');
        rows = await query(`
        SELECT p.*,
               u.display_name as user_display_name,
               u.username as user_username,
               r.nickname as robot_nickname,
               r.wxid as robot_wxid,
               COALESCE(m.media_list, m2.media_list) as moment_media_list,
               COALESCE(m.local_media_urls, m2.local_media_urls) as moment_local_media,
               COALESCE(poi1.district, poi2.district, p.district) as effective_district,
               COALESCE(p.latitude, poi1.latitude, poi2.latitude) as effective_lat,
               COALESCE(p.longitude, poi1.longitude, poi2.longitude) as effective_lng,
               COALESCE(poi1.nearest_metro_line, poi2.nearest_metro_line) as poi_metro_line,
               COALESCE(poi1.nearest_metro_station, poi2.nearest_metro_station) as poi_metro_station,
               COALESCE(p.metro_distance, poi1.nearest_metro_distance, poi2.nearest_metro_distance) as effective_metro_distance,
               CASE WHEN p.is_duplex = 1 OR p.original_content LIKE '%复式%' OR p.original_content LIKE '%Loft%' OR p.original_content LIKE '%LOFT%' OR p.original_content LIKE '%跃层%' THEN 1 ELSE 0 END as effective_is_duplex,
               CASE WHEN p.has_elevator = 1 OR p.original_content LIKE '%有电梯%' OR p.original_content LIKE '%电梯房%' OR p.original_content LIKE '%带电梯%' OR p.community LIKE '%大楼%' OR p.community LIKE '%大厦%' THEN 1 ELSE 0 END as effective_has_elevator,
               CASE WHEN p.has_parking = 1 OR p.original_content LIKE '%有车位%' OR p.original_content LIKE '%含车位%' OR p.original_content LIKE '%送车位%' OR p.original_content LIKE '%带车位%' THEN 1 ELSE 0 END as effective_has_parking,
               CASE WHEN p.has_commission = 1 OR p.original_content LIKE '%付佣%' OR p.original_content LIKE '%全佣%' OR p.original_content LIKE '%半佣%' OR p.original_content LIKE '%有佣%' OR p.original_content LIKE '%佣金%' OR p.original_content LIKE '%中介费%' THEN 1 ELSE 0 END as effective_has_commission,
               CASE WHEN (p.outdoor_features IS NOT NULL AND p.outdoor_features != '' AND p.outdoor_features != '0') THEN p.outdoor_features
                    ELSE CONCAT_WS(',',
                      IF(p.original_content LIKE '%阳台%', '阳台', NULL),
                      IF(p.original_content LIKE '%露台%', '露台', NULL),
                      IF((p.original_content LIKE '%带花园%' OR p.original_content LIKE '%私家花园%' OR p.original_content LIKE '%独立花园%') AND (p.community IS NULL OR p.community NOT LIKE '%花园%'), '花园', NULL),
                      IF(p.original_content LIKE '%院子%' OR p.original_content LIKE '%庭院%', '院子/庭院', NULL)
                    ) END as effective_outdoor
        FROM wechat_robot_expat_parsed_properties p
        LEFT JOIN wechat_robot_expat_properties op ON p.property_id = op.id
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN wechat_robot_accounts r ON p.robot_id = r.id
        LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
        LEFT JOIN wechat_robot_moments m2 ON op.moment_id = m2.moment_id AND (p.moment_id IS NULL OR p.moment_id = '')
        LEFT JOIN property_community_dict poi1 ON p.community = poi1.community_name AND p.district = poi1.district AND poi1.is_enabled = 1
        LEFT JOIN property_community_dict poi2 ON p.community = poi2.community_name AND poi2.is_enabled = 1 AND poi1.id IS NULL
          AND 1 = (SELECT COUNT(DISTINCT pcd2.district) FROM property_community_dict pcd2 WHERE pcd2.community_name = p.community AND pcd2.is_enabled = 1)
        WHERE p.id IN (${idPlaceholders})
        ORDER BY COALESCE(p.moment_publish_time, p.created_at) ${orderDir}, p.id ${orderSecondary}
      `, idList);
      }

      for (const row of rows) {
        // 用实时计算的字段覆盖原始字段
        if (row.effective_district) row.district = row.effective_district;
        if (row.effective_lat) row.latitude = row.effective_lat;
        if (row.effective_lng) row.longitude = row.effective_lng;
        if (row.effective_is_duplex) row.is_duplex = row.effective_is_duplex;
        if (row.effective_has_elevator) row.has_elevator = row.effective_has_elevator;
        if (row.effective_has_parking) row.has_parking = row.effective_has_parking;
        if (row.effective_has_commission) row.has_commission = row.effective_has_commission;
        if (row.effective_outdoor) row.outdoor_features = row.effective_outdoor;
        if (!row.metro_lines && row.poi_metro_line) row.metro_lines = row.poi_metro_line;
        if (!row.metro_stations && row.poi_metro_station) row.metro_stations = row.poi_metro_station;
        if (row.effective_metro_distance) row.metro_distance = row.effective_metro_distance;
        // 清理临时字段
        delete row.effective_district; delete row.effective_lat; delete row.effective_lng;
        delete row.effective_is_duplex; delete row.effective_has_elevator;
        delete row.effective_has_parking; delete row.effective_has_commission;
        delete row.effective_outdoor; delete row.poi_metro_line;
        delete row.poi_metro_station; delete row.effective_metro_distance;

        const mergedMedia = mergePropertyMediaForApi({
          local_images: row.local_images,
          media_urls: row.media_urls,
          moment_local_media: row.moment_local_media,
          moment_media_list: row.moment_media_list,
        });
        row.media_urls = mergedMedia;
        delete row.moment_media_list;
        delete row.moment_local_media;
        if (Array.isArray(row.media_urls) && row.media_urls.length) {
          const firstItem = row.media_urls[0];
          const firstUrl = typeof firstItem === 'string' ? firstItem : (firstItem?.url || firstItem?.thumb || '');
          if (isS3Url(firstUrl)) {
            row.media_urls = await presignMediaUrls(row.media_urls);
          }
        }
      }

      return res.json({
        success: true,
        data: rows,
        pagination: { total, page: parseInt(page), pages: totalPages, pageSize: limit }
      });
    } catch (err) {
      console.error('获取房源列表失败:', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 获取房源详情
   */
  async getPropertyDetail(req, res) {
    try {
      const { id } = req.params;
      const [property] = await query(`
        SELECT p.*,
               u.display_name as user_display_name,
               u.username as user_username,
               r.nickname as robot_nickname,
               r.wxid as robot_wxid,
               COALESCE(m.media_list, m2.media_list) as moment_media_list,
               COALESCE(m.local_media_urls, m2.local_media_urls) as moment_local_media
        FROM wechat_robot_expat_parsed_properties p
        LEFT JOIN wechat_robot_expat_properties op ON p.property_id = op.id
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN wechat_robot_accounts r ON p.robot_id = r.id
        LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
        LEFT JOIN wechat_robot_moments m2 ON op.moment_id = m2.moment_id AND (p.moment_id IS NULL OR p.moment_id = '')
        WHERE p.id = ?
      `, [id]);

      if (!property) return error(res, '房源不存在', 404);

      property.media_urls = mergePropertyMediaForApi({
        local_images: property.local_images,
        media_urls: property.media_urls,
        moment_local_media: property.moment_local_media,
        moment_media_list: property.moment_media_list,
      });
      delete property.moment_media_list;
      delete property.moment_local_media;
      if (Array.isArray(property.media_urls) && property.media_urls.length) {
        const firstItem = property.media_urls[0];
        const firstUrl = typeof firstItem === 'string' ? firstItem : (firstItem?.url || firstItem?.thumb || '');
        if (isS3Url(firstUrl)) {
          property.media_urls = await presignMediaUrls(property.media_urls);
        }
      }
      return success(res, property);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 更新房源
   */
  async updateProperty(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;
      const allowedFields = [
        'community', 'title', 'price', 'price_value', 'bedrooms', 'livingrooms', 'bathrooms',
        'district', 'street', 'publisher_name', 'contact_info', 'metro_lines', 'metro_stations',
        'floor_info', 'area_sqm', 'decoration', 'orientation', 'description',
        'has_elevator', 'has_parking', 'has_commission', 'is_duplex', 'outdoor_features',
        'media_urls', 'latitude', 'longitude', 'metro_distance',
        'property_code', 'is_listed', 'status'
      ];

      const numericFields = new Set([
        'price_value', 'bedrooms', 'livingrooms', 'bathrooms',
        'area_sqm', 'latitude', 'longitude', 'metro_distance', 'outdoor_features'
      ]);
      const booleanFields = new Set([
        'has_elevator', 'has_parking', 'has_commission', 'is_duplex', 'is_listed'
      ]);

      const sets = [];
      const params = [];
      let syncedMediaUrlsJson = null;
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          let value = data[field];
          if (field === 'media_urls' && typeof value === 'object') {
            // 保存前清理预签名URL参数，恢复为原始S3 URL
            if (Array.isArray(value)) {
              value = value.map(u => {
                if (typeof u === 'string' && u.includes('rains3.com') && u.includes('X-Amz-Signature')) {
                  try { const parsed = new URL(u); return `${parsed.origin}${parsed.pathname}`; } catch { return u; }
                }
                return u;
              });
            }
            value = JSON.stringify(value);
            syncedMediaUrlsJson = value;
          } else if (numericFields.has(field)) {
            if (value === '' || value === null || value === undefined) {
              value = null;
            } else {
              const num = Number(value);
              value = Number.isFinite(num) ? num : null;
            }
          } else if (booleanFields.has(field)) {
            value = (value === true || value === 1 || value === '1' || value === 'true') ? 1 : 0;
          }
          sets.push(`${field} = ?`);
          params.push(value);
        }
      }

      if (!sets.length) return error(res, '没有要更新的数据', 400);

      // 与后台「小区图片」展示一致：更新 media_urls 时同步 local_images，避免旧 local 覆盖新图
      if (syncedMediaUrlsJson !== null) {
        sets.push('local_images = ?');
        params.push(syncedMediaUrlsJson);
      }

      sets.push('updated_at = NOW()');
      params.push(id);

      await query(`UPDATE wechat_robot_expat_parsed_properties SET ${sets.join(', ')} WHERE id = ?`, params);
      return success(res, null, '更新成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 删除房源（软删除），同步清理本地媒体文件
   */
  async deleteProperty(req, res) {
    try {
      const { id } = req.params;
      await this._cleanupPropertyMedia(id);
      await query(
        'UPDATE wechat_robot_expat_parsed_properties SET deleted_at = NOW() WHERE id = ?',
        [id]
      );
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 批量删除，同步清理本地媒体文件
   */
  async batchDelete(req, res) {
    try {
      const { ids } = req.body;
      if (!ids || !ids.length) return error(res, '请选择要删除的房源', 400);

      for (const id of ids) {
        await this._cleanupPropertyMedia(id);
      }

      const placeholders = ids.map(() => '?').join(',');
      await query(
        `UPDATE wechat_robot_expat_parsed_properties SET deleted_at = NOW() WHERE id IN (${placeholders})`,
        ids
      );
      return success(res, null, `成功删除 ${ids.length} 条房源`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 清理房源关联的本地媒体文件（/uploads/images/*, /uploads/videos/*）
   */
  async _cleanupPropertyMedia(propId) {
    try {
      const [prop] = await query(
        'SELECT media_urls, local_images FROM wechat_robot_expat_parsed_properties WHERE id = ?',
        [propId]
      );
      if (!prop) return;

      const urlSources = [prop.local_images, prop.media_urls];
      for (const raw of urlSources) {
        if (!raw) continue;
        let urls = [];
        try { urls = JSON.parse(raw); } catch { continue; }
        if (!Array.isArray(urls)) continue;
        for (const url of urls) {
          const u = typeof url === 'string' ? url : '';
          if (u.startsWith('/uploads/')) {
            const filePath = path.join(process.cwd(), 'public', u);
            try { await fs.unlink(filePath); } catch {}
          }
        }
      }
    } catch (err) {
      console.error(`[PropertyLibrary._cleanupPropertyMedia] propId=${propId}:`, err.message);
    }
  }

  /**
   * 上架/下架
   */
  async toggleListing(req, res) {
    try {
      const { id } = req.params;
      const [property] = await query(
        'SELECT id, is_listed FROM wechat_robot_expat_parsed_properties WHERE id = ?', [id]
      );
      if (!property) return error(res, '房源不存在', 404);

      const currentStatus = Number(property.is_listed || 0);
      const newStatus = currentStatus === 1 ? 0 : 1;
      await query(
        'UPDATE wechat_robot_expat_parsed_properties SET is_listed = ?, status = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, newStatus === 1 ? 'published' : 'draft', id]
      );
      return success(res, { is_listed: newStatus }, newStatus === 1 ? '已上架' : '已下架');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 批量上架/下架
   */
  async batchToggleListing(req, res) {
    try {
      const { ids, action } = req.body;
      if (!ids || !ids.length) return error(res, '请选择房源', 400);

      const newStatus = action === 'list' ? 1 : 0;
      const newPublishStatus = newStatus === 1 ? 'published' : 'draft';
      const placeholders = ids.map(() => '?').join(',');
      await query(
        `UPDATE wechat_robot_expat_parsed_properties SET is_listed = ?, status = ?, updated_at = NOW() WHERE id IN (${placeholders})`,
        [newStatus, newPublishStatus, ...ids]
      );
      return success(res, null, `成功${action === 'list' ? '上架' : '下架'} ${ids.length} 条房源`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 获取发布人列表
   */
  async getPublishers(req, res) {
    try {
      const rows = await query(`
        SELECT DISTINCT publisher_name FROM wechat_robot_expat_parsed_properties
        WHERE publisher_name IS NOT NULL AND publisher_name != '' AND deleted_at IS NULL
        ORDER BY publisher_name
      `);
      return success(res, rows.map(r => r.publisher_name));
    } catch (err) {
      return success(res, []);
    }
  }

  /**
   * 获取统计数据
   */
  async getStats(req, res) {
    try {
      let statsConditions = ['deleted_at IS NULL'];
      const statsParams = [];
      let publishSettings = {};
      try {
        const settingsJson = await SystemSetting.get('property_library_publish_settings', '{}');
        publishSettings = JSON.parse(settingsJson);
      } catch {}
      const hasPublishConfig = Array.isArray(publishSettings.selected_friends) && publishSettings.selected_friends.length > 0;
      if (hasPublishConfig) {
        // 核心修复：已发布的房源(is_listed=1)始终纳入统计，未发布的才受时间筛选限制
        statsConditions.push(`(
          publisher_name IN (${publishSettings.selected_friends.map(() => '?').join(',')})
          ${publishSettings.time_start ? `AND COALESCE(moment_publish_time, created_at) >= '${publishSettings.time_start} 00:00:00'` : ''}
          ${publishSettings.time_end ? `AND COALESCE(moment_publish_time, created_at) <= '${publishSettings.time_end} 23:59:59'` : ''}
        )`);
        statsParams.push(...publishSettings.selected_friends);
        // 使用共享内容质量过滤（统计无表别名）
        const { buildContentQualityFilter } = require('../../utils/publishFilter');
        statsConditions.push(...buildContentQualityFilter(''));
      } else {
        statsConditions.push('is_listed = 1');
      }
      const statsWhere = statsConditions.join(' AND ');
      const [row] = await query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN is_sent = 1 THEN 1 ELSE 0 END) as sentCount,
          COUNT(DISTINCT CASE WHEN user_id IS NOT NULL THEN user_id END) as userCount,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as todayCount
        FROM wechat_robot_expat_parsed_properties WHERE ${statsWhere}
      `, statsParams).catch(() => [{ total: 0, sentCount: 0, userCount: 0, todayCount: 0 }]);
      return success(res, {
        total: row?.total || 0,
        sentCount: row?.sentCount || 0,
        userCount: row?.userCount || 0,
        todayCount: row?.todayCount || 0
      });
    } catch (err) {
      return success(res, { total: 0, sentCount: 0, userCount: 0, todayCount: 0 });
    }
  }

  /**
   * 回收站列表
   */
  async getRecycleBin(req, res) {
    try {
      const { page = 1, pageSize = 20 } = req.query;
      const limit = parseInt(pageSize);
      const offset = (parseInt(page) - 1) * limit;

      const [countRow] = await query(
        'SELECT COUNT(*) as total FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NOT NULL'
      );
      const total = countRow ? countRow.total : 0;

      const rows = await query(`
        SELECT p.id, p.community, p.price, p.bedrooms, p.district, p.description,
               p.publisher_name, p.contact_info, p.property_code, p.deleted_at,
               p.media_urls, p.created_at
        FROM wechat_robot_expat_parsed_properties p
        WHERE p.deleted_at IS NOT NULL
        ORDER BY p.deleted_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);

      return res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 恢复房源
   */
  async restoreProperty(req, res) {
    try {
      const { ids } = req.body;
      if (!ids || !ids.length) return error(res, '请选择要恢复的房源', 400);

      const placeholders = ids.map(() => '?').join(',');
      await query(
        `UPDATE wechat_robot_expat_parsed_properties SET deleted_at = NULL WHERE id IN (${placeholders})`,
        ids
      );
      return success(res, null, `已恢复 ${ids.length} 条房源`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 审核通过（兼容旧接口）
   */
  async approveProperty(req, res) {
    try {
      const { id } = req.params;
      await query("UPDATE wechat_robot_expat_parsed_properties SET status = 'published', updated_at = NOW() WHERE id = ?", [id]);
      return success(res, null, '审核通过');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async batchAIParse(req, res) {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
      if (!ids.length) return error(res, '请选择要AI解析的房源', 400);

      const config = await loadAIParseConfig();
      if (!config) return error(res, '请先在房源信息设置中配置AI解析模型和提示词', 400);

      const placeholders = ids.map(() => '?').join(',');
      const properties = await query(
        `SELECT id, original_content, description FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL AND id IN (${placeholders})`,
        ids
      );

      let successCount = 0, failedCount = 0;
      const failedItems = [];

      for (const property of properties) {
        const sourceText = property.original_content || property.description || '';
        if (!sourceText.trim()) { failedCount++; failedItems.push({ id: property.id, reason: '缺少可解析原文' }); continue; }
        try {
          const parsed = await callAIParse(config.aiModel, config.aiPrompt, sourceText);
          if (!parsed || typeof parsed !== 'object') { failedCount++; failedItems.push({ id: property.id, reason: 'AI未返回有效结果' }); continue; }
          const updateData = buildAIUpdatePayload(parsed);
          const fields = Object.keys(updateData);
          if (!fields.length) { failedCount++; continue; }
          const setClauses = fields.map(f => `${f} = ?`).join(', ');
          const values = [...fields.map(f => updateData[f]), property.id];
          await query(`UPDATE wechat_robot_expat_parsed_properties SET ${setClauses} WHERE id = ?`, values);
          successCount++;
        } catch (err) { failedCount++; failedItems.push({ id: property.id, reason: err.message }); }
      }

      return success(res, { total: properties.length, success_count: successCount, failed_count: failedCount, failed_items: failedItems.slice(0, 20) },
        `AI解析完成：成功 ${successCount} 条，失败 ${failedCount} 条`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async batchAIDeduplicate(req, res) {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
      if (!ids.length) return error(res, '请选择要分析的房源', 400);

      const placeholders = ids.map(() => '?').join(',');
      const properties = await query(
        `SELECT id, community, district, bedrooms, price, price_value, publisher_name, property_code, description, content_hash, created_at
         FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL AND id IN (${placeholders}) ORDER BY created_at DESC`,
        ids
      );

      const duplicateGroups = buildDuplicateCandidates(properties);
      const duplicateCount = duplicateGroups.reduce((sum, g) => sum + Math.max(0, g.items.length - 1), 0);
      const summary = duplicateGroups.length
        ? `发现 ${duplicateGroups.length} 组疑似重复房源，建议删除 ${duplicateCount} 条重复记录。`
        : '未发现疑似重复房源。';

      return success(res, { duplicate_groups: duplicateGroups, summary, group_count: duplicateGroups.length, duplicate_count: duplicateCount });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 从朋友圈原始数据同步媒体（图片/视频）到解析房源
   * 当解析房源没有 media_urls 但关联的朋友圈有 media_list 时，自动同步
   */
  async _syncMomentMedia(prop) {
    try {
      let existingMedia = prop.media_urls;
      if (typeof existingMedia === 'string') {
        try { existingMedia = JSON.parse(existingMedia); } catch { existingMedia = []; }
      }
      if (Array.isArray(existingMedia) && existingMedia.length > 0) return;

      if (!prop.moment_id) return;

      const moments = await query(
        'SELECT media_list, local_media_urls, media_type FROM wechat_robot_moments WHERE moment_id = ? LIMIT 1',
        [prop.moment_id]
      );
      if (!moments.length) return;

      const moment = moments[0];
      let mediaList = moment.local_media_urls || moment.media_list;
      if (typeof mediaList === 'string') {
        try { mediaList = JSON.parse(mediaList); } catch { mediaList = []; }
      }
      if (!Array.isArray(mediaList) || !mediaList.length) return;

      const mediaUrls = mediaList.map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.url || item.thumb || item.src || '';
        return '';
      }).filter(Boolean);

      if (!mediaUrls.length) return;

      await query(
        'UPDATE wechat_robot_expat_parsed_properties SET media_urls = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(mediaUrls), prop.id]
      );
      console.log(`[PropertyLibrary._syncMomentMedia] Synced ${mediaUrls.length} media items from moment ${prop.moment_id} to property #${prop.id}`);
    } catch (err) {
      console.error('[PropertyLibrary._syncMomentMedia] Error:', err.message);
    }
  }

  /**
   * 下载外部媒体URL到本地，返回本地路径
   * @param {string} url - 外部图片/视频URL
   * @param {object} opts - { community, propertyCode } 按小区+房源编号建立独立文件夹
   */
  async _downloadMediaToLocal(url, opts = {}) {
    const { community = '', propertyCode = '', propId = '' } = opts;
    const externalDomains = ['qpic.cn', 'video.qq.com', 'wx.qlogo.cn', 'mmbiz.qpic.cn',
      'szangels.com', 'imgcache.qq.com', 'hkimg.qq.com', 'wtimg.qq.com'];
    try {
      const parsed = new URL(url);
      if (!externalDomains.some(d => parsed.hostname.endsWith(d))) {
        return url;
      }
    } catch {
      return url;
    }

    try {
      const isVideo = url.includes('video.qq.com') || /\.(mp4|mov|avi|m4v)(\?|$)/i.test(url);
      const subDir = isVideo ? 'videos' : 'images';
      const ext = isVideo ? '.mp4' : '.jpg';
      const uploadBase = process.env.UPLOAD_PATH || 'public/uploads';
      const uploadDir = path.join(process.cwd(), uploadBase, subDir);
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      // 按小区+房源编号建立子文件夹；无房源编号时用 temp_{propId} 占位，发布后由 _renamePropertyMediaFolder 重命名
      if (community) {
        const safeCommunity = String(community).replace(/[\/\\:*?"<>|]/g, '_');
        const folderName = propertyCode
          ? `${safeCommunity}_${propertyCode}`
          : (propId ? `${safeCommunity}_temp_${propId}` : safeCommunity);
        const subFolder = path.join(uploadDir, folderName);
        if (!fs.existsSync(subFolder)) fs.mkdirSync(subFolder, { recursive: true });
      }

      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 10);
      const filename = `${isVideo ? 'video' : 'image'}_${timestamp}_${rand}${ext}`;
      let filePath;
      if (community) {
        const safeCommunity = String(community).replace(/[\/\\:*?"<>|]/g, '_');
        const folderName = propertyCode
          ? `${safeCommunity}_${propertyCode}`
          : (propId ? `${safeCommunity}_temp_${propId}` : safeCommunity);
        filePath = path.join(uploadDir, folderName, filename);
      } else {
        filePath = path.join(uploadDir, filename);
      }

      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 30000,
        headers: { 'Referer': '' },
      });

      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // 返回带文件夹结构的路径
      if (community) {
        const safeCommunity = String(community).replace(/[\/\\:*?"<>|]/g, '_');
        const folderName = propertyCode
          ? `${safeCommunity}_${propertyCode}`
          : (propId ? `${safeCommunity}_temp_${propId}` : safeCommunity);
        return `/uploads/${subDir}/${folderName}/${filename}`;
      }
      return `/uploads/${subDir}/${filename}`;
    } catch (err) {
      console.error('[PropertyLibrary._downloadMediaToLocal] Failed:', url, err.message);
      return url;
    }
  }

  /**
   * 为指定房源下载所有外部媒体到本地，按小区+房源编号建立文件夹
   */
  async _downloadPropertyMedia(propId) {
    try {
      const [prop] = await query(
        'SELECT id, community, property_code, media_urls, local_images FROM wechat_robot_expat_parsed_properties WHERE id = ?',
        [propId]
      );
      if (!prop) return;

      let mediaUrls = [];
      try {
        mediaUrls = typeof prop.media_urls === 'string' ? JSON.parse(prop.media_urls || '[]') : (prop.media_urls || []);
      } catch { return; }

      if (!Array.isArray(mediaUrls) || !mediaUrls.length) return;

      const externalDomains = ['qpic.cn', 'video.qq.com', 'wx.qlogo.cn', 'mmbiz.qpic.cn',
        'szangels.com', 'imgcache.qq.com', 'hkimg.qq.com', 'wtimg.qq.com'];
      const hasExternal = mediaUrls.some(u => {
        try { return externalDomains.some(d => new URL(u).hostname.endsWith(d)); } catch { return false; }
      });
      if (!hasExternal) return;

      const community = prop.community || '';
      const propertyCode = prop.property_code || '';

      const localUrls = [];
      for (const url of mediaUrls) {
        const localUrl = await this._downloadMediaToLocal(url, { community, propertyCode, propId: prop.id });
        localUrls.push(localUrl);
      }

      await query(
        'UPDATE wechat_robot_expat_parsed_properties SET media_urls = ?, local_images = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(localUrls), JSON.stringify(localUrls), propId]
      );
      console.log(`[PropertyLibrary] Downloaded ${localUrls.length} media files for property #${propId} (community: ${community})`);
    } catch (err) {
      console.error('[PropertyLibrary._downloadPropertyMedia]', err.message);
    }
  }

  /**
   * 安全重命名媒体文件夹（小区名_房源编号）
   * 发布时若房源尚无正式编号，先以临时ID下载媒体；发布后用正式编号重命名文件夹并更新DB路径
   */
  async _renamePropertyMediaFolder(propId, community, propertyCode) {
    if (!community || !propertyCode) return;
    const fsSync = require('fs');
    const safeCommunity = String(community).replace(/[\/\\:*?"<>|]/g, '_');
    const uploadBase = process.env.UPLOAD_PATH || 'public/uploads';
    const uploadRoot = path.join(process.cwd(), uploadBase);
    const subDirs = ['images', 'videos'];

    for (const subDir of subDirs) {
      const oldFolderName = `${safeCommunity}_temp_${propId}`;
      const newFolderName = `${safeCommunity}_${propertyCode}`;
      const oldPath = path.join(uploadRoot, subDir, oldFolderName);
      const newPath = path.join(uploadRoot, subDir, newFolderName);

      try {
        if (fsSync.existsSync(oldPath) && !fsSync.existsSync(newPath)) {
          fsSync.renameSync(oldPath, newPath);
          console.log(`[PropertyLibrary] Renamed media folder: ${oldFolderName} -> ${newFolderName}`);

          const [prop] = await query(
            'SELECT media_urls, local_images FROM wechat_robot_expat_parsed_properties WHERE id = ?',
            [propId]
          );
          if (prop) {
            for (const field of ['media_urls', 'local_images']) {
              let urls = [];
              try { urls = typeof prop[field] === 'string' ? JSON.parse(prop[field] || '[]') : (prop[field] || []); } catch {}
              if (!Array.isArray(urls)) continue;

              const updated = urls.map(u => {
                const s = typeof u === 'string' ? u : (u?.url || u?.thumb || '');
                if (!s.startsWith('/uploads/')) return u;
                return s.replace(`/uploads/${subDir}/${oldFolderName}/`, `/uploads/${subDir}/${newFolderName}/`);
              });

              await query(
                `UPDATE wechat_robot_expat_parsed_properties SET ${field} = ?, updated_at = NOW() WHERE id = ?`,
                [JSON.stringify(updated), propId]
              );
            }
          }
        }
      } catch (err) {
        console.warn('[PropertyLibrary._renamePropertyMediaFolder] Skip rename:', err.message);
      }
    }
  }

  /**
   * 从朋友圈解析列表发布到房源库（批量）
   * 设置 is_listed=1 并为无编号的房源生成 property_code
   * 发布时自动从朋友圈同步媒体文件并下载到本地
   */
  async publishToLibrary(req, res) {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
      if (!ids.length) return error(res, '请选择要发布的房源', 400);

      const placeholders = ids.map(() => '?').join(',');
      const properties = await query(
        `SELECT id, property_code, is_listed, moment_id, media_urls, community, original_content, price, bedrooms, latitude, longitude FROM wechat_robot_expat_parsed_properties WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
        ids
      );

      if (!properties.length) return error(res, '未找到有效房源', 404);

      let publishedCount = 0;
      let skippedCount = 0;
      let rejectedCount = 0;

      for (const prop of properties) {
        if (prop.is_listed === 1) {
          skippedCount++;
          continue;
        }

        // 发布前验证内容质量：确保是真实房源而非推广/广告
        const content = String(prop.original_content || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200B}-\u{200D}\[\]【】\s]/gu, '');
        const isTooShort = content.length < 15;
        const hasNoPrice = !prop.price && !prop.bedrooms;
        const communityIsGeneric = !prop.community || prop.community === '上海' || prop.community === '微信同号';
        if (isTooShort && hasNoPrice && communityIsGeneric) {
          rejectedCount++;
          continue;
        }

        await this._syncMomentMedia(prop);
        await this._downloadPropertyMedia(prop.id);

        await this._autoFillCoords(prop);

        const code = prop.property_code || await this._generatePropertyCode();
        await query(
          "UPDATE wechat_robot_expat_parsed_properties SET is_listed = 1, status = 'published', property_code = ?, updated_at = NOW() WHERE id = ?",
          [code, prop.id]
        );

        // 下载时用 temp_{id} 占位文件夹，发布后重命名为正式房源编号
        if (prop.community && !prop.property_code && code) {
          await this._renamePropertyMediaFolder(prop.id, prop.community, code);
        }
        publishedCount++;
      }

      return success(res, { published: publishedCount, skipped: skippedCount, rejected: rejectedCount },
        `成功发布 ${publishedCount} 条房源到房源库` + (skippedCount > 0 ? `，${skippedCount} 条已在库中跳过` : '') + (rejectedCount > 0 ? `，${rejectedCount} 条因内容质量不达标被过滤` : ''));
    } catch (err) {
      console.error('[PropertyLibrary.publishToLibrary]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 从房源库移除（仅设is_listed=0，不删除数据）
   */
  async unpublishFromLibrary(req, res) {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
      if (!ids.length) return error(res, '请选择要移除的房源', 400);

      const placeholders = ids.map(() => '?').join(',');
      await query(
        `UPDATE wechat_robot_expat_parsed_properties SET is_listed = 0, status = 'draft', updated_at = NOW() WHERE id IN (${placeholders})`,
        ids
      );
      return success(res, null, `已从房源库移除 ${ids.length} 条房源`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 自动从POI字典补全房源经纬度
   */
  async _autoFillCoords(prop) {
    try {
      const lat = Number(prop.latitude);
      const lng = Number(prop.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) return;
      if (!prop.community) return;

      const rows = await query(
        `SELECT latitude, longitude FROM property_community_dict
         WHERE community_name = ? AND latitude IS NOT NULL AND latitude != 0
         LIMIT 1`,
        [prop.community]
      );

      if (!rows.length) {
        const fuzzy = await query(
          `SELECT latitude, longitude FROM property_community_dict
           WHERE community_name LIKE ? AND latitude IS NOT NULL AND latitude != 0
           ORDER BY LENGTH(community_name) ASC LIMIT 1`,
          [`%${prop.community}%`]
        );
        if (fuzzy.length) {
          await query(
            'UPDATE wechat_robot_expat_parsed_properties SET latitude = ?, longitude = ? WHERE id = ?',
            [fuzzy[0].latitude, fuzzy[0].longitude, prop.id]
          );
        }
        return;
      }

      await query(
        'UPDATE wechat_robot_expat_parsed_properties SET latitude = ?, longitude = ? WHERE id = ?',
        [rows[0].latitude, rows[0].longitude, prop.id]
      );
    } catch (err) {
      console.error('[PropertyLibrary._autoFillCoords]', err);
    }
  }

  /**
   * 生成房源编号，格式: EXP{YYYYMMDD}-{5位全局序号}
   */
  async _generatePropertyCode() {
    const now = new Date();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');

    const [maxRow] = await query(
      `SELECT property_code FROM wechat_robot_expat_parsed_properties WHERE property_code IS NOT NULL AND property_code LIKE 'EXP%' ORDER BY CAST(SUBSTRING_INDEX(property_code, '-', -1) AS UNSIGNED) DESC LIMIT 1`
    );

    let seq = 1;
    if (maxRow && maxRow.property_code) {
      const match = maxRow.property_code.match(/-(\d+)$/);
      if (match) seq = parseInt(match[1], 10) + 1;
    }

    return `EXP${dateStr}-${String(seq).padStart(5, '0')}`;
  }

  /**
   * 上传房源媒体文件（图片/视频）
   */
  async uploadPropertyMedia(req, res) {
    try {
      if (!req.file) return error(res, '没有上传文件', 400);

      const file = req.file;
      const isVideo = file.mimetype.startsWith('video/');
      const subDir = isVideo ? 'videos' : 'images';
      const ext = path.extname(file.originalname) || (isVideo ? '.mp4' : '.jpg');
      const uploadBase = process.env.UPLOAD_PATH || 'public/uploads';
      const uploadDir = path.join(process.cwd(), uploadBase, subDir);

      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 10);
      const filename = `property_${timestamp}_${rand}${ext}`;
      const filePath = path.join(uploadDir, filename);

      fs.writeFileSync(filePath, file.buffer);

      const url = `/uploads/${subDir}/${filename}`;
      return success(res, { url, type: isVideo ? 'video' : 'image', filename }, '上传成功');
    } catch (err) {
      console.error('[PropertyLibrary.uploadPropertyMedia]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 根据小区名从POI数据获取经纬度
   * GET /admin/property-library/geocode-community
   */
  async geocodeCommunity(req, res) {
    try {
      const { community, street, district } = req.query;
      if (!community && !street) {
        return error(res, '请提供小区名或街道地址', 400);
      }

      let result = null;

      if (community) {
        const rows = await query(
          `SELECT community_name, latitude, longitude, district, address, street
           FROM property_community_dict
           WHERE community_name = ? AND latitude IS NOT NULL AND latitude != 0
           LIMIT 1`,
          [community]
        );
        if (rows.length) {
          result = {
            latitude: rows[0].latitude,
            longitude: rows[0].longitude,
            source: 'poi',
            community: rows[0].community_name,
            address: rows[0].address || rows[0].street || '',
          };
        }

        if (!result) {
          const fuzzyRows = await query(
            `SELECT community_name, latitude, longitude, district, address, street
             FROM property_community_dict
             WHERE community_name LIKE ? AND latitude IS NOT NULL AND latitude != 0
             ORDER BY LENGTH(community_name) ASC
             LIMIT 1`,
            [`%${community}%`]
          );
          if (fuzzyRows.length) {
            result = {
              latitude: fuzzyRows[0].latitude,
              longitude: fuzzyRows[0].longitude,
              source: 'poi_fuzzy',
              community: fuzzyRows[0].community_name,
              address: fuzzyRows[0].address || fuzzyRows[0].street || '',
            };
          }
        }
      }

      if (result) {
        return success(res, result);
      }

      return success(res, null, '未找到匹配的经纬度');
    } catch (err) {
      console.error('[PropertyLibrary.geocodeCommunity]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 重新下载指定房源的外部媒体到本地
   * POST /admin/property-library/:id/redownload-media
   */
  async redownloadMedia(req, res) {
    try {
      const { id } = req.params;
      const [prop] = await query(
        'SELECT id, community, property_code, media_urls, moment_id FROM wechat_robot_expat_parsed_properties WHERE id = ?',
        [id]
      );
      if (!prop) return error(res, '房源不存在', 404);

      let mediaUrls = [];
      try {
        mediaUrls = typeof prop.media_urls === 'string' ? JSON.parse(prop.media_urls || '[]') : (prop.media_urls || []);
      } catch { mediaUrls = []; }

      // 如果没有媒体且有moment_id，先从朋友圈同步
      if ((!Array.isArray(mediaUrls) || !mediaUrls.length) && prop.moment_id) {
        await this._syncMomentMedia(prop);
        const [refreshed] = await query('SELECT media_urls FROM wechat_robot_expat_parsed_properties WHERE id = ?', [id]);
        try {
          mediaUrls = typeof refreshed.media_urls === 'string' ? JSON.parse(refreshed.media_urls || '[]') : (refreshed.media_urls || []);
        } catch { mediaUrls = []; }
      }

      if (!Array.isArray(mediaUrls) || !mediaUrls.length) {
        return success(res, { media_urls: [], downloaded: 0, failed: 0 }, '该房源没有媒体文件');
      }

      const community = prop.community || '';
      const propertyCode = prop.property_code || '';

      const localUrls = [];
      let downloaded = 0;
      let failed = 0;
      for (const url of mediaUrls) {
        if (!url || typeof url !== 'string') continue;
        if (url.startsWith('/uploads/')) {
          localUrls.push(url);
          continue;
        }
        const localUrl = await this._downloadMediaToLocal(url, { community, propertyCode, propId: prop.id });
        if (localUrl !== url && localUrl.startsWith('/uploads/')) {
          localUrls.push(localUrl);
          downloaded++;
        } else {
          localUrls.push(url);
          failed++;
        }
      }

      await query(
        'UPDATE wechat_robot_expat_parsed_properties SET media_urls = ?, local_images = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(localUrls), JSON.stringify(localUrls.filter(u => u.startsWith('/uploads/'))), id]
      );

      return success(res, { media_urls: localUrls, downloaded, failed },
        `下载完成：${downloaded}张成功${failed > 0 ? `，${failed}张失败（外部链接已过期）` : ''}`);
    } catch (err) {
      console.error('[PropertyLibrary.redownloadMedia]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 批量为上架房源重新下载外部媒体到本地
   * POST /admin/property-library/batch-redownload-media
   */
  async batchRedownloadMedia(req, res) {
    try {
      const externalDomains = ['qpic.cn', 'video.qq.com', 'wx.qlogo.cn', 'mmbiz.qpic.cn',
        'szangels.com', 'imgcache.qq.com', 'hkimg.qq.com', 'wtimg.qq.com'];
      const properties = await query(
        `SELECT id, community, property_code, media_urls FROM wechat_robot_expat_parsed_properties
         WHERE is_listed = 1 AND deleted_at IS NULL
           AND (
             (media_urls IS NOT NULL AND media_urls != '' AND media_urls != '[]')
             OR (local_images IS NOT NULL AND local_images != '' AND local_images != '[]')
           )
         ORDER BY id DESC LIMIT 200`
      );

      let total = 0;
      let downloaded = 0;
      let failed = 0;
      let skipped = 0;

      for (const prop of properties) {
        try {
          let mediaUrls = [];
          try {
            mediaUrls = typeof prop.media_urls === 'string' ? JSON.parse(prop.media_urls || '[]') : (prop.media_urls || []);
          } catch { mediaUrls = []; }

          const localUrls = [];
          let propDownloaded = 0;
          let propFailed = 0;
          const community = prop.community || '';
          const propertyCode = prop.property_code || '';

          for (const url of mediaUrls) {
            if (!url || typeof url !== 'string') continue;
            if (url.startsWith('/uploads/')) {
              localUrls.push(url);
              continue;
            }
            const localUrl = await this._downloadMediaToLocal(url, { community, propertyCode, propId: prop.id });
            if (localUrl !== url && localUrl.startsWith('/uploads/')) {
              localUrls.push(localUrl);
              propDownloaded++;
            } else {
              localUrls.push(url);
              if (!externalDomains.some(d => { try { return new URL(url).hostname.endsWith(d); } catch { return false; } })) {
                propFailed++;
              }
            }
          }

          if (localUrls.length > 0) {
            await query(
              'UPDATE wechat_robot_expat_parsed_properties SET media_urls = ?, local_images = ?, updated_at = NOW() WHERE id = ?',
              [JSON.stringify(localUrls), JSON.stringify(localUrls.filter(u => u.startsWith('/uploads/'))), prop.id]
            );
          }
          downloaded += propDownloaded;
          failed += propFailed;
          total++;
        } catch { skipped++; }
      }

      return success(res, { processed: total, downloaded, failed, skipped },
        `处理完成：${total}套房源，${downloaded}张新下载，${failed}张失败`);
    } catch (err) {
      console.error('[PropertyLibrary.batchRedownloadMedia]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 获取房源默认封面图片
   * GET /admin/property-library/default-image
   */
  async getDefaultImage(req, res) {
    try {
      const { getDefaultCoverImage } = require('../../utils/snsXmlMediaParser');
      const url = await getDefaultCoverImage(query);
      return success(res, { url });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 设置房源默认封面图片（上传或指定URL）
   * POST /admin/property-library/default-image
   */
  async setDefaultImage(req, res) {
    try {
      let url = req.body?.url || '';

      // 如果有上传文件，保存到本地
      if (req.file) {
        const file = req.file;
        const ext = path.extname(file.originalname) || '.jpg';
        const uploadBase = process.env.UPLOAD_PATH || 'public/uploads';
        const uploadDir = path.join(process.cwd(), uploadBase, 'defaults');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const filename = `property_default_cover${ext}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, file.buffer);
        url = `/uploads/defaults/${filename}`;
      }

      if (!url) return error(res, '请上传图片或提供URL', 400);

      await SystemSetting.set('default_property_cover_image', url);
      return success(res, { url }, '默认图片设置成功');
    } catch (err) {
      console.error('[PropertyLibrary.setDefaultImage]', err);
      return error(res, err.message, 500);
    }
  }

  /**
   * 获取房源库发布设置
   * GET /admin/property-library/publish-settings
   */
  async getPublishSettings(req, res) {
    try {
      const settingsJson = await SystemSetting.get('property_library_publish_settings', '{}');
      let settings = {};
      try { settings = JSON.parse(settingsJson); } catch { settings = {}; }
      return success(res, settings);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 保存房源库发布设置
   * POST /admin/property-library/publish-settings
   */
  async savePublishSettings(req, res) {
    try {
      const { selected_friends = [], time_start = '', time_end = '', time_quick = null } = req.body;
      const settings = {
        selected_friends: Array.isArray(selected_friends) ? selected_friends : [],
        time_start: time_start || '',
        time_end: time_end || '',
        time_quick: (time_quick !== undefined && time_quick !== null) ? Number(time_quick) : null,
      };
      await SystemSetting.set('property_library_publish_settings', JSON.stringify(settings), 'json');
      return success(res, settings, '发布设置保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new PropertyLibraryController();
