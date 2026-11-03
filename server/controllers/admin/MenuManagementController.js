/**
 * 前端菜单管理控制器
 * 管理前端导航菜单及菜单项
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

function isBlockedExpatLabel(value) {
  if (!value) return false;
  const normalized = String(value).toLowerCase();
  return normalized.includes('涉外租赁管理') || normalized.includes('expatshome');
}

class MenuManagementController {
  /**
   * 获取所有菜单（含菜单项）
   * GET /admin/menus
   */
  async getMenus(req, res) {
    try {
      const menus = await query('SELECT * FROM frontend_menus ORDER BY id');
      for (const menu of menus) {
        menu.items = await query(
          'SELECT * FROM frontend_menu_items WHERE menu_id = ? ORDER BY sort_order, id',
          [menu.id]
        ).catch(() => []);
        menu.items = (menu.items || []).filter((item) => !isBlockedExpatLabel(item.title) && !isBlockedExpatLabel(item.url));
      }
      const filteredMenus = (menus || []).filter((menu) => !isBlockedExpatLabel(menu.name));
      return success(res, filteredMenus);
    } catch (err) {
      logger.error('获取菜单列表失败', { error: err.message });
      return error(res, '获取菜单失败', 500);
    }
  }

  /**
   * 创建/更新菜单
   * POST /admin/menus  body: { id?, name, position, status, sort_order }
   */
  async saveMenu(req, res) {
    try {
      const { id, name, position, status, sort_order } = req.body;

      if (!name) {
        return error(res, '菜单名称不能为空', 400);
      }
      if (isBlockedExpatLabel(name)) {
        return error(res, '涉外租赁管理菜单模型已移除，禁止创建或保存', 400);
      }

      if (id) {
        await query(
          'UPDATE frontend_menus SET name = ?, location = ?, status = ?, updated_at = NOW() WHERE id = ?',
          [name, position || 'header', status || 'active', id]
        );
        return success(res, { id }, '菜单更新成功');
      }

      const result = await query(
        'INSERT INTO frontend_menus (name, location, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [name, position || 'header', status || 'active']
      );
      return success(res, { id: result.insertId }, '菜单创建成功');
    } catch (err) {
      logger.error('保存菜单失败', { error: err.message });
      return error(res, '保存菜单失败', 500);
    }
  }

  /**
   * 删除菜单
   * DELETE /admin/menus/:id
   */
  async deleteMenu(req, res) {
    try {
      const { id } = req.params;
      await query('DELETE FROM frontend_menu_items WHERE menu_id = ?', [id]);
      await query('DELETE FROM frontend_menus WHERE id = ?', [id]);
      return success(res, null, '菜单删除成功');
    } catch (err) {
      logger.error('删除菜单失败', { error: err.message });
      return error(res, '删除菜单失败', 500);
    }
  }

  /**
   * 获取菜单项
   * GET /admin/menus/:menuId/items
   */
  async getMenuItems(req, res) {
    try {
      const { menuId } = req.params;
      const items = await query(
        'SELECT * FROM frontend_menu_items WHERE menu_id = ? ORDER BY sort_order, id',
        [menuId]
      );
      return success(res, items);
    } catch (err) {
      logger.error('获取菜单项失败', { error: err.message });
      return error(res, '获取菜单项失败', 500);
    }
  }

  /**
   * 创建/更新菜单项
   * POST /admin/menus/:menuId/items  body: { id?, title, url, target, icon, parent_id, sort_order }
   */
  async saveMenuItem(req, res) {
    try {
      const { menuId } = req.params;
      const { id, title, url, target, icon, parent_id, sort_order, status } = req.body;

      if (!title) {
        return error(res, '菜单项标题不能为空', 400);
      }
      if (isBlockedExpatLabel(title) || isBlockedExpatLabel(url)) {
        return error(res, '涉外租赁管理菜单模型已移除，禁止创建或保存', 400);
      }

      if (id) {
        await query(
          'UPDATE frontend_menu_items SET title = ?, url = ?, target = ?, icon = ?, parent_id = ?, sort_order = ?, status = ?, updated_at = NOW() WHERE id = ? AND menu_id = ?',
          [title, url || '#', target || '_self', icon || '', parent_id || 0, sort_order || 0, status !== undefined ? status : 1, id, menuId]
        );
        return success(res, { id }, '菜单项更新成功');
      }

      const result = await query(
        'INSERT INTO frontend_menu_items (menu_id, title, url, target, icon, parent_id, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [menuId, title, url || '#', target || '_self', icon || '', parent_id || 0, sort_order || 0, status !== undefined ? status : 1]
      );
      return success(res, { id: result.insertId }, '菜单项创建成功');
    } catch (err) {
      logger.error('保存菜单项失败', { error: err.message });
      return error(res, '保存菜单项失败', 500);
    }
  }

  /**
   * 删除菜单项
   * DELETE /admin/menu-items/:id
   */
  async deleteMenuItem(req, res) {
    try {
      const { id } = req.params;
      await query('DELETE FROM frontend_menu_items WHERE parent_id = ?', [id]);
      await query('DELETE FROM frontend_menu_items WHERE id = ?', [id]);
      return success(res, null, '菜单项删除成功');
    } catch (err) {
      logger.error('删除菜单项失败', { error: err.message });
      return error(res, '删除菜单项失败', 500);
    }
  }
}

module.exports = new MenuManagementController();
