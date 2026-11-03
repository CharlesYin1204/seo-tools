/**
 * Redis配置与连接管理
 * 用于Session存储、缓存和队列
 */
const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;

function createRedisClient() {
  if (redisClient) return redisClient;

  redisClient = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DATABASE, 10) || 0,
    keyPrefix: process.env.REDIS_PREFIX || 'expatshome_node:',
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  redisClient.on('connect', () => {
    logger.info('Redis连接成功');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis连接错误', { error: err.message });
  });

  return redisClient;
}

function getRedisClient() {
  if (!redisClient) {
    createRedisClient();
  }
  return redisClient;
}

async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis连接已关闭');
  }
}

module.exports = {
  createRedisClient,
  getRedisClient,
  closeRedis,
};
