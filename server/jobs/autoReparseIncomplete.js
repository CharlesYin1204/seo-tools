/**
 * 定时任务：自动AI解析不完整的房源
 * 检测条件：is_ai_parsed = 0（未经过AI解析的记录）
 * 从 system_settings 读取 ai_parse_batch_size / ai_parse_thread_count / ai_parse_enabled
 * 支持并发处理以匹配后台 "并发解析加速" 配置
 */
const { query } = require('../config/database');
const SystemSetting = require('../models/SystemSetting');
const logger = require('../utils/logger');

const MAX_RENT_PRICE = 500000;
const DEFAULT_SAFE_THREAD_COUNT = 16;

function normalizeModelIdList(raw) {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        list = JSON.parse(trimmed);
      } catch {
        list = trimmed.split(',');
      }
    } else {
      list = trimmed.split(',');
    }
  }
  if (!Array.isArray(list)) list = [list];
  const seen = new Set();
  const normalized = [];
  for (const item of list) {
    const id = String(item ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

function isRetryableAIError(errorMessage) {
  const msg = String(errorMessage || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('429')
    || msg.includes('rate limit')
    || msg.includes('too many requests')
    || msg.includes('timeout')
    || msg.includes('timed out')
    || msg.includes('econnaborted')
    || msg.includes('socket hang up')
    || msg.includes('network')
    || msg.includes('temporarily unavailable')
  );
}

async function getSafeThreadCount(configuredThreadCount, modelCount) {
  try {
    const raw = await SystemSetting.get('ai_parse_safe_thread_count', String(DEFAULT_SAFE_THREAD_COUNT));
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.min(configuredThreadCount, parsed));
    }
  } catch {}
  return Math.max(1, Math.min(configuredThreadCount, modelCount || DEFAULT_SAFE_THREAD_COUNT, DEFAULT_SAFE_THREAD_COUNT));
}

function hasImplicitElevatorCommunity(name) {
  return /大楼|大厦/.test(String(name || '').trim());
}

let isRunning = false;
let lastRunStats = { lastRun: null, processed: 0, success: 0, failed: 0, remaining: 0, skippedHistory: 0 };
const AUTO_PARSE_MODE = 'rule+poi+ai_enhanced_fallback';

/** 与后台统计一致：有原文且未打 is_ai_parsed 的条数 */
async function countRemainingParseable() {
  const rows = await query(`
    SELECT COUNT(*) as cnt FROM wechat_robot_expat_parsed_properties
    WHERE deleted_at IS NULL
      AND original_content IS NOT NULL AND LENGTH(TRIM(original_content)) > 0
      AND (is_ai_parsed = 0 OR is_ai_parsed IS NULL)
      AND DATE(created_at) = CURDATE()
  `);
  const row = Array.isArray(rows) && rows[0] ? rows[0] : {};
  return Number(row.cnt) || 0;
}

/** 按需求：今天之前的未解析数据，一律按已解析处理，避免进入解析队列 */
async function markHistoryAsParsed() {
  const result = await query(`
    UPDATE wechat_robot_expat_parsed_properties
    SET
      is_ai_parsed = 1,
      parse_status = CASE
        WHEN parse_status IS NULL OR parse_status = '' OR parse_status = 'pending' OR parse_status = 'unparsed'
        THEN 'history_auto_skipped'
        ELSE parse_status
      END,
      updated_at = NOW()
    WHERE deleted_at IS NULL
      AND original_content IS NOT NULL AND LENGTH(TRIM(original_content)) > 0
      AND (is_ai_parsed = 0 OR is_ai_parsed IS NULL)
      AND created_at < CURDATE()
  `);
  return Number(result?.affectedRows || result?.[0]?.affectedRows || 0);
}

async function persistRuntimeStats(stats) {
  lastRunStats = { ...lastRunStats, ...stats };
  try {
    await SystemSetting.set('ai_parse_runtime_stats', JSON.stringify(lastRunStats), 'string');
  } catch (e) {
    logger.warn('[自动AI解析] 写入运行状态失败', { error: e.message });
  }
}

const PARSE_LOG_MAX = 100;

async function appendParseLog(entry) {
  try {
    const raw = await SystemSetting.get('ai_parse_job_logs', '');
    let logs = [];
    if (raw) {
      try {
        logs = JSON.parse(raw);
      } catch {
        logs = [];
      }
    }
    if (!Array.isArray(logs)) {
      logs = [];
    }
    logs.unshift({
      t: new Date().toISOString(),
      ...entry,
    });
    if (logs.length > PARSE_LOG_MAX) {
      logs = logs.slice(0, PARSE_LOG_MAX);
    }
    await SystemSetting.set('ai_parse_job_logs', JSON.stringify(logs), 'string');
  } catch (e) {
    logger.warn('[自动AI解析] 写入日志失败', { error: e.message });
  }
}

