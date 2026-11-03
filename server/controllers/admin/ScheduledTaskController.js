/**
 * 管理员端 - 朋友圈同步房源定时任务控制器
 * 对应PHP版本的 WeChatRobotPluginController 中定时任务相关方法
 * 数据表: wechat_robot_expat_scheduled_tasks, wechat_robot_expat_task_logs
 */
const { query } = require('../../config/database');
const WeChatRobotService = require('../../services/WeChatRobotService');

class ScheduledTaskController {
  /**
   * 获取任务列表
   * GET /admin/scheduled-tasks
   */
  static async getTasks(req, res) {
    try {
      const { robot_id } = req.query;
      let sql = `SELECT t.*, a.nickname as robot_nickname, a.wxid as robot_wxid 
                 FROM wechat_robot_expat_scheduled_tasks t
                 LEFT JOIN wechat_robot_accounts a ON t.robot_id = a.id`;
      const params = [];

      if (robot_id) {
        sql += ' WHERE t.robot_id = ?';
        params.push(robot_id);
      }

      sql += ' ORDER BY t.created_at DESC';

      const tasks = await query(sql, params);

      const parsed = tasks.map(task => ({
        ...task,
        search_keywords: ScheduledTaskController._parseJSON(task.search_keywords, []),
        exclude_keywords: ScheduledTaskController._parseJSON(task.exclude_keywords, []),
        search_wxids: ScheduledTaskController._parseJSON(task.search_wxids, []),
        search_tag_ids: ScheduledTaskController._parseJSON(task.search_tag_ids, []),
        specific_dates: ScheduledTaskController._parseJSON(task.specific_dates, []),
        last_run_result: ScheduledTaskController._parseJSON(task.last_run_result, null),
      }));

      res.json({ success: true, data: parsed });
    } catch (err) {
      console.error('[ScheduledTask] 获取任务列表失败:', err);
      res.status(500).json({ success: false, message: '获取任务列表失败' });
    }
  }

  /**
   * 获取单个任务详情
   * GET /admin/scheduled-tasks/:id
   */
  static async getTaskDetail(req, res) {
    try {
      const { id } = req.params;
      const rows = await query('SELECT * FROM wechat_robot_expat_scheduled_tasks WHERE id = ?', [id]);
      if (!rows.length) {
        return res.status(404).json({ success: false, message: '任务不存在' });
      }
      const task = rows[0];
      task.search_keywords = ScheduledTaskController._parseJSON(task.search_keywords, []);
      task.exclude_keywords = ScheduledTaskController._parseJSON(task.exclude_keywords, []);
      task.search_wxids = ScheduledTaskController._parseJSON(task.search_wxids, []);
      task.search_tag_ids = ScheduledTaskController._parseJSON(task.search_tag_ids, []);
      task.specific_dates = ScheduledTaskController._parseJSON(task.specific_dates, []);
      task.last_run_result = ScheduledTaskController._parseJSON(task.last_run_result, null);
      task.schedule_mode = task.schedule_mode || 'weekly';
      task.search_time_mode = task.search_time_mode || 'absolute';

      res.json({ success: true, data: task });
    } catch (err) {
      console.error('[ScheduledTask] 获取任务详情失败:', err);
      res.status(500).json({ success: false, message: '获取任务详情失败' });
    }
  }

