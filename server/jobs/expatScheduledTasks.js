/**
 * 涉外房源定时搜索任务执行器 (Node版)
 * 对应 PHP 版 cron_wechat_scheduled_tasks.php 中的 processExpatPropertyScheduledTasks()
 *
 * 功能流程：
 * 1. 查询 wechat_robot_expat_scheduled_tasks 中所有已启用且到期的任务
 * 2. 检查设备在线状态
 * 3. 可选：先同步朋友圈（doRefresh + autoParseNewMoments）
 * 4. 按关键词/好友/日期搜索朋友圈 → 解析 → 去重 → 保存到 parsed_properties
 * 5. 下载外部媒体到本地
 * 6. 更新任务执行日志
 */
const { query } = require('../config/database');
const WeChatRobotService = require('../services/WeChatRobotService');
const { extractMomentMediaUrlsFromSns, parseFavoriteNoteFromXml, parseContentStyleFromXml, parseFullContentFromXml } = require('../utils/snsXmlMediaParser');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TAG = '[expatScheduledTasks]';
let running = false;

/**
 * 安全解析JSON，处理双重编码
 */
function safeJsonParse(str, defaultVal = []) {
  if (!str) return defaultVal;
  if (typeof str !== 'string') return str;
  try {
    let parsed = JSON.parse(str);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return parsed;
  } catch {
    return defaultVal;
  }
}

/**
 * 格式化本地时间
 */
