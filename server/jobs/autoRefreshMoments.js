/**
 * 自动刷新朋友圈定时任务
 * 读取 system_settings 中的刷新配置，按照设定的时间段和频率自动拉取朋友圈数据
 * 刷新完成后自动将新增朋友圈通过规则引擎解析为 parsed_properties
 */
const crypto = require('crypto');
const { query } = require('../config/database');
const WeChatRobotService = require('../services/WeChatRobotService');
const logger = require('../utils/logger');
const { extractMomentMediaUrlsFromSns, parseFavoriteNoteFromXml, parseContentStyleFromXml, parseFullContentFromXml } = require('../utils/snsXmlMediaParser');

const JOB_TAG = '[自动刷新朋友圈]';
const PARSE_TAG = '[自动解析朋友圈]';
let running = false;

/**
 * 解码HTML实体并清理控制字符
 * 处理微信XML中常见的 &#x0A; &#x0D; &#x02; 等编码
 */
function decodeHtmlEntities(text) {
  if (!text) return text;
  return String(text)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      if (code === 0x0A) return '\n';
      if (code === 0x0D) return '';
      if (code < 0x20 && code !== 0x09) return '';
      return String.fromCharCode(code);
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      if (code === 10) return '\n';
      if (code === 13) return '';
      if (code < 32 && code !== 9) return '';
      return String.fromCharCode(code);
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/* ==================== 动态地理别名映射（从 district_alias_dict 表加载） ==================== */
let LANDMARK_DISTRICT_MAP = {};
let ROAD_DISTRICT_MAP = {};
let METRO_STATION_DISTRICT_MAP = {};
let _aliasLastLoad = 0;
const ALIAS_RELOAD_INTERVAL = 10 * 60 * 1000; // 10分钟自动重载

async function loadDistrictAliasMaps(force = false) {
  if (!force && Date.now() - _aliasLastLoad < ALIAS_RELOAD_INTERVAL) return;
  try {
    const rows = await query('SELECT alias_name, alias_type, district, priority FROM district_alias_dict WHERE is_enabled=1 ORDER BY priority DESC');
    const data = Array.isArray(rows[0]) ? rows[0] : rows;
    const lm = {}, rd = {}, mt = {};
    if (data) {
      for (const r of data) {
        const target = r.alias_type === 'road' ? rd : r.alias_type === 'metro' ? mt : lm;
        if (!target[r.alias_name]) target[r.alias_name] = r.district;
      }
    }
    LANDMARK_DISTRICT_MAP = lm;
    ROAD_DISTRICT_MAP = rd;
    METRO_STATION_DISTRICT_MAP = mt;
    _aliasLastLoad = Date.now();
    logger.info(`${JOB_TAG} 已从DB加载地理别名映射: 地标${Object.keys(lm).length} 路名${Object.keys(rd).length} 地铁${Object.keys(mt).length}`);
  } catch (err) {
    logger.error(`${JOB_TAG} 加载地理别名映射失败:`, err.message);
  }
}

loadDistrictAliasMaps(true).catch(() => {});
loadPOIAliasMap(true).catch(() => {});

const INVALID_COMMUNITY_SET = new Set([
  '上海', '上海市', '徐汇', '静安', '长宁', '普陀', '虹口', '杨浦', '黄浦',
  '浦东', '浦东新', '闵行', '宝山', '嘉定', '松江', '青浦', '奉贤', '金山', '崇明',
  '徐汇区', '静安区', '长宁区', '普陀区', '虹口区', '杨浦区', '黄浦区',
  '浦东新区', '闵行区', '宝山区', '嘉定区', '松江区', '青浦区', '奉贤区', '金山区', '崇明区',
]);

const GARBAGE_COMMUNITY_PATTERNS = /^(有视频|员工宿舍|建筑面积|智能家居|包租|付佣|免佣|原始天燃气|每月配合|面积|快租|合租|直租|转租|招租|求租|整租|押一付|可月付|可短租|新装修|精装|毛坯|包物业|楼层|OK|稀缺|类型|其他|梧桐区|原始天燃气厨房)$/;

/* ==================== POI别名反查缓存 ==================== */
let _poiAliasMap = {};
let _poiAliasLastLoad = 0;

function normalizePOIAliasName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\s"'“”‘’`·•.。()（）【】\[\]{}<>《》]+/g, '')
    .trim();
}

