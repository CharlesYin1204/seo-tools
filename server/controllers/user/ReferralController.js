/**
 * 用户端推荐返利控制器
 * 推荐码、统计、被邀请用户
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');

class ReferralController {
  async getReferralCode(req, res) {
    try {
      const userId = req.user.id;
      const [row] = await query('SELECT * FROM user_referrals WHERE referrer_id = ? LIMIT 1', [userId]);
      const code = row?.referral_code || `REF${userId}${Date.now().toString(36).toUpperCase()}`;
      return success(res, { code, url: null });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getReferralStats(req, res) {
    try {
      const userId = req.user.id;
      const [invitedCount] = await query(
        'SELECT COUNT(*) as total FROM user_referrals WHERE referrer_id = ?',
        [userId]
      );
      const [rewardCount] = await query(
        'SELECT COUNT(*) as total FROM user_referrals WHERE referrer_id = ? AND status = ?',
        [userId, 'completed']
      );
      const [totalReward] = await query(
        'SELECT COALESCE(SUM(points_awarded), 0) as total FROM user_referrals WHERE referrer_id = ? AND status = ?',
        [userId, 'completed']
      );
      return success(res, {
        invitedCount: invitedCount?.total || 0,
        rewardCount: rewardCount?.total || 0,
        totalReward: totalReward?.total || 0,
      });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getInvitedUsers(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20 } = req.query;
      const countSql = 'SELECT COUNT(*) as total FROM user_referrals WHERE referrer_id = ?';
      const [countResult] = await query(countSql, [userId]);
      const total = countResult ? countResult.total : 0;
      const data = await query(
        'SELECT ur.id, ur.referee_id, ur.referral_code, ur.status, ur.points_awarded, ur.created_at, u.username, u.display_name, u.email FROM user_referrals ur LEFT JOIN users u ON ur.referee_id = u.id WHERE ur.referrer_id = ? ORDER BY ur.created_at DESC LIMIT ? OFFSET ?',
        [userId, parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10)]
      );
      return success(res, {
        data,
        pagination: {
          total,
          page: parseInt(page, 10),
          pageSize: parseInt(pageSize, 10),
          totalPages: Math.ceil(total / parseInt(pageSize, 10)),
        },
      });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new ReferralController();
