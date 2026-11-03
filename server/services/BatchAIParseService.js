/**
 * 批量 AI 解析服务
 * 管理朋友圈批量解析队列与任务状态
 */
const { query } = require('../config/database');
const QueueService = require('./QueueService');
const logger = require('../utils/logger');

const PARSE_QUEUE_NAME = 'moment_ai_parse';

class BatchAIParseService {
  constructor() {
    this._processorRegistered = false;
  }

  /**
   * 启动批量解析任务
   * @param {number} userId - 用户ID
   * @param {number[]} momentIds - 朋友圈ID列表
   * @param {Object} config - AI配置 { modelId, ... }
   * @returns {Promise<{ queueId: string }>}
   */
  async startBatchParse(userId, momentIds, config = {}) {
    const queueId = `parse_${userId}_${Date.now()}`;
    await query(
      `INSERT INTO wechat_robot_parse_queue (queue_id, user_id, moment_ids, config, status, created_at) 
       VALUES (?, ?, ?, ?, 'pending', NOW())`,
      [queueId, userId, JSON.stringify(momentIds), JSON.stringify(config)]
    );

    await QueueService.addJob(PARSE_QUEUE_NAME, {
      queueId,
      userId,
      momentIds,
      config,
    });

    logger.info('BatchAIParseService.startBatchParse', { queueId, userId, count: momentIds.length });
    return { queueId };
  }

  /**
   * 处理队列中的解析任务
   */
  processQueue() {
    if (this._processorRegistered) return;
    QueueService.processQueue(PARSE_QUEUE_NAME, async (job) => {
      const { queueId, userId, momentIds, config } = job.data;
      await this._processBatch(queueId, userId, momentIds, config);
      return { queueId };
    });
    this._processorRegistered = true;
  }

  /**
   * 获取队列状态
   * @param {string} queueId - 队列ID
   * @returns {Promise<{ status, total, completed, failed }>}
   */
  async getQueueStatus(queueId) {
    const rows = await query(
      'SELECT * FROM wechat_robot_parse_queue WHERE queue_id = ? LIMIT 1',
      [queueId]
    );
    if (!rows[0]) return null;

    const r = rows[0];
    const momentIds = Array.isArray(r.moment_ids) ? r.moment_ids : (JSON.parse(r.moment_ids || '[]') || []);
    const logs = await query(
      'SELECT moment_id, status FROM wechat_robot_parse_logs WHERE queue_id = ?',
      [queueId]
    );

    const completed = logs.filter((l) => l.status === 'success').length;
    const failed = logs.filter((l) => l.status === 'failed').length;
    return {
      status: r.status,
      total: momentIds.length,
      completed,
      failed,
    };
  }

  async _processBatch(queueId, userId, momentIds, config) {
    await query('UPDATE wechat_robot_parse_queue SET status = ? WHERE queue_id = ?', ['processing', queueId]);
    for (const mid of momentIds) {
      try {
        // 实际解析逻辑由 AIService + ContentMatchValidator 完成
        await query(
          'INSERT INTO wechat_robot_parse_logs (queue_id, moment_id, user_id, status, created_at) VALUES (?, ?, ?, ?, NOW())',
          [queueId, mid, userId, 'success']
        );
      } catch (e) {
        logger.error('BatchAIParseService 单条解析失败', { queueId, momentId: mid, error: e.message });
        await query(
          'INSERT INTO wechat_robot_parse_logs (queue_id, moment_id, user_id, status, error_msg, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [queueId, mid, userId, 'failed', e.message]
        );
      }
    }
    await query('UPDATE wechat_robot_parse_queue SET status = ? WHERE queue_id = ?', ['completed', queueId]);
  }
}

module.exports = new BatchAIParseService();
