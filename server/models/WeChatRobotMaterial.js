/**
 * 素材库模型
 * 对应数据库 wechat_robot_materials 和 wechat_robot_material_categories 表
 */
const BaseModel = require('./BaseModel');

class WeChatRobotMaterial extends BaseModel {
  constructor() {
    super('wechat_robot_materials');
  }

  async findByUserId(userId, options = {}) {
    const { page = 1, pageSize = 20, type = '', categoryId = '', search = '' } = options;
    let sql = `SELECT m.*, mc.name as category_name 
               FROM ${this.tableName} m 
               LEFT JOIN wechat_robot_material_categories mc ON m.category_id = mc.id
               WHERE m.user_id = ?`;
    const params = [userId];

    if (type) {
      sql += ` AND m.type = ?`;
      params.push(type);
    }
    if (categoryId) {
      sql += ` AND m.category_id = ?`;
      params.push(categoryId);
    }
    if (search) {
      sql += ` AND (m.name LIKE ? OR m.content LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s);
    }

    const countSql = sql.replace(/SELECT m\.\*, mc\.name as category_name/, 'SELECT COUNT(*) as total');
    const [countResult] = await this.raw(countSql, params);
    const total = countResult ? countResult.total : 0;

    sql += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    const data = await this.raw(sql, params);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getCategories(userId) {
    const sql = `SELECT * FROM wechat_robot_material_categories WHERE user_id = ? ORDER BY name ASC`;
    return this.raw(sql, [userId]);
  }
}

module.exports = new WeChatRobotMaterial();
