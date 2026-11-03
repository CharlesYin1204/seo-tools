/**
 * 自动回复模型
 * 对应数据库 wechat_robot_auto_replies 表
 */
const BaseModel = require('./BaseModel');

class WeChatRobotAutoReply extends BaseModel {
  constructor() {
    super('wechat_robot_auto_replies');
  }

  async findByRobotId(robotId) {
    return this.findAll({
      where: { robot_id: robotId },
      orderBy: 'priority ASC, created_at DESC',
    });
  }

  async findMatchingRule(robotId, message) {
    const rules = await this.findByRobotId(robotId);
    for (const rule of rules) {
      if (!rule.is_active) continue;
      const matched = this._matchRule(rule, message);
      if (matched) return rule;
    }
    return null;
  }

  _matchRule(rule, message) {
    const content = rule.match_content;
    switch (rule.match_type) {
      case 'exact':
        return message === content;
      case 'contains':
        return message.includes(content);
      case 'startswith':
        return message.startsWith(content);
      case 'endswith':
        return message.endsWith(content);
      case 'regex':
        try {
          return new RegExp(content).test(message);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }
}

module.exports = new WeChatRobotAutoReply();
