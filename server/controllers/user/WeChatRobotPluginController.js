/**
 * 用户端-微信机器人插件控制器
 * 处理朋友圈解析、房源分享等功能
 */
const ParsedProperty = require('../../models/ParsedProperty');
const WeChatRobotMoment = require('../../models/WeChatRobotMoment');
const PropertySettings = require('../../models/PropertySettings');
const SystemSetting = require('../../models/SystemSetting');
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const axios = require('axios');
const ContentMatchValidator = require('../../services/ContentMatchValidator');
const crypto = require('crypto');
const { buildPublishFilter, buildListedPropertyFilter } = require('../../utils/publishFilter');
const { pickFirstNonVideoMediaUrl } = require('../../utils/snsXmlMediaParser');
const {
  RETENTION_DATE_CONDITION,
  RETENTION_DATE_CONDITION_P,
  RETENTION_DATE_CONDITION_PP,
  MOMENT_RETENTION_CONDITION,
  CUTOFF_SQL,
} = require('../../services/MomentRetentionService');

const MAX_RENT_PRICE = 500000;
const LIST_RETENTION_DATE_CONDITION_P = `p.list_publish_time >= ${CUTOFF_SQL}`;
const LIST_RETENTION_DATE_CONDITION = `list_publish_time >= ${CUTOFF_SQL}`;
const PUBLISHER_CONTACT_TABLE = 'publisher_contact_directory';
const DEFAULT_AI_PARSE_HTTP_TIMEOUT_MS = 15000;
const DEFAULT_PARSED_MAP_MAX_PROPERTIES = 10000;
const AI_PARSE_TIMEOUT_MIN_MS = 5000;
const AI_PARSE_TIMEOUT_MAX_MS = 60000;
const AI_PARSE_TIMEOUT_CACHE_TTL_MS = 60000;
let cachedAIParseTimeoutMs = DEFAULT_AI_PARSE_HTTP_TIMEOUT_MS;
let cachedAIParseTimeoutLoadedAt = 0;
const runningManualParseTasks = new Set();

function getParsedMapMaxProperties() {
  const configured = parseInt(process.env.PARSED_MAP_MAX_PROPERTIES || '', 10);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(Math.max(configured, 1000), 50000);
  }
  return DEFAULT_PARSED_MAP_MAX_PROPERTIES;
}

function runDetachedManualParseTask(taskKey, taskFn) {
  if (runningManualParseTasks.has(taskKey)) return false;
  runningManualParseTasks.add(taskKey);
  setImmediate(async () => {
    try {
      await taskFn();
    } catch (err) {
      logger.error('朋友圈后台解析任务失败', {
        taskKey,
        error: err.message,
        stack: err.stack,
      });
    } finally {
      runningManualParseTasks.delete(taskKey);
    }
  });
  return true;
}

function buildMomentParseContent(row) {
  if (!row) return '';
  let parseContent = row.original_content || '';
  if (row.favorites_content) {
    const fav = row.favorites_content;
    if (!parseContent || parseContent.includes('CDATA') || fav.length > parseContent.length) {
      parseContent = fav;
    } else if (!parseContent.includes(fav.substring(0, Math.min(20, fav.length)))) {
      parseContent = `${parseContent}\n${fav}`;
    }
  }
  return parseContent;
}


async function getAIParseHttpTimeoutMs() {
  const now = Date.now();
  if ((now - cachedAIParseTimeoutLoadedAt) < AI_PARSE_TIMEOUT_CACHE_TTL_MS) {
    return cachedAIParseTimeoutMs;
  }
  try {
    const raw = await SystemSetting.get('ai_parse_http_timeout_ms', String(DEFAULT_AI_PARSE_HTTP_TIMEOUT_MS));
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      cachedAIParseTimeoutMs = Math.max(AI_PARSE_TIMEOUT_MIN_MS, Math.min(AI_PARSE_TIMEOUT_MAX_MS, parsed));
    }
  } catch (_) {}
  cachedAIParseTimeoutLoadedAt = now;
  return cachedAIParseTimeoutMs;
}

async function ensurePublisherContactTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS ${PUBLISHER_CONTACT_TABLE} (
      id BIGINT NOT NULL AUTO_INCREMENT,
      publisher_name VARCHAR(120) NOT NULL,
      contact_info VARCHAR(255) NULL,
      remark VARCHAR(255) NULL,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_publisher_name (publisher_name),
      KEY idx_enabled_name (is_enabled, publisher_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
}

function buildPublisherDisplaySql() {
  return "COALESCE(NULLIF(TRIM(p.publisher_name), ''), NULLIF(TRIM(m.owner_nickname), ''), NULLIF(TRIM(m2.owner_nickname), ''))";
}

function buildPublisherMatchSql(alias = 'pc') {
  return `CONVERT(${alias}.publisher_name USING utf8mb4) COLLATE utf8mb4_unicode_ci = (${buildPublisherDisplaySql()}) COLLATE utf8mb4_unicode_ci`;
}

function extractContactFromPublisherName(publisherName) {
  const text = String(publisherName || '').trim();
  if (!text) return '';
  const phoneMatch = text.match(/1[3-9]\d{9}/);
  if (phoneMatch) return phoneMatch[0];
  return '';
}

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

async function upsertPublisherContact(publisherName, contactInfo) {
  const normalizedPublisher = String(publisherName || '').trim();
  const normalizedContact = String(contactInfo || '').trim() || extractContactFromPublisherName(normalizedPublisher);
  if (!normalizedPublisher) return;
  await ensurePublisherContactTable();
  await query(
    `INSERT INTO ${PUBLISHER_CONTACT_TABLE} (publisher_name, contact_info, remark, is_enabled, created_at, updated_at)
     VALUES (?, ?, NULL, 1, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       contact_info = CASE
         WHEN VALUES(contact_info) IS NULL OR VALUES(contact_info) = '' THEN ${PUBLISHER_CONTACT_TABLE}.contact_info
         WHEN ${PUBLISHER_CONTACT_TABLE}.contact_info IS NULL OR ${PUBLISHER_CONTACT_TABLE}.contact_info = '' THEN VALUES(contact_info)
         WHEN ${PUBLISHER_CONTACT_TABLE}.remark IS NULL OR ${PUBLISHER_CONTACT_TABLE}.remark = '' THEN VALUES(contact_info)
         ELSE ${PUBLISHER_CONTACT_TABLE}.contact_info
       END,
       remark = CASE
         WHEN ${PUBLISHER_CONTACT_TABLE}.remark IS NULL OR ${PUBLISHER_CONTACT_TABLE}.remark = '' THEN NULL
         ELSE ${PUBLISHER_CONTACT_TABLE}.remark
       END,
       is_enabled = 1,
       updated_at = NOW()`,
    [normalizedPublisher, normalizedContact]
  );
}

async function syncPublisherContactByParsedId(propId) {
  if (!propId) return;
  await ensurePublisherContactTable();
  const publisherSql = buildPublisherDisplaySql();
  const rows = await query(
    `SELECT ${publisherSql} AS publisher_name, NULLIF(TRIM(p.contact_info), '') AS contact_info
     FROM wechat_robot_expat_parsed_properties p
     LEFT JOIN wechat_robot_expat_properties op ON p.property_id = op.id
     LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
     LEFT JOIN wechat_robot_moments m2 ON op.moment_id = m2.moment_id AND p.moment_id IS NULL
     WHERE p.id = ? AND p.deleted_at IS NULL
     LIMIT 1`,
    [propId]
  );
  const row = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0][0] : (Array.isArray(rows) ? rows[0] : rows);
  if (!row) return;
  await upsertPublisherContact(row.publisher_name, row.contact_info);
}
const DUPLEX_REGEX = /复式|复试|[Ll][Oo][Ff][Tt]|跃层|错层|楼中楼/;

function hasImplicitElevatorCommunity(name) {
  return /大楼|大厦/.test(String(name || '').trim());
}

function getDuplexFilterSql(alias = 'p') {
  return `(${alias}.is_duplex = 1 OR ${alias}.original_content REGEXP '复式|复试|[Ll][Oo][Ff][Tt]|跃层|错层|楼中楼')`;
}

/**
 * 根据原文内容生成去重哈希（MD5），用于标识相同文案
 * 先对文本做标准化处理（去空白、标点、转小写），再取MD5
 */
function generateContentHash(content) {
  if (!content) return null;
  const normalized = String(content)
    .replace(/\\n/g, '\n')
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：""''（）【】《》\-\—\~\·]/g, '')
    .toLowerCase()
    .trim();
  if (!normalized || normalized.length < 5) return null;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * 判断朋友圈文案是否为房源相关内容
 * 通过关键词检测，过滤非房源文案（如生活分享、视频、广告等）
 * @returns {boolean} true=可能是房源, false=非房源
 */
function isPropertyRelatedContent(content) {
  if (!content) return false;
  const text = String(content).trim();
  if (text.length < 4) return false;

  // 去除emoji和特殊字符后检查纯文本长度，太短的大概率是推广/广告
  const plainText = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200B}-\u{200D}\u{2028}\u{2029}\[\]【】\s]/gu, '');
  if (plainText.length < 10) return false;

  // 排除纯推广/引流内容（如"扫码查看更多房源"、"关注朋友圈"等，虽含房源关键词但非实际房源信息）
  const PROMO_PATTERNS = /^[^a-zA-Z\u4e00-\u9fa5]*(?:扫码查看|关注朋友圈|更多房源请|已收定金|除甲醛|办理人户分离|办理居住证|上舍出品|分界线)[^a-zA-Z\u4e00-\u9fa5]*$/;
  if (PROMO_PATTERNS.test(plainText)) return false;
  // 短文案仅含推广性房源关键词但无具体房源信息（无价格、无户型、无地址）
  if (plainText.length < 30) {
    const hasConcreteInfo = /\d{4,}|[室厅卫]|\d+[kKwW]|[路弄号]|平[米方]|㎡/.test(text);
    if (!hasConcreteInfo) return false;
  }

  // 排除明显非房源内容：仅当同时不含任何房产信号时才排除
  const EXCLUDE_PATTERNS = /跑步路线|km训练|马拉松|配速\d|健身打卡|减脂打卡|打卡\d+天|旅行攻略|游记分享|菜谱|食谱|面试经验|简历投递|应聘岗位|婚礼筹备|婚纱照|产学研融合|正式内测|卡级服|警世通言|有感\s/;
  const HAS_PROPERTY_SIGNAL = /出租|转租|整租|合租|直租|租金|月租|[看带]房|元\/月|\/月|[0-9]+[kKwW]|[室厅卫房]|平[米方]|㎡|公寓|花园|大厦|小区|弄|号线|地铁|万[\/元]|售|预租|bedroom|sqm/i;
  if (EXCLUDE_PATTERNS.test(text) && !HAS_PROPERTY_SIGNAL.test(text)) return false;

  const lowerText = text.toLowerCase();

  // 将Unicode装饰数字归一化为ASCII数字用于匹配
  const normalizedText = text
    .replace(/[𝟎𝟬𝟢𝟶０]/g, '0').replace(/[𝟏𝟭𝟣𝟷１]/g, '1')
    .replace(/[𝟐𝟮𝟤𝟸２❷]/g, '2').replace(/[𝟑𝟯𝟥𝟹３]/g, '3')
    .replace(/[𝟒𝟰𝟦𝟺４]/g, '4').replace(/[𝟓𝟱𝟧𝟻５]/g, '5')
    .replace(/[𝟔𝟲𝟨𝟼６]/g, '6').replace(/[𝟕𝟳𝟩𝟽７]/g, '7')
    .replace(/[𝟖𝟴𝟪𝟾８]/g, '8').replace(/[𝟗𝟵𝟫𝟿９]/g, '9')
    .replace(/[⓪⓿🄀]/g, '0').replace(/[①❶⓵1️⃣]/g, '1')
    .replace(/[②❷⓶2️⃣]/g, '2').replace(/[③❸⓷3️⃣]/g, '3')
    .replace(/[④❹⓸4️⃣]/g, '4').replace(/[⑤❺⓹5️⃣]/g, '5')
    .replace(/[⑥❻⓺6️⃣]/g, '6').replace(/[⑦❼⓻7️⃣]/g, '7')
    .replace(/[⑧❽⓼8️⃣]/g, '8').replace(/[⑨❾⓽9️⃣]/g, '9');

  // 强特征关键词（单个出现即高度相关）
  const STRONG_KEYWORDS = [
    '出租', '转租', '整租', '合租', '直租', '租金', '月租', '付佣', '免佣',
    '看房', '带看', '随时看', '密码房', '密码锁',
    '出售', '售价', '在售', '在租', '已租', '已售', '收房', '急售', '急租', '急卖',
    '预租', '预定', '接受预定',
    '元/月', 'K/月', '/月', '元／月', '元/🈷',
    '精装', '豪装', '简装', '毛坯', '全屋定制',
    '朝南', '朝北', '南北通', '三面采光', '采光足',
    '钥匙', '拎包入住', '空看', '可看',
    '床位', '主卧', '次卧', '隔断', '大开间',
    '联排', '独栋', '叠加别墅', '跃层', '排屋', '大平层',
    '业主直租', '房东直租', '业主诚售', '房东诚意', '诚意出售',
    '房源', '招租', '长租', '短租',
    '江景', '河景', '湖景', '海景',
    '商铺', '写字楼', '办公室', '工作室', '沿街商业', '创意办公',
    '宿舍', '酒店式',
    '降价', '抄底',
    '旺铺', '店铺转让',
    '景观房', '景观三房', '景观两房',
    '复式大宅', '高区', '低区', '中区',
    '单间', '开间', '独立厨卫',
    '翻新', '全新装修',
    '租掉', '租客',
    '合同价', '到手价',
  ];
  for (const kw of STRONG_KEYWORDS) {
    if (lowerText.includes(kw.toLowerCase())) return true;
  }

  // 英文强关键词（不依赖\b因为中英文混排中word boundary不可靠）
  if (/(?:bed(?:room)?s?|bath(?:room)?s?|apartment|studio|rent(?:al)?|lane\s*house|sqm|balcony|for\s+rent|furnished|unfurnished)(?:\s|$|[,.])/i.test(text)) return true;
  if (/(?:^|\s|\d)(?:bed(?:room)?s?|bath(?:room)?s?|apartment|studio|rent(?:al)?|sqm)/i.test(text)) return true;
  // 英文缩写 br/lr
  if (/\d\s*(?:br|lr)(?:\s|$|,)/i.test(text)) return true;
  // 英文价格 Rmb/RMB
  if (/(?:rmb|RMB)\s*[\d,.]+/i.test(text)) return true;

  // "小区：XXX" 或 "【小区】：XXX" 等标签格式
  if (/(?:小区|物业名称|楼盘)[：:]\s*\S+/.test(text)) return true;
  if (/【小区】/.test(text)) return true;
  // "地址：XX路XX号" 格式
  if (/(?:地址|【地址】)[：:]\s*\S+/.test(text)) return true;

  // 弱特征关键词（需组合才有意义）
  const WEAK_KEYWORDS = [
    '室', '厅', '卫', '平方', '平米', '㎡',
    '楼', '电梯', '复式', 'loft',
    '小区', '公寓', '花园', '大厦', '新村', '别墅', '洋房',
    '号线', '地铁', '近地铁',
    '阳台', '露台', '车位', '地暖', '中央空调',
    '弄', '报价',
    '步梯', '燃气', '独卫',
  ];
  let weakCount = 0;
  for (const kw of WEAK_KEYWORDS) {
    if (lowerText.includes(kw.toLowerCase())) {
      weakCount++;
      if (weakCount >= 2) return true;
    }
  }

  // 小区后缀词表
  const COMMUNITY_SUFFIX_RE = /(?:公寓|花园|新村|大厦|别墅|小区|新苑|广场|华庭|雅苑|城邦|河滨|邸|府|苑|园|坊|阁|庐|里|邨|庄|居|庭|城|轩|台|湾|堡|宫|府邸|豪庭|半岛|壹号|一号|天地|天下|中心|新城|家园|人家|世家|佳苑|嘉苑|豪园|豪景|名邸|华府|雅居|名苑)/;
  const CN_NUMS = '[一二三四五六七八九两兩]';
  const hasLayout = new RegExp(`(?:\\d|${CN_NUMS})\\s*[房室]`).test(text) || new RegExp(`(?:\\d|${CN_NUMS})\\s*[房室]`).test(normalizedText);

  // 价格模式检测（含 w/W 代替万）
  const hasRentPrice = /\d{3,6}\s*(?:元|\/月|每月)|￥\s*\d{3,}|\d+\.?\d*\s*[kK]/.test(text) || /\d+\.?\d*\s*[kK]/.test(normalizedText);
  const hasSalePrice = /\d+\.?\d*\s*[万wW]/.test(text);
  const hasShortPrice = /\d{4,6}/.test(text) || /\d{4,6}/.test(normalizedText);
  const hasAnyPrice = hasRentPrice || hasSalePrice || hasShortPrice;

  // 价格 + 弱关键词
  if ((hasRentPrice || hasSalePrice) && weakCount >= 1) return true;

  // 户型匹配
  if (hasLayout && new RegExp(`(?:\\d|${CN_NUMS})\\s*[厅卫]`).test(text)) return true;
  if (hasLayout && hasAnyPrice) return true;
  if (hasLayout && weakCount >= 1) return true;

  // 面积模式（含Unicode数字归一化后的检测）
  const hasArea = /\d{2,3}\.?\d*\s*(?:平|㎡|平方|平米|m²|m2)/.test(text) || /\d{2,3}\.?\d*\s*(?:平|㎡|平方|平米|m²|m2)/.test(normalizedText);
  if (hasArea && (weakCount >= 1 || hasAnyPrice || COMMUNITY_SUFFIX_RE.test(text))) return true;
  if (hasArea && hasLayout) return true;

  // X/Y/Z户型格式
  if (/\d\s*[/／]\s*\d\s*[/／]\s*\d/.test(text) && weakCount >= 1) return true;

  // 小区后缀 + 任何价格信号
  if (hasAnyPrice && COMMUNITY_SUFFIX_RE.test(text)) return true;

  // 小区后缀 + 户型
  if (hasLayout && COMMUNITY_SUFFIX_RE.test(text)) return true;

  // 地址模式 (X路/弄/号) + 面积或价格
  if (/\d+(?:弄|号|楼|层)/.test(text) && (hasArea || hasAnyPrice)) return true;

  // 包含地址 + 小区后缀（如"嘉善路257号 嘉善公寓"）
  if (/(?:路|街|道)\d*/.test(text) && COMMUNITY_SUFFIX_RE.test(text) && text.length < 200) return true;

  // 纯小区名文案（短文本 + 小区后缀 + 户型/面积关键词）
  if (COMMUNITY_SUFFIX_RE.test(text) && (hasLayout || hasArea || /改\s*[三四五]/.test(text))) return true;

  // "X房分界线" 等分隔线标记
  if (/\d\s*房.*分界/.test(text) || /分界.*\d\s*房/.test(text)) return true;
  if (/[-—=]{3,}.*[房室].*[-—=]{3,}/.test(text)) return true;

  // 纯小区名短文案（含后缀词，文本较短且无明显非房产内容）
  if (text.length <= 100 && COMMUNITY_SUFFIX_RE.test(text)) return true;

  // "车位" 单独出现 + 小区后缀
  if (/车位/.test(text) && COMMUNITY_SUFFIX_RE.test(text)) return true;

  // normalizedText 上重新检测户型+价格组合
  if (/\d\s*[房室]/.test(normalizedText) && hasAnyPrice) return true;

  // 短文案含户型（如"九庐一房"、"三房景观"等）
  if (hasLayout && text.length <= 100) return true;

  // 地址+门牌号模式（如"陆家嘴 江临天下7-3104"）
  if (/\d+-\d+/.test(text) && COMMUNITY_SUFFIX_RE.test(text)) return true;
  if (/\d+号\d+/.test(text) && text.length <= 100) return true;

  // 包含"村"后缀的小区 + 面积/价格
  if (/[一二三四五六七八九\d]村/.test(text) && (hasArea || hasAnyPrice)) return true;

  return false;
}

/**
 * 规则先行解析引擎：从原文中用正则+规则提取所有可结构化的房源信息
 * 在AI之前执行，提取结果作为基础数据
 */
function ruleBasedFullParse(content) {
  if (!content) return {};
  const text = String(content);
  const data = {};

  // === 1. 价格解析 ===
  const pricePatterns = [
    { re: /(?:价格|报价|租金|合同价|月租金?)[：:￥¥\s]*(\d{1,3}(?:[,.]\d{1,2})?)\s*[Kk]/i, mul: 1000 },
    { re: /(?:价格|报价|租金|合同价|月租金?)[：:￥¥\s]*([\d,]+)\s*(?:元)?(?:\/月|每月)?/i, mul: 1 },
    { re: /([\d,.]+)\s*万\s*(?:\/月|每月|元\/月)/i, mul: 10000 },
    { re: /([\d,.]+)\s*[Kk]\s*(?:\/月|\/mo|每月)?/i, mul: 1000 },
    { re: /(?:月租|月租金)[：:\s]*([\d,]+)/i, mul: 1 },
    { re: /(\d{4,6})\s*(?:元\/月|\/月)/i, mul: 1 },
    { re: /(\d{4,6})\s*(?:(?:元|人民币)?\s*)?(?:(?:转租|出租|整租|直租|业主直租|房东直租)[\s,，、。；;]*)?(?:付佣金|付佣|佣金|无佣金|无佣|包物业|含物业|可谈|看房)/i, mul: 1 },
    { re: /￥\s*(\d{4,6})/i, mul: 1 },
    { re: /(\d{4,6})\s*元(?!\/)/i, mul: 1 },
  ];
  for (const { re, mul } of pricePatterns) {
    const m = text.match(re);
    if (m) {
      const val = Math.round(parseFloat(m[1].replace(/,/g, '')) * mul);
      if (val >= 1000 && val <= MAX_RENT_PRICE) {
        data.price_value = val;
        data.price = m[0].trim();
        break;
      }
    }
  }

  // === 2. 户型解析（增强版：支持中文数字、英文、多种格式） ===
  const CN_NUM = { 一: 1, 两: 2, 兩: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  // XYZ格式(1/2/1)需排除地铁上下文：如果X/Y/Z前有"地铁"则不作为户型
  let xyzLayout = parseLayoutXYZ(text);
  if (xyzLayout) {
    const SEP = '[/／|｜]';
    const xyzRe = new RegExp(`(\\d)\\s*${SEP}\\s*(\\d)\\s*${SEP}\\s*(\\d)`);
    const xyzM = text.match(xyzRe);
    if (xyzM) {
      const before = text.substring(Math.max(0, xyzM.index - 10), xyzM.index);
      if (/地铁|metro|Metro|号线/i.test(before)) {
        xyzLayout = null;
      }
    }
  }
  if (xyzLayout) {
    data.bedrooms = xyzLayout.bedrooms;
    data.livingrooms = xyzLayout.livingrooms;
    data.bathrooms = xyzLayout.bathrooms;
  } else {
    // 优先匹配完整户型描述 "X房Y厅Z卫" / "X室Y厅Z卫" (含中文数字，排除门牌号)
    const fullLayoutCN = text.match(/(?<!\d)([一两兩二三四五六七八九\d])\s*[房室]\s*([一两兩二三四五六七八九\d])?\s*厅\s*([一两兩二三四五六七八九\d])?\s*卫/);
    if (fullLayoutCN) {
      data.bedrooms = parseInt(fullLayoutCN[1], 10) || CN_NUM[fullLayoutCN[1]] || null;
      data.livingrooms = fullLayoutCN[2] ? (parseInt(fullLayoutCN[2], 10) || CN_NUM[fullLayoutCN[2]]) : null;
      data.bathrooms = fullLayoutCN[3] ? (parseInt(fullLayoutCN[3], 10) || CN_NUM[fullLayoutCN[3]]) : 1;
    } else {
      // 简化户型匹配 "X室Y厅" / "X房Y厅" (不含卫，排除门牌号)
      const simpleLayoutCN = text.match(/(?<!\d)([一两兩二三四五六七八九\d])\s*[房室]\s*([一两兩二三四五六七八九\d])\s*厅/);
      if (simpleLayoutCN) {
        data.bedrooms = parseInt(simpleLayoutCN[1], 10) || CN_NUM[simpleLayoutCN[1]] || null;
        data.livingrooms = parseInt(simpleLayoutCN[2], 10) || CN_NUM[simpleLayoutCN[2]] || null;
        data.bathrooms = 1;
      } else {
        const br = parseBedroomCount(null, text);
        if (br && br >= 1 && br <= 9) data.bedrooms = br;
        // "X室" / "X房" 纯数字 — 排除门牌号如 "705室"、"302室"
        if (!data.bedrooms) {
          const numRoomMatch = text.match(/(?<!\d)(\d)\s*[室房](?!东|源|租|客|型|间)/);
          if (numRoomMatch) data.bedrooms = parseInt(numRoomMatch[1], 10);
        }
        // 英文卧室数: Xbedroom / X bed / X BR
        if (!data.bedrooms) {
          const enBrMatch = text.match(/(\d)\s*(?:bedroom|bed\b|BR\b)/i);
          if (enBrMatch) data.bedrooms = parseInt(enBrMatch[1], 10);
        }
        // 中文卧室数: "三房"/"两房"/"两卧"
        if (!data.bedrooms) {
          const cnBrMatch = text.match(/([一两兩二三四五六七八九])\s*[房室卧臥居]/);
          if (cnBrMatch) data.bedrooms = CN_NUM[cnBrMatch[1]] || null;
        }
      }
      const bt = parseBathroomCount(null, text);
      if (bt != null && bt >= 0 && bt <= 9) data.bathrooms = bt;
      if (data.bathrooms == null) {
        const cnBtMatch = text.match(/([一两兩二三四五六七八九])\s*卫/);
        if (cnBtMatch) data.bathrooms = CN_NUM[cnBtMatch[1]] || 1;
      }
      if (data.livingrooms == null) {
        const lrMatch = text.match(/([一两兩二三四五六七八九\d])\s*厅/);
        if (lrMatch) data.livingrooms = parseInt(lrMatch[1], 10) || CN_NUM[lrMatch[1]] || null;
      }
    }
  }

  // === 3. 面积解析（支持小数点面积如 123.45㎡） ===
  const areaPatterns = [
    /(?:面积|建面|套内|使用面积|实际)[：:约\s]*(\d{2,4}(?:\.\d{1,2})?)\s*(?:平|㎡|平方|平米|m²|m2)/i,
    /(\d{2,4}(?:\.\d{1,2})?)\s*(?:平米|平方米|平方|㎡|m²|m2|sqm)/i,
    /(\d{2,4}(?:\.\d{1,2})?)\s*平(?!米|方|台|花)/,
    /(?:面积|建面)[：:约\s]*(\d{2,4}(?:\.\d{1,2})?)(?:\s|,|，|$)/,
  ];
  for (const pat of areaPatterns) {
    const m = text.match(pat);
    if (m) {
      const area = parseFloat(m[1]);
      if (area >= 10 && area <= 2000) {
        data.area_sqm = area;
        break;
      }
    }
  }

  // === 4. 区域解析 ===
  const districtMap = {
    黄浦: '黄浦区', 徐汇: '徐汇区', 长宁: '长宁区', 静安: '静安区',
    普陀: '普陀区', 虹口: '虹口区', 杨浦: '杨浦区', 闵行: '闵行区',
    宝山: '宝山区', 嘉定: '嘉定区', 浦东: '浦东新区', 金山: '金山区',
    松江: '松江区', 青浦: '青浦区', 奉贤: '奉贤区', 崇明: '崇明区',
  };
  const distMatch = text.match(/(黄浦|徐汇|长宁|静安|普陀|虹口|杨浦|闵行|宝山|嘉定|浦东|金山|松江|青浦|奉贤|崇明)\s*(?:区|新区)?/);
  if (distMatch) {
    data.district = districtMap[distMatch[1]] || distMatch[0];
  }

  // === 5. 地铁解析（增强版） ===
  const metroLines = new Set();
  const metroStations = new Set();

  // 地铁线路提取
  const linePatterns = [
    /(?:地铁|Metro|metro)\s*(\d{1,2})\s*[/／、,，]\s*(\d{1,2})(?:\s*[/／、,，]\s*(\d{1,2}))?(?:\s*[/／、,，]\s*(\d{1,2}))?/g,
    /(\d{1,2})\s*[/／、,，]\s*(\d{1,2})(?:\s*[/／、,，]\s*(\d{1,2}))?(?:\s*[/／、,，]\s*(\d{1,2}))?\s*号线/g,
    /(\d{1,2})\s*号线/g,
    /[Ll]ine\s*(\d{1,2})/g,
    // 支持"10号、13号"、"X号Y号"格式
    /(\d{1,2})\s*号[、,，\s]+(\d{1,2})\s*号(?:[、,，\s]+(\d{1,2})\s*号)?/g,
  ];
  for (const pat of linePatterns) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(text)) !== null) {
      for (let i = 1; i < m.length; i++) {
        if (m[i]) {
          const num = parseInt(m[i], 10);
          if (num >= 1 && num <= 20) metroLines.add(`${num}号线`);
        }
      }
    }
  }

  // 地铁站名提取 - 通用清理函数
  const STATION_BLOCKLIST = /^(号线|地铁|出口|方向|步行|分钟|出发|到达|换乘|公交|公里|左右|以内|附近|米内|站台|智能|烤箱|洗衣|烘干|马桶|品牌|楼梯|电梯|室内|室外|厨房|卧室|卫生|浴室|客厅|阳台|花园|朝南|朝北|精装|简装|毛坯|可办|条件|价格|报价|看房|联系|密码|随时|到期|挂牌|独家|一手|工作|居家|描述|地址|介绍|面积|户型)$/;
  const cleanStationName = (raw) => {
    if (!raw) return null;
    let s = String(raw).trim();
    s = s.replace(/^(号线|地铁站?|站)/, '');
    s = s.replace(/(地铁站?|站|地铁)$/, '');
    s = s.trim();
    if (s.length < 2 || s.length > 6) return null;
    if (STATION_BLOCKLIST.test(s)) return null;
    if (!/[\u4e00-\u9fa5]{2,}/.test(s)) return null;
    // 不能是纯"XX路"（街道名不是地铁站名——江苏路例外因为它确实是地铁站名）
    return s;
  };

  // 注意：站名与"地铁"之间不允许跨行（用[^\S\n]*代替\s*），避免换行导致误匹配
  const stationPatterns = [
    // "XXX地铁X/Y/Z" (如"中山公园地铁2/3/4")
    /([\u4e00-\u9fa5]{2,6})[^\S\n]*地铁[^\S\n]*\d{1,2}\s*[/／、,，]/g,
    // "江苏路地铁站" / "XXX地铁站"
    /([\u4e00-\u9fa5]{2,6})[^\S\n]*地铁站/g,
    // "XXX地铁，" / "XXX地铁 " (同一行内，地铁后面跟非中文)
    /([\u4e00-\u9fa5]{2,6})[^\S\n]*地铁(?=[,，\s]|$)/gm,
    // "X号线XXX站"
    /\d{1,2}[^\S\n]*号线[^\S\n]*([\u4e00-\u9fa5]{2,6})站/g,
    // "X号线XXX地铁站"
    /\d{1,2}[^\S\n]*号线[^\S\n]*([\u4e00-\u9fa5]{2,6})地铁站/g,
    // "近XXX站" / "靠近XXX地铁站"
    /(?:近|靠近|临近)[^\S\n]*(?:地铁)?[^\S\n]*([\u4e00-\u9fa5]{2,6})(?:站|地铁站)/g,
    // "地铁站XXX" (如"地铁站江苏路")
    /地铁站[^\S\n]*([\u4e00-\u9fa5]{2,6})/g,
    // 英文格式
    /[Nn]ear\s+(?:[Ll]ine\s+\d+[,\s]*)+\s*(\w[\w\s]{2,15}?)\s+[Ss]tation/g,
  ];
  for (const pat of stationPatterns) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(text)) !== null) {
      const stName = m[1];
      const cleaned = cleanStationName(stName);
      if (cleaned) metroStations.add(cleaned);
    }
  }

  if (metroLines.size > 0) data.metro_lines = [...metroLines].join(',');
  if (metroStations.size > 0) data.metro_stations = [...metroStations].join(',');

  // === 6. 小区名提取（规则版，用于后续POI匹配验证） ===
  data._rule_community = extractAddressFromContent(text);
  if (data._rule_community && /(?:路|街|道|大道).*(?:弄|号)|(?:弄|号)/.test(data._rule_community)) {
    data.street = data._rule_community;
  }

  // === 7. 其他字段 ===
  data.has_elevator = /有电梯|电梯房|带电梯|高层电梯/.test(text);
  data.has_parking = /有车位|含车位|送车位|带车位|停车位/.test(text);
  data.has_commission = /付佣|全佣|半佣|有佣|佣金|中介费|\[红包\]|🧧|💰/.test(text) && !/免佣|0佣|无佣/.test(text);
  data.is_duplex = DUPLEX_REGEX.test(text);
  if (hasImplicitElevatorCommunity(data._rule_community)) {
    data.has_elevator = true;
  }

  const outdoorFeatures = [];
  if (/阳台|南阳台|北阳台/.test(text)) outdoorFeatures.push('阳台');
  // Rule 5: 小区名带"花园"的禁止被识别成户外花园，仅匹配明确的户外花园语境
  const OUTDOOR_GARDEN_PHRASES = /带花园|有花园|私家花园|独立花园|赠花园|赠送花园|送花园|含花园|一楼花园|朝南花园|朝南带花园|大花园|小花园|花园\d+平|入户花园|前花园|后花园|自带花园|底楼花园/;
  if (OUTDOOR_GARDEN_PHRASES.test(text)) {
    outdoorFeatures.push('花园');
  }
  if (/露台|天台/.test(text)) outdoorFeatures.push('露台');
  if (/院子|庭院|天井/.test(text)) outdoorFeatures.push('院子');
  if (outdoorFeatures.length > 0) data.outdoor_features = outdoorFeatures.join(',');

  // === 8. 联系方式 ===
  const phoneMatch = text.match(/1[3-9]\d{9}/);
  if (phoneMatch) data.contact_info = phoneMatch[0];

  // === 9. Rule 6: 出售类型检测 ===
  const SALE_KEYWORDS = /出售|售价|急售|仅售|诚售|诚意出售|业主急卖|挂牌价|到手价|转让价|售卖|卖房|各付税|满五|满二唯一/;
  if (SALE_KEYWORDS.test(text)) {
    data._is_sale = true;
  }
  // 价格超50万也标记出售
  if (data.price_value && data.price_value > MAX_RENT_PRICE) {
    data._is_sale = true;
  }

  return data;
}

