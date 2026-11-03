const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');
const { getOrganization } = require('../../services/seoSiteService');
const crypto = require('crypto');

const METRICS = {
  crawl_page: { label: '抓取页面', entitlement: 'crawl_pages_monthly', unit: '页' },
  ai_point: { label: 'AI 算力', entitlement: 'ai_points_monthly', unit: '算力' },
  export: { label: '报告导出', entitlement: 'exports_monthly', unit: '次' },
  api_call: { label: 'API 调用', entitlement: 'api_calls_monthly', unit: '次' },
};

function parseEntitlements(value) {
  if (!value) return {};
  return typeof value === 'string' ? JSON.parse(value) : value;
}

class MembershipController {
  async reconcilePaidOrder(order, execute = query) {
    const match = String(order?.title || '').match(/SEO AI \[([^\]]+)\]/i);
    if (!match || order.status !== 'paid') return;
    const [org] = await execute(`SELECT om.organization_id
      FROM organization_members om JOIN organizations o ON o.id=om.organization_id
      WHERE om.user_id=? AND om.status='active' AND om.role IN ('owner','admin') AND o.status<>'archived'
      ORDER BY (om.role='owner') DESC,o.id LIMIT 1`,[order.user_id]);
    const [plan] = await execute('SELECT id FROM plans WHERE code=? AND status="active"',[match[1].toLowerCase()]);
    if (!org || !plan) return;
    const [processedOrder] = await execute('SELECT id FROM subscriptions WHERE source_order_id=? LIMIT 1',[order.order_id]);
    if (processedOrder) return;
    const [existing] = await execute("SELECT id FROM subscriptions WHERE organization_id=? AND plan_id=? AND status='active' AND current_period_end > NOW() LIMIT 1",[org.organization_id,plan.id]);
    if (existing) return;
    const months = /年付/.test(String(order.title || '')) ? 12 : 1;
    await execute("UPDATE subscriptions SET status='expired',updated_at=NOW() WHERE organization_id=? AND status IN ('active','trialing')",[org.organization_id]);
    await execute("INSERT INTO subscriptions(organization_id,plan_id,status,current_period_start,current_period_end,source_order_id) VALUES(?,?, 'active', NOW(), DATE_ADD(NOW(), INTERVAL ? MONTH), ?)",[org.organization_id,plan.id,months,order.order_id]);
  }
  async cancelPaidOrder(order, execute = query) {
    if (!order?.order_id) return;
    const [subscription] = await execute(
      "SELECT id,organization_id FROM subscriptions WHERE source_order_id=? AND status IN ('active','trialing') LIMIT 1",
      [order.order_id]
    );
    if (!subscription) return;
    await execute(
      "UPDATE subscriptions SET status='cancelled',current_period_end=NOW(),updated_at=NOW() WHERE id=?",
      [subscription.id]
    );
    await execute(
      `UPDATE subscriptions SET status='active',updated_at=NOW()
       WHERE organization_id=? AND status='expired' AND current_period_end>NOW()
       ORDER BY updated_at DESC LIMIT 1`,
      [subscription.organization_id]
    );
  }
  async createPlanOrder(req, res) {
    const code = String(req.body?.plan_code || '').trim().toLowerCase();
    const billing = req.body?.billing === 'annual' ? 'annual' : 'monthly';
    if (!code) return error(res, '请选择套餐', 400);
    try {
      const org = await getOrganization(req.user);
      if (!['owner', 'admin'].includes(org.role)) return error(res, '仅组织所有者或管理员可购买套餐', 403);
      const [plan] = await query('SELECT * FROM plans WHERE code=? AND status="active" LIMIT 1', [code]);
      if (!plan) return error(res, '套餐不存在或暂不可购买', 404);
      if (code === org.plan_code) return error(res, '当前已是该套餐', 400);
      const amount = Number(billing === 'annual' ? plan.annual_price : plan.monthly_price);
      if (!Number.isFinite(amount) || amount <= 0) return error(res, '该套餐价格未配置', 400);
      const title = `SEO AI [${plan.code}] ${plan.name}（${billing === 'annual' ? '年付' : '月付'}）`;
      const [pendingOrder] = await query(
        `SELECT order_id FROM orders
         WHERE user_id=? AND title=? AND amount=? AND status='pending'
           AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         ORDER BY id DESC LIMIT 1`,
        [req.user.id, title, amount]
      );
      if (pendingOrder) {
        return success(res, {
          order_no: pendingOrder.order_id,
          amount,
          plan_code: code,
          billing,
          title,
          reused: true,
        }, '已为你打开现有待支付订单');
      }
      const orderNo = `SEO${Date.now()}${String(req.user.id).padStart(4, '0')}${crypto.randomBytes(3).toString('hex')}`;
      await query(`INSERT INTO orders (order_id,user_id,title,amount,status,payment_method,created_at)
        VALUES(?,?,?,?,'pending','pending',NOW())`, [orderNo, req.user.id, title, amount]);
      await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
        VALUES(?,?,'subscription.order.create','subscription',?,'success',?,?)`, [org.id, req.user.id, orderNo, JSON.stringify({ plan_code: code, billing, amount }), req.ip]);
      return success(res, { order_no: orderNo, amount, plan_code: code, billing, title, reused: false }, '订单已创建，请前往订单中心完成支付', 201);
    } catch { return error(res, '创建套餐订单失败', 500); }
  }
  async getOrganizationMembers(req, res) {
    try {
      const org = await getOrganization(req.user);
      const rows = await query(`SELECT om.id,om.user_id,om.role,om.status,om.created_at,u.username,u.email,u.display_name,u.avatar
        FROM organization_members om JOIN users u ON u.id=om.user_id WHERE om.organization_id=?
        ORDER BY FIELD(om.role,'owner','admin','seo','editor','reviewer','viewer'),om.created_at`, [org.id]);
      return success(res, { organization: { id: org.id, name: org.name, role: org.role }, members: rows });
    } catch { return error(res, '获取组织成员失败', 500); }
  }

  async updateMemberRole(req, res) {
    const roles = ['admin','seo','editor','reviewer','viewer'];
    if (!roles.includes(req.body.role)) return error(res, '角色无效', 400);
    try {
      const org = await getOrganization(req.user);
      if (!['owner','admin'].includes(org.role)) return error(res, '仅组织所有者或管理员可调整角色', 403);
      const [member] = await query('SELECT id,role FROM organization_members WHERE id=? AND organization_id=?', [req.params.id, org.id]);
      if (!member) return error(res, '成员不存在', 404);
      if (member.role === 'owner') return error(res, '不能修改组织所有者角色', 403);
      await query('UPDATE organization_members SET role=? WHERE id=? AND organization_id=?', [req.body.role, member.id, org.id]);
      await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
        VALUES(?,?,'member.role.update','organization_member',?,'success',?,?)`, [org.id, req.user.id, member.id, JSON.stringify({ role: req.body.role }), req.ip]);
      return success(res, null, '成员角色已更新');
    } catch { return error(res, '更新成员角色失败', 500); }
  }

  async inviteMember(req, res) {
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = req.body.role || 'viewer';
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return error(res, '请输入有效邮箱', 400);
    if (!['admin','seo','editor','reviewer','viewer'].includes(role)) return error(res, '角色无效', 400);
    try {
      const org = await getOrganization(req.user);
      if (!['owner','admin'].includes(org.role)) return error(res, '仅组织所有者或管理员可邀请成员', 403);
      const [[count], [user]] = await Promise.all([
        query("SELECT COUNT(*) total FROM organization_members WHERE organization_id=? AND status IN ('active','invited')", [org.id]),
        query('SELECT id,email,username,display_name FROM users WHERE LOWER(email)=? LIMIT 1', [email]),
      ]);
      if (!user) return error(res, '该邮箱尚未注册，请先让对方注册账号', 404);
      if (Number(count.total) >= Number(org.entitlements.members || 1)) return error(res, `${org.plan_name}成员额度已用完`, 403);
      try {
        await query("INSERT INTO organization_members(organization_id,user_id,role,status) VALUES(?,?,?,'invited')", [org.id, user.id, role]);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return error(res, '该用户已在组织中', 409);
        throw err;
      }
      const [member] = await query('SELECT om.id,om.user_id,om.role,om.status,om.created_at,u.username,u.email,u.display_name,u.avatar FROM organization_members om JOIN users u ON u.id=om.user_id WHERE om.organization_id=? AND om.user_id=?', [org.id, user.id]);
      await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address) VALUES(?,?,'member.invite','organization_member',?,'success',?,?)`, [org.id, req.user.id, member.id, JSON.stringify({ email, role }), req.ip]);
      return success(res, member, '成员邀请已创建', 201);
    } catch { return error(res, '邀请成员失败', 500); }
  }

  async updateMemberStatus(req, res) {
    const status = req.body.status;
    if (!['active','disabled'].includes(status)) return error(res, '成员状态无效', 400);
    try {
      const org = await getOrganization(req.user);
      if (!['owner','admin'].includes(org.role)) return error(res, '仅组织所有者或管理员可调整成员状态', 403);
      const [member] = await query('SELECT id,role FROM organization_members WHERE id=? AND organization_id=?', [req.params.id, org.id]);
      if (!member) return error(res, '成员不存在', 404);
      if (member.role === 'owner') return error(res, '不能停用组织所有者', 403);
      await query('UPDATE organization_members SET status=? WHERE id=? AND organization_id=?', [status, member.id, org.id]);
      await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address) VALUES(?,?,'member.status.update','organization_member',?,'success',?,?)`, [org.id, req.user.id, member.id, JSON.stringify({ status }), req.ip]);
      return success(res, null, status === 'active' ? '成员已启用' : '成员已停用');
    } catch { return error(res, '更新成员状态失败', 500); }
  }

  async getPlans(req, res) {
    try {
      const rows = await query("SELECT id,code,name,monthly_price,annual_price,entitlements FROM plans WHERE status='active' ORDER BY monthly_price,id");
      return success(res, rows.map(row => ({ ...row, entitlements: parseEntitlements(row.entitlements) })));
    } catch { return error(res, '获取套餐失败', 500); }
  }

  async getMyMembership(req, res) {
    try {
      const org = await getOrganization(req.user);
      const [[subscription], usageRows, [siteCount], [memberCount], plans] = await Promise.all([
        query(`SELECT s.id,s.status,s.current_period_start,s.current_period_end,s.cancel_at_period_end,
          p.id plan_id,p.code plan_code,p.name plan_name,p.monthly_price,p.annual_price,p.entitlements
          FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.organization_id=?
          ORDER BY FIELD(s.status,'active','trialing','past_due','cancelled','expired'),s.id DESC LIMIT 1`, [org.id]),
        query(`SELECT metric,COALESCE(SUM(quantity),0) used FROM usage_ledgers WHERE organization_id=? AND status='settled'
          AND created_at>=DATE_FORMAT(NOW(),'%Y-%m-01') GROUP BY metric`, [org.id]),
        query("SELECT COUNT(*) total FROM seo_sites WHERE organization_id=? AND status<>'archived'", [org.id]),
        query("SELECT COUNT(*) total FROM organization_members WHERE organization_id=? AND status='active'", [org.id]),
        query("SELECT id,code,name,monthly_price,annual_price,entitlements FROM plans WHERE status='active' ORDER BY monthly_price,id"),
      ]);
      const entitlements = parseEntitlements(subscription?.entitlements || org.entitlements);
      const usedMap = Object.fromEntries(usageRows.map(row => [row.metric, Number(row.used)]));
      const usage = Object.entries(METRICS).map(([metric, definition]) => {
        const limit = entitlements[definition.entitlement];
        const used = usedMap[metric] || 0;
        return { metric, label: definition.label, unit: definition.unit, used, limit: limit == null ? null : Number(limit),
          remaining: limit == null ? null : Math.max(0, Number(limit) - used) };
      });
      usage.unshift(
        { metric: 'sites', label: '站点', unit: '个', used: Number(siteCount.total), limit: Number(entitlements.sites || 0), remaining: Math.max(0, Number(entitlements.sites || 0) - Number(siteCount.total)) },
        { metric: 'members', label: '团队成员', unit: '人', used: Number(memberCount.total), limit: Number(entitlements.members || 0), remaining: Math.max(0, Number(entitlements.members || 0) - Number(memberCount.total)) },
      );
      const now = new Date();
      return success(res, {
        organization: { id: org.id, name: org.name, role: org.role },
        subscription: subscription ? { ...subscription, entitlements } : null,
        usage,
        usage_period: { start: new Date(now.getFullYear(), now.getMonth(), 1), reset_at: new Date(now.getFullYear(), now.getMonth() + 1, 1) },
        plans: plans.map(plan => ({ ...plan, entitlements: parseEntitlements(plan.entitlements) })),
      });
    } catch { return error(res, '获取套餐与用量失败', 500); }
  }

  async getUsageLedgers(req, res) {
    try {
      const org = await getOrganization(req.user);
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 20));
      const params = [org.id];
      let where = "organization_id=? AND status='settled'";
      if (req.query.metric && METRICS[req.query.metric]) { where += ' AND metric=?'; params.push(req.query.metric); }
      const [[count], rows] = await Promise.all([
        query(`SELECT COUNT(*) total FROM usage_ledgers WHERE ${where}`, params),
        query(`SELECT id,metric,quantity,reference_type,reference_id,metadata,created_at FROM usage_ledgers WHERE ${where}
          ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]),
      ]);
      return paginated(res, rows.map(row => ({ ...row, metric_label: METRICS[row.metric]?.label || row.metric,
        unit: METRICS[row.metric]?.unit || '' })), Number(count.total), page, pageSize);
    } catch { return error(res, '获取用量流水失败', 500); }
  }
}

module.exports = new MembershipController();
