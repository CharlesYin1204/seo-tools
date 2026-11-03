/**
 * 使用地理编码API（高配额5000/日）为缺坐标的POI补充经纬度
 * 针对核心城区：静安、徐汇、黄浦、长宁、虹口、普陀
 */
const db = require('../server/config/database');
const https = require('https');

const TARGET_DISTRICTS = ['松江区', '嘉定区', '青浦区', '奉贤区', '金山区', '崇明区'];

function amapReq(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

async function run() {
  const [settings] = await db.query('SELECT api_key FROM system_map_settings WHERE is_enabled = 1 LIMIT 1');
  if (!settings?.api_key) { console.log('ERROR: No API key'); process.exit(1); }
  const apiKey = settings.api_key;
  const DELAY = 220;
  const startTime = Date.now();
  let totalOk = 0, totalFail = 0;

  for (const district of TARGET_DISTRICTS) {
    const rows = await db.query(
      'SELECT id, community_name, district, street FROM property_community_dict WHERE is_enabled = 1 AND district = ? AND (latitude IS NULL OR latitude = 0) ORDER BY id',
      [district]
    );
    console.log(`\n====== ${district}: 缺坐标 ${rows.length} 条 ======`);
    let ok = 0, fail = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      await new Promise(r => setTimeout(r, DELAY));

      try {
        const addr = `上海${district}${row.community_name}`;
        const res = await amapReq(`https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${encodeURIComponent(addr)}&city=上海&output=JSON`);

        if (res?.info?.includes('LIMIT')) {
          console.log('  ⚠️ API限流，等待60秒...');
          await new Promise(r => setTimeout(r, 60000));
          i--;
          continue;
        }

        if (res?.status === '1' && res.geocodes?.length > 0) {
          const geo = res.geocodes[0];
          if (geo.location) {
            const [lng, lat] = geo.location.split(',').map(Number);
            if (lat > 30 && lat < 32 && lng > 120 && lng < 123) {
              const u = ['latitude = ?', 'longitude = ?'];
              const p = [lat, lng];
              if (geo.district && geo.district !== district) {
                u.push('district = ?'); p.push(geo.district);
              }
              if (geo.street && typeof geo.street === 'string' && geo.street.length > 1) {
                u.push('street = ?'); p.push(geo.street);
              }
              p.push(row.id);
              await db.query(`UPDATE property_community_dict SET ${u.join(', ')}, updated_at = NOW() WHERE id = ?`, p);
              ok++;
            } else { fail++; }
          } else { fail++; }
        } else { fail++; }
      } catch (e) { fail++; }

      if ((i + 1) % 50 === 0 || i === rows.length - 1) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        console.log(`  ${district}: ${i + 1}/${rows.length} | 成功:${ok} 失败:${fail} | 已用${elapsed}min`);
      }
    }
    totalOk += ok;
    totalFail += fail;
    console.log(`  ${district} 完成: 成功${ok} 失败${fail}`);
  }

  const totalMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✅ 坐标补充完成! 耗时: ${totalMin}分钟 | 成功: ${totalOk} | 失败: ${totalFail}`);

  const final = await db.query(`
    SELECT district, COUNT(*) as total,
      SUM(CASE WHEN latitude IS NOT NULL AND latitude != 0 THEN 1 ELSE 0 END) as has_coords,
      SUM(CASE WHEN nearest_metro_station IS NOT NULL AND nearest_metro_station != '' AND nearest_metro_station != '无' THEN 1 ELSE 0 END) as has_metro
    FROM property_community_dict WHERE is_enabled = 1 AND district IN ('静安区','徐汇区','黄浦区','长宁区','虹口区','普陀区')
    GROUP BY district ORDER BY total DESC
  `);
  console.log('\n当前数据状态:');
  final.forEach(r => console.log(`  ${r.district}: 总${r.total} 有坐标${r.has_coords} 有地铁${r.has_metro}`));
  process.exit();
}

run().catch(e => { console.error(e); process.exit(1); });