function formatLocal(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 生成内容哈希
 */
function generateContentHash(content) {
  if (!content) return null;
  const normalized = String(content)
    .replace(/\\n/g, '\n').replace(/\s+/g, '')
    .replace(/[，。！？、；：""''（）【】《》\-—~·]/g, '')
    .toLowerCase().trim();
  if (!normalized || normalized.length < 5) return null;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * 生成唯一房源编号 EXPyyyymmdd-NNNNN
 */
async function generatePropertyCode() {
  const dateStr = formatLocal(new Date()).slice(0, 10).replace(/-/g, '');
  const maxRows = await query(
    "SELECT property_code FROM wechat_robot_expat_parsed_properties WHERE property_code LIKE ? ORDER BY property_code DESC LIMIT 1",
    [`EXP${dateStr}%`]
  );
  let seq = 1;
  if (maxRows?.[0]?.property_code) {
    const m = maxRows[0].property_code.match(/(\d+)$/);
    if (m) seq = parseInt(m[1]) + 1;
  }
  return `EXP${dateStr}-${String(seq).padStart(5, '0')}`;
}

/**
 * 创建任务执行日志
 */
async function createTaskLog(taskId, userId, robotId) {
  try {
    const result = await query(
      `INSERT INTO wechat_robot_expat_task_logs
       (task_id, user_id, robot_id, trigger_type, execution_status, start_time, created_at)
       VALUES (?, ?, ?, 'cron', 'running', NOW(), NOW())`,
      [taskId, userId, robotId]
    );
    return result.insertId;
  } catch { return null; }
}

/**
 * 更新任务日志
 */
async function updateTaskLog(logId, status, totalFound, savedCount, mediaSaved, skipped, errorMsg = null) {
  if (!logId) return;
  try {
    await query(
      `UPDATE wechat_robot_expat_task_logs
       SET execution_status = ?, end_time = NOW(),
           duration_seconds = TIMESTAMPDIFF(SECOND, start_time, NOW()),
           total_found = ?, saved_count = ?, media_saved_count = ?, skipped_count = ?,
           error_message = ?
       WHERE id = ?`,
      [status, totalFound, savedCount, mediaSaved, skipped, errorMsg ? String(errorMsg).substring(0, 2000) : null, logId]
    );
  } catch {}
}

/**
 * 检查任务是否应继续执行（未被取消/禁用）
 */
async function shouldContinue(logId, taskId) {
  try {
    const [logRow] = await query(
      "SELECT execution_status FROM wechat_robot_expat_task_logs WHERE id = ? LIMIT 1", [logId]
    );
    if (!logRow || logRow.execution_status !== 'running') return false;
    const [taskRow] = await query(
      "SELECT is_active FROM wechat_robot_expat_scheduled_tasks WHERE id = ? LIMIT 1", [taskId]
    );
    if (!taskRow || !taskRow.is_active) return false;
    return true;
  } catch { return false; }
}

/**
 * 检查任务是否正在执行
 */
async function isTaskRunning(taskId) {
  try {
    const rows = await query(
      `SELECT id FROM wechat_robot_expat_task_logs
       WHERE task_id = ? AND execution_status = 'running'
         AND start_time > DATE_SUB(NOW(), INTERVAL 60 MINUTE) LIMIT 1`,
      [taskId]
    );
    return rows?.length > 0;
  } catch { return false; }
}

/**
 * 获取API配置
 */
async function getApiConfig(userId) {
  let cfg = await query(
    "SELECT api_url, token FROM wechat_robot_api_config WHERE user_id = 0 AND api_url IS NOT NULL AND api_url != '' LIMIT 1"
  );
  if (cfg?.[0]?.api_url) return cfg[0];
  cfg = await query(
    "SELECT api_url, token FROM wechat_robot_api_config WHERE user_id = ? AND api_url IS NOT NULL AND api_url != '' LIMIT 1",
    [userId]
  );
  return cfg?.[0] || null;
}

/**
 * 下载外部媒体到本地
 */
async function downloadMediaToLocal(url) {
  const externalDomains = ['qpic.cn', 'video.qq.com', 'wx.qlogo.cn', 'mmbiz.qpic.cn'];
  try {
    const parsed = new URL(url);
    if (!externalDomains.some(d => parsed.hostname.endsWith(d))) return url;
  } catch { return url; }

  try {
    const isVideo = url.includes('video.qq.com') || /\.(mp4|mov|avi|m4v)(\?|$)/i.test(url);
    const subDir = isVideo ? 'videos' : 'images';
    const ext = isVideo ? '.mp4' : '.jpg';
    const uploadBase = process.env.UPLOAD_PATH || 'public/uploads';
    const uploadDir = path.join(process.cwd(), uploadBase, subDir);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 10);
    const filename = `${isVideo ? 'video' : 'image'}_${ts}_${rand}${ext}`;
    const filePath = path.join(uploadDir, filename);

    const response = await axios.get(url, { responseType: 'stream', timeout: 30000, headers: { Referer: '' } });
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    return `/uploads/${subDir}/${filename}`;
  } catch {
    return url;
  }
}

/**
 * 为指定房源下载所有外部媒体
 */
async function downloadPropertyMedia(propId) {
  try {
    const [prop] = await query(
      'SELECT id, media_urls FROM wechat_robot_expat_parsed_properties WHERE id = ?', [propId]
    );
    if (!prop) return 0;
    let mediaUrls = safeJsonParse(prop.media_urls, []);
    if (!Array.isArray(mediaUrls) || !mediaUrls.length) return 0;

    const externalDomains = ['qpic.cn', 'video.qq.com', 'wx.qlogo.cn', 'mmbiz.qpic.cn'];
    const hasExternal = mediaUrls.some(u => {
      try { return externalDomains.some(d => new URL(String(u)).hostname.endsWith(d)); } catch { return false; }
    });
    if (!hasExternal) return 0;

    const localUrls = [];
    let downloaded = 0;
    for (const url of mediaUrls) {
      const localUrl = await downloadMediaToLocal(String(url));
      localUrls.push(localUrl);
      if (localUrl !== String(url) && localUrl.startsWith('/uploads/')) downloaded++;
    }

    await query(
      'UPDATE wechat_robot_expat_parsed_properties SET media_urls = ?, local_images = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(localUrls), JSON.stringify(localUrls), propId]
    );
    return downloaded;
  } catch { return 0; }
}

/**
 * 同步朋友圈原始媒体到解析房源
 */
async function syncMomentMedia(prop) {
  try {
    let existingMedia = safeJsonParse(prop.media_urls, []);
    if (Array.isArray(existingMedia) && existingMedia.length > 0) return;
    if (!prop.moment_id) return;
    const moments = await query(
      'SELECT media_list, local_media_urls FROM wechat_robot_moments WHERE moment_id = ? LIMIT 1',
      [prop.moment_id]
    );
    if (!moments?.length) return;
    let mediaList = safeJsonParse(moments[0].local_media_urls || moments[0].media_list, []);
    if (!Array.isArray(mediaList) || !mediaList.length) return;
    const urls = mediaList.map(item => typeof item === 'string' ? item : item?.url || item?.thumb || '').filter(Boolean);
    if (!urls.length) return;
    await query(
      'UPDATE wechat_robot_expat_parsed_properties SET media_urls = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(urls), prop.id]
    );
  } catch {}
}

/**
 * 判断某个调度任务当前是否应该执行
 */
function shouldTaskRun(task) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1-7
  const currentDate = formatLocal(now).slice(0, 10);
  const scheduleMode = task.schedule_mode || 'weekly';
  const scheduleTime = (task.schedule_time || '09:00:00').substring(0, 5);
  const lastRunAt = task.last_run_at;
  const lastRunDate = lastRunAt ? formatLocal(new Date(lastRunAt)).slice(0, 10) : null;

  // 强制执行
  if (task.force_next_run) return true;

  switch (scheduleMode) {
    case 'weekly': {
      const scheduleDays = task.schedule_days || '1,2,3,4,5,6,7';
      const isCorrectDay = scheduleDays.includes(String(currentDayOfWeek));
      if (!isCorrectDay) return false;
      if (scheduleTime === currentTime) return true;
      if (lastRunDate !== currentDate && currentTime > scheduleTime) return true;
      return false;
    }
    case 'interval': {
      const nextRunAt = task.next_run_at;
      if (nextRunAt && new Date(nextRunAt).getTime() <= Date.now()) return true;
      if (!nextRunAt && scheduleTime === currentTime) return true;
      if (!nextRunAt && !lastRunAt && currentTime > scheduleTime) return true;
      return false;
    }
    case 'specific_dates': {
      const specificDates = safeJsonParse(task.specific_dates, []);
      if (!Array.isArray(specificDates) || !specificDates.includes(currentDate)) return false;
      if (scheduleTime === currentTime) return true;
      if (lastRunDate !== currentDate && currentTime > scheduleTime) return true;
      return false;
    }
    default:
      return false;
  }
}