async function autoReparseIncompleteJob() {
  if (isRunning) {
    console.log('[自动AI解析] 上一轮仍在运行，跳过');
    return;
  }

  // 读取后台AI解析总开关
  const aiEnabled = await SystemSetting.get('ai_parse_enabled', '0');
  if (aiEnabled !== '1' && aiEnabled !== 1 && aiEnabled !== true) return;

  isRunning = true;
  console.log('[自动AI解析] 开始新一轮...');
  const startTime = Date.now();

  // 写入"正在运行"状态，让前端立刻能看到任务在跑
  try {
    const curRaw = await SystemSetting.get('ai_parse_runtime_stats', '');
    const curStats = curRaw ? (typeof curRaw === 'string' ? JSON.parse(curRaw) : curRaw) : {};
    await SystemSetting.set('ai_parse_runtime_stats', JSON.stringify({
      ...curStats,
      status: 'running',
      message: '正在解析中...',
      runningStarted: new Date().toISOString(),
    }), 'string');
  } catch {}

  try {
    const ctrl = require('../controllers/user/WeChatRobotPluginController');
    const parsePropertyContent = ctrl.parsePropertyContent;
    const updateParsedProperty = ctrl.updateParsedPropertyFromAI || getUpdateFunction();

    // 先把今天之前的未解析记录按“已解析”处理，满足仅解析今天数据的业务要求
    const skippedHistory = await markHistoryAsParsed();

    // 从后台配置读取批量大小和并发数
    const batchSize = Math.max(10, Math.min(200, parseInt(await SystemSetting.get('ai_parse_batch_size', '50')) || 50));
    const multiThreadEnabled = await SystemSetting.get('ai_parse_multi_thread', '0');
    const configuredThreadCount = (multiThreadEnabled === '1' || multiThreadEnabled === 1)
      ? Math.max(1, Math.min(16, parseInt(await SystemSetting.get('ai_parse_thread_count', '8')) || 8))
      : 1;
    let threadCount = configuredThreadCount;

    const aiModelId = String(await SystemSetting.get('ai_parse_model_id', '') || '').trim();
    const aiModelIds = normalizeModelIdList(await SystemSetting.get('ai_parse_model_ids', '[]'));
    const aiPrompt = await SystemSetting.get('ai_parse_prompt', null);
    const candidateModelIds = [aiModelId, ...aiModelIds].filter(Boolean);
    if (candidateModelIds.length === 0 || !String(aiPrompt || '').trim()) {
      const remaining = await countRemainingParseable();
      const msg = candidateModelIds.length === 0 ? '未配置可用AI模型，定时任务跳过' : 'AI提示词为空，定时任务跳过';
      await persistRuntimeStats({
        lastRun: new Date().toISOString(),
        processed: 0,
        success: 0,
        failed: 0,
        remaining,
        elapsed: Date.now() - startTime,
        threadCount,
        batchSize,
        status: 'skipped',
        message: `${msg}（模式：规则+POI+AI增强兜底）`,
        parseMode: AUTO_PARSE_MODE,
        strictValidation: false,
      });
      await appendParseLog({ level: 'warning', message: msg, remaining, processed: 0 });
      // 注意：不能 return，必须走 finally 以重置 isRunning
      isRunning = false;
      return;
    }

    const placeholders = candidateModelIds.map(() => '?').join(',');
    const modelRows = await query(
      `SELECT id, model_code, model_name, api_url, api_key, api_headers, max_tokens, temperature
       FROM ai_models WHERE is_enabled = 1 AND id IN (${placeholders})`,
      candidateModelIds
    );
    const modelListRaw = Array.isArray(modelRows) && Array.isArray(modelRows[0]) ? modelRows[0] : modelRows;
    const modelById = new Map((Array.isArray(modelListRaw) ? modelListRaw : []).map((m) => [String(m.id), m]));
    const aiModelPool = candidateModelIds.map((id) => modelById.get(String(id))).filter(Boolean);
    if (aiModelPool.length === 0) {
      const remaining = await countRemainingParseable();
      const msg = '配置的AI模型均不存在或已禁用，定时任务跳过';
      await persistRuntimeStats({
        lastRun: new Date().toISOString(),
        processed: 0,
        success: 0,
        failed: 0,
        remaining,
        elapsed: Date.now() - startTime,
        threadCount,
        batchSize,
        status: 'skipped',
        message: `${msg}（模式：规则+POI+AI增强兜底）`,
        parseMode: AUTO_PARSE_MODE,
        strictValidation: false,
      });
      await appendParseLog({ level: 'warning', message: msg, remaining, processed: 0 });
      isRunning = false;
      return;
    }
    threadCount = await getSafeThreadCount(configuredThreadCount, aiModelPool.length);

    // 查找未AI解析的记录（is_ai_parsed = 0）
    const incomplete = await query(`
      SELECT id, original_content
      FROM wechat_robot_expat_parsed_properties
      WHERE deleted_at IS NULL
        AND original_content IS NOT NULL AND LENGTH(TRIM(original_content)) > 0
        AND (is_ai_parsed = 0 OR is_ai_parsed IS NULL)
        AND DATE(created_at) = CURDATE()
      ORDER BY created_at DESC
      LIMIT ?
    `, [batchSize]);

    const rows = Array.isArray(incomplete) ? incomplete : [];
    if (rows.length === 0) {
      const remaining = await countRemainingParseable();
      const msg = remaining === 0
        ? '当前没有「有原文且待解析」的记录'
        : '本轮未取到记录（请稍后重试或检查数据库）';
      await persistRuntimeStats({
        lastRun: new Date().toISOString(),
        processed: 0,
        success: 0,
        failed: 0,
        skippedHistory,
        remaining,
        elapsed: Date.now() - startTime,
        threadCount,
        batchSize,
        status: remaining === 0 ? 'complete' : 'idle',
        message: `${msg}（模式：规则+POI+AI增强兜底）`,
        parseMode: AUTO_PARSE_MODE,
        strictValidation: false,
      });
      await appendParseLog({
        level: 'info',
        message: skippedHistory > 0 ? `${msg}；历史数据按已解析处理 ${skippedHistory} 条` : msg,
        remaining,
        processed: 0,
        skippedHistory,
      });
      isRunning = false;
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const failReasons = {};
    const modelUsage = {};
    let fallbackCount = 0;
    // 并发处理：将记录分成 threadCount 大小的并发批次
    for (let i = 0; i < rows.length; i += threadCount) {
      const batch = rows.slice(i, i + threadCount);
      const results = await Promise.allSettled(
        batch.map((row) => parseSingleRecord(row, parsePropertyContent, updateParsedProperty, aiModelPool, aiPrompt))
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value?.ok) {
          successCount++;
          if (r.value.usedModelId) {
            modelUsage[r.value.usedModelId] = (modelUsage[r.value.usedModelId] || 0) + 1;
          }
          if ((r.value.modelAttempts || 1) > 1) {
            fallbackCount += (r.value.modelAttempts - 1);
          }
        } else {
          failCount++;
          if (r.status === 'fulfilled' && r.value?.usedModelId) {
            modelUsage[r.value.usedModelId] = (modelUsage[r.value.usedModelId] || 0) + 1;
          }
          if (r.status === 'fulfilled' && (r.value?.modelAttempts || 1) > 1) {
            fallbackCount += (r.value.modelAttempts - 1);
          }
          const reason = (r.status === 'fulfilled' ? r.value?.error : r.reason?.message) || 'unknown_error';
          const key = String(reason).slice(0, 120);
          failReasons[key] = (failReasons[key] || 0) + 1;
        }
      }
    }

    const remaining = await countRemainingParseable();

    await persistRuntimeStats({
      lastRun: new Date().toISOString(),
      processed: rows.length,
      success: successCount,
      failed: failCount,
      skippedHistory,
      remaining,
      elapsed: Date.now() - startTime,
      threadCount,
      batchSize,
      status: 'ok',
      message: `本轮处理 ${rows.length} 条，成功 ${successCount}，失败 ${failCount}，模型池 ${aiModelPool.length} 个，候补切换 ${fallbackCount} 次，队列剩余 ${remaining} 条`,
      parseMode: AUTO_PARSE_MODE,
      strictValidation: false,
      topFailReasons: Object.entries(failReasons).sort((a, b) => b[1] - a[1]).slice(0, 3),
      modelUsage: Object.entries(modelUsage),
      fallbackCount,
    });

    await appendParseLog({
      level: failCount > 0 ? 'warning' : 'info',
      message: `自动解析一批（规则+POI+AI增强兜底）：成功 ${successCount}/${rows.length}，失败 ${failCount}，模型池 ${aiModelPool.length}，候补切换 ${fallbackCount} 次，队列剩余 ${remaining}`,
      remaining,
      processed: rows.length,
      success: successCount,
      failed: failCount,
      skippedHistory,
      elapsedMs: Date.now() - startTime,
      threadCount,
      parseMode: AUTO_PARSE_MODE,
      strictValidation: false,
      modelUsage: Object.entries(modelUsage).map(([modelId, count]) => ({ modelId, count })),
      fallbackCount,
      failReasons: Object.entries(failReasons).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, count]) => ({ reason, count })),
    });

    if (successCount > 0 || failCount > 0) {
      logger.info(`[自动AI解析] ${threadCount}线程 完成: 成功${successCount}/${rows.length}, 失败${failCount}, 剩余${remaining}条, 耗时${Date.now() - startTime}ms`);
    }
  } catch (e) {
    logger.error('[自动AI解析] 异常', { error: e.message });
    try {
      const remaining = await countRemainingParseable();
      await persistRuntimeStats({
        lastRun: new Date().toISOString(),
        processed: 0,
        success: 0,
        failed: 0,
        remaining,
        elapsed: Date.now() - startTime,
        status: 'error',
        message: `任务异常: ${e.message}（模式：规则+POI+AI增强兜底）`,
        parseMode: AUTO_PARSE_MODE,
        strictValidation: false,
      });
      await appendParseLog({ level: 'error', message: `任务异常: ${e.message}`, remaining, processed: 0 });
    } catch (e2) {
      logger.error('[自动AI解析] 异常后写状态失败', { error: e2.message });
    }
  } finally {
    isRunning = false;
  }
}

