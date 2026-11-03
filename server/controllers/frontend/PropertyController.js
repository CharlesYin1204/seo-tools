/**
 * 前端房源控制器
 * 列表、详情、收藏、联系经纪人、API搜索
 */
const Property = require('../../models/Property');
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class PropertyController {
  async index(req, res) {
    try {
      const { page = 1, pageSize = 20, district, priceMin, priceMax, bedrooms, search, sort } = req.query;
      const result = await Property.findListed({
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        district: district || '',
        priceMin: parseInt(priceMin, 10) || 0,
        priceMax: parseInt(priceMax, 10) || 0,
        bedrooms: parseInt(bedrooms, 10) || 0,
        search: search || '',
      });
      return paginated(res, result.data, result.total, result.page, result.pageSize);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async detail(req, res) {
    try {
      const property = await Property.findById(req.params.id);
      if (!property) {
        return error(res, '房源不存在', 404);
      }
      if (parseInt(property.is_listed, 10) !== 1 || property.deleted_at) {
        return error(res, '房源不可访问', 403);
      }
      if (property.status !== 'published') {
        return error(res, '房源不可访问', 403);
      }
      return success(res, property);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async favorite(req, res) {
    try {
      const userId = req.user?.id;
      const { propertyId } = req.body;
      if (!userId) {
        return error(res, '请先登录', 401);
      }
      if (!propertyId) {
        return error(res, '缺少房源ID', 400);
      }
      await query('INSERT IGNORE INTO user_favorites (user_id, property_id, created_at) VALUES (?, ?, NOW())', [
        userId,
        propertyId,
      ]);
      return success(res, null, '收藏成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async contactAgent(req, res) {
    try {
      const { propertyId, name, phone, wechat_id, message, budget_range, rental_requirements, preferred_move_date } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        return error(res, '请先登录', 401);
      }
      if (!propertyId || !name || !phone) {
        return error(res, '请填写姓名和联系方式', 400);
      }
      const property = await Property.findById(propertyId);
      if (!property) {
        return error(res, '房源不存在', 404);
      }

      const agentId = property.user_id || property.agent_id || null;
      if (!agentId) {
        return error(res, '房源缺少中介信息', 400);
      }

      await query(
        `INSERT INTO contact_agent_records (
          user_id, agent_id, property_id, name, phone, wechat_id, requirements,
          notes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
        [
          userId,
          agentId,
          propertyId,
          name,
          phone,
          wechat_id || '',
          [rental_requirements, budget_range, preferred_move_date].filter(Boolean).join('; ') || '',
          message || '',
        ]
      );
      return success(res, null, '提交成功，经纪人将尽快联系您');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async submitPropertyInquiry(req, res) {
    try {
      const { property_id, propertyId, name, phone, wechat_id, message } = req.body;
      const finalPropertyId = property_id || propertyId;
      if (!finalPropertyId || !name || !phone) {
        return error(res, '姓名、电话和房源不能为空', 400);
      }

      const property = await Property.findById(finalPropertyId);
      if (!property) {
        return error(res, '房源不存在', 404);
      }

      const agentId = property.user_id || property.agent_id || null;
      if (!agentId) {
        return error(res, '房源缺少中介信息', 400);
      }

      const existingClient = await query(
        'SELECT id FROM clients WHERE agent_id = ? AND phone = ? LIMIT 1',
        [agentId, phone]
      ).catch(() => []);

      const requirements = `咨询房源ID: ${finalPropertyId}${message ? ` | 留言: ${message}` : ''}`;

      if (existingClient[0]) {
        await query(
          `UPDATE clients
           SET name = ?, wechat_id = COALESCE(NULLIF(?, ''), wechat_id), requirements = ?, updated_at = NOW()
           WHERE id = ?`,
          [name, wechat_id || '', requirements, existingClient[0].id]
        );
      } else {
        await query(
          `INSERT INTO clients (
            agent_id, user_id, name, phone, wechat_id, requirements, source, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'property_inquiry', 'active', NOW(), NOW())`,
          [agentId, req.user?.id || null, name, phone, wechat_id || '', requirements]
        );
      }

      return success(res, null, '咨询提交成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async apiSearch(req, res) {
    try {
      const { q, page = 1, pageSize = 20 } = req.query;
      const result = await Property.findListed({
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        search: q || '',
      });
      return paginated(res, result.data, result.total, result.page, result.pageSize);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new PropertyController();
