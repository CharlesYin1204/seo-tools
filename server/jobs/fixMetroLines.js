/**
 * 定时修复任务：地铁数据一致性保障
 * 1. 有站点无线路 → 通过站名反查线路表补全
 * 2. 有线无站 → 尝试从POI回填站点，无POI才清除
 * 3. 无站无线但POI有 → 从POI回填两者
 * 4. 清理无效值（'无'等）
 * 5. 修复空小区
 */
const { query } = require('../config/database');

let isRunning = false;

async function fixMetroLinesJob() {
  if (isRunning) return;
  isRunning = true;
  try {
    // ============ 1. 有站点无线路 → 通过站名反查线路 ============
    const rows = await query(`
      SELECT id, metro_stations FROM wechat_robot_expat_parsed_properties 
      WHERE deleted_at IS NULL 
      AND metro_stations IS NOT NULL AND TRIM(metro_stations) != '' AND metro_stations != '-' AND metro_stations != '无'
      AND (metro_lines IS NULL OR TRIM(metro_lines) = '' OR metro_lines = '-' OR metro_lines = '无')
      LIMIT 200
    `);
    const list = Array.isArray(rows) ? rows : [];

    if (list.length > 0) {
      let fixed = 0;
      for (const r of list) {
        const stationNames = String(r.metro_stations)
          .replace(/站/g, '')
          .split(/[,，、\/]/)
          .map(s => s.trim())
          .filter(Boolean);
        if (!stationNames.length) continue;

        const ph = stationNames.map(() => '?').join(',');
        const lineRows = await query(
          `SELECT DISTINCT l.name_cn FROM property_metro_stations s 
           JOIN property_metro_lines l ON s.line_id = l.id 
           WHERE s.is_active = 1 AND s.name_cn IN (${ph}) 
           ORDER BY l.sort_order`,
          stationNames
        );
        const lines = Array.isArray(lineRows) ? lineRows : [];
        if (lines.length > 0) {
          const lineStr = [...new Set(lines.map(l => l.name_cn))].join(',');
          await query(
            'UPDATE wechat_robot_expat_parsed_properties SET metro_lines = ?, updated_at = NOW() WHERE id = ?',
            [lineStr, r.id]
          );
          fixed++;
        }
      }
      if (fixed > 0) {
        console.log(`[fixMetroLines] 步骤1: 补全 ${fixed} 条记录的地铁线路（有站无线）`);
      }
    }

    // ============ 2. 有线无站 → 从POI回填站点，无POI才清除 ============
    const lineNoStation = await query(`
      SELECT p.id, p.community, p.district, p.metro_lines
      FROM wechat_robot_expat_parsed_properties p
      WHERE p.deleted_at IS NULL 
      AND (p.metro_stations IS NULL OR TRIM(p.metro_stations) = '' OR p.metro_stations = '-' OR p.metro_stations = '无')
      AND p.metro_lines IS NOT NULL AND TRIM(p.metro_lines) != '' AND p.metro_lines != '-'
      LIMIT 200
    `);
    const lnsList = Array.isArray(lineNoStation) ? lineNoStation : [];
    if (lnsList.length > 0) {
      let filledFromPoi = 0;
      let cleared = 0;
      for (const r of lnsList) {
        if (r.community && r.community.trim()) {
          const poiRows = await query(
            `SELECT nearest_metro_station, nearest_metro_line, nearest_metro_distance 
             FROM property_community_dict 
             WHERE community_name = ? AND is_enabled = 1 
             AND nearest_metro_station IS NOT NULL AND nearest_metro_station != '' AND nearest_metro_station != '无'
             LIMIT 1`,
            [r.community]
          );
          const poi = Array.isArray(poiRows) && poiRows.length > 0 ? poiRows[0] : null;
          if (poi && poi.nearest_metro_station) {
            await query(
              `UPDATE wechat_robot_expat_parsed_properties 
               SET metro_stations = ?, metro_lines = COALESCE(metro_lines, ?), metro_distance = COALESCE(metro_distance, ?), updated_at = NOW()
               WHERE id = ?`,
              [poi.nearest_metro_station, poi.nearest_metro_line, poi.nearest_metro_distance, r.id]
            );
            filledFromPoi++;
            continue;
          }
        }
        await query(
          'UPDATE wechat_robot_expat_parsed_properties SET metro_lines = NULL, updated_at = NOW() WHERE id = ?',
          [r.id]
        );
        cleared++;
      }
      if (filledFromPoi > 0) console.log(`[fixMetroLines] 步骤2: 从POI回填 ${filledFromPoi} 条记录的站点（有线无站）`);
      if (cleared > 0) console.log(`[fixMetroLines] 步骤2: 清除 ${cleared} 条无法匹配POI的孤立线路`);
    }

    // ============ 3. 无站无线但小区有POI → 从POI回填 ============
    const noMetro = await query(`
      SELECT p.id, p.community, p.district
      FROM wechat_robot_expat_parsed_properties p
      WHERE p.deleted_at IS NULL 
      AND (p.metro_stations IS NULL OR TRIM(p.metro_stations) = '' OR p.metro_stations = '-')
      AND (p.metro_lines IS NULL OR TRIM(p.metro_lines) = '' OR p.metro_lines = '-')
      AND p.community IS NOT NULL AND TRIM(p.community) != ''
      LIMIT 200
    `);
    const noMetroList = Array.isArray(noMetro) ? noMetro : [];
    if (noMetroList.length > 0) {
      let poiFilled = 0;
      for (const r of noMetroList) {
        const poiRows = await query(
          `SELECT nearest_metro_station, nearest_metro_line, nearest_metro_distance 
           FROM property_community_dict 
           WHERE community_name = ? AND is_enabled = 1 
           AND nearest_metro_station IS NOT NULL AND nearest_metro_station != '' AND nearest_metro_station != '无'
           LIMIT 1`,
          [r.community]
        );
        const poi = Array.isArray(poiRows) && poiRows.length > 0 ? poiRows[0] : null;
        if (poi && poi.nearest_metro_station) {
          const updates = [];
          const params = [];
          updates.push('metro_stations = ?');
          params.push(poi.nearest_metro_station);
          if (poi.nearest_metro_line) {
            updates.push('metro_lines = ?');
            params.push(poi.nearest_metro_line);
          }
          if (poi.nearest_metro_distance) {
            updates.push('metro_distance = ?');
            params.push(poi.nearest_metro_distance);
          }
          updates.push('updated_at = NOW()');
          params.push(r.id);
          await query(
            `UPDATE wechat_robot_expat_parsed_properties SET ${updates.join(', ')} WHERE id = ?`,
            params
          );
          poiFilled++;
        }
      }
      if (poiFilled > 0) {
        console.log(`[fixMetroLines] 步骤3: 从POI回填 ${poiFilled} 条记录的地铁信息（无站无线）`);
      }
    }

    // ============ 4. 清理无效值 metro_stations = '无' ============
    const cleanInvalid = await query(`
      UPDATE wechat_robot_expat_parsed_properties 
      SET metro_stations = NULL, updated_at = NOW()
      WHERE metro_stations = '无' AND deleted_at IS NULL
      LIMIT 200
    `);
    const invalidCleaned = cleanInvalid?.affectedRows ?? 0;
    if (invalidCleaned > 0) {
      console.log(`[fixMetroLines] 步骤4: 清理 ${invalidCleaned} 条无效站点`);
    }

    // ============ 5. 修复空小区 ============
    const emptyComRows = await query(`
      SELECT id FROM wechat_robot_expat_parsed_properties 
      WHERE deleted_at IS NULL AND (community IS NULL OR community = '' OR TRIM(community) = '')
      LIMIT 50
    `);
    const emptyComList = Array.isArray(emptyComRows) ? emptyComRows : [];
    if (emptyComList.length > 0) {
      try {
        const ctrl = require('../controllers/user/WeChatRobotPluginController');
        let comFixed = 0;
        for (const r of emptyComList) {
          try {
            const c = await ctrl.reprocessCommunityForRecord(r.id);
            if (c) comFixed++;
          } catch {}
        }
        if (comFixed > 0) {
          console.log(`[fixMetroLines] 步骤5: 补全 ${comFixed} 条空小区`);
        }
      } catch {}
    }

    // ============ 6. POI数据一致性：有站无线的POI记录修复 ============
    const poiIssues = await query(`
      SELECT community_name, nearest_metro_station 
      FROM property_community_dict 
      WHERE is_enabled = 1 
      AND nearest_metro_station IS NOT NULL AND nearest_metro_station != '' AND nearest_metro_station != '无'
      AND (nearest_metro_line IS NULL OR nearest_metro_line = '')
      LIMIT 50
    `);
    const poiList = Array.isArray(poiIssues) ? poiIssues : [];
    if (poiList.length > 0) {
      let poiFixed = 0;
      for (const r of poiList) {
        const stNames = String(r.nearest_metro_station).replace(/站/g, '').split(/[,，、\/]/).map(s => s.trim()).filter(Boolean);
        if (!stNames.length) continue;
        const ph = stNames.map(() => '?').join(',');
        const lineRows = await query(
          `SELECT DISTINCT l.name_cn FROM property_metro_stations s JOIN property_metro_lines l ON s.line_id = l.id WHERE s.is_active = 1 AND s.name_cn IN (${ph}) ORDER BY l.sort_order`,
          stNames
        );
        const lines = Array.isArray(lineRows) ? lineRows : [];
        if (lines.length > 0) {
          const lineStr = [...new Set(lines.map(l => l.name_cn))].join(',');
          await query('UPDATE property_community_dict SET nearest_metro_line = ? WHERE community_name = ? AND is_enabled = 1', [lineStr, r.community_name]);
        } else {
          await query('UPDATE property_community_dict SET nearest_metro_station = NULL, nearest_metro_line = NULL, nearest_metro_distance = NULL WHERE community_name = ? AND nearest_metro_station = ?', [r.community_name, r.nearest_metro_station]);
        }
        poiFixed++;
      }
      if (poiFixed > 0) console.log(`[fixMetroLines] 步骤6: 修复 ${poiFixed} 条POI有站无线`);
    }

  } catch (err) {
    console.error('[fixMetroLines] 错误:', err.message);
  } finally {
    isRunning = false;
  }
}

module.exports = { fixMetroLinesJob };
