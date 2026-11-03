/**
 * 上海小区POI数据导入脚本
 * 功能: 清洗房天下CSV数据 → 清除旧POI → 批量导入到 property_community_dict
 * 
 * 使用方式: node scripts/import-community-poi.js
 * 可选参数:
 *   --dry-run    只统计不写入
 *   --keep-old   保留旧数据(合并模式)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const iconv = require('iconv-lite');

const CSV_PATH = path.resolve(__dirname, '../上海小区数据/房天下-上海租房房源数据.csv');
const DRY_RUN = process.argv.includes('--dry-run');
const KEEP_OLD = process.argv.includes('--keep-old');
const BATCH_SIZE = 500;

const DISTRICT_MAP = {
  '浦东': '浦东新区', '黄浦': '黄浦区', '徐汇': '徐汇区', '长宁': '长宁区',
  '静安': '静安区', '普陀': '普陀区', '虹口': '虹口区', '杨浦': '杨浦区',
  '闵行': '闵行区', '宝山': '宝山区', '嘉定': '嘉定区', '金山': '金山区',
  '松江': '松江区', '青浦': '青浦区', '奉贤': '奉贤区', '崇明': '崇明区',
};

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseMetroInfo(metroStr) {
  if (!metroStr) return { line: null, station: null, distance: null };
  const match = metroStr.match(/(\d+)号线(?:\([^)]*\))?\s*(.+?)站(?:约(\d+)米)?/);
  if (match) {
    return {
      line: match[1] + '号线',
      station: match[2].replace(/[(\(（].*$/, '').trim() + '站',
      distance: match[3] ? parseInt(match[3], 10) : null,
    };
  }
  const match2 = metroStr.match(/(\d+)号线/);
  if (match2) {
    return {
      line: match2[1] + '号线',
      station: null,
      distance: null,
    };
  }
  return { line: null, station: null, distance: null };
}

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const match = priceStr.match(/(\d+)\s*元\/月/);
  return match ? parseInt(match[1], 10) : null;
}

function parseLayout(layoutStr) {
  if (!layoutStr) return { bedrooms: null, livingrooms: null };
  const match = layoutStr.match(/(\d+)\s*室\s*(\d+)?\s*厅?/);
  if (match) {
    return {
      bedrooms: parseInt(match[1], 10),
      livingrooms: match[2] != null ? parseInt(match[2], 10) : null,
    };
  }
  return { bedrooms: null, livingrooms: null };
}

function cleanCommunityName(name) {
  if (!name) return null;
  let cleaned = name.replace(/\s+/g, '').trim();
  if (cleaned.length < 2 || cleaned.length > 50) return null;
  return cleaned;
}

function generateAliases(communityName) {
  const aliases = new Set();
  const periodMatch = communityName.match(/^(.{2,}?)(一期|二期|三期|四期|五期|六期|七期|八期|九期|十期|[A-D]区|南区|北区|东区|西区)$/);
  if (periodMatch) {
    aliases.add(periodMatch[1]);
  }
  const numPeriodMatch = communityName.match(/^(.{2,}?)(第?[一二三四五六七八九十\d]+(?:期|区|社区|组团))$/);
  if (numPeriodMatch && numPeriodMatch[1].length >= 2) {
    aliases.add(numPeriodMatch[1]);
  }
  const parenMatch = communityName.match(/^(.{2,}?)[（(].+[）)]$/);
  if (parenMatch) {
    aliases.add(parenMatch[1]);
  }
  aliases.delete(communityName);
  return [...aliases].filter(a => a.length >= 2);
}

async function main() {
  console.log('========================================');
  console.log('上海小区POI数据导入工具');
  console.log('========================================');
  console.log(`CSV文件: ${CSV_PATH}`);
  console.log(`模式: ${DRY_RUN ? '试运行(不写入)' : KEEP_OLD ? '合并模式' : '全量替换'}`);

  if (!fs.existsSync(CSV_PATH)) {
    console.error('CSV文件不存在:', CSV_PATH);
    process.exit(1);
  }

  const rawBuffer = fs.readFileSync(CSV_PATH);
  const content = iconv.decode(rawBuffer, 'gbk');
  const lines = content.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) {
    console.error('CSV文件为空或格式错误');
    process.exit(1);
  }

  console.log(`\n读取CSV: ${lines.length - 1} 条房源记录`);

  const communityMap = new Map();
  let parseErrors = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 7) { parseErrors++; continue; }

    const location = fields[5];
    if (!location || !location.includes('-')) { parseErrors++; continue; }

    const parts = location.split('-');
    if (parts.length < 3) { parseErrors++; continue; }

    const districtShort = parts[0].trim();
    const board = parts[1].trim();
    const communityRaw = parts.slice(2).join('-').trim();
    const communityName = cleanCommunityName(communityRaw);

    if (!communityName || !districtShort) { parseErrors++; continue; }

    const district = DISTRICT_MAP[districtShort] || districtShort + '区';
    const metro = parseMetroInfo(fields[6]);
    const price = parsePrice(fields[7]);
    const layout = parseLayout(fields[2]);

    const key = `${communityName}__${district}`;

    if (communityMap.has(key)) {
      const existing = communityMap.get(key);
      existing.listing_count++;
      if (price) {
        existing.prices.push(price);
      }
      if (metro.line && !existing.metro.line) {
        existing.metro = metro;
      }
      if (metro.distance && (!existing.metro.distance || metro.distance < existing.metro.distance)) {
        existing.metro = metro;
      }
    } else {
      communityMap.set(key, {
        community_name: communityName,
        district,
        board,
        metro,
        prices: price ? [price] : [],
        listing_count: 1,
      });
    }
  }

  console.log(`解析完成: ${communityMap.size} 个去重小区, ${parseErrors} 条解析失败`);

  const records = [];
  for (const [, data] of communityMap) {
    const aliases = generateAliases(data.community_name);
    const priceMin = data.prices.length > 0 ? Math.min(...data.prices) : null;
    const priceMax = data.prices.length > 0 ? Math.max(...data.prices) : null;

    records.push({
      community_name: data.community_name,
      district: data.district,
      board: data.board,
      alias_names: aliases.length > 0 ? JSON.stringify(aliases) : null,
      nearest_metro_line: data.metro.line,
      nearest_metro_station: data.metro.station,
      nearest_metro_distance: data.metro.distance,
      ref_price_min: priceMin,
      ref_price_max: priceMax,
      listing_count: data.listing_count,
      source: 'fangtianxia_csv',
      is_enabled: 1,
    });
  }

  const districtStats = {};
  for (const r of records) {
    districtStats[r.district] = (districtStats[r.district] || 0) + 1;
  }
  console.log('\n=== 各区小区数量统计 ===');
  for (const [d, c] of Object.entries(districtStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${d}: ${c} 个小区`);
  }

  const withMetro = records.filter(r => r.nearest_metro_station).length;
  const withPrice = records.filter(r => r.ref_price_min).length;
  const withAlias = records.filter(r => r.alias_names).length;
  console.log(`\n有地铁信息: ${withMetro}/${records.length} (${(withMetro/records.length*100).toFixed(1)}%)`);
  console.log(`有价格参考: ${withPrice}/${records.length} (${(withPrice/records.length*100).toFixed(1)}%)`);
  console.log(`有别名: ${withAlias}/${records.length}`);

  if (DRY_RUN) {
    console.log('\n[试运行] 不写入数据库，已完成分析');
    process.exit(0);
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
  });

  const conn = await pool.getConnection();
  try {
    console.log('\n连接数据库成功');

    console.log('检查表结构...');
    const alterSqls = [
      "ALTER TABLE `property_community_dict` ADD COLUMN `board` VARCHAR(100) DEFAULT NULL COMMENT '所属板块' AFTER `street`",
      "ALTER TABLE `property_community_dict` ADD COLUMN `nearest_metro_line` VARCHAR(50) DEFAULT NULL COMMENT '最近地铁线路' AFTER `avg_price`",
      "ALTER TABLE `property_community_dict` ADD COLUMN `nearest_metro_station` VARCHAR(100) DEFAULT NULL COMMENT '最近地铁站名' AFTER `nearest_metro_line`",
      "ALTER TABLE `property_community_dict` ADD COLUMN `nearest_metro_distance` INT UNSIGNED DEFAULT NULL COMMENT '距最近地铁站距离(米)' AFTER `nearest_metro_station`",
      "ALTER TABLE `property_community_dict` ADD COLUMN `ref_price_min` INT UNSIGNED DEFAULT NULL COMMENT '参考租金最低价' AFTER `nearest_metro_distance`",
      "ALTER TABLE `property_community_dict` ADD COLUMN `ref_price_max` INT UNSIGNED DEFAULT NULL COMMENT '参考租金最高价' AFTER `ref_price_min`",
      "ALTER TABLE `property_community_dict` ADD COLUMN `listing_count` INT UNSIGNED DEFAULT 0 COMMENT '房源数量' AFTER `ref_price_max`",
    ];
    for (const sql of alterSqls) {
      try { await conn.query(sql); } catch (e) { if (!e.message.includes('Duplicate column')) throw e; }
    }

    try {
      await conn.query("ALTER TABLE `wechat_robot_expat_parsed_properties` ADD COLUMN `livingrooms` INT(2) DEFAULT NULL COMMENT '客厅数量' AFTER `bedrooms`");
      console.log('解析表已新增 livingrooms 字段');
    } catch (e) { if (!e.message.includes('Duplicate column')) throw e; }

    if (!KEEP_OLD) {
      const [oldCount] = await conn.query('SELECT COUNT(*) as cnt FROM property_community_dict');
      console.log(`清除旧POI数据: ${oldCount[0].cnt} 条`);
      await conn.query('DELETE FROM property_community_dict');
    }

    console.log(`\n开始导入 ${records.length} 条小区数据...`);
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = [];

      for (const r of batch) {
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())');
        values.push(
          r.community_name, r.district, r.board, r.alias_names,
          r.nearest_metro_line, r.nearest_metro_station, r.nearest_metro_distance,
          r.ref_price_min, r.ref_price_max, r.listing_count,
          r.source, r.is_enabled
        );
      }

      const sql = `INSERT INTO property_community_dict 
        (community_name, district, board, alias_names, 
         nearest_metro_line, nearest_metro_station, nearest_metro_distance,
         ref_price_min, ref_price_max, listing_count,
         source, is_enabled, created_at, updated_at) 
        VALUES ${placeholders.join(',')}
        ON DUPLICATE KEY UPDATE 
          board = VALUES(board),
          alias_names = COALESCE(VALUES(alias_names), alias_names),
          nearest_metro_line = COALESCE(VALUES(nearest_metro_line), nearest_metro_line),
          nearest_metro_station = COALESCE(VALUES(nearest_metro_station), nearest_metro_station),
          nearest_metro_distance = COALESCE(VALUES(nearest_metro_distance), nearest_metro_distance),
          ref_price_min = VALUES(ref_price_min),
          ref_price_max = VALUES(ref_price_max),
          listing_count = VALUES(listing_count),
          source = VALUES(source),
          updated_at = NOW()`;

      try {
        const [result] = await conn.query(sql, values);
        inserted += result.affectedRows;
      } catch (e) {
        console.error(`批次 ${Math.floor(i/BATCH_SIZE)+1} 导入失败:`, e.message);
        for (const r of batch) {
          try {
            await conn.query(
              `INSERT INTO property_community_dict 
                (community_name, district, board, alias_names, nearest_metro_line, nearest_metro_station, nearest_metro_distance, ref_price_min, ref_price_max, listing_count, source, is_enabled, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE board = VALUES(board), alias_names = COALESCE(VALUES(alias_names), alias_names), updated_at = NOW()`,
              [r.community_name, r.district, r.board, r.alias_names, r.nearest_metro_line, r.nearest_metro_station, r.nearest_metro_distance, r.ref_price_min, r.ref_price_max, r.listing_count, r.source, r.is_enabled]
            );
            inserted++;
          } catch (e2) {
            errors++;
          }
        }
      }

      const progress = Math.min(100, Math.round((i + batch.length) / records.length * 100));
      process.stdout.write(`\r  进度: ${progress}% (${i + batch.length}/${records.length})`);
    }

    console.log('');
    const [finalCount] = await conn.query('SELECT COUNT(*) as cnt FROM property_community_dict');
    console.log('\n========================================');
    console.log('导入完成!');
    console.log(`  表中总记录数: ${finalCount[0].cnt}`);
    console.log(`  本次影响行数: ${inserted}`);
    console.log(`  导入失败: ${errors}`);
    console.log('========================================');

  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('执行失败:', err);
  process.exit(1);
});
