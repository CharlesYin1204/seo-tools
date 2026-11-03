/**
 * 使用本地数据库地铁站坐标计算最近地铁站
 * 无需调用高德API，处理速度极快
 * 目标：静安、徐汇、黄浦、长宁、虹口、普陀
 */
const db = require('../server/config/database');

const TARGET_DISTRICTS = ['松江区', '嘉定区', '青浦区', '奉贤区', '金山区', '崇明区'];
const MAX_DISTANCE_KM = 3;

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function run() {
  const startTime = Date.now();

  const stations = await db.query(`
    SELECT ms.id, ms.name_cn AS station_name, ms.latitude, ms.longitude, ml.name_cn AS line_name
    FROM property_metro_stations ms
    JOIN property_metro_lines ml ON ms.line_id = ml.id
    WHERE ms.latitude IS NOT NULL AND ms.latitude != 0
    ORDER BY ms.id
  `);
  console.log(`加载 ${stations.length} 个地铁站（含线路）`);

  const stationMap = {};
  for (const s of stations) {
    if (!stationMap[s.station_name]) {
      stationMap[s.station_name] = { lat: parseFloat(s.latitude), lng: parseFloat(s.longitude), lines: [] };
    }
    stationMap[s.station_name].lines.push(s.line_name);
  }
  const stationList = Object.entries(stationMap).map(([name, data]) => ({
    name, lat: data.lat, lng: data.lng, lines: [...new Set(data.lines)].join(',')
  }));
  console.log(`去重后 ${stationList.length} 个站点\n`);

  let totalUpdated = 0, totalNoMetro = 0;

  for (const district of TARGET_DISTRICTS) {
    const rows = await db.query(
      `SELECT id, community_name, latitude, longitude FROM property_community_dict
       WHERE is_enabled = 1 AND district = ?
       AND latitude IS NOT NULL AND latitude != 0
       AND (nearest_metro_station IS NULL OR nearest_metro_station = '')
       ORDER BY id`,
      [district]
    );
    console.log(`====== ${district}: 缺地铁 ${rows.length} 条 ======`);
    let ok = 0, noMetro = 0;

    for (const row of rows) {
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      let nearest = null;
      let minDist = Infinity;

      for (const s of stationList) {
        const dist = haversineKm(lat, lng, s.lat, s.lng);
        if (dist < minDist) {
          minDist = dist;
          nearest = s;
        }
      }

      if (nearest && minDist <= MAX_DISTANCE_KM) {
        const distMeters = Math.round(minDist * 1000);
        await db.query(
          'UPDATE property_community_dict SET nearest_metro_station = ?, nearest_metro_line = ?, nearest_metro_distance = ?, updated_at = NOW() WHERE id = ?',
          [nearest.name, nearest.lines, distMeters, row.id]
        );
        ok++;
      } else {
        await db.query(
          'UPDATE property_community_dict SET nearest_metro_station = "无", updated_at = NOW() WHERE id = ?',
          [row.id]
        );
        noMetro++;
      }
    }

    console.log(`  完成: 匹配成功 ${ok}, 超过3km无地铁 ${noMetro}`);
    totalUpdated += ok;
    totalNoMetro += noMetro;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ 本地地铁匹配完成! 耗时: ${elapsed}秒`);
  console.log(`成功匹配: ${totalUpdated} 条 | 无地铁(>3km): ${totalNoMetro} 条`);

  const final = await db.query(`
    SELECT district, COUNT(*) as total,
      SUM(CASE WHEN latitude IS NOT NULL AND latitude != 0 THEN 1 ELSE 0 END) as has_coords,
      SUM(CASE WHEN nearest_metro_station IS NOT NULL AND nearest_metro_station != '' AND nearest_metro_station != '无' THEN 1 ELSE 0 END) as has_metro,
      SUM(CASE WHEN nearest_metro_station = '无' THEN 1 ELSE 0 END) as no_metro
    FROM property_community_dict WHERE is_enabled = 1 AND district IN ('静安区','徐汇区','黄浦区','长宁区','虹口区','普陀区')
    GROUP BY district ORDER BY total DESC
  `);
  console.log('\n最终数据状态:');
  final.forEach(r => console.log(`  ${r.district}: 总${r.total} 有坐标${r.has_coords} 有地铁${r.has_metro} 无地铁${r.no_metro}`));
  process.exit();
}

run().catch(e => { console.error(e); process.exit(1); });
