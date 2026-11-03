/**
 * 朋友圈解析房源模型
 * 对应数据库 wechat_robot_expat_parsed_properties 表
 */
const BaseModel = require('./BaseModel');

class ParsedProperty extends BaseModel {
  constructor() {
    super('wechat_robot_expat_parsed_properties');
  }

  async findByUserId(userId, options = {}) {
    const {
      page = 1, pageSize = 20, searchListId = '', district = '',
      community = '', priceMin = 0, priceMax = 0, bedrooms = 0,
      metroLine = '', metroStation = '', search = '', sortBy = 'created_at',
      sortOrder = 'DESC',
    } = options;

    let sql = `SELECT p.*, m.content as moment_content, m.media_list, m.owner_nickname
               FROM ${this.tableName} p
               LEFT JOIN wechat_robot_moments m ON p.moment_id = m.id
               WHERE p.user_id = ? AND p.deleted_at IS NULL`;
    const params = [userId];

    if (searchListId) {
      sql += ` AND p.search_list_id = ?`;
      params.push(searchListId);
    }
    if (district) {
      sql += ` AND p.district = ?`;
      params.push(district);
    }
    if (community) {
      sql += ` AND p.community LIKE ?`;
      params.push(`%${community}%`);
    }
    if (priceMin > 0) {
      sql += ` AND p.price_value >= ?`;
      params.push(priceMin);
    }
    if (priceMax > 0) {
      sql += ` AND p.price_value <= ?`;
      params.push(priceMax);
    }
    if (bedrooms > 0) {
      sql += ` AND p.bedrooms = ?`;
      params.push(bedrooms);
    }
    if (metroLine) {
      sql += ` AND p.metro_lines LIKE ?`;
      params.push(`%${metroLine}%`);
    }
    if (metroStation) {
      sql += ` AND p.metro_stations LIKE ?`;
      params.push(`%${metroStation}%`);
    }
    if (search) {
      sql += ` AND (p.community LIKE ? OR m.content LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s);
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) AS cnt`;
    const [countResult] = await this.raw(countSql, params);
    const total = countResult ? countResult.total : 0;

    const validSorts = ['created_at', 'price_value', 'community', 'district'];
    const safeSortBy = validSorts.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    sql += ` ORDER BY p.${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    const data = await this.raw(sql, params);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async softDelete(id) {
    return this.update(id, {
      deleted_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
  }

  async getDistinctDistricts(userId, isAdmin = false) {
    if (isAdmin) {
      const sql = `SELECT DISTINCT district FROM ${this.tableName} WHERE deleted_at IS NULL AND district IS NOT NULL AND district != '' ORDER BY district`;
      return this.raw(sql, []);
    }
    const sql = `SELECT DISTINCT district FROM ${this.tableName} WHERE user_id = ? AND deleted_at IS NULL AND district IS NOT NULL AND district != '' ORDER BY district`;
    return this.raw(sql, [userId]);
  }

  async getStatsByUserId(userId) {
    const sql = `SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as located,
      COUNT(DISTINCT district) as district_count,
      COUNT(DISTINCT community) as community_count
      FROM ${this.tableName} WHERE user_id = ? AND deleted_at IS NULL`;
    const rows = await this.raw(sql, [userId]);
    return rows[0] || { total: 0, located: 0, district_count: 0, community_count: 0 };
  }
}

module.exports = new ParsedProperty();
