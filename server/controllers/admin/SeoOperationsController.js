const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const { encryptToken, getAhrefsSettings, normalizeEndpoint, normalizeTarget, requestDomainRating } = require('../../services/ahrefsAuthorityService');

class SeoOperationsController {
  async getAuthorityConfig(req,res){try{const s=await getAhrefsSettings();return success(res,{enabled:s.enabled,endpoint:s.endpoint,refresh_hours:s.refreshHours,token_configured:s.tokenConfigured})}catch{return error(res,'获取外链权威配置失败',500)}}
  async saveAuthorityConfig(req,res){try{const endpoint=normalizeEndpoint(req.body?.endpoint),refreshHours=Math.max(1,Math.min(168,Number(req.body?.refresh_hours)||24));const values={seo_ahrefs_enabled:req.body?.enabled?'1':'0',seo_ahrefs_endpoint:endpoint,seo_ahrefs_refresh_hours:String(refreshHours)};const token=String(req.body?.token||'').trim();if(token)values.seo_ahrefs_token=encryptToken(token);for(const [key,value] of Object.entries(values))await query("INSERT INTO system_settings(setting_key,setting_value,setting_group,updated_at) VALUES(?,?,'seo',NOW()) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),setting_group='seo',updated_at=NOW()",[key,value]);const settings=await getAhrefsSettings();if(settings.tokenConfigured&&!settings.tokenEncrypted)await query("UPDATE system_settings SET setting_value=?,updated_at=NOW() WHERE setting_key='seo_ahrefs_token'",[encryptToken(settings.token)]);await query("INSERT INTO audit_logs(user_id,action,resource_type,result,details,ip_address) VALUES(?,'seo.ahrefs.config.update','system_setting','success',?,?)",[req.user.id,JSON.stringify({enabled:req.body?.enabled===true,endpoint,refresh_hours:refreshHours,token_updated:Boolean(token)}),req.ip]);return success(res,{enabled:req.body?.enabled===true,endpoint,refresh_hours:refreshHours,token_configured:settings.tokenConfigured},'外链权威配置已保存')}catch(err){return error(res,err.message||'保存外链权威配置失败',400)}}
  async testAuthorityConfig(req,res){try{const stored=await getAhrefsSettings();const endpoint=normalizeEndpoint(req.body?.endpoint||stored.endpoint),token=String(req.body?.token||'').trim()||stored.token,target=normalizeTarget(req.body?.target);const result=await requestDomainRating({endpoint,token,target});await query("INSERT INTO audit_logs(user_id,action,resource_type,result,details,ip_address) VALUES(?,'seo.ahrefs.config.test','system_setting','success',?,?)",[req.user.id,JSON.stringify({endpoint,target,domain_rating:result.domain_rating}),req.ip]);return success(res,result,'Ahrefs API 连接成功')}catch(err){const status=err.response?.status;return error(res,status===401||status===403?'Ahrefs API Token 无效或无权限':(err.message||'Ahrefs API 连接失败'),status===401||status===403?422:400)}}
  async overview(req,res){
    try{
      const [organizations,sites,scans,issues,usage]=await Promise.all([
        query("SELECT COUNT(*) total FROM organizations WHERE status='active'"),
        query("SELECT COUNT(*) total,SUM(ownership_status='verified') verified,AVG(last_score) avg_score FROM seo_sites WHERE status='active'"),
        query("SELECT COUNT(*) total,SUM(status='completed') completed,SUM(status='failed') failed FROM seo_scan_jobs"),
        query("SELECT COUNT(*) total,SUM(status IN ('open','in_progress')) open,SUM(severity IN ('critical','high') AND status IN ('open','in_progress')) serious FROM seo_issues"),
        query("SELECT metric,COALESCE(SUM(quantity),0) used FROM usage_ledgers WHERE status='settled' AND created_at>=DATE_FORMAT(NOW(),'%Y-%m-01') GROUP BY metric")
      ]);
      return success(res,{organizations:organizations[0],sites:sites[0],scans:scans[0],issues:issues[0],usage});
    }catch{return error(res,'获取 SEO 运营数据失败',500)}
  }
  async sites(req,res){try{return success(res,await query(`SELECT s.id,s.organization_id,s.name,s.base_url,s.normalized_host,
    s.ownership_status,s.verification_method,s.verified_at,s.sitemap_url,s.sitemap_discovered_at,
    s.last_http_status,s.last_scan_at,s.last_score,s.status,s.created_at,o.name organization_name,u.username owner_name,
    (SELECT COUNT(*) FROM seo_issues i WHERE i.site_id=s.id AND i.status IN ('open','in_progress')) open_issues
    FROM seo_sites s JOIN organizations o ON o.id=s.organization_id LEFT JOIN users u ON u.id=o.owner_user_id
    WHERE s.status<>'archived' ORDER BY s.created_at DESC LIMIT 300`))}catch{return error(res,'获取站点失败',500)}}
  async scans(req,res){try{return success(res,await query(`SELECT j.*,s.name site_name,s.base_url,o.name organization_name
    FROM seo_scan_jobs j JOIN seo_sites s ON s.id=j.site_id JOIN organizations o ON o.id=j.organization_id
    ORDER BY j.created_at DESC LIMIT 300`))}catch{return error(res,'获取扫描失败',500)}}
  async issues(req,res){try{return success(res,await query(`SELECT i.*,s.name site_name,o.name organization_name,p.url
    FROM seo_issues i JOIN seo_sites s ON s.id=i.site_id JOIN organizations o ON o.id=i.organization_id
    LEFT JOIN seo_pages p ON p.id=i.page_id ORDER BY FIELD(i.severity,'critical','high','medium','low'),i.created_at DESC LIMIT 500`))}
    catch{return error(res,'获取问题失败',500)}}
  async updateIssueStatus(req,res){
    const allowed=['open','in_progress','resolved','ignored'];
    if(!allowed.includes(req.body?.status)) return error(res,'状态无效',400);
    try{
      const [issue]=await query('SELECT id,status FROM seo_issues WHERE id=?',[req.params.id]);
      if(!issue) return error(res,'问题不存在',404);
      await query('UPDATE seo_issues SET status=?, resolved_at=CASE WHEN ?="resolved" THEN NOW() ELSE NULL END, updated_at=NOW() WHERE id=?',[req.body.status,req.body.status,issue.id]);
      await query(`INSERT INTO audit_logs(user_id,action,resource_type,resource_id,result,details,ip_address) VALUES(?, 'issue.review.update','seo_issue',?,'success',?,?)`,[req.user.id,issue.id,JSON.stringify({from:issue.status,to:req.body.status}),req.ip]);
      return success(res,null,'审核状态已更新');
    }catch{return error(res,'更新审核状态失败',500)}
  }
  async plans(req,res){try{const rows=await query(`SELECT p.*,
    (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id=p.id AND s.status IN ('active','trialing')) subscribers
    FROM plans p ORDER BY p.monthly_price,p.id`);return success(res,rows.map(row=>({...row,entitlements:typeof row.entitlements==='string'?JSON.parse(row.entitlements):row.entitlements})))}catch{return error(res,'获取套餐失败',500)}}
  async updatePlan(req,res){
    const allowed=['sites','members','crawl_pages_monthly','pages_per_scan','ai_points_monthly','history_days','scan_interval_hours'];
    try{const [plan]=await query('SELECT * FROM plans WHERE id=?',[req.params.id]);if(!plan)return error(res,'套餐不存在',404);
      const current=typeof plan.entitlements==='string'?JSON.parse(plan.entitlements):plan.entitlements;
      const incoming=req.body.entitlements||{};const entitlements={...current};
      for(const key of allowed)if(incoming[key]!==undefined){const value=Number(incoming[key]);if(!Number.isFinite(value)||value<0)return error(res,`${key} 必须是非负数`,400);entitlements[key]=value}
      const monthly=Number(req.body.monthly_price),annual=Number(req.body.annual_price);
      if(!Number.isFinite(monthly)||monthly<0||!Number.isFinite(annual)||annual<0)return error(res,'套餐价格必须是非负数',400);
      await query('UPDATE plans SET monthly_price=?,annual_price=?,entitlements=? WHERE id=?',[monthly,annual,JSON.stringify(entitlements),plan.id]);
      await query(`INSERT INTO audit_logs(user_id,action,resource_type,resource_id,result,details,ip_address)
        VALUES(?,'plan.update','plan',?,'success',?,?)`,[req.user.id,plan.id,JSON.stringify({monthly_price:monthly,annual_price:annual,entitlements}),req.ip]);
      return success(res,null,'套餐权益已更新');
    }catch{return error(res,'保存套餐失败',500)}
  }
  async usage(req,res){try{return success(res,await query(`SELECT l.id,l.metric,l.quantity,l.reference_type,l.reference_id,l.status,l.created_at,
    o.name organization_name,u.username FROM usage_ledgers l JOIN organizations o ON o.id=l.organization_id
    LEFT JOIN users u ON u.id=l.user_id ORDER BY l.created_at DESC,l.id DESC LIMIT 500`))}catch{return error(res,'获取用量流水失败',500)}}
  async auditLogs(req,res){try{return success(res,await query(`SELECT a.id,a.organization_id,a.user_id,a.action,a.resource_type,a.resource_id,a.result,a.details,a.ip_address,a.created_at,
    o.name organization_name,u.username,u.display_name FROM audit_logs a LEFT JOIN organizations o ON o.id=a.organization_id
    LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC,a.id DESC LIMIT 500`))}catch{return error(res,'获取审计日志失败',500)}}
  async connectionRequests(req,res){
    try {
      const rows=await query(`SELECT a.id,a.organization_id,a.user_id,a.resource_id site_id,a.result,a.details,a.created_at,
        o.name organization_name,s.name site_name,s.base_url,s.normalized_host,u.username,u.display_name
        FROM audit_logs a JOIN seo_sites s ON s.id=a.resource_id JOIN organizations o ON o.id=a.organization_id
        LEFT JOIN users u ON u.id=a.user_id WHERE a.action='site.connection.request'
        ORDER BY a.created_at DESC,a.id DESC LIMIT 300`);
      return success(res,rows.map(row=>{let details=row.details;try{if(typeof details==='string')details=JSON.parse(details)}catch{details={}}return {...row,details,review_status:details?.review_status||'pending'}}));
    } catch { return error(res,'获取接入申请失败',500); }
  }
  async adPrograms(req,res){try{return success(res,await query(`SELECT a.*,s.name site_name,o.name organization_name,u.username owner_name FROM seo_ad_programs a JOIN seo_sites s ON s.id=a.site_id JOIN organizations o ON o.id=a.organization_id LEFT JOIN users u ON u.id=o.owner_user_id ORDER BY a.created_at DESC LIMIT 300`))}catch{return error(res,'获取广告项目失败',500)}}
  async reviewAdProgram(req,res){const status=req.body?.status;if(!['active','rejected','paused'].includes(status))return error(res,'广告审核状态无效',400);try{const result=await query('UPDATE seo_ad_programs SET status=?,reviewed_by=?,reviewed_at=NOW() WHERE id=? AND status IN (\'under_review\',\'active\',\'paused\')',[status,req.user.id,req.params.id]);if(!result.affectedRows)return error(res,'广告项目不存在或已处理',404);return success(res,{id:req.params.id,status},'广告项目审核完成')}catch{return error(res,'审核广告项目失败',500)}}
  async reviewConnection(req,res){
    const status=req.body?.status;
    if(!['approved','rejected'].includes(status)) return error(res,'审核状态无效',400);
    try {
      const [request]=await query("SELECT * FROM audit_logs WHERE id=? AND action='site.connection.request'",[req.params.id]);
      if(!request)return error(res,'接入申请不存在',404);
      let details=request.details;try{if(typeof details==='string')details=JSON.parse(details)}catch{details={}};
      if(details.review_status&&details.review_status!=='pending')return error(res,'该申请已审核',409);
      details.review_status=status;details.reviewed_by=req.user.id;details.reviewed_at=new Date().toISOString();
      await query('UPDATE audit_logs SET details=?,result=? WHERE id=?',[JSON.stringify(details),status==='approved'?'success':'failure',request.id]);
      if(details.connector_id) await query(`UPDATE seo_site_connectors SET status=?,reviewed_by=?,reviewed_at=NOW()
        WHERE id=? AND organization_id=? AND site_id=? AND status='pending'`,[status==='approved'?'active':'rejected',req.user.id,details.connector_id,request.organization_id,request.resource_id]);
      await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
        VALUES(?,?,'site.connection.review','seo_site',?, 'success', ?, ?)`,[request.organization_id,req.user.id,request.resource_id,JSON.stringify({request_id:request.id,status}),req.ip]);
      return success(res,{id:request.id,status},'接入申请审核完成');
    } catch { return error(res,'审核接入申请失败',500); }
  }
}
module.exports=new SeoOperationsController();
