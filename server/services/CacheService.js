/**
 * Redis 缓存服务
 */
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const DEFAULT_TTL = 3600;

class CacheService {
  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {Promise<string|null>}
   */
  async get(key) {
    try {
      const redis = getRedisClient();
      const val = await redis.get(key);
      if (val === null) return null;
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    } catch (error) {
      logger.error('CacheService.get 失败', { key, error: error.message });
      return null;
    }
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {*} value - 值（对象会 JSON 序列化）
   * @param {number} ttl - 过期秒数，默认 3600
   */
  async set(key, value, ttl = DEFAULT_TTL) {
    try {
      const redis = getRedisClient();
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttl > 0) {
        await redis.setex(key, ttl, str);
      } else {
        await redis.set(key, str);
      }
    } catch (error) {
      logger.error('CacheService.set 失败', { key, error: error.message });
      throw error;
    }
  }

  /**
   * 删除单个键
   * @param {string} key
   */
  async del(key) {
    try {
      const redis = getRedisClient();
      await redis.del(key);
    } catch (error) {
      logger.error('CacheService.del 失败', { key, error: error.message });
      throw error;
    }
  }

  /**
   * 按前缀批量删除
   * @param {string} prefix - 如 "user:123:"
   */
  async flush(prefix) {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info('CacheService.flush 已删除', { prefix, count: keys.length });
      }
    } catch (error) {
      logger.error('CacheService.flush 失败', { prefix, error: error.message });
      throw error;
    }
  }
}

module.exports = new CacheService();
