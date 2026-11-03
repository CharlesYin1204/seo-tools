#!/usr/bin/env node
/**
 * 修复解析房源的小区名称匹配问题
 * 通过多种规则将未匹配的小区名映射到POI标准名
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  console.log('=== 修复解析房源小区名称匹配 ===\n');

  // 加载所有POI小区名
  const [poiRows] = await conn.query(
    'SELECT id, community_name, district, latitude, longitude FROM property_community_dict WHERE is_enabled = 1'
  );
  const poiByName = new Map();
  const poiByNameDistrict = new Map();
  for (const p of poiRows) {
    const key = `${p.community_name}__${p.district}`;
    poiByNameDistrict.set(key, p);
    if (!poiByName.has(p.community_name)) poiByName.set(p.community_name, []);
    poiByName.get(p.community_name).push(p);
  }
  console.log(`POI总数: ${poiRows.length}, 不同小区名: ${poiByName.size}\n`);

  // 加载未匹配的解析记录（去重后的小区+区域组合）
  const [unmatchedRows] = await conn.query(`
    SELECT p.community, p.district, COUNT(*) as cnt
    FROM wechat_robot_expat_parsed_properties p
    LEFT JOIN property_community_dict poi ON p.community = poi.community_name AND p.district = poi.district
    WHERE p.deleted_at IS NULL AND p.community IS NOT NULL AND p.community != '' AND poi.id IS NULL
    GROUP BY p.community, p.district
    ORDER BY cnt DESC
  `);
  console.log(`未匹配的小区+区域组合: ${unmatchedRows.length}\n`);

  const fixes = []; // { from_community, from_district, to_community, to_district, rule, count }

  for (const row of unmatchedRows) {
    const name = row.community;
    const district = row.district;
    let matched = null;
    let rule = '';

    // 规则1：去掉期数后缀（1期、2期、一期、二期、A座、B座等）
    const nameNoPhase = name.replace(/[一二三四五六七八九十0-9]+期$/, '')
                            .replace(/[-\s]*(A|B|C|D|E|南|北|东|西)区$/, '')
                            .replace(/[-\s]*(A|B|C)座$/, '');
    if (nameNoPhase !== name && poiByName.has(nameNoPhase)) {
      const candidates = poiByName.get(nameNoPhase);
      matched = candidates.find(c => c.district === district) || candidates[0];
      rule = '去期数/区座后缀';
    }

    // 规则2：去掉·号和中间分隔符
    if (!matched) {
      const nameClean = name.replace(/[·•‧]/g, '');
      if (nameClean !== name && poiByName.has(nameClean)) {
        const candidates = poiByName.get(nameClean);
        matched = candidates.find(c => c.district === district) || candidates[0];
        rule = '去掉·分隔符';
      }
    }

    // 规则3：解析名去掉地址前缀（万航渡路660弄静安桂花园 → 静安桂花园）
    if (!matched) {
      const m = name.match(/(?:路|街|弄|号|道|巷)\d*(?:弄|号)?\s*(.{2,})$/);
      if (m) {
        const extracted = m[1];
        if (poiByName.has(extracted)) {
          const candidates = poiByName.get(extracted);
          matched = candidates.find(c => c.district === district) || candidates[0];
          rule = '去地址前缀';
        }
      }
    }

    // 规则4：POI包含解析名或解析名包含POI名（模糊匹配）
    if (!matched && name.length >= 3) {
      for (const [poiName, poiList] of poiByName) {
        if (poiName.length < 3) continue;
        // 解析名包含POI名（如"天汇广场公寓" 包含 "天汇广场"）
        if (name.includes(poiName) && poiName.length >= name.length * 0.5) {
          const candidates = poiList;
          matched = candidates.find(c => c.district === district) || candidates[0];
          rule = `解析名包含POI名(${poiName})`;
          break;
        }
        // POI名包含解析名（如"上海新体育广场商住楼" 包含 "新体育广场"）
        if (poiName.includes(name) && name.length >= poiName.length * 0.4) {
          const candidates = poiList;
          matched = candidates.find(c => c.district === district) || candidates[0];
          rule = `POI名包含解析名(${poiName})`;
          break;
        }
      }
    }

    // 规则5：手动映射高频特殊名称
    const MANUAL_MAP = {
      '徐汇': null, '徐家汇': null, '虹口足球场': null,
      '上海体育馆': null, '人民广场公寓': null, '北外滩来福士': null,
      '复旦大学周边': null, '徐汇滨江': null,
    };
    if (!matched && name in MANUAL_MAP) {
      // 地标名非小区，跳过
      continue;
    }

    if (matched) {
      fixes.push({
        from_community: name,
        from_district: district,
        to_community: matched.community_name,
        to_district: matched.district,
        rule,
        count: row.cnt,
      });
    }
  }

  console.log(`\n=== 可修复的映射: ${fixes.length} 组 ===\n`);
  let totalFixed = 0;

  for (const fix of fixes) {
    const updates = [];
    const params = [];

    if (fix.from_community !== fix.to_community) {
      updates.push('community = ?');
      params.push(fix.to_community);
    }
    if (fix.from_district !== fix.to_district) {
      updates.push('district = ?');
      params.push(fix.to_district);
    }

    if (updates.length === 0) continue;

    params.push(fix.from_community, fix.from_district);
    const [result] = await conn.query(
      `UPDATE wechat_robot_expat_parsed_properties SET ${updates.join(', ')} WHERE community = ? AND district = ? AND deleted_at IS NULL`,
      params
    );

    if (result.affectedRows > 0) {
      console.log(`  [${fix.rule}] "${fix.from_community}" (${fix.from_district}) → "${fix.to_community}" (${fix.to_district}) : ${result.affectedRows}条`);
      totalFixed += result.affectedRows;
    }
  }

  console.log(`\n=== 总计修复: ${totalFixed} 条记录 ===`);

  // 修复后再统计
  const [finalStats] = await conn.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN poi.latitude IS NOT NULL AND poi.latitude != 0 THEN 1 END) as has_coords,
      COUNT(CASE WHEN poi.id IS NULL THEN 1 END) as no_poi_match,
      COUNT(CASE WHEN poi.id IS NOT NULL AND (poi.latitude IS NULL OR poi.latitude = 0) THEN 1 END) as poi_no_coords
    FROM wechat_robot_expat_parsed_properties p
    LEFT JOIN property_community_dict poi ON p.community = poi.community_name AND p.district = poi.district
    WHERE p.deleted_at IS NULL AND p.community IS NOT NULL AND p.community != ''
      AND p.moment_publish_time >= '2026-03-09'
      AND (p.price IS NOT NULL OR p.bedrooms IS NOT NULL OR p.community IS NOT NULL OR p.district IS NOT NULL)
  `);
  console.log('\n=== 修复后近3天统计 ===');
  console.log(`有坐标可显示: ${finalStats[0].has_coords}`);
  console.log(`POI匹配但无坐标: ${finalStats[0].poi_no_coords}`);
  console.log(`无POI匹配: ${finalStats[0].no_poi_match}`);

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