/**
 * POI优先匹配：在AI解析之前，直接从文案中匹配POI数据库的小区名
 * 这是确保小区名100%准确的核心方法
 * @param {string} content - 原文
 * @param {string|null} district - 已知区域（可为null）
 * @returns {Object|null} POI匹配结果
 */
async function matchPOIBeforeAI(content, district) {
  if (!content) return null;
  const text = String(content);
  if (text.length < 5) return null;

  // 不应被POI匹配的短名称（区名、地标、通用词等非小区名）
  const POI_SKIP_NAMES = new Set([
    '静安', '徐汇', '长宁', '普陀', '虹口', '杨浦', '黄浦', '浦东', '闵行', '宝山',
    '嘉定', '松江', '青浦', '奉贤', '金山', '崇明', '上海',
    '人民广场', '新天地', '陆家嘴', '外滩', '虹桥', '世纪公园',
    '徐家汇', '中山公园', '静安寺', '南京西路', '南京东路', '淮海路',
    '古北', '碧云', '田子坊', '豫园', '城隍庙', '五角场', '北外滩',
    '电梯房', '步梯房', '楼梯房', '品质小区', '精装修', '花园洋房',
    'OK', '其他', '稀缺', '类型',
  ]);

  try {
    // 标签优先：文案中有"小区:XXX"等明确标签时，直接用标签值查POI（避免商业配套等区域的长名误匹配）
    const LABEL_PATS = [
      /[?🏘🏠]?\s*小\s*区\s*[:：]\s*([\u4e00-\u9fa5A-Za-z0-9]{2,15})/,
      /[【\[]\s*小\s*区\s*[\]】]\s*[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9]{2,15})/,
      /小\s*区\s*名?\s*称?\s*[:：]\s*([\u4e00-\u9fa5A-Za-z0-9]{2,15})/,
    ];
    for (const lp of LABEL_PATS) {
      const lm = text.match(lp);
      if (lm && lm[1]) {
        const labelName = lm[1].trim();
        if (labelName.length >= 2 && !POI_SKIP_NAMES.has(labelName)) {
          const labelSql = `SELECT TRIM(community_name) as community_name, alias_names, district, nearest_metro_station, nearest_metro_line,
                            nearest_metro_distance, latitude, longitude, address
                            FROM property_community_dict
                            WHERE is_enabled = 1
                              AND (TRIM(community_name) = ? OR community_name = ? OR alias_names LIKE ?)
                            LIMIT 30`;
          const labelRows = await query(labelSql, [labelName, labelName, `%${labelName}%`]);
          const lr = Array.isArray(labelRows) && Array.isArray(labelRows[0]) ? labelRows[0] : labelRows;
          if (lr && lr.length > 0) {
            const exact = lr.find((row) => row.community_name === labelName || hasExactPOIAlias(row.alias_names, labelName));
            if (exact) return exact;
          }
        }
      }
    }

    let poiSql = `SELECT TRIM(community_name) as community_name, alias_names, district, nearest_metro_station, nearest_metro_line, 
                   nearest_metro_distance, latitude, longitude, address 
                   FROM property_community_dict 
                   WHERE is_enabled = 1 AND community_name IS NOT NULL AND CHAR_LENGTH(TRIM(community_name)) >= 2`;
    const poiParams = [];
    if (district) {
      poiSql += ' AND district = ?';
      poiParams.push(district);
    }
    poiSql += ' ORDER BY CHAR_LENGTH(TRIM(community_name)) DESC';

    const poiRows = await query(poiSql, poiParams);
    const rows = Array.isArray(poiRows) && Array.isArray(poiRows[0]) ? poiRows[0] : poiRows;
    if (!rows || rows.length === 0) {
      if (district) return matchPOIBeforeAI(content, null);
      return null;
    }

    // 2字小区名智能边界匹配：前后均需边界，防止匹配到复合词内部（如"翠湖"不应匹配"翠湖天地五期"，"嘉园"不应匹配"永丰嘉园"）
    function matchShortName(text, name) {
      if (name.length > 2) return text.includes(name);
      if (!text.includes(name)) return false;
      const BOUNDARY_TAIL = /[区省市县镇乡村弄号路街道的在是有于到从去为和与或及了吗呢也都还就边旁近靠临里处内外上下住租看叫做名找选对]$/;
      const BOUNDARY_HEAD = /^[的在是有于到从去为和与或及了吗呢也都还就不太很最出租售卖买房屋价格平米方厅卫室层楼带弄号后前东西南北边旁近靠临里处内外上下期栋幢|｜，,。！!？?\s\d\-—·•/\\()（）【】\[\]《》：:；;、🏠🏡🏘✨💛💰📍🌿🔥❤️💚🎈🏆]/;
      let sp = 0;
      while (sp < text.length) {
        const pos = text.indexOf(name, sp);
        if (pos === -1) break;
        sp = pos + 1;
        const endPos = pos + name.length;

        // 后边界检查：名称后面不能紧跟非功能性中文字符（否则是复合词的前缀部分）
        if (endPos < text.length) {
          const afterChar = text.charAt(endPos);
          if (/[\u4e00-\u9fa5]/.test(afterChar) && !BOUNDARY_HEAD.test(afterChar)) {
            continue;
          }
        }

        // 前边界检查：跳过路名
        if (endPos < text.length && /^(路|街|大道)/.test(text.substring(endPos, Math.min(text.length, endPos + 2)))) continue;

        let chCnt = 0;
        for (let i = pos - 1; i >= 0 && i >= pos - 4; i--) {
          if (/[\u4e00-\u9fa5]/.test(text.charAt(i))) chCnt++; else break;
        }
        if (chCnt === 0) return true;
        if (BOUNDARY_TAIL.test(text.substring(Math.max(0, pos - chCnt), pos))) return true;
      }
      return false;
    }

    // 精确匹配：按名称长度降序，优先匹配最长最精确的小区名
    for (const poi of rows) {
      if (POI_SKIP_NAMES.has(poi.community_name)) continue;
      if (matchShortName(text, poi.community_name)) {
        return poi;
      }
    }

    // 别名精确匹配
    for (const poi of rows) {
      if (POI_SKIP_NAMES.has(poi.community_name)) continue;
      const aliases = parsePOIAliasNames(poi.alias_names);
      for (const alias of aliases) {
        if (matchShortName(text, alias)) {
          return poi;
        }
      }
    }

    // 去后缀模糊匹配（如"裕德路66弄小区"→"裕德路66弄"在文案中匹配）
    const suffixes = ['小区', '公寓', '花苑', '家园', '花园', '苑', '城', '府', '庭', '坊', '里', '居'];
    for (const poi of rows) {
      if (POI_SKIP_NAMES.has(poi.community_name)) continue;
      const name = poi.community_name;
      for (const sfx of suffixes) {
        if (name.endsWith(sfx) && name.length > sfx.length + 2) {
          const shortName = name.slice(0, -sfx.length);
          if (shortName.length >= 3 && !POI_SKIP_NAMES.has(shortName) && text.includes(shortName)) {
            return poi;
          }
        }
      }
    }

    // 别名去后缀匹配
    for (const poi of rows) {
      if (POI_SKIP_NAMES.has(poi.community_name)) continue;
      const aliases = parsePOIAliasNames(poi.alias_names);
      for (const alias of aliases) {
        for (const sfx of suffixes) {
          if (alias.endsWith(sfx) && alias.length > sfx.length + 2) {
            const shortAlias = alias.slice(0, -sfx.length);
            if (shortAlias.length >= 3 && text.includes(shortAlias)) {
              return poi;
            }
          }
        }
      }
    }

    // 去方位/区域后缀匹配（如"静安丽舍南区"→去掉"南区"→"静安丽舍"匹配文案）
    const dirSuffixes = ['南区', '北区', '东区', '西区', '(南区)', '(北区)', '(东区)', '(西区)', '（南区）', '（北区）', '一期', '二期', '三期', '四期', '五期', 'A区', 'B区', 'C区'];
    for (const poi of rows) {
      if (POI_SKIP_NAMES.has(poi.community_name)) continue;
      const name = poi.community_name;
      for (const ds of dirSuffixes) {
        if (name.endsWith(ds) && name.length > ds.length + 2) {
          const baseName = name.slice(0, -ds.length);
          if (baseName.length >= 3 && text.includes(baseName)) {
            return poi;
          }
        }
      }
    }

    if (district) return matchPOIBeforeAI(content, null);
    return null;
  } catch (e) {
    logger.warn('matchPOIBeforeAI异常', { error: e.message });
    return null;
  }
}

/**
 * 调用AI模型解析朋友圈文案（使用 system + user 双消息格式，与PHP一致）
 * 包含重试机制：首次失败后会以更强的JSON指令重试一次
 */
function extractAIResponseText(data) {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? choice?.delta?.content ?? choice?.text;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((item) => item?.text || item?.content || '').join('').trim();
  }
  if (typeof data?.output_text === 'string') return data.output_text.trim();
  if (Array.isArray(data?.output)) {
    return data.output
      .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
      .map((item) => item?.text || '')
      .join('')
      .trim();
  }
  return '';
}

function readStreamText(stream) {
  return new Promise((resolve, reject) => {
    let text = '';
    stream.on('data', (chunk) => {
      const lines = String(chunk).split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.replace(/^data:\s*/, '');
        if (payload === '[DONE]') continue;
        try {
          const data = JSON.parse(payload);
          text += data?.choices?.[0]?.delta?.content || data?.choices?.[0]?.message?.content || '';
        } catch {}
      }
    });
    stream.on('end', () => resolve(text.trim()));
    stream.on('error', reject);
  });
}

async function callAIParse(aiModel, promptTemplate, content, retryCount = 0) {
  const requestTimeoutMs = await getAIParseHttpTimeoutMs();
  const systemPrompt = promptTemplate.replace(/\{CONTENT\}/g, '').trim();
  const maxTokens = parseInt(aiModel.max_tokens, 10) || 3000;
  const temperature = parseFloat(aiModel.temperature) || 0.1;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${aiModel.api_key}`,
  };
  if (aiModel.api_headers) {
    try {
      const custom = typeof aiModel.api_headers === 'string' ? JSON.parse(aiModel.api_headers) : aiModel.api_headers;
      Object.assign(headers, custom);
    } catch {}
  }

  const requestBody = {
    model: aiModel.model_code || aiModel.model_name,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `房源描述：\n${content}` },
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  };

  let aiText = '';
  try {
    const response = await axios.post(
      aiModel.api_url,
      requestBody,
      { headers, timeout: requestTimeoutMs }
    );
    aiText = extractAIResponseText(response.data);
  } catch (e) {
    const errMsg = e.response?.data?.error?.message || e.message || '';
    if (/only support stream mode|enable the stream/i.test(errMsg) && retryCount < 1) {
      const response = await axios.post(
        aiModel.api_url,
        { ...requestBody, stream: true },
        { headers, timeout: requestTimeoutMs, responseType: 'stream' }
      );
      aiText = await readStreamText(response.data);
    } else {
      throw e;
    }
  }
  if (!aiText) {
    logger.warn('AI返回内容为空', { model: aiModel.model_code });
    return null;
  }
  const jsonMatch = aiText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    if (retryCount < 1) {
      logger.warn('AI首次未返回JSON，正在重试', { aiText: aiText.substring(0, 200) });
      return callAIParse(aiModel, promptTemplate, content, retryCount + 1);
    }
    logger.warn('AI返回无法解析为JSON', { aiText: aiText.substring(0, 200) });
    return null;
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    if (retryCount < 1) {
      logger.warn('AI返回JSON解析失败，正在重试', { error: e.message });
      return callAIParse(aiModel, promptTemplate, content, retryCount + 1);
    }
    logger.warn('AI返回JSON解析失败', { text: jsonMatch[0].substring(0, 200), error: e.message });
    return null;
  }
}

function parseBool(val) {
  if (val === true || val === 1 || val === '1' || val === 'true') return true;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    if (lower === '有' || lower === '是' || lower === 'yes' || lower === 'true') return true;
  }
  return false;
}

function parseBoolField(...vals) {
  for (const v of vals) {
    if (v && typeof v === 'string' && v.trim() && v.trim() !== 'null' && v.trim() !== '无' && v.trim() !== '-') {
      return v.trim();
    }
    if (v === true || v === 1 || v === '1' || v === 'true' || v === '有' || v === '是') {
      return '有';
    }
  }
  return '';
}

const CHINESE_LAYOUT_NUMBERS = {
  一: 1, 两: 2, 兩: 2, 二: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function parseChineseLayoutNumber(value) {
  return CHINESE_LAYOUT_NUMBERS[String(value || '').trim()] || null;
}

/**
 * 解析卧室数量：支持 N+N 格式（如 1+1房 = 2室, 2+1房 = 3室）
 * 优先从原文提取 X+Y房/室，因 AI 可能误解析为单独数字
 */
function parseBedroomCount(val, originalContent) {
  // 1) 优先从原文匹配 2+1房、1+1室、3+1衣帽间 等，避免 AI 误解析为 1
  // 支持普通+、全角＋、emoji➕ (U+2795)
  if (originalContent) {
    const text = normalizeLayoutInput(String(originalContent));
    const xyzLayout = parseLayoutXYZ(text);
    if (xyzLayout && xyzLayout.bedrooms >= 1 && xyzLayout.bedrooms <= 20) return xyzLayout.bedrooms;
    const PLUS = '[+＋➕]';
    const patterns = [
      new RegExp(`(\\d)\\s*${PLUS}\\s*(\\d)\\s*[房室居R]`, 'i'),
      new RegExp(`(\\d)\\s*${PLUS}\\s*(\\d)\\s*[房室][房室]?`, 'i'),
      /(\d{1,2})\s*个?\s*(?:卧室|房间|房|居)/i,
      // "3+1衣帽间" / "3+1储物间" / "3+1书房" 等，+后的1代表额外房间
      new RegExp(`(\\d)\\s*${PLUS}\\s*(\\d)\\s*(?:衣帽间|储物间|书房|保姆间|工人房|储藏室|多功能)`, 'i'),
      new RegExp(`[房型户型]\\s*[:：]?\\s*(\\d)\\s*${PLUS}\\s*(\\d)`),
      new RegExp(`(\\d)\\s*${PLUS}\\s*(\\d)(?:房|室|卧|${PLUS}|\\s|$)`, 'i'),
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const sum = parseInt(m[1], 10) + parseInt(m[2], 10);
        if (sum >= 1 && sum <= 20) return sum;
      }
    }
    const chineseBedroom = text.match(/([一两兩二三四五六七八九十])\s*个?\s*(?:卧室|臥室|房间|房間|房|室|卧|臥|居)/);
    if (chineseBedroom) return parseChineseLayoutNumber(chineseBedroom[1]);
    if (/(?:双|雙)\s*(?:卧室|臥室|卧房|臥房|卧|臥|房|室|居)/.test(text)) return 2;
  }
  // 2) 再检查 AI 返回值
  if (val != null) {
    const str = String(val).trim();
    const plusMatch = str.match(/^(\d)\s*[+＋➕]\s*(\d)$/);
    if (plusMatch) {
      return parseInt(plusMatch[1], 10) + parseInt(plusMatch[2], 10);
    }
    const num = parseInt(str, 10);
    if (num >= 1 && num <= 20) return num;
  }
  return null;
}

/**
 * 从原文解析户型 X/Y/Z 格式（X室Y厅Z卫）
 * 如 "1/2/1" → {bedrooms:1, livingrooms:2, bathrooms:1}
 * 支持分隔符：/ ／ | ｜
 * 排除地铁线路格式如 "2/3/4/13号线"（前后有更多分隔符/数字的序列）
 */
function parseLayoutXYZ(originalContent) {
  if (!originalContent) return null;
  const text = normalizeLayoutInput(String(originalContent));
  const SEP = '[/／|｜]';
  const PLUS = '[+＋➕]';
  const DASH = '[-—–－﹣]';

  // Match N+N|Y|Z layout first, e.g. 2+1/2/2 or 2+1｜2｜2
  const plusRe = new RegExp(`(\\d)\\s*${PLUS}\\s*(\\d)[^\\d\\n]{0,10}${SEP}\\s*(\\d)\\s*${SEP}\\s*(\\d)(?!\\s*${SEP})`);
  const pm = text.match(plusRe);
  if (pm) {
    const bedrooms = parseInt(pm[1], 10) + parseInt(pm[2], 10);
    const livingrooms = parseInt(pm[3], 10);
    const bathrooms = parseInt(pm[4], 10);
    if (bedrooms >= 1 && bedrooms <= 9 && livingrooms >= 0 && livingrooms <= 9 && bathrooms >= 0 && bathrooms <= 9) {
      return { bedrooms, livingrooms, bathrooms };
    }
  }

  // Match labeled dashed layout, e.g. 户型: 3-2-2
  const labeledDashRe = new RegExp(`(?:户型|房型|格局)\\s*[】\\]\\):：]?\\s*(\\d)\\s*${DASH}\\s*(\\d)\\s*${DASH}\\s*(\\d)`);
  const lm = text.match(labeledDashRe);
  if (lm) {
    const bedrooms = parseInt(lm[1], 10);
    const livingrooms = parseInt(lm[2], 10);
    const bathrooms = parseInt(lm[3], 10);
    if (bedrooms >= 1 && bedrooms <= 9 && livingrooms >= 0 && livingrooms <= 9 && bathrooms >= 0 && bathrooms <= 9) {
      return { bedrooms, livingrooms, bathrooms };
    }
  }

  // Match generic dashed layout, e.g. 2-2-1, 3-2-2
  // Exclude metro contexts such as 11-2号线
  const genericDashRe = new RegExp(`(?<!\\d)(\\d)\\s*${DASH}\\s*(\\d)\\s*${DASH}\\s*(\\d)(?!\\d)`, 'g');
  let gd;
  while ((gd = genericDashRe.exec(text)) !== null) {
    const idx = gd.index || 0;
    const before = text.substring(Math.max(0, idx - 14), idx);
    const after = text.substring(idx, Math.min(text.length, idx + 24));
    if (/地铁|号线|metro/i.test(before + after)) continue;
    if (!/(户型|房型|格局|室|厅|卫|平|㎡|m²|面积|小区|租金|月|楼|房)/i.test(before + after)) continue;
    const bedrooms = parseInt(gd[1], 10);
    const livingrooms = parseInt(gd[2], 10);
    const bathrooms = parseInt(gd[3], 10);
    if (bedrooms >= 1 && bedrooms <= 9 && livingrooms >= 0 && livingrooms <= 9 && bathrooms >= 0 && bathrooms <= 9) {
      return { bedrooms, livingrooms, bathrooms };
    }
  }

  // Match labeled slash layout and tolerate trailing part, e.g. 户型:3/2/3/200平, 户型:3/2/1/
  const labeledSlashRe = new RegExp(`(?:户型|房型|格局)\\s*[】\\]\\):：]?\\s*(\\d)\\s*${SEP}\\s*(\\d)\\s*${SEP}\\s*(\\d)(?:\\s*${SEP}\\s*\\d+)?(?:\\s*${SEP})?`);
  const ls = text.match(labeledSlashRe);
  if (ls) {
    const bedrooms = parseInt(ls[1], 10);
    const livingrooms = parseInt(ls[2], 10);
    const bathrooms = parseInt(ls[3], 10);
    if (bedrooms >= 1 && bedrooms <= 9 && livingrooms >= 0 && livingrooms <= 9 && bathrooms >= 0 && bathrooms <= 9) {
      return { bedrooms, livingrooms, bathrooms };
    }
  }

  // Standard X/Y/Z layout
  const re = new RegExp(`(?<!${SEP}|${PLUS}|\\d)(\\d)\\s*${SEP}\\s*(\\d)\\s*${SEP}\\s*(\\d)(?!\\s*${SEP}\\s*\\d)`);
  const m = text.match(re);
  if (m) {
    const idx = m.index || 0;
    const before = text.substring(Math.max(0, idx - 12), idx);
    const afterText = text.substring(idx + m[0].length, Math.min(text.length, idx + m[0].length + 10));
    const nextChar = text.charAt(idx + m[0].length) || '';
    const inMetroContext = /地铁|metro/i.test(before) || /^\s*(?:号线|线|line)/i.test(afterText);
    if (!/\d/.test(nextChar) && !inMetroContext) {
      const bedrooms = parseInt(m[1], 10);
      const livingrooms = parseInt(m[2], 10);
      const bathrooms = parseInt(m[3], 10);
      if (bedrooms >= 1 && bedrooms <= 9 && livingrooms >= 0 && livingrooms <= 9 && bathrooms >= 0 && bathrooms <= 9) {
        return { bedrooms, livingrooms, bathrooms };
      }
    }
  }

  // Tolerate X/Y/Z/ + area format, e.g. 3/2/2/ 140平
  const reTrailingArea = new RegExp(`(?<!${SEP}|${PLUS}|\\d)(\\d)\\s*${SEP}\\s*(\\d)\\s*${SEP}\\s*(\\d)\\s*${SEP}\\s*(?=\\d{2,4}\\s*(?:平|㎡|m²))`);
  const ta = text.match(reTrailingArea);
  if (ta) {
    const idx = ta.index || 0;
    const before = text.substring(Math.max(0, idx - 12), idx);
    const afterText = text.substring(idx + ta[0].length, Math.min(text.length, idx + ta[0].length + 10));
    const nextChar = text.charAt(idx + ta[0].length) || '';
    const inMetroContext = /地铁|metro/i.test(before) || /^\s*(?:号线|线|line)/i.test(afterText);
    if (!/\d/.test(nextChar) && !inMetroContext) {
      const bedrooms = parseInt(ta[1], 10);
      const livingrooms = parseInt(ta[2], 10);
      const bathrooms = parseInt(ta[3], 10);
      if (bedrooms >= 1 && bedrooms <= 9 && livingrooms >= 0 && livingrooms <= 9 && bathrooms >= 0 && bathrooms <= 9) {
        return { bedrooms, livingrooms, bathrooms };
      }
    }
  }

  return null;
}

/**
 * 从原文解析卫生间数量：优先从原文提取，避免 AI 将地铁线路数字误解析为卫生间数
 * 逻辑类似 parseBedroomCount
 */
function parseBathroomCount(val, originalContent) {
  if (originalContent) {
    const text = normalizeLayoutInput(String(originalContent));
    const xyzLayout = parseLayoutXYZ(text);
    if (xyzLayout && xyzLayout.bathrooms >= 0 && xyzLayout.bathrooms <= 9) return xyzLayout.bathrooms;
    const patterns = [
      /(?<!\d)(\d)\s*卫(?:生间)?/,
      /(?<!\d)(\d{1,2})\s*个?\s*(?:卫生间|洗手间|浴室|卫)/,
      /(\d)\s*bathroom/i,
      /bathroom\s*[:：]?\s*(\d)/i,
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num >= 0 && num <= 9) return num;
      }
    }
    const chineseBathroom = text.match(/([一两兩二三四五六七八九])\s*个?\s*(?:卫生间|洗手间|浴室|卫)/);
    if (chineseBathroom) return parseChineseLayoutNumber(chineseBathroom[1]);
    // 有户型描述但无卫生间提及时，默认1卫（含中文数字格式如"一室户"、"一居室"）
    const noExplicitWei = !text.match(/(?<!\d)\d\s*卫/) && !text.match(/[一两二三四五六七八九十]\s*卫/);
    if (noExplicitWei) {
      const hasLayout = text.match(/(?<!\d)\d\s*[房室]\s*\d?\s*厅/)
        || text.match(/[一两二三四五六七八九]\s*[室房居]/)
        || text.match(/(?<!\d)\d\s*[室房]户/)
        || text.match(/(?<!\d)\d\s*居室/)
        || text.match(/(?<!\d)\d\s*[+＋➕]\s*\d/);
      if (hasLayout) return 1;
    }
  }
  if (val != null) {
    const num = parseInt(String(val).trim(), 10);
    if (num >= 0 && num <= 9) return num;
  }
  return null;
}

function normalizeLayoutInput(input) {
  if (!input) return '';
  return String(input)
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248))
    .replace(/／/g, '/')
    .replace(/｜/g, '|')
    .replace(/＋/g, '+')
    .replace(/～/g, '~')
    .replace(/，/g, ',')
    .replace(/：/g, ':');
}

function normalizeDistrictName(value) {
  if (!value) return null;
  const rawDist = String(value).trim();
  if (!rawDist) return null;
  const normDist = rawDist.replace(/新?区$/, '');
  const dMap = {
    黄浦: '黄浦区', 徐汇: '徐汇区', 长宁: '长宁区', 静安: '静安区',
    普陀: '普陀区', 虹口: '虹口区', 杨浦: '杨浦区', 闵行: '闵行区',
    宝山: '宝山区', 嘉定: '嘉定区', 浦东: '浦东新区', 金山: '金山区',
    松江: '松江区', 青浦: '青浦区', 奉贤: '奉贤区', 崇明: '崇明区',
  };
  return dMap[normDist] || (VALID_DISTRICTS.includes(rawDist) ? rawDist : null);
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
      list = text.split(/[,，;；|、\n\r]+/);
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

function normalizePOIAliasName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\s"'“”‘’`·•.。()（）【】\[\]{}<>《》]+/g, '')
    .trim();
}

function hasExactPOIAlias(rawAliases, name) {
  const target = normalizePOIAliasName(name);
  if (!target) return false;
  return parsePOIAliasNames(rawAliases).some((alias) => alias === target);
}

function normalizeAiPriceValue(aiData) {
  if (aiData?.price_value != null) {
    const directNum = parseInt(String(aiData.price_value).replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(directNum) && directNum > 0) return directNum;
  }
  if (aiData?.price) {
    const text = String(aiData.price).replace(/,/g, '');
    const priceMatch = text.match(/(\d{3,7})/);
    if (priceMatch) {
      const num = parseInt(priceMatch[1], 10);
      if (Number.isFinite(num) && num > 0) return num;
    }
  }
  return null;
}

