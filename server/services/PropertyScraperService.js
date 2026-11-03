/**
 * 房源爬虫服务
 * 管理爬取任务与记录
 */
const { query } = require('../config/database');
const QueueService = require('./QueueService');
const logger = require('../utils/logger');

const SCRAPE_QUEUE = 'property_scrape';

class PropertyScraperService {
  /**
   * 启动爬取任务
   * @param {number} sourceId - 数据源ID
   * @param {Object} config - { keyword, district, maxPages, ... }
   * @returns {Promise<{ taskId: number }>}
   */
  async startScrape(sourceId, config = {}) {
    const result = await query(
      `INSERT INTO property_scrape_tasks (source_id, config, status, created_at) VALUES (?, ?, 'pending', NOW())`,
      [sourceId, JSON.stringify(config)]
    );
    const taskId = result.insertId;

    await QueueService.addJob(SCRAPE_QUEUE, { taskId, sourceId, config });
    logger.info('PropertyScraperService.startScrape', { taskId, sourceId });
    return { taskId };
  }

  /**
   * 获取用户的爬取任务列表
   * @param {number} userId - 用户ID
   * @param {Object} opts - { page, pageSize }
   * @returns {Promise<{ data: Array, total: number }>}
   */
  async getScrapeTasks(userId, opts = {}) {
    const page = opts.page || 1;
    const pageSize = opts.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const countRows = await query(
      'SELECT COUNT(*) as total FROM property_scrape_tasks t JOIN property_scrape_sources s ON t.source_id = s.id WHERE s.user_id = ?',
      [userId]
    );
    const total = countRows[0]?.total || 0;

    const data = await query(
      `SELECT t.*, s.name as source_name 
       FROM property_scrape_tasks t 
       JOIN property_scrape_sources s ON t.source_id = s.id 
       WHERE s.user_id = ? 
       ORDER BY t.id DESC 
       LIMIT ? OFFSET ?`,
      [userId, pageSize, offset]
    );

    return { data, total, page, pageSize };
  }

  /**
   * 获取任务爬取记录
   * @param {number} taskId - 任务ID
   * @param {Object} opts - { page, pageSize }
   * @returns {Promise<{ data: Array, total: number }>}
   */
  async getScrapedRecords(taskId, opts = {}) {
    const page = opts.page || 1;
    const pageSize = opts.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const countRows = await query(
      'SELECT COUNT(*) as total FROM property_scrape_records WHERE task_id = ?',
      [taskId]
    );
    const total = countRows[0]?.total || 0;

    const data = await query(
      'SELECT * FROM property_scrape_records WHERE task_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
      [taskId, pageSize, offset]
    );

    return { data, total, page, pageSize };
  }
}

module.exports = new PropertyScraperService();
