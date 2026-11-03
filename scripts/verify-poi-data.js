/**
 * POI数据校验脚本 - 通过高德地图API批量校验并修正小区POI数据
 * 
 * 校验项目：区域、经纬度、地铁线路和站点
 * 处理顺序：市中心区域优先，郊区最后
 * 
 * 使用方式：
 *   node scripts/verify-poi-data.js [--district=黄浦区] [--batch=50] [--offset=0] [--force] [--dry-run]
 *   
 *   --district  指定校验某个区域（不指定则按优先级逐区处理）
 *   --batch     每批处理数量（默认50，最大100）
 *   --offset    起始偏移量（用于断点续跑）
 *   --force     强制覆盖已有数据（默认仅修正有偏差的）
 *   --dry-run   仅检测不修改
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const https = require('https');

const DISTRICT_ORDER = [
  '黄浦区', '静安区', '徐汇区', '虹口区', '长宁区', '杨浦区', '普陀区',
  '浦东新区', '闵行区',
  '宝山区', '嘉定区', '松江区', '青浦区', '奉贤区', '金山区', '崇明区'
];

const COORD_THRESHOLD = 0.005;
const METRO_DISTANCE_SEARCH_RADIUS = 3000;
const API_DELAY_MS = 250;
const MAX_RETRIES = 2;

const args = parseArgs();
let pool;
let apiKey;
let totalProcessed = 0, totalCorrected = 0, totalFailed = 0;
const correctionLog = [];

async function main() {
  console.log('========================================');
  console.log('  POI数据校验 - 高德地图API校验工具');
  console.log('========================================');
  console.log(`模式: ${args.dryRun ? '仅检测(dry-run)' : (args.force ? '强制覆盖' : '智能校验')}`);
  console.log(`批次大小: ${args.batch}`);

  pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USERNAME || 'shexpatshome',
    password: process.env.DB_PASSWORD || 'shexpatshome',
    database: process.env.DB_DATABASE || 'shexpatshome',
    charset: 'utf8mb4',
    connectionLimit: 5,
    waitForConnections: true
  });

  const [keyRows] = await pool.query('SELECT api_key FROM system_map_settings WHERE is_enabled = 1 LIMIT 1');
  if (!keyRows || keyRows.length === 0 || !keyRows[0].api_key) {
    console.error('错误: 未找到启用的高德地图API Key');
    process.exit(1);
  }
  apiKey = keyRows[0].api_key;
  console.log(`API Key: ${apiKey.substring(0, 8)}...`);

  const districts = args.district ? [args.district] : DISTRICT_ORDER;

  for (const district of districts) {
    await processDistrict(district);
  }

  console.log('\n========================================');
  console.log('  校验完成 - 汇总报告');
  console.log('========================================');
  console.log(`总处理: ${totalProcessed}`);
  console.log(`总修正: ${totalCorrected}`);
  console.log(`总失败: ${totalFailed}`);

  if (correctionLog.length > 0) {
    console.log(`\n修正明细 (共${correctionLog.length}条):`);
    for (const log of correctionLog) {
      console.log(`  [${log.district}] ${log.name} (ID:${log.id}): ${log.changes.join('; ')}`);
    }
  }

  await pool.end();
}

async function processDistrict(district) {
  const [countRows] = await pool.query(
    'SELECT COUNT(*) as cnt FROM property_community_dict WHERE district = ? AND is_enabled = 1',
    [district]
  );
  const total = countRows[0].cnt;
  if (total === 0) {
    console.log(`\n[${district}] 无记录，跳过`);
    return;
  }

  console.log(`\n========== [${district}] 共 ${total} 条记录 ==========`);

  let offset = args.district ? (args.offset || 0) : 0;
  let districtProcessed = 0, districtCorrected = 0, districtFailed = 0;

  while (offset < total) {
    const batchSize = Math.min(args.batch, total - offset);
    const [rows] = await pool.query(
      `SELECT id, community_name, district, board, address, latitude, longitude, 
              nearest_metro_line, nearest_metro_station, nearest_metro_distance, street
       FROM property_community_dict 
       WHERE district = ? AND is_enabled = 1 
       ORDER BY id ASC LIMIT ? OFFSET ?`,
      [district, batchSize, offset]
    );

    if (rows.length === 0) break;

    console.log(`  处理第 ${offset + 1} ~ ${offset + rows.length} 条...`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (i > 0) await sleep(API_DELAY_MS);

        const result = await verifyAndCorrectRecord(row);
        districtProcessed++;
        totalProcessed++;

        if (result.corrected) {
          districtCorrected++;
          totalCorrected++;
        }
      } catch (err) {
        districtFailed++;
        totalFailed++;
        console.error(`    错误: ${row.community_name} (ID:${row.id}) - ${err.message}`);
      }
    }

    offset += rows.length;
    console.log(`  进度: ${Math.min(offset, total)}/${total} (修正${districtCorrected}条, 失败${districtFailed}条)`);
  }

  console.log(`  [${district}] 完成: 处理${districtProcessed}条, 修正${districtCorrected}条, 失败${districtFailed}条`);
}

async function verifyAndCorrectRecord(row) {
  const amapResult = await amapSearchCommunity(row.community_name, row.district);
  if (!amapResult.success) {
    return { corrected: false };
  }

  const updates = {};
  const changes = [];

  const amapDistrict = (typeof amapResult.district === 'string') ? amapResult.district : '';
  if (amapDistrict && amapDistrict !== row.district) {
    if (amapDistrict.endsWith('区') && DISTRICT_ORDER.includes(amapDistrict)) {
      updates.district = amapDistrict;
      changes.push(`区域: ${row.district} → ${amapDistrict}`);
    }
  }

  if (amapResult.latitude && amapResult.longitude) {
    const oldLat = parseFloat(row.latitude) || 0;
    const oldLng = parseFloat(row.longitude) || 0;
    const newLat = parseFloat(amapResult.latitude);
    const newLng = parseFloat(amapResult.longitude);

    if (oldLat === 0 || oldLng === 0) {
      updates.latitude = newLat;
      updates.longitude = newLng;
      changes.push(`坐标: 空 → ${newLat.toFixed(6)},${newLng.toFixed(6)}`);
    } else {
      const latDiff = Math.abs(oldLat - newLat);
      const lngDiff = Math.abs(oldLng - newLng);

      if (latDiff > COORD_THRESHOLD || lngDiff > COORD_THRESHOLD) {
        updates.latitude = newLat;
        updates.longitude = newLng;
        changes.push(`坐标偏差过大(${(latDiff * 111000).toFixed(0)}m/${(lngDiff * 111000 * Math.cos(oldLat * Math.PI / 180)).toFixed(0)}m): ${oldLat.toFixed(6)},${oldLng.toFixed(6)} → ${newLat.toFixed(6)},${newLng.toFixed(6)}`);
      }
    }
  }

  if (amapResult.metro_station && amapResult.metro_station !== '无') {
    const oldStation = row.nearest_metro_station || '';
    const oldLine = row.nearest_metro_line || '';

    if (!oldStation || oldStation === '无') {
      updates.nearest_metro_station = amapResult.metro_station;
      if (amapResult.metro_line) updates.nearest_metro_line = amapResult.metro_line;
      if (amapResult.metro_distance != null) updates.nearest_metro_distance = amapResult.metro_distance;
      changes.push(`地铁: 空 → ${amapResult.metro_line || ''}/${amapResult.metro_station}(${amapResult.metro_distance}m)`);
    } else {
      if (amapResult.metro_line && !oldLine) {
        updates.nearest_metro_line = amapResult.metro_line;
        changes.push(`线路: 空 → ${amapResult.metro_line}`);
      }

      if (args.force) {
        if (amapResult.metro_station !== oldStation) {
          updates.nearest_metro_station = amapResult.metro_station;
          changes.push(`站点: ${oldStation} → ${amapResult.metro_station}`);
        }
        if (amapResult.metro_line && amapResult.metro_line !== oldLine) {
          updates.nearest_metro_line = amapResult.metro_line;
          changes.push(`线路: ${oldLine} → ${amapResult.metro_line}`);
        }
        if (amapResult.metro_distance != null) {
          updates.nearest_metro_distance = amapResult.metro_distance;
        }
      }
    }
  }

  if (amapResult.board && (!row.board || row.board === '')) {
    updates.board = amapResult.board;
    changes.push(`板块: 空 → ${amapResult.board}`);
  }

  if (amapResult.address && (!row.address || row.address === '')) {
    updates.address = amapResult.address;
    changes.push(`地址: 空 → ${amapResult.address}`);
  }

  if (amapResult.street && (!row.street || row.street === '')) {
    updates.street = amapResult.street;
    changes.push(`街道: 空 → ${amapResult.street}`);
  }

  const cleanUpdates = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined && v !== null && v !== '' && !Number.isNaN(v)) {
      cleanUpdates[k] = v;
    }
  }

  if (Object.keys(cleanUpdates).length === 0) {
    return { corrected: false };
  }

  if (args.dryRun) {
    console.log(`    [检测] ${row.community_name}: ${changes.join('; ')}`);
    correctionLog.push({ id: row.id, name: row.community_name, district: row.district, changes });
    return { corrected: true };
  }

  const setClauses = Object.keys(cleanUpdates).map(k => `\`${k}\` = ?`).join(', ');
  const values = [...Object.values(cleanUpdates), row.id];
  await pool.query(
    `UPDATE property_community_dict SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
    values
  );

  console.log(`    [修正] ${row.community_name}: ${changes.join('; ')}`);
  correctionLog.push({ id: row.id, name: row.community_name, district: row.district, changes });
  return { corrected: true };
}

async function amapSearchCommunity(communityName, existingDistrict) {
  const result = { success: false };

  const searchKeyword = existingDistrict ? `上海${existingDistrict}${communityName}` : `上海${communityName}`;
  const poiUrl = `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(searchKeyword)}&types=120000|120100|120200|120300|120201|120302&city=上海&citylimit=true&offset=5&output=JSON`;

  let poiData = null;
  for (let retry = 0; retry <= MAX_RETRIES; retry++) {
    try {
      poiData = await httpGet(poiUrl);
      if (poiData?.infocode === '10003') {
        console.error(`    API限额已用完，等待60秒后重试...`);
        await sleep(60000);
        continue;
      }
      break;
    } catch (err) {
      if (retry < MAX_RETRIES) {
        await sleep(1000 * (retry + 1));
        continue;
      }
      return result;
    }
  }

  let location = null;

  function safeStr(val) {
    if (!val || Array.isArray(val)) return '';
    return typeof val === 'string' ? val.trim() : String(val).trim();
  }

  if (poiData?.status === '1' && poiData.pois?.length > 0) {
    const exactMatch = poiData.pois.find(p => p.name === communityName) || poiData.pois[0];
    const poi = exactMatch;

    if (poi.location && typeof poi.location === 'string') {
      const [lng, lat] = poi.location.split(',').map(Number);
      if (lat > 30 && lat < 32 && lng > 120 && lng < 123) {
        result.latitude = lat;
        result.longitude = lng;
        location = poi.location;
      }
    }

    const adname = safeStr(poi.adname);
    if (adname) result.district = adname;

    const addr = safeStr(poi.address);
    if (addr && addr.length > 2) {
      result.address = addr;
      const streetMatch = addr.match(/([^\s,，]+路\d*弄?)/);
      if (streetMatch) result.street = streetMatch[1];
    }

    const biz = safeStr(poi.business);
    if (biz) result.board = biz.split(';')[0];
  } else {
    const geocodeUrl = `https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${encodeURIComponent(`上海市${existingDistrict || ''}${communityName}`)}&city=上海`;
    const geocodeData = await httpGet(geocodeUrl);
    if (geocodeData?.status === '1' && geocodeData.geocodes?.[0]?.location) {
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
      const st = safeStr(geo.street);
      if (st) result.street = st;
      const nbName = safeStr(geo.neighborhood?.name);
      if (nbName) result.board = nbName;
    }
  }

  if (!location && !result.district) {
    return result;
  }

  if (location) {
    await sleep(API_DELAY_MS);

    const metroUrl = `https://restapi.amap.com/v3/place/around?key=${apiKey}&location=${location}&types=150500&radius=${METRO_DISTANCE_SEARCH_RADIUS}&offset=10&output=JSON&sortrule=distance`;
    try {
      const metroData = await httpGet(metroUrl);
      if (metroData?.status === '1' && metroData.pois?.length > 0) {
        const stations = metroData.pois.filter(p => p.typecode === '150500');
        if (stations.length > 0) {
          const targetDistrict = result.district || existingDistrict;
          let chosen = null;
          if (targetDistrict) {
            chosen = stations.find(p => p.adname === targetDistrict);
          }
          if (!chosen) chosen = stations[0];

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
    } catch {
      // metro search failure is non-blocking
    }
  }

  result.success = true;
  return result;
}

async function matchStandardMetroStation(rawStation, rawLines) {
  try {
    const cleanedStation = rawStation.replace(/站$/, '');

    const [stdStations] = await pool.query(
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

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseArgs() {
  const result = { batch: 50, offset: 0, district: null, force: false, dryRun: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--district=')) result.district = arg.split('=')[1];
    else if (arg.startsWith('--batch=')) result.batch = Math.min(parseInt(arg.split('=')[1]) || 50, 100);
    else if (arg.startsWith('--offset=')) result.offset = parseInt(arg.split('=')[1]) || 0;
    else if (arg === '--force') result.force = true;
    else if (arg === '--dry-run') result.dryRun = true;
  }
  return result;
}

main().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
