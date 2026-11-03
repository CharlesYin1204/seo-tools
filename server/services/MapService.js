/**
 * 地图服务
 * 高德API密钥、POI搜索、区域中心
 */
const axios = require('axios');
const { query } = require('../config/database');
const logger = require('../utils/logger');

class MapService {
  constructor() {
    this._amapKey = null;
  }

  /**
   * 获取高德地图 API Key（支持多Key轮训）
   * @returns {Promise<string>}
   */
  async getAmapKey() {
    try {
      const MapKeyRotationService = require('./MapKeyRotationService');
      const key = await MapKeyRotationService.getApiKey();
      if (key) return key;
    } catch (e) {
      logger.warn('MapService: 轮训服务获取Key失败，降级到直接查询', { error: e.message });
    }
    if (this._amapKey) return this._amapKey;
    try {
      const rows = await query(
        "SELECT api_key FROM system_map_settings WHERE provider = 'amap' AND is_enabled = 1 ORDER BY id DESC LIMIT 1"
      );
      this._amapKey = rows[0]?.api_key || process.env.AMAP_API_KEY || '';
    } catch (e) {
      this._amapKey = process.env.AMAP_API_KEY || '';
    }
    return this._amapKey;
  }

  /**
   * POI 关键词搜索
   * @param {string} keyword - 关键词
   * @param {Object} opts - { city, location }
   * @returns {Promise<Array<{ name, address, location }>>}
   */
  async searchPOI(keyword, opts = {}) {
    const key = await this.getAmapKey();
    if (!key) {
      logger.warn('MapService.searchPOI 无 API Key');
      return [];
    }
    try {
      const params = {
        key,
        keywords: keyword,
        city: opts.city || '上海',
        citylimit: true,
      };
      if (opts.location) params.location = opts.location;
      const res = await axios.get('https://restapi.amap.com/v3/place/text', {
        params,
        timeout: 8000,
      });
      const pois = res.data?.pois || [];
      return pois.slice(0, 10).map((p) => ({
        name: p.name,
        address: p.address,
        location: p.location,
      }));
    } catch (error) {
      logger.error('MapService.searchPOI 失败', { keyword, error: error.message });
      return [];
    }
  }

  /**
   * 获取区域中心点坐标
   * @param {string} district - 区名如 浦东新区
   * @returns {Promise<{ longitude: number, latitude: number }|null>}
   */
  async getDistrictCenter(district) {
    if (!district) return null;
    try {
      const rows = await query(
        'SELECT longitude, latitude FROM shanghai_district_centers WHERE district_name = ? LIMIT 1',
        [district]
      );
      if (rows[0]) {
        return {
          longitude: parseFloat(rows[0].longitude),
          latitude: parseFloat(rows[0].latitude),
        };
      }
    } catch (e) {
      logger.warn('MapService.getDistrictCenter 失败', { district, error: e.message });
    }
    return null;
  }
}

module.exports = new MapService();