/**
 * 执行单个定时任务
 */
async function executeTask(task) {
  const taskId = task.id;
  const userId = task.user_id;
  const robotId = task.robot_id;
  let logId = null;
  let totalFound = 0, savedCount = 0, mediaSavedCount = 0, skippedCount = 0;

  try {
    // 双重检查是否已在执行
    if (await isTaskRunning(taskId)) {
      console.log(`${TAG} 任务 ${taskId} 正在执行中，跳过`);
      return;
    }

    // 获取机器人账号
    const [account] = await query(
      'SELECT id, device_id, wxid, user_id, status FROM wechat_robot_accounts WHERE id = ? LIMIT 1',
      [robotId]
    );
    if (!account || !account.device_id) {
      console.log(`${TAG} 任务 ${taskId}: 机器人账号不存在或无设备ID`);
      return;
    }

    // 获取API配置
    const apiConfig = await getApiConfig(userId);
    if (!apiConfig) {
      console.log(`${TAG} 任务 ${taskId}: 无API配置`);
      return;
    }
    const { api_url, token } = apiConfig;

    // 检查设备在线
    try {
      const onlineResult = await WeChatRobotService.checkDeviceOnline(api_url, token, account.device_id);
      const isOnline = onlineResult?.data?.online ?? onlineResult?.ret === 200;
      if (!isOnline) {
        console.log(`${TAG} 任务 ${taskId}: 设备离线，跳过`);
        logId = await createTaskLog(taskId, userId, robotId);
        await updateTaskLog(logId, 'failed', 0, 0, 0, 0, '设备已离线');
        return;
      }
    } catch (err) {
      console.log(`${TAG} 任务 ${taskId}: 检查在线状态失败: ${err.message}`);
    }

    // 创建执行日志
    logId = await createTaskLog(taskId, userId, robotId);
    console.log(`${TAG} 开始执行任务 ${taskId}: ${task.task_name}`);

    // 立即更新 last_run_at 防止重复触发
    await query(
      'UPDATE wechat_robot_expat_scheduled_tasks SET last_run_at = NOW() WHERE id = ?',
      [taskId]
    );

    // === 步骤1: 可选同步朋友圈 ===
    const syncBeforeSearch = task.sync_before_search ? 1 : 0;
    if (syncBeforeSearch) {
      console.log(`${TAG} 任务 ${taskId}: 开始同步朋友圈...`);
      try {
        const { autoRefreshMomentsJob } = require('./autoRefreshMoments');
        // 触发一次朋友圈同步（内部会根据配置决定是否刷新）
        // 直接用 doRefresh 和 autoParseNewMoments 更精确
        const refreshModule = require('./autoRefreshMoments');
        // autoRefreshMomentsJob 是全局调度器，这里我们手动执行一次
        // 通过直接调用 WeChatRobotService.getMoments 来同步
        let totalSynced = 0;
        let maxId = 0;
        const myWxid = account.wxid || '';
        for (let page = 0; page < 50; page++) {
          const result = await WeChatRobotService.getMoments(api_url, token, account.device_id, maxId);
          const snsList = result?.data?.snsList || [];
          if (!snsList.length) break;

          for (const sns of snsList) {
            const momentId = String(sns.id || '');
            if (!momentId) continue;
            const existing = await query(
              'SELECT id FROM wechat_robot_moments WHERE robot_id = ? AND moment_id = ? LIMIT 1',
              [robotId, momentId]
            );
            if (!existing?.length) {
              const snsXml = sns.snsXml || '';
              let content = sns.contentDesc || sns.content || '';
              if (!content && snsXml) content = parseFullContentFromXml(snsXml);
              let mediaUrls = extractMomentMediaUrlsFromSns(sns);
              const isOwn = (sns.userName === myWxid) ? 1 : 0;
              const contentStyle = parseContentStyleFromXml(snsXml);
              let favContent = null;
              if (snsXml.includes('<noteinfo>')) {
                const note = parseFavoriteNoteFromXml(snsXml);
                if (note.text) favContent = note.text;
                if (note.mediaUrls.length && !mediaUrls.length) mediaUrls = note.mediaUrls;
              }
              try {
                await query(
                  `INSERT INTO wechat_robot_moments
                   (robot_id, user_id, moment_id, owner_wxid, owner_nickname, content, is_own, status, create_time, raw_snsxml, media_list, content_style, fav_content, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, NOW())`,
                  [robotId, userId, momentId, sns.userName || null, sns.nickName || null,
                   content || null, isOwn, sns.createTime || null,
                   snsXml || null, mediaUrls.length ? JSON.stringify(mediaUrls) : null,
                   contentStyle, favContent]
                );
                totalSynced++;
              } catch {}
            }
            const lastId = sns.id || 0;
            if (lastId && BigInt(String(lastId)) > 0n) maxId = lastId;
          }

          if (snsList.length < 10) break;
          await new Promise(r => setTimeout(r, 800));
        }
        console.log(`${TAG} 任务 ${taskId}: 朋友圈同步完成，新增 ${totalSynced} 条`);
      } catch (syncErr) {
        console.error(`${TAG} 任务 ${taskId}: 朋友圈同步失败:`, syncErr.message);
      }
    }

    // === 步骤2: 构建搜索查询 ===
    const keywords = safeJsonParse(task.search_keywords, []);
    const excludeKeywords = safeJsonParse(task.exclude_keywords, []);
    const searchWxids = safeJsonParse(task.search_wxids, []);
    const searchTagIds = safeJsonParse(task.search_tag_ids, []);

    // 通过标签获取wxid
    let allTargetWxids = [...searchWxids];
    if (searchTagIds.length) {
      const placeholders = searchTagIds.map(() => '?').join(',');
      const tagContacts = await query(
        `SELECT DISTINCT c.wxid
         FROM wechat_robot_contact_tag_relations ctr
         JOIN wechat_robot_contacts c ON ctr.contact_id = c.id
         WHERE ctr.tag_id IN (${placeholders}) AND c.robot_id = ?`,
        [...searchTagIds, robotId]
      );
      for (const tc of (tagContacts || [])) {
        if (tc.wxid && !allTargetWxids.includes(tc.wxid)) allTargetWxids.push(tc.wxid);
      }
    }

    // 时间筛选
    const searchTimeMode = task.search_time_mode || 'absolute';
    let dateFrom = null, dateTo = null;
    if (searchTimeMode === 'relative' && task.search_recent_hours) {
      dateFrom = Math.floor(Date.now() / 1000) - task.search_recent_hours * 3600;
    } else {
      if (task.search_date_from) dateFrom = Math.floor(new Date(task.search_date_from + ' 00:00:00').getTime() / 1000);
      if (task.search_date_to) dateTo = Math.floor(new Date(task.search_date_to + ' 23:59:59').getTime() / 1000);
    }
    // 默认90天
    if (!dateFrom && !dateTo) {
      dateFrom = Math.floor(Date.now() / 1000) - 90 * 86400;
    }

    // 构建SQL
    let sql = `SELECT m.id, m.moment_id, m.content, m.fav_content, m.media_list, m.owner_wxid,
                      m.owner_nickname, m.owner_avatar, m.create_time, m.raw_snsxml
               FROM wechat_robot_moments m
               WHERE m.robot_id = ? AND m.user_id = ? AND m.is_own = 0`;
    const params = [robotId, userId];

    // 关键词筛选（OR关系，搜索 content 和 fav_content）
    const validKeywords = (keywords || []).filter(k => typeof k === 'string' && k.trim().length >= 1).map(k => k.trim());
    if (validKeywords.length) {
      const kwConditions = validKeywords.map(() => '(m.content LIKE ? OR m.fav_content LIKE ?)');
      sql += ` AND (${kwConditions.join(' OR ')})`;
      for (const kw of validKeywords) { params.push(`%${kw}%`, `%${kw}%`); }
    }

    // 排除关键词
    const validExclude = (excludeKeywords || []).filter(k => typeof k === 'string' && k.trim().length >= 1).map(k => k.trim());
    if (validExclude.length) {
      const exConditions = validExclude.map(() => '(m.content LIKE ? OR m.fav_content LIKE ?)');
      sql += ` AND NOT (${exConditions.join(' OR ')})`;
      for (const ek of validExclude) { params.push(`%${ek}%`, `%${ek}%`); }
    }

    // 日期筛选
    if (dateFrom) { sql += ' AND m.create_time >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND m.create_time <= ?'; params.push(dateTo); }

    // 好友筛选
    if (allTargetWxids.length) {
      sql += ` AND m.owner_wxid IN (${allTargetWxids.map(() => '?').join(',')})`;
      params.push(...allTargetWxids);
    }

    sql += ' ORDER BY m.create_time DESC';

    const moments = await query(sql, params);
    totalFound = moments?.length || 0;
    console.log(`${TAG} 任务 ${taskId}: 搜索到 ${totalFound} 条朋友圈`);

    if (!totalFound || !task.auto_save) {
      await updateTaskLog(logId, 'success', totalFound, 0, 0, 0);
      await updateTaskStats(taskId, task, totalFound, 0, 0, 0);
      return;
    }

    // === 步骤3: 解析并保存 ===
    let pluginCtrl;
    try {
      pluginCtrl = require('../controllers/user/WeChatRobotPluginController');
    } catch {}
    const { ruleBasedFullParse, isPropertyRelatedContent, matchPOIBeforeAI, extractAddressFromContent } = pluginCtrl || {};

    for (let i = 0; i < moments.length; i++) {
      // 每50条检查一次任务状态
      if (i > 0 && i % 50 === 0) {
        if (!(await shouldContinue(logId, taskId))) {
          console.log(`${TAG} 任务 ${taskId} 被中断，已处理 ${i} 条`);
          break;
        }
      }

      const moment = moments[i];
      const content = moment.content || moment.fav_content || '';
      if (!content || content.length < 10) { skippedCount++; continue; }

      // 房源内容检测
      if (isPropertyRelatedContent && !isPropertyRelatedContent(content)) { skippedCount++; continue; }

      // 内容哈希去重
      const contentHash = generateContentHash(content);
      if (contentHash) {
        const dupCheck = await query(
          'SELECT id FROM wechat_robot_expat_parsed_properties WHERE user_id = ? AND content_hash = ? AND deleted_at IS NULL LIMIT 1',
          [userId, contentHash]
        );
        if (dupCheck?.length) { skippedCount++; continue; }
      }

      // 规则引擎解析
      let ruleData = {};
      if (ruleBasedFullParse) {
        try { ruleData = ruleBasedFullParse(content); } catch {}
      }

      // POI匹配
      let poiMatch = null;
      if (matchPOIBeforeAI) {
        try { poiMatch = await matchPOIBeforeAI(content, ruleData.district || null); } catch {}
      }

      let community = poiMatch?.community_name || ruleData.community || null;
      let district = poiMatch?.district || ruleData.district || null;
      let metroLines = poiMatch?.nearest_metro_line || null;
      let metroStations = poiMatch?.nearest_metro_station || null;
      let metroDistance = poiMatch?.nearest_metro_distance ? parseInt(poiMatch.nearest_metro_distance) : null;
      let latitude = poiMatch?.latitude ? parseFloat(poiMatch.latitude) : null;
      let longitude = poiMatch?.longitude ? parseFloat(poiMatch.longitude) : null;

      // === 小区名兜底链（确保 community 永不为空） ===
      // 优先级: POI/规则结果 > 地址提取(路+弄/号) > 地标名 > 区域名 > '上海'
      if (!community && extractAddressFromContent) {
        const addrCommunity = extractAddressFromContent(content);
        if (addrCommunity && addrCommunity.length >= 4) community = addrCommunity;
      }
      if (!community) {
        const LANDMARKS = ['静安寺','中山公园','人民广场','陆家嘴','外滩','徐家汇','新天地','古北','曹家渡','真如','长风公园','虹口足球场','大宁','北外滩','世纪公园','花木','联洋','金桥','碧云','张江','前滩','莘庄','七宝','龙华','漕河泾','龙柏','五角场','虹桥'];
        for (const lm of LANDMARKS) {
          if (content.includes(lm)) { community = lm; break; }
        }
      }
      if (!community && district) {
        community = String(district).replace(/区$/, '');
      }
      if (!community) {
        const distFromText = (content.match(/(徐汇|静安|长宁|普陀|虹口|杨浦|黄浦|浦东|闵行|宝山|嘉定|松江|青浦|奉贤|金山|崇明)/) || [])[1];
        if (distFromText) community = distFromText;
      }
      if (!community) community = '上海';

      // 电梯推断
      let hasElevator = ruleData.has_elevator ? 1 : null;
      if (!hasElevator && community && /大楼|大厦/.test(community)) hasElevator = 1;

      const propertyCode = await generatePropertyCode();

      // 处理媒体
      let mediaUrls = safeJsonParse(moment.media_list, []);
      const momentMediaStr = Array.isArray(mediaUrls) && mediaUrls.length ? JSON.stringify(mediaUrls) : '[]';

      // 用原文前500字作为初始描述，确保房源库列表不会显示"-"
      const initialDescription = String(content || '').replace(/\s+/g, ' ').trim().slice(0, 500) || null;

      // 保存到 parsed_properties
      const record = {
        user_id: userId,
        robot_id: robotId,
        moment_id: moment.moment_id,
        original_content: content,
        content_hash: contentHash,
        property_code: propertyCode,
        description: initialDescription,
        community, district,
        price: ruleData.price || null,
        price_value: ruleData.price_value || null,
        bedrooms: ruleData.bedrooms || null,
        livingrooms: ruleData.livingrooms || null,
        bathrooms: ruleData.bathrooms || null,
        street: ruleData.street || null,
        has_elevator: hasElevator,
        has_parking: ruleData.has_parking ? 1 : null,
        has_commission: ruleData.has_commission ? 1 : null,
        is_sale: (ruleData._is_sale || (ruleData.price_value && ruleData.price_value > 200000) || (ruleData.price && (ruleData.price.includes('(售)') || ruleData.price.includes('万')))) ? 1 : 0,
        floor_info: ruleData.floor_info || null,
        area_sqm: ruleData.area_sqm || null,
        decoration: ruleData.decoration || null,
        orientation: ruleData.orientation || null,
        outdoor_features: Array.isArray(ruleData.outdoor_features) ? ruleData.outdoor_features.join(',') : (ruleData.outdoor_features || null),
        is_duplex: ruleData.is_duplex ? 1 : null,
        contact_info: ruleData.contact_info || null,
        metro_lines: metroLines,
        metro_stations: metroStations,
        metro_distance: metroDistance,
        latitude, longitude,
        location_source: poiMatch ? 'poi' : null,
        publisher_name: moment.owner_nickname || null,
        publisher_wxid: moment.owner_wxid || null,
        moment_publish_time: moment.create_time ? formatLocal(new Date(moment.create_time * 1000)) : null,
        media_urls: momentMediaStr,
        source: 'scheduled_task',
        status: 'draft',
        is_listed: 0,
        is_ai_parsed: 0,
        parse_status: 'rule_only',
      };

      try {
        const fields = Object.keys(record).filter(k => record[k] !== null && record[k] !== undefined);
        const placeholders = fields.map(() => '?').join(', ');
        const values = fields.map(k => record[k]);
        const insertResult = await query(
          `INSERT INTO wechat_robot_expat_parsed_properties (${fields.join(', ')}, created_at) VALUES (${placeholders}, NOW())`,
          values
        );
        savedCount++;

        // 下载外部媒体到本地
        if (insertResult?.insertId) {
          const dlCount = await downloadPropertyMedia(insertResult.insertId);
          if (dlCount > 0) mediaSavedCount += dlCount;
        }
      } catch (insertErr) {
        // 忽略单条插入错误（可能是重复）
      }

      // 每20条输出进度
      if (savedCount > 0 && savedCount % 20 === 0) {
        console.log(`${TAG} 任务 ${taskId}: 已保存 ${savedCount}/${totalFound}，跳过 ${skippedCount}，媒体 ${mediaSavedCount}`);
      }
    }

    // === 步骤4: 更新任务状态 ===
    await updateTaskLog(logId, 'success', totalFound, savedCount, mediaSavedCount, skippedCount);
    await updateTaskStats(taskId, task, totalFound, savedCount, mediaSavedCount, skippedCount);

    console.log(`${TAG} 任务 ${taskId} 完成: 搜索${totalFound}条, 保存${savedCount}条, 跳过${skippedCount}条, 媒体${mediaSavedCount}个`);

  } catch (err) {
    console.error(`${TAG} 任务 ${taskId} 执行失败:`, err.message);
    if (logId) {
      await updateTaskLog(logId, 'failed', totalFound, savedCount, mediaSavedCount, skippedCount, err.message);
    }
    try {
      await query(
        `UPDATE wechat_robot_expat_scheduled_tasks SET last_execution_status = 'failed', updated_at = NOW() WHERE id = ?`,
        [taskId]
      );
    } catch {}
  }
}