function parsePOIAliasNames(raw) {
  if (!raw) return [];
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else {
    const text = String(raw).trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      list = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      list = text.split(/[,，;；、|｜/\\\n\r\t]+/);
    }
  }
  const seen = new Set();
  return list
    .flatMap((item) => String(item || '').split(/[,，;；、|｜/\\\n\r\t]+/))
    .map((item) => normalizePOIAliasName(item))
    .filter((item) => {
      if (item.length < 2 || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

async function loadPOIAliasMap(force = false) {
  if (!force && Date.now() - _poiAliasLastLoad < ALIAS_RELOAD_INTERVAL) return;
  try {
    const rows = await query("SELECT community_name, alias_names, district FROM property_community_dict WHERE is_enabled=1 AND alias_names IS NOT NULL AND alias_names != '' AND alias_names != '[]'");
    const data = Array.isArray(rows[0]) ? rows[0] : rows;
    const map = {};
    if (data) {
      for (const r of data) {
        parsePOIAliasNames(r.alias_names).forEach((name) => {
          if (!map[name]) map[name] = { community_name: r.community_name, district: r.district };
        });
      }
    }
    _poiAliasMap = map;
    _poiAliasLastLoad = Date.now();
    logger.info(`${JOB_TAG} POI别名映射加载: ${Object.keys(map).length}条`);
  } catch (err) {
    logger.error(`${JOB_TAG} POI别名映射加载失败:`, err.message);
  }
}

/**
 * 校验并修正小区名：POI精确匹配 > POI别名匹配 > 地标别名映射 > 垃圾过滤
 */
function validateAndFixCommunity(community, district) {
  if (!community) return { community: null, district };
  community = normalizePOIAliasName(community) || community;

  if (INVALID_COMMUNITY_SET.has(community)) return { community: null, district };
  if (GARBAGE_COMMUNITY_PATTERNS.test(community)) return { community: null, district };

  // "静安·静安寺" 格式：提取区域和地标
  const dotMatch = community.match(/^([\u4e00-\u9fa5]{2,3})\s*[·•·]\s*([\u4e00-\u9fa5]{2,})/);
  if (dotMatch) {
    const maybeDist = DISTRICT_MAP_STANDARD[dotMatch[1]];
    if (maybeDist) {
      district = maybeDist;
      community = dotMatch[2];
    }
  }

  // POI别名反查：如果community是某个POI的别名，替换为标准POI名
  if (_poiAliasMap[community]) {
    const poi = _poiAliasMap[community];
    return { community: poi.community_name, district: poi.district || district };
  }

  // 地标/商圈名：保留为community但确保district正确
  if (LANDMARK_DISTRICT_MAP[community]) {
    district = LANDMARK_DISTRICT_MAP[community];
  }

  return { community, district };
}

const DISTRICT_MAP_STANDARD = {
  '黄浦': '黄浦区', '徐汇': '徐汇区', '长宁': '长宁区', '静安': '静安区',
  '普陀': '普陀区', '虹口': '虹口区', '杨浦': '杨浦区', '闵行': '闵行区',
  '宝山': '宝山区', '嘉定': '嘉定区', '浦东': '浦东新区', '浦东新': '浦东新区',
  '金山': '金山区', '松江': '松江区', '青浦': '青浦区', '奉贤': '奉贤区', '崇明': '崇明区',
};

/**
 * 标准化区域名（确保带"区"后缀，映射到标准名称）
 */
function normalizeDistrict(d) {
  if (!d) return null;
  const s = String(d).trim().replace(/^上海/, '');
  if (s.endsWith('区')) {
    if (DISTRICT_MAP_STANDARD[s.replace(/新?区$/, '')]) return DISTRICT_MAP_STANDARD[s.replace(/新?区$/, '')];
    return s;
  }
  return DISTRICT_MAP_STANDARD[s] || DISTRICT_MAP_STANDARD[s.replace(/区$/, '')] || null;
}

/**
 * 格式化为本地时间字符串 (YYYY-MM-DD HH:mm:ss)，避免 toISOString 的 UTC 时区偏移
 */
function formatLocalDatetime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 从路名关键词匹配区域（辅助函数）
 */
function matchRoadToDistrict(text) {
  // 按路名长度降序匹配，优先匹配更精确的（如"中山南二路" > "中山路"）
  const roads = Object.keys(ROAD_DISTRICT_MAP).sort((a, b) => b.length - a.length);
  for (const road of roads) {
    if (text.includes(road + '路') || text.includes(road + '街') || text.includes(road + '大道')) return ROAD_DISTRICT_MAP[road];
  }
  return null;
}

/**
 * 同步推断区域（静态映射表，速度快）
 */
function inferDistrictSync(content, community) {
  if (!content) return null;
  const text = String(content);

  // 1. 正则匹配明确区名
  const distMatch = text.match(/(黄浦|徐汇|长宁|静安|普陀|虹口|杨浦|闵行|宝山|嘉定|浦东|金山|松江|青浦|奉贤|崇明)\s*(?:区|新区)?/);
  if (distMatch) return DISTRICT_MAP_STANDARD[distMatch[1]] || null;

  // 2. 地标/商圈/板块匹配
  const landmarks = Object.keys(LANDMARK_DISTRICT_MAP).sort((a, b) => b.length - a.length);
  for (const lm of landmarks) {
    if (text.includes(lm)) return LANDMARK_DISTRICT_MAP[lm];
  }

  // 3. 路名匹配（静态映射表）
  const roadResult = matchRoadToDistrict(text);
  if (roadResult) return roadResult;

  // 4. 地铁站匹配
  const metroMatch = text.match(/([\u4e00-\u9fa5]{2,6})(?:路)?(?:地铁|站|metro)/i);
  if (metroMatch) {
    const stName = metroMatch[1];
    if (METRO_STATION_DISTRICT_MAP[stName]) return METRO_STATION_DISTRICT_MAP[stName];
    if (METRO_STATION_DISTRICT_MAP[stName + '路']) return METRO_STATION_DISTRICT_MAP[stName + '路'];
  }

  // 5. 号线+站名
  const lineMatch = text.match(/\d{1,2}号线\s*([\u4e00-\u9fa5]{2,6})/);
  if (lineMatch) {
    const stName = lineMatch[1].replace(/路?站?$/, '');
    if (METRO_STATION_DISTRICT_MAP[stName]) return METRO_STATION_DISTRICT_MAP[stName];
    if (METRO_STATION_DISTRICT_MAP[stName + '路']) return METRO_STATION_DISTRICT_MAP[stName + '路'];
  }

  // 6. 从小区名反推区域
  if (community && !INVALID_COMMUNITY_SET.has(community)) {
    if (LANDMARK_DISTRICT_MAP[community]) return LANDMARK_DISTRICT_MAP[community];
    const roadInCommunity = matchRoadToDistrict(community);
    if (roadInCommunity) return roadInCommunity;
  }

  // 7. 宽松路名匹配
  const addrMatch = text.match(/([\u4e00-\u9fa5]{2,5})路\d+/);
  if (addrMatch && ROAD_DISTRICT_MAP[addrMatch[1]]) return ROAD_DISTRICT_MAP[addrMatch[1]];

  return null;
}

/**
 * 从文案/小区名中提取路名列表
 */
function extractRoadNames(text) {
  if (!text) return [];
  const roads = new Set();
  const patterns = [
    /([\u4e00-\u9fa5]{2,6})路\d+/g,
    /([\u4e00-\u9fa5]{2,6})路(?:弄|号|地铁|站|口|旁|附近|\/)/g,
    /([\u4e00-\u9fa5]{2,6})(?:南|北|东|西)?路/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const name = m[1].replace(/^[在到去从近靠]/, '');
      if (name.length >= 2 && name.length <= 6) roads.add(name + '路');
    }
  }
  return [...roads];
}

/**
 * 异步推断区域：先用静态映射，不行再查POI数据库（按路名查district）
 */
async function inferDistrictFromContent(content, community) {
  // 先快速用静态映射
  const syncResult = inferDistrictSync(content, community);
  if (syncResult) return syncResult;

  // 静态映射没命中，从文案/小区名提取路名，去POI数据库查
  const allText = (content || '') + ' ' + (community || '');
  const roadNames = extractRoadNames(allText);

  for (const roadName of roadNames) {
    try {
      const rows = await query(
        `SELECT district, COUNT(*) as cnt
         FROM property_community_dict
         WHERE is_enabled = 1
           AND (address LIKE ? OR community_name LIKE ?)
         GROUP BY district
         ORDER BY cnt DESC LIMIT 1`,
        [`%${roadName}%`, `%${roadName}%`]
      );
      if (rows && rows.length > 0 && rows[0].district) {
        return rows[0].district;
      }
    } catch {}
  }

  // 小区名直接查POI
  if (community && !INVALID_COMMUNITY_SET.has(community) && community.length >= 2) {
    try {
      const rows = await query(
        `SELECT district FROM property_community_dict
         WHERE is_enabled = 1
           AND (community_name = ? OR community_name LIKE ? OR alias_names LIKE ?)
         LIMIT 1`,
        [community, `%${community}%`, `%${community}%`]
      );
      if (rows && rows.length > 0 && rows[0].district) {
        return rows[0].district;
      }
    } catch {}
  }

  // 从文案中提取可能的社区名关键词去查POI
  const communityNames = extractCommunityKeywords(content);
  for (const cn of communityNames) {
    try {
      const rows = await query(
        `SELECT district FROM property_community_dict WHERE is_enabled = 1 AND community_name LIKE ? LIMIT 1`,
        [`%${cn}%`]
      );
      if (rows && rows.length > 0 && rows[0].district) return rows[0].district;
    } catch {}
  }

  return null;
}

/**
 * 从文案中提取可能的小区/社区名关键词（用于POI查询）
 */
function extractCommunityKeywords(text) {
  if (!text) return [];
  const names = new Set();
  // 匹配 "XX村"、"XX苑"、"XX小区"、"XX花园"、"XX城"、"XX大厦"、"XX公寓" 等模式
  const patterns = [
    /([\u4e00-\u9fa5]{2,6}(?:村|苑|小区|花园|花城|城|大厦|公寓|新村|家园|广场|大楼|名邸|华庭|雅苑|豪庭|嘉园|府邸|公馆|别墅|庄园|湾|里|坊|居|阁|舍|寓))/g,
    /([\u4e00-\u9fa5]{2,4}(?:一|二|三|四|五|六|七|八|九|十)(?:区|村|期|号院|街区))/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const name = m[1];
      if (name.length >= 3 && !INVALID_COMMUNITY_SET.has(name)) names.add(name);
      // 也提取去掉数字后缀的核心名（如"滨浦七村"→"滨浦"）
      const core = name.replace(/[一二三四五六七八九十\d]+(?:区|村|期|号院|街区)$/, '');
      if (core.length >= 2 && core !== name) names.add(core);
    }
  }
  return [...names];
}

/**
 * 从文案中提取地标名作为小区兜底
 */
function extractLandmarkFromContent(content) {
  if (!content) return null;
  const text = String(content);
  const landmarks = [
    '静安寺', '中山公园', '人民广场', '陆家嘴', '外滩', '徐家汇', '新天地',
    '古北', '曹家渡', '真如', '长风公园', '虹口足球场', '大宁', '北外滩',
    '世纪公园', '花木', '联洋', '金桥', '碧云', '张江', '前滩',
    '莘庄', '七宝', '龙华', '漕河泾', '龙柏', '五角场', '虹桥',
  ];
  for (const lm of landmarks) {
    if (text.includes(lm)) return lm;
  }
  return null;
}

// 记录每个配置key上次「开始刷新」的时间戳，避免在同一间隔内重复触发（按开始时刻计间隔，避免单次任务耗时 3～4 分钟把「每5分钟」拖成约10分钟）
const lastRefreshMap = new Map();

/** 使用上海时区的小时数判断「白天/夜间」时段，避免服务器为 UTC 时把中国凌晨误判为白天（导致已关闭的夜间段仍会刷新） */
function getShanghaiHour(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(date);
    const h = parts.find((p) => p.type === 'hour');
    return h ? parseInt(h.value, 10) : date.getHours();
  } catch {
    return date.getHours();
  }
}

