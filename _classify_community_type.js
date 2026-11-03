/**
 * 一次性脚本：为 wechat_robot_expat_parsed_properties.community_type 分类
 * 分类规则：
 *   0 = 未分类
 *   1 = 真实小区名
 *   2 = 区域名（静安、长宁、浦东新 等）
 *   3 = 商圈/地标（中山公园、陆家嘴、静安寺 等）
 *   4 = 路名地址（XX路XX弄XX号 等）
 *   5 = 其他非小区（豪装全送、智能家居 等）
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'shexpatshome',
    password: process.env.DB_PASSWORD || 'shexpatshome',
    database: process.env.DB_NAME || 'shexpatshome',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
  });

  // 1. 加载标准区域名
  const [distRows] = await pool.query('SELECT name_cn FROM property_districts WHERE is_active = 1');
  const districtsFull = distRows.map(r => r.name_cn); // ['黄浦区','徐汇区',...]
  const districtsShort = districtsFull.map(d => d.replace(/区$/, '')); // ['黄浦','徐汇',...]
  const districtSet = new Set([...districtsFull, ...districtsShort, '上海', '浦东新', '浦东']);
  console.log(`加载 ${districtsFull.length} 个标准区域`);

  // 2. 加载商圈名
  const [boardRows] = await pool.query('SELECT DISTINCT board FROM property_community_dict WHERE board IS NOT NULL AND board != "" AND board != "[]"');
  const boardSet = new Set(boardRows.map(r => r.board).filter(Boolean));
  console.log(`加载 ${boardSet.size} 个商圈`);

  // 3. 加载地铁站名
  const [stationRows] = await pool.query('SELECT DISTINCT name_cn FROM property_metro_stations WHERE is_active = 1');
  const stationSet = new Set(stationRows.map(r => r.name_cn).filter(Boolean));
  console.log(`加载 ${stationSet.size} 个地铁站`);

  // 4. 加载POI小区名
  const [poiRows] = await pool.query('SELECT DISTINCT community_name FROM property_community_dict WHERE is_enabled = 1');
  const poiSet = new Set(poiRows.map(r => r.community_name).filter(Boolean));
  console.log(`加载 ${poiSet.size} 个POI小区`);

  // 5. 获取所有需要分类的记录（community不为空 且 community_type=0）
  const [rows] = await pool.query(`
    SELECT DISTINCT community FROM wechat_robot_expat_parsed_properties 
    WHERE community IS NOT NULL AND community != '' AND deleted_at IS NULL AND community_type = 0
  `);
  console.log(`需要分类的不同小区名：${rows.length} 个`);

  // 已知的非小区关键词模式
  const otherKeywords = new Set([
    '豪装全送', '智能家居', '房型', '全新小区', '老公寓', '老洋房', '衡复老公寓',
    '等内环内主城', '安区及周边区域', '梧桐区', '老静安', '巨富长', '毛坯',
    '魔都择校/升学，居住证，人户', '风貌区', '全上海', '使用权',
  ]);

  // 纯路名地址模式
  const roadPattern = /^[\u4e00-\u9fa5]+(路|街|道|大道|弄|里|坊|支弄|巷)\d+/;
  const roadOnlyPattern = /^[\u4e00-\u9fa5]+(路|街|道|大道|弄|里|坊|支弄|巷)$/;
  // 带"区"前缀格式: 静安区万航渡路458号
  const districtPrefixRoad = /^(黄浦|徐汇|长宁|静安|普陀|虹口|杨浦|闵行|宝山|嘉定|浦东新?|金山|松江|青浦|奉贤|崇明)区?[\u4e00-\u9fa5]+(路|街|道|大道|弄|里)\d+/;
  // "XX·XX" 格式商圈组合
  const compositeArea = /^[\u4e00-\u9fa5]+[·・][\u4e00-\u9fa5]+$/;
  // 付佣金开头
  const commissionPrefix = /^付佣金/;

  const updates = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  let inPoi = 0;

  for (const row of rows) {
    const name = (row.community || '').trim();
    if (!name) continue;

    // 如果在POI里 → 标为真实小区
    if (poiSet.has(name)) {
      updates[1].push(name);
      inPoi++;
      continue;
    }

    // 区域名判断
    if (districtSet.has(name) || districtSet.has(name.replace(/区$/, ''))) {
      updates[2].push(name);
      continue;
    }

    // 商圈/地标判断
    if (boardSet.has(name) || stationSet.has(name)) {
      updates[3].push(name);
      continue;
    }

    // 复合区域格式: "静安·静安寺", "长宁·中山公园"
    if (compositeArea.test(name)) {
      const parts = name.split(/[·・]/);
      const isAreaComposite = parts.some(p => districtSet.has(p) || boardSet.has(p) || stationSet.has(p));
      if (isAreaComposite) {
        updates[3].push(name);
        continue;
      }
    }

    // 带区域前缀的路名地址
    if (districtPrefixRoad.test(name)) {
      updates[4].push(name);
      continue;
    }

    // 纯路名+号码地址
    if (roadPattern.test(name)) {
      updates[4].push(name);
      continue;
    }

    // 纯路名（无号码）
    if (roadOnlyPattern.test(name)) {
      updates[4].push(name);
      continue;
    }

    // 付佣金开头的
    if (commissionPrefix.test(name)) {
      updates[4].push(name);
      continue;
    }

    // 已知非小区关键词
    if (otherKeywords.has(name)) {
      updates[5].push(name);
      continue;
    }

    // 纯商业地标词（含"iapm","里"结尾的商场等）
    if (/^(环贸|太古汇|恒隆广场|北外滩来福士|环宇城|旭辉里|上生新所|幸福里|大悦城|新天地|iapm)/.test(name) && !poiSet.has(name)) {
      updates[3].push(name);
      continue;
    }

    // 兜底：如果名字看起来像一个真实小区名（2-20字，不含明显杂质）→ 标为1
    if (name.length >= 2 && name.length <= 20 && /[\u4e00-\u9fa5]/.test(name) && !/^\d+$/.test(name)) {
      updates[1].push(name);
    } else {
      updates[5].push(name);
    }
  }

  console.log('\n--- 分类统计 ---');
  console.log(`1(真实小区): ${updates[1].length} (其中${inPoi}个在POI中)`);
  console.log(`2(区域名):   ${updates[2].length}`);
  console.log(`3(商圈地标): ${updates[3].length}`);
  console.log(`4(路名地址): ${updates[4].length}`);
  console.log(`5(其他):     ${updates[5].length}`);

  // 打印部分样本
  console.log('\n样本-区域名(2):', updates[2].slice(0, 20).join(', '));
  console.log('样本-商圈地标(3):', updates[3].slice(0, 20).join(', '));
  console.log('样本-路名地址(4):', updates[4].slice(0, 30).join(', '));
  console.log('样本-其他(5):', updates[5].slice(0, 20).join(', '));
  console.log('样本-真实小区(1, 非POI):', updates[1].filter(n => !poiSet.has(n)).slice(0, 20).join(', '));

  // 执行更新
  for (const [type, names] of Object.entries(updates)) {
    if (names.length === 0) continue;
    const batchSize = 200;
    let updated = 0;
    for (let i = 0; i < names.length; i += batchSize) {
      const batch = names.slice(i, i + batchSize);
      const placeholders = batch.map(() => '?').join(',');
      const [result] = await pool.query(
        `UPDATE wechat_robot_expat_parsed_properties SET community_type = ? WHERE community IN (${placeholders}) AND community_type = 0 AND deleted_at IS NULL`,
        [parseInt(type), ...batch]
      );
      updated += result.affectedRows || 0;
    }
    console.log(`类型${type}: 更新了 ${updated} 条记录`);
  }

  // 验证
  const [stats] = await pool.query(`
    SELECT community_type, COUNT(*) as cnt 
    FROM wechat_robot_expat_parsed_properties 
    WHERE community IS NOT NULL AND community != '' AND deleted_at IS NULL
    GROUP BY community_type ORDER BY community_type
  `);
  console.log('\n--- 最终统计 ---');
  const typeNames = { 0: '未分类', 1: '真实小区', 2: '区域名', 3: '商圈地标', 4: '路名地址', 5: '其他' };
  for (const s of stats) {
    console.log(`  ${typeNames[s.community_type] || s.community_type}: ${s.cnt} 条`);
  }

  await pool.end();
  console.log('\n分类完成！');
}

main().catch(err => {
  console.error('错误:', err);
  process.exit(1);
});
