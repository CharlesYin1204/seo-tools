/**
 * 对「小区为空」的解析记录用 matchPOIBeforeAI 补全小区名（分批+进度）
 * 用法: node scripts/fixEmptyCommunityFromPOI.js [每批条数，默认400]
 */
const { query } = require('../server/config/database');
const ctrl = require('../server/controllers/user/WeChatRobotPluginController');
const matchPOIBeforeAI = ctrl.matchPOIBeforeAI;

const BATCH = parseInt(process.argv[2], 10) || 400;

async function run() {
  const countR = await query(
    "SELECT COUNT(*) as c FROM wechat_robot_expat_parsed_properties WHERE (community IS NULL OR community='') AND original_content IS NOT NULL AND original_content != ''"
  );
  const total = (Array.isArray(countR[0]) ? countR[0] : countR)[0].c;
  console.log(`[fixEmptyCommunity] 待处理空小区记录: ${total} 条，每批 ${BATCH}`);

  let offset = 0;
  let fixed = 0;
  let skipped = 0;
  let err = 0;

  while (offset < total) {
    const r = await query(
      `SELECT id, original_content, district FROM wechat_robot_expat_parsed_properties
       WHERE (community IS NULL OR community='') AND original_content IS NOT NULL AND original_content != ''
       ORDER BY id ASC LIMIT ${BATCH} OFFSET ${offset}`
    );
    const rows = Array.isArray(r[0]) ? r[0] : r;
    if (!rows.length) break;

    for (const row of rows) {
      try {
        const content = (row.original_content || '').replace(/\\n/g, '\n');
        const result = await matchPOIBeforeAI(content, null);
        if (result && result.community_name) {
          const updates = { community: result.community_name };
          if (result.district) updates.district = result.district;
          const setClauses = Object.keys(updates).map((k) => k + '=?').join(',');
          await query(
            'UPDATE wechat_robot_expat_parsed_properties SET ' + setClauses + ', updated_at=NOW() WHERE id=?',
            [...Object.values(updates), row.id]
          );
          fixed++;
        } else {
          skipped++;
        }
      } catch (e) {
        err++;
      }
    }
    offset += rows.length;
    console.log(`[fixEmptyCommunity] 已扫描 ${offset}/${total}，补全 ${fixed}，无匹配 ${skipped}，错误 ${err}`);
    if (rows.length < BATCH) break;
  }

  console.log(`[fixEmptyCommunity] 完成: 补全 ${fixed}，无匹配 ${skipped}，错误 ${err}`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