/**
 * 更新任务统计和调度信息
 */
async function updateTaskStats(taskId, task, totalFound, savedCount, mediaSavedCount, skippedCount) {
  try {
    const updateData = {
      last_run_at: formatLocal(new Date()),
      last_run_result: JSON.stringify({
        total_found: totalFound,
        saved_count: savedCount,
        media_saved_count: mediaSavedCount,
        skipped_count: skippedCount,
        run_time: formatLocal(new Date()),
        status: 'success'
      }),
      run_count: (task.run_count || 0) + 1,
      last_execution_status: 'success',
      force_next_run: 0,
      updated_at: formatLocal(new Date()),
    };

    // 间隔模式：更新下次执行时间
    if (task.schedule_mode === 'interval' && task.interval_hours) {
      updateData.next_run_at = formatLocal(new Date(Date.now() + task.interval_hours * 3600000));
    }

    // 指定日期模式：移除已执行的日期
    if (task.schedule_mode === 'specific_dates') {
      const specificDates = safeJsonParse(task.specific_dates, []);
      const today = formatLocal(new Date()).slice(0, 10);
      const remaining = specificDates.filter(d => d !== today);
      updateData.specific_dates = JSON.stringify(remaining);
      if (!remaining.length) {
        updateData.is_active = 0;
        console.log(`${TAG} 任务 ${taskId}: 指定日期已全部执行完毕，自动禁用`);
      }
    }

    const setClauses = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
    await query(
      `UPDATE wechat_robot_expat_scheduled_tasks SET ${setClauses} WHERE id = ?`,
      [...Object.values(updateData), taskId]
    );
  } catch (err) {
    console.error(`${TAG} 更新任务统计失败:`, err.message);
  }
}

