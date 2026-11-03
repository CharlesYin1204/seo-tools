/**
 * Bull 队列服务 - 后台任务处理
 */
const Bull = require('bull');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const redisOpt = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const queues = new Map();

class QueueService {
  _getQueue(queueName) {
    if (queues.has(queueName)) return queues.get(queueName);
    const q = new Bull(queueName, {
      redis: redisOpt,
      prefix: (process.env.REDIS_PREFIX || 'expatshome_node') + 'bull:',
    });
    q.on('error', (err) => logger.error('QueueService 队列错误', { queueName, error: err.message }));
    queues.set(queueName, q);
    return q;
  }

  /**
   * 添加任务到队列
   * @param {string} queueName - 队列名
   * @param {Object} data - 任务数据
   * @param {Object} opts - { delay, attempts, backoff }
   * @returns {Promise<Bull.Job>}
   */
  async addJob(queueName, data, opts = {}) {
    const queue = this._getQueue(queueName);
    const job = await queue.add(data, opts);
    logger.info('QueueService.addJob', { queueName, jobId: job.id });
    return job;
  }

  /**
   * 注册队列处理器
   * @param {string} queueName - 队列名
   * @param {Function} handler - async (job) => {}
   */
  processQueue(queueName, handler) {
    const queue = this._getQueue(queueName);
    queue.process(async (job) => {
      try {
        return await handler(job);
      } catch (error) {
        logger.error('QueueService 任务执行失败', { queueName, jobId: job.id, error: error.message });
        throw error;
      }
    });
    logger.info('QueueService.processQueue 已注册', { queueName });
  }

  /**
   * 获取队列状态
   * @param {string} queueName
   * @returns {Promise<{ waiting, active, completed, failed }>}
   */
  async getQueueCounts(queueName) {
    const queue = this._getQueue(queueName);
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }

  /**
   * 获取任务状态
   * @param {string} queueName
   * @param {string} jobId
   * @returns {Promise<Object|null>}
   */
  async getJob(queueName, jobId) {
    const queue = this._getQueue(queueName);
    const job = await queue.getJob(jobId);
    return job ? { id: job.id, data: job.data, progress: job.progress(), returnvalue: job.returnvalue } : null;
  }
}

module.exports = new QueueService();
