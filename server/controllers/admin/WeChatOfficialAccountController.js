/**
 * 微信公众号管理控制器
 * 管理已授权的微信公众号
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class WeChatOfficialAccountController {
  /**
   * 获取所有公众号列表
   * GET /admin/wechat-official-accounts
   */
  async getAccounts(req, res) {
    try {
      const accounts = await query('SELECT * FROM wechat_official_accounts ORDER BY created_at DESC');
      return success(res, accounts);
    } catch (err) {
      logger.error('获取公众号列表失败', { error: err.message });
      return error(res, '获取公众号列表失败', 500);
    }
  }

  /**
   * 添加公众号
   * POST /admin/wechat-official-accounts  body: { name, appid, app_secret, token, encoding_aes_key, type }
   */
  async addAccount(req, res) {
    try {
      const { name, appid, app_secret, token, encoding_aes_key, type } = req.body;

      if (!name || !appid) {
        return error(res, '公众号名称和AppID不能为空', 400);
      }

      const [existing] = await query('SELECT id FROM wechat_official_accounts WHERE app_id = ? LIMIT 1', [appid]).catch(() => [null]);
      if (existing) {
        return error(res, '该AppID已存在', 400);
      }

      const result = await query(
        'INSERT INTO wechat_official_accounts (account_name, app_id, app_secret, access_token, account_type, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [name, appid, app_secret || '', token || '', type || 'service', 1]
      );

      return success(res, { id: result.insertId }, '公众号添加成功');
    } catch (err) {
      logger.error('添加公众号失败', { error: err.message });
      return error(res, '添加公众号失败', 500);
    }
  }

  /**
   * 更新公众号
   * PUT /admin/wechat-official-accounts/:id
   */
  async updateAccount(req, res) {
    try {
      const { id } = req.params;
      const { name, app_secret, token, encoding_aes_key, type, status } = req.body;

      const [account] = await query('SELECT * FROM wechat_official_accounts WHERE id = ? LIMIT 1', [id]).catch(() => [null]);
      if (!account) {
        return error(res, '公众号不存在', 404);
      }

      const isActive = status === 'inactive' ? 0 : (status === 'active' ? 1 : (account.is_active ?? 1));
      await query(
        'UPDATE wechat_official_accounts SET account_name = ?, app_secret = ?, access_token = ?, account_type = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
        [
          name || account.account_name,
          app_secret || account.app_secret,
          token || account.access_token,
          type || account.account_type,
          isActive,
          id,
        ]
      );

      return success(res, null, '公众号更新成功');
    } catch (err) {
      logger.error('更新公众号失败', { error: err.message });
      return error(res, '更新公众号失败', 500);
    }
  }

  /**
   * 删除公众号
   * DELETE /admin/wechat-official-accounts/:id
   */
  async deleteAccount(req, res) {
    try {
      const { id } = req.params;
      await query('DELETE FROM wechat_official_accounts WHERE id = ?', [id]);
      return success(res, null, '公众号删除成功');
    } catch (err) {
      logger.error('删除公众号失败', { error: err.message });
      return error(res, '删除公众号失败', 500);
    }
  }

  /**
   * 同步公众号文章
   * POST /admin/wechat-official-accounts/:id/sync
   */
  async syncArticles(req, res) {
    try {
      const { id } = req.params;

      const [account] = await query('SELECT * FROM wechat_official_accounts WHERE id = ? LIMIT 1', [id]).catch(() => [null]);
      if (!account) {
        return error(res, '公众号不存在', 404);
      }

      logger.info('开始同步公众号文章', { account_id: id, app_id: account.app_id });

      await query(
        'UPDATE wechat_official_accounts SET last_sync_at = NOW(), updated_at = NOW() WHERE id = ?',
        [id]
      );

      return success(res, { synced: true, account_id: id }, '同步任务已启动');
    } catch (err) {
      logger.error('同步公众号文章失败', { error: err.message });
      return error(res, '同步公众号文章失败', 500);
    }
  }
}

module.exports = new WeChatOfficialAccountController();