function normalizeAiLivingrooms(value) {
  if (value == null || value === '') return null;
  const num = parseInt(String(value).trim(), 10);
  return Number.isFinite(num) && num >= 0 && num <= 9 ? num : null;
}

function normalizeAiCommunity(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text || isGarbageCommunityName(text) || isInvalidCommunityName(text)) return null;
  return text;
}

function normalizeAiStreet(value) {
  if (!value) return null;
  const text = normalizeExtractedAddress(String(value).trim());
  return text || null;
}

function sameNormalizedText(a, b) {
  return String(a || '').replace(/\s+/g, '').trim() === String(b || '').replace(/\s+/g, '').trim();
}

function normalizeCommunityForCompare(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/^上海/, '')
    .replace(/小区$/, '')
    .replace(/[一二三四五六七八九十]+期$/, '')
    .trim();
}

function sameCommunityValue(a, b) {
  const left = normalizeCommunityForCompare(a);
  const right = normalizeCommunityForCompare(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function formatAiValidationIssues(issues = []) {
  const labels = {
    missing_bedrooms: '缺少卧室',
    missing_bathrooms: '缺少卫生间',
    missing_livingrooms: '缺少客厅',
    missing_price: '缺少价格',
    missing_community: '缺少小区',
    missing_district: '缺少区域',
    missing_address: '缺少地址',
    bedrooms_conflict: '卧室与原文不一致',
    bathrooms_conflict: '卫生间与原文不一致',
    livingrooms_conflict: '客厅与原文不一致',
    price_conflict: '价格与原文不一致',
    community_conflict: '小区与原文不一致',
    district_conflict: '区域与原文不一致',
    address_conflict: '地址与原文不一致',
  };
  const humanIssues = issues.map(issue => labels[issue] || issue);
  return [...new Set(humanIssues)].join('，');
}

function hasExplicitAddressHint(text) {
  const s = String(text || '').replace(/\s+/g, '');
  // 仅在原文出现明确路名/门牌/弄号时才要求地址字段
  return /[\u4e00-\u9fa5]{2,}(?:路|街|道|大道)\d*(?:弄|号)|\d+弄\d*号?/.test(s);
}

function hasExplicitLayoutOrBathHint(text) {
  const s = String(text || '');
  if (!s) return false;
  const sep3 = '(?:/|／|\\||｜|-|—|–|－|﹣)';
  return /(?:户型|房型|格局)\s*[:：]?\s*\d/.test(s)
    || /\d\s*[房室居]/.test(s)
    || /[一二两三四五六七八九十]\s*[房室居]/.test(s)
    || new RegExp(`\\d\\s*${sep3}\\s*\\d\\s*${sep3}\\s*\\d`).test(s)
    || /\d\s*[+＋➕]\s*\d/.test(s)
    || /\d\s*卫(?:生间)?/.test(s)
    || /[一二两三四五六七八九十]\s*卫/.test(s);
}

function validateAiAgainstRules(aiData, ruleData, poiMatch, options = {}) {
  const { requireAiValidation = false, allowMissingAddress = false } = options || {};
  const normalized = {
    bedrooms: parseBedroomCount(aiData?.bedrooms, null),
    bathrooms: parseBathroomCount(aiData?.bathrooms, null),
    livingrooms: normalizeAiLivingrooms(aiData?.livingrooms),
    price_value: normalizeAiPriceValue(aiData),
    community: normalizeAiCommunity(aiData?.community),
    district: normalizeDistrictName(aiData?.district),
    street: normalizeAiStreet(aiData?.street || aiData?.address),
  };
  if (normalized.street) normalized.address = normalized.street;

  const issues = [];
  const addIssue = (issue) => {
    if (!issues.includes(issue)) issues.push(issue);
  };

  if (ruleData?.bedrooms > 0) {
    if (normalized.bedrooms == null) addIssue('missing_bedrooms');
    else if (normalized.bedrooms !== ruleData.bedrooms) addIssue('bedrooms_conflict');
  }
  if (ruleData?.bathrooms != null) {
    if (normalized.bathrooms == null) addIssue('missing_bathrooms');
    else if (normalized.bathrooms !== ruleData.bathrooms) addIssue('bathrooms_conflict');
  }
  if (ruleData?.livingrooms != null) {
    if (normalized.livingrooms == null) addIssue('missing_livingrooms');
    else if (normalized.livingrooms !== ruleData.livingrooms) addIssue('livingrooms_conflict');
  }
  if (ruleData?.price_value > 0) {
    if (normalized.price_value == null) addIssue('missing_price');
    else if (normalized.price_value !== ruleData.price_value) addIssue('price_conflict');
  }

  const expectedCommunity = poiMatch?.community_name || ruleData?.community || null;
  const expectedDistrict = poiMatch?.district || ruleData?.district || null;
  // 地址校验仅依赖原文可提取地址，避免“仅POI补全地址”导致误判缺地址
  const expectedStreet = ruleData?.street || null;

  if (requireAiValidation && expectedCommunity) {
    if (!normalized.community) addIssue('missing_community');
    else if (!sameCommunityValue(normalized.community, expectedCommunity)) addIssue('community_conflict');
  }
  if (requireAiValidation && expectedDistrict) {
    if (!normalized.district) {
      if (poiMatch && normalized.community && sameCommunityValue(normalized.community, poiMatch.community_name)) {
        normalized.district = expectedDistrict;
      } else {
        addIssue('missing_district');
      }
    }
    else if (!sameNormalizedText(normalized.district, expectedDistrict)) addIssue('district_conflict');
  }
  if (requireAiValidation && expectedStreet && !allowMissingAddress) {
    if (!normalized.street) addIssue('missing_address');
    else if (!sameNormalizedText(normalized.street, expectedStreet)) addIssue('address_conflict');
  }

  return {
    status: issues.length ? 'conflict' : 'pass',
    issues,
    normalized,
  };
}

/** 地址匹配需排除的前缀（路、站、地铁站等会误匹配） */
const ADDR_EXCLUDE_PREFIX = /^(路|街|道|号线|地铁站|火车站|汽车站|高铁站|.*站)/;
/** 地址前多余的区名前缀，需去除后显示（如 长宁区愚园路→愚园路） */
const ADDR_DISTRICT_PREFIX = /^(徐汇|静安|长宁|普陀|虹口|杨浦|黄浦|浦东|闵行|宝山|嘉定|松江|青浦|奉贤|金山|崇明)区/;
/** 地址前被误捕获的业务性垃圾前缀（如"付佣金永康路209号"→"永康路209号"） */
const ADDR_GARBAGE_PREFIX = /^(付佣金?|包佣金?|免佣金?|租客转租?|业主[直自]?租?|转租|出租|整租|合租|急租|短租|长租|日租|月租|年租)/;
/** 垃圾前缀后可能紧跟的中间干扰词（如"付佣金有视频永康路"中的"有视频"） */
const ADDR_MID_GARBAGE = /^(有视频|电梯房?|步梯房?|可[分做租]|出租|转租|整租|合租|新上|急租|上新|[\u4e00-\u9fa5]{2,4}旁)/;
function normalizeExtractedAddress(addr) {
  if (!addr) return addr;
  let s = String(addr).replace(/\s+/g, '');
  s = s.replace(ADDR_DISTRICT_PREFIX, '');
  if (ADDR_GARBAGE_PREFIX.test(s)) {
    const original = s;
    s = s.replace(ADDR_GARBAGE_PREFIX, '');
    let prev;
    do { prev = s; s = s.replace(ADDR_MID_GARBAGE, ''); } while (s !== prev);
    if (!/[\u4e00-\u9fa5]+(路|街|道|大道)/.test(s)) s = original;
  }
  // 弄后面的号统一去除：如"长乐路196弄69号"→"长乐路196弄"
  s = s.replace(/(\d+弄)\d+号.*$/, '$1');
  return s;
}

/**
 * Rule 2 ②: 从文案提取地址（路+弄/号）
 * 格式：陕西北路640弄、漕溪北路468号、永嘉路229弄6号 等
 * 优先级：① POI → ② 地址(路弄号) → ③ 地标 → ④ 区域
 */
function extractAddressFromContent(content) {
  if (!content) return null;
  const text = String(content).replace(/\\n/g, ' ');

  const norm = (addr) => {
    if (!addr) return null;
    const s = String(addr).replace(/\s+/g, '');
    return normalizeExtractedAddress(s);
  };
  const valid = (addr) => addr && addr.length >= 4 && addr.length <= 30 && !ADDR_EXCLUDE_PREFIX.test(addr);

  // 0. 从【地 址】/【小区】等标签后提取
  const labelPatterns = [
    /[【\[]\s*(?:地\s*址|小\s*区|位\s*置)\s*[\]】]\s*[:：]?\s*([\u4e00-\u9fa5]{2,10}(?:路|街|道|大道)\s*\d{1,5}\s*弄(?:\s*\d{1,5}\s*号)?)/,
    /[【\[]\s*(?:地\s*址|小\s*区|位\s*置)\s*[\]】]\s*[:：]?\s*([\u4e00-\u9fa5]{2,10}(?:路|街|道|大道)\s*\d{1,5}\s*号)/,
    /(?:地\s*址|小\s*区)\s*[:：]\s*([\u4e00-\u9fa5]{2,10}(?:路|街|道|大道)\s*\d{1,5}\s*弄(?:\s*\d{1,5}\s*号)?)/,
    /(?:地\s*址|小\s*区)\s*[:：]\s*([\u4e00-\u9fa5]{2,10}(?:路|街|道|大道)\s*\d{1,5}\s*号)/,
  ];
  for (const lp of labelPatterns) {
    const lm = text.match(lp);
    if (lm) {
      const addr = norm(lm[1]);
      if (valid(addr) && !INVALID_COMMUNITY_NAMES.has(addr) && !isInvalidCommunityName(addr)) return addr;
    }
  }

  // 1. Rule 2 ② 核心：路+弄+号 / 路+弄 / 路+号（文案中明显有多少弄、多少号必须按规则解析）
  const ADDR_PATTERNS = [
    /([\u4e00-\u9fa5]{2,10}(?:路|街|道|大道)\s*\d{1,5}\s*弄\s*\d{1,5}\s*号)/,   // 永嘉路229弄6号
    /([\u4e00-\u9fa5]{2,10}(?:路|街|道|大道)\d{1,5}\s*弄\s*\d{1,5}\s*号)/,     // 永嘉路229弄6号(无空格)
    /([\u4e00-\u9fa5]{2,10}(?:路|街|道|大道)\d{1,5}弄\d{1,5}号)/,              // 永嘉路229弄6号(紧凑)
    /([\u4e00-\u9fa5]{2,10}(?:东路|西路|南路|北路|中路)\s*\d{1,5}\s*弄\s*\d{1,5}\s*号)/,
    /([\u4e00-\u9fa5]{2,10}(?:东路|西路|南路|北路|中路)\s*\d{1,5}\s*弄)/,
    /([\u4e00-\u9fa5]{2,10}(?:东路|西路|南路|北路|中路)\s*\d{1,5}\s*号)/,
    /([\u4e00-\u9fa5]{2,10}(?:路|街|道|大道)\s*\d{1,5}\s*弄)/,                // 陕西北路640弄
    /([\u4e00-\u9fa5]{2,10}(?:路|街|道|大道)\d{1,5}\s*弄)/,
    /([\u4e00-\u9fa5]{2,10}(?:路|街|道|大道)\s*\d{1,5}\s*号)/,                // 漕溪北路468号
    /([\u4e00-\u9fa5]{2,10}(?:路|街|道|大道)\d{1,5}\s*号)/,
  ];
  for (const pat of ADDR_PATTERNS) {
    const m = text.match(pat);
    if (m) {
      const addr = norm(m[1]);
      if (valid(addr)) return addr;
    }
  }

  // 2. 匹配括号/书名号内的小区名（优先级高，因为括号内通常是明确的小区名）
  // 排除标签式括号，如【地 址】、【户 型】、【小区】等字段标签
  const BRACKET_LABEL_WORDS = /^(地\s*址|户\s*型|面\s*积|看\s*房|介\s*绍|小\s*区|价\s*格|交\s*通|区\s*域|朝\s*向|楼\s*层|装\s*修|配\s*置|配\s*套|类\s*型|联\s*系|备\s*注|描\s*述|特\s*点|位\s*置|周\s*边|学\s*区)$/;
  // 括号内常见的房屋特征描述短语，非小区名
  const BRACKET_FEATURE_WORDS = /^[带有含送赠自]?(院子|花园|庭院|天井|阳台|露台|天台|车位|地下室|储物间|衣帽间|书房|飘窗|壁炉)$|^(精装修|简装修|豪装修|毛坯房?|南北通透|全明户型|拎包入住|即可入住|可居家|可办公|近地铁|近学校|随时看房|朝南朝北|东西朝向|全新装修|新装修|老装修|看中价格好谈|价格好谈|价格可谈|价格面议|手慢无|限时活动|随时入住|急租|免佣金?|付佣金?|可办居住证|服务以及价格介绍|出售|出租)$/;
  const bracketPatterns = [
    /[（(]\s*([\u4e00-\u9fa5]{2,10})\s*[)）]/,
    /[【\[]\s*([\u4e00-\u9fa5]{2,10})\s*[\]】]/,
    /[「]\s*([\u4e00-\u9fa5]{2,10})\s*[」]/,
  ];
  for (const bp of bracketPatterns) {
    const bm = text.match(bp);
    if (bm && bm[1].length >= 2 && bm[1].length <= 12) {
      const name = bm[1].replace(/\s+/g, '');
      if (BRACKET_LABEL_WORDS.test(bm[1])) continue;
      if (BRACKET_FEATURE_WORDS.test(name)) continue;
      if (name.length >= 3 && !INVALID_COMMUNITY_NAMES.has(name) && !isGarbageCommunityName(name) && !isInvalidCommunityName(name)) {
        return name;
      }
    }
  }

  // 3. 匹配常见小区名后缀（小区、花园、花苑、新村、广场、大厦、公寓、城市、城、府、苑等）
  const COMMUNITY_PREFIX_EXCLUDE = /^(对面|旁边|附近|靠近|临近|紧邻|楼下|门口|号线|平花|俯瞰|遥望|正对)/;
  const COMMUNITY_SUFFIX_PATTERNS = [
    { re: /([\u4e00-\u9fa5]{2,8}小区)/, min: 4, max: 15, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,6}花园)/, min: 4, max: 12, exclude: /^(带花|有花|送花|赠花|私家|独立|大花|小花)园$/ },
    { re: /([\u4e00-\u9fa5]{2,6}花苑)/, min: 4, max: 12, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,6}新村)/, min: 4, max: 10, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,8}广场)/, min: 4, max: 14, exclude: /^(人民|世纪|中心|地铁|火车)广场$/ },
    { re: /([\u4e00-\u9fa5]{2,8}大厦)/, min: 4, max: 14, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,8}公寓)/, min: 4, max: 14, exclude: /^(出租|整租|合租|精装|豪华)公寓$/ },
    { re: /([\u4e00-\u9fa5]{2,6}公馆)/, min: 4, max: 12, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,6}华庭)/, min: 4, max: 10, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,6}豪庭)/, min: 4, max: 10, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,6}雅苑)/, min: 4, max: 10, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,6}家园)/, min: 4, max: 10, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,6}新城)/, min: 4, max: 10, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,6}城市)/, min: 4, max: 10, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,8}中心)/, min: 4, max: 14, exclude: /^(市中|区中|城市|服务|商务|行政|购物)心$/ },
    { re: /([\u4e00-\u9fa5]{2,6}城)/, min: 3, max: 10, exclude: /^(上海|全城|满城|进城|回城|老城|新城|古城)$/ },
    { re: /([\u4e00-\u9fa5]{2,6}府)/, min: 3, max: 10, exclude: /^(政府|官府|王府|府邸|幸福)$/ },
    { re: /([\u4e00-\u9fa5]{2,6}苑)/, min: 3, max: 10, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,6}庭)/, min: 3, max: 10, exclude: /^(家庭|法庭|前庭|后庭|中庭|内庭)$/ },
    { re: /([\u4e00-\u9fa5]{2,6}湾)/, min: 3, max: 10, exclude: /^(台湾|海湾|港湾|外滩)$/ },
    { re: /([\u4e00-\u9fa5]{2,6}坊)/, min: 3, max: 10, exclude: /^(作坊|工坊|磨坊|田子)$/ },
    { re: /([\u4e00-\u9fa5]{2,6}里)/, min: 3, max: 10, exclude: /^(这里|那里|哪里|家里|屋里|公里|附近)$/ },
    { re: /([\u4e00-\u9fa5]{2,6}居)/, min: 3, max: 10, exclude: /^(居住|居然|起居|定居|邻居|同居)$/ },
    { re: /([\u4e00-\u9fa5]{2,6}邸)/, min: 3, max: 10, exclude: null },
    { re: /([\u4e00-\u9fa5]{2,6}阁)/, min: 3, max: 10, exclude: /^(内阁|楼阁|亭阁)$/ },
    { re: /([\u4e00-\u9fa5]{2,6}园)/, min: 2, max: 10, exclude: /^(花园|公园|乐园|菜园|果园|校园|庄园|田园|幼儿|动物|植物)$/ },
    { re: /([\u4e00-\u9fa5]{2,6}域)/, min: 3, max: 10, exclude: /^(区域|领域|地域|全域)$/ },
  ];
  for (const { re, min, max, exclude } of COMMUNITY_SUFFIX_PATTERNS) {
    const m = text.match(re);
    if (m && m[1].length >= min && m[1].length <= max) {
      const name = m[1];
      if (exclude && exclude.test(name)) continue;
      if (COMMUNITY_PREFIX_EXCLUDE.test(name)) continue;
      if (RENTAL_COMPANY_NAMES.has(name)) continue;
      const baseName = name.replace(/小区$|花园$|花苑$|新村$|广场$|大厦$|公寓$|公馆$|华庭$|豪庭$|雅苑$|家园$|新城$|城市$|中心$/, '');
      if (RENTAL_COMPANY_NAMES.has(baseName)) continue;
      if (!INVALID_COMMUNITY_NAMES.has(baseName) && !isGarbageCommunityName(name)) {
        return name;
      }
    }
  }

  // Rule ⑤: 禁止返回纯道路名（以"路"/"街"/"大道"结尾且不含弄/号），如"太原路""昭化路"
  // 允许"陕西北路640弄""漕溪北路468号"格式，但纯道路名不作为小区名

  return null;
}

/**
 * 从文案中提取地址/地标作为小区名回退（无具体地址时用）
 * 优先级: 地标建筑 > 区域
 */
function extractFallbackLocation(content, district) {
  if (!content) return null;
  const text = String(content);
  // 先尝试地址（extractAddressFromContent 可能未匹配到，这里再试一次）
  const addr = extractAddressFromContent(content);
  if (addr) return addr;

  const landmarks = [
    '静安寺', '中山公园', '人民广场', '陆家嘴', '外滩',
    '徐家汇', '新天地', '田子坊', '豫园', '城隍庙',
    '古北', '曹家渡', '真如', '长风公园',
    '虹口足球场', '大宁', '北外滩',
    '世纪公园', '花木', '联洋', '金桥', '碧云', '张江',
    '莘庄', '七宝', '龙华', '漕河泾', '光大会展',
    '打浦桥', '日月光', '复兴公园',
    '天山', '仙霞', '上海体育馆', '体育馆',
    '交通大学', '同济大学', '复旦大学', '华东师大', '上海大学',
    '御桥', '三林', '北蔡', '周浦', '唐镇', '康桥', '曹路', '高桥', '外高桥',
    '梅陇', '春申', '颛桥', '华漕', '虹桥枢纽', '九亭', '泗泾', '佘山',
    '曹杨', '甘泉', '石泉', '桃浦', '长征', '光新',
    '彭浦', '闸北公园',
    '五角场', '新江湾', '鞍山新村',
    '衡复', '法租界', '前滩', '虹桥',
  ];
  // Rule ⑤: 过滤以"路"/"街"/"大道"结尾的地标，禁止作为小区名
  for (const lm of landmarks) {
    if (/(?:路|街|大道)$/.test(lm)) continue;
    if (text.includes(lm)) return lm;
  }

  if (district) return String(district).replace(/区$/, '');
  return null;
}

/**
 * 判断是否无效的小区名（区域名/无意义名）
 */
const INVALID_COMMUNITY_NAMES = new Set([
  '徐汇', '静安', '长宁', '普陀', '虹口', '杨浦', '黄浦', '浦东', '闵行', '宝山',
  '嘉定', '松江', '青浦', '奉贤', '金山', '崇明',
  '徐汇区', '静安区', '长宁区', '普陀区', '虹口区', '杨浦区', '黄浦区',
  '浦东新区', '闵行区', '宝山区', '嘉定区', '松江区', '青浦区', '奉贤区', '金山区', '崇明区',
  'None', 'null', 'undefined', '无', '未知', '其他', '上海', '上海市',
  '格局', '位置', '适合', '交通', '价格', '联系', '面积', '户型', '装修',
  '澳门路', '地 址', '户 型', '面 积', '看 房', '介 绍',
  '前滩区', '上海区', '城北区', '新天地区', '京安区', '陆家嘴区',
  '花园洋房', '一楼花园', '品质小区', '朝南带花园', '一楼朝南带花园',
  '电梯房', '步梯房', '楼梯房', '包租房', '独栋别墅',
  '沿街', '临街', '底商', '不还价', '不议价',
]);
function isInvalidCommunityName(name) {
  if (!name) return true;
  const s = String(name).trim();
  if (s.length < 2) return true;
  if (s.length > 30) return true;
  if (INVALID_COMMUNITY_NAMES.has(s)) return true;
  // 纯数字或纯标点
  if (/^[\d\s.,;:!?？！，。、]+$/.test(s)) return true;
  // 包含"区"结尾且不是有效小区名后缀
  if (/^[\u4e00-\u9fa5]{2,4}区$/.test(s) && !/(小区|社区|园区|新区|街区)$/.test(s)) return true;
  // 包含破折号+描述词的复合体（如"徐家汇- 品质小区"）
  if (/[-–—]\s*[\u4e00-\u9fa5]/.test(s) && s.length > 8) return true;
  // 开头是"北京、上海、深圳"等多城市组合
  if (/^(北京|上海|深圳|广州|南京|杭州)[、，,]/.test(s)) return true;
  // 以"路"/"街"/"道"结尾的纯道路名禁止作为小区名（如"太原路""昭化路"）
  // 允许"路+弄/号"格式（如"陕西北路640弄""漕溪北路468号"）
  if (/(?:路|街|大道)$/.test(s) && !/\d+弄|\d+号/.test(s)) return true;
  // "XX路沿街" / "XX路次沿街" — 不是小区名（但"XX路沿街花园"是有效的）
  if (/沿街$/.test(s) || /次沿街$/.test(s)) return true;
  // "XX区沿街独栋" — 描述性组合
  if (/区沿街|区独栋|区内环/.test(s)) return true;
  // 以"独栋"结尾且不含路名/小区名特征 — 仅"独栋"/"XX独栋"类纯描述
  if (/独栋$/.test(s) && s.length <= 4) return true;
  // 以"房"结尾的描述性词（电梯房、步梯房、包租房、精装房等）
  if (/^[\u4e00-\u9fa5]{2,4}房$/.test(s) && /电梯|步梯|楼梯|包租|精装|毛坯|居家/.test(s)) return true;
  // 包含"，"逗号分隔的复合描述（如"包租公寓，付佣金"）
  if (/[，,]/.test(s)) return true;
  // 句子/短语型：含"的"/"了"/"吗"/"呢"/"吧"等语气词
  if (/[的了吗呢吧啊哦]/.test(s) && s.length > 4) return true;
  // "市中心XX"开头的描述性组合
  if (/^市中心/.test(s)) return true;
  // "XX内环/外环" 描述性区位词
  if (/内环|外环/.test(s) && !/花园|小区|公寓|大厦/.test(s)) return true;
  return false;
}

/**
 * 无效价格文本正则：AI返回的非数字描述性文本
 */
const INVALID_PRICE_PATTERNS = /^(原始价格文本|价格[便宜美丽好谈\s]*$|私信|私聊|谈价|面议|电议|急售|特价出售|短租谈价|售价美丽|价格好谈|null|undefined|NaN|price|暂无|待定|详询|来电|见面谈|看房谈|联系)/i;

/**
 * 标准化AI解析的价格，处理各种异常情况
 * @returns {{ price_value?: number, price?: string }}
 */
function normalizeParsedPrice(rawValue, rawText, originalContent) {
  const text = String(rawText || '').trim();
  const oc = String(originalContent || '').substring(0, 800);

  // 1. 过滤无效的价格文本
  if (text && INVALID_PRICE_PATTERNS.test(text)) return {};
  if (text && /[\u4e00-\u9fa5]/.test(text) && !/\d/.test(text)) return {};

  // 2. "元/平"、"元/㎡" → 商业地产，无法标准化
  if (/元\/平|\/平米|\/㎡|每平/.test(text)) return {};

  // 3. 出售语境综合检测（文本 + 原文）
  const saleKeywords = /出售|售价|急售|仅售|挂牌|报价\d+万|业主急卖|转让价|诚售|诚意出售|到手价|各付税|满五|满二|产证|产权|独栋|售\d+万/;
  const rentKeywords = /月租|租金|出租|\/月|元\/月|每月|短租|长租|可租|日租|押一付|整租|合租/;
  const hasSaleKW = saleKeywords.test(text) || saleKeywords.test(oc);
  const hasRentKW = rentKeywords.test(text) || rentKeywords.test(oc);
  // 纯出售语境：有出售关键词且无出租关键词
  const pureSaleContext = hasSaleKW && !hasRentKW;
  // 混合语境（租售同时存在）：按price text来判断
  const textHasWan = /万/.test(text);
  const textHasSale = /售|出售|挂牌/.test(text);

  // 4. 从text中解析数值
  let pv = rawValue != null ? parseFloat(rawValue) : NaN;
  if (isNaN(pv) && text) {
    const kMatch = text.match(/([\d,.]+)\s*K/i);
    if (kMatch) { pv = parseFloat(kMatch[1].replace(/,/g, '')) * 1000; }
    if (isNaN(pv)) {
      const wMatch = text.match(/([\d,.]+)\s*W/i);
      if (wMatch) { pv = parseFloat(wMatch[1].replace(/,/g, '')) * 10000; }
    }
    if (isNaN(pv)) {
      const numMatch = text.match(/([\d,.]+)/);
      if (numMatch) pv = parseFloat(numMatch[1].replace(/,/g, ''));
    }
  }
  if (isNaN(pv) || pv <= 0) return {};

  // 5. 日租/短租检测
  const isDailyPrice = /\/天|元\/天|每天|天\/|天内|per\s*day/i.test(text) ||
                       /元\/天|\/天/.test(oc);
  if (isDailyPrice && !pureSaleContext) {
    const dailyNums = text.match(/(\d+)\s*元?[\s/]*天/g);
    if (dailyNums) {
      const maxDaily = Math.max(...dailyNums.map(s => parseInt(s.match(/\d+/)[0])));
      if (maxDaily > 0 && maxDaily < 5000) {
        const monthly = Math.round(maxDaily * 30);
        if (monthly >= 1000 && monthly <= MAX_RENT_PRICE) {
          return { price_value: monthly, price: `¥${monthly}(≈${maxDaily}元/天)` };
        }
      }
    }
    if (pv > 0 && pv < 2000) {
      const monthly = Math.round(pv * 30);
      if (monthly >= 1000 && monthly <= MAX_RENT_PRICE) {
        return { price_value: monthly, price: `¥${monthly}(≈${pv}元/天)` };
      }
    }
  }

  // 6. "万"单位处理
  if (textHasWan) {
    const wanMatch = text.match(/([\d,.]+)\s*万/);
    if (wanMatch) {
      pv = parseFloat(wanMatch[1].replace(/,/g, '')) * 10000;
    } else if (pv < 50000) {
      pv = pv * 10000;
    }
  }
  // "亿"单位
  if (/亿/.test(text)) {
    const yiMatch = text.match(/([\d,.]+)\s*亿/);
    if (yiMatch) pv = parseFloat(yiMatch[1].replace(/,/g, '')) * 100000000;
    else if (pv < 1000) pv = pv * 100000000;
  }

  // 6b. 原文交叉验证：AI可能丢失"万/亿"单位
  //     例如原文"售价2400万"，AI返回 pv=2400 text="2400"（无万字）
  //     此时需要检查原文中是否有 "pv值+万" 的模式来纠正
  if (!textHasWan && !/亿/.test(text) && pv > 0 && pv <= MAX_RENT_PRICE) {
    const pvInt = Math.round(pv);
    const pvStr = String(pvInt);
    // 在原文中搜索 "2400万" 或 "2,400万" 等模式
    const ocWanRegex = new RegExp(pvStr + '\\s*万');
    if (ocWanRegex.test(oc)) {
      pv = pvInt * 10000;
    }
    // 也检查原文中 "X.Y万" 如 "2.4万" → AI返回24000
    if (pv <= MAX_RENT_PRICE) {
      const pvWanVal = (pv / 10000).toFixed(1).replace(/\.0$/, '');
      const ocWanRegex2 = new RegExp(pvWanVal + '\\s*万');
      if (pv >= 10000 && ocWanRegex2.test(oc)) {
        // pv已经是正确值（如24000 → 原文 "2.4万" = 24000），无需再乘
      }
    }
    // 检查原文中 "总价X万" "售价X万" "X万一口价" 等
    const ocSalePriceMatch = oc.match(/(?:售价|总价|报价|挂牌价|交易价[格]?|一口价)[：:约]?\s*([\d,.]+)\s*万/);
    if (ocSalePriceMatch) {
      const saleWan = parseFloat(ocSalePriceMatch[1].replace(/,/g, ''));
      if (saleWan >= 20) {
        pv = saleWan * 10000;
      }
    }
    // 检查原文中 "X亿" 
    const ocYiMatch = oc.match(/(?:售价|总价|报价|交易价[格]?)[：:约]?\s*([\d,.]+)\s*亿/);
    if (ocYiMatch) {
      const yiVal = parseFloat(ocYiMatch[1].replace(/,/g, ''));
      if (yiVal > 0) pv = yiVal * 100000000;
    }
  }
  pv = Math.round(pv);

  // 7. 综合判断出售 vs 出租
  // Rule 6: 文案中若有出售、售卖等任何和卖房子出售相关的即为出售类型
  // Rule 9-⑧: 列表禁止显示任何出售类型的房源数据
  // 标记为出售的条件：
  //   a) 价格 > 500000 (月租不可能超50万)
  //   b) 原文或价格文本含出售关键词（不管是否同时含出租关键词）
  //   c) price文本含"万"且数值≥100万
  //   d) price文本直接含"售"字且含"万"
  const isSale = pv > MAX_RENT_PRICE ||
    hasSaleKW ||
    (textHasWan && pv >= 1000000) ||
    (textHasSale && textHasWan);

  if (isSale) {
    return { price_value: 0, price: `¥${pv.toLocaleString()}(售)` };
  }

  // 8. 月租范围校验: 1000~500000
  if (pv >= 1000 && pv <= MAX_RENT_PRICE) {
    return { price_value: pv, price: `¥${pv}` };
  }

  return {};
}

