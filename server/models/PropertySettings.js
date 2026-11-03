/**
 * 房源设置相关模型
 * 对应 property_districts, property_metro_lines, property_metro_stations 等表
 */
const BaseModel = require('./BaseModel');

class PropertySettings {
  async getDistricts() {
    const sql = `SELECT * FROM property_districts ORDER BY sort_order ASC, name_cn ASC`;
    const { query } = require('../config/database');
    return query(sql);
  }

  async getMetroLines() {
    const sql = `SELECT * FROM property_metro_lines ORDER BY sort_order ASC, name_cn ASC`;
    const { query } = require('../config/database');
    return query(sql);
  }

  async getMetroStations(lineId = null) {
    const { query } = require('../config/database');
    if (lineId) {
      return query(`SELECT *, line_id as metro_line_id FROM property_metro_stations WHERE line_id = ? ORDER BY sort_order ASC`, [lineId]);
    }
    return query(`SELECT s.*, s.line_id as metro_line_id, l.name_cn as line_name FROM property_metro_stations s LEFT JOIN property_metro_lines l ON s.line_id = l.id ORDER BY l.sort_order ASC, s.sort_order ASC`);
  }

  async getCommunityDict(search = '') {
    const { query } = require('../config/database');
    if (search) {
      return query(`SELECT * FROM property_community_dict WHERE community_name LIKE ? LIMIT 50`, [`%${search}%`]);
    }
    return query(`SELECT * FROM property_community_dict ORDER BY community_name LIMIT 500`);
  }

  async getGeocodeCache(community, district = '') {
    const { query } = require('../config/database');
    let sql = `SELECT * FROM address_geocode_cache WHERE community = ?`;
    const params = [community];
    if (district) {
      sql += ` AND district = ?`;
      params.push(district);
    }
    sql += ` LIMIT 1`;
    const rows = await query(sql, params);
    return rows[0] || null;
  }
}

module.exports = new PropertySettings();
