/**
 * 用户中心仪表盘控制器 - 与PHP版Dashboard统计数据保持一致
 */
const User = require('../../models/User');
const WeChatRobotAccount = require('../../models/WeChatRobotAccount');
const ParsedProperty = require('../../models/ParsedProperty');
const { query } = require('../../config/database');
const { success, error } = require('../../utils/response');

class UserDashboardController {
  async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      let user = null;
      try { user = await User.getPublicProfile(userId); } catch { user = req.user; }
      
      let accounts = [];
      try { accounts = await WeChatRobotAccount.findByUserId(userId); } catch { accounts = []; }
      
      let propertyStats = {};
      try { propertyStats = await ParsedProperty.getStatsByUserId(userId) || {}; } catch { propertyStats = {}; }

      let membershipResult = null;
      try {
        const memberRows = await query(
          `SELECT um.*, mp.name as package_name, mp.features 
           FROM user_memberships um 
           LEFT JOIN membership_packages mp ON um.package_id = mp.id 
           WHERE um.user_id = ? AND um.status = 'active' AND um.end_date >= NOW() 
           ORDER BY um.end_date DESC LIMIT 1`,
          [userId]
        );
        const memberArr = Array.isArray(memberRows) && Array.isArray(memberRows[0]) ? memberRows[0] : memberRows;
        membershipResult = memberArr && memberArr[0] ? memberArr[0] : null;
      } catch { /* ignore */ }

      let totalPoints = 0;
      let totalBalance = 0;
      try {
        const pointsRows = await query('SELECT COALESCE(SUM(total_points), 0) as total FROM user_points WHERE user_id = ?', [userId]);
        const pointsArr = Array.isArray(pointsRows) && Array.isArray(pointsRows[0]) ? pointsRows[0] : pointsRows;
        totalPoints = pointsArr && pointsArr[0] ? pointsArr[0].total : 0;
      } catch { /* ignore */ }
      try {
        const balanceRows = await query('SELECT COALESCE(balance, 0) as balance FROM users WHERE id = ?', [userId]);
        const balanceArr = Array.isArray(balanceRows) && Array.isArray(balanceRows[0]) ? balanceRows[0] : balanceRows;
        totalBalance = balanceArr && balanceArr[0] ? balanceArr[0].balance : 0;
      } catch { /* ignore */ }

      let orderStats = { pending: 0, confirmed: 0, completed: 0, after_service: 0 };
      try {
        const orderRows = await query(
          `SELECT status, COUNT(*) as cnt FROM orders WHERE user_id = ? GROUP BY status`,
          [userId]
        );
        const orderArr = Array.isArray(orderRows) && Array.isArray(orderRows[0]) ? orderRows[0] : orderRows;
        if (Array.isArray(orderArr)) {
          orderArr.forEach(r => {
            if (r.status === 'pending') orderStats.pending = r.cnt;
            else if (r.status === 'paid' || r.status === 'confirmed') orderStats.confirmed = r.cnt;
            else if (r.status === 'completed') orderStats.completed = r.cnt;
            else if (r.status === 'refunded' || r.status === 'after_service') orderStats.after_service = r.cnt;
          });
        }
      } catch { /* ignore */ }

      let activeTasks = 0;
      try {
        const taskRows = await query(
          'SELECT COUNT(*) as cnt FROM wechat_robot_scheduled_tasks WHERE user_id = ? AND status = ?',
          [userId, 'active']
        );
        const taskArr = Array.isArray(taskRows) && Array.isArray(taskRows[0]) ? taskRows[0] : taskRows;
        activeTasks = taskArr && taskArr[0] ? taskArr[0].cnt : 0;
      } catch { /* ignore */ }

      let allProperties = 0;
      try {
        const allRows = await query('SELECT COUNT(*) as cnt FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL');
        const allArr = Array.isArray(allRows) && Array.isArray(allRows[0]) ? allRows[0] : allRows;
        allProperties = allArr && allArr[0] ? allArr[0].cnt : 0;
      } catch { /* ignore */ }
      const totalProperties = propertyStats?.total || 0;
      const selectedProperties = propertyStats?.selected || propertyStats?.selected_properties || 0;

      let totalFavorites = 0;
      try {
        const favRows = await query('SELECT COUNT(*) as cnt FROM user_favorites WHERE user_id = ?', [userId]);
        const favArr = Array.isArray(favRows) && Array.isArray(favRows[0]) ? favRows[0] : favRows;
        totalFavorites = favArr && favArr[0] ? favArr[0].cnt : 0;
      } catch { /* ignore */ }

      let activeModules = [];
      try {
        const modRows = await query(
          `SELECT s.module_id, m.name, m.slug, MAX(s.end_date) as end_date
           FROM user_feature_subscriptions s
           LEFT JOIN feature_modules m ON s.module_id = m.id
           WHERE s.user_id = ? AND s.status = 'active' AND s.end_date >= NOW()
           GROUP BY s.module_id, m.name, m.slug
           ORDER BY s.module_id ASC`,
          [userId]
        );
        const modArr = Array.isArray(modRows) && Array.isArray(modRows[0]) ? modRows[0] : modRows;
        if (Array.isArray(modArr)) {
          modArr.forEach(r => {
            activeModules.push({ module_id: r.module_id, name: r.name, slug: r.slug, end_date: r.end_date });
          });
        }
      } catch { /* ignore */ }

      return success(res, {
        user,
        robot_accounts: accounts.length,
        online_robots: accounts.filter((a) => a.status === 'online').length,
        all_properties: allProperties,
        total_properties: totalProperties,
        selected_properties: selectedProperties,
        total_points: totalPoints,
        total_balance: totalBalance,
        total_favorites: totalFavorites,
        membership_name: membershipResult?.package_name || '基础版',
        active_modules: activeModules,
        pending_orders: orderStats.pending,
        confirmed_orders: orderStats.confirmed,
        completed_orders: orderStats.completed,
        after_service_orders: orderStats.after_service,
        active_tasks: activeTasks,
        accounts: {
          total: accounts.length,
          online: accounts.filter((a) => a.status === 'online').length,
          list: accounts,
        },
        properties: propertyStats,
        membership: membershipResult || null,
      });
    } catch (err) {
      return success(res, {
        user: req.user,
        robot_accounts: 0, online_robots: 0, all_properties: 0,
        total_properties: 0, selected_properties: 0, total_points: 0,
        total_balance: 0, total_favorites: 0, membership_name: '基础版', active_modules: [],
        pending_orders: 0, confirmed_orders: 0, completed_orders: 0,
        after_service_orders: 0, active_tasks: 0,
        accounts: { total: 0, online: 0, list: [] },
        properties: {}, membership: null,
      });
    }
  }
}

module.exports = new UserDashboardController();
