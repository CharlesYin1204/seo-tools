/**
 * 友情链接管理控制器
 * 管理网站友情链接的CRUD操作
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class FriendLinksController {
  /**
   * 获取友情链接列表
   * GET /admin/friend-links
   */
  async getLinks(req, res) {
    try {
      const rows = await query(
        'SELECT * FROM friend_links ORDER BY sort_order ASC, created_at DESC'
      );
      return success(res, rows);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        logger.warn('friend_links表不存在');
        return success(res, []);
      }
      logger.error('获取友情链接失败', { error: err.message });
      return error(res, '获取友情链接失败', 500);
    }
  }

  /**
   * 创建或更新友情链接
   * POST /admin/friend-links  body: { id?, name, url, logo, description, sort_order, is_active }
   */
  async saveLink(req, res) {
    try {
      const { id, name, url, logo, description, sort_order, is_active } = req.body;

      if (!name || !url) {
        return error(res, '链接名称和URL不能为空', 400);
      }

      if (id) {
        const [existing] = await query('SELECT id FROM friend_links WHERE id = ?', [id]);
        if (!existing) {
          return error(res, '友情链接不存在', 404);
        }
        await query(
          'UPDATE friend_links SET name = ?, url = ?, logo = ?, description = ?, sort_order = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
          [name, url, logo || '', description || '', sort_order || 0, is_active !== undefined ? is_active : 1, id]
        );
        const [updated] = await query('SELECT * FROM friend_links WHERE id = ?', [id]);
        return success(res, updated, '友情链接更新成功');
      }

      const result = await query(
        'INSERT INTO friend_links (name, url, logo, description, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [name, url, logo || '', description || '', sort_order || 0, is_active !== undefined ? is_active : 1]
      );
      const [created] = await query('SELECT * FROM friend_links WHERE id = ?', [result.insertId]);
      return success(res, created, '友情链接创建成功');
    } catch (err) {
      logger.error('保存友情链接失败', { error: err.message });
      return error(res, '保存友情链接失败', 500);
    }
  }

  /**
   * 删除友情链接
   * DELETE /admin/friend-links/:id
   */
  async deleteLink(req, res) {
    try {
      const { id } = req.params;
      const [existing] = await query('SELECT id FROM friend_links WHERE id = ?', [id]);
      if (!existing) {
        return error(res, '友情链接不存在', 404);
      }
      await query('DELETE FROM friend_links WHERE id = ?', [id]);
      return success(res, null, '友情链接删除成功');
    } catch (err) {
      logger.error('删除友情链接失败', { error: err.message, id: req.params.id });
      return error(res, '删除友情链接失败', 500);
    }
  }
}

module.exports = new FriendLinksController();
