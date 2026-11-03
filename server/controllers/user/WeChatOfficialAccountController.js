/**
 * 用户端微信公众号控制器
 * 账号列表、添加、删除、同步文章
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class WeChatOfficialAccountController {
  async getAccounts(req, res) {
    try {
      const userId = req.user.id;
      const rows = await query(
        'SELECT * FROM wechat_official_accounts WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      return success(res, rows);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async addAccount(req, res) {
    try {
      const userId = req.user.id;
      const { appId, appSecret, name } = req.body;
      if (!appId || !appSecret) {
        return error(res, '请填写AppID和AppSecret', 400);
      }
      const [existing] = await query('SELECT * FROM wechat_official_accounts WHERE user_id = ? AND app_id = ?', [
        userId,
        appId,
      ]);
      if (existing) {
        return error(res, '该账号已添加', 400);
      }
      await query(
        'INSERT INTO wechat_official_accounts (user_id, app_id, app_secret, account_name, created_at) VALUES (?, ?, ?, ?, NOW())',
        [userId, appId, appSecret, name || '']
      );
      const [row] = await query(
        'SELECT * FROM wechat_official_accounts WHERE user_id = ? AND app_id = ?',
        [userId, appId]
      );
      return success(res, row, '添加成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteAccount(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [existing] = await query('SELECT * FROM wechat_official_accounts WHERE id = ? AND user_id = ?', [
        id,
        userId,
      ]);
      if (!existing) {
        return error(res, '账号不存在或无权限', 404);
      }
      await query('DELETE FROM wechat_official_accounts WHERE id = ? AND user_id = ?', [id, userId]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async syncArticles(req, res) {
    try {
      const userId = req.user.id;
      const { accountId } = req.params;
      const [account] = await query('SELECT * FROM wechat_official_accounts WHERE id = ? AND user_id = ?', [
        accountId,
        userId,
      ]);
      if (!account) {
        return error(res, '账号不存在或无权限', 404);
      }
      // 同步逻辑由外部服务实现，这里仅记录同步请求或调用服务
      await query(
        'UPDATE wechat_official_accounts SET last_sync_at = NOW(), updated_at = NOW() WHERE id = ?',
        [accountId]
      );
      return success(res, { accountId, synced: true }, '同步任务已提交');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new WeChatOfficialAccountController();