  /**
   * 保存（创建/更新）定时任务
   * POST /admin/scheduled-tasks
   */
  static async saveTask(req, res) {
    try {
      const {
        id, robot_id, task_name, schedule_time, schedule_mode,
        schedule_days, interval_hours, specific_dates,
        search_keywords, exclude_keywords,
        search_time_mode, search_date_from, search_date_to, search_recent_hours,
        search_wxids, search_tag_ids,
        auto_save, sync_before_search, is_active,
        run_immediately
      } = req.body;

      if (!robot_id || !task_name) {
        return res.status(400).json({ success: false, message: '请填写必要字段' });
      }

      const userId = req.user?.id || 1;

      const data = {
        user_id: userId,
        robot_id,
        task_name,
        schedule_time: schedule_time || '09:00:00',
        schedule_mode: schedule_mode || 'specific_dates',
        schedule_days: schedule_days || '1,2,3,4,5,6,7',
        interval_hours: interval_hours || null,
        specific_dates: typeof specific_dates === 'string' ? specific_dates : JSON.stringify(specific_dates || []),
        search_keywords: typeof search_keywords === 'string' ? search_keywords : JSON.stringify(search_keywords || []),
        exclude_keywords: typeof exclude_keywords === 'string' ? exclude_keywords : JSON.stringify(exclude_keywords || []),
        search_time_mode: search_time_mode || 'absolute',
        search_date_from: search_date_from || null,
        search_date_to: search_date_to || null,
        search_recent_hours: search_recent_hours || null,
        search_wxids: typeof search_wxids === 'string' ? search_wxids : JSON.stringify(search_wxids || []),
        search_tag_ids: typeof search_tag_ids === 'string' ? search_tag_ids : JSON.stringify(search_tag_ids || []),
        auto_save: auto_save !== undefined ? parseInt(auto_save) : 1,
        sync_before_search: sync_before_search !== undefined ? parseInt(sync_before_search) : 1,
        is_active: is_active !== undefined ? parseInt(is_active) : 1,
      };

      let taskId;

      if (id) {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(data), id];
        await query(`UPDATE wechat_robot_expat_scheduled_tasks SET ${fields}, updated_at = NOW() WHERE id = ?`, values);
        taskId = id;
      } else {
        const fields = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const result = await query(
          `INSERT INTO wechat_robot_expat_scheduled_tasks (${fields}, created_at, updated_at) VALUES (${placeholders}, NOW(), NOW())`,
          Object.values(data)
        );
        taskId = result.insertId;
      }

      if (run_immediately && taskId) {
        await query(
          `UPDATE wechat_robot_expat_scheduled_tasks SET force_next_run = 1 WHERE id = ?`,
          [taskId]
        );
      }

      res.json({ success: true, message: id ? '更新成功' : '创建成功', data: { id: taskId } });
    } catch (err) {
      console.error('[ScheduledTask] 保存任务失败:', err);
      res.status(500).json({ success: false, message: '保存任务失败: ' + err.message });
    }
  }

  /**
   * 切换任务启用/暂停
   * POST /admin/scheduled-tasks/:id/toggle
   */
  static async toggleTask(req, res) {
    try {
      const { id } = req.params;
      const rows = await query('SELECT is_active FROM wechat_robot_expat_scheduled_tasks WHERE id = ?', [id]);
      if (!rows.length) {
        return res.status(404).json({ success: false, message: '任务不存在' });
      }
      const newStatus = rows[0].is_active ? 0 : 1;
      await query('UPDATE wechat_robot_expat_scheduled_tasks SET is_active = ?, updated_at = NOW() WHERE id = ?', [newStatus, id]);
      res.json({ success: true, message: newStatus ? '已启用' : '已暂停' });
    } catch (err) {
      console.error('[ScheduledTask] 切换任务状态失败:', err);
      res.status(500).json({ success: false, message: '操作失败' });
    }
  }

  /**
   * 手动执行任务
   * POST /admin/scheduled-tasks/:id/run
   */
  static async runTask(req, res) {
    try {
      const { id } = req.params;
      const rows = await query('SELECT * FROM wechat_robot_expat_scheduled_tasks WHERE id = ?', [id]);
      if (!rows.length) {
        return res.status(404).json({ success: false, message: '任务不存在' });
      }
      await query('UPDATE wechat_robot_expat_scheduled_tasks SET force_next_run = 1, updated_at = NOW() WHERE id = ?', [id]);
      res.json({ success: true, message: '任务已标记为待执行' });
    } catch (err) {
      console.error('[ScheduledTask] 触发执行失败:', err);
      res.status(500).json({ success: false, message: '执行失败' });
    }
  }

  /**
   * 删除任务
   * DELETE /admin/scheduled-tasks/:id
   */
  static async deleteTask(req, res) {
    try {
      const { id } = req.params;
      await query('DELETE FROM wechat_robot_expat_scheduled_tasks WHERE id = ?', [id]);
      res.json({ success: true, message: '删除成功' });
    } catch (err) {
      console.error('[ScheduledTask] 删除任务失败:', err);
      res.status(500).json({ success: false, message: '删除失败' });
    }
  }

  /**
   * 获取任务执行日志
   * GET /admin/scheduled-tasks/:id/logs
   */
  static async getTaskLogs(req, res) {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const tableCheck = await query("SHOW TABLES LIKE 'wechat_robot_expat_task_logs'");
      if (!tableCheck.length) {
        return res.json({
          success: true, data: { logs: [], total: 0, pages: 0, stats: null }
        });
      }

      const [countResult] = await query(
        'SELECT COUNT(*) as total FROM wechat_robot_expat_task_logs WHERE task_id = ?', [id]
      );
      const total = countResult.total;
      const pages = Math.ceil(total / limit);

      const logs = await query(
        `SELECT id, execution_status as status, start_time as executed_at, end_time, 
                duration_seconds as duration, total_found as searched_count, 
                saved_count, media_saved_count, skipped_count, 
                error_message, trigger_type, execution_details, created_at
         FROM wechat_robot_expat_task_logs 
         WHERE task_id = ?
         ORDER BY start_time DESC
         LIMIT ? OFFSET ?`,
        [id, limit, offset]
      );

      const [statsResult] = await query(
        `SELECT COUNT(*) as total_runs,
                SUM(CASE WHEN execution_status = 'success' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN execution_status = 'failed' THEN 1 ELSE 0 END) as fail_count
         FROM wechat_robot_expat_task_logs WHERE task_id = ?`,
        [id]
      );

      res.json({
        success: true,
        data: {
          logs: logs.map(log => ({
            ...log,
            execution_details: ScheduledTaskController._parseJSON(log.execution_details, null)
          })),
          total,
          pages,
          stats: {
            total_runs: statsResult.total_runs || 0,
            success_count: parseInt(statsResult.success_count) || 0,
            fail_count: parseInt(statsResult.fail_count) || 0,
          }
        }
      });
    } catch (err) {
      console.error('[ScheduledTask] 获取执行日志失败:', err);
      res.status(500).json({ success: false, message: '获取日志失败' });
    }
  }

  /**
   * 获取正在执行的任务
   * GET /admin/scheduled-tasks/running
   */
  static async getRunningTasks(req, res) {
    try {
      const tableCheck = await query("SHOW TABLES LIKE 'wechat_robot_expat_task_logs'");
      if (!tableCheck.length) {
        return res.json({ success: true, data: [] });
      }

      const running = await query(
        `SELECT l.id as log_id, l.task_id, l.start_time, 
                l.total_found, l.saved_count, l.media_saved_count, l.skipped_count,
                t.task_name, t.is_active,
                TIMESTAMPDIFF(SECOND, l.start_time, NOW()) as duration_seconds
         FROM wechat_robot_expat_task_logs l
         LEFT JOIN wechat_robot_expat_scheduled_tasks t ON l.task_id = t.id
         WHERE l.execution_status = 'running'
         ORDER BY l.start_time DESC`
      );

      const data = running.map(r => ({
        ...r,
        duration_text: ScheduledTaskController._formatDuration(r.duration_seconds)
      }));

      res.json({ success: true, data });
    } catch (err) {
      console.error('[ScheduledTask] 获取运行中任务失败:', err);
      res.status(500).json({ success: false, message: '获取失败' });
    }
  }

  /**
   * 停止单个任务
   * POST /admin/scheduled-tasks/:id/stop
   */
  static async stopTask(req, res) {
    try {
      const { id } = req.params;
      const { log_id } = req.body;

      const tableCheck = await query("SHOW TABLES LIKE 'wechat_robot_expat_task_logs'");
      if (!tableCheck.length) {
        return res.json({ success: false, message: '日志表不存在' });
      }

      await query(
        `UPDATE wechat_robot_expat_task_logs 
         SET execution_status = 'cancelled', end_time = NOW(),
             duration_seconds = TIMESTAMPDIFF(SECOND, start_time, NOW()),
             error_message = '管理员手动停止'
         WHERE task_id = ? AND execution_status = 'running'`,
        [id]
      );

      await query(
        `UPDATE wechat_robot_expat_scheduled_tasks 
         SET last_execution_status = 'cancelled', updated_at = NOW() WHERE id = ?`,
        [id]
      );

      res.json({ success: true, message: '任务已停止' });
    } catch (err) {
      console.error('[ScheduledTask] 停止任务失败:', err);
      res.status(500).json({ success: false, message: '停止失败' });
    }
  }

  /**
   * 停止所有正在执行的任务
   * POST /admin/scheduled-tasks/stop-all
   */
  static async stopAllTasks(req, res) {
    try {
      const tableCheck = await query("SHOW TABLES LIKE 'wechat_robot_expat_task_logs'");
      if (!tableCheck.length) {
        return res.json({ success: true, message: '无运行中的任务' });
      }

      const runningLogs = await query(
        "SELECT id, task_id FROM wechat_robot_expat_task_logs WHERE execution_status = 'running'"
      );

      for (const log of runningLogs) {
        await query(
          `UPDATE wechat_robot_expat_task_logs 
           SET execution_status = 'cancelled', end_time = NOW(),
               duration_seconds = TIMESTAMPDIFF(SECOND, start_time, NOW()),
               error_message = '管理员批量停止'
           WHERE id = ?`,
          [log.id]
        );
        await query(
          `UPDATE wechat_robot_expat_scheduled_tasks 
           SET last_execution_status = 'cancelled', updated_at = NOW() WHERE id = ?`,
          [log.task_id]
        );
      }

      res.json({ success: true, message: `已停止 ${runningLogs.length} 个任务` });
    } catch (err) {
      console.error('[ScheduledTask] 停止所有任务失败:', err);
      res.status(500).json({ success: false, message: '操作失败' });
    }
  }

  /**
   * 获取微信机器人账号列表（供前端选择）
   * GET /admin/scheduled-tasks/robots
   */
  static async getRobots(req, res) {
    try {
      const robots = await query(
        'SELECT id, wxid, nickname, avatar, status FROM wechat_robot_accounts ORDER BY id DESC'
      );
      res.json({ success: true, data: robots });
    } catch (err) {
      console.error('[ScheduledTask] 获取机器人列表失败:', err);
      res.status(500).json({ success: false, message: '获取失败' });
    }
  }

  /**
   * 获取指定机器人的好友列表
   * GET /admin/scheduled-tasks/friends/:robotId
   * 自动补全缺失昵称：检测到无昵称的联系人时，通过微信API批量获取并更新数据库
   */
  static async getFriends(req, res) {
    try {
      const { robotId } = req.params;

      // 先尝试自动补全缺失昵称
      await ScheduledTaskController._fillMissingNicknames(robotId);

      const friends = await query(
        `SELECT wxid, nickname, remark, avatar 
         FROM wechat_robot_contacts 
         WHERE robot_id = ? AND contact_type = 'friend' 
         ORDER BY CASE WHEN (nickname IS NULL OR nickname = '') AND (remark IS NULL OR remark = '') THEN 1 ELSE 0 END ASC,
                  COALESCE(remark, nickname, wxid) ASC`,
        [robotId]
      );
      res.json({ success: true, data: { list: friends, total: friends.length } });
    } catch (err) {
      console.error('[ScheduledTask] 获取好友列表失败:', err);
      res.status(500).json({ success: false, message: '获取好友失败' });
    }
  }

  /**
   * 自动补全缺失昵称
   * 查找 nickname 为 NULL 的好友，通过微信API批量获取昵称并更新数据库
   */
  static async _fillMissingNicknames(robotId) {
    try {
      const missing = await query(
        `SELECT wxid FROM wechat_robot_contacts 
         WHERE robot_id = ? AND contact_type = 'friend' 
           AND (nickname IS NULL OR nickname = '')
         LIMIT 500`,
        [robotId]
      );
      if (!missing.length) return;

      const accounts = await query(
        'SELECT id, wxid, device_id, user_id FROM wechat_robot_accounts WHERE id = ? LIMIT 1',
        [robotId]
      );
      if (!accounts.length || !accounts[0].device_id) return;

      const account = accounts[0];
      const userId = account.user_id || 0;

      let config = await query(
        'SELECT api_url, token FROM wechat_robot_api_config WHERE user_id = ? AND api_url IS NOT NULL AND api_url != "" LIMIT 1',
        [userId]
      );
      if (!config.length || !config[0].api_url) {
        config = await query(
          'SELECT api_url, token FROM wechat_robot_api_config WHERE user_id = 0 AND api_url IS NOT NULL AND api_url != "" LIMIT 1'
        );
      }
      if (!config.length || !config[0].api_url) return;

      const { api_url, token } = config[0];
      const deviceId = account.device_id;
      const wxids = missing.map(m => m.wxid);
      const batchSize = 100;

      for (let i = 0; i < wxids.length; i += batchSize) {
        const batch = wxids.slice(i, i + batchSize);
        try {
          const details = await WeChatRobotService.getContactBriefInfo(api_url, token, deviceId, batch);
          if (details && details.length > 0) {
            for (const d of details) {
              const wxid = d.userName || d.wxid;
              const nickname = d.nickName || d.nickname || null;
              const avatar = d.bigHeadImgUrl || d.smallHeadImgUrl || d.headImgUrl || null;
              const remark = d.remark || null;
              if (wxid && (nickname || avatar || remark)) {
                await query(
                  `UPDATE wechat_robot_contacts 
                   SET nickname = COALESCE(?, nickname), 
                       avatar = COALESCE(?, avatar), 
                       remark = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE remark END,
                       updated_at = NOW()
                   WHERE robot_id = ? AND wxid = ?`,
                  [nickname, avatar, remark, remark, remark, robotId, wxid]
                );
              }
            }
          }
        } catch (batchErr) {
          console.error(`[ScheduledTask] 批量获取昵称失败 (batch ${i}):`, batchErr?.message);
        }
      }
    } catch (err) {
      console.error('[ScheduledTask] 自动补全昵称失败:', err?.message);
    }
  }

  /**
   * 获取联系人标签
   * GET /admin/scheduled-tasks/tags/:robotId
   */
  static async getTags(req, res) {
    try {
      const { robotId } = req.params;
      const tags = await query(
        `SELECT t.id, t.name, t.color, t.contact_count
         FROM wechat_robot_contact_tags t
         ORDER BY t.name ASC`
      );
      res.json({ success: true, data: tags });
    } catch (err) {
      console.error('[ScheduledTask] 获取标签失败:', err);
      res.json({ success: true, data: [] });
    }
  }

  // ========== 工具方法 ==========

  static _parseJSON(str, defaultVal) {
    if (!str) return defaultVal;
    if (typeof str !== 'string') return str;
    try {
      return JSON.parse(str);
    } catch {
      return defaultVal;
    }
  }

  static _formatDuration(seconds) {
    if (!seconds || seconds < 0) return '-';
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    return `${Math.floor(seconds / 3600)}时${Math.floor((seconds % 3600) / 60)}分`;
  }
}

module.exports = ScheduledTaskController;
