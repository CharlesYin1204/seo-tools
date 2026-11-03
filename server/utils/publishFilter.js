/**
 * 房源库发布规则筛选工具
 * 统一读取 property_library_publish_settings 配置，
 * 确保所有页面（用户端、管理端、公开前端）使用完全一致的筛选逻辑。
 */
const SystemSetting = require('../models/SystemSetting');

const SETTINGS_KEY = 'property_library_publish_settings';

async function loadPublishSettings() {
  try {
    const raw = await SystemSetting.get(SETTINGS_KEY, '{}');
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

/**
 * 纯内容质量过滤条件（不含发布人/时间筛选），可独立使用
 * @param {string} alias - 表别名
 * @returns {string[]} WHERE条件片段数组（不含参数占位符）
 */
function buildContentQualityFilter(alias = 'p') {
  const col = (name) => alias ? `${alias}.${name}` : name;
  const oc = col('original_content');
  const cm = col('community');
  const GENERIC = "'上海','微信同号','','null'";

  return [
    // 必须有真实房源信息（排除community为泛化值的无效记录）
    `(
      (${col('price')} IS NOT NULL AND ${col('price')} != '' AND ${col('price')} != '0')
      OR (${col('bedrooms')} IS NOT NULL AND ${col('bedrooms')} > 0)
      OR (${cm} IS NOT NULL AND ${cm} NOT IN (${GENERIC}))
      OR (${col('district')} IS NOT NULL AND ${col('district')} != '')
    )`,
    // 出售房源过滤（使用is_sale预计算索引列）
    `${col('is_sale')} = 0`,
    // 收房/包租/代运营等广告
    `(${oc} IS NULL OR (
      ${oc} NOT LIKE '%收房包租%' AND ${oc} NOT LIKE '%民宿代运营%'
      AND ${oc} NOT LIKE '%大量收房%' AND ${oc} NOT LIKE '%长年包租%'
      AND ${oc} NOT LIKE '%包租托管%' AND ${oc} NOT LIKE '%专业包租%'
      AND ${oc} NOT LIKE '%包租房源%' AND ${oc} NOT LIKE '%大量拿房%'
      AND ${oc} NOT LIKE '%长期收房%' AND ${oc} NOT LIKE '%高价收房%'
      AND ${oc} NOT LIKE '%收房，收房%' AND ${oc} NOT LIKE '%收房收房%'
      AND ${oc} NOT LIKE '%收房啦%' AND ${oc} NOT LIKE '%大量包租收房%'
      AND ${oc} NOT LIKE '%收房、谈托管%'
      AND ${oc} NOT LIKE '%求租%' AND ${oc} NOT LIKE '%招租%'
      AND ${oc} NOT LIKE '%疯狂收房%'
    ))`,
    // 搬家/推广/非房源广告
    `(${oc} IS NULL OR (
      ${oc} NOT LIKE '%日式搬家%'
      AND ${oc} NOT LIKE '%扫码查看更多%'
      AND ${oc} NOT LIKE '%关注朋友圈%'
    ))`,
  ];
}

/**
 * 构建完整发布规则的 WHERE 子句（发布人 + 时间 + 质量过滤）
 * @param {string} alias - 表别名
 * @returns {{ conditions: string[], params: any[], hasPublishConfig: boolean }}
 */
async function buildPublishFilter(alias = 'p') {
  const conditions = [];
  const params = [];
  const cfg = await loadPublishSettings();
  const hasCfg = Array.isArray(cfg.selected_friends) && cfg.selected_friends.length > 0;
  const col = (name) => alias ? `${alias}.${name}` : name;

  if (hasCfg) {
    conditions.push(`${col('publisher_name')} IN (${cfg.selected_friends.map(() => '?').join(',')})`);
    params.push(...cfg.selected_friends);
    if (cfg.time_start) {
      conditions.push(`COALESCE(${col('moment_publish_time')}, ${col('created_at')}) >= ?`);
      params.push(cfg.time_start + ' 00:00:00');
    }
    if (cfg.time_end) {
      conditions.push(`COALESCE(${col('moment_publish_time')}, ${col('created_at')}) <= ?`);
      params.push(cfg.time_end + ' 23:59:59');
    }
    conditions.push(...buildContentQualityFilter(alias));
  } else {
    conditions.push(`${col('is_listed')} = 1`);
  }

  return { conditions, params, hasPublishConfig: hasCfg };
}

/**
 * ?????????????????????????????????
 * ???????? robot_id ?????????????????
 */
async function buildListedPropertyFilter(alias = 'p', options = {}) {
  const conditions = [];
  const params = [];
  const col = (name) => alias ? `${alias}.${name}` : name;
  const includeQuality = options.includeQuality !== false;
  const includeDedup = options.includeDedup === true;

  conditions.push(`${col('is_listed')} = 1`);
  if (includeQuality) {
    conditions.push(...buildContentQualityFilter(alias));
  }
  if (includeDedup) {
    conditions.push(`(${col('content_hash')} IS NULL OR ${col('id')} = (
      SELECT sub.id FROM wechat_robot_expat_parsed_properties sub
      WHERE sub.content_hash = ${col('content_hash')}
        AND sub.deleted_at IS NULL
        AND sub.is_listed = 1
      ORDER BY sub.has_commission DESC, sub.created_at DESC LIMIT 1
    ))`);
  }

  return { conditions, params, hasPublishConfig: false };
}

module.exports = { loadPublishSettings, buildPublishFilter, buildListedPropertyFilter, buildContentQualityFilter };
