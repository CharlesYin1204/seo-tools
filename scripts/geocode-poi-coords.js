#!/usr/bin/env node
/**
 * 使用高德地理编码API为无经纬度的POI补充坐标
 * 免费配额：每日5000次
 */
const mysql = require('mysql2/promise');
const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

function geocode(address, key) {
  return new Promise((resolve, reject) => {
    const url = `https://restapi.amap.com/v3/geocode/geo?key=${key}&address=${encodeURIComponent(address)}&city=上海`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === '1' && json.geocodes && json.geocodes.length > 0) {
            const loc = json.geocodes[0].location;
            if (loc) {
              const [lng, lat] = loc.split(',').map(Number);
              resolve({ lat, lng, formatted: json.geocodes[0].formatted_address || '' });
              return;
            }
          }
          resolve(null);
        } catch (e) { resolve(null); }
      });
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  // 获取高德API Key
  const [settings] = await conn.query('SELECT api_key FROM system_map_settings WHERE is_enabled = 1 LIMIT 1');
  if (!settings.length || !settings[0].api_key) {
    console.error('未找到高德API Key');
    process.exit(1);
  }
  const apiKey = settings[0].api_key;

  // 获取无坐标的POI（优先处理被解析房源引用最多的）
  const [rows] = await conn.query(`
    SELECT poi.id, poi.community_name, poi.district, poi.address,
           COUNT(p.id) as ref_count
    FROM property_community_dict poi
    LEFT JOIN wechat_robot_expat_parsed_properties p 
      ON p.community = poi.community_name AND p.district = poi.district AND p.deleted_at IS NULL
    WHERE poi.is_enabled = 1 AND (poi.latitude IS NULL OR poi.latitude = 0)
    GROUP BY poi.id
    ORDER BY ref_count DESC
    LIMIT 2500
  `);

  console.log(`需要地理编码的POI: ${rows.length} 条\n`);

  let success = 0, failed = 0, skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const searchAddr = row.address || `上海市${row.district || ''}${row.community_name}`;

    const result = await geocode(searchAddr, apiKey);
    if (result && result.lat && result.lng) {
      await conn.query(
        'UPDATE property_community_dict SET latitude = ?, longitude = ?, updated_at = NOW() WHERE id = ?',
        [result.lat, result.lng, row.id]
      );
      success++;
      if (success <= 20 || success % 100 === 0) {
        console.log(`[${i + 1}/${rows.length}] ✓ ${row.community_name}(${row.district}) → ${result.lat},${result.lng} (引用${row.ref_count}次)`);
      }
    } else {
      failed++;
      if (failed <= 10) {
        console.log(`[${i + 1}/${rows.length}] ✗ ${row.community_name}(${row.district}) 编码失败`);
      }
    }

    // 控制请求频率，200ms间隔（每秒5次，日配额5000次够用）
    await sleep(200);
  }

  console.log(`\n=== 地理编码完成 ===`);
  console.log(`成功: ${success}, 失败: ${failed}`);

  // 修复后统计
  const [stats] = await conn.query(`
    SELECT 
      COUNT(*) as total_poi,
      COUNT(CASE WHEN latitude IS NOT NULL AND latitude != 0 THEN 1 END) as has_coords
    FROM property_community_dict WHERE is_enabled = 1
  `);
  console.log(`POI坐标覆盖: ${stats[0].has_coords}/${stats[0].total_poi}`);

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