/**
 * 解析单条记录
 */
async function parseSingleRecord(row, parsePropertyContent, updateParsedProperty, aiModelPool, aiPrompt) {
  const sourceText = row.original_content || '';
  if (!sourceText.trim()) return { ok: false, error: 'empty_original_content' };
  if (!Array.isArray(aiModelPool) || aiModelPool.length === 0) return { ok: false, error: 'no_available_ai_model' };
  // The first configured model is the primary parser. Fallback models are only
  // used after the primary fails, so a slow/stream-only fallback cannot become
  // the main path for a whole batch.
  const orderedModels = aiModelPool;
  const modelErrors = [];
  try {
    for (let i = 0; i < orderedModels.length; i++) {
      const aiModel = orderedModels[i];
      try {
        // Auto job uses AI first, then rule/POI fallback. This keeps real listings
        // moving when a model omits one field or the upstream API returns 400/429.
        const parseResult = await parsePropertyContent(sourceText, aiModel, aiPrompt, {
          requireAiValidation: false,
          allowMissingAddress: true,
        });
        if (parseResult) {
          parseResult.original_content = sourceText;
          await updateParsedProperty(row.id, parseResult);
          return { ok: true, usedModelId: String(aiModel.id), modelAttempts: i + 1 };
        }
        modelErrors.push(`${aiModel.model_code || aiModel.model_name || aiModel.id}:empty_parse_result`);
      } catch (e) {
        const modelName = aiModel.model_code || aiModel.model_name || aiModel.id;
        const errorMsg = e.message || 'unknown_error';
        modelErrors.push(`${modelName}:${errorMsg}`);
        if (i < orderedModels.length - 1) {
          logger.warn('自动AI解析模型失败，尝试候补模型', { id: row.id, model: modelName, error: errorMsg, retryable: isRetryableAIError(errorMsg) });
          continue;
        }
        logger.warn('自动AI解析单条失败', { id: row.id, model: modelName, error: errorMsg });
        return { ok: false, error: errorMsg, usedModelId: String(aiModel.id), modelAttempts: i + 1, modelErrors };
      }
    }
    return { ok: false, error: 'empty_parse_result', modelAttempts: orderedModels.length, modelErrors };
  } catch (e) {
    logger.warn('自动AI解析单条失败', { id: row.id, error: e.message });
    return { ok: false, error: e.message || 'unknown_error', modelAttempts: orderedModels.length, modelErrors };
  }
}

