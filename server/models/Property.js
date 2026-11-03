/**
 * 房源模型
 * 与PHP版一致，首页房源来自 wechat_robot_expat_parsed_properties 表
 */
const BaseModel = require('./BaseModel');
const { buildListedPropertyFilter } = require('../utils/publishFilter');

class Property extends BaseModel {
  constructor() {
    super('wechat_robot_expat_parsed_properties');
  }

  async findListed(options = {}) {
    const {
      page = 1, pageSize = 20,
      district = '', priceMin = 0, priceMax = 0, bedrooms = 0,
      search = '', metro_line = '', metro_station = '',
      price_range = '', sort = 'publish_time', area = '',
      publish_time_start = '', publish_time_end = '', property_code = '',
    } = options;

    const pf = await buildListedPropertyFilter('p', { includeDedup: true });
    const baseConds = ['p.deleted_at IS NULL', "p.status = 'published'", ...pf.conditions];
    let where = baseConds.join(' AND ');
    const params = [...pf.params];

    if (district) {
      where += ` AND p.district = ?`;
      params.push(district);
    }
    if (bedrooms > 0) {
      where += ` AND p.bedrooms = ?`;
      params.push(bedrooms);
    }
    if (price_range) {
      if (price_range.includes('+')) {
        const min = parseInt(price_range.replace('+', ''), 10);
        where += ` AND p.price_value >= ?`;
        params.push(min);
      } else if (price_range.includes('-')) {
        const [min, max] = price_range.split('-').map(Number);
        where += ` AND p.price_value >= ? AND p.price_value <= ?`;
        params.push(min, max);
      }
    } else {
      if (priceMin > 0) {
        where += ` AND p.price_value >= ?`;
        params.push(priceMin);
      }
      if (priceMax > 0) {
        where += ` AND p.price_value <= ?`;
        params.push(priceMax);
      }
    }
    if (metro_line) {
      where += ` AND p.metro_lines LIKE ?`;
      params.push(`%${metro_line}%`);
    }
    if (metro_station) {
      where += ` AND p.metro_stations LIKE ?`;
      params.push(`%${metro_station}%`);
    }
    if (area) {
      if (area.startsWith('0-')) {
        const max = parseInt(area.replace('0-', ''), 10);
        where += ` AND p.area_sqm > 0 AND p.area_sqm < ?`;
        params.push(max);
      } else if (area.endsWith('-')) {
        const min = parseInt(area.replace('-', ''), 10);
        where += ` AND p.area_sqm >= ?`;
        params.push(min);
      } else if (area.includes('-')) {
        const [min, max] = area.split('-').map(Number);
        where += ` AND p.area_sqm >= ? AND p.area_sqm <= ?`;
        params.push(min, max);
      }
    }
    if (search) {
      where += ` AND (p.community LIKE ? OR p.district LIKE ? OR p.description LIKE ? OR p.metro_stations LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (property_code) {
      where += ` AND p.property_code LIKE ?`;
      params.push(`%${property_code}%`);
    }
    if (publish_time_start) {
      where += ` AND p.moment_publish_time >= ?`;
      params.push(`${publish_time_start} 00:00:00`);
    }
    if (publish_time_end) {
      where += ` AND p.moment_publish_time <= ?`;
      params.push(`${publish_time_end} 23:59:59`);
    }

    const countSql = `SELECT COUNT(*) as total FROM ${this.tableName} p WHERE ${where}`;
    const [countResult] = await this.raw(countSql, params);
    const total = countResult ? countResult.total : 0;

    let orderBy = 'p.moment_publish_time DESC, p.created_at DESC';
    if (sort === 'upload_time') {
      orderBy = 'p.created_at DESC';
    }

    const dataSql = `SELECT p.*, m.media_list as moment_media_list, m.local_media_urls as moment_local_media
      FROM ${this.tableName} p
      LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
      WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);
    const data = await this.raw(dataSql, params);

    const { mergeMomentMedia } = require('../utils/propertyMediaMerge');
    if (Array.isArray(data)) {
      data.forEach(row => mergeMomentMedia(row));
    }

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findByUserId(userId) {
    return this.findAll({ where: { user_id: userId }, orderBy: 'created_at DESC' });
  }

  async getMapProperties(options = {}) {
    const pf = await buildListedPropertyFilter('p', { includeDedup: true });
    const mapConditions = ['p.deleted_at IS NULL', "p.status = 'published'", ...pf.conditions];
    const mapParams = [...pf.params];
    if (options.user) {
      mapConditions.push('(u.username = ? OR u.id = ?)');
      mapParams.push(String(options.user), Number(options.user) || 0);
    }
    const mapWhere = mapConditions.join(' AND ');
    /* 不 SELECT thumb_url/custom_price：部分线上库无 thumb_url 等列会导致查询失败；封面由 mergeMomentMedia + media_urls 在前端解析 */
    const sql = `SELECT p.id, p.community, p.price, p.price_value,
                 p.bedrooms, p.bathrooms, p.district,
                 p.latitude, p.longitude, p.media_urls, p.metro_lines, p.metro_stations,
                 p.area_sqm, p.has_elevator, p.floor_info, p.title, p.description,
                 p.moment_publish_time, p.created_at, p.share_url, p.share_code, p.property_code,
                 p.local_images, p.moment_id,
                 m.media_list as moment_media_list, m.local_media_urls as moment_local_media
                 FROM ${this.tableName} p
                 LEFT JOIN users u ON p.user_id = u.id
                 LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
                 WHERE ${mapWhere}
                 ORDER BY p.moment_publish_time DESC`;
    const data = await this.raw(sql, mapParams);
    const { mergeMomentMedia } = require('../utils/propertyMediaMerge');
    if (Array.isArray(data)) {
      data.forEach(row => mergeMomentMedia(row));
    }
    return data;
  }
}

module.exports = new Property();
