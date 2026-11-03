/**
 * 房东仪表盘控制器
 * properties 表列：user_id, status 等
 * contact_agent_records 表列：property_id（关联房源）
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');

class LandlordDashboardController {
  async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      const [propertiesCount] = await query('SELECT COUNT(*) as total FROM properties WHERE user_id = ?', [userId]);
      const [publishedCount] = await query(
        "SELECT COUNT(*) as total FROM properties WHERE user_id = ? AND status = 'published'",
        [userId]
      );
      const [inquiriesCount] = await query(
        'SELECT COUNT(*) as total FROM contact_agent_records i INNER JOIN properties p ON i.property_id = p.id WHERE p.user_id = ?',
        [userId]
      ).catch(() => [{ total: 0 }]);
      return success(res, {
        stats: {
          totalProperties: propertiesCount?.total || 0,
          publishedProperties: publishedCount?.total || 0,
          totalInquiries: inquiriesCount?.total || 0,
        },
      });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new LandlordDashboardController();
