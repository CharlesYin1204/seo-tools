const ctrl = require('./WeChatRobotPluginController');
const SystemSetting = require('../../models/SystemSetting');
const { query } = require('../../config/database');

async function main() {
  const aiModelId = await SystemSetting.get('ai_parse_model_id', null);
  const modelRows = await query('SELECT * FROM ai_models WHERE id = ? LIMIT 1', [aiModelId]);
  const aiModel = Array.isArray(modelRows) ? modelRows[0] : modelRows;
  const aiPrompt = await SystemSetting.get('ai_parse_prompt', '');

  if (!aiModel) {
    throw new Error('AI模型不存在');
  }

  const rows = await query(`
    SELECT id, original_content, favorites_content
    FROM wechat_robot_expat_parsed_properties
    WHERE DATE(created_at) = CURDATE() AND deleted_at IS NULL
    ORDER BY id ASC
  `);

  let success = 0;
  let failed = 0;
  const failedItems = [];

  for (const row of rows) {
    let parseContent = row.original_content || '';
    if (row.favorites_content) {
      const fav = row.favorites_content;
      if (!parseContent || parseContent.includes('CDATA') || fav.length > parseContent.length) {
        parseContent = fav;
      } else if (!parseContent.includes(fav.substring(0, Math.min(20, fav.length)))) {
        parseContent = parseContent + '\n' + fav;
      }
    }

    if (!parseContent) {
      failed++;
      if (failedItems.length < 50) failedItems.push({ id: row.id, reason: '无可解析原文' });
      continue;
    }

    try {
      const parsed = await ctrl.parsePropertyContent(parseContent, aiModel, aiPrompt, { requireAiValidation: true });
      parsed.original_content = parseContent;
      await ctrl.updateParsedPropertyFromAI(row.id, parsed);
      success++;
    } catch (err) {
      failed++;
      if (failedItems.length < 50) {
        failedItems.push({ id: row.id, reason: err.message });
      }
    }
  }

  console.log(JSON.stringify({
    total: rows.length,
    success,
    failed,
    failedItems,
  }));
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
