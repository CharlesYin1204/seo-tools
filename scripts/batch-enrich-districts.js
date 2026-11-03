/**
 * 按指定区域批量高德补充POI信息
 * 优先处理核心城区，成功率高
 */
const db = require('../server/config/database');
const https = require('https');

const TARGET_DISTRICTS = ['静安区', '徐汇区', '黄浦区', '长宁区', '虹口区', '普陀区'];

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

async function searchMetro(apiKey, lat, lng, district) {
  const res = await amapReq(`https://restapi.amap.com/v3/place/around?key=${apiKey}&location=${lng},${lat}&types=150500&radius=3000&offset=20&output=JSON&sortrule=distance`);
  if (res?.info?.includes('LIMIT')) return { rateLimit: true };
  if (res?.status !== '1' || !res.pois?.length) return null;
  const stations = res.pois.filter(p => p.typecode === '150500');
  if (!stations.length) return null;
  let chosen = district ? stations.find(p => p.adname === district) : null;
  if (!chosen) chosen = stations[0];
  const name = chosen.name.replace(/\d+号口$/, '').replace(/[（(]地铁站[）)]/, '').replace(/地铁站$/, '').trim();
  let lines = '';
  if (chosen.address && typeof chosen.address === 'string') {
    const m = chosen.address.match(/(\d+号线|浦江线|磁浮线)/g);
    if (m) lines = [...new Set(m)].join(',');
  }
  const matched = await matchStd(name);
  return { station: matched.station, line: matched.line || lines, distance: chosen.distance ? parseInt(chosen.distance, 10) : null };
}

async function handleRateLimit() {
  console.log('  ⚠️ API限流，等待60秒...');
  await new Promise(r => setTimeout(r, 60000));
}

