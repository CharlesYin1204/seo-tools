/**
 * 房源缓存服务
 * 基于 CacheService(Redis) 封装的房源专用缓存层
 */
const CacheService = require('./CacheService');
const logger = require('../utils/logger');

const PREFIX = 'property:';
const LIST_PREFIX = 'property_list:';
const DEFAULT_TTL = 300;

class PropertyCacheService {
  /**
   * 获取缓存的房源列表
   * @param {string} key - 缓存键（不含前缀）
   * @returns {Promise<Object|null>} 缓存数据或 null
   */
  async getCachedProperties(key) {
    try {
      const data = await CacheService.get(`${LIST_PREFIX}${key}`);
      if (data) {
        logger.debug('PropertyCacheService.getCachedProperties 命中', { key });
      }
      return data;
    } catch (error) {
      logger.error('PropertyCacheService.getCachedProperties 失败', { key, error: error.message });
      return null;
    }
  }

  /**
   * 设置房源列表缓存
   * @param {string} key - 缓存键（不含前缀）
   * @param {Object} data - 要缓存的数据
   * @param {number} ttl - 过期秒数，默认300
   */
  async setCachedProperties(key, data, ttl = DEFAULT_TTL) {
    try {
      await CacheService.set(`${LIST_PREFIX}${key}`, data, ttl);
      logger.debug('PropertyCacheService.setCachedProperties 设置成功', { key, ttl });
    } catch (error) {
      logger.error('PropertyCacheService.setCachedProperties 失败', { key, error: error.message });
    }
  }

  /**
   * 获取单个房源缓存
   * @param {number|string} propertyId - 房源ID
   * @returns {Promise<Object|null>}
   */
  async getCachedProperty(propertyId) {
    try {
      return await CacheService.get(`${PREFIX}${propertyId}`);
    } catch (error) {
      logger.error('PropertyCacheService.getCachedProperty 失败', { propertyId, error: error.message });
      return null;
    }
  }

  /**
   * 设置单个房源缓存
   * @param {number|string} propertyId - 房源ID
   * @param {Object} data - 房源数据
   * @param {number} ttl - 过期秒数
   */
  async setCachedProperty(propertyId, data, ttl = DEFAULT_TTL) {
    try {
      await CacheService.set(`${PREFIX}${propertyId}`, data, ttl);
    } catch (error) {
      logger.error('PropertyCacheService.setCachedProperty 失败', { propertyId, error: error.message });
    }
  }

  /**
   * 使指定房源缓存失效（单条 + 列表）
   * @param {number|string} propertyId - 房源ID
   */
  async invalidatePropertyCache(propertyId) {
    try {
      await CacheService.del(`${PREFIX}${propertyId}`);
      await CacheService.flush(LIST_PREFIX);
      logger.info('PropertyCacheService.invalidatePropertyCache', { propertyId });
    } catch (error) {
      logger.error('PropertyCacheService.invalidatePropertyCache 失败', {
        propertyId,
        error: error.message,
      });
    }
  }

  /**
   * 清除全部房源缓存
   */
  async invalidateAllPropertyCache() {
    try {
      await CacheService.flush(PREFIX);
      await CacheService.flush(LIST_PREFIX);
      logger.info('PropertyCacheService.invalidateAllPropertyCache 已清除全部缓存');
    } catch (error) {
      logger.error('PropertyCacheService.invalidateAllPropertyCache 失败', {
        error: error.message,
      });
    }
  }
}

module.exports = new PropertyCacheService();
