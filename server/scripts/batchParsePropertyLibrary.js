/**
 * 一次性脚本：对房源库发布设置范围内的不完整记录执行批量AI解析
 * 用法: node server/scripts/batchParsePropertyLibrary.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { query } = require('../config/database');
const axios = require('axios');

const MAX_RENT_PRICE = 500000;
const CONCURRENCY = 3;

function safeNumber(val, min, max) {
  const n = Number(val);
  if (isNaN(n) || n < min || n > max) return null;
  return n;
}

function normalizeBoolean(val) {
  if (val === true || val === 1 || val === '1' || val === 'true' || val === '是' || val === 'yes') return true;
  return false;
}

async function main() {
  console.log('[批量AI解析] 开始...');

  // 1. 加载AI配置
  const [settingModel] = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'ai_parse_model_id'");
  const [settingPrompt] = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'ai_parse_prompt'");
  const modelId = settingModel?.setting_value;
  const promptTemplate = settingPrompt?.setting_value;
  if (!modelId || !promptTemplate) { console.error('AI配置缺失'); process.exit(1); }

  const [aiModel] = await query('SELECT * FROM ai_models WHERE id = ? AND is_enabled = 1', [modelId]);
  if (!aiModel) { console.error('AI模型不可用'); process.exit(1); }
  console.log(`[AI模型] ${aiModel.model_code} @ ${aiModel.api_url}`);

  // 2. 加载发布设置，获取筛选条件
  const [pubSetting] = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'property_library_publish_settings'");
  let pubCfg = {};
  try { pubCfg = JSON.parse(pubSetting?.setting_value || '{}'); } catch {}

  // 3. 查询房源库范围内的 rule_only 记录（未经AI解析的）
  let sql = `SELECT id, original_content, description, community, price, price_value, bedrooms, bathrooms, district
    FROM wechat_robot_expat_parsed_properties
    WHERE deleted_at IS NULL AND original_content IS NOT NULL AND original_content != ''
      AND is_ai_parsed = 0`;
  const params = [];

  // 按发布设置实际存储格式筛选：selected_friends 存的是发布人名字
  const friends = pubCfg.selected_friends || pubCfg.friend_wxids || [];
  if (friends.length) {
    const ph = friends.map(() => '?').join(',');
    // 判断是wxid还是名字：wxid通常包含wxid_前缀
    const isWxid = friends[0] && /^wxid_/.test(friends[0]);
    if (isWxid) {
      sql += ` AND publisher_wxid IN (${ph})`;
    } else {
      sql += ` AND publisher_name IN (${ph})`;
    }
    params.push(...friends);
  }
  if (pubCfg.time_start) {
    sql += ` AND COALESCE(moment_publish_time, created_at) >= ?`;
    params.push(pubCfg.time_start);
  }
  if (pubCfg.time_end) {
    sql += ` AND COALESCE(moment_publish_time, created_at) <= ?`;
    params.push(pubCfg.time_end + ' 23:59:59');
  }
  sql += ' ORDER BY id DESC';

  const records = await query(sql, params);
  console.log(`[待解析] ${records.length} 条不完整记录`);
  if (!records.length) { console.log('无需解析'); process.exit(0); }

  // 4. 逐条AI解析
  let success = 0, failed = 0;
  const systemPrompt = String(promptTemplate).replace(/\\n/g, '\n').replace(/\{CONTENT\}/g, '').trim();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const sourceText = row.original_content || row.description || '';
    if (!sourceText.trim()) { failed++; continue; }

    try {
      process.stdout.write(`[${i + 1}/${records.length}] ID=${row.id} ${(row.community || '').slice(0, 10)}... `);

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiModel.api_key}`,
      };
      if (aiModel.api_headers) {
        try { Object.assign(headers, typeof aiModel.api_headers === 'string' ? JSON.parse(aiModel.api_headers) : aiModel.api_headers); } catch {}
      }

      const response = await axios.post(aiModel.api_url, {
        model: aiModel.model_code || aiModel.model_name,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `房源描述：\n${sourceText}` },
        ],
        temperature: 0.1,
        max_tokens: Number(aiModel.max_tokens || 3000),
        response_format: { type: 'json_object' },
      }, { headers, timeout: 60000 });

      const aiText = response.data?.choices?.[0]?.message?.content || '';
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { console.log('AI未返回JSON'); failed++; continue; }

      const parsed = JSON.parse(jsonMatch[0]);
      const updateData = {};

      if (parsed.community) updateData.community = String(parsed.community).trim().slice(0, 200);
      if (parsed.title) updateData.title = String(parsed.title).trim().slice(0, 500);
      if (parsed.district) updateData.district = String(parsed.district).trim().slice(0, 100);
      if (parsed.street) updateData.street = String(parsed.street).trim().slice(0, 200);
      if (parsed.contact_info) updateData.contact_info = String(parsed.contact_info).trim().slice(0, 200);
      if (parsed.metro_lines) updateData.metro_lines = String(parsed.metro_lines).trim().slice(0, 200);
      if (parsed.metro_stations) updateData.metro_stations = String(parsed.metro_stations).trim().slice(0, 200);
      if (parsed.floor_info) updateData.floor_info = String(parsed.floor_info).trim().slice(0, 100);
      if (parsed.decoration) updateData.decoration = String(parsed.decoration).trim().slice(0, 50);
      if (parsed.orientation) updateData.orientation = String(parsed.orientation).trim().slice(0, 50);
      if (parsed.outdoor_features) updateData.outdoor_features = String(parsed.outdoor_features).trim().slice(0, 255);
      if (parsed.description) updateData.description = String(parsed.description).trim();

      const priceValue = safeNumber(parsed.price_value, 0, 99999999);
      if (priceValue !== null) {
        updateData.price_value = priceValue;
        if (!parsed.price) updateData.price = String(Math.round(priceValue));
      }
      if (parsed.price) updateData.price = String(parsed.price).trim().slice(0, 100);

      const bedrooms = safeNumber(parsed.bedrooms, 0, 20);
      const livingrooms = safeNumber(parsed.livingrooms ?? parsed.living_rooms, 0, 20);
      const bathrooms = safeNumber(parsed.bathrooms, 0, 20);
      const areaSqm = safeNumber(parsed.area_sqm, 0, 99999);

      if (bedrooms !== null) updateData.bedrooms = bedrooms;
      if (livingrooms !== null) updateData.livingrooms = livingrooms;
      if (bathrooms !== null) updateData.bathrooms = bathrooms;
      if (areaSqm !== null) updateData.area_sqm = areaSqm;

      if (parsed.has_elevator !== undefined) updateData.has_elevator = normalizeBoolean(parsed.has_elevator) ? 1 : 0;
      if (parsed.has_parking !== undefined) updateData.has_parking = normalizeBoolean(parsed.has_parking) ? 1 : 0;
      if (parsed.has_commission !== undefined) updateData.has_commission = normalizeBoolean(parsed.has_commission) ? 1 : 0;
      if (parsed.is_duplex !== undefined) updateData.is_duplex = normalizeBoolean(parsed.is_duplex) ? 1 : 0;

      updateData.is_ai_parsed = 1;
      updateData.parse_status = 'ai_parsed';
      updateData.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

      if (Object.keys(updateData).length <= 3) { console.log('AI未提取到有效字段'); failed++; continue; }

      const setClauses = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updateData), row.id];
      await query(`UPDATE wechat_robot_expat_parsed_properties SET ${setClauses} WHERE id = ?`, values);

      const filledFields = Object.keys(updateData).filter(k => !['is_ai_parsed', 'parse_status', 'updated_at'].includes(k));
      console.log(`OK (${filledFields.join(',')})`);
      success++;
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      failed++;
    }

    // 控制速率避免API限流
    if (i < records.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n[完成] 成功: ${success}, 失败: ${failed}, 总计: ${records.length}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