/**
 * 上海标准行政区列表（兜底值），通过 loadValidDistricts() 从数据库 property_districts 动态加载
 * Rule 7: 解析显示内容必须和管理员后台区域设置保持一致
 */
const VALID_DISTRICTS_FALLBACK = [
  '黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区',
  '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区',
  '奉贤区', '崇明区',
];
let VALID_DISTRICTS = [...VALID_DISTRICTS_FALLBACK];
let _districtsCacheTime = 0;
const DISTRICTS_CACHE_TTL = 10 * 60 * 1000;

async function loadValidDistricts() {
  const now = Date.now();
  if (now - _districtsCacheTime < DISTRICTS_CACHE_TTL && VALID_DISTRICTS.length > 0) {
    return VALID_DISTRICTS;
  }
  try {
    const rows = await query('SELECT name_cn FROM property_districts WHERE is_active = 1 ORDER BY sort_order');
    const data = Array.isArray(rows[0]) ? rows[0] : rows;
    if (data && data.length > 0) {
      VALID_DISTRICTS = data.map(r => r.name_cn).filter(Boolean);
      _districtsCacheTime = now;
    }
  } catch (err) {
    logger.warn('加载区域列表失败，使用兜底数据', { error: err.message });
    if (VALID_DISTRICTS.length === 0) VALID_DISTRICTS = [...VALID_DISTRICTS_FALLBACK];
  }
  return VALID_DISTRICTS;
}

/**
 * 自动判断 community 字段的分类类型
 * @returns {number} 0=未分类,1=真实小区,2=区域名,3=商圈地标,4=路名地址,5=其他非小区
 */
async function classifyCommunityName(name) {
  if (!name || typeof name !== 'string') return 0;
  name = name.trim();
  if (!name) return 0;

  const validDistricts = await loadValidDistricts();
  const districtShort = validDistricts.map(d => d.replace(/区$/, ''));
  const districtSet = new Set([...validDistricts, ...districtShort, '上海', '浦东新', '浦东']);

  if (districtSet.has(name) || districtSet.has(name.replace(/区$/, ''))) return 2;

  const { boards, stations } = await loadMetroData();
  if (boards && boards.has(name)) return 3;
  if (stations && stations.has(name)) return 3;

  const compositeAreaRe = /^[\u4e00-\u9fa5]+[·・][\u4e00-\u9fa5]+$/;
  if (compositeAreaRe.test(name)) {
    const parts = name.split(/[·・]/);
    if (parts.some(p => districtSet.has(p) || (boards && boards.has(p)) || (stations && stations.has(p)))) return 3;
  }

  const districtPrefixRoad = /^(黄浦|徐汇|长宁|静安|普陀|虹口|杨浦|闵行|宝山|嘉定|浦东新?|金山|松江|青浦|奉贤|崇明)区?[\u4e00-\u9fa5]+(路|街|道|大道|弄|里)\d+/;
  if (districtPrefixRoad.test(name)) return 4;

  const roadPattern = /^[\u4e00-\u9fa5]+(路|街|道|大道|弄|里|坊|支弄|巷)\d+/;
  if (roadPattern.test(name)) return 4;

  const roadOnlyPattern = /^[\u4e00-\u9fa5]+(路|街|道|大道)$/;
  if (roadOnlyPattern.test(name)) return 4;

  if (/^付佣金/.test(name)) return 4;

  try {
    const poiRows = await query('SELECT id FROM property_community_dict WHERE community_name = ? AND is_enabled = 1 LIMIT 1', [name]);
    const poiData = Array.isArray(poiRows[0]) ? poiRows[0] : poiRows;
    if (poiData && poiData.length > 0) return 1;
  } catch (_) {}

  return 1;
}

/**
 * 通过POI数据库校正AI解析的district
 * 当小区名在POI中有唯一匹配时，使用POI的district替代AI解析的结果
 */

const GARBAGE_COMMUNITY_KEYWORDS = [
  // 租赁/交易动作
  '转租', '出租', '急租', '新出', '整租', '合租', '直租', '短租', '长租', '月租', '日租', '分租',
  '出售', '急售', '降价', '大降价', '特价', '求租', '包租', '招租',
  // 中介/佣金
  '房东', '中介', '佣金', '付佣', '免佣', '独家', '主营', '一手', '对接', '同行',
  // 描述性词汇 — 不可能是小区名
  '品质', '高端', '中高端', '豪华', '顶级', '好房', '推荐',
  '精装', '豪装', '简装', '毛坯', '全配', '拎包', '居家',
  '朝南', '朝北', '朝东', '朝西', '南北通',
  '底商', '铺面', '门面', '橱窗',
  '格局', '位置', '适合', '面积', '户型', '装修',
  '板块', '商圈', '交通',
  // 楼层
  '一楼', '二楼', '三楼', '四楼', '五楼', '六楼',
  // 业态/用途
  '办公', '工作室', '展厅', '商铺', '餐饮', '仓库', '厂房', '车库', '地下室', '阁楼',
  // 行动词/看房说明 — 非小区名
  '看房', '带看', '预约', '联系', '随时', '明日', '进群', '加微', '手机',
  '可居', '自住', '可谈', '可刀', '有钥匙', '有视频', '使用权',
  '即可入住', '拎包入住',
  '钥匙在门口', '钥匙在', '钥匙放', '门口钥匙', '门口拿钥匙',
  // 其他
  '分享', '泽大', '核心信息',
  '地 址', '户 型', '面 积', '看 房', '介 绍',
];
// 需要结合上下文判断的关键词：在没有有效小区后缀(花园/小区/公寓等)时才视为垃圾
const CONTEXT_GARBAGE_KEYWORDS = ['沿街', '临街', '电梯', '步梯', '楼梯', '独栋'];
const VALID_COMMUNITY_SUFFIXES = /(?:花园|小区|花苑|新村|广场|大厦|公寓|公馆|华庭|雅苑|家园|新城|豪庭|别墅|名邸|庄园|洋房|高层|独栋|苑|城|府|庭|坊|居|阁|轩|邸|院|宅|园|里|村|楼|台)(?:\(.*\))?$/;
const GARBAGE_COMMUNITY_EXACT = new Set([
  '梧桐区', '区域',
  '上海', '上海市', '地 址', '户 型', '一楼花园', '一楼朝南带花园',
  '花园洋房', '一楼花园洋房',
  '地址', '不详', '不还价', '不议价', '沿街', '独栋', '独栋别墅',
  '全上海', '使用权', 'null', '风貌区',
  '2楼钥匙在门口', '3楼钥匙在门口', '钥匙在门口', '门口拿钥匙',
  // 房屋特征描述（括号内常见，如"（带院子）""（精装修）"等）
  '带院子', '有院子', '带花园', '有花园', '带阳台', '有阳台',
  '带露台', '有露台', '带天台', '有天台', '带车位', '有车位',
  '带庭院', '有庭院', '带天井', '有天井', '带地下室', '有地下室',
  '送车位', '含车位', '送花园', '含花园', '赠花园',
  '精装修', '简装修', '豪装修', '毛坯房', '南北通透', '全明户型',
  '高端小区', '品质小区', '花园式小区', '电梯房', '步梯房',
  // 商圈（静安寺、新天地、陆家嘴等）和区域（徐汇、浦东等）允许作为小区名
]);

/**
 * 包租公司/二房东/中介品牌名 —— 从数据库动态加载，带内存缓存
 * 解析小区名时须排除这些名称，避免误将公司名当作小区名
 */
const RENTAL_COMPANY_NAMES_FALLBACK = new Set([
  '尚寓', '自如', '蛋壳', '青客', '魔方', '乐乎', '城家', '窝趣',
  '泊寓', '冠寓', '相寓', '集寓', '美寓', '优寓', '嗨住', '安歆',
  '湾流', '乐璟', '微领地', '驿家', '壹间', '城城找房', '寓见',
  '包租婆', '包租公', '二房东',
]);
let _rentalCompanyNamesCache = null;
let _rentalCompanyCacheTime = 0;
const RENTAL_CACHE_TTL = 5 * 60 * 1000;

async function loadRentalCompanyNames() {
  const now = Date.now();
  if (_rentalCompanyNamesCache && (now - _rentalCompanyCacheTime < RENTAL_CACHE_TTL)) {
    return _rentalCompanyNamesCache;
  }
  try {
    const rows = await query('SELECT name, alias_names FROM rental_companies WHERE is_enabled = 1');
    const data = Array.isArray(rows[0]) ? rows[0] : rows;
    const names = new Set(RENTAL_COMPANY_NAMES_FALLBACK);
    if (data) {
      for (const row of data) {
        if (row.name) names.add(row.name.trim());
        if (row.alias_names) {
          row.alias_names.split(/[,，;；|]+/).forEach(a => {
            const t = a.trim();
            if (t.length >= 2) names.add(t);
          });
        }
      }
    }
    _rentalCompanyNamesCache = names;
    _rentalCompanyCacheTime = now;
    return names;
  } catch (err) {
    logger.warn('加载包租公司名单失败，使用兜底数据', { error: err.message });
    return _rentalCompanyNamesCache || RENTAL_COMPANY_NAMES_FALLBACK;
  }
}

function invalidateRentalCompanyCache() {
  _rentalCompanyNamesCache = null;
  _rentalCompanyCacheTime = 0;
}

/**
 * 地铁线路和站点数据缓存 — 用于校验解析结果与管理员后台设置一致性 (Rule 7)
 */
let _metroLinesCache = null;
let _metroStationsCache = null;
let _boardNamesCache = null;
let _metroCacheTime = 0;
const METRO_CACHE_TTL = 10 * 60 * 1000;

async function loadMetroData() {
  const now = Date.now();
  if (_metroLinesCache && _metroStationsCache && _boardNamesCache && (now - _metroCacheTime < METRO_CACHE_TTL)) {
    return { lines: _metroLinesCache, stations: _metroStationsCache, boards: _boardNamesCache };
  }
  try {
    const lineRows = await query('SELECT name_cn FROM property_metro_lines WHERE is_active = 1');
    const lineData = Array.isArray(lineRows[0]) ? lineRows[0] : lineRows;
    _metroLinesCache = new Set((lineData || []).map(r => r.name_cn).filter(Boolean));

    const stationRows = await query('SELECT name_cn FROM property_metro_stations WHERE is_active = 1');
    const stationData = Array.isArray(stationRows[0]) ? stationRows[0] : stationRows;
    _metroStationsCache = new Set((stationData || []).map(r => r.name_cn).filter(Boolean));

    const boardRows = await query('SELECT DISTINCT board FROM property_community_dict WHERE board IS NOT NULL AND board != ""');
    const boardData = Array.isArray(boardRows[0]) ? boardRows[0] : boardRows;
    _boardNamesCache = new Set((boardData || []).map(r => r.board).filter(Boolean));

    _metroCacheTime = now;
    return { lines: _metroLinesCache, stations: _metroStationsCache, boards: _boardNamesCache };
  } catch (err) {
    logger.warn('加载地铁/商圈数据失败', { error: err.message });
    return { lines: _metroLinesCache || new Set(), stations: _metroStationsCache || new Set(), boards: _boardNamesCache || new Set() };
  }
}

/**
 * 校验并规范化地铁线路名称：确保与数据库 property_metro_lines 一致
 * 过滤掉数据库中不存在的线路名
 */
function validateMetroLines(rawLines, validLineSet) {
  if (!rawLines || !validLineSet || validLineSet.size === 0) return rawLines;
  const parts = String(rawLines).split(/[,，、]/).map(s => s.trim()).filter(Boolean);
  const validated = parts.filter(line => validLineSet.has(line));
  return validated.length > 0 ? validated.join(',') : rawLines;
}

/**
 * 校验并规范化地铁站点名称：确保与数据库 property_metro_stations 一致
 * 支持模糊匹配（站名+"站"后缀、去掉"站"后缀）
 */
function validateMetroStations(rawStations, validStationSet) {
  if (!rawStations || !validStationSet || validStationSet.size === 0) return rawStations;
  const parts = String(rawStations).split(/[,，、]/).map(s => s.trim()).filter(Boolean);
  const validated = [];
  for (const st of parts) {
    if (validStationSet.has(st)) {
      validated.push(st);
    } else if (validStationSet.has(st + '站')) {
      validated.push(st + '站');
    } else if (st.endsWith('站') && validStationSet.has(st.replace(/站$/, ''))) {
      validated.push(st.replace(/站$/, ''));
    } else {
      validated.push(st);
    }
  }
  return validated.length > 0 ? validated.join(',') : rawStations;
}

let RENTAL_COMPANY_NAMES = RENTAL_COMPANY_NAMES_FALLBACK;

