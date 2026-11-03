const { query } = require('../../config/database');
const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');

async function exists(table) {
  const [row] = await query('SELECT COUNT(*) total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [table]);
  return Number(row?.total) > 0;
}
async function one(table, sql, fallback = {}) {
  try { if (!(await exists(table))) return fallback; const [row] = await query(sql); return row || fallback; }
  catch (err) { logger.warn('SEO dashboard query skipped', { table, error: err.message }); return fallback; }
}

class AdminDashboardController {
  async getDashboard(req, res) {
    try {
      const [users, organizations, revenue, ai, models, plugins, sites, scans, issues, commercial, usage, connections] = await Promise.all([
        one('users', "SELECT COUNT(*) total, SUM(DATE(created_at)=CURDATE()) today_new FROM users", { total: 0, today_new: 0 }),
        one('organizations', `SELECT COUNT(*) total,
          SUM(status='active') active, SUM(status='readonly') readonly,
          SUM(status='archived') archived FROM organizations`, {}),
        one('orders', "SELECT COALESCE(SUM(CASE WHEN status IN ('paid','completed') THEN amount END),0) total, COALESCE(SUM(CASE WHEN status IN ('paid','completed') AND YEAR(created_at)=YEAR(NOW()) AND MONTH(created_at)=MONTH(NOW()) THEN amount END),0) monthly, SUM(status='pending') pending, SUM(status IN ('paid','completed')) active FROM orders", {}),
        one('ai_chat_logs', 'SELECT COUNT(*) calls, COALESCE(SUM(tokens_used),0) points FROM ai_chat_logs WHERE created_at >= DATE_FORMAT(NOW(),\'%Y-%m-01\')', {}),
        one('ai_models', 'SELECT COUNT(*) models FROM ai_models WHERE COALESCE(is_enabled,1)=1', {}),
        one('plugins', 'SELECT SUM(COALESCE(is_installed,0)=1) installed, SUM(COALESCE(is_active,0)=1) active FROM plugins', {}),
        one('seo_sites', "SELECT COUNT(*) total, SUM(status='active') active FROM seo_sites", {}),
        one('seo_scan_jobs', "SELECT COUNT(*) total, SUM(status='completed') completed, SUM(status='failed') failed, COALESCE(SUM(pages_scanned),0) pages FROM seo_scan_jobs WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01')", {}),
        one('seo_issues', "SELECT SUM(status='open') open, SUM(status='open' AND severity='critical') critical FROM seo_issues", {}),
        one('subscriptions', `SELECT SUM(s.status='active') active,
          SUM(s.status='trialing') trialing,
          SUM(s.status='cancelled') cancelled,
          SUM(s.status='expired') expired,
          SUM(s.cancel_at_period_end=1 AND s.status IN ('active','trialing')) cancelling,
          COALESCE(SUM(CASE WHEN s.status IN ('active','trialing') THEN p.monthly_price ELSE 0 END),0) mrr,
          COALESCE(SUM(CASE WHEN s.status IN ('active','trialing') AND YEAR(s.current_period_start)=YEAR(CURDATE()) AND MONTH(s.current_period_start)=MONTH(CURDATE()) THEN p.monthly_price ELSE 0 END),0) new_mrr,
          SUM(s.status='past_due') past_due FROM subscriptions s JOIN plans p ON p.id=s.plan_id`, {}),
        one('usage_ledgers', `SELECT
          COALESCE(SUM(CASE WHEN metric='crawl_page' AND status='settled' THEN quantity ELSE 0 END),0) crawl_pages,
          COALESCE(SUM(CASE WHEN metric='ai_point' AND status='settled' THEN quantity ELSE 0 END),0) ai_points,
          COALESCE(SUM(CASE WHEN metric='export' AND status='settled' THEN quantity ELSE 0 END),0) exports,
          COALESCE(SUM(CASE WHEN metric='api_call' AND status='settled' THEN quantity ELSE 0 END),0) api_calls,
          COALESCE(SUM(status='released'),0) released_events
          FROM usage_ledgers WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01')`, {}),
        one('audit_logs', `SELECT COUNT(*) pending FROM audit_logs
          WHERE action='site.connection.request' AND JSON_UNQUOTE(JSON_EXTRACT(details,'$.status'))='pending'
            AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(details,'$.review_status')),'pending')='pending'`, {}),
      ]);
      const [recentUsers, registrationTrend, scanTrend, aiTrend, revenueTrend, siteHealth] = await Promise.all([
        query('SELECT id, username, email, created_at FROM users ORDER BY created_at DESC LIMIT 8').catch(() => []),
        query("SELECT DATE(created_at) date,COUNT(*) value FROM users WHERE created_at>=CURDATE()-INTERVAL 13 DAY GROUP BY DATE(created_at) ORDER BY date").catch(() => []),
        query("SELECT DATE(created_at) date,COUNT(*) jobs,COALESCE(SUM(pages_scanned),0) pages FROM seo_scan_jobs WHERE created_at>=CURDATE()-INTERVAL 13 DAY GROUP BY DATE(created_at) ORDER BY date").catch(() => []),
        query("SELECT DATE(created_at) date,COALESCE(SUM(quantity),0) value FROM usage_ledgers WHERE metric='ai_point' AND status='settled' AND created_at>=CURDATE()-INTERVAL 13 DAY GROUP BY DATE(created_at) ORDER BY date").catch(() => []),
        query("SELECT DATE(COALESCE(paid_at,created_at)) date,COALESCE(SUM(amount),0) value FROM orders WHERE status='paid' AND COALESCE(paid_at,created_at)>=CURDATE()-INTERVAL 13 DAY GROUP BY DATE(COALESCE(paid_at,created_at)) ORDER BY date").catch(() => []),
        query(`SELECT s.id,s.name,s.normalized_host,s.last_score,s.last_scan_at,
          (SELECT COUNT(*) FROM seo_issues i WHERE i.site_id=s.id AND i.status IN ('open','in_progress')) open_issues,
          (SELECT COUNT(*) FROM seo_issues i WHERE i.site_id=s.id AND i.status IN ('open','in_progress') AND i.severity IN ('critical','high')) serious_issues
          FROM seo_sites s WHERE s.status='active' ORDER BY serious_issues DESC,open_issues DESC,s.last_scan_at DESC LIMIT 8`).catch(() => []),
      ]);
      return success(res, { stats: {
        users: { total: Number(users.total)||0, today_new: Number(users.today_new)||0 },
        organizations: { total: Number(organizations.total)||0, active: Number(organizations.active)||0,
          readonly: Number(organizations.readonly)||0, archived: Number(organizations.archived)||0 },
        sites: { total: Number(sites.total)||0, active: Number(sites.active)||0 },
        scans: { total: Number(scans.total)||0, completed: Number(scans.completed)||0,
          failed: Number(scans.failed)||0, pages: Number(scans.pages)||0 },
        issues: { open: Number(issues.open)||0, critical: Number(issues.critical)||0 },
        ai: { calls: Number(ai.calls)||0, points: Number(ai.points)||0, models: Number(models.models)||0 },
        revenue: { total: Number(revenue.total)||0, monthly: Number(revenue.monthly)||0 },
        subscriptions: { active: Number(commercial.active)||0, trialing: Number(commercial.trialing)||0,
          cancelled: Number(commercial.cancelled)||0, expired: Number(commercial.expired)||0,
          cancelling: Number(commercial.cancelling)||0, past_due: Number(commercial.past_due)||0,
          mrr: Number(commercial.mrr)||0, new_mrr: Number(commercial.new_mrr)||0,
          pending: Number(revenue.pending)||0 },
        usage: { crawl_pages: Number(usage.crawl_pages)||0, ai_points: Number(usage.ai_points)||0,
          exports: Number(usage.exports)||0, api_calls: Number(usage.api_calls)||0,
          released_events: Number(usage.released_events)||0 },
        alerts: { failed_scans: Number(scans.failed)||0,
          critical_issues: Number(issues.critical)||0, past_due: Number(commercial.past_due)||0,
          pending_orders: Number(revenue.pending)||0, readonly_orgs: Number(organizations.readonly)||0,
          pending_connections: Number(connections.pending)||0 },
        plugins: { installed: Number(plugins.installed)||0, active: Number(plugins.active)||0 },
      }, recentUsers: Array.isArray(recentUsers) ? recentUsers : [], trends: {
        registrations: registrationTrend, scans: scanTrend, ai_points: aiTrend, revenue: revenueTrend,
      }, siteHealth });
    } catch (err) {
      logger.error('获取 SEO 仪表盘数据失败', { error: err.message });
      return error(res, '获取仪表盘数据失败', 500);
    }
  }
}
module.exports = new AdminDashboardController();
