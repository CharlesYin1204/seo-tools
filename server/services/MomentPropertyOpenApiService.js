const { query } = require('../config/database');
const { buildListedPropertyFilter } = require('../utils/publishFilter');
const PropertySettings = require('../models/PropertySettings');
const logger = require('../utils/logger');
const {
  RETENTION_DATE_CONDITION_P,
} = require('./MomentRetentionService');

const PUBLISHER_CONTACT_TABLE = 'publisher_contact_directory';

function buildPublisherDisplaySql() {
  return `COALESCE(m.owner_nickname, m2.owner_nickname, p.publisher_name)`;
}

function buildPublisherMatchSql(alias = 'pc') {
  return `CONVERT(${alias}.publisher_name USING utf8mb4) COLLATE utf8mb4_unicode_ci = (${buildPublisherDisplaySql()}) COLLATE utf8mb4_unicode_ci`;
}

function getDuplexFilterSql(alias = 'p') {
  return `(${alias}.is_duplex = 1 OR ${alias}.original_content LIKE '%复式%' OR ${alias}.original_content LIKE '%复试%' OR ${alias}.original_content LIKE '%Loft%' OR ${alias}.original_content LIKE '%LOFT%' OR ${alias}.original_content LIKE '%跃层%')`;
}

async function ensurePublisherContactTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS ${PUBLISHER_CONTACT_TABLE} (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      publisher_name VARCHAR(191) NOT NULL,
      contact_info VARCHAR(255) NULL,
      remark VARCHAR(255) NULL,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_publisher_contact_name (publisher_name),
      KEY idx_publisher_contact_enabled (is_enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function addInFilter(where, params, column, rawValue) {
  const values = String(rawValue || '').split(',').map(v => v.trim()).filter(Boolean);
  if (values.length === 1) {
    where.push(`${column} = ?`);
    params.push(values[0]);
  } else if (values.length > 1) {
    where.push(`${column} IN (${values.map(() => '?').join(',')})`);
    params.push(...values);
  }
}

async function buildWhere(reqQuery = {}) {
  const where = ['p.deleted_at IS NULL', RETENTION_DATE_CONDITION_P];
  const params = [];
  const publisherDisplaySql = buildPublisherDisplaySql();
  let needsPOIJoin = false;
  const keywordTrim = reqQuery.keyword ? String(reqQuery.keyword).trim() : '';

  if (reqQuery.robot_id) {
    where.push('p.robot_id = ?');
    params.push(reqQuery.robot_id);
  } else {
    const pf = await buildListedPropertyFilter('p', { includeDedup: true });
    where.push(...pf.conditions);
    params.push(...pf.params);
  }

  if (keywordTrim) {
    const kw = `%${keywordTrim}%`;
    where.push(`(
      p.original_content LIKE ? OR p.favorites_content LIKE ? OR p.community LIKE ?
      OR IFNULL(p.title, '') LIKE ? OR IFNULL(p.description, '') LIKE ? OR IFNULL(p.district, '') LIKE ?
      OR EXISTS (SELECT 1 FROM property_community_dict pcd_kw WHERE pcd_kw.is_enabled = 1 AND pcd_kw.community_name = p.community AND pcd_kw.district LIKE ?)
      OR m.content LIKE ? OR IFNULL(m.fav_content, '') LIKE ? OR m.owner_nickname LIKE ?
      OR m2.content LIKE ? OR IFNULL(m2.fav_content, '') LIKE ? OR m2.owner_nickname LIKE ?
    )`);
    params.push(kw, kw, kw, kw, kw, kw, kw, kw, kw, kw, kw, kw, kw);
  }

  if (reqQuery.district) {
    const distList = String(reqQuery.district).split(',').map(s => s.trim()).filter(Boolean);
    if (distList.length === 1) {
      where.push('COALESCE(poi1.district, poi2.district, p.district) LIKE ?');
      params.push(`%${distList[0].replace(/新区$/, '').replace(/区$/, '')}%`);
      needsPOIJoin = true;
    } else if (distList.length > 1) {
      where.push(`(${distList.map(() => 'COALESCE(poi1.district, poi2.district, p.district) LIKE ?').join(' OR ')})`);
      distList.forEach(d => params.push(`%${d.replace(/新区$/, '').replace(/区$/, '')}%`));
      needsPOIJoin = true;
    }
  }

  if (reqQuery.community) {
    where.push('p.community LIKE ?');
    params.push(`%${reqQuery.community}%`);
  }
  if (reqQuery.property_code) {
    const codeList = String(reqQuery.property_code).split(',').map(s => s.trim()).filter(Boolean);
    if (codeList.length === 1) {
      where.push('p.property_code LIKE ?');
      params.push(`%${codeList[0]}%`);
    } else if (codeList.length > 1) {
      where.push(`(${codeList.map(() => 'p.property_code LIKE ?').join(' OR ')})`);
      codeList.forEach(code => params.push(`%${code}%`));
    }
  }

  if (reqQuery.price_min || reqQuery.priceMin) {
    where.push('p.price_value >= ?');
    params.push(parseFloat(reqQuery.price_min || reqQuery.priceMin));
  }
  if (reqQuery.price_max || reqQuery.priceMax) {
    where.push('p.price_value <= ?');
    params.push(parseFloat(reqQuery.price_max || reqQuery.priceMax));
  }
  if (reqQuery.bedrooms) {
    const brArr = String(reqQuery.bedrooms).split(',').map(v => parseInt(v, 10)).filter(v => v >= 1 && v <= 9);
    if (brArr.length === 1) {
      where.push('p.bedrooms = ?');
      params.push(brArr[0]);
    } else if (brArr.length > 1) {
      where.push(`p.bedrooms IN (${brArr.map(() => '?').join(',')})`);
      params.push(...brArr);
    }
  }
  if (reqQuery.metro_lines) {
    const lines = String(reqQuery.metro_lines).split(',').map(v => v.trim()).filter(Boolean);
    if (lines.length) {
      const conds = lines.map(() => '(p.metro_lines = ? OR FIND_IN_SET(?, p.metro_lines) > 0 OR FIND_IN_SET(?, COALESCE(poi1.nearest_metro_line, poi2.nearest_metro_line)) > 0)');
      where.push(`(${conds.join(' OR ')})`);
      lines.forEach(l => params.push(l, l, l));
      needsPOIJoin = true;
    }
  }
  if (reqQuery.metro_stations) {
    const stations = String(reqQuery.metro_stations).split(',').map(v => v.trim()).filter(Boolean);
    if (stations.length) {
      const conds = stations.map(() => '(p.metro_stations = ? OR FIND_IN_SET(?, p.metro_stations) > 0 OR FIND_IN_SET(?, COALESCE(poi1.nearest_metro_station, poi2.nearest_metro_station)) > 0)');
      where.push(`(${conds.join(' OR ')})`);
      stations.forEach(s => params.push(s, s, s));
      needsPOIJoin = true;
    }
  }

  if (reqQuery.publisher) {
    where.push(`${publisherDisplaySql} = ?`);
    params.push(reqQuery.publisher);
  }
  if (reqQuery.publish_time_start) {
    where.push('COALESCE(p.moment_publish_time, p.created_at) >= ?');
    params.push(reqQuery.publish_time_start + ' 00:00:00');
  }
  if (reqQuery.publish_time_end) {
    where.push('COALESCE(p.moment_publish_time, p.created_at) <= ?');
    params.push(reqQuery.publish_time_end + ' 23:59:59');
  }
  if (reqQuery.has_elevator === '1') where.push('p.has_elevator = 1');
  if (reqQuery.has_parking === '1') where.push('p.has_parking = 1');
  if (reqQuery.has_commission === '1') where.push('p.has_commission = 1');
  if (reqQuery.is_duplex === '1') where.push(getDuplexFilterSql('p'));
  if (reqQuery.outdoor_features) {
    const outdoorArr = String(reqQuery.outdoor_features).split(',').map(v => v.trim()).filter(Boolean);
    if (outdoorArr.length) {
      const conds = outdoorArr.map((feat) => {
        if (feat === '花园') {
          params.push(`%${feat}%`);
          return `((p.outdoor_features LIKE ? AND p.community NOT LIKE '%花园%') OR (p.original_content LIKE '%带花园%' OR p.original_content LIKE '%私家花园%' OR p.original_content LIKE '%独立花园%' OR p.original_content LIKE '%花园洋房%'))`;
        }
        params.push(`%${feat}%`, `%${feat}%`);
        return '(p.outdoor_features LIKE ? OR p.original_content LIKE ?)';
      });
      where.push(`(${conds.join(' OR ')})`);
    }
  }
  if (reqQuery.content_type) addInFilter(where, params, 'm.content_type', reqQuery.content_type);
  if (reqQuery.exclude_keywords) {
    String(reqQuery.exclude_keywords).split(',').map(k => k.trim()).filter(Boolean).forEach((k) => {
      where.push('p.original_content NOT LIKE ?');
      params.push(`%${k}%`);
    });
  }
  if (reqQuery.property_only === '1') {
    where.push('(p.price IS NOT NULL OR p.bedrooms IS NOT NULL OR p.community IS NOT NULL OR p.district IS NOT NULL)');
  }
  if (reqQuery.not_in_poi === '1') {
    where.push(`p.community IS NOT NULL AND p.community != '' AND NOT EXISTS (
      SELECT 1 FROM property_community_dict pcd
      WHERE pcd.community_name = p.community AND pcd.is_enabled = 1
    )`);
  }
  if (reqQuery.include_sale !== '1') {
    where.push('p.is_sale = 0');
  }
  if (reqQuery.is_listed === '1' || reqQuery.is_listed === '0') {
    where.push('p.is_listed = ?');
    params.push(reqQuery.is_listed === '1' ? 1 : 0);
  }
  if (reqQuery.dedup === '1') {
    where.push(`(p.content_hash IS NULL OR p.id = (
      SELECT sub.id FROM wechat_robot_expat_parsed_properties sub
      WHERE sub.content_hash = p.content_hash
        AND sub.deleted_at IS NULL
        AND sub.robot_id = p.robot_id
      ORDER BY sub.has_commission DESC, sub.created_at DESC LIMIT 1
    ))`);
  }

  return { where, params, needsPOIJoin, keywordTrim };
}

function getJoinSql(needsPOIJoin, needsMomentJoin, includePublisherJoin = false) {
  const publisherJoinSql = buildPublisherMatchSql('pc');
  const poiJoinSql = needsPOIJoin
    ? ` LEFT JOIN property_community_dict poi1 ON p.community = poi1.community_name AND p.district = poi1.district AND poi1.is_enabled = 1
        LEFT JOIN property_community_dict poi2 ON p.community = poi2.community_name AND poi2.is_enabled = 1 AND poi1.id IS NULL
          AND 1 = (SELECT COUNT(DISTINCT pcd2.district) FROM property_community_dict pcd2 WHERE pcd2.community_name = p.community AND pcd2.is_enabled = 1)`
    : '';
  const opJoinSql = needsMomentJoin ? 'LEFT JOIN wechat_robot_expat_properties op ON p.property_id = op.id' : '';
  const momentJoinSql = needsMomentJoin
    ? `LEFT JOIN wechat_robot_moments m ON COALESCE(p.moment_id, op.moment_id) = m.moment_id
       LEFT JOIN wechat_robot_moments m2 ON op.moment_id = m2.moment_id AND p.moment_id IS NULL`
    : '';
  const publisherJoinSqlFull = includePublisherJoin
    ? `LEFT JOIN ${PUBLISHER_CONTACT_TABLE} pc ON ${publisherJoinSql} AND pc.is_enabled = 1`
    : '';
  return { poiJoinSql, opJoinSql, momentJoinSql, publisherJoinSqlFull };
}

function sortClause(reqQuery = {}) {
  const so = reqQuery.sort_order === 'asc' ? 'ASC' : 'DESC';
  if (reqQuery.sort_field === 'price_value') return `ORDER BY COALESCE(p.price_value, 0) ${so}, p.created_at DESC`;
  if (reqQuery.sort_field === 'moment_publish_time') return `ORDER BY COALESCE(p.moment_publish_time, p.created_at) ${so}, p.created_at DESC`;
  return 'ORDER BY p.created_at DESC';
}

async function listProperties(reqQuery = {}) {
  await ensurePublisherContactTable();
  const page = Math.max(1, parseInt(reqQuery.page, 10) || 1);
  const perPage = Math.min(200, Math.max(1, parseInt(reqQuery.per_page || reqQuery.pageSize, 10) || 50));
  const offset = (page - 1) * perPage;
  const { where, params, needsPOIJoin, keywordTrim } = await buildWhere(reqQuery);
  const whereStr = where.join(' AND ');
  const needsMomentJoin = Boolean(reqQuery.content_type || reqQuery.publisher || keywordTrim);
  const joins = getJoinSql(needsPOIJoin, needsMomentJoin, false);
  const orderClause = sortClause(reqQuery);

  const [countRow] = await query(
    `SELECT COUNT(${needsPOIJoin ? 'DISTINCT p.id' : '*'}) as total
     FROM wechat_robot_expat_parsed_properties p
     ${joins.opJoinSql}
     ${joins.momentJoinSql}
     ${joins.poiJoinSql}
     WHERE ${whereStr}`,
    params
  );

  const pageIds = await query(
    `SELECT ${needsPOIJoin ? 'DISTINCT' : ''} p.id
     FROM wechat_robot_expat_parsed_properties p
     ${joins.opJoinSql}
     ${joins.momentJoinSql}
     ${joins.poiJoinSql}
     WHERE ${whereStr} ${orderClause} LIMIT ? OFFSET ?`,
    [...params, perPage, offset]
  );
  const idList = pageIds.map(r => r.id);
  if (!idList.length) {
    return { data: [], pagination: { total: countRow?.total || 0, current_page: page, per_page: perPage, total_pages: 0 } };
  }

  const data = await getPropertiesByIds(idList, orderClause);
  const total = countRow?.total || 0;
  return { data, pagination: { total, current_page: page, per_page: perPage, total_pages: Math.ceil(total / perPage) } };
}

async function getPropertiesByIds(ids, orderClause = 'ORDER BY p.created_at DESC') {
  const placeholders = ids.map(() => '?').join(',');
  const publisherDisplaySql = buildPublisherDisplaySql();
  return query(
    `SELECT p.id, p.robot_id, p.original_content, p.community, p.price, p.price_value, p.custom_price, p.display_price,
            p.bedrooms, p.bathrooms,
            CASE WHEN ${getDuplexFilterSql('p')} THEN 1 ELSE 0 END as is_duplex,
            CASE WHEN (p.outdoor_features IS NOT NULL AND p.outdoor_features != '' AND p.outdoor_features != '0') THEN p.outdoor_features
                 ELSE CONCAT_WS(',',
                   IF(p.original_content LIKE '%阳台%', '阳台', NULL),
                   IF(p.original_content LIKE '%露台%', '露台', NULL),
                   IF((p.original_content LIKE '%带花园%' OR p.original_content LIKE '%私家花园%' OR p.original_content LIKE '%独立花园%' OR p.original_content LIKE '%花园洋房%' OR p.original_content LIKE '%赠花园%') AND (p.community IS NULL OR p.community NOT LIKE '%花园%'), '花园', NULL),
                   IF(p.original_content LIKE '%院子%' OR p.original_content LIKE '%庭院%', '院子/庭院', NULL)
                 ) END as outdoor_features,
            COALESCE(poi1.district, poi2.district, p.district) as district,
            ${publisherDisplaySql} as publisher_name,
            COALESCE(NULLIF(TRIM(p.contact_info), ''), NULLIF(TRIM(pc.contact_info), '')) as contact_info,
            CASE WHEN p.has_elevator = 1 OR p.original_content LIKE '%有电梯%' OR p.original_content LIKE '%电梯房%' OR p.original_content LIKE '%带电梯%' OR p.community LIKE '%大楼%' OR p.community LIKE '%大厦%' THEN 1 ELSE 0 END as has_elevator,
            CASE WHEN p.has_parking = 1 OR p.original_content LIKE '%有车位%' OR p.original_content LIKE '%含车位%' OR p.original_content LIKE '%送车位%' OR p.original_content LIKE '%带车位%' THEN 1 ELSE 0 END as has_parking,
            CASE WHEN p.has_commission = 1 OR p.original_content LIKE '%付佣%' OR p.original_content LIKE '%全佣%' OR p.original_content LIKE '%半佣%' OR p.original_content LIKE '%有佣%' OR p.original_content LIKE '%佣金%' OR p.original_content LIKE '%中介费%' OR p.original_content LIKE '%[红包]%' THEN 1 ELSE 0 END as has_commission,
            p.metro_lines, p.metro_stations, p.metro_distance,
            COALESCE(p.metro_distance, poi1.nearest_metro_distance, poi2.nearest_metro_distance) as effective_metro_distance,
            COALESCE(p.latitude, poi1.latitude, poi2.latitude) as latitude,
            COALESCE(p.longitude, poi1.longitude, poi2.longitude) as longitude,
            CASE WHEN poi1.id IS NOT NULL OR poi2.id IS NOT NULL THEN 1 ELSE 0 END as is_in_poi,
            p.area_sqm, p.moment_publish_time, p.created_at, p.is_listed,
            p.media_urls, p.local_images, p.property_code, p.share_code, p.title, p.description,
            p.favorites_content,
            COALESCE(m.content, m2.content) as moment_content,
            COALESCE(m.fav_content, m2.fav_content) as moment_fav_content,
            COALESCE(m.content_type, m2.content_type) as content_type,
            m.media_list as moment_media_list,
            m.local_media_urls as moment_local_media,
            m2.media_list as moment_media_list2,
            m2.local_media_urls as moment_local_media2
     FROM wechat_robot_expat_parsed_properties p
     LEFT JOIN wechat_robot_expat_properties op ON p.property_id = op.id
     LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
     LEFT JOIN wechat_robot_moments m2 ON op.moment_id = m2.moment_id AND p.moment_id IS NULL
     LEFT JOIN ${PUBLISHER_CONTACT_TABLE} pc ON ${buildPublisherMatchSql('pc')} AND pc.is_enabled = 1
     LEFT JOIN property_community_dict poi1 ON p.community = poi1.community_name AND p.district = poi1.district AND poi1.is_enabled = 1
     LEFT JOIN property_community_dict poi2 ON p.community = poi2.community_name AND poi2.is_enabled = 1 AND poi1.id IS NULL
       AND 1 = (SELECT COUNT(DISTINCT pcd2.district) FROM property_community_dict pcd2 WHERE pcd2.community_name = p.community AND pcd2.is_enabled = 1)
     WHERE p.id IN (${placeholders})
     ${orderClause}`,
    ids
  ).then((rows) => {
    try {
      const { mergeMomentMedia } = require('../utils/propertyMediaMerge');
      rows.forEach(row => mergeMomentMedia(row));
    } catch (err) {
      logger.warn('开放API媒体合并失败', { error: err.message });
    }
    return rows;
  });
}

async function detail(id) {
  const rows = await getPropertiesByIds([id]);
  return rows[0] || null;
}

async function filters() {
  const districtSql = `SELECT DISTINCT p.district
    FROM wechat_robot_expat_parsed_properties p
    WHERE p.deleted_at IS NULL AND ${RETENTION_DATE_CONDITION_P}
      AND p.district IS NOT NULL AND p.district != ''
    ORDER BY p.district`;

  const [districts, allDistricts, metroLines, metroStations, communities] = await Promise.all([
    query(districtSql).catch(() => []),
    PropertySettings.getDistricts().catch(() => []),
    PropertySettings.getMetroLines().catch(() => []),
    PropertySettings.getMetroStations().catch(() => []),
    query(`SELECT DISTINCT community, district FROM wechat_robot_expat_parsed_properties
      WHERE deleted_at IS NULL AND community IS NOT NULL AND community != ''
      ORDER BY created_at DESC LIMIT 500`).catch(() => []),
  ]);

  return {
    districts: districts.map(d => d.district),
    allDistricts: allDistricts.map(d => d.name_cn),
    metro_lines: metroLines.map(l => l.name_cn),
    metro_stations: metroStations.map(s => s.name_cn),
    metro_stations_with_lines: metroStations.map(s => ({ name: s.name_cn, line: s.line_name || '' })),
    communities,
  };
}

module.exports = { listProperties, detail, filters };