/** 兼容 DB/JSON 中 enabled 为 0/1、"false" 字符串等情况 */
function isPeriodEnabled(period) {
  if (!period || typeof period !== 'object') return false;
  const e = period.enabled;
  if (e === false || e === 0 || e === '0' || e === 'false' || e === '') return false;
  if (e === true || e === 1 || e === '1' || e === 'true') return true;
  return Boolean(e);
}

function isMomentsAutoRefreshOn(config) {
  if (!config || typeof config !== 'object') return false;
  const v = config.is_auto_refresh;
  if (v === false || v === 0 || v === '0' || v === 'false' || v === '') return false;
  return Boolean(v);
}

function parseRobotIdFromMomentsRefreshKey(settingKey) {
  const suffix = String(settingKey).replace(/^moments_refresh_/, '');
  const parts = suffix.split('_');
  if (parts[0] === 'admin') {
    return parseInt(parts[1], 10) || 0;
  }
  return parseInt(parts[parts.length - 1], 10) || 0;
}

/**
 * 同一机器人可能同时存在：
 * - moments_refresh_{userId}_{robotId}（用户中心保存）
 * - moments_refresh_admin_{robotId}（管理员后台保存）
 * 若两套并存，必须先前的实现会按 SQL 顺序可能先读到「用户侧旧配置」（凌晨段仍开启），导致后台已关闭凌晨仍被刷新。
 * 规则：存在 admin 键时只采用 admin 配置；否则采用用户键。
 */
