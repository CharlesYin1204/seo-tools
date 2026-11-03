/**
 * 定时任务：自动为缺少POI的房源小区通过高德地图创建POI记录
 * 每轮最多处理 BATCH_SIZE 个小区，避免API限流
 * 创建POI后自动将数据回填到对应的房源记录
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

let isRunning = false;
let lastRunStats = { lastRun: null, created: 0, enriched: 0, remaining: 0 };

const BATCH_SIZE = 5;

async function autoEnrichPOIJob() {
  if (isRunning) return;
  isRunning = true;

  try {
    // 查找有小区名但无POI的去重小区列表
    const noPOISql = `
      SELECT DISTINCT p.community, p.district
      FROM wechat_robot_expat_parsed_properties p
      LEFT JOIN property_community_dict poi ON poi.community_name = p.community AND poi.is_enabled = 1
      WHERE p.community IS NOT NULL AND p.community != '' AND p.deleted_at IS NULL
        AND CHAR_LENGTH(p.community) >= 2
        AND poi.id IS NULL
      ORDER BY p.created_at DESC
      LIMIT ?`;
    const noPOIRows = await query(noPOISql, [BATCH_SIZE]);
    const communities = Array.isArray(noPOIRows) ? noPOIRows : [];

    if (communities.length === 0) {
      lastRunStats = { lastRun: new Date().toISOString(), created: 0, enriched: 0, remaining: 0 };
      return;
    }

    // 动态加载 amapEnrichCommunity
    const { amapEnrichCommunity, matchStandardMetroStation } = getAmapFunctions();
    let created = 0;
    let enriched = 0;

    for (const item of communities) {
      try {
        const enrichResult = await amapEnrichCommunity(item.community, item.district || null);
        if (!enrichResult.success) continue;
        // 限流：每次请求间隔500ms，避免触发API频率限制
        await new Promise(r => setTimeout(r, 500));

        const insertData = {
          community_name: item.community,
          district: enrichResult.district || item.district || null,
          source: 'auto_enrich',
          is_enabled: 1,
        };
        if (enrichResult.latitude) insertData.latitude = enrichResult.latitude;
        if (enrichResult.longitude) insertData.longitude = enrichResult.longitude;
        if (enrichResult.street) insertData.street = enrichResult.street;
        if (enrichResult.address) insertData.address = enrichResult.address;
        if (enrichResult.board) insertData.board = enrichResult.board;
        if (enrichResult.metro_station) insertData.nearest_metro_station = enrichResult.metro_station;
        if (enrichResult.metro_line) insertData.nearest_metro_line = enrichResult.metro_line;
        if (enrichResult.metro_distance) insertData.nearest_metro_distance = enrichResult.metro_distance;

        const cols = Object.keys(insertData);
        const phs = cols.map(() => '?').join(', ');
        await query(
          `INSERT IGNORE INTO property_community_dict (${cols.join(', ')}, created_at, updated_at) VALUES (${phs}, NOW(), NOW())`,
          Object.values(insertData)
        );
        created++;

        // 回填到对应的房源记录
        const updateFields = {};
        if (insertData.district) updateFields.district = insertData.district;
        if (insertData.latitude) updateFields.latitude = insertData.latitude;
        if (insertData.longitude) updateFields.longitude = insertData.longitude;
        if (insertData.nearest_metro_station) updateFields.metro_stations = insertData.nearest_metro_station;
        if (insertData.nearest_metro_line) updateFields.metro_lines = insertData.nearest_metro_line;
        if (insertData.nearest_metro_distance) updateFields.metro_distance = insertData.nearest_metro_distance;

        if (Object.keys(updateFields).length > 0) {
          updateFields.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const setClauses = [];
          const vals = [];
          for (const [k, v] of Object.entries(updateFields)) {
            // 只更新空值的字段，不覆盖已有数据
            if (k === 'updated_at') {
              setClauses.push(`${k} = ?`);
              vals.push(v);
            } else {
              setClauses.push(`${k} = COALESCE(NULLIF(${k}, ''), ?)`);
              vals.push(v);
            }
          }
          vals.push(item.community);
          const updateResult = await query(
            `UPDATE wechat_robot_expat_parsed_properties SET ${setClauses.join(', ')} WHERE community = ? AND deleted_at IS NULL AND (district IS NULL OR district = '' OR latitude IS NULL OR latitude = 0 OR metro_stations IS NULL OR metro_stations = '')`,
            vals
          );
          const affected = updateResult?.affectedRows || updateResult?.changedRows || (Array.isArray(updateResult) ? updateResult[0]?.affectedRows : 0) || 0;
          enriched += affected;
        }
      } catch (e) {
        logger.warn('[自动POI补全] 单条失败', { community: item.community, error: e.message });
      }
    }

    // 统计剩余
    const countRows = await query(`
      SELECT COUNT(DISTINCT p.community) as cnt
      FROM wechat_robot_expat_parsed_properties p
      LEFT JOIN property_community_dict poi ON poi.community_name = p.community AND poi.is_enabled = 1
      WHERE p.community IS NOT NULL AND p.community != '' AND p.deleted_at IS NULL
        AND CHAR_LENGTH(p.community) >= 2 AND poi.id IS NULL
    `);
    const countRow = Array.isArray(countRows) && Array.isArray(countRows[0]) ? countRows[0]?.[0] : (Array.isArray(countRows) ? countRows[0] : countRows);
    const remaining = countRow?.cnt || 0;

    lastRunStats = { lastRun: new Date().toISOString(), created, enriched, remaining };

    if (created > 0) {
      logger.info(`[自动POI补全] 创建${created}条POI, 回填${enriched}条房源, 剩余${remaining}个小区待处理`);
    }
  } catch (e) {
    logger.error('[自动POI补全] 异常', { error: e.message });
  } finally {
    isRunning = false;
  }
}

/**
 * 获取高德查询函数（延迟加载避免循环依赖）
 */
