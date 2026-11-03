/**
 * 批量高德地图补充脚本（完整版）
 * Phase 1: 有坐标缺地铁 → 搜索周边地铁站（无结果标记"无"）
 * Phase 2: 缺坐标 → POI搜索获取坐标+地铁
 */
const db = require('../server/config/database');
const https = require('https');

function amapReq(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

async function matchStd(rawStation) {
  try {
    const rows = await db.query(
      'SELECT ms.name_cn, ml.name_cn AS line FROM property_metro_stations ms JOIN property_metro_lines ml ON ms.line_id = ml.id WHERE ms.name_cn = ? ORDER BY ml.sort_order',
      [rawStation]
    );
    if (rows.length > 0) return { station: rawStation, line: [...new Set(rows.map(s => s.line))].join(',') };
    return { station: rawStation, line: null };
  } catch { return { station: rawStation, line: null }; }
}

function parseStationName(poiName) {
  return poiName
    .replace(/\d+号口$/, '')
    .replace(/[（(]地铁站[）)]/, '')
    .replace(/地铁站$/, '')
    .trim();
}

function parseMetroLines(address) {
  if (!address || typeof address !== 'string') return '';
  const m = address.match(/(\d+号线|浦江线|磁浮线)/g);
  return m ? [...new Set(m)].join(',') : '';
}

async function searchMetroAround(apiKey, lat, lng, district) {
  const loc = `${lng},${lat}`;
  const res = await amapReq(`https://restapi.amap.com/v3/place/around?key=${apiKey}&location=${loc}&types=150500&radius=3000&offset=20&output=JSON&sortrule=distance`);
  if (res?.status !== '1' || !res.pois?.length) {
    if (res?.info?.includes('LIMIT')) return { rateLimit: true };
    return null;
  }
  const stations = res.pois.filter(p => p.typecode === '150500');
  if (stations.length === 0) return null;

  let chosen = district ? stations.find(p => p.adname === district) : null;
  if (!chosen) chosen = stations[0];

  const name = parseStationName(chosen.name);
  const lines = parseMetroLines(chosen.address);
  const matched = await matchStd(name);
  return {
    station: matched.station,
    line: matched.line || lines,
    distance: chosen.distance ? parseInt(chosen.distance, 10) : null,
  };
}

async function run() {
  const [settings] = await db.query('SELECT api_key FROM system_map_settings WHERE is_enabled = 1 LIMIT 1');
  if (!settings?.api_key) { console.log('ERROR: No API key'); process.exit(1); }
  const apiKey = settings.api_key;
  const DELAY = 210;
  const startTime = Date.now();

  // ========== Phase 1: 有坐标缺地铁 ==========
  console.log('\n========== Phase 1: 有坐标缺地铁记录 ==========');
  const p1Total = (await db.query(
    'SELECT COUNT(*) as cnt FROM property_community_dict WHERE is_enabled = 1 AND latitude IS NOT NULL AND latitude != 0 AND (nearest_metro_station IS NULL OR nearest_metro_station = "")'
  ))[0].cnt;
  console.log(`待处理: ${p1Total} 条`);

  let p1 = { processed: 0, enriched: 0, noMetro: 0, failed: 0 };
  let lastId = 0;

  while (true) {
    const rows = await db.query(
      'SELECT id, community_name, district, latitude, longitude FROM property_community_dict WHERE is_enabled = 1 AND id > ? AND latitude IS NOT NULL AND latitude != 0 AND (nearest_metro_station IS NULL OR nearest_metro_station = "") ORDER BY id LIMIT 200',
      [lastId]
    );
    if (rows.length === 0) break;
    lastId = rows[rows.length - 1].id;

    for (const row of rows) {
      await new Promise(r => setTimeout(r, DELAY));
      try {
        const result = await searchMetroAround(apiKey, parseFloat(row.latitude), parseFloat(row.longitude), row.district);
        if (result?.rateLimit) {
          console.log('\n⚠️ API限流，等待60秒...');
          await new Promise(r => setTimeout(r, 60000));
          continue;
        }
        if (result) {
          const updates = ['nearest_metro_station = ?', 'nearest_metro_line = ?'];
          const params = [result.station, result.line];
          if (result.distance != null) { updates.push('nearest_metro_distance = ?'); params.push(result.distance); }
          params.push(row.id);
          await db.query(`UPDATE property_community_dict SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
          p1.enriched++;
        } else {
          // 3km内无地铁站，标记为"无"避免重复查询
          await db.query('UPDATE property_community_dict SET nearest_metro_station = "无", updated_at = NOW() WHERE id = ?', [row.id]);
          p1.noMetro++;
        }
      } catch { p1.failed++; }
      p1.processed++;
      if (p1.processed % 200 === 0) {
        const eta = ((p1Total - p1.processed) * DELAY / 1000 / 60).toFixed(1);
        console.log(`Phase1: ${p1.processed}/${p1Total} | 成功:${p1.enriched} 无地铁:${p1.noMetro} 失败:${p1.failed} | 剩余:${eta}min`);
      }
    }
  }
  console.log(`Phase1完成: 处理${p1.processed} 成功${p1.enriched} 无地铁${p1.noMetro} 失败${p1.failed}`);

  // ========== Phase 2: 缺坐标 ==========
  console.log('\n========== Phase 2: 缺坐标记录 ==========');
  const p2Total = (await db.query(
    'SELECT COUNT(*) as cnt FROM property_community_dict WHERE is_enabled = 1 AND (latitude IS NULL OR latitude = 0)'
  ))[0].cnt;
  console.log(`待处理: ${p2Total} 条`);

  let p2 = { processed: 0, enriched: 0, failed: 0 };
  lastId = 0;

  while (true) {
    const rows = await db.query(
      'SELECT id, community_name, district FROM property_community_dict WHERE is_enabled = 1 AND id > ? AND (latitude IS NULL OR latitude = 0) ORDER BY id LIMIT 200',
      [lastId]
    );
    if (rows.length === 0) break;
    lastId = rows[rows.length - 1].id;

    for (const row of rows) {
      await new Promise(r => setTimeout(r, DELAY));
      try {
        // POI搜索获取坐标
        const keyword = row.district ? `上海${row.district}${row.community_name}` : `上海${row.community_name}`;
        const poiRes = await amapReq(`https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(keyword)}&types=120000|120100|120200|120300|120201|120302&city=上海&citylimit=true&offset=3&output=JSON`);

        if (poiRes?.info?.includes('LIMIT')) {
          console.log('\n⚠️ API限流，等待60秒...');
          await new Promise(r => setTimeout(r, 60000));
          continue;
        }

        if (poiRes?.status === '1' && poiRes.pois?.length > 0) {
          const poi = poiRes.pois.find(p => p.name === row.community_name) || poiRes.pois[0];
          if (poi.location) {
            const [lng, lat] = poi.location.split(',').map(Number);
            if (lat > 30 && lat < 32 && lng > 120 && lng < 123) {
              const updates = ['latitude = ?', 'longitude = ?'];
              const params = [lat, lng];

              if (poi.adname && (!row.district || row.district === '')) {
                updates.push('district = ?');
                params.push(poi.adname);
              }
              if (poi.address && typeof poi.address === 'string' && poi.address.length > 2) {
                updates.push('address = ?');
                params.push(poi.address);
              }
              if (poi.business) {
                updates.push('board = ?');
                params.push(poi.business.split(';')[0]);
              }

              // 搜索地铁
              await new Promise(r => setTimeout(r, DELAY));
              const district = poi.adname || row.district;
              const metroResult = await searchMetroAround(apiKey, lat, lng, district);
              if (metroResult && !metroResult.rateLimit) {
                updates.push('nearest_metro_station = ?', 'nearest_metro_line = ?');
                params.push(metroResult.station, metroResult.line);
                if (metroResult.distance != null) { updates.push('nearest_metro_distance = ?'); params.push(metroResult.distance); }
              } else if (!metroResult) {
                updates.push('nearest_metro_station = ?');
                params.push('无');
              }

              params.push(row.id);
              await db.query(`UPDATE property_community_dict SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
              p2.enriched++;
            }
          }
        }
      } catch { p2.failed++; }
      p2.processed++;
      if (p2.processed % 100 === 0) {
        console.log(`Phase2: ${p2.processed}/${p2Total} | 成功:${p2.enriched} 失败:${p2.failed}`);
      }
    }
  }
  console.log(`Phase2完成: 处理${p2.processed} 成功${p2.enriched} 失败${p2.failed}`);

  const totalMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✅ 全部完成! 总耗时: ${totalMin}分钟`);
  console.log(`Phase1(地铁): 成功${p1.enriched} 无地铁${p1.noMetro}`);
  console.log(`Phase2(坐标+地铁): 成功${p2.enriched}`);

  // 最终统计
  const final = await db.query(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN latitude IS NOT NULL AND latitude != 0 THEN 1 ELSE 0 END) as has_coords,
      SUM(CASE WHEN nearest_metro_station IS NOT NULL AND nearest_metro_station != '' AND nearest_metro_station != '无' THEN 1 ELSE 0 END) as has_metro
    FROM property_community_dict WHERE is_enabled = 1
  `);
  console.log('最终数据:', JSON.stringify(final[0]));
  process.exit();
}

run().catch(e => { console.error(e); process.exit(1); });
