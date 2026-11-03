/**
 * 用户关注控制器
 * 关注经纪人列表、关注、取消关注
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error, paginated } = require('../../utils/response');

class FollowController {
  /**
   * 获取关注的经纪人列表（分页）
   */
  async getFollowedAgents(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20 } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

      const countSql = 'SELECT COUNT(*) as total FROM followed_agents WHERE user_id = ?';
      const [countRow] = await query(countSql, [userId]).catch(() => [{ total: 0 }]);
      const total = countRow?.total || 0;

      const dataSql = `
        SELECT f.id as follow_id, f.created_at as followed_at,
               u.id as agent_id, u.nickname, u.avatar, u.phone, u.company,
               (SELECT COUNT(*) FROM properties WHERE user_id = u.id AND status = 'active') as property_count
        FROM followed_agents f
        JOIN users u ON f.agent_id = u.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const agents = await query(dataSql, [userId, parseInt(pageSize, 10), offset]).catch(() => []);

      return paginated(res, agents, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      logger.error('获取关注列表失败', { error: err.message, userId: req.user?.id });
      return error(res, '获取关注列表失败', 500);
    }
  }

  /**
   * 关注经纪人
   */
  async followAgent(req, res) {
    try {
      const userId = req.user.id;
      const { agent_id } = req.body;

      if (!agent_id) {
        return error(res, '经纪人ID不能为空', 400);
      }

      if (parseInt(agent_id, 10) === userId) {
        return error(res, '不能关注自己', 400);
      }

      const [agent] = await query(
        'SELECT id, nickname FROM users WHERE id = ? LIMIT 1',
        [agent_id]
      ).catch(() => [null]);

      if (!agent) {
        return error(res, '经纪人不存在', 404);
      }

      const [existing] = await query(
        'SELECT id FROM followed_agents WHERE user_id = ? AND agent_id = ? LIMIT 1',
        [userId, agent_id]
      ).catch(() => [null]);

      if (existing) {
        return error(res, '已关注该经纪人', 400);
      }

      await query(
        'INSERT INTO followed_agents (user_id, agent_id, created_at) VALUES (?, ?, NOW())',
        [userId, agent_id]
      );

      return success(res, null, '关注成功');
    } catch (err) {
      logger.error('关注经纪人失败', { error: err.message, userId: req.user?.id });
      return error(res, '关注经纪人失败', 500);
    }
  }

  /**
   * 取消关注经纪人
   */
  async unfollowAgent(req, res) {
    try {
      const userId = req.user.id;
      // 路由为 POST /unfollow-agent，agent_id 在请求体中
      const agent_id = req.body?.agent_id || req.params?.agent_id;

      if (!agent_id) {
        return error(res, '经纪人ID不能为空', 400);
      }

      const result = await query(
        'DELETE FROM followed_agents WHERE user_id = ? AND agent_id = ?',
        [userId, agent_id]
      );

      if (result.affectedRows === 0) {
        return error(res, '未关注该经纪人', 404);
      }

      return success(res, null, '已取消关注');
    } catch (err) {
      logger.error('取消关注失败', { error: err.message, userId: req.user?.id });
      return error(res, '取消关注失败', 500);
    }
  }
}

module.exports = new FollowController();
