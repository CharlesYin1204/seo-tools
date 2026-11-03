/**
 * 定时修复 Job：
 * 1. 回填 parsed_properties 中缺失的 moment_id（从原始表关联补充）
 * 2. 为缺少 property_code 的已发布房源生成编号
 * 注意：自动发布逻辑已于2026-03-18移除，房源只能通过手动点击发布按钮进入房源库
 */
const { query } = require('../config/database');

let isRunning = false;

async function fixMomentIdsJob() {
  if (isRunning) return;
  isRunning = true;
  try {
    // 1. 回填缺失的 moment_id
    const missingMomentIds = await query(`
      SELECT p.id, op.moment_id
      FROM wechat_robot_expat_parsed_properties p
      INNER JOIN wechat_robot_expat_properties op ON p.property_id = op.id
      WHERE p.moment_id IS NULL AND op.moment_id IS NOT NULL
      LIMIT 200
    `);
    if (missingMomentIds.length > 0) {
      for (const r of missingMomentIds) {
        await query('UPDATE wechat_robot_expat_parsed_properties SET moment_id = ? WHERE id = ?', [r.moment_id, r.id]);
      }
      console.log(`[fixMomentIds] 回填了 ${missingMomentIds.length} 条 moment_id`);
    }

    // 2. 禁止自动发布：房源只能通过用户手动点击发布按钮才能进入房源库
    // 原自动上架逻辑已移除，保留注释以记录变更

    // 3. 为缺少 property_code 的已发布房源生成编号
    const noCode = await query(`
      SELECT id FROM wechat_robot_expat_parsed_properties
      WHERE is_listed = 1 AND (property_code IS NULL OR property_code = '')
      LIMIT 100
    `);
    if (noCode.length > 0) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      for (const r of noCode) {
        const code = `EXP${dateStr}-${String(r.id).padStart(5, '0')}`;
        await query('UPDATE wechat_robot_expat_parsed_properties SET property_code = ? WHERE id = ? AND (property_code IS NULL OR property_code = "")', [code, r.id]);
      }
      console.log(`[fixMomentIds] 为 ${noCode.length} 条房源生成了编号`);
    }
  } catch (err) {
    if (!String(err.message).includes("doesn't exist")) {
      console.error('[fixMomentIds] 执行失败:', err.message);
    }
  }
  isRunning = false;
}

module.exports = { fixMomentIdsJob };
