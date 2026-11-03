/**
 * 用户收藏控制器
 * 收藏列表、添加收藏、取消收藏、检查收藏状态
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error, paginated } = require('../../utils/response');

class FavoriteController {
  /**
   * 获取用户收藏的房源列表（分页）
   */
  async getFavorites(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20 } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

      const countSql = 'SELECT COUNT(*) as total FROM user_favorites WHERE user_id = ?';
      const countRows = await query(countSql, [userId]).catch(() => [{ total: 0 }]);
      const countArr = Array.isArray(countRows) && Array.isArray(countRows[0]) ? countRows[0] : countRows;
      const total = countArr?.[0]?.total || 0;

      const dataSql = `
        SELECT f.id as favorite_id, f.created_at as favorited_at,
               p.id as property_id, p.community as title, p.price, p.district,
               p.bedrooms, p.bathrooms, p.area_sqm as area, p.media_urls, p.local_images,
               p.metro_lines, p.metro_stations, p.has_commission, p.publisher_name as publisher
        FROM user_favorites f
        JOIN wechat_robot_expat_parsed_properties p ON f.property_id = p.id
        WHERE f.user_id = ? AND p.deleted_at IS NULL
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const favorites = await query(dataSql, [userId, parseInt(pageSize, 10), offset]).catch(e => {
        logger.error('收藏列表查询失败', { error: e.message });
        return [];
      });
      const favArr = Array.isArray(favorites) && Array.isArray(favorites[0]) ? favorites[0] : favorites;

      return paginated(res, favArr || [], total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      logger.error('获取收藏列表失败', { error: err.message, userId: req.user?.id });
      return error(res, '获取收藏列表失败', 500);
    }
  }

  /**
   * 添加收藏
   */
  async addFavorite(req, res) {
    try {
      const userId = req.user.id;
      const { property_id } = req.body;

      if (!property_id) {
        return error(res, '房源ID不能为空', 400);
      }

      const propRows = await query(
        'SELECT id FROM wechat_robot_expat_parsed_properties WHERE id = ? AND deleted_at IS NULL LIMIT 1',
        [property_id]
      ).catch(() => []);
      const propArr = Array.isArray(propRows) && Array.isArray(propRows[0]) ? propRows[0] : propRows;

      if (!propArr || !propArr[0]) {
        return error(res, '房源不存在', 404);
      }

      const existRows = await query(
        'SELECT id FROM user_favorites WHERE user_id = ? AND property_id = ? LIMIT 1',
        [userId, property_id]
      ).catch(() => []);
      const existArr = Array.isArray(existRows) && Array.isArray(existRows[0]) ? existRows[0] : existRows;

      if (existArr && existArr[0]) {
        return error(res, '已收藏该房源', 400);
      }

      await query(
        'INSERT INTO user_favorites (user_id, property_id, created_at) VALUES (?, ?, NOW())',
        [userId, property_id]
      );

      return success(res, null, '收藏成功');
    } catch (err) {
      logger.error('添加收藏失败', { error: err.message, userId: req.user?.id });
      return error(res, '添加收藏失败', 500);
    }
  }

  /**
   * 取消收藏
   */
  async removeFavorite(req, res) {
    try {
      const userId = req.user.id;
      const property_id = req.params.id || req.params.property_id;

      if (!property_id) {
        return error(res, '房源ID不能为空', 400);
      }

      const result = await query(
        'DELETE FROM user_favorites WHERE user_id = ? AND property_id = ?',
        [userId, property_id]
      );

      const affected = result?.affectedRows || result?.[0]?.affectedRows || 0;
      if (affected === 0) {
        return error(res, '未收藏该房源', 404);
      }

      return success(res, null, '已取消收藏');
    } catch (err) {
      logger.error('取消收藏失败', { error: err.message, userId: req.user?.id });
      return error(res, '取消收藏失败', 500);
    }
  }

  /**
   * 检查是否已收藏
   */
  async checkFavorite(req, res) {
    try {
      const userId = req.user.id;
      const { property_id } = req.query;
      if (!property_id) return success(res, { is_favorited: false });

      const rows = await query(
        'SELECT id FROM user_favorites WHERE user_id = ? AND property_id = ? LIMIT 1',
        [userId, property_id]
      ).catch(() => []);
      const arr = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;

      return success(res, { is_favorited: !!(arr && arr[0]) });
    } catch (err) {
      return success(res, { is_favorited: false });
    }
  }
}

module.exports = new FavoriteController();
