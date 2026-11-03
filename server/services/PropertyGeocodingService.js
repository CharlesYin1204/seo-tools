/**
 * 房源地理编码服务
 * 使用高德API，结合 address_geocode_cache 缓存
 */
const axios = require('axios');
const { query } = require('../config/database');
const logger = require('../utils/logger');

class PropertyGeocodingService {
  constructor() {
    this.apiKey = process.env.AMAP_API_KEY || '';
    this.memoryCache = new Map();
  }

  async _loadApiKey() {
    try {
      const MapKeyRotationService = require('./MapKeyRotationService');
      const key = await MapKeyRotationService.getApiKey();
      if (key) {
        this.apiKey = key;
        return this.apiKey;
      }
    } catch (e) {
      logger.warn('PropertyGeocodingService: 轮训服务获取Key失败，降级到直接查询', { error: e.message });
    }
    if (this.apiKey) return this.apiKey;
    try {
      const rows = await query(
        "SELECT api_key FROM system_map_settings WHERE provider = 'amap' AND is_enabled = 1 ORDER BY id DESC LIMIT 1"
      );
      this.apiKey = rows[0]?.api_key || process.env.AMAP_API_KEY || '';
    } catch (e) {
      this.apiKey = process.env.AMAP_API_KEY || '';
    }
    return this.apiKey;
  }

  _buildCacheKey(address) {
    const str = String(address || '').trim().replace(/\s+/g, '');
    return require('crypto').createHash('md5').update(str).digest('hex');
  }

  _isShanghaiCoord(lng, lat) {
    const x = parseFloat(lng);
    const y = parseFloat(lat);
    return !isNaN(x) && !isNaN(y) && x >= 120.85 && x <= 122.2 && y >= 30.65 && y <= 31.9;
  }

  /**
   * 地址转经纬度
   * @param {string} address - 地址
   * @returns {Promise<{ longitude: number, latitude: number, district?: string }|null>}
   */
  async geocode(address) {
    if (!address || !String(address).trim()) return null;
    const key = this._buildCacheKey(address);

    if (this.memoryCache.has(key)) return this.memoryCache.get(key);

    const rows = await query(
      'SELECT longitude, latitude, district FROM address_geocode_cache WHERE address_key = ?',
      [key]
    );
    if (rows[0] && this._isShanghaiCoord(rows[0].longitude, rows[0].latitude)) {
      const r = {
        longitude: parseFloat(rows[0].longitude),
        latitude: parseFloat(rows[0].latitude),
        district: rows[0].district,
      };
      this.memoryCache.set(key, r);
      await query(
        'UPDATE address_geocode_cache SET hit_count = hit_count + 1, last_used_at = NOW() WHERE address_key = ?',
        [key]
      );
      return r;
    }

    const ak = await this._loadApiKey();
    if (!ak) {
      return this._getDistrictCenter(String(address).replace(/区|市|上海/g, '').trim() || null);
    }

    try {
      const res = await axios.get('https://restapi.amap.com/v3/geocode/geo', {
        params: { key: ak, address: `上海市${address}` },
        timeout: 8000,
      });
      const loc = res.data?.geocodes?.[0]?.location;
      if (loc) {
        const [lng, lat] = loc.split(',').map(Number);
        if (this._isShanghaiCoord(lng, lat)) {
          const adcode = res.data.geocodes[0].adcode || '';
          const district = res.data.geocodes[0].addressComponent?.district || '';

          await query(
            `INSERT INTO address_geocode_cache (address_key, original_address, district, longitude, latitude, accuracy, source, hit_count, last_used_at)
             VALUES (?, ?, ?, ?, ?, 3, 'amap', 1, NOW())
             ON DUPLICATE KEY UPDATE longitude = VALUES(longitude), latitude = VALUES(latitude), hit_count = hit_count + 1, last_used_at = NOW()`,
            [key, address, district, lng, lat]
          );

          const r = { longitude: lng, latitude: lat, district };
          this.memoryCache.set(key, r);
          return r;
        }
      }
    } catch (error) {
      logger.warn('PropertyGeocodingService.geocode API 失败', { address, error: error.message });
    }

    const district = String(address).match(/([\u4e00-\u9fa5]+区)/)?.[1];
    return this._getDistrictCenter(district);
  }

  /**
   * 经纬度逆地理编码
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @returns {Promise<{ address?: string, district?: string }|null>}
   */
  async reverseGeocode(lat, lng) {
    const ak = await this._loadApiKey();
    if (!ak) return null;
    try {
      const res = await axios.get('https://restapi.amap.com/v3/geocode/regeo', {
        params: { key: ak, location: `${lng},${lat}` },
        timeout: 8000,
      });
      const regeo = res.data?.regeocode;
      if (regeo) {
        return {
          address: regeo.formatted_address,
          district: regeo.addressComponent?.district,
        };
      }
    } catch (error) {
      logger.warn('PropertyGeocodingService.reverseGeocode 失败', { lat, lng, error: error.message });
    }
    return null;
  }

  /**
   * 批量地理编码
   * @param {string[]} addresses - 地址列表
   * @returns {Promise<Array<{ address: string, longitude?: number, latitude?: number }>>}
   */
  async batchGeocode(addresses) {
    const results = [];
    for (const addr of addresses) {
      const r = await this.geocode(addr);
      results.push({
        address: addr,
        longitude: r?.longitude,
        latitude: r?.latitude,
      });
    }
    return results;
  }

  async _getDistrictCenter(district) {
    if (!district) return null;
    const rows = await query(
      'SELECT longitude, latitude FROM shanghai_district_centers WHERE district_name = ? LIMIT 1',
      [district]
    );
    if (rows[0]) {
      return {
        longitude: parseFloat(rows[0].longitude),
        latitude: parseFloat(rows[0].latitude),
        district,
      };
    }
    return null;
  }
}

module.exports = new PropertyGeocodingService();
