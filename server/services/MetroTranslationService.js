/**
 * 地铁站名中英翻译服务
 * 提供地铁线路和站名的中英文互译，优先查数据库，降级使用内置映射表
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

class MetroTranslationService {
  constructor() {
    this._lineCache = new Map();
    this._stationCache = new Map();
    this._cacheTTL = 3600 * 1000;
    this._lastCacheClear = Date.now();
  }

  /** 地铁线路中文→英文映射表 */
  static lineTranslations = {
    '1号线': 'Line 1', '2号线': 'Line 2', '3号线': 'Line 3',
    '4号线': 'Line 4', '5号线': 'Line 5', '6号线': 'Line 6',
    '7号线': 'Line 7', '8号线': 'Line 8', '9号线': 'Line 9',
    '10号线': 'Line 10', '11号线': 'Line 11', '12号线': 'Line 12',
    '13号线': 'Line 13', '14号线': 'Line 14', '15号线': 'Line 15',
    '16号线': 'Line 16', '17号线': 'Line 17', '18号线': 'Line 18',
    '浦江线': 'Pujiang Line', '磁浮线': 'Maglev Line',
  };

  /**
   * 检查并清理过期内存缓存
   */
  _checkCacheExpiry() {
    if (Date.now() - this._lastCacheClear > this._cacheTTL) {
      this._lineCache.clear();
      this._stationCache.clear();
      this._lastCacheClear = Date.now();
    }
  }

  /**
   * 翻译线路名称（中文→英文）
   * @param {string} nameCn - 中文线路名
   * @returns {Promise<string>} 英文线路名
   */
  async translateLineName(nameCn) {
    if (!nameCn) return '';
    this._checkCacheExpiry();

    if (this._lineCache.has(nameCn)) {
      return this._lineCache.get(nameCn);
    }

    try {
      const rows = await query(
        'SELECT name_en FROM property_metro_lines WHERE name_cn = ? LIMIT 1',
        [nameCn]
      );
      if (rows[0]?.name_en) {
        this._lineCache.set(nameCn, rows[0].name_en);
        return rows[0].name_en;
      }
    } catch (error) {
      logger.warn('MetroTranslationService.translateLineName 数据库查询失败，使用映射表', {
        nameCn,
        error: error.message,
      });
    }

    const fallback = MetroTranslationService.lineTranslations[nameCn] || nameCn;
    this._lineCache.set(nameCn, fallback);
    return fallback;
  }

  /**
   * 翻译站名（中文→英文）
   * @param {string} nameCn - 中文站名
   * @returns {Promise<string>} 英文站名
   */
  async translateStationName(nameCn) {
    if (!nameCn) return '';
    this._checkCacheExpiry();

    if (this._stationCache.has(nameCn)) {
      return this._stationCache.get(nameCn);
    }

    try {
      const rows = await query(
        'SELECT name_en FROM property_metro_stations WHERE name_cn = ? LIMIT 1',
        [nameCn]
      );
      if (rows[0]?.name_en) {
        this._stationCache.set(nameCn, rows[0].name_en);
        return rows[0].name_en;
      }
    } catch (error) {
      logger.warn('MetroTranslationService.translateStationName 数据库查询失败', {
        nameCn,
        error: error.message,
      });
    }

    this._stationCache.set(nameCn, nameCn);
    return nameCn;
  }

  /**
   * 根据线路ID获取英文名
   * @param {number} lineId - 线路ID
   * @returns {Promise<string>} 英文名
   */
  async getLineEnglishName(lineId) {
    if (!lineId) return '';
    const cacheKey = `id:${lineId}`;

    if (this._lineCache.has(cacheKey)) {
      return this._lineCache.get(cacheKey);
    }

    try {
      const rows = await query(
        'SELECT name_en, name_cn FROM property_metro_lines WHERE id = ? LIMIT 1',
        [lineId]
      );
      if (rows[0]) {
        const nameEn = rows[0].name_en
          || MetroTranslationService.lineTranslations[rows[0].name_cn]
          || rows[0].name_cn
          || '';
        this._lineCache.set(cacheKey, nameEn);
        return nameEn;
      }
    } catch (error) {
      logger.error('MetroTranslationService.getLineEnglishName 失败', {
        lineId,
        error: error.message,
      });
    }
    return '';
  }

  /**
   * 根据站点ID获取英文名
   * @param {number} stationId - 站点ID
   * @returns {Promise<string>} 英文名
   */
  async getStationEnglishName(stationId) {
    if (!stationId) return '';
    const cacheKey = `id:${stationId}`;

    if (this._stationCache.has(cacheKey)) {
      return this._stationCache.get(cacheKey);
    }

    try {
      const rows = await query(
        'SELECT name_en, name_cn FROM property_metro_stations WHERE id = ? LIMIT 1',
        [stationId]
      );
      if (rows[0]) {
        const nameEn = rows[0].name_en || rows[0].name_cn || '';
        this._stationCache.set(cacheKey, nameEn);
        return nameEn;
      }
    } catch (error) {
      logger.error('MetroTranslationService.getStationEnglishName 失败', {
        stationId,
        error: error.message,
      });
    }
    return '';
  }

  /**
   * 批量翻译线路名称
   * @param {string[]} namesCn - 中文线路名数组
   * @returns {Promise<Object>} { '1号线': 'Line 1', ... }
   */
  async batchTranslateLines(namesCn) {
    const result = {};
    for (const name of namesCn) {
      result[name] = await this.translateLineName(name);
    }
    return result;
  }

  /**
   * 批量翻译站名
   * @param {string[]} namesCn - 中文站名数组
   * @returns {Promise<Object>} { '人民广场': 'People\'s Square', ... }
   */
  async batchTranslateStations(namesCn) {
    const result = {};
    for (const name of namesCn) {
      result[name] = await this.translateStationName(name);
    }
    return result;
  }
}

module.exports = new MetroTranslationService();
