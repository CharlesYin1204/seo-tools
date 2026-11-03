/**
 * 定时发送任务模型
 * 对应数据库 wechat_robot_scheduled_tasks 表
 */
const BaseModel = require('./BaseModel');

class WeChatRobotScheduledTask extends BaseModel {
  constructor() {
    super('wechat_robot_scheduled_tasks');
  }

  async findByRobotId(robotId, options = {}) {
    const { page = 1, pageSize = 20, status = '' } = options;
    let sql = `SELECT * FROM ${this.tableName} WHERE robot_id = ?`;
    const params = [robotId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await this.raw(countSql, params);
    const total = countResult ? countResult.total : 0;

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    const data = await this.raw(sql, params);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getTaskLogs(taskId, limit = 50) {
    const sql = `SELECT * FROM wechat_robot_scheduled_task_logs WHERE task_id = ? ORDER BY created_at DESC LIMIT ?`;
    return this.raw(sql, [taskId, limit]);
  }

  async getPendingTasks() {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sql = `SELECT t.*, a.api_url, a.token, a.wxid as robot_wxid
                 FROM ${this.tableName} t
                 JOIN wechat_robot_accounts a ON t.robot_id = a.id
                 WHERE t.status = 'active' AND t.next_run_at <= ? AND a.status = 'online'
                 ORDER BY t.next_run_at ASC`;
    return this.raw(sql, [now]);
  }
}

module.exports = new WeChatRobotScheduledTask();