/**
 * 动态获取 updateParsedProperty 函数（兜底方案）
 */
function getUpdateFunction() {
  return async function updateParsedPropertyDirect(propId, parsed) {
    const updateData = {};
    const { query: dbQuery } = require('../config/database');
    const crypto = require('crypto');

    if (parsed.community && typeof parsed.community === 'string' && parsed.community.length >= 2) {
      updateData.community = parsed.community;
    }
    if (parsed.district && typeof parsed.district === 'string') {
      const VALID_DISTRICTS = ['黄浦区','徐汇区','长宁区','静安区','普陀区','虹口区','杨浦区','闵行区','宝山区','嘉定区','浦东新区','金山区','松江区','青浦区','奉贤区','崇明区'];
      const rawDist = String(parsed.district).trim();
      const normDist = rawDist.replace(/新?区$/, '');
      const dMap = { 黄浦:'黄浦区',徐汇:'徐汇区',长宁:'长宁区',静安:'静安区',普陀:'普陀区',虹口:'虹口区',杨浦:'杨浦区',闵行:'闵行区',宝山:'宝山区',嘉定:'嘉定区',浦东:'浦东新区',金山:'金山区',松江:'松江区',青浦:'青浦区',奉贤:'奉贤区',崇明:'崇明区' };
      const validDist = dMap[normDist] || (VALID_DISTRICTS.includes(rawDist) ? rawDist : null);
      if (validDist) updateData.district = validDist;
    }
    if (parsed.price_value && parsed.price_value > 0 && parsed.price_value <= MAX_RENT_PRICE) {
      updateData.price_value = parsed.price_value;
    }
    if (parsed.price) updateData.price = String(parsed.price);
    if (parsed.bedrooms && parsed.bedrooms >= 1 && parsed.bedrooms <= 20) {
      updateData.bedrooms = parsed.bedrooms;
    }
    if (parsed.livingrooms !== undefined) updateData.livingrooms = parsed.livingrooms;
    if (parsed.bathrooms !== undefined) updateData.bathrooms = parsed.bathrooms;
    if (parsed.area_sqm && parsed.area_sqm > 0) updateData.area_sqm = parsed.area_sqm;
    if (parsed.metro_lines) updateData.metro_lines = parsed.metro_lines;
    if (parsed.metro_stations) updateData.metro_stations = parsed.metro_stations;
    if (parsed.has_elevator !== undefined) updateData.has_elevator = parsed.has_elevator ? 1 : 0;
    if (parsed.has_parking !== undefined) updateData.has_parking = parsed.has_parking ? 1 : 0;
    if (parsed.has_commission !== undefined) updateData.has_commission = parsed.has_commission ? 1 : 0;
    if (parsed.is_duplex !== undefined) updateData.is_duplex = parsed.is_duplex ? 1 : 0;
    if (parsed.contact_info) updateData.contact_info = parsed.contact_info;
    if (parsed.publisher_name) updateData.publisher_name = parsed.publisher_name;
    if (parsed.outdoor_features) updateData.outdoor_features = parsed.outdoor_features;
    if (parsed.floor_info) updateData.floor_info = parsed.floor_info;
    if (parsed.orientation) updateData.orientation = parsed.orientation;
    if (parsed.decoration) updateData.decoration = parsed.decoration;
    if (parsed.street) updateData.street = parsed.street;
    if (parsed.title) updateData.title = parsed.title;
    if (parsed.description) updateData.description = parsed.description;
    if (hasImplicitElevatorCommunity(updateData.community || parsed.community)) updateData.has_elevator = 1;

    // 全局兜底：卧室和卫生间不能为空，缺失时默认1
    if (!updateData.bedrooms || Number(updateData.bedrooms) <= 0) {
      updateData.bedrooms = 1;
    }
    if (updateData.bathrooms == null || Number(updateData.bathrooms) < 0) {
      updateData.bathrooms = 1;
    }

    if (parsed.original_content) {
      const normalized = String(parsed.original_content).replace(/\\n/g, '\n').replace(/\s+/g, '').replace(/[，。！？、；：""''（）【】《》\-\—\~\·]/g, '').toLowerCase().trim();
      if (normalized.length >= 5) {
        updateData.content_hash = crypto.createHash('md5').update(normalized).digest('hex');
      }
    }

    updateData.is_ai_parsed = 1;
    updateData.parse_status = 'ai_parsed';
    updateData.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const keys = Object.keys(updateData);
    if (keys.length <= 3) return;
    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    const vals = [...Object.values(updateData), propId];
    await dbQuery(`UPDATE wechat_robot_expat_parsed_properties SET ${setClauses} WHERE id = ?`, vals);
  };
}

function getStats() {
  return lastRunStats;
}

module.exports = { autoReparseIncompleteJob, getStats };
