/**
 * 房源采集管理控制器
 * 管理房源采集源配置、采集任务的启动与监控
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class ExpatPropertyScraperController {
  /**
   * 查询采集源列表
   * GET /admin/scraper/sources
   */
  async getSources(req, res) {
    try {
      const rows = await query(
        'SELECT * FROM property_scraper_sources ORDER BY created_at DESC'
      );
      return success(res, rows);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        logger.warn('property_scraper_sources表不存在');
        return success(res, [], '采集源表尚未创建');
      }
      logger.error('获取采集源失败', { error: err.message });
      return error(res, '获取采集源失败', 500);
    }
  }

  /**
   * 创建或更新采集源
   * POST /admin/scraper/sources  body: { id?, name, url, type, config, is_active, sort_order }
   */
  async saveSource(req, res) {
    try {
      const { id, name, url, type, config, is_active, sort_order } = req.body;

      if (!name || !url) {
        return error(res, '采集源名称和URL不能为空', 400);
      }

      const configJson = typeof config === 'object' ? JSON.stringify(config) : (config || '{}');

      const statusVal = is_active === 0 || is_active === false ? 'inactive' : 'active';

      if (id) {
        const [existing] = await query('SELECT id FROM property_scraper_sources WHERE id = ?', [id]);
        if (!existing) {
          return error(res, '采集源不存在', 404);
        }
        await query(
          'UPDATE property_scraper_sources SET name = ?, url = ?, scraper_class = ?, config = ?, status = ?, updated_at = NOW() WHERE id = ?',
          [name, url, type || 'web', configJson, statusVal, id]
        );
        const [updated] = await query('SELECT * FROM property_scraper_sources WHERE id = ?', [id]);
        return success(res, updated, '采集源更新成功');
      }

      const result = await query(
        'INSERT INTO property_scraper_sources (name, slug, url, scraper_class, config, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [name, name.toLowerCase().replace(/\s+/g, '-'), url, type || 'web', configJson, statusVal]
      );
      const [created] = await query('SELECT * FROM property_scraper_sources WHERE id = ?', [result.insertId]);
      return success(res, created, '采集源创建成功');
    } catch (err) {
      logger.error('保存采集源失败', { error: err.message });
      return error(res, '保存采集源失败', 500);
    }
  }

  /**
   * 删除采集源
   * DELETE /admin/scraper/sources/:id
   */
  async deleteSource(req, res) {
    try {
      const { id } = req.params;
      const [existing] = await query('SELECT id FROM property_scraper_sources WHERE id = ?', [id]);
      if (!existing) {
        return error(res, '采集源不存在', 404);
      }
      await query('DELETE FROM property_scraper_sources WHERE id = ?', [id]);
      return success(res, null, '采集源删除成功');
    } catch (err) {
      logger.error('删除采集源失败', { error: err.message, id: req.params.id });
      return error(res, '删除采集源失败', 500);
    }
  }

  /**
   * 获取采集任务列表
   * GET /admin/scraper/tasks?page=1&pageSize=20
   */
  async getTasks(req, res) {
    try {
      const { page = 1, pageSize = 20 } = req.query;
      const limit = parseInt(pageSize, 10);
      const offset = (parseInt(page, 10) - 1) * limit;

      const [countResult] = await query('SELECT COUNT(*) as total FROM property_scraper_tasks');
      const total = countResult ? countResult.total : 0;

      const data = await query(
        'SELECT t.*, s.name as source_name FROM property_scraper_tasks t LEFT JOIN property_scraper_sources s ON t.source_id = s.id ORDER BY t.created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
      return paginated(res, data, total, parseInt(page, 10), limit);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return success(res, [], '采集任务表尚未创建');
      }
      logger.error('获取采集任务失败', { error: err.message });
      return error(res, '获取采集任务失败', 500);
    }
  }

  /**
   * 启动采集任务
   * POST /admin/scraper/start  body: { source_id }
   */
  async startScraping(req, res) {
    try {
      const { source_id } = req.body;
      if (!source_id) {
        return error(res, '请指定采集源', 400);
      }

      const [source] = await query(
        "SELECT * FROM property_scraper_sources WHERE id = ? AND status = 'active'", [source_id]
      );
      if (!source) {
        return error(res, '采集源不存在或未启用', 404);
      }

      let taskId = null;
      try {
        const result = await query(
          "INSERT INTO property_scraper_tasks (source_id, status, started_at, created_at) VALUES (?, 'running', NOW(), NOW())",
          [source_id]
        );
        taskId = result.insertId;
      } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
          return error(res, '采集任务表尚未创建，请先初始化数据库', 400);
        }
        throw e;
      }

      logger.info('采集任务已启动', { taskId, source_id, source_name: source.name });

      return success(res, {
        task_id: taskId,
        source_id,
        source_name: source.name,
        status: 'running',
        message: '采集任务已提交，后台执行中',
      }, '采集任务启动成功');
    } catch (err) {
      logger.error('启动采集任务失败', { error: err.message });
      return error(res, '启动采集任务失败', 500);
    }
  }
}

module.exports = new ExpatPropertyScraperController();