function getAmapFunctions() {
  // amapEnrichCommunity 是 PropertySettingsController.js 文件中的模块级函数
  // 需要直接导入该文件来获取
  const path = require('path');
  const settingsPath = path.join(__dirname, '../controllers/admin/PropertySettingsController.js');
  // 由于 amapEnrichCommunity 不在 class exports 中，需要用另一种方式
  // 直接使用 query + https 实现一个轻量版
  return { amapEnrichCommunity: amapEnrichCommunityLight };
}

/**
 * 轻量版高德小区信息查询（独立于 PropertySettingsController）
 */
async function amapEnrichCommunityLight(communityName, existingDistrict) {
  const settingsRows = await query('SELECT api_key FROM system_map_settings WHERE is_enabled = 1 LIMIT 1');
  const settings = Array.isArray(settingsRows) && Array.isArray(settingsRows[0]) ? settingsRows[0]?.[0] : (Array.isArray(settingsRows) ? settingsRows[0] : settingsRows);
  if (!settings?.api_key) return { success: false, message: 'API密钥未配置' };
  const apiKey = settings.api_key;

  function safeStr(val) {
    if (!val || Array.isArray(val)) return '';
    return typeof val === 'string' ? val.trim() : String(val).trim();
  }

  const result = { success: false };
  const searchKeyword = existingDistrict ? `上海${existingDistrict}${communityName}` : `上海${communityName}`;

  // 1. POI搜索（住宅小区类型）
  const poiData = await amapRequest(
    `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(searchKeyword)}&types=120000|120100|120200|120300|120201|120302&city=上海&citylimit=true&offset=5&output=JSON`
  );

  let location = null;

  if (poiData?.status === '1' && poiData.pois?.length > 0) {
    const exactMatch = poiData.pois.find(p => p.name === communityName) || poiData.pois[0];
    const loc = safeStr(exactMatch.location);
    if (loc) {
      const [lng, lat] = loc.split(',').map(Number);
      if (lat > 30 && lat < 32 && lng > 120 && lng < 123) {
        result.latitude = lat;
        result.longitude = lng;
        location = loc;
      }
    }
    const adname = safeStr(exactMatch.adname);
    if (adname) result.district = adname;
    const addr = safeStr(exactMatch.address);
    if (addr && addr.length > 2) {
      result.address = addr;
      const streetMatch = addr.match(/([^\s,，]+路\d*弄?)/);
      if (streetMatch) result.street = streetMatch[1];
    }
    const biz = safeStr(exactMatch.business);
    if (biz) result.board = biz.split(';')[0];
  } else {
    // 2. 退化为地理编码
    const geocodeData = await amapRequest(
      `https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${encodeURIComponent(`上海市${existingDistrict || ''}${communityName}`)}&city=上海`
    );
    if (geocodeData?.status === '1' && geocodeData.geocodes?.[0]) {
      const geo = geocodeData.geocodes[0];
      const loc = safeStr(geo.location);
      if (loc) {
        const [lng, lat] = loc.split(',').map(Number);
        if (lat > 30 && lat < 32 && lng > 120 && lng < 123) {
          result.latitude = lat;
          result.longitude = lng;
          location = loc;
        }
      }
      const dist = safeStr(geo.district);
      if (dist) result.district = dist;
    }
  }

  if (!location && !result.district) {
    return { success: false, message: '高德地图未找到该小区' };
  }

  // 3. 周边地铁搜索
  if (location) {
    try {
      const metroData = await amapRequest(
        `https://restapi.amap.com/v3/place/around?key=${apiKey}&location=${location}&types=150500&radius=3000&offset=20&output=JSON&sortrule=distance`
      );
      if (metroData?.status === '1' && metroData.pois?.length > 0) {
        const stations = metroData.pois.filter(p => p.typecode === '150500');
        if (stations.length > 0) {
          const targetDistrict = result.district || existingDistrict;
          let chosen = null;
          if (targetDistrict) chosen = stations.find(p => p.adname === targetDistrict);
          if (!chosen) chosen = stations[0];

          const rawStation = chosen.name
            .replace(/\d+号口$/g, '').replace(/[（(]地铁站[）)]/g, '')
            .replace(/地铁站$/g, '').replace(/^(一大会址[·.]?)/, '')
            .replace(/^支线/, '').trim();

          let rawLines = '';
          if (chosen.address && typeof chosen.address === 'string') {
            const lineMatches = chosen.address.match(/(\d+号线|浦江线|磁浮线)/g);
            if (lineMatches) rawLines = [...new Set(lineMatches)].join(',');
          }

          // 尝试匹配标准站名
          try {
            const cleanedStation = rawStation.replace(/站$/, '');
            const stdRowsRaw = await query(
              `SELECT ms.name_cn AS station_name, ml.name_cn AS line_name
               FROM property_metro_stations ms
               JOIN property_metro_lines ml ON ms.line_id = ml.id
               WHERE ms.name_cn = ? OR ms.name_cn = ? LIMIT 20`,
              [rawStation, cleanedStation]
            );
            const stdList = Array.isArray(stdRowsRaw) && Array.isArray(stdRowsRaw[0]) ? stdRowsRaw[0] : (Array.isArray(stdRowsRaw) ? stdRowsRaw : []);
            if (stdList.length > 0) {
              const exactM = stdList.find(s => s.station_name === rawStation);
              if (exactM) {
                result.metro_station = rawStation;
                result.metro_line = [...new Set(stdList.filter(s => s.station_name === rawStation).map(s => s.line_name))].join(',');
              } else {
                const cleanM = stdList.find(s => s.station_name === cleanedStation);
                if (cleanM) {
                  result.metro_station = cleanedStation;
                  result.metro_line = [...new Set(stdList.filter(s => s.station_name === cleanedStation).map(s => s.line_name))].join(',');
                } else {
                  result.metro_station = stdList[0].station_name;
                  result.metro_line = [...new Set(stdList.filter(s => s.station_name === stdList[0].station_name).map(s => s.line_name))].join(',');
                }
              }
            } else {
              result.metro_station = cleanedStation !== rawStation ? cleanedStation : rawStation;
              result.metro_line = rawLines || null;
            }
          } catch {
            result.metro_station = rawStation;
            result.metro_line = rawLines || null;
          }

          result.metro_distance = chosen.distance ? parseInt(chosen.distance, 10) : null;
        }
      }
    } catch { /* 地铁搜索失败不阻塞 */ }
  }

  result.success = true;
  return result;
}

function amapRequest(url) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

function getStats() {
  return lastRunStats;
}

module.exports = { autoEnrichPOIJob, getStats };