function pickCanonicalMomentsRefreshRows(rows) {
  if (!rows || !rows.length) return [];
  const byRobot = new Map();
  for (const row of rows) {
    const key = row.setting_key;
    if (!key || !key.startsWith('moments_refresh_')) continue;
    const robotId = parseRobotIdFromMomentsRefreshKey(key);
    if (!robotId) continue;
    const isAdmin = key.startsWith('moments_refresh_admin_');
    const prev = byRobot.get(robotId);
    if (!prev || isAdmin) {
      byRobot.set(robotId, { row });
    }
  }
  return Array.from(byRobot.values()).map((x) => x.row);
}

/**
 * 判断当前时间是否处于某个时间段内，并且距离上次刷新开始已超过 interval
 */
function shouldRefreshNow(scheduleConfig, settingKey) {
  if (!Array.isArray(scheduleConfig) || !scheduleConfig.length) return false;

  const currentHour = getShanghaiHour();
  const lastRefresh = lastRefreshMap.get(settingKey) || 0;
  const elapsedMs = Date.now() - lastRefresh;

  for (const period of scheduleConfig) {
    if (!isPeriodEnabled(period)) continue;

    const { start_hour, end_hour, interval_minutes } = period;
    const im = parseInt(interval_minutes, 10);
    const intervalMs = (Number.isFinite(im) && im > 0 ? im : 10) * 60 * 1000;

    let inRange = false;
    if (start_hour < end_hour) {
      inRange = currentHour >= start_hour && currentHour < end_hour;
    } else if (start_hour > end_hour) {
      // 跨天：例如 22:00 ~ 08:00
      inRange = currentHour >= start_hour || currentHour < end_hour;
    } else {
      inRange = true; // start === end 意味着全天
    }

    if (inRange && elapsedMs >= intervalMs) {
      return true;
    }
  }
  return false;
}

/**
 * 解析 snsXml 中的正文（支持普通 contentDesc + 收藏笔记 noteinfo）
 */
function parseContentFromXml(snsXml) {
  if (!snsXml) return '';
  try {
    return decodeHtmlEntities(parseFullContentFromXml(snsXml));
  } catch {}
  return '';
}

const MAX_MOMENTS_PER_REFRESH = 2000;
const PAGE_DELAY_MS = 800; // 翻页间隔，避免API限流
const CATCHUP_CURSOR_PREFIX = 'moments_refresh_catchup_cursor_';

