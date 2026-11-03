/**
 * 经纪人仪表盘控制器
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');

class AgentDashboardController {
  async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      const [propertiesCount] = await query('SELECT COUNT(*) as total FROM properties WHERE user_id = ?', [userId]);
      const [clientsCount] = await query('SELECT COUNT(*) as total FROM clients WHERE agent_id = ?', [userId]).catch(() => [{ total: 0 }]);
      const [appointmentsCount] = await query(
        "SELECT COUNT(*) as total FROM appointments WHERE agent_id = ? AND status = 'pending'",
        [userId]
      ).catch(() => [{ total: 0 }]);
      return success(res, {
        stats: {
          totalProperties: propertiesCount?.total || 0,
          totalClients: clientsCount?.total || 0,
          pendingAppointments: appointmentsCount?.total || 0,
        },
      });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getStats(req, res) {
    try {
      const userId = req.user.id;
      const [propertiesCount] = await query('SELECT COUNT(*) as total FROM properties WHERE user_id = ?', [userId]);
      const [clientsCount] = await query('SELECT COUNT(*) as total FROM clients WHERE agent_id = ?', [userId]).catch(() => [{ total: 0 }]);
      return success(res, {
        totalProperties: propertiesCount?.total || 0,
        totalClients: clientsCount?.total || 0,
      });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new AgentDashboardController();
