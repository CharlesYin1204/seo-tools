#!/usr/bin/env node
/**
 * 从清洗后的上海小区CSV导入POI数据到 property_community_dict 表
 * 策略：
 *   - 已存在的小区（按 community_name + district 匹配）：补充缺失的字段（坐标、地址、板块、类型等）
 *   - 不存在的小区：新增记录
 * 
 * 用法: node scripts/import-shanghai-poi-excel.js [--dry-run]
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', '上海小区数据', 'shanghai_poi_cleaned.csv');
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`=== 导入上海小区POI数据 (${DRY_RUN ? '模拟运行' : '正式导入'}) ===\n`);

  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = csvContent.split('\n').filter(l => l.trim());
  const header = parseCSVLine(lines[0]);
  console.log(`CSV 列: ${header.join(', ')}`);
  console.log(`CSV 数据行: ${lines.length - 1}\n`);

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const rec = {};
    header.forEach((h, idx) => { rec[h] = vals[idx] || ''; });
    records.push(rec);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
  });

  console.log('数据库连接成功，正在加载现有小区数据...');
  const [existing] = await conn.query(
    'SELECT id, community_name, district, latitude, longitude, address, board, property_type, build_year, total_units FROM property_community_dict'
  );

  const existingMap = new Map();
  existing.forEach(row => {
    const key = `${row.community_name}||${row.district}`;
    existingMap.set(key, row);
  });
  console.log(`现有小区记录: ${existing.length}\n`);

  let updated = 0, inserted = 0, skipped = 0;
  const updateBatch = [];
  const insertBatch = [];

  for (const rec of records) {
    const key = `${rec.community_name}||${rec.district}`;
    const existingRow = existingMap.get(key);

    if (existingRow) {
      const updates = {};

      if ((!existingRow.latitude || parseFloat(existingRow.latitude) === 0) && rec.latitude) {
        updates.latitude = parseFloat(rec.latitude);
      }
      if ((!existingRow.longitude || parseFloat(existingRow.longitude) === 0) && rec.longitude) {
        updates.longitude = parseFloat(rec.longitude);
      }
      if (!existingRow.address && rec.address) {
        updates.address = rec.address;
      }
      if (!existingRow.board && rec.board) {
        updates.board = rec.board;
      }
      if ((!existingRow.property_type || existingRow.property_type === '住宅') && rec.property_type && rec.property_type !== '住宅') {
        updates.property_type = rec.property_type;
      }
      if (!existingRow.build_year && rec.build_year) {
        updates.build_year = parseInt(rec.build_year);
      }
      if (!existingRow.total_units && rec.total_units) {
        updates.total_units = parseInt(rec.total_units);
      }

      if (Object.keys(updates).length > 0) {
        updateBatch.push({ id: existingRow.id, updates });
        updated++;
      } else {
        skipped++;
      }
    } else {
      insertBatch.push(rec);
      inserted++;
    }
  }

  console.log(`=== 分析结果 ===`);
  console.log(`需要更新: ${updated} 条 (补充缺失字段)`);
  console.log(`需要新增: ${inserted} 条`);
  console.log(`无需变更: ${skipped} 条\n`);

  if (DRY_RUN) {
    console.log('[模拟运行] 以下是将要执行的操作预览:\n');
    if (updateBatch.length > 0) {
      console.log('--- 更新示例 (前5条) ---');
      updateBatch.slice(0, 5).forEach(u => {
        console.log(`  ID ${u.id}: ${JSON.stringify(u.updates)}`);
      });
    }
    if (insertBatch.length > 0) {
      console.log('\n--- 新增示例 (前5条) ---');
      insertBatch.slice(0, 5).forEach(r => {
        console.log(`  ${r.community_name} (${r.district}) @ ${r.latitude},${r.longitude}`);
      });
    }
    console.log('\n--- 按区域分布 (新增) ---');
    const distCount = {};
    insertBatch.forEach(r => { distCount[r.district] = (distCount[r.district] || 0) + 1; });
    Object.entries(distCount).sort((a, b) => b[1] - a[1]).forEach(([d, c]) => {
      console.log(`  ${d}: ${c}`);
    });
    await conn.end();
    return;
  }

  // 执行更新
  if (updateBatch.length > 0) {
    console.log('正在执行更新...');
    let updatedCount = 0;
    for (const item of updateBatch) {
      const setClauses = Object.keys(item.updates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(item.updates), item.id];
      await conn.query(`UPDATE property_community_dict SET ${setClauses} WHERE id = ?`, values);
      updatedCount++;
      if (updatedCount % 500 === 0) {
        console.log(`  已更新 ${updatedCount}/${updateBatch.length}...`);
      }
    }
    console.log(`  更新完成: ${updatedCount} 条\n`);
  }

  // 执行新增（批量插入）
  if (insertBatch.length > 0) {
    console.log('正在批量新增...');
    const BATCH_SIZE = 200;
    let insertedCount = 0;

    for (let i = 0; i < insertBatch.length; i += BATCH_SIZE) {
      const batch = insertBatch.slice(i, i + BATCH_SIZE);
      const values = batch.map(rec => [
        rec.community_name,
        rec.district,
        rec.board || null,
        rec.address || null,
        rec.latitude ? parseFloat(rec.latitude) : null,
        rec.longitude ? parseFloat(rec.longitude) : null,
        rec.property_type || '住宅',
        rec.build_year ? parseInt(rec.build_year) : null,
        rec.total_units ? parseInt(rec.total_units) : null,
        'national_poi_excel'
      ]);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const [result] = await conn.query(
        `INSERT IGNORE INTO property_community_dict 
         (community_name, district, board, address, latitude, longitude, property_type, build_year, total_units, source) 
         VALUES ${placeholders}`,
        values.flat()
      );
      const skippedDups = batch.length - result.affectedRows;
      if (skippedDups > 0) insertedCount -= skippedDups;
      insertedCount += batch.length;
      if (insertedCount % 2000 === 0 || insertedCount === insertBatch.length) {
        console.log(`  已新增 ${insertedCount}/${insertBatch.length}...`);
      }
    }
    console.log(`  新增完成: ${insertedCount} 条\n`);
  }

  // 验证
  const [[{ finalTotal }]] = await conn.query('SELECT COUNT(*) as finalTotal FROM property_community_dict');
  const [[coordStats]] = await conn.query(`
    SELECT 
      COUNT(CASE WHEN latitude IS NOT NULL AND latitude != 0 THEN 1 END) as has_coords,
      COUNT(CASE WHEN address IS NOT NULL AND address != '' THEN 1 END) as has_address
    FROM property_community_dict
  `);

  console.log('=== 导入后统计 ===');
  console.log(`总记录数: ${finalTotal}`);
  console.log(`有坐标: ${coordStats.has_coords}`);
  console.log(`有地址: ${coordStats.has_address}`);

  await conn.end();
  console.log('\n导入完成！');
}

/**
 * 解析CSV行（处理引号内的逗号）
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

main().catch(err => {
  console.error('导入失败:', err);
  process.exit(1);
});
