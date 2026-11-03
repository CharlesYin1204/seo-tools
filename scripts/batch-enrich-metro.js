/**
 * 批量高德地图地铁信息补充脚本
 * 处理有坐标但缺地铁信息的POI记录
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
    const cleaned = rawStation.replace(/站$/, '');
    const rows = await db.query(
      'SELECT ms.name_cn, ml.name_cn AS line FROM property_metro_stations ms JOIN property_metro_lines ml ON ms.line_id = ml.id WHERE ms.name_cn = ? OR ms.name_cn = ? ORDER BY ms.name_cn = ? DESC, ml.sort_order',
      [rawStation, cleaned, rawStation]
    );
    if (rows.length > 0) {
      const exactRows = rows.filter(r => r.name_cn === rawStation);
      if (exactRows.length > 0) return { station: rawStation, line: [...new Set(exactRows.map(s => s.line))].join(',') };
      const cleanRows = rows.filter(r => r.name_cn === cleaned);
      if (cleanRows.length > 0) return { station: cleaned, line: [...new Set(cleanRows.map(s => s.line))].join(',') };
      return { station: rows[0].name_cn, line: [...new Set(rows.filter(r => r.name_cn === rows[0].name_cn).map(s => s.line))].join(',') };
    }
    return { station: cleaned !== rawStation ? cleaned : rawStation, line: null };
  } catch { return { station: rawStation, line: null }; }
}

async function run() {
  const [settings] = await db.query('SELECT api_key FROM system_map_settings WHERE is_enabled = 1 LIMIT 1');
  if (!settings?.api_key) { console.log('ERROR: No API key'); process.exit(1); }
  const apiKey = settings.api_key;
  const DELAY = 210;
  let processed = 0, enriched = 0, failed = 0, noData = 0;

  const totalRes = await db.query(
    'SELECT COUNT(*) as cnt FROM property_community_dict WHERE is_enabled = 1 AND latitude IS NOT NULL AND latitude != 0 AND (nearest_metro_station IS NULL OR nearest_metro_station = "")'
  );
  const total = totalRes[0].cnt;
  console.log(`开始处理 ${total} 条有坐标缺地铁的记录...`);
  const startTime = Date.now();

  while (true) {
    const rows = await db.query(
      'SELECT id, community_name, district, latitude, longitude FROM property_community_dict WHERE is_enabled = 1 AND latitude IS NOT NULL AND latitude != 0 AND (nearest_metro_station IS NULL OR nearest_metro_station = "") ORDER BY id LIMIT 200'
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      try {
        await new Promise(r => setTimeout(r, DELAY));
        const loc = `${parseFloat(row.longitude)},${parseFloat(row.latitude)}`;
        const res = await amapReq(`https://restapi.amap.com/v3/place/around?key=${apiKey}&location=${loc}&types=150500&radius=3000&offset=20&output=JSON&sortrule=distance`);

        if (res?.status === '1' && res.pois?.length > 0) {
          const stations = res.pois.filter(p => p.typecode === '150500');
          if (stations.length > 0) {
            let chosen = row.district ? stations.find(p => p.adname === row.district) : null;
            if (!chosen) chosen = stations[0];

            const name = chosen.name
              .replace(/\d+号口$/, '')
              .replace(/[（(]地铁站[）)]/, '')
              .replace(/地铁站$/, '')
              .replace(/^(一大会址[·.]?)/, '')
              .replace(/^支线/, '')
              .trim();

            let lines = '';
            if (chosen.address && typeof chosen.address === 'string') {
              const m = chosen.address.match(/(\d+号线|浦江线|磁浮线)/g);
              if (m) lines = [...new Set(m)].join(',');
            }

            const matched = await matchStd(name);
            const dist = chosen.distance ? parseInt(chosen.distance, 10) : null;
            const updates = ['nearest_metro_station = ?', 'nearest_metro_line = ?'];
            const params = [matched.station, matched.line || lines];
            if (dist) { updates.push('nearest_metro_distance = ?'); params.push(dist); }
            params.push(row.id);
            await db.query(`UPDATE property_community_dict SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
            enriched++;
          } else { noData++; }
        } else if (res?.info && res.info.includes('LIMIT')) {
          console.log(`\n⚠️ API限流! 已处理${processed}条, 等待60秒...`);
          await new Promise(r => setTimeout(r, 60000));
          continue;
        } else { noData++; }
      } catch (e) { failed++; }

      processed++;
      if (processed % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const eta = ((total - processed) * DELAY / 1000 / 60).toFixed(1);
        console.log(`进度: ${processed}/${total} (${(processed/total*100).toFixed(1)}%) | 成功:${enriched} 无数据:${noData} 失败:${failed} | 耗时:${elapsed}s 预估剩余:${eta}min`);
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✅ 地铁补充完成! 处理:${processed} 成功:${enriched} 无数据:${noData} 失败:${failed} | 总耗时:${totalTime}分钟`);
  process.exit();
}

run().catch(e => { console.error(e); process.exit(1); });