async function run() {
  const [settings] = await db.query('SELECT api_key FROM system_map_settings WHERE is_enabled = 1 LIMIT 1');
  if (!settings?.api_key) { console.log('ERROR: No API key'); process.exit(1); }
  const apiKey = settings.api_key;
  const DELAY = 210;
  const startTime = Date.now();
  let totalEnriched = 0, totalNoMetro = 0;

  for (const district of TARGET_DISTRICTS) {
    console.log(`\n====== 处理 ${district} ======`);

    // Phase A: 有坐标缺地铁
    const metroRows = await db.query(
      'SELECT id, community_name, district, latitude, longitude FROM property_community_dict WHERE is_enabled = 1 AND district = ? AND latitude IS NOT NULL AND latitude != 0 AND (nearest_metro_station IS NULL OR nearest_metro_station = "") ORDER BY id',
      [district]
    );
    console.log(`  缺地铁: ${metroRows.length} 条`);
    let mOk = 0, mNo = 0;
    for (let i = 0; i < metroRows.length; i++) {
      const row = metroRows[i];
      await new Promise(r => setTimeout(r, DELAY));
      try {
        const result = await searchMetro(apiKey, parseFloat(row.latitude), parseFloat(row.longitude), district);
        if (result?.rateLimit) { await handleRateLimit(); i--; continue; }
        if (result) {
          const u = ['nearest_metro_station = ?', 'nearest_metro_line = ?'];
          const p = [result.station, result.line];
          if (result.distance != null) { u.push('nearest_metro_distance = ?'); p.push(result.distance); }
          p.push(row.id);
          await db.query(`UPDATE property_community_dict SET ${u.join(', ')}, updated_at = NOW() WHERE id = ?`, p);
          mOk++;
        } else {
          await db.query('UPDATE property_community_dict SET nearest_metro_station = "无", updated_at = NOW() WHERE id = ?', [row.id]);
          mNo++;
        }
      } catch { mNo++; }
      if ((i + 1) % 100 === 0) console.log(`  地铁: ${i + 1}/${metroRows.length} | 成功:${mOk} 无地铁:${mNo}`);
    }
    console.log(`  地铁完成: 成功${mOk} 无地铁${mNo}`);

    // Phase B: 缺坐标
    const coordRows = await db.query(
      'SELECT id, community_name, district FROM property_community_dict WHERE is_enabled = 1 AND district = ? AND (latitude IS NULL OR latitude = 0) ORDER BY id',
      [district]
    );
    console.log(`  缺坐标: ${coordRows.length} 条`);
    let cOk = 0, cFail = 0;
    for (let i = 0; i < coordRows.length; i++) {
      const row = coordRows[i];
      await new Promise(r => setTimeout(r, DELAY));
      try {
        const keyword = `上海${district}${row.community_name}`;
        const poiRes = await amapReq(`https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(keyword)}&types=120000|120100|120200|120300|120201|120302&city=上海&citylimit=true&offset=3&output=JSON`);
        if (poiRes?.info?.includes('LIMIT')) { await handleRateLimit(); i--; continue; }

        if (poiRes?.status === '1' && poiRes.pois?.length > 0) {
          const poi = poiRes.pois.find(p => p.name === row.community_name) || poiRes.pois[0];
          if (poi.location) {
            const [lng, lat] = poi.location.split(',').map(Number);
            if (lat > 30 && lat < 32 && lng > 120 && lng < 123) {
              const u = ['latitude = ?', 'longitude = ?'];
              const p = [lat, lng];
              if (poi.address && typeof poi.address === 'string' && poi.address.length > 2) { u.push('address = ?'); p.push(poi.address); }
              if (poi.business) { u.push('board = ?'); p.push(poi.business.split(';')[0]); }

              await new Promise(r => setTimeout(r, DELAY));
              const metroResult = await searchMetro(apiKey, lat, lng, district);
              if (metroResult?.rateLimit) { await handleRateLimit(); }
              if (metroResult && !metroResult.rateLimit) {
                u.push('nearest_metro_station = ?', 'nearest_metro_line = ?');
                p.push(metroResult.station, metroResult.line);
                if (metroResult.distance != null) { u.push('nearest_metro_distance = ?'); p.push(metroResult.distance); }
              } else if (!metroResult) {
                u.push('nearest_metro_station = ?'); p.push('无');
              }

              p.push(row.id);
              await db.query(`UPDATE property_community_dict SET ${u.join(', ')}, updated_at = NOW() WHERE id = ?`, p);
              cOk++;
            } else { cFail++; }
          } else { cFail++; }
        } else { cFail++; }
      } catch { cFail++; }
      if ((i + 1) % 50 === 0) console.log(`  坐标: ${i + 1}/${coordRows.length} | 成功:${cOk} 失败:${cFail}`);
    }
    console.log(`  坐标完成: 成功${cOk} 失败${cFail}`);
    totalEnriched += mOk + cOk;
    totalNoMetro += mNo;
  }

  const totalMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✅ 全部完成! 总耗时: ${totalMin}分钟`);
  console.log(`成功补充: ${totalEnriched} 条 | 无地铁(远郊): ${totalNoMetro} 条`);

  const final = await db.query(`
    SELECT district, COUNT(*) as total,
      SUM(CASE WHEN nearest_metro_station IS NOT NULL AND nearest_metro_station != '' AND nearest_metro_station != '无' THEN 1 ELSE 0 END) as has_metro,
      SUM(CASE WHEN latitude IS NOT NULL AND latitude != 0 THEN 1 ELSE 0 END) as has_coords
    FROM property_community_dict WHERE is_enabled = 1 AND district IN ('静安区','徐汇区','黄浦区','长宁区','虹口区','普陀区')
    GROUP BY district ORDER BY total DESC
  `);
  console.log('\n最终数据:');
  final.forEach(r => console.log(`  ${r.district}: 总${r.total} 有坐标${r.has_coords} 有地铁${r.has_metro}`));
  process.exit();
}

run().catch(e => { console.error(e); process.exit(1); });