/**
 * 主入口 - 每分钟调用
 */
let _zombieCleanedOnce = false;
async function cleanZombieRunningLogs() {
  if (_zombieCleanedOnce) return;
  _zombieCleanedOnce = true;
  try {
    const result = await query(
      `UPDATE wechat_robot_expat_task_logs
       SET execution_status = 'failed', end_time = NOW(),
           duration_seconds = TIMESTAMPDIFF(SECOND, start_time, NOW()),
           error_message = '进程重启导致任务中断，已自动标记失败'
       WHERE execution_status = 'running'
         AND start_time < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
    );
    if (result?.affectedRows > 0) {
      console.log(`${TAG} 已清理 ${result.affectedRows} 条僵尸运行记录`);
    }
  } catch {}
}

async function expatScheduledTasksJob() {
  if (running) return;
  running = true;

  await cleanZombieRunningLogs();

  try {
    // 获取所有启用的定时任务
    const tasks = await query(
      'SELECT * FROM wechat_robot_expat_scheduled_tasks WHERE is_active = 1'
    );
    if (!tasks?.length) { running = false; return; }

    const tasksToRun = [];
    for (const task of tasks) {
      if (await isTaskRunning(task.id)) {
        continue;
      }
      if (shouldTaskRun(task)) {
        tasksToRun.push(task);
      }
    }

    if (!tasksToRun.length) { running = false; return; }

    console.log(`${TAG} 发现 ${tasksToRun.length} 个待执行任务`);

    // 顺序执行（避免并发冲突）
    for (const task of tasksToRun) {
      try {
        await executeTask(task);
      } catch (err) {
        console.error(`${TAG} 执行任务 ${task.id} 异常:`, err.message);
      }
    }
  } catch (err) {
    console.error(`${TAG} 定时任务主流程出错:`, err.message);
  } finally {
    running = false;
  }
}

module.exports = { expatScheduledTasksJob };
