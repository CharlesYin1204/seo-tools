#!/usr/bin/env node
/**
 * 批量修复小区名：格局/无效名 → 清空后按 POI>地址>地标>区域 提取，小区不能为空
 * 用法: node scripts/reprocess-community-batch.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../server/config/database');
const ctrl = require('../server/controllers/user/WeChatRobotPluginController');

const INVALID_OR_GARBAGE = [
  '格局', '位置', '适合', '交通', '价格', '联系', '面积', '户型', '装修',
  '徐汇', '静安', '长宁', '普陀', '虹口', '杨浦', '黄浦', '浦东', '闵行', '宝山',
  '嘉定', '松江', '青浦', '奉贤', '金山', '崇明',
  '澳门路',
];

async function main() {
  console.log('1. 清空无效小区名（格局/区域名等）...');
  const placeholders = INVALID_OR_GARBAGE.map(() => '?').join(',');
  const cleanResult = await query(
    `UPDATE wechat_robot_expat_parsed_properties SET community = NULL
     WHERE deleted_at IS NULL AND community IN (${placeholders})`,
    INVALID_OR_GARBAGE
  );
  const cleaned = cleanResult?.affectedRows ?? 0;
  console.log(`   已清空 ${cleaned} 条`);

  console.log('1.5. 去除小区名前多余的区名（如 长宁区愚园路1355弄→愚园路1355弄）...');
  const prefixResult = await query(
    `UPDATE wechat_robot_expat_parsed_properties SET community = TRIM(SUBSTRING(community, 4))
     WHERE deleted_at IS NULL AND community REGEXP '^(徐汇|静安|长宁|普陀|虹口|杨浦|黄浦|浦东|闵行|宝山|嘉定|松江|青浦|奉贤|金山|崇明)区'`
  );
  const prefixFixed = prefixResult?.affectedRows ?? 0;
  console.log(`   已修复 ${prefixFixed} 条`);

  console.log('2. 修复空小区（含无文案的，用区域或上海兜底）...');
  const emptyRows = await query(
    `SELECT id FROM wechat_robot_expat_parsed_properties
     WHERE deleted_at IS NULL
     AND (community IS NULL OR community = '' OR TRIM(community) = '')
     ORDER BY id`
  );
  const emptyList = Array.isArray(emptyRows) ? emptyRows : (emptyRows ? [emptyRows] : []);
  console.log(`   空小区共 ${emptyList.length} 条`);

  let fixed = 0;
  for (let i = 0; i < emptyList.length; i++) {
    const row = emptyList[i];
    const id = (row && typeof row === 'object' && 'id' in row) ? row.id : (Array.isArray(row) ? row[0] : row);
    try {
      const newCommunity = await ctrl.reprocessCommunityForRecord(id);
      if (newCommunity) fixed++;
    } catch (e) {
      console.error(`   id=${id} 失败:`, e.message);
    }
    if ((i + 1) % 500 === 0) process.stdout.write(`   已处理 ${i + 1}/${emptyList.length}\r`);
  }

  console.log('\n2b. 补全有小区但无地铁信息的记录（如 和泰花园小区→和泰花园+地铁）...');
  const noMetroRows = await query(
    `SELECT id FROM wechat_robot_expat_parsed_properties
     WHERE deleted_at IS NULL
     AND community IS NOT NULL AND TRIM(community) != ''
     AND (metro_stations IS NULL OR TRIM(metro_stations) = '' OR metro_stations = '-')
     AND original_content IS NOT NULL AND TRIM(original_content) != ''
     ORDER BY id`
  );
  const noMetroList = Array.isArray(noMetroRows) ? noMetroRows : (noMetroRows ? [noMetroRows] : []);
  console.log(`   有小区无地铁共 ${noMetroList.length} 条`);

  for (let i = 0; i < noMetroList.length; i++) {
    const row = noMetroList[i];
    const id = (row && typeof row === 'object' && 'id' in row) ? row.id : (Array.isArray(row) ? row[0] : row);
    try {
      const newCommunity = await ctrl.reprocessCommunityForRecord(id);
      if (newCommunity) fixed++;
    } catch (e) {
      console.error(`   id=${id} 失败:`, e.message);
    }
    if ((i + 1) % 500 === 0) process.stdout.write(`   已处理 ${i + 1}/${noMetroList.length}\r`);
  }

  console.log('\n2c. 修复卧室数（2+1房→3室、1+1房→2室）...');
  const bedroomRows = await query(
    `SELECT id FROM wechat_robot_expat_parsed_properties
     WHERE deleted_at IS NULL
     AND original_content IS NOT NULL AND TRIM(original_content) != ''
     AND (original_content REGEXP '[0-9]+[+＋][0-9]+[房室]' OR original_content LIKE '%+%房%')
     ORDER BY id`
  );
  const bedroomList = Array.isArray(bedroomRows) ? bedroomRows : (bedroomRows ? [bedroomRows] : []);
  console.log(`   含X+Y房/室格式共 ${bedroomList.length} 条`);
  for (let i = 0; i < bedroomList.length; i++) {
    const row = bedroomList[i];
    const id = (row && typeof row === 'object' && 'id' in row) ? row.id : (Array.isArray(row) ? row[0] : row);
    try {
      const updated = await ctrl.reprocessBedroomsOnly(id);
      if (updated) fixed++;
    } catch (e) {
      console.error(`   id=${id} 失败:`, e.message);
    }
    if ((i + 1) % 500 === 0) process.stdout.write(`   已处理 ${i + 1}/${bedroomList.length}\r`);
  }

  console.log(`\n3. 完成：共修复 ${fixed} 条`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
