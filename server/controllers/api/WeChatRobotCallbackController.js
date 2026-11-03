/**
 * 微信机器人回调控制器
 * 处理来自weiti API的各类事件回调
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class WeChatRobotCallbackController {
  /**
   * POST 回调处理 - 接收各类微信机器人事件
   * 事件类型: text_message, image_message, friend_request, group_invite, moment_update, login_status 等
   */
  async handleCallback(req, res) {
    try {
      const data = req.body;
      const eventType = data.TypeName || data.type || data.event || 'unknown';

      const robotWxid = data.Wxid || data.robot_id || data.robotWxid || '';
      const msgData = data.Data || {};
      const fromWxid = (msgData.FromUserName?.string) || data.from || data.fromWxid || '';
      const toWxid = (msgData.ToUserName?.string) || data.to || data.toWxid || '';
      const contentStr = (msgData.Content?.string) || data.content || data.text || '';

      logger.info('收到微信机器人回调', {
        type: eventType,
        robot_id: robotWxid,
        from: fromWxid,
      });

      const robotIdForDb = await this._resolveRobotId(robotWxid);

      await query(
        'INSERT INTO wechat_robot_messages (robot_id, from_wxid, to_wxid, content, raw_content, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [
          robotIdForDb,
          fromWxid,
          toWxid,
          contentStr.substring(0, 10000),
          JSON.stringify(data),
        ]
      ).catch(err => logger.error('记录机器人消息失败', { error: err.message }));

      if (['AddMsg', 'text_message', 'message'].includes(eventType) && contentStr) {
        await this._checkAutoReply({ ...data, content: contentStr, robot_id: robotIdForDb }).catch(err =>
          logger.error('自动回复检查失败', { error: err.message })
        );
      }

      return res.json({ success: true });
    } catch (err) {
      logger.error('微信机器人回调处理异常', { error: err.message });
      return res.json({ success: true });
    }
  }

  async _resolveRobotId(wxid) {
    if (!wxid) return 0;
    try {
      const [row] = await query(
        'SELECT id FROM wechat_robot_accounts WHERE wxid = ? LIMIT 1',
        [wxid]
      );
      return row?.id || 0;
    } catch {
      return 0;
    }
  }

  /**
   * GET 验证端点
   */
  async handleGet(req, res) {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  /**
   * 检查并执行自动回复规则
   */
  async _checkAutoReply(data) {
    const content = data.content || data.text || '';
    if (!content) return;

    const rules = await query(
      "SELECT * FROM wechat_robot_auto_replies WHERE status = 'active' ORDER BY priority DESC"
    ).catch(() => []);

    for (const rule of rules) {
      let matched = false;
      const keyword = rule.keyword || '';

      if (rule.match_type === 'exact' && content === keyword) {
        matched = true;
      } else if (rule.match_type === 'contains' && content.includes(keyword)) {
        matched = true;
      } else if (rule.match_type === 'regex') {
        try {
          matched = new RegExp(keyword).test(content);
        } catch { /* invalid regex */ }
      }

      if (matched) {
        logger.info('触发自动回复规则', { rule_id: rule.id, keyword });
        break;
      }
    }
  }
}

module.exports = new WeChatRobotCallbackController();