async function loadBlockedWxidSet(robotId) {
  const rows = await query(
    'SELECT wxid FROM wechat_robot_contacts WHERE robot_id = ? AND is_blocked = 1',
    [robotId]
  ).catch(() => []);
  return new Set((rows || []).map((r) => String(r.wxid || '').trim()).filter(Boolean));
}

async function getCatchupCursor(robotId) {
  const key = `${CATCHUP_CURSOR_PREFIX}${robotId}`;
  const rows = await query('SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1', [key]).catch(() => []);
  const value = rows && rows[0] ? String(rows[0].setting_value || '') : '';
  const parsed = value ? parseInt(value, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function saveCatchupCursor(robotId, cursor) {
  const key = `${CATCHUP_CURSOR_PREFIX}${robotId}`;
  const nextCursor = cursor ? String(cursor) : '';
  await query(
    'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
    [key, nextCursor]
  ).catch(() => {});
}

/**
 * 处理单条朋友圈数据入库
 */
async function processSnsItem(sns, robotId, userId, myWxid, blockedWxidSet = null) {
  const momentId = String(sns.id || '');
  if (!momentId) return false;
  const userName = sns.userName || '';
  if (userName && blockedWxidSet && blockedWxidSet.has(userName)) return false;
  const nickName = sns.nickName || '';
  const snsXml = sns.snsXml || '';
  let content = decodeHtmlEntities(sns.contentDesc || sns.content || '');
  // 清理CDATA垃圾值
  if (content && content.includes('CDATA')) content = '';
  if (!content && snsXml) content = parseContentFromXml(snsXml);
  let mediaUrls = extractMomentMediaUrlsFromSns(sns);
  const createTime = sns.createTime || 0;
  const isOwn = userName === myWxid ? 1 : 0;
  const contentStyle = parseContentStyleFromXml(snsXml);

  // 收藏笔记特殊处理：提取 noteinfo 中的文本和媒体
  let favContent = null;
  if (snsXml.includes('<noteinfo>')) {
    const note = parseFavoriteNoteFromXml(snsXml);
    if (note.text) favContent = note.text;
    if (note.mediaUrls.length && !mediaUrls.length) {
      mediaUrls = note.mediaUrls;
    }
  }

  try {
    const existing = await query(
      'SELECT id FROM wechat_robot_moments WHERE robot_id = ? AND moment_id = ? LIMIT 1',
      [robotId, momentId]
    );
    if (!existing || !existing.length) {
      await query(
        `INSERT INTO wechat_robot_moments
         (robot_id, user_id, moment_id, owner_wxid, owner_nickname, content, is_own, status, create_time, like_count, comment_count, raw_snsxml, media_list, content_style, fav_content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [robotId, userId, momentId, userName || null, nickName || null, content || null, isOwn,
         createTime || null, sns.likeCount || 0, sns.commentCount || 0, snsXml || null,
         mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null, contentStyle, favContent]
      );
      return true;
    } else {
      const updates = [];
      const params = [];
      if (content) { updates.push("content = COALESCE(NULLIF(content, ''), ?)"); params.push(content); }
      if (mediaUrls.length > 0) { updates.push('media_list = COALESCE(media_list, ?)'); params.push(JSON.stringify(mediaUrls)); }
      if (createTime) { updates.push('create_time = COALESCE(create_time, ?)'); params.push(createTime); }
      if (contentStyle !== 1) { updates.push('content_style = ?'); params.push(contentStyle); }
      if (favContent) { updates.push("fav_content = COALESCE(NULLIF(fav_content, ''), ?)"); params.push(favContent); }
      if (updates.length > 0) {
        params.push(existing[0].id);
        await query(`UPDATE wechat_robot_moments SET ${updates.join(', ')} WHERE id = ?`, params);
      }
    }
  } catch { /* 忽略单条错误 */ }
  return false;
}

/**
 * 对单个机器人执行一次朋友圈刷新（循环翻页，最多获取 MAX_MOMENTS_PER_REFRESH 条）
 */
async function doRefresh(robotId, userId, apiUrl, token, deviceId) {
  const startMs = Date.now();
  try {
    const acctRows = await query('SELECT wxid FROM wechat_robot_accounts WHERE id = ? LIMIT 1', [robotId]);
    const myWxid = (acctRows && acctRows[0] && acctRows[0].wxid) || '';
    const blockedWxidSet = await loadBlockedWxidSet(robotId);

    let totalFetched = 0;
    let newCount = 0;
    let pageNum = 0;
    let endedNaturally = false;
    let nextCursor = 0;
    const catchupCursor = await getCatchupCursor(robotId);
    const passes = [
      { name: 'latest', startMaxId: 0, budget: catchupCursor ? Math.min(500, MAX_MOMENTS_PER_REFRESH) : MAX_MOMENTS_PER_REFRESH },
      ...(catchupCursor ? [{ name: 'catchup', startMaxId: catchupCursor, budget: MAX_MOMENTS_PER_REFRESH }] : []),
    ];

    for (const pass of passes) {
      let maxId = pass.startMaxId;
      let consecutiveEmpty = 0;
      let passFetched = 0;

      while (totalFetched < MAX_MOMENTS_PER_REFRESH && passFetched < pass.budget) {
        pageNum++;
        const result = await WeChatRobotService.getMoments(apiUrl, token, deviceId, maxId);
        const snsList = result?.data?.snsList || [];

        if (!snsList.length) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 2) {
            if (pass.name === 'catchup' || !catchupCursor) endedNaturally = true;
            break;
          }
          await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
          continue;
        }
        consecutiveEmpty = 0;

        for (const sns of snsList) {
          const isNew = await processSnsItem(sns, robotId, userId, myWxid, blockedWxidSet);
          if (isNew) newCount++;
        }

        totalFetched += snsList.length;
        passFetched += snsList.length;

        // 获取最后一条的 id 作为下一页的 maxId；达到单次上限时保存游标，下次继续补抓。
        const lastSns = snsList[snsList.length - 1];
        const lastId = lastSns?.id || 0;
        if (!lastId || lastId === maxId) {
          if (pass.name === 'catchup' || !catchupCursor) endedNaturally = true;
          nextCursor = 0;
          break;
        }
        maxId = lastId;
        nextCursor = maxId;

        if (totalFetched >= MAX_MOMENTS_PER_REFRESH || passFetched >= pass.budget) break;

        await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
      }

      if (totalFetched >= MAX_MOMENTS_PER_REFRESH) break;
      if (pass.name === 'latest' && !catchupCursor) break;
    }

    await saveCatchupCursor(robotId, endedNaturally ? 0 : nextCursor);

    const durationMs = Date.now() - startMs;
    await query(
      `INSERT INTO wechat_robot_moments_refresh_logs (user_id, robot_id, refresh_type, status, moments_count, new_count, duration_ms, created_at)
       VALUES (?, ?, 'auto', 'success', ?, ?, ?, NOW())`,
      [userId, robotId, totalFetched, newCount, durationMs]
    );
    console.log(`${JOB_TAG} robot=${robotId} 翻${pageNum}页, 获取${totalFetched}条, 新增${newCount}条, 下次补抓maxId=${endedNaturally ? 0 : nextCursor}, 耗时${durationMs}ms`);
    return { success: true, total: totalFetched, newCount };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    try {
      await query(
        `INSERT INTO wechat_robot_moments_refresh_logs (user_id, robot_id, refresh_type, status, moments_count, new_count, error_message, duration_ms, created_at)
         VALUES (?, ?, 'auto', 'failed', 0, 0, ?, ?, NOW())`,
        [userId, robotId, (err.message || '').substring(0, 500), durationMs]
      );
    } catch {}
    console.error(`${JOB_TAG} robot=${robotId} 刷新失败:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 自动解析：将 wechat_robot_moments 中尚未解析的记录解析到 wechat_robot_expat_parsed_properties
 * 完整流程：规则引擎 → POI匹配（小区/区域/地铁） → 写入数据库
 */
async function autoParseNewMoments(robotId, userId, limit = 2000) {
  let pluginCtrl;
  try {
    pluginCtrl = require('../controllers/user/WeChatRobotPluginController');
  } catch (e) {
    console.error(`${PARSE_TAG} 无法加载 WeChatRobotPluginController:`, e.message);
    return 0;
  }

  const { ruleBasedFullParse, isPropertyRelatedContent, matchPOIBeforeAI, extractAddressFromContent, isGarbageCommunityName, isInvalidCommunityName } = pluginCtrl;
  if (!ruleBasedFullParse || !isPropertyRelatedContent) {
    console.error(`${PARSE_TAG} 必要解析函数未导出`);
    return 0;
  }

  try {
    const unparsed = await query(
      `SELECT m.id, m.moment_id, m.content, m.fav_content, m.owner_wxid, m.owner_nickname, m.create_time, m.media_list
       FROM wechat_robot_moments m
       LEFT JOIN wechat_robot_expat_parsed_properties p
         ON m.moment_id = p.moment_id AND m.robot_id = p.robot_id
       WHERE m.robot_id = ? AND m.user_id = ?
         AND p.id IS NULL
         AND (m.content IS NOT NULL AND m.content != '' OR m.fav_content IS NOT NULL AND m.fav_content != '')
       ORDER BY m.id DESC
       LIMIT ?`,
      [robotId, userId, limit]
    );

    if (!unparsed || !unparsed.length) {
      console.log(`${PARSE_TAG} robot=${robotId} 没有新的待解析朋友圈`);
      return 0;
    }

    console.log(`${PARSE_TAG} robot=${robotId} 发现${unparsed.length}条待解析`);
    let parsedCount = 0;

    for (const moment of unparsed) {
      try {
        // 收藏笔记处理：fav_content 包含更详细的noteinfo文本，应优先使用
        // content 可能是空值、CDATA垃圾值、或仅包含简短描述
        const rawContent = moment.content || '';
        const favContent = moment.fav_content || '';
        const isContentGarbage = !rawContent || rawContent.includes('CDATA') || rawContent.trim().length < 4;
        let content;
        if (favContent) {
          if (isContentGarbage || favContent.length > rawContent.length) {
            content = favContent;
          } else {
            content = rawContent;
            if (!rawContent.includes(favContent.substring(0, Math.min(20, favContent.length)))) {
              content = rawContent + '\n' + favContent;
            }
          }
        } else {
          content = rawContent;
        }
        if (!content || !isPropertyRelatedContent(content)) {
          if (favContent && isPropertyRelatedContent(favContent)) {
            content = favContent;
          } else {
            continue;
          }
        }

        // === 步骤1: 规则引擎解析 ===
        const ruleData = ruleBasedFullParse(content);

        // === 步骤2: POI匹配（小区名、区域、地铁） ===
        let poiMatch = null;
        try {
          if (matchPOIBeforeAI) {
            poiMatch = await matchPOIBeforeAI(content, ruleData.district || null);
          }
        } catch {}

        // 合并 POI 结果到解析数据
        let community = ruleData.community || null;
        let district = ruleData.district || null;
        let metroLines = null;
        let metroStations = null;
        let metroDistance = null;
        let latitude = null;
        let longitude = null;

        if (poiMatch) {
          community = poiMatch.community_name || community;
          if (poiMatch.district) district = poiMatch.district;
          if (poiMatch.nearest_metro_line) metroLines = poiMatch.nearest_metro_line;
          if (poiMatch.nearest_metro_station) metroStations = poiMatch.nearest_metro_station;
          if (poiMatch.nearest_metro_distance) metroDistance = parseInt(poiMatch.nearest_metro_distance) || null;
          if (poiMatch.latitude) latitude = parseFloat(poiMatch.latitude) || null;
          if (poiMatch.longitude) longitude = parseFloat(poiMatch.longitude) || null;
        }

        // === 步骤2.5: 小区名校验与修正（POI别名反查 + 垃圾过滤 + 地标区域校正） ===
        const validated = validateAndFixCommunity(community, district);
        community = validated.community;
        district = validated.district;

        // === 步骤3: 区域强制推断（district 不能为空） ===
        if (!district) {
          district = await inferDistrictFromContent(content, community);
        }
        // 区域标准化（确保带"区"后缀）
        if (district) {
          district = normalizeDistrict(district);
        }
        // === 步骤3.5: 小区名兜底链（确保 community 永不为空） ===
        // 优先级: POI/规则结果 > 地址提取(路+弄/号) > 地标名 > 区域名 > '上海'
        if (!community || INVALID_COMMUNITY_SET.has(community)) {
          // 尝试从文案提取详细地址（路+弄/号，如"建国西路250弄5号"）
          if (extractAddressFromContent) {
            const addrCommunity = extractAddressFromContent(content);
            if (addrCommunity && addrCommunity.length >= 4) community = addrCommunity;
          }
        }
        if (!community || INVALID_COMMUNITY_SET.has(community)) {
          const landmarkName = extractLandmarkFromContent(content);
          if (landmarkName) community = landmarkName;
        }
        if (!community || INVALID_COMMUNITY_SET.has(community)) {
          // 用区域名去掉"区"后缀作为兜底
          if (district) community = String(district).replace(/区$/, '');
        }
        if (!community || INVALID_COMMUNITY_SET.has(community)) {
          // 从文案中提取区域名关键词
          const distFromText = (content.match(/(徐汇|静安|长宁|普陀|虹口|杨浦|黄浦|浦东|闵行|宝山|嘉定|松江|青浦|奉贤|金山|崇明)/) || [])[1];
          if (distFromText) community = distFromText;
        }
        if (!community) {
          community = '上海';
        }

        // 小区名含"大楼"/"大厦"自动设置有电梯
        let hasElevator = ruleData.has_elevator ? 1 : null;
        if (!hasElevator && community && /大楼|大厦/.test(community)) hasElevator = 1;

        // content_hash 去重
        const normalized = content.replace(/\\n/g, '\n').replace(/\s+/g, '').replace(/[，。！？、；：""''（）【】《》\-\—\~\·]/g, '').toLowerCase().trim();
        const contentHash = (normalized && normalized.length >= 5) ? crypto.createHash('md5').update(normalized).digest('hex') : null;

        // property_code（使用本地日期）
        const dateStr = formatLocalDatetime(new Date()).slice(0, 10).replace(/-/g, '');
        const maxCodeRows = await query(
          "SELECT property_code FROM wechat_robot_expat_parsed_properties WHERE property_code LIKE ? ORDER BY property_code DESC LIMIT 1",
          [`EXP${dateStr}%`]
        );
        let seqNum = 1;
        if (maxCodeRows && maxCodeRows[0] && maxCodeRows[0].property_code) {
          const m = maxCodeRows[0].property_code.match(/(\d+)$/);
          if (m) seqNum = parseInt(m[1]) + 1;
        }
        const propertyCode = `EXP${dateStr}-${String(seqNum).padStart(5, '0')}`;

        // 用原文前500字作为初始描述，确保房源库列表不会显示"-"
        const initialDescription = String(content || '').replace(/\s+/g, ' ').trim().slice(0, 500) || null;

        const record = {
          user_id: userId,
          robot_id: robotId,
          moment_id: moment.moment_id,
          original_content: content,
          favorites_content: moment.fav_content || null,
          content_hash: contentHash,
          property_code: propertyCode,
          description: initialDescription,
          community: community,
          price: ruleData.price || null,
          price_value: ruleData.price_value || null,
          bedrooms: ruleData.bedrooms || null,
          livingrooms: ruleData.livingrooms || null,
          bathrooms: ruleData.bathrooms || null,
          district: district,
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
          latitude: latitude,
          longitude: longitude,
          location_source: poiMatch ? 'poi' : null,
          publisher_name: moment.owner_nickname || null,
          publisher_wxid: moment.owner_wxid || null,
          moment_publish_time: moment.create_time ? formatLocalDatetime(new Date(moment.create_time * 1000)) : null,
          source: 'moments',
          status: 'draft',
          is_listed: 0,
          is_ai_parsed: 0,
          parse_status: 'rule_only',
        };

        const fields = Object.keys(record).filter(k => record[k] !== null && record[k] !== undefined);
        const placeholders = fields.map(() => '?').join(', ');
        const values = fields.map(k => record[k]);

        await query(
          `INSERT INTO wechat_robot_expat_parsed_properties (${fields.join(', ')}, created_at) VALUES (${placeholders}, NOW())`,
          values
        );
        parsedCount++;
      } catch (innerErr) {
        // 忽略单条解析错误
      }
    }

    console.log(`${PARSE_TAG} robot=${robotId} 解析完成, 新增${parsedCount}条(含POI匹配)`);
    return parsedCount;
  } catch (err) {
    console.error(`${PARSE_TAG} robot=${robotId} 解析出错:`, err.message);
    return 0;
  }
}

/**
 * 主任务函数 - 每分钟调用一次
 */
async function autoRefreshMomentsJob() {
  if (running) return;
  running = true;

  await loadDistrictAliasMaps();
  await loadPOIAliasMap();

  try {
    // 1. 从 system_settings 获取所有 moments_refresh_* 设置
    const rows = await query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'moments_refresh_%'"
    );
    if (!rows || !rows.length) { running = false; return; }

    const canonicalRows = pickCanonicalMomentsRefreshRows(rows);

    // 避免同一个robotId在一轮中被多个setting重复刷新
    const refreshedRobots = new Set();

    for (const row of canonicalRows) {
      try {
        const settingKey = row.setting_key;
        const config = JSON.parse(row.setting_value || '{}');
        if (!isMomentsAutoRefreshOn(config)) continue;

        let scheduleConfig = config.schedule_config;
        if (typeof scheduleConfig === 'string') {
          try {
            scheduleConfig = JSON.parse(scheduleConfig);
          } catch {
            scheduleConfig = [];
          }
        }
        if (!Array.isArray(scheduleConfig)) scheduleConfig = [];
        if (!shouldRefreshNow(scheduleConfig, settingKey)) continue;

        const robotId = parseRobotIdFromMomentsRefreshKey(settingKey);

        if (!robotId || refreshedRobots.has(robotId)) continue;

        // 2. 获取机器人账号信息
        const acctRows = await query(
          'SELECT id, user_id, device_id, wxid, status FROM wechat_robot_accounts WHERE id = ? LIMIT 1',
          [robotId]
        );
        if (!acctRows || !acctRows.length) continue;
        const acct = acctRows[0];

        if (!acct.device_id) continue;

        // 3. 获取API配置（优先全局配置 user_id=0，回退到账号所属用户）
        let apiRow = null;
        const globalCfg = await query('SELECT api_url, token FROM wechat_robot_api_config WHERE user_id = 0 LIMIT 1');
        if (globalCfg && globalCfg[0] && globalCfg[0].api_url) {
          apiRow = globalCfg[0];
        } else {
          const userCfg = await query(
            "SELECT api_url, token FROM wechat_robot_api_config WHERE user_id = ? AND status = 'active' LIMIT 1",
            [acct.user_id]
          );
          if (userCfg && userCfg[0] && userCfg[0].api_url) apiRow = userCfg[0];
        }
        if (!apiRow) continue;
        const { api_url, token } = apiRow;

        // 4. 执行刷新：在「开始」时写入时间戳并占用 robot，使间隔按「相邻两次开始」计算（不把任务耗时算进间隔）
        const nowTs = Date.now();
        lastRefreshMap.set(settingKey, nowTs);
        for (const r of rows) {
          if (r.setting_key.endsWith(`_${robotId}`)) lastRefreshMap.set(r.setting_key, nowTs);
        }
        refreshedRobots.add(robotId);

        console.log(`${JOB_TAG} 触发刷新 key=${settingKey} robot=${robotId}`);
        const refreshResult = await doRefresh(robotId, acct.user_id, api_url, token, acct.device_id);

        // 5. 刷新完成后自动解析新增的朋友圈数据
        if (refreshResult.success && refreshResult.newCount > 0) {
          await autoParseNewMoments(robotId, acct.user_id, refreshResult.newCount + 100);
        }

      } catch (innerErr) {
        console.error(`${JOB_TAG} 处理设置 ${row.setting_key} 出错:`, innerErr.message);
      }
    }
  } catch (err) {
    console.error(`${JOB_TAG} 任务执行出错:`, err.message);
  } finally {
    running = false;
  }
}

module.exports = { autoRefreshMomentsJob, loadDistrictAliasMaps, loadPOIAliasMap, validateAndFixCommunity };