function isGarbageCommunityName(name) {
  if (!name || name.length < 2) return true;
  if (GARBAGE_COMMUNITY_EXACT.has(name)) return true;
  if (RENTAL_COMPANY_NAMES.has(name)) return true;
  if (GARBAGE_COMMUNITY_KEYWORDS.some(kw => name.includes(kw))) return true;
  // Rule 2: 看房说明/钥匙位置 — 如"2楼钥匙在门口"、"X楼钥匙"等，非小区名
  if (/\d楼钥匙|钥匙在|钥匙放|门口拿钥匙|钥匙在门口/.test(name)) return true;
  // 上下文关键词：含"沿街"/"电梯"等但没有有效小区后缀 → 垃圾
  if (CONTEXT_GARBAGE_KEYWORDS.some(kw => name.includes(kw)) && !VALID_COMMUNITY_SUFFIXES.test(name)) return true;
  // "位于XX"/"位置XX" 描述性开头
  if (/^位[于在]/.test(name)) return true;
  // 业务性垃圾前缀开头（如"付佣金永康路209号""出租淮海中路1408号""整租一居"等）
  if (/^(付佣|包佣|免佣|租客|业主|出租|整租|合租|短租|长租|日租|月租|年租|急租)/.test(name)) return true;
  // 包含价格信息（如"3.5W"、"6800元"）
  if (/\d+\.?\d*[WwKk万千元]/.test(name)) return true;
  // 纯描述性短语：动词+名词（如"欢迎联系进群"、"明日看房"）
  if (/^(欢迎|请|可以|随时|明日|今天|今日|赶紧|抓紧|速速)/.test(name)) return true;
  // "全上海" / "全XX" 开头的泛称
  if (/^全[上中下东西南北]/.test(name)) return true;
  // 纯英文/数字+标点（如"F&B Space"、"G010"）
  if (/^[A-Za-z0-9\s&/.,_-]+$/.test(name)) return true;
  // 含"/" 且不是有效小区名（如"餐饮商铺/F&B Space"）
  if (/\//.test(name) && !/弄|路|号/.test(name)) return true;
  // 以"路"/"街"/"道"结尾的纯道路名（如"太原路""昭化路"），允许"路+弄/号"（如"陕西北路640弄"）
  if (/(?:路|街|大道)$/.test(name) && !/\d+弄|\d+号/.test(name)) return true;
  // 房屋特征描述词（如"带院子""有花园""含车位""送露台"），非小区名
  if (/^[带有含送赠自](?:院子|花园|庭院|天井|阳台|露台|天台|车位|地下室|储物间|衣帽间|书房|飘窗|壁炉|泳池|健身房)$/.test(name)) return true;
  // "X+院子/花园"等纯特征短语（如"大院子""小花园""私家花园"），非小区名
  if (/^(?:大|小|私家|独立|前|后|底楼|一楼)?(?:院子|庭院|天井|露台|天台|花园)$/.test(name)) return true;
  // 房源描述性短语（如"看中价格好谈""南北通带双阳台""一楼朝南带花园"）
  if (/价格|可谈|面议|好谈|手慢无|限时|随时入住|急租|降价|签[一两三]年|底价|特价/.test(name)) return true;
  // "X房X厅"/"X卧X卫" 等户型描述
  if (/[一两二三四五\d][房室卧][一两二三四五\d]?[厅卫]/.test(name) && !/弄|号|路/.test(name)) return true;
  // "X楼朝X"/"带阳台"/"带花园" 等楼层朝向描述
  if (/^[一二三四五六七八九十\d]+楼/.test(name)) return true;
  if (/^(朝南|朝北|朝东|朝西|南北通|东西向|阳光洒满)/.test(name)) return true;
  if (/^(服务|介绍|以及|合作|推广|咨询)/.test(name)) return true;
  return false;
}

/**
 * 当AI未能识别小区名时，用描述文本在POI库中反向查找匹配的小区
 * 按小区名长度降序匹配，优先匹配更精确的长名称
 * 支持：精确匹配 + 去后缀模糊匹配（如 "裕德路66弄小区" 匹配文案中的 "裕德路66弄"）
 */
async function matchCommunityFromText(propId, district) {
  try {
    const propRows = await query(
      'SELECT description, original_content, street FROM wechat_robot_expat_parsed_properties WHERE id = ? LIMIT 1',
      [propId]
    );
    const row = Array.isArray(propRows) && Array.isArray(propRows[0]) ? propRows[0]?.[0] : propRows?.[0];
    if (!row) return null;
    const fullText = [row.description || '', row.original_content || '', row.street || ''].join(' ');
    if (!fullText.trim()) return null;

    // 标签优先：文案中有"小区:XXX"等明确标签时直接用标签值查POI
    const LABEL_PATS_LOCAL = [
      /[?🏘🏠]?\s*小\s*区\s*[:：]\s*([\u4e00-\u9fa5A-Za-z0-9]{2,15})/,
      /[【\[]\s*小\s*区\s*[\]】]\s*[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9]{2,15})/,
      /小\s*区\s*名?\s*称?\s*[:：]\s*([\u4e00-\u9fa5A-Za-z0-9]{2,15})/,
    ];
    for (const lp of LABEL_PATS_LOCAL) {
      const lm = fullText.match(lp);
      if (lm && lm[1]) {
        const labelName = lm[1].trim();
        if (labelName.length >= 2) {
          const labelSql = `SELECT TRIM(community_name) as community_name, alias_names, district, nearest_metro_station, nearest_metro_line, nearest_metro_distance, latitude, longitude
                            FROM property_community_dict
                            WHERE is_enabled = 1
                              AND (TRIM(community_name) = ? OR community_name = ? OR alias_names LIKE ?)
                            LIMIT 30`;
          const labelRows = await query(labelSql, [labelName, labelName, `%${labelName}%`]);
          const lr = Array.isArray(labelRows) && Array.isArray(labelRows[0]) ? labelRows[0] : labelRows;
          if (lr && lr.length > 0) {
            const exact = lr.find((poi) => poi.community_name === labelName || hasExactPOIAlias(poi.alias_names, labelName));
            if (exact) return exact;
          }
        }
      }
    }

    let poiSql = 'SELECT TRIM(community_name) as community_name, alias_names, district, nearest_metro_station, nearest_metro_line, nearest_metro_distance, latitude, longitude FROM property_community_dict WHERE is_enabled = 1 AND community_name IS NOT NULL AND CHAR_LENGTH(TRIM(community_name)) >= 2';
    const poiParams = [];
    if (district) {
      poiSql += ' AND district = ?';
      poiParams.push(district);
    }
    poiSql += ' ORDER BY CHAR_LENGTH(TRIM(community_name)) DESC';

    const poiRows = await query(poiSql, poiParams);
    const rows = Array.isArray(poiRows) && Array.isArray(poiRows[0]) ? poiRows[0] : poiRows;
    if (!rows || rows.length === 0) return null;

    // 2字小区名智能边界匹配：功能词/地址词可作边界，名词性汉字连缀视为复合名
    function matchShortNameLocal(text, name) {
      if (name.length > 2) return text.includes(name);
      if (!text.includes(name)) return false;
      const BOUNDARY_TAIL = /[区省市县镇乡村弄号路街道的在是有于到从去为和与或及了吗呢也都还就边旁近靠临里处内外上下住租看叫做名找选对]$/;
      const BOUNDARY_HEAD = /^[的在是有于到从去为和与或及了吗呢也都还就不太很最出租售卖买房屋价格平米方厅卫室层楼带弄号后前东西南北边旁近靠临里处内外上下期栋幢|｜，,。！!？?\s\d\-—·•/\\()（）【】\[\]《》：:；;、🏠🏡🏘✨💛💰📍🌿🔥❤️💚🎈🏆]/;
      let sp = 0;
      while (sp < text.length) {
        const pos = text.indexOf(name, sp);
        if (pos === -1) break;
        sp = pos + 1;
        const endPos = pos + name.length;

        if (endPos < text.length) {
          const afterChar = text.charAt(endPos);
          if (/[\u4e00-\u9fa5]/.test(afterChar) && !BOUNDARY_HEAD.test(afterChar)) {
            continue;
          }
        }

        if (endPos < text.length && /^(路|街|大道)/.test(text.substring(endPos, Math.min(text.length, endPos + 2)))) continue;

        let chCnt = 0;
        for (let i = pos - 1; i >= 0 && i >= pos - 4; i--) {
          if (/[\u4e00-\u9fa5]/.test(text.charAt(i))) chCnt++; else break;
        }
        if (chCnt === 0) return true;
        if (BOUNDARY_TAIL.test(text.substring(Math.max(0, pos - chCnt), pos))) return true;
      }
      return false;
    }

    for (const poi of rows) {
      if (matchShortNameLocal(fullText, poi.community_name)) {
        return poi;
      }
    }

    // 别名精确匹配
    for (const poi of rows) {
      const aliases = parsePOIAliasNames(poi.alias_names);
      for (const alias of aliases) {
        if (matchShortNameLocal(fullText, alias)) {
          return poi;
        }
      }
    }

    // 去后缀模糊匹配
    const suffixes = ['小区', '公寓', '花苑', '家园', '苑', '城', '府', '庭', '坊', '里', '居'];
    for (const poi of rows) {
      const name = poi.community_name;
      for (const sfx of suffixes) {
        if (name.endsWith(sfx) && name.length > sfx.length + 2) {
          const shortName = name.slice(0, -sfx.length);
          if (shortName.length >= 3 && fullText.includes(shortName)) {
            return poi;
          }
        }
      }
    }

    // 无district时扩大搜索范围（包含2字小区）
    if (!district) {
      const globalRows = await query(
        'SELECT TRIM(community_name) as community_name, alias_names, district, nearest_metro_station, nearest_metro_line, nearest_metro_distance FROM property_community_dict WHERE is_enabled = 1 AND community_name IS NOT NULL AND CHAR_LENGTH(TRIM(community_name)) >= 2 ORDER BY CHAR_LENGTH(TRIM(community_name)) DESC LIMIT 5000'
      );
      const gRows = Array.isArray(globalRows) && Array.isArray(globalRows[0]) ? globalRows[0] : globalRows;
      if (gRows) {
        for (const poi of gRows) {
          if (matchShortNameLocal(fullText, poi.community_name)) return poi;
        }
        // 全局别名匹配（含2字别名）
        for (const poi of gRows) {
          const aliases = parsePOIAliasNames(poi.alias_names);
          for (const alias of aliases) {
            if (matchShortNameLocal(fullText, alias)) return poi;
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function correctDistrictFromPOI(community, aiDistrict) {
  if (!community) return aiDistrict;
  const poi = await lookupPOIByCommunityFuzzy(community, aiDistrict);
  return poi || aiDistrict;
}

/**
 * 按小区名查POI，支持模糊匹配（和泰花园小区→和泰花园）
 * 优先返回有地铁信息的POI，用于统一小区名并补全地铁
 */
async function lookupPOIByCommunityFuzzy(community, district) {
  if (!community) return null;
  const name = String(community).trim();
  if (name.length < 2) return null;
  try {
    // 1. 精确匹配 community_name（含经纬度，用于同步房源坐标）
    let sql = 'SELECT community_name, district, nearest_metro_station, nearest_metro_line, nearest_metro_distance, latitude, longitude FROM property_community_dict WHERE is_enabled = 1 AND community_name = ?';
    const params = [name];
    if (district) {
      sql += ' AND district = ?';
      params.push(district);
    }
    sql += ' LIMIT 10';
    let rows = await query(sql, params);
    rows = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
    if (rows && rows.length > 0) {
      if (!district) {
        const districtSet = new Set(rows.map(r => r.district).filter(Boolean));
        if (districtSet.size > 1) return null;
      }
      const withMetro = rows.find(r => r.nearest_metro_station && r.nearest_metro_station !== '无');
      return withMetro || rows[0];
    }
    // 1.5 精确匹配 alias_names 中的独立别名，优先解决短小区名识别不准的问题
    let aliasExactSql = 'SELECT community_name, district, alias_names, nearest_metro_station, nearest_metro_line, nearest_metro_distance, latitude, longitude FROM property_community_dict WHERE is_enabled = 1 AND alias_names IS NOT NULL AND alias_names LIKE ?';
    const aliasExactParams = [`%${name}%`];
    if (district) {
      aliasExactSql += ' AND district = ?';
      aliasExactParams.push(district);
    }
    aliasExactSql += ' LIMIT 50';
    let aliasExactRows = await query(aliasExactSql, aliasExactParams);
    aliasExactRows = Array.isArray(aliasExactRows) && Array.isArray(aliasExactRows[0]) ? aliasExactRows[0] : aliasExactRows;
    if (aliasExactRows && aliasExactRows.length > 0) {
      const exactAliasMatches = [];
      for (const poi of aliasExactRows) {
        if (hasExactPOIAlias(poi.alias_names, name)) exactAliasMatches.push(poi);
      }
      if (exactAliasMatches.length > 0) {
        if (!district) {
          const districtSet = new Set(exactAliasMatches.map(r => r.district).filter(Boolean));
          if (districtSet.size > 1) return null;
        }
        const withMetro = exactAliasMatches.find(r => r.nearest_metro_station && r.nearest_metro_station !== '无');
        return withMetro || exactAliasMatches[0];
      }
    }
    // 2. 别名匹配：在 alias_names 字段中搜索
    let aliasSql = 'SELECT community_name, district, nearest_metro_station, nearest_metro_line, nearest_metro_distance, latitude, longitude FROM property_community_dict WHERE is_enabled = 1 AND alias_names IS NOT NULL AND alias_names LIKE ?';
    const aliasParams = [`%${name}%`];
    if (district) {
      aliasSql += ' AND district = ?';
      aliasParams.push(district);
    }
    aliasSql += ' LIMIT 20';
    let aliasRows = await query(aliasSql, aliasParams);
    aliasRows = Array.isArray(aliasRows) && Array.isArray(aliasRows[0]) ? aliasRows[0] : aliasRows;
    if (aliasRows && aliasRows.length > 0) {
      if (!district) {
        const districtSet = new Set(aliasRows.map(r => r.district).filter(Boolean));
        if (districtSet.size > 1) return null;
      }
      for (const poi of aliasRows) {
        if (hasExactPOIAlias(poi.alias_names, name)) {
          return poi;
        }
      }
    }
    // 3. 模糊匹配：去后缀 小区/花园/花苑/家园
    const suffixes = ['小区', '花园', '花苑', '家园'];
    for (const sfx of suffixes) {
      if (name.endsWith(sfx) && name.length > sfx.length + 2) {
        const shortName = name.slice(0, -sfx.length);
        let sql2 = 'SELECT community_name, district, nearest_metro_station, nearest_metro_line, nearest_metro_distance, latitude, longitude FROM property_community_dict WHERE is_enabled = 1 AND community_name = ?';
        const params2 = [shortName];
        if (district) {
          sql2 += ' AND district = ?';
          params2.push(district);
        }
        sql2 += ' LIMIT 10';
        let rows2 = await query(sql2, params2);
        rows2 = Array.isArray(rows2) && Array.isArray(rows2[0]) ? rows2[0] : rows2;
        if (rows2 && rows2.length > 0) {
          if (!district) {
            const districtSet = new Set(rows2.map(r => r.district).filter(Boolean));
            if (districtSet.size > 1) return null;
          }
          const withMetro = rows2.find(r => r.nearest_metro_station && r.nearest_metro_station !== '无');
          return withMetro || rows2[0];
        }
      }
    }
    // 4. 名称包含匹配，优先长度更接近的结果，解决如“九庐高区”这类短名字无法精确落库的问题
    let fuzzySql = 'SELECT community_name, district, nearest_metro_station, nearest_metro_line, nearest_metro_distance, latitude, longitude FROM property_community_dict WHERE is_enabled = 1 AND community_name LIKE ?';
    const fuzzyParams = [`%${name}%`];
    if (district) {
      fuzzySql += ' AND district = ?';
      fuzzyParams.push(district);
    }
    fuzzySql += ' ORDER BY ABS(CHAR_LENGTH(community_name) - ?) ASC, CHAR_LENGTH(community_name) ASC LIMIT 10';
    fuzzyParams.push(name.length);
    let fuzzyRows = await query(fuzzySql, fuzzyParams);
    fuzzyRows = Array.isArray(fuzzyRows) && Array.isArray(fuzzyRows[0]) ? fuzzyRows[0] : fuzzyRows;
    if (fuzzyRows && fuzzyRows.length > 0) {
      return fuzzyRows[0];
    }
    // 4. 无district限制时再试
    if (district) {
      const fallback = await lookupPOIByCommunityFuzzy(community, null);
      if (fallback) return fallback;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 根据地铁站名查找所属线路（支持带/不带"站"后缀，多站名逗号分隔）
 * 返回线路名（如"3号线,4号线"），无匹配返回null
 */
async function lookupMetroLineByStation(stationName) {
  if (!stationName) return null;
  const raw = String(stationName).trim().replace(/[站]$/, '');
  if (!raw || raw === '-' || raw === '无') return null;
  const names = raw.split(/[,，、\/]/).map(s => s.trim().replace(/[站]$/, '')).filter(Boolean);
  if (!names.length) return null;
  try {
    const placeholders = names.map(() => '?').join(',');
    const rows = await query(
      `SELECT DISTINCT l.name_cn FROM property_metro_stations s
       JOIN property_metro_lines l ON s.line_id = l.id
       WHERE s.is_active = 1 AND s.name_cn IN (${placeholders})
       ORDER BY l.sort_order, l.id`,
      names
    );
    const list = Array.isArray(rows) ? (Array.isArray(rows[0]) && Array.isArray(rows[0][0]) ? rows[0] : rows) : [];
    const lines = list.map(r => r.name_cn).filter(Boolean);
    return lines.length ? [...new Set(lines)].join(',') : null;
  } catch {
    return null;
  }
}

/**
 * 将AI解析结果更新到数据库（含校验 + POI自动校正）
 */
async function updateParsedPropertyFromAI(propId, parsed) {
  RENTAL_COMPANY_NAMES = await loadRentalCompanyNames();
  await loadValidDistricts();
  const strictAiValidation = parsed.__strict_ai_validation === true;
  const updateData = {};
  if (parsed.community && typeof parsed.community === 'string' && parsed.community.length >= 2 && parsed.community.length <= 50) {
    if (!isGarbageCommunityName(parsed.community) && !isInvalidCommunityName(parsed.community)) {
      updateData.community = parsed.community;
    }
  }
  if (parsed.district && typeof parsed.district === 'string') {
    // 严格校验district必须是上海16个合法区名
    const rawDist = String(parsed.district).trim();
    const normDist = rawDist.replace(/新?区$/, '');
    const dMap = {
      黄浦: '黄浦区', 徐汇: '徐汇区', 长宁: '长宁区', 静安: '静安区',
      普陀: '普陀区', 虹口: '虹口区', 杨浦: '杨浦区', 闵行: '闵行区',
      宝山: '宝山区', 嘉定: '嘉定区', 浦东: '浦东新区', 金山: '金山区',
      松江: '松江区', 青浦: '青浦区', 奉贤: '奉贤区', 崇明: '崇明区',
    };
    const validDist = dMap[normDist] || (VALID_DISTRICTS.includes(rawDist) ? rawDist : null);
    if (validDist) {
      updateData.district = validDist;
    }
  }
  // 价格标准化处理：需要original_content来辅助判断日租/出售
  let origContent = parsed.original_content || '';
  if (!origContent) {
    try {
      const [row] = await query('SELECT original_content FROM wechat_robot_expat_parsed_properties WHERE id = ? LIMIT 1', [propId]);
      origContent = (Array.isArray(row) ? row[0]?.original_content : row?.original_content) || '';
    } catch {}
  }
  const rawPriceText = String(parsed.price || '').trim();
  const rawPriceValue = parsed.price_value;
  const priceResult = normalizeParsedPrice(rawPriceValue, rawPriceText, origContent);
  if (priceResult.price_value !== undefined) updateData.price_value = priceResult.price_value;
  if (priceResult.price !== undefined) updateData.price = priceResult.price;

  // Rule 6: 原文含出售关键词时，强制标记为出售类型（即使价格看起来像租金）
  const SALE_DETECT_RE = /出售|售价|急售|仅售|诚售|诚意出售|业主急卖|挂牌价|到手价|转让价|售卖|卖房/;
  if (parsed._is_sale || SALE_DETECT_RE.test(origContent)) {
    if (updateData.price_value && updateData.price_value > 0) {
      updateData.price = `¥${updateData.price_value.toLocaleString()}(售)`;
      updateData.price_value = 0;
    } else if (!updateData.price || !updateData.price.includes('(售)')) {
      updateData.price = updateData.price ? `${updateData.price}(售)` : '(售)';
      updateData.price_value = 0;
    }
    updateData.is_sale = 1;
  } else if (updateData.price_value && updateData.price_value > MAX_RENT_PRICE) {
    updateData.is_sale = 1;
  } else {
    updateData.is_sale = 0;
  }

  const explicitLayout = origContent ? parseLayoutXYZ(origContent) : null;
  if (strictAiValidation) {
    const br = parseBedroomCount(parsed.bedrooms, null);
    if (br && br >= 1 && br <= 9) updateData.bedrooms = br;
    const bt = parseBathroomCount(parsed.bathrooms, null);
    if (bt != null && bt >= 0 && bt <= 9) updateData.bathrooms = bt;
    const lr = normalizeAiLivingrooms(parsed.livingrooms);
    if (lr != null) updateData.livingrooms = lr;
    if (explicitLayout) {
      if (updateData.bedrooms == null || updateData.bedrooms !== explicitLayout.bedrooms) {
        throw new Error('AI校验未通过: 卧室与原文不一致');
      }
      if (updateData.bathrooms == null || updateData.bathrooms !== explicitLayout.bathrooms) {
        throw new Error('AI校验未通过: 卫生间与原文不一致');
      }
      if (explicitLayout.livingrooms != null && (updateData.livingrooms == null || updateData.livingrooms !== explicitLayout.livingrooms)) {
        throw new Error('AI校验未通过: 客厅与原文不一致');
      }
    }
  } else {
    // 户型解析：优先从原文提取 X/Y/Z 格式（如 "1/2/1" = 1室2厅1卫），避免AI误解析
    const xyzLayout = parseLayoutXYZ(origContent);
    if (xyzLayout) {
      updateData.bedrooms = xyzLayout.bedrooms;
      updateData.livingrooms = xyzLayout.livingrooms;
      updateData.bathrooms = xyzLayout.bathrooms;
    } else {
      // 卧室数量：优先从原文识别 2+1房=3室，AI 可能误解析为 1
      const br = parseBedroomCount(parsed.bedrooms, origContent);
      if (br && br >= 1 && br <= 9) updateData.bedrooms = br;
      // 卫生间数量：优先从原文识别，避免地铁线路数字被误解析为卫生间数
      const bt = parseBathroomCount(parsed.bathrooms, origContent);
      if (bt != null && bt >= 0 && bt <= 9) updateData.bathrooms = bt;
      // 客厅数量
      if (parsed.livingrooms != null) {
        const lr = parseInt(parsed.livingrooms, 10);
        if (lr >= 0 && lr <= 9) updateData.livingrooms = lr;
      }
    }
  }
  if (parsed.area_sqm != null) {
    const area = parseInt(parsed.area_sqm, 10);
    if (area >= 10 && area <= 2000) updateData.area_sqm = area;
  }
  if (parsed.metro_lines != null) {
    updateData.metro_lines = String(parsed.metro_lines || '');
  }
  if (parsed.metro_stations != null) {
    updateData.metro_stations = String(parsed.metro_stations || '');
  }
  if (parsed.metro_distance != null) {
    const dist = parseInt(parsed.metro_distance, 10);
    if (dist >= 0 && dist <= 99999) updateData.metro_distance = dist;
  }
  if (parsed.street || parsed.address) {
    const normalizedStreet = normalizeAiStreet(parsed.street || parsed.address);
    if (normalizedStreet) updateData.street = normalizedStreet;
  }
  if (parsed.contact_info != null) {
    updateData.contact_info = String(parsed.contact_info || '');
  }

  updateData.outdoor_features = parseBoolField(parsed.outdoor_features, parsed.has_balcony, parsed.has_terrace, parsed.has_garden);
  updateData.has_elevator = parseBool(parsed.has_elevator) ? 1 : 0;
  updateData.has_parking = parseBool(parsed.has_parking) ? 1 : 0;
  updateData.has_commission = parseBool(parsed.has_commission) ? 1 : 0;
  updateData.is_duplex = parseBool(parsed.is_duplex) ? 1 : 0;

  // POI智能校正：用POI数据库校正AI解析的district、地铁信息和经纬度
  if (updateData.community) {
    const isDistrictInvalid = !updateData.district || !VALID_DISTRICTS.includes(updateData.district);
    const poiMatch = await correctDistrictFromPOI(updateData.community, updateData.district);
    if (poiMatch && typeof poiMatch === 'object') {
      if (isDistrictInvalid || !updateData.district || updateData.district !== poiMatch.district) {
        updateData.district = poiMatch.district;
      }
      if (!updateData.metro_stations && poiMatch.nearest_metro_station) {
        updateData.metro_stations = poiMatch.nearest_metro_station;
      }
      if (!updateData.metro_lines && poiMatch.nearest_metro_line) {
        updateData.metro_lines = poiMatch.nearest_metro_line;
      }
      if (!updateData.metro_distance && poiMatch.nearest_metro_distance) {
        updateData.metro_distance = poiMatch.nearest_metro_distance;
      }
      if (poiMatch.latitude && poiMatch.longitude && parseFloat(poiMatch.latitude) !== 0 && parseFloat(poiMatch.longitude) !== 0) {
        updateData.latitude = poiMatch.latitude;
        updateData.longitude = poiMatch.longitude;
      }
    }
  }
  if (hasImplicitElevatorCommunity(updateData.community)) {
    updateData.has_elevator = 1;
  }

  // 小区名解析：优先 POI 匹配，无则地址，无则地标，无则区域。小区字段不能为空
  const validDistrict = (updateData.district && VALID_DISTRICTS.includes(updateData.district)) ? updateData.district : null;
  let contentBasedCommunity = null;
  let matchedPOI = null;
  // 1) 优先 POI 匹配
  try {
    matchedPOI = await matchCommunityFromText(propId, validDistrict);
    if (matchedPOI) contentBasedCommunity = matchedPOI.community_name;
  } catch {}
  // 2) 无 POI 时提取详细地址（路+弄/号，如陕西北路640弄、漕溪北路468号）
  if (!contentBasedCommunity && origContent) {
    contentBasedCommunity = extractAddressFromContent(origContent);
  }
  // 3) 无地址时用地标（静安寺、中山公园等）
  if (!contentBasedCommunity && origContent) {
    contentBasedCommunity = extractFallbackLocation(origContent, null);
  }
  // 4) 无地标时用区域
  if (!contentBasedCommunity && updateData.district) {
    contentBasedCommunity = String(updateData.district).replace(/区$/, '');
  }
  // 5) 无区域时从文案提取区域名
  if (!contentBasedCommunity && origContent) {
    const districtFromText = (origContent.match(/(徐汇|静安|长宁|普陀|虹口|杨浦|黄浦|浦东|闵行|宝山|嘉定|松江|青浦|奉贤|金山|崇明)(?:区|路|站|寺|公园|)?/) || [])[1];
    if (districtFromText && VALID_DISTRICTS.some(d => d.includes(districtFromText))) contentBasedCommunity = districtFromText;
  }
  // 6) 最终兜底，小区不能为空
  if (!contentBasedCommunity) contentBasedCommunity = '上海';

  const aiCommunityValid = updateData.community && !isInvalidCommunityName(updateData.community) && !isGarbageCommunityName(updateData.community);
  let finalCommunity = contentBasedCommunity;
  if (contentBasedCommunity && !matchedPOI) {
    try {
      const poiForFill = await lookupPOIByCommunityFuzzy(contentBasedCommunity, validDistrict || updateData.district);
      if (poiForFill) {
        finalCommunity = poiForFill.community_name;
        if (!updateData.district || !VALID_DISTRICTS.includes(updateData.district)) updateData.district = poiForFill.district;
        if (!updateData.metro_stations && poiForFill.nearest_metro_station) updateData.metro_stations = poiForFill.nearest_metro_station;
        if (!updateData.metro_lines && poiForFill.nearest_metro_line) updateData.metro_lines = poiForFill.nearest_metro_line;
        if ((updateData.metro_distance == null || updateData.metro_distance === '') && poiForFill.nearest_metro_distance) updateData.metro_distance = poiForFill.nearest_metro_distance;
        if (poiForFill.latitude && poiForFill.longitude && parseFloat(poiForFill.latitude) !== 0 && parseFloat(poiForFill.longitude) !== 0) {
          updateData.latitude = poiForFill.latitude;
          updateData.longitude = poiForFill.longitude;
        }
      }
    } catch {}
  } else if (matchedPOI) {
    if (!updateData.district || !VALID_DISTRICTS.includes(updateData.district)) updateData.district = matchedPOI.district;
    if (!updateData.metro_stations && matchedPOI.nearest_metro_station) updateData.metro_stations = matchedPOI.nearest_metro_station;
    if (!updateData.metro_lines && matchedPOI.nearest_metro_line) updateData.metro_lines = matchedPOI.nearest_metro_line;
    if ((updateData.metro_distance == null || updateData.metro_distance === '') && matchedPOI.nearest_metro_distance) updateData.metro_distance = matchedPOI.nearest_metro_distance;
    if (matchedPOI.latitude && matchedPOI.longitude && parseFloat(matchedPOI.latitude) !== 0 && parseFloat(matchedPOI.longitude) !== 0) {
      updateData.latitude = matchedPOI.latitude;
      updateData.longitude = matchedPOI.longitude;
    }
  }
  if (strictAiValidation && aiCommunityValid) {
    updateData.community = parsed.community;
  } else {
    updateData.community = aiCommunityValid && !contentBasedCommunity ? updateData.community : finalCommunity;
  }

  // 路+弄/号格式的地址型小区名，去掉末尾多余的"小区"（如"兴国路271弄小区"→"兴国路271弄"）
  if (updateData.community && /[\d]+[弄号]小区$/.test(updateData.community)) {
    updateData.community = updateData.community.replace(/小区$/, '');
  }
  // 弄后面的号统一去除（如"长乐路196弄69号"→"长乐路196弄"）
  if (updateData.community && /\d+弄\d+号/.test(updateData.community)) {
    updateData.community = updateData.community.replace(/(\d+弄)\d+号.*$/, '$1');
  }

  // Rule 5: 小区名带"花园"的禁止被识别成户外花园，写入前过滤
  if (updateData.outdoor_features && typeof updateData.outdoor_features === 'string' && updateData.community && updateData.community.includes('花园')) {
    const filtered = updateData.outdoor_features.split(',').map(f => f.trim()).filter(f => f && f !== '花园');
    updateData.outdoor_features = filtered.length ? filtered.join(',') : null;
  }

  // 有站点但无线路时，通过站名反查线路（确保二者同时存在）
  const stVal = updateData.metro_stations;
  const lnVal = updateData.metro_lines;
  const hasStation = stVal && stVal !== '-' && stVal !== '无';
  const hasLine = lnVal && lnVal !== '-' && lnVal !== '无';
  if (hasStation && !hasLine) {
    const lookedUpLine = await lookupMetroLineByStation(stVal);
    if (lookedUpLine) updateData.metro_lines = lookedUpLine;
  }
  // 有线路但无站点 → 尝试从POI回填站点（不要清空线路，前端有POI回退显示）
  if (!hasStation && hasLine && matchedPOI && matchedPOI.nearest_metro_station) {
    updateData.metro_stations = matchedPOI.nearest_metro_station;
    if (matchedPOI.nearest_metro_distance && !updateData.metro_distance) {
      updateData.metro_distance = matchedPOI.nearest_metro_distance;
    }
  }

  // Rule 7: 校验地铁线路和站点名称与管理员后台设置一致
  try {
    const metroData = await loadMetroData();
    if (updateData.metro_lines && metroData.lines.size > 0) {
      updateData.metro_lines = validateMetroLines(updateData.metro_lines, metroData.lines);
    }
    if (updateData.metro_stations && metroData.stations.size > 0) {
      updateData.metro_stations = validateMetroStations(updateData.metro_stations, metroData.stations);
    }
  } catch {}

  // Rule 1&7: 区域百分百要完成解析，确保district字段不为空
  if (!updateData.district || !VALID_DISTRICTS.includes(updateData.district)) {
    // 从原文中尝试提取区域
    if (origContent) {
      const distMatchFromContent = origContent.match(/(黄浦|徐汇|长宁|静安|普陀|虹口|杨浦|闵行|宝山|嘉定|浦东|金山|松江|青浦|奉贤|崇明)\s*(?:区|新区)?/);
      if (distMatchFromContent) {
        const dMap = {
          黄浦: '黄浦区', 徐汇: '徐汇区', 长宁: '长宁区', 静安: '静安区',
          普陀: '普陀区', 虹口: '虹口区', 杨浦: '杨浦区', 闵行: '闵行区',
          宝山: '宝山区', 嘉定: '嘉定区', 浦东: '浦东新区', 金山: '金山区',
          松江: '松江区', 青浦: '青浦区', 奉贤: '奉贤区', 崇明: '崇明区',
        };
        updateData.district = dMap[distMatchFromContent[1]] || distMatchFromContent[0];
      }
    }
    // 从小区名推断区域（通过POI查找）
    if ((!updateData.district || !VALID_DISTRICTS.includes(updateData.district)) && updateData.community) {
      try {
        const distPOI = await lookupPOIByCommunityFuzzy(updateData.community, null);
        if (distPOI && distPOI.district && VALID_DISTRICTS.includes(distPOI.district)) {
          updateData.district = distPOI.district;
        }
      } catch {}
    }
    // 最终兜底：从数据库查询该记录已有的district
    if (!updateData.district || !VALID_DISTRICTS.includes(updateData.district)) {
      try {
        const [existRow] = await query('SELECT district FROM wechat_robot_expat_parsed_properties WHERE id = ? LIMIT 1', [propId]);
        const existDist = Array.isArray(existRow) ? existRow[0]?.district : existRow?.district;
        if (existDist && VALID_DISTRICTS.includes(existDist)) {
          updateData.district = existDist;
        }
      } catch {}
    }
  }

  // 非严格模式下兜底卧室和卫生间
  if (!strictAiValidation) {
    if (!updateData.bedrooms || updateData.bedrooms <= 0) updateData.bedrooms = 1;
    if (!updateData.bathrooms || updateData.bathrooms <= 0) updateData.bathrooms = 1;
  }

  // ⑧ 最终严格校验：区域值必须是标准区域，禁止保存非标准值
  if (updateData.district) {
    if (!VALID_DISTRICTS.includes(updateData.district)) {
      // 尝试映射标准化
      const districtFinalMap = {
        黄浦: '黄浦区', 徐汇: '徐汇区', 长宁: '长宁区', 静安: '静安区',
        普陀: '普陀区', 虹口: '虹口区', 杨浦: '杨浦区', 闵行: '闵行区',
        宝山: '宝山区', 嘉定: '嘉定区', 浦东: '浦东新区', 浦东新: '浦东新区',
        金山: '金山区', 松江: '松江区', 青浦: '青浦区', 奉贤: '奉贤区', 崇明: '崇明区',
      };
      const normalized = String(updateData.district).replace(/新?区$/, '').replace(/^上海/, '');
      const mapped = districtFinalMap[normalized] || districtFinalMap[normalized.replace(/区$/, '')];
      if (mapped && VALID_DISTRICTS.includes(mapped)) {
        updateData.district = mapped;
      } else {
        // 无法映射到标准区域，不保存非标准值（保留原有值）
        delete updateData.district;
        logger.warn('解析区域值非标准，已跳过', { propId, invalidDistrict: updateData.district });
      }
    }
  }

  updateData.is_ai_parsed = 1;
  updateData.parse_status = 'ai_parsed';
  updateData.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Rule 8: 解析结果必须与原文匹配，不匹配则视为解析错误，不得写入有问题的字段
  const validation = ContentMatchValidator.validateParsedData(updateData, origContent);
  if (!validation.valid && validation.issues && validation.issues.length > 0) {
    if (strictAiValidation) {
      throw new Error(`AI校验未通过: ${formatAiValidationIssues(validation.issues)}`);
    }
    logger.warn('Rule 8 解析校验未通过，移除有问题的字段', { propId, issues: validation.issues });
    for (const issue of validation.issues) {
      if (issue.includes('price_value')) {
        delete updateData.price_value;
        delete updateData.price;
      } else if (issue.includes('community')) {
        updateData.community = updateData.district ? String(updateData.district).replace(/区$/, '') : '上海';
      } else if (issue.includes('bedrooms')) {
        updateData.bedrooms = 1;
      }
    }
  }

  if (strictAiValidation) {
    // 新规则：文案未写几房几卫时，这两个字段也不能为空，统一默认 1
    if (!updateData.bedrooms || updateData.bedrooms <= 0) updateData.bedrooms = 1;
    if (updateData.bathrooms == null || updateData.bathrooms < 0) updateData.bathrooms = 1;

    // 如果原文明确写了户型/卧卫，则仍要求与原文一致，不能用默认值掩盖冲突
    if (hasExplicitLayoutOrBathHint(origContent)) {
      const explicitBr = parseBedroomCount(null, origContent);
      const explicitBt = parseBathroomCount(null, origContent);
      if (explicitBr != null && updateData.bedrooms !== explicitBr) {
        throw new Error('AI校验未通过: 卧室与原文不一致');
      }
      if (explicitBt != null && updateData.bathrooms !== explicitBt) {
        throw new Error('AI校验未通过: 卫生间与原文不一致');
      }
    }

    if (!updateData.bedrooms || updateData.bedrooms <= 0) {
      throw new Error('AI校验未通过: 缺少卧室');
    }
    if (updateData.bathrooms == null || updateData.bathrooms < 0) {
      throw new Error('AI校验未通过: 缺少卫生间');
    }
    if (!updateData.price_value || updateData.price_value <= 0) {
      throw new Error('AI校验未通过: 缺少价格');
    }
    if (!updateData.community) {
      throw new Error('AI校验未通过: 缺少小区');
    }
    if (!updateData.district) {
      throw new Error('AI校验未通过: 缺少区域');
    }
    const mustHaveAddress = hasExplicitAddressHint(origContent);
    if (mustHaveAddress && !updateData.street) {
      throw new Error('AI校验未通过: 缺少地址');
    }
  }

  // 自动生成 content_hash 用于去重
  if (origContent && !updateData.content_hash) {
    const hash = generateContentHash(origContent);
    if (hash) updateData.content_hash = hash;
  }

  // 自动分类 community_type: 0=未分类, 1=真实小区, 2=区域名, 3=商圈地标, 4=路名地址, 5=其他
  if (updateData.community) {
    updateData.community_type = await classifyCommunityName(updateData.community);
  }

  const setClauses = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
  const vals = Object.values(updateData);
  vals.push(propId);
  await query(`UPDATE wechat_robot_expat_parsed_properties SET ${setClauses} WHERE id = ?`, vals);
  await syncPublisherContactByParsedId(propId);

  // POI同步：仅补全已有POI记录的缺失字段，不再自动创建新记录（需人工判定导入）
  if (updateData.community && updateData.district) {
    syncExistingPOIData(updateData.community, updateData.district, {
      metro_lines: updateData.metro_lines,
      metro_stations: updateData.metro_stations,
      street: updateData.street,
    }).catch(() => {});
  }
}

/**
 * 核心解析入口：规则先行 → POI匹配 → AI补充校验
 * 步骤1: 规则解析提取所有可结构化信息
 * 步骤2: POI数据库匹配小区名（确保100%准确）
 * 步骤3: AI补充规则未能提取的字段，并校验规则结果
 * @param {string} content - 朋友圈原文
 * @param {Object} aiModel - AI模型配置
 * @param {string} aiPrompt - AI提示词
 * @returns {Object|null} 合并后的解析结果
 */
async function parsePropertyContent(content, aiModel, aiPrompt, options = {}) {
  if (!content) return null;
  const { requireAiValidation = false, allowMissingAddress = false } = options || {};

  // 加载数据库包租公司名单到内存（带缓存）
  RENTAL_COMPANY_NAMES = await loadRentalCompanyNames();
  // Rule 7: 从数据库加载区域列表，确保与管理员后台一致
  await loadValidDistricts();
  // 预加载地铁站名+商圈名缓存，用于小区名校验
  await loadMetroData();

  // === 步骤1: 规则先行解析 ===
  const ruleData = ruleBasedFullParse(content);
  logger.info('规则解析结果', { ruleData: JSON.stringify(ruleData).substring(0, 300) });

  // === 步骤2: POI数据库优先匹配小区名 ===
  let poiMatch = null;
  try {
    poiMatch = await matchPOIBeforeAI(content, ruleData.district || null);
  } catch (e) {
    logger.warn('POI前置匹配异常', { error: e.message });
  }

  if (poiMatch) {
    ruleData.community = poiMatch.community_name;
    if (poiMatch.address && !ruleData.street) {
      ruleData.street = poiMatch.address;
    }
    if (poiMatch.district && VALID_DISTRICTS.includes(poiMatch.district)) {
      ruleData.district = poiMatch.district;
    }
    if (poiMatch.nearest_metro_station && poiMatch.nearest_metro_station !== '无') {
      if (!ruleData.metro_stations) ruleData.metro_stations = poiMatch.nearest_metro_station;
    }
    if (poiMatch.nearest_metro_line) {
      if (!ruleData.metro_lines) ruleData.metro_lines = poiMatch.nearest_metro_line;
    }
    if (poiMatch.nearest_metro_distance) {
      if (!ruleData.metro_distance) ruleData.metro_distance = poiMatch.nearest_metro_distance;
    }
    if (poiMatch.latitude && poiMatch.longitude && parseFloat(poiMatch.latitude) !== 0 && parseFloat(poiMatch.longitude) !== 0) {
      ruleData.latitude = poiMatch.latitude;
      ruleData.longitude = poiMatch.longitude;
    }
    logger.info('POI匹配成功', { community: poiMatch.community_name, district: poiMatch.district });
  } else if (ruleData._rule_community && !isGarbageCommunityName(ruleData._rule_community) && !isInvalidCommunityName(ruleData._rule_community)) {
    // Rule 2: 无POI时优先使用规则提取的地址（路+弄/号，如永嘉路229弄6号）
    ruleData.community = ruleData._rule_community;
    logger.info('规则地址提取', { community: ruleData._rule_community });
  }

  // === 步骤3: AI补充校验 ===
  // 判断规则解析是否已足够完整（有小区名+价格+户型 = 核心字段齐全）
  const hasCoreCommunity = ruleData.community && !isGarbageCommunityName(ruleData.community) && !isInvalidCommunityName(ruleData.community);
  const hasCorePrice = ruleData.price_value && ruleData.price_value > 0;
  const hasCoreBedrooms = ruleData.bedrooms && ruleData.bedrooms > 0;
  const ruleComplete = hasCoreCommunity && hasCorePrice && hasCoreBedrooms;

  let aiData = null;
  let aiErrorMessage = '';
  try {
    aiData = await callAIParse(aiModel, aiPrompt, content);
  } catch (e) {
    aiErrorMessage = e.message || 'AI模型调用失败';
    logger.warn('AI解析异常，使用纯规则结果', { error: e.message });
  }

  if (!aiData) {
    if (requireAiValidation) {
      throw new Error(`AI模型异常: ${aiErrorMessage || 'AI模型不可用或返回了无效结果，当前解析已中止'}`);
    }
    // AI失败，返回规则+POI结果
    if (ruleData.street && !ruleData.address) {
      ruleData.address = ruleData.street;
    }
    return Object.keys(ruleData).length > 0 ? ruleData : null;
  }

  const validationResult = validateAiAgainstRules(aiData, ruleData, poiMatch, { requireAiValidation, allowMissingAddress });
  if (requireAiValidation && validationResult.status !== 'pass') {
    throw new Error(`AI校验未通过: ${formatAiValidationIssues(validationResult.issues)}`);
  }

  // === 步骤4: 合并策略 — AI主导，规则只做校验和非核心补充 ===
  const merged = { ...aiData };
  merged.__strict_ai_validation = requireAiValidation;

  if (validationResult.normalized.community) {
    merged.community = poiMatch?.community_name || validationResult.normalized.community;
  } else if (!requireAiValidation && hasCoreCommunity) {
    merged.community = ruleData.community;
  }

  if (merged.community && /[\d]+[弄号]小区$/.test(merged.community)) {
    merged.community = merged.community.replace(/小区$/, '');
  }

  if (validationResult.normalized.district) {
    merged.district = validationResult.normalized.district;
  } else if (!requireAiValidation && ruleData.district && VALID_DISTRICTS.includes(ruleData.district)) {
    merged.district = ruleData.district;
  }

  if (!requireAiValidation && ruleData.bedrooms && ruleData.bedrooms > 0) {
    // 非严格模式下，文案规则明确给出卧室数时强制优先规则，避免 AI 将“2房”误写成“1房”
    merged.bedrooms = ruleData.bedrooms;
  } else if (validationResult.normalized.bedrooms != null) {
    merged.bedrooms = validationResult.normalized.bedrooms;
  }

  if (validationResult.normalized.livingrooms != null) merged.livingrooms = validationResult.normalized.livingrooms;
  else if (!requireAiValidation && ruleData.livingrooms != null) merged.livingrooms = ruleData.livingrooms;

  if (validationResult.normalized.bathrooms != null) merged.bathrooms = validationResult.normalized.bathrooms;
  else if (!requireAiValidation && ruleData.bathrooms != null) merged.bathrooms = ruleData.bathrooms;

  if (validationResult.normalized.price_value != null) {
    merged.price_value = validationResult.normalized.price_value;
    if (!merged.price) merged.price = String(validationResult.normalized.price_value);
  } else if (!requireAiValidation && ruleData.price_value && ruleData.price_value > 0) {
    merged.price_value = ruleData.price_value;
    if (ruleData.price) merged.price = ruleData.price;
  }

  if (ruleData.area_sqm && ruleData.area_sqm > 0) merged.area_sqm = ruleData.area_sqm;

  if (ruleData.metro_lines) merged.metro_lines = ruleData.metro_lines;
  if (ruleData.metro_stations) merged.metro_stations = ruleData.metro_stations;

  if (validationResult.normalized.street) {
    merged.street = validationResult.normalized.street;
  } else if (!requireAiValidation && ruleData.street) {
    merged.street = ruleData.street;
  }
  if (merged.street && !merged.address) merged.address = merged.street;

  // 其他布尔字段：规则结果优先
  if (ruleData.has_elevator) merged.has_elevator = true;
  if (ruleData.has_parking) merged.has_parking = true;
  if (ruleData.has_commission) merged.has_commission = true;
  if (ruleData.is_duplex) merged.is_duplex = true;
  if (ruleData.outdoor_features) merged.outdoor_features = ruleData.outdoor_features;

  // 联系方式：规则结果优先
  if (ruleData.contact_info) merged.contact_info = ruleData.contact_info;

  // Rule 6: 出售类型标记传递（规则检测到的出售标志）
  if (ruleData._is_sale) merged._is_sale = true;

  // 全局兜底：卧室和卫生间不能为空，缺失时默认1
  if (!merged.bedrooms || Number(merged.bedrooms) <= 0) {
    merged.bedrooms = 1;
  }
  if (merged.bathrooms == null || Number(merged.bathrooms) < 0) {
    merged.bathrooms = 1;
  }

  return merged;
}

/**
 * 确保小区在POI表中有记录，不存在则创建并自动地理编码
 * 先精确匹配(name+district)，再按名称匹配，避免创建无效重复记录
 */
/**
 * 仅补全已存在POI记录的缺失字段，不创建新记录
 */
async function syncExistingPOIData(community, district, extraData = {}) {
  try {
    const existingRows = await query(
      'SELECT id, nearest_metro_line, nearest_metro_station, street FROM property_community_dict WHERE community_name = ? AND district = ? LIMIT 1',
      [community, district]
    );
    const existing = Array.isArray(existingRows) && Array.isArray(existingRows[0]) ? existingRows[0]?.[0] : existingRows?.[0];
    if (!existing) return;
    const updates = [];
    const params = [];
    if ((!existing.nearest_metro_line || existing.nearest_metro_line === '') && extraData.metro_lines) {
      updates.push('nearest_metro_line = ?'); params.push(extraData.metro_lines);
    }
    if ((!existing.nearest_metro_station || existing.nearest_metro_station === '') && extraData.metro_stations) {
      updates.push('nearest_metro_station = ?'); params.push(extraData.metro_stations);
    }
    if ((!existing.street || existing.street === '') && extraData.street) {
      updates.push('street = ?'); params.push(extraData.street);
    }
    if (updates.length > 0) {
      params.push(existing.id);
      await query('UPDATE property_community_dict SET ' + updates.join(', ') + ', updated_at = NOW() WHERE id = ?', params);
    }
  } catch {}
}

/**
 * 仅补全已存在POI记录的缺失字段，禁止自动创建新POI记录
 * POI新增必须由管理员手动操作或朋友圈一键导入
 */
async function ensurePOIRecord(community, district, extraData = {}) {
  try {
    const existingRows = await query(
      'SELECT id, latitude, nearest_metro_line, nearest_metro_station, street FROM property_community_dict WHERE community_name = ? AND district = ? LIMIT 1',
      [community, district]
    );
    const existing = Array.isArray(existingRows) && Array.isArray(existingRows[0]) ? existingRows[0]?.[0] : existingRows?.[0];
    if (!existing) return;

    const updates = [];
    const params = [];
    if ((!existing.nearest_metro_line || existing.nearest_metro_line === '') && extraData.metro_lines) {
      updates.push('nearest_metro_line = ?');
      params.push(extraData.metro_lines);
    }
    if ((!existing.nearest_metro_station || existing.nearest_metro_station === '') && extraData.metro_stations) {
      updates.push('nearest_metro_station = ?');
      params.push(extraData.metro_stations);
    }
    if ((!existing.street || existing.street === '') && extraData.street) {
      updates.push('street = ?');
      params.push(extraData.street);
    }
    if (updates.length > 0) {
      params.push(existing.id);
      await query('UPDATE property_community_dict SET ' + updates.join(', ') + ', updated_at = NOW() WHERE id = ?', params);
    }
  } catch { /* 不影响解析主流程 */ }
}

class WeChatRobotPluginController {
  // ============ 朋友圈解析列表 ============

  async getParsedProperties(req, res) {
    try {
      await ensurePublisherContactTable();
      const robotId = req.query.robot_id;
      const isAdmin = req.user && req.user.role === 'admin';
      const publisherDisplaySql = buildPublisherDisplaySql();
      const publisherJoinSql = buildPublisherMatchSql('pc');

      if (req.query.get_publishers === '1' && robotId) {
        try {
          const pubSql = `SELECT DISTINCT CONVERT(publisher_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS owner_nickname
             FROM wechat_robot_expat_parsed_properties
             WHERE robot_id = ?
               AND deleted_at IS NULL
               AND is_sale = 0
               AND ${LIST_RETENTION_DATE_CONDITION}
               AND publisher_name IS NOT NULL
               AND publisher_name != ''
             UNION
             SELECT DISTINCT CONVERT(publisher_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS owner_nickname FROM ${PUBLISHER_CONTACT_TABLE}
             WHERE is_enabled = 1 AND publisher_name IS NOT NULL AND publisher_name != ''
             ORDER BY owner_nickname ASC`;
          const publishers = await query(pubSql, [robotId]);
          return success(res, { publishers: publishers.map(p => p.owner_nickname) });
        } catch { return success(res, { publishers: [] }); }
      }

      const userId = req.user.id;
      const pg = parseInt(req.query.page, 10) || 1;
      const perPage = Math.min(200, parseInt(req.query.per_page || req.query.pageSize, 10) || 50);
      const offset = (pg - 1) * perPage;

      let where = [];
      let params = [];
      let needsPOIJoin = false;
      const keywordTrim = req.query.keyword ? String(req.query.keyword).trim() : '';

      if (robotId) {
        where.push('p.robot_id = ?'); params.push(robotId);
      } else {
        // 用户中心「所有房源」只能看当前用户自己已明确发布到前台的解析房源。
        // 历史朋友圈解析数据可能存在 is_listed=1/status=listed，只能进入快速找房，不能进入前台房源。
        if (!isAdmin) {
          where.push('p.user_id = ?');
          params.push(userId);
        }
        where.push("p.status = 'published'");
        const pf = await buildListedPropertyFilter('p', { includeDedup: true });
        where.push(...pf.conditions);
        params.push(...pf.params);
      }
      if (keywordTrim) {
        const keywordParts = keywordTrim.split(/\s+/).map(s => s.trim()).filter(Boolean).slice(0, 5);
        for (const keywordPart of keywordParts) {
          const kw = `%${keywordPart}%`;
          where.push(`(
          p.original_content LIKE ? OR p.favorites_content LIKE ? OR p.community LIKE ?
          OR IFNULL(p.title, '') LIKE ? OR IFNULL(p.description, '') LIKE ? OR IFNULL(p.district, '') LIKE ?
          OR EXISTS (SELECT 1 FROM property_community_dict pcd_kw WHERE pcd_kw.is_enabled = 1 AND pcd_kw.community_name = p.community AND pcd_kw.district LIKE ?)
          OR m.content LIKE ? OR IFNULL(m.fav_content, '') LIKE ? OR m.owner_nickname LIKE ?
          OR m2.content LIKE ? OR IFNULL(m2.fav_content, '') LIKE ? OR m2.owner_nickname LIKE ?
        )`);
          params.push(kw, kw, kw, kw, kw, kw, kw, kw, kw, kw, kw, kw, kw);
        }
      }
      if (req.query.district) {
        const distList = String(req.query.district).split(',').map(s => s.trim()).filter(Boolean);
        if (distList.length === 1) {
          const clean = distList[0].replace(/新区$/, '').replace(/区$/, '');
          where.push('p.district LIKE ?');
          params.push(`%${clean}%`);
        } else if (distList.length > 1) {
          const parts = distList.map(() => 'p.district LIKE ?');
          where.push(`(${parts.join(' OR ')})`);
          distList.forEach(d => {
            const clean = d.replace(/新区$/, '').replace(/区$/, '');
            params.push(`%${clean}%`);
          });
        }
      }
      if (req.query.community) { where.push('p.community LIKE ?'); params.push(`%${req.query.community}%`); }
      if (req.query.property_code) {
        const codeList = String(req.query.property_code).split(',').map(s => s.trim()).filter(Boolean);
        if (codeList.length === 1) {
          where.push('p.property_code LIKE ?');
          params.push(`%${codeList[0]}%`);
        } else if (codeList.length > 1) {
          where.push(`(${codeList.map(() => 'p.property_code LIKE ?').join(' OR ')})`);
          codeList.forEach(code => params.push(`%${code}%`));
        }
      }
      if (req.query.price_min || req.query.priceMin) { where.push('p.price_value >= ?'); params.push(parseFloat(req.query.price_min || req.query.priceMin)); }
      if (req.query.price_max || req.query.priceMax) { where.push('p.price_value <= ?'); params.push(parseFloat(req.query.price_max || req.query.priceMax)); }
      if (req.query.bedrooms) {
        const brArr = String(req.query.bedrooms).split(',').map(v => parseInt(v, 10)).filter(v => v >= 1 && v <= 9);
        if (brArr.length === 1) { where.push('p.bedrooms = ?'); params.push(brArr[0]); }
        else if (brArr.length > 1) { where.push(`p.bedrooms IN (${brArr.map(() => '?').join(',')})`); brArr.forEach(v => params.push(v)); }
      }
      if (req.query.metro_lines) {
        const lines = req.query.metro_lines.split(',').filter(Boolean);
        if (lines.length) {
          const conds = lines.map(() => '(p.metro_lines = ? OR FIND_IN_SET(?, p.metro_lines) > 0 OR FIND_IN_SET(?, COALESCE(poi1.nearest_metro_line, poi2.nearest_metro_line)) > 0)');
          where.push(`(${conds.join(' OR ')})`);
          lines.forEach(l => { params.push(l, l, l); });
          needsPOIJoin = true;
        }
      }
      if (req.query.metro_stations) {
        const ss = req.query.metro_stations.split(',').filter(Boolean);
        if (ss.length) {
          const conds = ss.map(() => '(p.metro_stations = ? OR FIND_IN_SET(?, p.metro_stations) > 0 OR FIND_IN_SET(?, COALESCE(poi1.nearest_metro_station, poi2.nearest_metro_station)) > 0)');
          where.push(`(${conds.join(' OR ')})`);
          ss.forEach(s => { params.push(s, s, s); });
          needsPOIJoin = true;
        }
      }
      if (req.query.publisher) { where.push('p.publisher_name = ?'); params.push(req.query.publisher); }
      if (req.query.publish_time_start) { where.push('p.list_publish_time >= ?'); params.push(req.query.publish_time_start + ' 00:00:00'); }
      if (req.query.publish_time_end) { where.push('p.list_publish_time <= ?'); params.push(req.query.publish_time_end + ' 23:59:59'); }
      if (req.query.has_elevator === '1') { where.push('p.has_elevator = 1'); }
      if (req.query.has_parking === '1') { where.push('p.has_parking = 1'); }
      if (req.query.has_commission === '1') { where.push('p.has_commission = 1'); }
      if (req.query.is_duplex === '1') { where.push(getDuplexFilterSql('p')); }
      if (req.query.outdoor_features) {
        const outdoorArr = req.query.outdoor_features.split(',').map(v => v.trim()).filter(Boolean);
        if (outdoorArr.length) {
          const outdoorConds = outdoorArr.map(feat => {
            if (feat === '花园') {
              params.push(`%${feat}%`);
              return `((p.outdoor_features LIKE ? AND p.community NOT LIKE '%花园%') OR (p.original_content LIKE '%带花园%' OR p.original_content LIKE '%私家花园%' OR p.original_content LIKE '%独立花园%' OR p.original_content LIKE '%花园洋房%'))`;
            }
            params.push(`%${feat}%`, `%${feat}%`);
            return `(p.outdoor_features LIKE ? OR p.original_content LIKE ?)`;
          });
          where.push(`(${outdoorConds.join(' OR ')})`);
        }
      }
      if (req.query.content_type) {
        where.push('m.content_type = ?'); params.push(req.query.content_type);
      }
      if (req.query.exclude_keywords) {
        const exKeys = req.query.exclude_keywords.split(',').map(k => k.trim()).filter(Boolean);
        exKeys.forEach((k) => {
          if (['主卧', '次卧', '床位'].includes(k)) {
            where.push(`(
              p.original_content NOT LIKE ?
              OR (
                p.original_content NOT LIKE '%合租%'
                AND p.original_content NOT LIKE '%转租%'
                AND p.original_content NOT LIKE '%招室友%'
                AND p.original_content NOT LIKE '%室友%'
                AND p.original_content NOT LIKE '%拼房%'
                AND p.original_content NOT LIKE '%找女生%'
                AND p.original_content NOT LIKE '%找男生%'
              )
            )`);
            params.push(`%${k}%`);
          } else {
            where.push('p.original_content NOT LIKE ?');
            params.push(`%${k}%`);
          }
        });
      }
      if (req.query.property_only === '1') {
        where.push('(p.price IS NOT NULL OR p.bedrooms IS NOT NULL OR p.community IS NOT NULL OR p.district IS NOT NULL)');
      }
      // 筛选未在POI数据库中的小区
      if (req.query.not_in_poi === '1') {
        where.push(`p.community IS NOT NULL AND p.community != '' AND NOT EXISTS (
          SELECT 1 FROM property_community_dict pcd 
          WHERE pcd.community_name = p.community AND pcd.is_enabled = 1
        )`);
      }

      where.push('p.deleted_at IS NULL');
      where.push(LIST_RETENTION_DATE_CONDITION_P);
      // Rule 6 + Rule 9-⑧: 列表禁止显示任何出售类型的房源数据（使用is_sale预计算索引列）
      if (req.query.include_sale !== '1') {
        where.push('p.is_sale = 0');
      }

      const hasPreciseLookup = Boolean(
        keywordTrim ||
        req.query.publisher ||
        req.query.publish_time_start ||
        req.query.publish_time_end ||
        req.query.property_code
      );
      const dedupRequested = req.query.dedup === '1' || req.query.deduplicate === '1';

      // 同一文案去重：搜索文案/发布人/发布时间/编号时显示真实命中记录，默认列表仍可去重。
      if (dedupRequested && !hasPreciseLookup) {
        where.push(`(p.content_hash IS NULL OR p.id = (
          SELECT sub.id FROM wechat_robot_expat_parsed_properties sub
          WHERE sub.content_hash = p.content_hash
            AND sub.deleted_at IS NULL
            AND sub.robot_id = p.robot_id
          ORDER BY sub.has_commission DESC, sub.created_at DESC LIMIT 1
        ))`);
      }

      const whereStr = where.join(' AND ');
      const needsMomentFilterJoin = Boolean(req.query.content_type || req.query.publisher || keywordTrim);
      const needsPublisherFilterJoin = false;
      const skipPoiJoinForList = req.query.not_in_poi === '1' && !needsPOIJoin;

      const poiJoinSql = needsPOIJoin
        ? ` LEFT JOIN property_community_dict poi1 ON p.community = poi1.community_name AND p.district = poi1.district AND poi1.is_enabled = 1
            LEFT JOIN property_community_dict poi2 ON p.community = poi2.community_name AND poi2.is_enabled = 1 AND poi1.id IS NULL
              AND 1 = (SELECT COUNT(DISTINCT pcd2.district) FROM property_community_dict pcd2 WHERE pcd2.community_name = p.community AND pcd2.is_enabled = 1)`
        : '';
      const countOpJoinSql = needsMomentFilterJoin
        ? 'LEFT JOIN wechat_robot_expat_properties op ON p.property_id = op.id'
        : '';
      const countMomentJoinSql = needsMomentFilterJoin
        ? `LEFT JOIN wechat_robot_moments m ON COALESCE(p.moment_id, op.moment_id) = m.moment_id
           LEFT JOIN wechat_robot_moments m2 ON op.moment_id = m2.moment_id AND p.moment_id IS NULL`
        : '';
      const countPublisherJoinSql = needsPublisherFilterJoin
        ? `LEFT JOIN ${PUBLISHER_CONTACT_TABLE} pc ON ${publisherJoinSql} AND pc.is_enabled = 1`
        : '';
      const dataPoiJoinSql = skipPoiJoinForList
        ? ''
        : `LEFT JOIN property_community_dict poi1 ON p.community = poi1.community_name AND p.district = poi1.district AND poi1.is_enabled = 1
           LEFT JOIN property_community_dict poi2 ON p.community = poi2.community_name AND poi2.is_enabled = 1 AND poi1.id IS NULL
             AND 1 = (SELECT COUNT(DISTINCT pcd2.district) FROM property_community_dict pcd2 WHERE pcd2.community_name = p.community AND pcd2.is_enabled = 1)`;
      const districtSelectSql = skipPoiJoinForList ? 'p.district' : 'COALESCE(poi1.district, poi2.district, p.district)';
      const effectiveMetroDistanceSql = skipPoiJoinForList
        ? 'p.metro_distance'
        : 'COALESCE(p.metro_distance, poi1.nearest_metro_distance, poi2.nearest_metro_distance)';
      const poiMetroLineSql = skipPoiJoinForList ? 'NULL' : 'COALESCE(poi1.nearest_metro_line, poi2.nearest_metro_line)';
      const poiMetroStationSql = skipPoiJoinForList ? 'NULL' : 'COALESCE(poi1.nearest_metro_station, poi2.nearest_metro_station)';
      const poiPropertyTypeSql = skipPoiJoinForList ? 'NULL' : 'COALESCE(poi1.property_type, poi2.property_type)';
      const latitudeSelectSql = skipPoiJoinForList ? 'p.latitude' : 'COALESCE(p.latitude, poi1.latitude, poi2.latitude)';
      const longitudeSelectSql = skipPoiJoinForList ? 'p.longitude' : 'COALESCE(p.longitude, poi1.longitude, poi2.longitude)';
      const isInPoiSql = skipPoiJoinForList ? '0' : 'CASE WHEN poi1.id IS NOT NULL OR poi2.id IS NOT NULL THEN 1 ELSE 0 END';

      const t0 = Date.now();

      // 优化策略：COUNT和ID查询只在主表上操作（避免慢JOIN），然后用ID取完整数据
      // Step 1: COUNT查询（不需要JOIN时直接COUNT主表）
      let totalCount = 0;
      if (!needsPOIJoin && !needsMomentFilterJoin && !needsPublisherFilterJoin) {
        const [countRow] = await query(
          `SELECT COUNT(*) as total FROM wechat_robot_expat_parsed_properties p WHERE ${whereStr}`, params);
        totalCount = countRow?.total || 0;
      } else {
        const [countRow] = await query(
          `SELECT COUNT(${needsPOIJoin ? 'DISTINCT p.id' : '*'}) as total
           FROM wechat_robot_expat_parsed_properties p
           ${countOpJoinSql}
           ${countMomentJoinSql}
           ${countPublisherJoinSql}
           ${poiJoinSql}
           WHERE ${whereStr}`, params);
        totalCount = countRow?.total || 0;
      }
      const t1 = Date.now();

      // Step 2: 先取分页ID列表（仅主表+轻量索引，极快）
      const orderClause = (() => {
        const sf = req.query.sort_field;
        const so = req.query.sort_order === 'asc' ? 'ASC' : 'DESC';
        if (sf === 'price_value') return `ORDER BY COALESCE(p.price_value, 0) ${so}, p.created_at DESC`;
        return 'ORDER BY p.list_publish_time DESC, p.created_at DESC';
      })();

      let pageIds;
      if (!needsPOIJoin && !needsMomentFilterJoin && !needsPublisherFilterJoin) {
        pageIds = await query(
          `SELECT p.id FROM wechat_robot_expat_parsed_properties p WHERE ${whereStr} ${orderClause} LIMIT ? OFFSET ?`,
          [...params, perPage, offset]);
      } else {
        pageIds = await query(
          `SELECT ${needsPOIJoin ? 'DISTINCT' : ''} p.id
           FROM wechat_robot_expat_parsed_properties p
           ${countOpJoinSql}
           ${countMomentJoinSql}
           ${countPublisherJoinSql}
           ${poiJoinSql}
           WHERE ${whereStr} ${orderClause} LIMIT ? OFFSET ?`,
          [...params, perPage, offset]);
      }

      const idList = (pageIds || []).map(r => r.id);
      let data = [];

      // Step 3: 用ID列表关联所有表取完整数据（ID数量小，JOIN极快）
      if (idList.length > 0) {
        const idPlaceholders = idList.map(() => '?').join(',');
        data = await query(
          `SELECT p.id, p.robot_id, p.original_content, p.community, p.price, p.price_value, p.custom_price, p.display_price, p.bedrooms, p.bathrooms,
                  CASE WHEN p.is_duplex = 1 OR p.original_content LIKE '%复式%' OR p.original_content LIKE '%复试%' OR p.original_content LIKE '%Loft%' OR p.original_content LIKE '%LOFT%' OR p.original_content LIKE '%跃层%' THEN 1 ELSE 0 END as is_duplex,
                  CASE WHEN (p.outdoor_features IS NOT NULL AND p.outdoor_features != '' AND p.outdoor_features != '0') THEN p.outdoor_features
                       ELSE CONCAT_WS(',',
                         IF(p.original_content LIKE '%阳台%', '阳台', NULL),
                         IF(p.original_content LIKE '%露台%', '露台', NULL),
                         IF((p.original_content LIKE '%带花园%' OR p.original_content LIKE '%私家花园%' OR p.original_content LIKE '%独立花园%' OR p.original_content LIKE '%花园洋房%' OR p.original_content LIKE '%赠花园%') AND (p.community IS NULL OR p.community NOT LIKE '%花园%'), '花园', NULL),
                         IF(p.original_content LIKE '%院子%' OR p.original_content LIKE '%庭院%', '院子/庭院', NULL)
                       ) END as outdoor_features,
                  ${districtSelectSql} as district,
                  ${publisherDisplaySql} as publisher_name,
                  p.contact_info as content_contact_info,
                  pc.contact_info as manual_contact_info,
                  pc.remark as publisher_contact_remark,
                  COALESCE(NULLIF(TRIM(p.contact_info), ''), NULLIF(TRIM(pc.contact_info), '')) as contact_info,
                  CASE WHEN p.has_elevator = 1 OR p.original_content LIKE '%有电梯%' OR p.original_content LIKE '%电梯房%' OR p.original_content LIKE '%带电梯%' OR p.community LIKE '%大楼%' OR p.community LIKE '%大厦%' THEN 1 ELSE 0 END as has_elevator,
                  CASE WHEN p.has_parking = 1 OR p.original_content LIKE '%有车位%' OR p.original_content LIKE '%含车位%' OR p.original_content LIKE '%送车位%' OR p.original_content LIKE '%带车位%' THEN 1 ELSE 0 END as has_parking,
                  CASE WHEN p.has_commission = 1 OR p.original_content LIKE '%付佣%' OR p.original_content LIKE '%全佣%' OR p.original_content LIKE '%半佣%' OR p.original_content LIKE '%有佣%' OR p.original_content LIKE '%佣金%' OR p.original_content LIKE '%中介费%' OR p.original_content LIKE '%[红包]%' THEN 1 ELSE 0 END as has_commission,
                  p.metro_lines, p.metro_stations, p.metro_distance,
                  ${effectiveMetroDistanceSql} as effective_metro_distance,
                  ${poiMetroLineSql} as poi_metro_line,
                  ${poiMetroStationSql} as poi_metro_station,
                  ${poiPropertyTypeSql} as poi_property_type,
                  ${latitudeSelectSql} as latitude,
                  ${longitudeSelectSql} as longitude,
                  ${isInPoiSql} as is_in_poi,
                  p.community_type,
                  p.area_sqm, p.moment_publish_time, p.created_at, p.is_selected, p.is_sent, p.is_listed,
                  p.media_urls, p.local_images, p.property_code, p.share_code, p.title, p.description,
                  COALESCE(p.moment_id, op.moment_id) as moment_id,
                  p.favorites_content,
                  COALESCE(m.content, m2.content) as moment_content,
                  COALESCE(m.fav_content, m2.fav_content) as moment_fav_content,
                  COALESCE(m.content_style, m2.content_style) as moment_content_style,
                  COALESCE(m.owner_nickname, m2.owner_nickname, p.publisher_name) as owner_nickname,
                  COALESCE(m.content_type, m2.content_type) as content_type,
                  m.media_list as moment_media_list, m.local_media_urls as moment_local_media,
                  m2.media_list as moment_media_list2, m2.local_media_urls as moment_local_media2
           FROM wechat_robot_expat_parsed_properties p
           LEFT JOIN wechat_robot_expat_properties op ON p.property_id = op.id
           LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
           LEFT JOIN wechat_robot_moments m2 ON op.moment_id = m2.moment_id AND p.moment_id IS NULL
           LEFT JOIN ${PUBLISHER_CONTACT_TABLE} pc ON ${publisherJoinSql} AND pc.is_enabled = 1
           ${dataPoiJoinSql}
           WHERE p.id IN (${idPlaceholders})
           ${orderClause}`,
          idList
        );
      }
      const t2 = Date.now();

      const { mergeMomentMedia } = require('../../utils/propertyMediaMerge');
      const { countNonVideoMedia, getDefaultCoverImage } = require('../../utils/snsXmlMediaParser');
      const defaultCover = await getDefaultCoverImage(query);
      for (const row of data) {
        mergeMomentMedia(row);
        // 只有 1 张图（非视频）的朋友圈通常是广告图，标记使用默认封面
        const imgCount = countNonVideoMedia(row.media_urls) + countNonVideoMedia(row.local_images);
        row._single_image = imgCount <= 1;
        row._default_cover = defaultCover;
      }

      // 兜底格式化：修复PHP系统插入的非标准价格格式
      const fixIds = [];
      for (const row of data) {
        if (!row.price || row.price.includes('(售)')) continue;
        const p = String(row.price).trim();
        // 非¥开头的非标准格式（如 "2400000元", "305万"）
        if (!p.startsWith('¥')) {
          const wm = p.match(/([\d.]+)\s*万/);
          if (wm) {
            const val = Math.round(parseFloat(wm[1]) * 10000);
            row.price = `¥${val.toLocaleString()}(售)`;
            row.price_value = 0;
            fixIds.push({ id: row.id, price: row.price, pv: 0 });
          } else {
            const nums = p.match(/[\d,]+/g);
            if (nums) {
              const maxN = Math.max(...nums.map(s => parseInt(s.replace(/,/g, ''), 10)));
              if (maxN > MAX_RENT_PRICE) {
                row.price = `¥${maxN.toLocaleString()}(售)`;
                row.price_value = 0;
                fixIds.push({ id: row.id, price: row.price, pv: 0 });
              } else if (maxN >= 1000) {
                row.price = `¥${maxN}`;
                row.price_value = maxN;
                fixIds.push({ id: row.id, price: row.price, pv: maxN });
              }
            }
          }
        }
      }
      // 异步回写DB修复非标准记录（同步更新is_sale标记）
      if (fixIds.length > 0) {
        (async () => {
          for (const f of fixIds) {
            const isSale = (f.pv === 0 || f.price.includes('(售)')) ? 1 : 0;
            try { await query('UPDATE wechat_robot_expat_parsed_properties SET price = ?, price_value = ?, is_sale = ? WHERE id = ?', [f.price, f.pv, isSale, f.id]); } catch {}
          }
        })();
      }

      const t3 = Date.now();
      logger.info(`[getParsedProperties] 耗时: COUNT=${t1-t0}ms DATA=${t2-t1}ms POST=${t3-t2}ms TOTAL=${t3-t0}ms rows=${data.length} total=${totalCount}`);

      return success(res, {
        data: data,
        pagination: { total: totalCount, current_page: pg, per_page: perPage, total_pages: Math.ceil(totalCount / perPage) },
      });
    } catch (err) {
      logger.error('获取解析列表失败', { error: err.message, stack: err.stack });
      return error(res, '获取数据失败: ' + err.message, 500);
    }
  }

  async getParsedPropertyStats(req, res) {
    try {
      const userId = req.user.id;
      let robotId = req.query.robot_id;
      const isAdmin = req.user && req.user.role === 'admin';

      // 朋友圈解析列表是采集/解析工作台，必须按机器人维度统计原始数据。
      // 管理后台偶发在账号列表尚未加载完成时请求 stats，此时不能退回“前台已发布房源”口径。
      if (!robotId && isAdmin) {
        const [defaultRobot] = await query(
          "SELECT id FROM wechat_robot_accounts WHERE status != 'deleted' ORDER BY id DESC LIMIT 1"
        ).catch(() => []);
        if (defaultRobot?.id) robotId = defaultRobot.id;
      }

      let mWhere = '1=1';
      let pWhere = 'deleted_at IS NULL';
      const mParams = [];
      const pParams = [];
      mWhere += ` AND ${MOMENT_RETENTION_CONDITION}`;
      pWhere += ` AND ${LIST_RETENTION_DATE_CONDITION}`;
      if (robotId) {
        mWhere += ' AND robot_id = ?'; mParams.push(robotId);
        pWhere += ' AND robot_id = ?'; pParams.push(robotId);
      } else {
        if (!isAdmin) {
          pWhere += ' AND user_id = ?';
          pParams.push(userId);
        }
        pWhere += " AND status = 'published'";
        const pf = await buildListedPropertyFilter('', { includeDedup: true });
        for (const cond of pf.conditions) {
          pWhere += ' AND ' + cond;
        }
        pParams.push(...pf.params);
      }

      const allParams = [...mParams, ...pParams, ...pParams, ...pParams, ...pParams];
      const [row] = await query(`
        SELECT
          (SELECT COUNT(*) FROM wechat_robot_moments WHERE ${mWhere}) as total_moments,
          (SELECT COUNT(*) FROM wechat_robot_expat_parsed_properties WHERE ${pWhere}) as parsed_data,
          (SELECT COUNT(*) FROM wechat_robot_expat_parsed_properties WHERE ${pWhere} AND is_listed = 1) as published,
          (SELECT COUNT(*) FROM wechat_robot_expat_parsed_properties WHERE ${pWhere} AND created_at >= CURDATE()) as today_count,
          (SELECT COUNT(*) FROM wechat_robot_expat_parsed_properties WHERE ${pWhere}
            AND original_content IS NOT NULL AND original_content != ''
            AND ((district IS NULL OR district = '') OR bedrooms IS NULL OR (price_value IS NULL OR price_value = 0))
          ) as incomplete_count
      `, allParams).catch((err) => {
        logger.error('获取朋友圈解析统计失败', {
          error: err.message,
          robotId,
          mWhere,
          pWhere,
        });
        return [{ total_moments: 0, parsed_data: 0, published: 0, today_count: 0, incomplete_count: 0 }];
      });

      return success(res, {
        stats: {
          total_moments: row?.total_moments || 0,
          parsed_data: row?.parsed_data || 0,
          published: row?.published || 0,
          today_count: row?.today_count || 0,
          incomplete_count: row?.incomplete_count || 0,
        }
      });
    } catch (err) {
      return error(res, '获取统计数据失败', 500);
    }
  }

  /**
   * 获取带坐标的解析房源（用于地图视图）
   * 通过 POI 关联获取经纬度，返回轻量数据供地图标记
   */
  async getParsedMapProperties(req, res) {
    try {
      const isAdmin = req.user && req.user.role === 'admin';
      const userId = req.user.id;

      /* 构建通用筛选条件（与列表视图保持一致） */
      let baseWhere = ['p.deleted_at IS NULL', LIST_RETENTION_DATE_CONDITION_P];
      let baseParams = [];
      if (req.query.robot_id) { baseWhere.push('p.robot_id = ?'); baseParams.push(req.query.robot_id); }
      else {
        const pf = await buildListedPropertyFilter('p', { includeDedup: true });
        baseWhere.push(...pf.conditions);
        baseParams.push(...pf.params);
      }
      if (req.query.district) {
        const distList = String(req.query.district).split(',').map(s => s.trim()).filter(Boolean);
        const distMatchSql = '(p.district LIKE ? OR EXISTS (SELECT 1 FROM property_community_dict pc WHERE pc.community_name = p.community AND pc.is_enabled = 1 AND pc.district LIKE ?))';
        if (distList.length === 1) {
          const clean = distList[0].replace(/新区$/, '').replace(/区$/, '');
          const like = `%${clean}%`;
          baseWhere.push(distMatchSql);
          baseParams.push(like, like);
        } else if (distList.length > 1) {
          const parts = distList.map(() => distMatchSql);
          baseWhere.push(`(${parts.join(' OR ')})`);
          distList.forEach((d) => {
            const clean = d.replace(/新区$/, '').replace(/区$/, '');
            const like = `%${clean}%`;
            baseParams.push(like, like);
          });
        }
      }
      if (req.query.bedrooms) {
        const br = req.query.bedrooms.split(',').filter(Boolean).map(Number);
        if (br.length === 1) { baseWhere.push('p.bedrooms = ?'); baseParams.push(br[0]); }
        else if (br.length > 1) { baseWhere.push(`p.bedrooms IN (${br.map(() => '?').join(',')})`); br.forEach(v => baseParams.push(v)); }
      }
      if (req.query.price_min) { baseWhere.push('p.price_value >= ?'); baseParams.push(parseInt(req.query.price_min)); }
      if (req.query.price_max) { baseWhere.push('p.price_value <= ?'); baseParams.push(parseInt(req.query.price_max)); }
      if (req.query.keyword) {
        const kw = `%${String(req.query.keyword).trim()}%`;
        baseWhere.push(`(p.community LIKE ? OR p.original_content LIKE ? OR p.title LIKE ? OR p.description LIKE ? OR p.publisher_name LIKE ? OR EXISTS (
          SELECT 1 FROM wechat_robot_moments mm
          WHERE (mm.moment_id = p.moment_id OR mm.moment_id = (SELECT op.moment_id FROM wechat_robot_expat_properties op WHERE op.id = p.property_id LIMIT 1))
            AND (mm.content LIKE ? OR mm.fav_content LIKE ?)
        ))`);
        baseParams.push(kw, kw, kw, kw, kw, kw, kw);
      }
      if (req.query.metro_lines) {
        const lines = req.query.metro_lines.split(',').filter(Boolean);
        if (lines.length) {
          const conds = lines.map(() => '(p.metro_lines = ? OR FIND_IN_SET(?, p.metro_lines) > 0)');
          baseWhere.push(`(${conds.join(' OR ')})`);
          lines.forEach(l => { baseParams.push(l, l); });
        }
      }
      if (req.query.metro_stations) {
        const ss = req.query.metro_stations.split(',').filter(Boolean);
        if (ss.length) {
          const conds = ss.map(() => '(p.metro_stations = ? OR FIND_IN_SET(?, p.metro_stations) > 0)');
          baseWhere.push(`(${conds.join(' OR ')})`);
          ss.forEach(s => { baseParams.push(s, s); });
        }
      }
      if (req.query.publisher) { baseWhere.push('p.publisher_name = ?'); baseParams.push(req.query.publisher); }
      if (req.query.publish_time_start) { baseWhere.push('p.list_publish_time >= ?'); baseParams.push(req.query.publish_time_start + ' 00:00:00'); }
      if (req.query.publish_time_end) { baseWhere.push('p.list_publish_time <= ?'); baseParams.push(req.query.publish_time_end + ' 23:59:59'); }
      if (req.query.has_elevator === '1') { baseWhere.push('p.has_elevator = 1'); }
      if (req.query.has_parking === '1') { baseWhere.push('p.has_parking = 1'); }
      if (req.query.has_commission === '1') { baseWhere.push('p.has_commission = 1'); }
      if (req.query.is_duplex === '1') { baseWhere.push(getDuplexFilterSql('p')); }
      if (req.query.exclude_keywords) {
        const exKeys = req.query.exclude_keywords.split(',').map(k => k.trim()).filter(Boolean);
        exKeys.forEach(k => { baseWhere.push('p.original_content NOT LIKE ?'); baseParams.push(`%${k}%`); });
      }
      if (req.query.property_only === '1') {
        baseWhere.push('(p.price IS NOT NULL OR p.bedrooms IS NOT NULL OR p.community IS NOT NULL OR p.district IS NOT NULL)');
      }
      // 默认排除出售房源（使用is_sale预计算索引列）
      if (req.query.include_sale !== '1') {
        baseWhere.push('p.is_sale = 0');
      }

      const baseWhereStr = baseWhere.join(' AND ');

      /* 统计无坐标数据数量：精确匹配和名称匹配都找不到坐标的 */
      const [totalRow] = await query(
        `SELECT COUNT(*) as cnt FROM wechat_robot_expat_parsed_properties p WHERE ${baseWhereStr}`,
        [...baseParams]
      );
      const [hasCoordsRow] = await query(
        `SELECT COUNT(*) as cnt FROM wechat_robot_expat_parsed_properties p
         LEFT JOIN property_community_dict poi1 ON p.community = poi1.community_name AND p.district = poi1.district AND poi1.latitude IS NOT NULL AND poi1.latitude != 0
         LEFT JOIN property_community_dict poi2 ON p.community = poi2.community_name AND poi2.latitude IS NOT NULL AND poi2.latitude != 0 AND poi1.id IS NULL
           AND 1 = (SELECT COUNT(DISTINCT pcd2.district) FROM property_community_dict pcd2 WHERE pcd2.community_name = p.community AND pcd2.is_enabled = 1)
         WHERE ${baseWhereStr} AND COALESCE(p.latitude, poi1.latitude, poi2.latitude) IS NOT NULL
             AND COALESCE(p.latitude, poi1.latitude, poi2.latitude) != 0
             AND COALESCE(p.longitude, poi1.longitude, poi2.longitude) IS NOT NULL
             AND COALESCE(p.longitude, poi1.longitude, poi2.longitude) != 0`,
        [...baseParams]
      );
      const noCoordsCount = (totalRow?.cnt || 0) - (hasCoordsRow?.cnt || 0);

      /* 查询有坐标的数据：精确匹配(community+district) + 名称匹配(仅community) */
      const data = await query(
        `SELECT p.id, p.community, COALESCE(poi1.district, poi2.district, p.district) as district, p.price, p.price_value, p.bedrooms, p.bathrooms,
                p.area_sqm, p.publisher_name, p.original_content, p.moment_publish_time,
                p.metro_lines, p.metro_stations, p.metro_distance,
                COALESCE(p.latitude, poi1.latitude, poi2.latitude) as latitude,
                COALESCE(p.longitude, poi1.longitude, poi2.longitude) as longitude,
                COALESCE(poi1.property_type, poi2.property_type) as property_type,
                COALESCE(poi1.address, poi2.address) as poi_address,
                COALESCE(poi1.nearest_metro_station, poi2.nearest_metro_station) as nearest_metro_station,
                COALESCE(poi1.nearest_metro_distance, poi2.nearest_metro_distance) as nearest_metro_distance
         FROM wechat_robot_expat_parsed_properties p
         LEFT JOIN property_community_dict poi1 ON p.community = poi1.community_name AND p.district = poi1.district AND poi1.latitude IS NOT NULL AND poi1.latitude != 0
         LEFT JOIN property_community_dict poi2 ON p.community = poi2.community_name AND poi2.latitude IS NOT NULL AND poi2.latitude != 0 AND poi1.id IS NULL
           AND 1 = (SELECT COUNT(DISTINCT pcd2.district) FROM property_community_dict pcd2 WHERE pcd2.community_name = p.community AND pcd2.is_enabled = 1)
         WHERE ${baseWhereStr}
           AND COALESCE(p.latitude, poi1.latitude, poi2.latitude) IS NOT NULL
           AND COALESCE(p.latitude, poi1.latitude, poi2.latitude) != 0
           AND COALESCE(p.longitude, poi1.longitude, poi2.longitude) IS NOT NULL
           AND COALESCE(p.longitude, poi1.longitude, poi2.longitude) != 0
         ORDER BY p.moment_publish_time DESC
         LIMIT ?`,
        [...baseParams, getParsedMapMaxProperties()]
      );

      const communityMap = new Map();
      for (const row of data) {
        const key = `${row.community}__${row.district}`;
        if (!communityMap.has(key)) {
          communityMap.set(key, {
            community: row.community,
            district: row.district,
            lat: parseFloat(row.latitude),
            lng: parseFloat(row.longitude),
            property_type: row.property_type || '住宅',
            address: row.poi_address || '',
            metro_station: row.nearest_metro_station || row.metro_stations || '',
            metro_distance: row.nearest_metro_distance || row.metro_distance || null,
            metro_line: row.metro_lines || '',
            listings: [],
          });
        }
        const content = row.original_content || '';
        communityMap.get(key).listings.push({
          id: row.id,
          price: row.price,
          price_value: row.price_value,
          bedrooms: row.bedrooms,
          bathrooms: row.bathrooms,
          area_sqm: row.area_sqm,
          publisher: row.publisher_name || '',
          content: content.length > 120 ? content.substring(0, 120) + '...' : content,
          publish_time: row.moment_publish_time,
        });
      }

      const markers = Array.from(communityMap.values());

      let mapConfig = { js_api_key: '', security_js_key: '', center: [121.4737, 31.2304], zoom: 11 };
      try {
        const [cfg] = await query('SELECT js_api_key, security_js_key, default_center_lng, default_center_lat, default_zoom FROM system_map_settings WHERE is_enabled = 1 LIMIT 1');
        if (cfg) {
          mapConfig.js_api_key = cfg.js_api_key || '';
          mapConfig.security_js_key = cfg.security_js_key || '';
          if (cfg.default_center_lng && cfg.default_center_lat) {
            mapConfig.center = [parseFloat(cfg.default_center_lng), parseFloat(cfg.default_center_lat)];
          }
          mapConfig.zoom = cfg.default_zoom || 11;
        }
      } catch (e) { /* 配置缺失不影响数据返回 */ }

      return success(res, {
        markers,
        total_properties: data.length,
        total_communities: markers.length,
        no_coords_count: noCoordsCount,
        mapConfig,
      });
    } catch (err) {
      logger.error('获取地图房源失败', { error: err.message });
      return error(res, '获取地图数据失败', 500);
    }
  }

  async getParsedPropertyFilters(req, res) {
    try {
      const isAdmin = req.user && req.user.role === 'admin';

      const districtSql = `SELECT DISTINCT p.district
        FROM wechat_robot_expat_parsed_properties p
        WHERE p.deleted_at IS NULL AND ${LIST_RETENTION_DATE_CONDITION_P}
          AND p.district IS NOT NULL AND p.district != ''
          ${isAdmin ? '' : 'AND p.user_id = ?'}
        ORDER BY p.district`;
      const districtParams = isAdmin ? [] : [req.user.id];
      const [districts, allDistricts, metroLines, metroStations] = await Promise.all([
        query(districtSql, districtParams).catch(() => []),
        PropertySettings.getDistricts().catch(() => []),
        PropertySettings.getMetroLines().catch(() => []),
        PropertySettings.getMetroStations().catch(() => []),
      ]);

      return success(res, {
        districts: districts.map((d) => d.district),
        allDistricts: allDistricts.map(d => d.name_cn),
        metro_lines: metroLines.map(l => l.name_cn),
        metro_stations: metroStations.map(s => s.name_cn),
        metro_stations_with_lines: metroStations.map(s => ({ name: s.name_cn, line: s.line_name || '' })),
      });
    } catch (err) {
      logger.error('获取筛选数据失败', { error: err.message });
      return error(res, '获取筛选数据失败', 500);
    }
  }

  async updateParsedProperty(req, res) {
    try {
      const { id } = req.params;
      const isAdmin = req.user && req.user.role === 'admin';
      const property = await ParsedProperty.findById(id);
      if (!property) return error(res, '记录不存在', 404);
      if (!isAdmin && property.user_id !== req.user.id) {
        return error(res, '无权修改此记录', 403);
      }

      const updateData = { ...req.body };
      delete updateData.id;
      delete updateData.user_id;
      updateData.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

      await ParsedProperty.update(id, updateData);
      const updated = await ParsedProperty.findById(id);
      await syncPublisherContactByParsedId(id);
      return success(res, updated, '更新成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 搜索POI小区数据（供前端下拉选择使用）
   * GET /user/expat/parsed-properties/search-poi?keyword=xxx&district=xxx
   */
  async searchCommunityPOI(req, res) {
    try {
      const { keyword, district } = req.query;
      let sql = `SELECT id, community_name, district, address, longitude, latitude, nearest_metro_line, nearest_metro_station, nearest_metro_distance 
                 FROM property_community_dict WHERE is_enabled = 1 AND community_name IS NOT NULL`;
      const params = [];
      if (keyword && keyword.trim()) {
        sql += ' AND community_name LIKE ?';
        params.push(`%${keyword.trim()}%`);
      }
      if (district && district.trim()) {
        sql += ' AND district = ?';
        params.push(district.trim());
      }
      sql += ' ORDER BY CHAR_LENGTH(community_name) ASC LIMIT 50';
      const rows = await query(sql, params);
      const data = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
      return success(res, data || []);
    } catch (err) {
      logger.error('搜索POI数据失败', { error: err.message });
      return error(res, '搜索失败', 500);
    }
  }

  /**
   * 将解析列表中的小区导入到POI数据库
   * POST /user/expat/parsed-properties/import-to-poi
   * body: { items: [{ community, district }] } 或 { prop_ids: [1,2,3] }
   */
  async importToPOI(req, res) {
    try {
      const isAdmin = req.user && req.user.role === 'admin';
      if (!isAdmin) return error(res, '仅管理员可执行', 403);

      let items = req.body.items || [];
      // 如果传入prop_ids，从解析记录中提取小区和区域
      if (req.body.prop_ids && Array.isArray(req.body.prop_ids) && req.body.prop_ids.length > 0) {
        const ids = req.body.prop_ids.map(id => parseInt(id, 10)).filter(id => id > 0);
        if (ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          const rows = await query(
            `SELECT DISTINCT community, district FROM wechat_robot_expat_parsed_properties 
             WHERE id IN (${placeholders}) AND community IS NOT NULL AND community != '' AND deleted_at IS NULL`,
            ids
          );
          const data = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
          items = (data || []).map(r => ({ community: r.community, district: r.district }));
        }
      }

      if (!items.length) return error(res, '没有可导入的小区数据', 400);

      await loadValidDistricts();
      let imported = 0, skipped = 0, existed = 0;
      const results = [];

      for (const item of items) {
        const community = (item.community || '').trim();
        const district = (item.district || '').trim();
        if (!community || community.length < 2) { skipped++; continue; }

        // 检查是否已存在
        const existRows = await query(
          'SELECT id FROM property_community_dict WHERE community_name = ? LIMIT 1', [community]
        );
        const exist = Array.isArray(existRows) && Array.isArray(existRows[0]) ? existRows[0]?.[0] : existRows?.[0];
        if (exist) { existed++; results.push({ community, status: 'existed' }); continue; }

        const validDist = VALID_DISTRICTS.includes(district) ? district : '';
        await query(
          `INSERT IGNORE INTO property_community_dict (community_name, district, source, is_enabled, created_at, updated_at)
           VALUES (?, ?, 'manual_import', 1, NOW(), NOW())`,
          [community, validDist]
        );
        imported++;
        results.push({ community, district: validDist, status: 'imported' });

        // 异步调用高德补全（不阻塞响应）
        if (validDist) {
          ensurePOIRecord(community, validDist, {}).catch(() => {});
        }
      }

      return success(res, { imported, skipped, existed, total: items.length, results });
    } catch (err) {
      logger.error('导入POI失败', { error: err.message });
      return error(res, '导入失败: ' + err.message, 500);
    }
  }

  /**
   * 批量重新处理所有记录的小区名和卧室/卫生间默认值
   * POST /user/expat/parsed-properties/bulk-reprocess
   */
  async bulkReprocessCommunity(req, res) {
    try {
      const isAdmin = req.user && req.user.role === 'admin';
      if (!isAdmin) return error(res, '仅管理员可执行', 403);

      const batchSize = parseInt(req.body.batch_size, 10) || 200;
      const offset = parseInt(req.body.offset, 10) || 0;

      const countRows = await query(`SELECT COUNT(*) as cnt FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL AND ${RETENTION_DATE_CONDITION}`);
      const totalCount = Array.isArray(countRows) && countRows[0] ? (Array.isArray(countRows[0]) ? countRows[0][0]?.cnt : countRows[0]?.cnt) : 0;

      const rows = await query(
        `SELECT id FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL AND ${RETENTION_DATE_CONDITION} ORDER BY id LIMIT ? OFFSET ?`,
        [batchSize, offset]
      );
      const ids = (Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows) || [];

      let processed = 0;
      let errors = 0;
      for (const row of ids) {
        try {
          await reprocessCommunityForRecord(row.id);
          processed++;
        } catch (e) {
          errors++;
          logger.warn('批量重处理失败', { id: row.id, error: e.message });
        }
      }

      return success(res, {
        total: totalCount,
        processed,
        errors,
        offset,
        next_offset: offset + ids.length,
        has_more: (offset + ids.length) < totalCount,
      }, `已处理 ${processed} 条`);
    } catch (err) {
      logger.error('批量重处理失败', { error: err.message });
      return error(res, err.message, 500);
    }
  }

  async deleteParsedProperty(req, res) {
    try {
      const { id } = req.params;
      const isAdmin = req.user && req.user.role === 'admin';
      const property = await ParsedProperty.findById(id);
      if (!property) return error(res, '记录不存在', 404);
      if (!isAdmin && property.user_id !== req.user.id) {
        return error(res, '无权删除此记录', 403);
      }
      await ParsedProperty.softDelete(id);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async batchDeleteParsedProperties(req, res) {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return error(res, '请选择要删除的记录');
      }
      const isAdmin = req.user && req.user.role === 'admin';
      let deleted = 0;
      for (const id of ids) {
        if (!isAdmin) {
          const property = await ParsedProperty.findById(id);
          if (!property || property.user_id !== req.user.id) continue;
        }
        await ParsedProperty.softDelete(id);
        deleted++;
      }
      return success(res, { deleted }, `已删除${deleted}条记录`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 解析功能 ============

  /**
   * 解析朋友圈内容 - 支持单条重新解析和批量解析
   * 前端可传: { ids: [parsedPropertyId...] } 单条/多条重新解析
   *          { robot_id, days, batch_size } 批量解析未解析的
   */
  async parseMoments(req, res) {
    try {
      const userId = req.user.id;
      const { ids, robot_id, days, batch_size, text, mode } = req.body;

      // 模式 count_incomplete 只需统计不需要AI，提前处理
      if (mode === 'count_incomplete') {
        const isAdmin = req.user && req.user.role === 'admin';
        const {
          keyword, price_min, price_max, bedrooms: bedroomFilter,
          district: districtFilter, publisher, publish_time_start, publish_time_end,
          exclude_keywords, property_only, has_elevator, has_parking, has_commission,
          metro_lines: metroLinesFilter, metro_stations: metroStationsFilter, content_type,
        } = req.body;

        let cond = '';
        const params = [];
        if (!isAdmin) { cond += ' AND p.user_id = ?'; params.push(userId); }
        if (robot_id) { cond += ' AND p.robot_id = ?'; params.push(robot_id); }
        if (keyword) { cond += ' AND (p.community LIKE ? OR p.original_content LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
        if (price_min) { cond += ' AND p.price_value >= ?'; params.push(Number(price_min)); }
        if (price_max) { cond += ' AND p.price_value <= ?'; params.push(Number(price_max)); }
        if (bedroomFilter) { const brs = String(bedroomFilter).split(',').map(Number).filter(n => n > 0); if (brs.length) { cond += ` AND p.bedrooms IN (${brs.map(() => '?').join(',')})`; params.push(...brs); } }
        if (districtFilter) { cond += ' AND p.district = ?'; params.push(districtFilter); }
        if (publisher) { cond += ' AND p.publisher_name = ?'; params.push(publisher); }
        if (publish_time_start) { cond += ' AND p.created_at >= ?'; params.push(publish_time_start); }
        if (publish_time_end) { cond += ' AND p.created_at <= ?'; params.push(publish_time_end + ' 23:59:59'); }
        if (has_elevator === '1' || has_elevator === true) cond += ' AND p.has_elevator = 1';
        if (has_parking === '1' || has_parking === true) cond += ' AND p.has_parking = 1';
        if (has_commission === '1' || has_commission === true) cond += ' AND p.has_commission = 1';
        if (req.body.is_duplex === '1' || req.body.is_duplex === true) cond += ` AND ${getDuplexFilterSql('p')}`;
        if (metroLinesFilter) { const lines = String(metroLinesFilter).split(',').filter(Boolean); if (lines.length) { cond += ` AND (${lines.map(() => '(p.metro_lines = ? OR FIND_IN_SET(?, p.metro_lines) > 0)').join(' OR ')})`; lines.forEach(l => { params.push(l, l); }); } }
        if (metroStationsFilter) { const stations = String(metroStationsFilter).split(',').filter(Boolean); if (stations.length) { cond += ` AND (${stations.map(() => '(p.metro_stations = ? OR FIND_IN_SET(?, p.metro_stations) > 0)').join(' OR ')})`; stations.forEach(s => { params.push(s, s); }); } }
        if (content_type === 'rent') cond += " AND p.property_type = '整租'";
        else if (content_type === 'share') cond += " AND p.property_type = '合租'";
        if (property_only === '1' || property_only === true) cond += ' AND (p.price IS NOT NULL OR p.bedrooms IS NOT NULL OR p.community IS NOT NULL OR p.district IS NOT NULL)';
        if (exclude_keywords) { const exWords = String(exclude_keywords).split(',').filter(w => w.trim()); for (const w of exWords) { cond += ' AND (p.original_content NOT LIKE ? OR p.original_content IS NULL)'; params.push(`%${w.trim()}%`); } }

        const countSql = `SELECT COUNT(*) as cnt FROM wechat_robot_expat_parsed_properties p
          WHERE p.deleted_at IS NULL AND p.original_content IS NOT NULL AND p.original_content != ''
            AND ((p.district IS NULL OR p.district = '') OR p.bedrooms IS NULL OR (p.price_value IS NULL OR p.price_value = 0))${cond}`;
        const [cntRow] = await query(countSql, params);
        const count = (Array.isArray(cntRow) ? cntRow[0]?.cnt : cntRow?.cnt) || 0;
        return success(res, { count });
      }

      // 获取AI模型配置（从数据库system_settings获取，禁止硬编码）
      const aiModelId = String(await SystemSetting.get('ai_parse_model_id', '') || '').trim();
      const aiModelIds = normalizeModelIdList(await SystemSetting.get('ai_parse_model_ids', '[]'));
      const aiPrompt = await SystemSetting.get('ai_parse_prompt', null);
      const candidateModelIds = [aiModelId, ...aiModelIds].filter(Boolean);
      if (candidateModelIds.length === 0 || !aiPrompt) {
        return error(res, '请先在管理后台配置AI解析模型和提示词模板', 400);
      }
      const placeholders = candidateModelIds.map(() => '?').join(',');
      const modelRows = await query(
        `SELECT id, model_code, model_name, api_url, api_key, api_headers, max_tokens, temperature
         FROM ai_models
         WHERE is_enabled = 1 AND id IN (${placeholders})`,
        candidateModelIds
      );
      const modelListRaw = Array.isArray(modelRows) && Array.isArray(modelRows[0]) ? modelRows[0] : modelRows;
      const modelById = new Map((Array.isArray(modelListRaw) ? modelListRaw : []).map((m) => [String(m.id), m]));
      let aiModelPool = candidateModelIds.map((id) => modelById.get(String(id))).filter(Boolean);
      if (aiModelPool.length === 0) {
        const [fallbackModel] = await query(`
          SELECT id, model_code, model_name, api_url, api_key, api_headers, max_tokens, temperature
          FROM ai_models
          WHERE is_enabled = 1
          ORDER BY
            CASE WHEN status = 'active' THEN 0 ELSE 1 END,
            priority ASC,
            id DESC
          LIMIT 1
        `);
        if (fallbackModel?.id) {
          aiModelPool = [fallbackModel];
          await SystemSetting.set('ai_parse_model_id', String(fallbackModel.id), 'text');
          await SystemSetting.set('ai_parse_model_ids', '[]', 'text');
        }
      }
      if (aiModelPool.length === 0) {
        return error(res, 'AI解析模型不存在，请在管理后台检查配置', 400);
      }

      async function parseWithModelFallback(parseContent, options = {}) {
        let lastError = null;
        for (let i = 0; i < aiModelPool.length; i++) {
          const model = aiModelPool[i];
          try {
            const parsed = await parsePropertyContent(parseContent, model, aiPrompt, options);
            if (parsed) {
              return { parsed, usedModel: model, attempts: i + 1 };
            }
            lastError = new Error('empty_parse_result');
          } catch (e) {
            lastError = e;
            const canFallback = i < aiModelPool.length - 1 && isRetryableAIError(e.message);
            if (!canFallback) break;
            logger.warn('AI模型失败，切换候补模型继续解析', {
              model: model.model_code || model.model_name || model.id,
              error: e.message,
            });
          }
        }
        throw lastError || new Error('empty_parse_result');
      }

      // 模式零：直接文本解析（上传房源页面AI一键解析）
      if (text && mode === 'single') {
        try {
          const { parsed } = await parseWithModelFallback(text, {
            requireAiValidation: true,
            allowMissingAddress: true,
          });
          if (parsed) {
            return success(res, parsed, 'AI解析完成');
          }
          return error(res, 'AI未能解析出有效数据', 400);
        } catch (e) {
          logger.error('单文本AI解析失败', { error: e.message });
          return error(res, 'AI解析失败: ' + e.message, 500);
        }
      }

      // 模式一：单条/多条重新解析（传入 parsed property IDs）
      // 新流程：规则先行 → POI匹配 → AI补充校验
      if (ids && Array.isArray(ids) && ids.length > 0) {
        const isAdmin = req.user && req.user.role === 'admin';
        const normalizedIds = ids
          .map(id => parseInt(id, 10))
          .filter(id => Number.isInteger(id) && id > 0);
        if (normalizedIds.length === 0) {
          return error(res, '请提供有效的解析记录ID', 400);
        }
        const placeholders = normalizedIds.map(() => '?').join(',');
        const rows = await query(
          isAdmin
            ? `SELECT id, original_content, favorites_content, moment_id FROM wechat_robot_expat_parsed_properties WHERE id IN (${placeholders}) AND deleted_at IS NULL`
            : `SELECT id, original_content, favorites_content, moment_id FROM wechat_robot_expat_parsed_properties WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL`,
          isAdmin ? normalizedIds : [...normalizedIds, userId]
        );
        const parseRows = (Array.isArray(rows) ? rows : []).filter(row => buildMomentParseContent(row));
        const results = normalizedIds.map(propId => ({
          id: propId,
          status: parseRows.some(row => Number(row.id) === propId) ? 'queued' : 'skipped',
        }));
        if (parseRows.length === 0) {
          return success(res, { queued: false, results, total: normalizedIds.length }, '没有需要解析的数据');
        }
        const taskKey = `ids:${normalizedIds.slice().sort((a, b) => a - b).join(',')}`;
        const queued = runDetachedManualParseTask(taskKey, async () => {
          let successCount = 0;
          let failCount = 0;
          for (const prop of parseRows) {
            try {
              const parseContent = buildMomentParseContent(prop);
              if (!parseContent) { failCount++; continue; }
              const { parsed: parseResult } = await parseWithModelFallback(parseContent, { requireAiValidation: true });
              if (parseResult) {
                parseResult.original_content = parseContent;
                await updateParsedPropertyFromAI(prop.id, parseResult);
                successCount++;
              } else {
                failCount++;
              }
            } catch (e) {
              logger.error('单条后台重新解析失败', { propId: prop.id, error: e.message });
              failCount++;
            }
          }
          logger.info('朋友圈后台重新解析完成', { taskKey, successCount, failCount, total: parseRows.length });
        });
        return success(res, {
          queued: true,
          running: !queued,
          results,
          total: normalizedIds.length,
        }, queued ? '解析任务已创建，后台处理中' : '解析任务正在后台处理中');
      }

      // 模式二：批量解析（传入 robot_id + days + batch_size）
      if (robot_id) {
        const batchLimit = Math.min(parseInt(batch_size, 10) || 10, 100);
        let dateCond = '';
        const rawDaysVal = days === 'all' ? null : parseInt(days, 10) || 3;
        const daysVal = rawDaysVal ? Math.min(rawDaysVal, 15) : null;
        if (daysVal) {
          dateCond = `AND p.created_at >= DATE_SUB(NOW(), INTERVAL ${daysVal} DAY)`;
        }

        const unparsed = await query(
          `SELECT p.id, p.original_content, p.favorites_content, p.moment_id
           FROM wechat_robot_expat_parsed_properties p
           WHERE p.user_id = ? AND p.robot_id = ? AND p.deleted_at IS NULL
           AND (p.is_ai_parsed = 0 OR p.is_ai_parsed IS NULL)
           AND (p.original_content IS NOT NULL AND p.original_content != '' OR p.favorites_content IS NOT NULL AND p.favorites_content != '')
           ${dateCond}
           ORDER BY p.created_at DESC LIMIT ?`,
          [userId, robot_id, batchLimit]
        );

        if (unparsed.length === 0) {
          return success(res, { parsed: 0, total: 0 }, '没有需要解析的数据');
        }

        const parseRows = unparsed.filter(row => buildMomentParseContent(row));
        const taskKey = `robot:${userId}:${robot_id}:${daysVal || 'all'}`;
        const queued = runDetachedManualParseTask(taskKey, async () => {
          let successCount = 0;
          let failCount = 0;
          for (const prop of parseRows) {
            try {
              const parseContent = buildMomentParseContent(prop);
              if (!parseContent) { failCount++; continue; }
              const { parsed: parseResult } = await parseWithModelFallback(parseContent, { requireAiValidation: true });
              if (parseResult) {
                parseResult.original_content = parseContent;
                await updateParsedPropertyFromAI(prop.id, parseResult);
                successCount++;
              } else {
                failCount++;
              }
            } catch (e) {
              logger.error('批量后台解析单条失败', { propId: prop.id, error: e.message });
              failCount++;
            }
          }
          logger.info('朋友圈批量后台解析完成', { taskKey, successCount, failCount, total: parseRows.length });
        });
        return success(res, {
          queued: true,
          running: !queued,
          parsed: 0,
          failed: 0,
          total: parseRows.length,
        }, queued ? '解析任务已创建，后台处理中' : '解析任务正在后台处理中');
      }

      // 模式三：批量重解析不完整记录（前端"一键补全未完整"按钮）
      if (mode === 'reparse_incomplete') {
        const isAdmin = req.user && req.user.role === 'admin';
        const {
          keyword, price_min, price_max, bedrooms: bedroomFilter,
          district: districtFilter, publisher, parse_status,
          publish_time_start, publish_time_end, exclude_keywords,
          deduplicate, property_only, has_elevator, has_parking, has_commission,
          metro_lines: metroLinesFilter, metro_stations: metroStationsFilter,
          content_type,
        } = req.body;

        // 构建筛选条件的通用函数
        function buildFilterConditions() {
          let cond = '';
          const params = [];
          if (!isAdmin) { cond += ' AND p.user_id = ?'; params.push(userId); }
          if (robot_id) { cond += ' AND p.robot_id = ?'; params.push(robot_id); }
          if (keyword) { cond += ' AND (p.community LIKE ? OR p.original_content LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
          if (price_min) { cond += ' AND p.price_value >= ?'; params.push(Number(price_min)); }
          if (price_max) { cond += ' AND p.price_value <= ?'; params.push(Number(price_max)); }
          if (bedroomFilter) {
            const brs = String(bedroomFilter).split(',').map(Number).filter(n => n > 0);
            if (brs.length) { cond += ` AND p.bedrooms IN (${brs.map(() => '?').join(',')})`; params.push(...brs); }
          }
          if (districtFilter) { cond += ' AND p.district = ?'; params.push(districtFilter); }
          if (publisher) { cond += ' AND p.publisher_name = ?'; params.push(publisher); }
          if (publish_time_start) { cond += ' AND p.created_at >= ?'; params.push(publish_time_start); }
          if (publish_time_end) { cond += ' AND p.created_at <= ?'; params.push(publish_time_end + ' 23:59:59'); }
          if (has_elevator === '1' || has_elevator === true) cond += ' AND p.has_elevator = 1';
          if (has_parking === '1' || has_parking === true) cond += ' AND p.has_parking = 1';
          if (has_commission === '1' || has_commission === true) cond += ' AND p.has_commission = 1';
          if (req.body.is_duplex === '1' || req.body.is_duplex === true) cond += ` AND ${getDuplexFilterSql('p')}`;
          if (metroLinesFilter) {
            const lines = String(metroLinesFilter).split(',').filter(Boolean);
            if (lines.length) { cond += ` AND (${lines.map(() => '(p.metro_lines = ? OR FIND_IN_SET(?, p.metro_lines) > 0)').join(' OR ')})`; lines.forEach(l => { params.push(l, l); }); }
          }
          if (metroStationsFilter) {
            const stations = String(metroStationsFilter).split(',').filter(Boolean);
            if (stations.length) { cond += ` AND (${stations.map(() => '(p.metro_stations = ? OR FIND_IN_SET(?, p.metro_stations) > 0)').join(' OR ')})`; stations.forEach(s => { params.push(s, s); }); }
          }
          if (content_type === 'rent') cond += " AND p.property_type = '整租'";
          else if (content_type === 'share') cond += " AND p.property_type = '合租'";
          if (property_only === '1' || property_only === true) cond += ' AND (p.price IS NOT NULL OR p.bedrooms IS NOT NULL OR p.community IS NOT NULL OR p.district IS NOT NULL)';
          if (exclude_keywords) {
            const exWords = String(exclude_keywords).split(',').filter(w => w.trim());
            for (const w of exWords) { cond += ' AND (p.original_content NOT LIKE ? OR p.original_content IS NULL)'; params.push(`%${w.trim()}%`); }
          }
          return { cond, params };
        }

        // 模式三：批量补全
        const batchLimit = Math.min(parseInt(batch_size, 10) || 50, 200);
        const { cond: filterCond, params: filterParams } = buildFilterConditions();

        let incompleteSql = `SELECT p.id, p.original_content, p.favorites_content FROM wechat_robot_expat_parsed_properties p
          WHERE p.deleted_at IS NULL AND (p.original_content IS NOT NULL AND p.original_content != '' OR p.favorites_content IS NOT NULL AND p.favorites_content != '')
            AND ((p.district IS NULL OR p.district = '') OR p.bedrooms IS NULL OR (p.price_value IS NULL OR p.price_value = 0))${filterCond}`;
        const sqlParams = [...filterParams];
        incompleteSql += ' ORDER BY p.created_at DESC LIMIT ?';
        sqlParams.push(batchLimit);

        const incomplete = await query(incompleteSql, sqlParams);
        const rows = Array.isArray(incomplete) ? incomplete : [];

        // 用 buildFilterConditions 构建计数SQL
        function getFilteredCountSql() {
          const { cond, params } = buildFilterConditions();
          return {
            countSql: `SELECT COUNT(*) as cnt FROM wechat_robot_expat_parsed_properties p
              WHERE p.deleted_at IS NULL AND p.original_content IS NOT NULL AND p.original_content != ''
                AND ((p.district IS NULL OR p.district = '') OR p.bedrooms IS NULL OR (p.price_value IS NULL OR p.price_value = 0))${cond}`,
            countParams: params,
          };
        }

        if (rows.length === 0) {
          const { countSql, countParams } = getFilteredCountSql();
          const [cntRow] = await query(countSql, countParams);
          const remaining = (Array.isArray(cntRow) ? cntRow[0]?.cnt : cntRow?.cnt) || 0;
          return success(res, { parsed: 0, failed: 0, total: 0, remaining }, '当前筛选范围内所有房源已解析完整');
        }

        let successCount = 0;
        let failCount = 0;
        for (const row of rows) {
          try {
            // 收藏笔记：合并 original_content 和 favorites_content
            let parseContent = row.original_content || '';
            if (row.favorites_content) {
              const fav = row.favorites_content;
              if (!parseContent || parseContent.includes('CDATA') || fav.length > parseContent.length) {
                parseContent = fav;
              } else if (!parseContent.includes(fav.substring(0, Math.min(20, fav.length)))) {
                parseContent = parseContent + '\n' + fav;
              }
            }
            if (!parseContent) { failCount++; continue; }
            const { parsed: parseResult } = await parseWithModelFallback(parseContent, { requireAiValidation: true });
            if (parseResult) {
              parseResult.original_content = parseContent;
              await updateParsedPropertyFromAI(row.id, parseResult);
              successCount++;
            } else {
              failCount++;
            }
          } catch (e) {
            logger.error('重解析不完整记录失败', { id: row.id, error: e.message });
            if (String(e.message || '').includes('AI模型')) throw e;
            failCount++;
          }
        }

        const { countSql, countParams } = getFilteredCountSql();
        const [remainRow] = await query(countSql, countParams);
        const remaining = (Array.isArray(remainRow) ? remainRow[0]?.cnt : remainRow?.cnt) || 0;

        return success(res, {
          parsed: successCount,
          failed: failCount,
          total: rows.length,
          remaining,
        }, `解析完成: 成功${successCount}条, 剩余${remaining}条未完整`);
      }

      return error(res, '请提供解析参数 (ids 或 robot_id)', 400);
    } catch (err) {
      logger.error('解析朋友圈失败', { error: err.message, stack: err.stack });
      return error(res, '解析失败: ' + err.message, 500);
    }
  }

  // ============ 房源分享 ============

  async shareProperty(req, res) {
    try {
      const { token } = req.params;
      const sql = `SELECT p.*, m.content as moment_content, m.media_list, m.owner_nickname
                   FROM wechat_robot_expat_parsed_properties p
                   LEFT JOIN wechat_robot_moments m ON p.moment_id = m.id
                   WHERE p.share_token = ? AND p.deleted_at IS NULL LIMIT 1`;
      const rows = await query(sql, [token]);
      if (!rows[0]) {
        return error(res, '房源不存在或已删除', 404);
      }
      return success(res, rows[0]);
    } catch (err) {
      return error(res, '获取分享房源失败', 500);
    }
  }

  async userPropertyListPage(req, res) {
    try {
      const { username } = req.params;
      const userSql = `SELECT id, username, display_name, avatar FROM users WHERE username = ? LIMIT 1`;
      const userRows = await query(userSql, [username]);
      const userArr = Array.isArray(userRows[0]) && Array.isArray(userRows[0]) ? userRows : userRows;
      if (!userArr[0]) {
        return error(res, '用户不存在', 404);
      }
      const shareUser = userArr[0];
      const userId = shareUser.id;

      // 获取用户链接设置（联系方式）
      let settings = {};
      try {
        let settingsRows = await query(
          'SELECT settings FROM wechat_robot_expat_link_settings WHERE user_id = ? AND robot_id = 0',
          [userId]
        );
        let sArr = Array.isArray(settingsRows[0]) && Array.isArray(settingsRows[0]) ? settingsRows[0] : settingsRows;
        if (!sArr || !sArr[0]) {
          settingsRows = await query(
            'SELECT settings FROM wechat_robot_expat_link_settings WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
            [userId]
          );
          sArr = Array.isArray(settingsRows[0]) && Array.isArray(settingsRows[0]) ? settingsRows[0] : settingsRows;
        }
        if (sArr && sArr[0] && sArr[0].settings) {
          settings = typeof sArr[0].settings === 'string' ? JSON.parse(sArr[0].settings) : sArr[0].settings;
        }
      } catch { /* ignore */ }

      // 筛选参数
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = parseInt(req.query.pageSize, 10) || 20;
      const district = req.query.district || '';
      const priceRange = req.query.price_range || '';
      const bedrooms = req.query.bedrooms || '';
      const metroLine = req.query.metro_line || '';
      const metroStation = req.query.metro_station || '';
      const keyword = req.query.keyword || '';
      const sort = req.query.sort || 'publish_time';

      // 构建 WHERE 条件 - 使用共享发布规则筛选
      const where = ["pp.deleted_at IS NULL", RETENTION_DATE_CONDITION_PP];
      const params = [];
      const ppFilter = await buildListedPropertyFilter('pp', { includeDedup: false });
      where.push(...ppFilter.conditions);
      params.push(...ppFilter.params);
      where.push('pp.user_id = ?');
      params.push(userId);
      where.push("pp.status = 'published'");

      if (district) {
        where.push('pp.district = ?');
        params.push(district);
      }

      // 解析价格范围
      let priceMin = null, priceMax = null;
      if (priceRange) {
        if (priceRange.includes('+')) {
          priceMin = parseInt(priceRange.replace('+', ''));
        } else if (priceRange.includes('-')) {
          const parts = priceRange.split('-');
          priceMin = parseInt(parts[0]) || null;
          priceMax = parseInt(parts[1]) || null;
        }
      }
      if (priceMin) { where.push('COALESCE(pp.custom_price, pp.price_value) >= ?'); params.push(priceMin); }
      if (priceMax) { where.push('COALESCE(pp.custom_price, pp.price_value) <= ?'); params.push(priceMax); }

      if (bedrooms) {
        where.push('pp.bedrooms = ?');
        params.push(parseInt(bedrooms));
      }
      if (metroLine) {
        where.push('pp.metro_lines LIKE ?');
        params.push(`%${metroLine}%`);
      }
      if (metroStation) {
        where.push('pp.metro_stations LIKE ?');
        params.push(`%${metroStation}%`);
      }
      if (keyword) {
        const kw = `%${keyword}%`;
        where.push(`(LOWER(pp.title) LIKE LOWER(?) OR LOWER(pp.community) LIKE LOWER(?) OR LOWER(pp.description) LIKE LOWER(?) OR LOWER(pp.district) LIKE LOWER(?) OR LOWER(pp.street) LIKE LOWER(?) OR LOWER(pp.metro_lines) LIKE LOWER(?) OR LOWER(pp.metro_stations) LIKE LOWER(?))`);
        params.push(kw, kw, kw, kw, kw, kw, kw);
      }

      const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
      const orderBy = sort === 'upload_time'
        ? 'ORDER BY pp.created_at DESC'
        : 'ORDER BY COALESCE(pp.moment_publish_time, pp.created_at) DESC';

      const offset = (page - 1) * pageSize;

      // 查询房源（JOIN moments 表补全媒体数据）
      const propSql = `SELECT pp.*, 
                        COALESCE(pp.moment_publish_time, pp.created_at) as effective_publish_time,
                        m.media_list as moment_media_list, m.local_media_urls as moment_local_media
                        FROM wechat_robot_expat_parsed_properties pp
                        LEFT JOIN wechat_robot_moments m ON pp.moment_id = m.moment_id
                        ${whereClause}
                        ${orderBy}
                        LIMIT ? OFFSET ?`;
      let properties = await query(propSql, [...params, pageSize, offset]);
      properties = Array.isArray(properties[0]) && Array.isArray(properties[0]) ? properties[0] : properties;
      if (!Array.isArray(properties)) properties = [];

      // 处理房源数据 - 提取第一张图片URL + 生成分享链接
      const { getPresignedUrl } = require('../../services/S3ProxyService');
      const { mergeMomentMedia } = require('../../utils/propertyMediaMerge');
      const { countNonVideoMedia, getDefaultCoverImage: getDefCover } = require('../../utils/snsXmlMediaParser');
      const defCover = await getDefCover(query);
      for (let i = 0; i < properties.length; i++) {
        const prop = properties[i];
        mergeMomentMedia(prop);
        let thumbUrl = '';
        const rawLocal = prop.local_images || '';
        const rawMedia = Array.isArray(prop.media_urls) ? JSON.stringify(prop.media_urls) : (prop.media_urls || '');
        const sourceData = rawLocal || rawMedia;
        const imgCount = countNonVideoMedia(rawLocal) + countNonVideoMedia(rawMedia);
        if (imgCount > 1 && sourceData) {
          try {
            thumbUrl = pickFirstNonVideoMediaUrl(sourceData);
          } catch { /* ignore */ }
        }
        if (!thumbUrl) {
          thumbUrl = defCover;
        } else {
          if (thumbUrl.includes('rains3.com')) {
            try { thumbUrl = await getPresignedUrl(thumbUrl); } catch { /* keep */ }
          }
          if (thumbUrl.includes('mmbiz.qpic.cn') || thumbUrl.includes('wx.qlogo.cn') || thumbUrl.includes('qpic.cn')) {
            thumbUrl = `/api/proxy/image?url=${encodeURIComponent(thumbUrl)}`;
          }
        }
        prop.thumb_url = thumbUrl;
        if (!prop.share_code) prop.share_code = '';
        prop.share_url = prop.share_code ? `/property/${username}/share/${prop.share_code}` : '';
      }

      // 查询总数
      const countSql = `SELECT COUNT(*) as total FROM wechat_robot_expat_parsed_properties pp ${whereClause}`;
      let countResult = await query(countSql, params);
      countResult = Array.isArray(countResult[0]) && Array.isArray(countResult[0]) ? countResult[0] : countResult;
      const total = (countResult && countResult[0]) ? countResult[0].total : 0;

      // 获取区域列表
      let districts = [];
      try {
        let dRows = await query(`
          SELECT pp.district, MAX(pd.name_en) as name_en
          FROM wechat_robot_expat_parsed_properties pp
          LEFT JOIN property_districts pd ON pp.district = pd.name_cn 
            OR pp.district = CONCAT(pd.name_cn, '区')
            OR CONCAT(pp.district, '区') = pd.name_cn
          WHERE pp.district IS NOT NULL AND pp.district != '' AND pp.district != 'null'
            AND pp.user_id = ? AND pp.is_listed = 1 AND pp.deleted_at IS NULL
            AND pp.status = 'published'
            AND ${RETENTION_DATE_CONDITION_PP}
          GROUP BY pp.district
          ORDER BY pp.district
        `, [userId]);
        dRows = Array.isArray(dRows[0]) && Array.isArray(dRows[0]) ? dRows[0] : dRows;
        if (Array.isArray(dRows)) {
          const seen = new Set();
          districts = dRows.filter(r => {
            const normalized = (r.district || '').replace(/区$/, '');
            if (seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
          }).map(r => ({
            value: r.district,
            label: r.name_en || r.district
          }));
        }
      } catch { /* ignore */ }

      // 获取地铁线路
      let metroLines = [];
      try {
        let mlRows = await query("SELECT id, name_cn, name_en, line_color FROM property_metro_lines WHERE is_active = 1 ORDER BY sort_order, id");
        mlRows = Array.isArray(mlRows[0]) && Array.isArray(mlRows[0]) ? mlRows[0] : mlRows;
        if (Array.isArray(mlRows)) {
          metroLines = mlRows.map(r => ({
            value: r.name_cn,
            label: r.name_en || r.name_cn,
            color: r.line_color
          }));
        }
      } catch { /* ignore */ }

      // 获取地铁站点
      let metroStations = [];
      try {
        let msRows = await query(`
          SELECT s.id, s.name_cn, s.name_en, s.line_id, l.name_cn as line_name, l.line_color
          FROM property_metro_stations s 
          LEFT JOIN property_metro_lines l ON s.line_id = l.id 
          WHERE s.is_active = 1 
          ORDER BY l.sort_order, s.sort_order, s.id
        `);
        msRows = Array.isArray(msRows[0]) && Array.isArray(msRows[0]) ? msRows[0] : msRows;
        if (Array.isArray(msRows)) {
          metroStations = msRows.map(r => ({
            value: r.name_cn,
            label: r.name_en || r.name_cn,
            line_value: r.line_name,
            line_id: r.line_id
          }));
        }
      } catch { /* ignore */ }

      // 获取默认封面图（兼容两个 key）
      const { getDefaultCoverImage: getDefCoverImg } = require('../../utils/snsXmlMediaParser');
      const defaultCoverImage = await getDefCoverImg(query);

      return success(res, {
        user: shareUser,
        properties,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        settings,
        districts,
        metro_lines: metroLines,
        metro_stations: metroStations,
        defaultCoverImage,
      });
    } catch (err) {
      console.error('userPropertyListPage error:', err);
      return error(res, '获取用户房源列表失败', 500);
    }
  }

  async shareParsedProperty(req, res) {
    try {
      const { token } = req.params;
      const sql = `SELECT p.*, m.content as moment_content, m.media_list, m.owner_nickname
                   FROM wechat_robot_expat_parsed_properties p
                   LEFT JOIN wechat_robot_moments m ON p.moment_id = m.id
                   WHERE p.share_token = ? AND p.deleted_at IS NULL LIMIT 1`;
      const rows = await query(sql, [token]);
      if (!rows[0]) return error(res, '房源不存在或已删除', 404);
      return success(res, rows[0]);
    } catch (err) {
      return error(res, '获取分享房源失败', 500);
    }
  }

  async sharePropertyByCode(req, res) {
    try {
      const { code } = req.params;
      const sql = `SELECT p.*, m.content as moment_content, m.media_list
                   FROM wechat_robot_expat_parsed_properties p
                   LEFT JOIN wechat_robot_moments m ON p.moment_id = m.id
                   WHERE p.share_code = ? AND p.deleted_at IS NULL LIMIT 1`;
      const rows = await query(sql, [code]);
      if (!rows[0]) return error(res, '房源不存在', 404);
      return success(res, rows[0]);
    } catch (err) {
      return error(res, '获取房源失败', 500);
    }
  }

  async sharePropertyByUserAndCode(req, res) {
    try {
      const { username, code } = req.params;
      const [user] = await query('SELECT id FROM users WHERE username = ?', [username]);
      if (!user) return error(res, '用户不存在', 404);
      const sql = `SELECT p.*, m.content as moment_content, m.media_list
                   FROM wechat_robot_expat_parsed_properties p
                   LEFT JOIN wechat_robot_moments m ON p.moment_id = m.id
                   WHERE p.user_id = ? AND p.share_code = ? AND p.deleted_at IS NULL LIMIT 1`;
      const rows = await query(sql, [user.id, code]);
      if (!rows[0]) return error(res, '房源不存在', 404);
      return success(res, rows[0]);
    } catch (err) {
      return error(res, '获取房源失败', 500);
    }
  }

  // ============ 搜索列表管理 ============

  async getSearchLists(req, res) {
    try {
      const lists = await query(
        `SELECT * FROM wechat_robot_expat_search_lists WHERE user_id = ? ORDER BY created_at DESC`,
        [req.user.id]
      );
      return success(res, lists);
    } catch (err) {
      return error(res, '获取搜索列表失败', 500);
    }
  }

  async createSearchList(req, res) {
    try {
      const { name, robot_id } = req.body;
      const result = await query(
        `INSERT INTO wechat_robot_expat_search_lists (user_id, robot_id, list_name, created_at) VALUES (?, ?, ?, NOW())`,
        [req.user.id, robot_id, name]
      );
      return success(res, { id: result.insertId, name }, '创建成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteSearchList(req, res) {
    try {
      await query(`DELETE FROM wechat_robot_expat_search_lists WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

/**
 * 单条记录小区名重新处理（供批量脚本调用）
 * 顺序：POI > 地址(路弄号) > 地标 > 区域，小区不能为空
 * 与 updateParsedProperty 一致
 */
async function reprocessCommunityForRecord(propId) {
  RENTAL_COMPANY_NAMES = await loadRentalCompanyNames();
  await loadValidDistricts();
  const rows = await query(
    'SELECT original_content, district, community, metro_stations, metro_lines, metro_distance, bedrooms FROM wechat_robot_expat_parsed_properties WHERE id = ? AND deleted_at IS NULL',
    [propId]
  );
  const row = Array.isArray(rows) && rows[0] ? (Array.isArray(rows[0]) ? rows[0][0] : rows[0]) : null;
  if (!row) return null;
  const origContent = (row.original_content || '').trim();
  const validDistrict = row.district && VALID_DISTRICTS.includes(row.district) ? row.district : null;

  let community = null;
  let matchedPOI = null;
  // 1) 优先 POI 匹配
  try {
    matchedPOI = await matchCommunityFromText(propId, validDistrict);
    if (matchedPOI) community = matchedPOI.community_name;
  } catch {}
  // 2) 无 POI 时提取详细地址（路+弄/号）
  if (!community && origContent) community = extractAddressFromContent(row.original_content || '');
  // 3) 无地址时用地标（静安寺、中山公园等）
  if (!community && origContent) community = extractFallbackLocation(row.original_content || '', null);
  // 4) 无地标时用区域
  if (!community && validDistrict) community = String(validDistrict).replace(/区$/, '');
  // 5) 从文案提取区域名
  if (!community && origContent) {
    const districtFromText = (origContent.match(/(徐汇|静安|长宁|普陀|虹口|杨浦|黄浦|浦东|闵行|宝山|嘉定|松江|青浦|奉贤|金山|崇明)(?:区|路|站|寺|公园|)?/) || [])[1];
    if (districtFromText && VALID_DISTRICTS.some(d => d.includes(districtFromText))) community = districtFromText;
  }
  // 6) 小区不能为空
  if (!community) community = '上海';

  // 文案提取的小区名查 POI 模糊匹配补全地铁
  let poiForFill = matchedPOI;
  if (!poiForFill) {
    try {
      poiForFill = await lookupPOIByCommunityFuzzy(community, validDistrict);
    } catch {}
  }
  const finalCommunity = (poiForFill?.community_name) || community;
  const finalDistrict = poiForFill?.district || validDistrict;
  const hasDistrict = finalDistrict && VALID_DISTRICTS.includes(finalDistrict);

  const updates = ['community = ?', 'updated_at = NOW()'];
  const params = [finalCommunity];
  if (hasDistrict && (!row.district || !VALID_DISTRICTS.includes(row.district))) {
    updates.push('district = ?');
    params.push(finalDistrict);
  }
  const isValidMetro = (v) => v && String(v).trim() !== '' && v !== '-' && v !== '无';
  const effectiveStation = isValidMetro(row.metro_stations) ? row.metro_stations : (poiForFill?.nearest_metro_station || null);
  const effectiveLine = isValidMetro(row.metro_lines) ? row.metro_lines : (poiForFill?.nearest_metro_line || null);
  const effectiveDistance = row.metro_distance ?? (poiForFill?.nearest_metro_distance) ?? null;

  if (!isValidMetro(row.metro_stations) && effectiveStation) {
    updates.push('metro_stations = ?');
    params.push(effectiveStation);
  }
  if (!isValidMetro(row.metro_lines) && effectiveLine) {
    updates.push('metro_lines = ?');
    params.push(effectiveLine);
  }
  // 有站点但仍无线路时，通过站名反查线路（确保二者同时存在）
  if (effectiveStation && !effectiveLine) {
    const lookedUpLine = await lookupMetroLineByStation(effectiveStation);
    if (lookedUpLine) {
      updates.push('metro_lines = ?');
      params.push(lookedUpLine);
    }
  }
  // 有线路但无站点 → 不清空线路（前端有POI回退显示机制）
  if ((row.metro_distance == null || row.metro_distance === '') && effectiveDistance) {
    updates.push('metro_distance = ?');
    params.push(effectiveDistance);
  }
  // 校正卧室数：2+1房=3室，1+1房=2室
  const correctedBr = parseBedroomCount(row.bedrooms, row.original_content || '');
  if (correctedBr && correctedBr >= 1 && correctedBr <= 9 && correctedBr !== (row.bedrooms || 0)) {
    updates.push('bedrooms = ?');
    params.push(correctedBr);
  }
  // 卧室和卫生间默认不能为空，文案无数据时默认为1
  const currentBedrooms = correctedBr || row.bedrooms;
  if (!currentBedrooms || currentBedrooms <= 0) {
    updates.push('bedrooms = ?');
    params.push(1);
  }
  // 查卫生间
  const btRows = await query('SELECT bathrooms FROM wechat_robot_expat_parsed_properties WHERE id = ? LIMIT 1', [propId]);
  const btRow = Array.isArray(btRows) && btRows[0] ? (Array.isArray(btRows[0]) ? btRows[0][0] : btRows[0]) : null;
  if (!btRow?.bathrooms || btRow.bathrooms <= 0) {
    updates.push('bathrooms = ?');
    params.push(1);
  }
  params.push(propId);
  await query(`UPDATE wechat_robot_expat_parsed_properties SET ${updates.join(', ')} WHERE id = ?`, params);
  return finalCommunity;
}

/** 仅校正卧室数（2+1房=3室），供批量修复调用 */
async function reprocessBedroomsOnly(propId) {
  const rows = await query(
    'SELECT id, original_content, bedrooms FROM wechat_robot_expat_parsed_properties WHERE id = ? AND deleted_at IS NULL',
    [propId]
  );
  const row = Array.isArray(rows) && rows[0] ? (Array.isArray(rows[0]) ? rows[0][0] : rows[0]) : null;
  if (!row || !row.original_content) return null;
  const correctedBr = parseBedroomCount(row.bedrooms, row.original_content);
  if (!correctedBr || correctedBr < 1 || correctedBr > 9) return null;
  if (Number(row.bedrooms) === correctedBr) return null;  // 无需更新，不计数
  await query('UPDATE wechat_robot_expat_parsed_properties SET bedrooms = ?, updated_at = NOW() WHERE id = ?', [correctedBr, propId]);
  return correctedBr;
}

const ctrl = new WeChatRobotPluginController();
ctrl.reprocessCommunityForRecord = reprocessCommunityForRecord;
ctrl.reprocessBedroomsOnly = reprocessBedroomsOnly;
ctrl.ruleBasedFullParse = ruleBasedFullParse;
ctrl.matchPOIBeforeAI = matchPOIBeforeAI;
ctrl.parsePropertyContent = parsePropertyContent;
ctrl.isPropertyRelatedContent = isPropertyRelatedContent;
ctrl.isGarbageCommunityName = isGarbageCommunityName;
ctrl.isInvalidCommunityName = isInvalidCommunityName;
ctrl.extractAddressFromContent = extractAddressFromContent;
ctrl.invalidateRentalCompanyCache = invalidateRentalCompanyCache;
ctrl.loadRentalCompanyNames = loadRentalCompanyNames;
ctrl.loadValidDistricts = loadValidDistricts;
ctrl.loadMetroData = loadMetroData;
ctrl.updateParsedPropertyFromAI = updateParsedPropertyFromAI;
module.exports = ctrl;
