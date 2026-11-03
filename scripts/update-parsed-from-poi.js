#!/usr/bin/env node
/**
 * 用 POI 小区数据全面更新解析房源列表
 * 
 * 步骤：
 * 1. 清理无效的小区名（垃圾数据）
 * 2. 精确匹配（community + district）补充地铁距离/线路/站点
 * 3. 仅按小区名匹配：为缺少区域或区域不匹配的记录补充 district + 地铁信息
 * 4. 统计验证
 * 
 * 用法: node scripts/update-parsed-from-poi.js [--dry-run]
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

const INVALID_COMMUNITY_NAMES = [
  '房型', '特色', '报价', '职业房东网', '商业配套', '地 址', '小 区',
  '100%佣', '2年起租', '梧桐区', '燃气一室户', '配套',
  '地段', '户型', '楼层', '朝向', '面积', '装修', '租金', '价格',
  '联系', '电话', '微信', '扫码', '详情', '更多', '图片',
  '整租', '合租', '转租', '出租', '求租', '急租', '直租',
  '佣金', '中介费', '免佣', '全佣', '半佣', '付佣',
  '看房', '随时看房', '预约看房',
  '地铁', '公交', '交通',
  '学区', '学校', '医院', '商场', '超市',
  '新房', '二手房', '毛坯', '精装',
];

const INVALID_COMMUNITY_PATTERNS = [
  /^[\d\s.,-]+$/,
  /^.{0,1}$/,
  /^.{60,}$/,
  /^上海市.{5,}路\d+/,
  /^上海市.{5,}弄/,
  /^\d+[室厅卫]/, 
  /^[\d]+[号栋幢]$/,
  /^(一|二|三|四|五|六|七|八|九|十)+[室厅]/,
  /^https?:\/\//,
  /^www\./,
];

async function main() {
  console.log(`=== 全面更新解析房源数据 (${DRY_RUN ? '模拟运行' : '正式执行'}) ===\n`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  // ========== 步骤1: 清理无效小区名 ==========
  console.log('【步骤1】清理无效小区名...');
  
  const [badNames] = await conn.query(
    `SELECT community, COUNT(*) as cnt 
     FROM wechat_robot_expat_parsed_properties 
     WHERE deleted_at IS NULL AND community IS NOT NULL AND community != ''
     GROUP BY community`
  );

  let cleanCount = 0;
  const toClean = [];
  for (const row of badNames) {
    const name = row.community.trim();
    const isInvalid = INVALID_COMMUNITY_NAMES.includes(name) ||
      INVALID_COMMUNITY_PATTERNS.some(p => p.test(name));
    if (isInvalid) {
      toClean.push(name);
      cleanCount += row.cnt;
    }
  }

  console.log(`  发现 ${toClean.length} 个无效小区名，涉及 ${cleanCount} 条记录`);
  if (toClean.length > 0) {
    console.log(`  示例: ${toClean.slice(0, 10).join(', ')}`);
    if (!DRY_RUN) {
      for (const name of toClean) {
        await conn.query(
          `UPDATE wechat_robot_expat_parsed_properties SET community = NULL WHERE community = ? AND deleted_at IS NULL`,
          [name]
        );
      }
      console.log(`  已清理 ${cleanCount} 条记录的无效小区名\n`);
    } else {
      console.log(`  [模拟] 将清理 ${cleanCount} 条\n`);
    }
  }

  // ========== 步骤2: 精确匹配补充地铁距离 ==========
  console.log('【步骤2】精确匹配(community+district)补充地铁信息...');
  
  const [[exactStats]] = await conn.query(`
    SELECT 
      COUNT(*) as matched,
      COUNT(CASE WHEN (p.metro_distance IS NULL) AND poi.nearest_metro_distance IS NOT NULL THEN 1 END) as fill_distance,
      COUNT(CASE WHEN (p.metro_lines IS NULL OR p.metro_lines = '') AND poi.nearest_metro_line IS NOT NULL THEN 1 END) as fill_line,
      COUNT(CASE WHEN (p.metro_stations IS NULL OR p.metro_stations = '') AND poi.nearest_metro_station IS NOT NULL THEN 1 END) as fill_station
    FROM wechat_robot_expat_parsed_properties p
    INNER JOIN property_community_dict poi ON p.community = poi.community_name AND p.district = poi.district
    WHERE p.deleted_at IS NULL
  `);

  console.log(`  精确匹配: ${exactStats.matched} 条`);
  console.log(`  可补充地铁距离: ${exactStats.fill_distance} 条`);
  console.log(`  可补充地铁线路: ${exactStats.fill_line} 条`);
  console.log(`  可补充地铁站点: ${exactStats.fill_station} 条`);

  if (!DRY_RUN) {
    const [r1] = await conn.query(`
      UPDATE wechat_robot_expat_parsed_properties p
      INNER JOIN property_community_dict poi ON p.community = poi.community_name AND p.district = poi.district
      SET p.metro_distance = poi.nearest_metro_distance
      WHERE p.deleted_at IS NULL AND p.metro_distance IS NULL AND poi.nearest_metro_distance IS NOT NULL
    `);
    console.log(`  更新地铁距离: ${r1.affectedRows} 条`);

    const [r2] = await conn.query(`
      UPDATE wechat_robot_expat_parsed_properties p
      INNER JOIN property_community_dict poi ON p.community = poi.community_name AND p.district = poi.district
      SET p.metro_lines = poi.nearest_metro_line
      WHERE p.deleted_at IS NULL AND (p.metro_lines IS NULL OR p.metro_lines = '') AND poi.nearest_metro_line IS NOT NULL
    `);
    console.log(`  更新地铁线路: ${r2.affectedRows} 条`);

    const [r3] = await conn.query(`
      UPDATE wechat_robot_expat_parsed_properties p
      INNER JOIN property_community_dict poi ON p.community = poi.community_name AND p.district = poi.district
      SET p.metro_stations = poi.nearest_metro_station
      WHERE p.deleted_at IS NULL AND (p.metro_stations IS NULL OR p.metro_stations = '') AND poi.nearest_metro_station IS NOT NULL
    `);
    console.log(`  更新地铁站点: ${r3.affectedRows} 条`);
  }
  console.log('');

  // ========== 步骤3: 仅按小区名匹配（补充区域 + 地铁） ==========
  console.log('【步骤3】仅按小区名匹配（补充区域+地铁信息）...');

  const [nameOnlyMatches] = await conn.query(`
    SELECT p.id, p.community, p.district as p_district, 
           poi.district as poi_district, poi.nearest_metro_line, poi.nearest_metro_station, poi.nearest_metro_distance
    FROM wechat_robot_expat_parsed_properties p
    INNER JOIN property_community_dict poi ON p.community = poi.community_name
    LEFT JOIN property_community_dict poi_exact ON p.community = poi_exact.community_name AND p.district = poi_exact.district
    WHERE p.deleted_at IS NULL 
      AND p.community IS NOT NULL AND p.community != ''
      AND poi_exact.id IS NULL
      AND (p.district IS NULL OR p.district = '' OR p.district != poi.district)
  `);

  const uniqueByParsedId = new Map();
  for (const row of nameOnlyMatches) {
    if (!uniqueByParsedId.has(row.id)) {
      uniqueByParsedId.set(row.id, row);
    }
  }

  let fillDistrictCount = 0;
  let fillMetroFromNameCount = 0;

  console.log(`  仅名称匹配到: ${uniqueByParsedId.size} 条解析记录`);

  if (!DRY_RUN) {
    for (const [pid, row] of uniqueByParsedId) {
      const updates = [];
      const vals = [];

      if (!row.p_district || row.p_district === '') {
        updates.push('district = ?');
        vals.push(row.poi_district);
        fillDistrictCount++;
      }

      if (row.nearest_metro_line) {
        updates.push('metro_lines = COALESCE(NULLIF(metro_lines, ""), ?)');
        vals.push(row.nearest_metro_line);
      }
      if (row.nearest_metro_station) {
        updates.push('metro_stations = COALESCE(NULLIF(metro_stations, ""), ?)');
        vals.push(row.nearest_metro_station);
      }
      if (row.nearest_metro_distance) {
        updates.push('metro_distance = COALESCE(metro_distance, ?)');
        vals.push(row.nearest_metro_distance);
        fillMetroFromNameCount++;
      }

      if (updates.length > 0) {
        vals.push(pid);
        await conn.query(
          `UPDATE wechat_robot_expat_parsed_properties SET ${updates.join(', ')} WHERE id = ?`,
          vals
        );
      }
    }
    console.log(`  补充区域: ${fillDistrictCount} 条`);
    console.log(`  补充地铁距离(仅名称匹配): ${fillMetroFromNameCount} 条`);
  } else {
    for (const [, row] of uniqueByParsedId) {
      if (!row.p_district || row.p_district === '') fillDistrictCount++;
      if (row.nearest_metro_distance) fillMetroFromNameCount++;
    }
    console.log(`  [模拟] 将补充区域: ${fillDistrictCount} 条`);
    console.log(`  [模拟] 将补充地铁距离: ${fillMetroFromNameCount} 条`);
  }
  console.log('');

  // ========== 步骤4: 统计验证 ==========
  console.log('【步骤4】更新后统计验证...');
  
  const [[afterStats]] = await conn.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN community IS NOT NULL AND community != '' THEN 1 END) as has_community,
      COUNT(CASE WHEN district IS NOT NULL AND district != '' THEN 1 END) as has_district,
      COUNT(CASE WHEN metro_lines IS NOT NULL AND metro_lines != '' THEN 1 END) as has_metro_lines,
      COUNT(CASE WHEN metro_stations IS NOT NULL AND metro_stations != '' THEN 1 END) as has_metro_stations,
      COUNT(CASE WHEN metro_distance IS NOT NULL THEN 1 END) as has_metro_distance
    FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL
  `);

  console.log(`  总记录数: ${afterStats.total}`);
  console.log(`  有小区名: ${afterStats.has_community} (${(afterStats.has_community / afterStats.total * 100).toFixed(1)}%)`);
  console.log(`  有区域: ${afterStats.has_district} (${(afterStats.has_district / afterStats.total * 100).toFixed(1)}%)`);
  console.log(`  有地铁线路: ${afterStats.has_metro_lines} (${(afterStats.has_metro_lines / afterStats.total * 100).toFixed(1)}%)`);
  console.log(`  有地铁站点: ${afterStats.has_metro_stations} (${(afterStats.has_metro_stations / afterStats.total * 100).toFixed(1)}%)`);
  console.log(`  有地铁距离: ${afterStats.has_metro_distance} (${(afterStats.has_metro_distance / afterStats.total * 100).toFixed(1)}%)`);

  // POI匹配统计
  const [[matchStats]] = await conn.query(`
    SELECT 
      COUNT(*) as total_with_community,
      COUNT(CASE WHEN poi.id IS NOT NULL THEN 1 END) as matched_poi
    FROM wechat_robot_expat_parsed_properties p
    LEFT JOIN property_community_dict poi ON p.community = poi.community_name AND p.district = poi.district
    WHERE p.deleted_at IS NULL AND p.community IS NOT NULL AND p.community != ''
  `);
  console.log(`  POI匹配率: ${matchStats.matched_poi}/${matchStats.total_with_community} (${(matchStats.matched_poi / matchStats.total_with_community * 100).toFixed(1)}%)`);

  await conn.end();
  console.log('\n=== 更新完成 ===');
}

main().catch(err => {
  console.error('执行失败:', err);
  process.exit(1);
});
