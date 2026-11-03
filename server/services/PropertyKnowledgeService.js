/**
 * 房产知识库服务
 * 小区搜索、区域匹配、地铁站匹配
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

const METRO_STATIONS = [
  '人民广场', '南京东路', '陆家嘴', '徐家汇', '静安寺', '中山公园',
  '世纪大道', '人民广场', '陕西南路', '常熟路', '虹桥', '莘庄',
  '五角场', '上海南站', '上海火车站', '虹桥火车站', '浦东国际机场',
];

class PropertyKnowledgeService {
  /**
   * 搜索小区
   * @param {string} name - 小区名或关键词
   * @returns {Promise<Array<{ id, community_name, district, address }>>}
   */
  async searchCommunity(name) {
    if (!name || String(name).trim().length < 2) return [];
    try {
      const keyword = `%${String(name).trim()}%`;
      const rows = await query(
        `SELECT id, community_name, district, street, address, longitude, latitude 
         FROM property_community_dict 
         WHERE is_enabled = 1 AND (community_name LIKE ? OR alias_names LIKE ?) 
         ORDER BY search_count DESC, is_hot DESC LIMIT 20`,
        [keyword, keyword]
      );
      return rows.map((r) => ({
        id: r.id,
        community_name: r.community_name,
        district: r.district,
        address: r.address,
      }));
    } catch (error) {
      logger.warn('PropertyKnowledgeService.searchCommunity 失败', { name, error: error.message });
      return [];
    }
  }

  /**
   * 根据小区名获取所属区域
   * @param {string} community - 小区名
   * @returns {Promise<string|null>}
   */
  async getDistrictForCommunity(community) {
    if (!community) return null;
    try {
      const rows = await query(
        'SELECT district FROM property_community_dict WHERE community_name = ? AND is_enabled = 1 LIMIT 1',
        [community]
      );
      return rows[0]?.district || null;
    } catch (error) {
      logger.warn('PropertyKnowledgeService.getDistrictForCommunity 失败', { community, error: error.message });
      return null;
    }
  }

  /**
   * 从文本中匹配地铁站
   * @param {string} text - 文本内容
   * @returns {Array<{ station: string }>}
   */
  matchMetroStation(text) {
    if (!text) return [];
    const result = [];
    for (const station of METRO_STATIONS) {
      if (text.includes(station)) {
        result.push({ station });
      }
    }
    const lineMatch = text.match(/(\d+)\s*号线\s*([^，,。\s]+站?)/g);
    if (lineMatch) {
      for (const m of lineMatch) {
        const s = m.replace(/(\d+)\s*号线\s*/, '').trim();
        if (s && !result.some((r) => r.station === s)) {
          result.push({ station: s });
        }
      }
    }
    return result;
  }
}

module.exports = new PropertyKnowledgeService();
