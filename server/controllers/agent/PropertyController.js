/**
 * 经纪人房源控制器
 */
const Property = require('../../models/Property');
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class PropertyController {
  async getProperties(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20 } = req.query;
      const result = await Property.findAll({
        where: { user_id: userId },
        orderBy: 'created_at DESC',
        limit: parseInt(pageSize, 10),
        offset: (parseInt(page, 10) - 1) * parseInt(pageSize, 10),
      });
      const [countResult] = await query('SELECT COUNT(*) as total FROM properties WHERE user_id = ?', [userId]);
      const total = countResult ? countResult.total : 0;
      return paginated(res, result, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async createProperty(req, res) {
    try {
      const userId = req.user.id;
      const data = { ...req.body, user_id: userId };
      if (!data.title) {
        return error(res, '标题不能为空', 400);
      }
      const id = await Property.create(data);
      const property = await Property.findById(id);
      return success(res, property, '创建成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async updateProperty(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const property = await Property.findById(id);
      if (!property) {
        return error(res, '房源不存在', 404);
      }
      if (property.user_id !== userId) {
        return error(res, '无权限修改', 403);
      }
      const updates = { ...req.body };
      delete updates.id;
      delete updates.user_id;
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await Property.update(id, updates);
      }
      const updated = await Property.findById(id);
      return success(res, updated, '更新成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new PropertyController();
