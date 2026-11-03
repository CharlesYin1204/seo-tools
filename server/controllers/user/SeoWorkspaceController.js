const { success, error } = require('../../utils/response');
const crypto = require('crypto');
const { query, transaction } = require('../../config/database');
const { assertPublicUrl, safeFetch, getOrganization, inspectPage, verifyOwnership, detectSiteLanguages, discoverSitemap, calculateSeoScores } = require('../../services/seoSiteService');
const logger = require('../../utils/logger');
const axios = require('axios');
const { encryptCredentials, decryptCredentials, validateConnectorEndpoint, callConnector } = require('../../services/seoConnectorService');
const { refreshAccessToken, fetchPropertyData } = require('../../services/googleSearchConsoleService');
const { fetchAhrefsAuthority } = require('../../services/ahrefsAuthorityService');

function parseAiJson(content) {
  const normalized = String(content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = normalized.indexOf('{');
  const end = normalized.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI 未返回有效候选');
  return JSON.parse(normalized.slice(start, end + 1));
}

function normalizeLegacyScoreModel(siteOrModel) {
  let model = siteOrModel?.last_score_model ?? siteOrModel;
  try { if (typeof model === 'string') model = JSON.parse(model || '{}'); } catch { model = {}; }
  if (model && (model.weights || model.status === 'limited' || model.dimensions?.backlink_authority !== undefined)) return model;
  const legacyScore = Number(siteOrModel?.last_score ?? model?.score);
  const legacyDimensions = model?.dimensions || {};
  if (!Number.isFinite(legacyScore) && !Object.keys(legacyDimensions).length) return model || {};
  const technical = Number(legacyDimensions.technical_structure ?? legacyDimensions.technical);
  const content = Number(legacyDimensions.content_structure ?? legacyDimensions.content);
  const onsite = Number.isFinite(legacyScore) ? Math.round(legacyScore * 0.66 * 10) / 10 : null;
  return { version:'three-pillar-seo-v1', status:'limited', coverage:66, onsiteScore:onsite, onsiteMaxScore:66, authorityStatus:'not_connected', missingDimensions:['backlink_authority'], weights:{technical_structure:33,content_structure:33,backlink_authority:34}, dimensions:{technical_structure:Number.isFinite(technical)?technical:null,content_structure:Number.isFinite(content)?content:null,backlink_authority:null}, score:null };
}

async function getGoogleGscConfig() {
  const rows = await query("SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN ('auth_google_client_id','auth_google_client_secret','auth_google_gsc_callback_url')");
  const settings = Object.fromEntries(rows.map(row => [row.setting_key,row.setting_value]));
  return {
    clientId: settings.auth_google_client_id || process.env.GOOGLE_CLIENT_ID,
    clientSecret: settings.auth_google_client_secret || process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: settings.auth_google_gsc_callback_url || process.env.GOOGLE_GSC_REDIRECT_URI || `${process.env.APP_URL || ''}/api/user/seo/gsc/callback`,
  };
}

async function saveGscImport({organizationId,siteId,userId,propertyUrl,permissionLevel,tokenEncrypted,tokenExpiresAt,data}) {
  const inspection=data.inspection||{};
  const lastCrawlAt=inspection.lastCrawlTime&&Number.isFinite(new Date(inspection.lastCrawlTime).getTime())?new Date(inspection.lastCrawlTime):null;
  await transaction(async connection=>{
    await connection.query(`INSERT INTO seo_gsc_connections(organization_id,site_id,property_url,permission_level,token_encrypted,token_expires_at,status,index_verdict,coverage_state,last_crawl_at,last_synced_at,last_error,connected_by)
      VALUES(?,?,?,?,?,?,'active',?,?,?,NOW(),NULL,?) ON DUPLICATE KEY UPDATE property_url=VALUES(property_url),permission_level=VALUES(permission_level),token_encrypted=VALUES(token_encrypted),token_expires_at=VALUES(token_expires_at),status='active',index_verdict=VALUES(index_verdict),coverage_state=VALUES(coverage_state),last_crawl_at=VALUES(last_crawl_at),last_synced_at=NOW(),last_error=NULL,connected_by=VALUES(connected_by)`,
    [organizationId,siteId,propertyUrl,permissionLevel,tokenEncrypted,tokenExpiresAt,inspection.verdict||null,String(inspection.coverageState||'').slice(0,255)||null,lastCrawlAt,userId]);
    for(const row of data.metrics) await connection.query(`INSERT INTO seo_gsc_daily_metrics(organization_id,site_id,metric_date,clicks,impressions,ctr,position,synced_at) VALUES(?,?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE clicks=VALUES(clicks),impressions=VALUES(impressions),ctr=VALUES(ctr),position=VALUES(position),synced_at=NOW()`,[organizationId,siteId,row.date,row.clicks,row.impressions,row.ctr,row.position]);
  });
}

function getAiRequestHeaders(model) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${model.api_key}`,
  };
  if (model.api_headers) {
    try {
      const custom = typeof model.api_headers === 'string' ? JSON.parse(model.api_headers) : model.api_headers;
      if (custom && typeof custom === 'object' && !Array.isArray(custom)) Object.assign(headers, custom);
    } catch {}
  }
  return headers;
}

function extractAiText(data) {
  let content = data?.choices?.[0]?.message?.content
    ?? data?.choices?.[0]?.text
    ?? data?.result
    ?? data?.output_text;
  if (Array.isArray(content)) {
    content = content.map(part => typeof part === 'string' ? part : (part?.text || part?.content || '')).join('');
  }
  return String(content || '');
}

function isRetryableAiError(err) {
  const status = Number(err?.response?.status || 0);
  const code = String(err?.code || '').toLowerCase();
  const message = String(err?.response?.data?.error?.message || err?.message || '').toLowerCase();
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
    || ['econnaborted', 'etimedout', 'econnreset', 'eai_again', 'enotfound', 'socket hang up'].some(item => code.includes(item) || message.includes(item));
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestMetadataCandidate(model, page, options = {}) {
  const prompt = `你是 SEO 元数据编辑。只能依据下面的已抓取页面事实生成候选，不得添加事实中没有的产品、价格、地点、资质或承诺。\n
页面 URL: ${page.url}\n当前标题: ${page.title || '(空)'}\n当前描述: ${page.meta_description || '(空)'}\nH1 数量: ${page.h1_count}\nHTTP 状态: ${page.http_status}\n
返回严格 JSON：{"title":"不超过60个中文字符的标题","description":"不超过160个中文字符的描述","rationale":"说明使用了哪些页面事实"}`;
  const response = await axios.post(model.api_url, {
    model: model.model_code || model.model_name,
    messages: [{ role: 'system', content: '输出只能是 JSON，候选必须可由输入事实支持。' }, { role: 'user', content: prompt }],
    max_tokens: Number(model.max_tokens) > 0 ? Math.min(Number(model.max_tokens), 1000) : 500,
    temperature: Number.isFinite(Number(model.temperature)) ? Number(model.temperature) : 0.2,
  }, {
    headers: getAiRequestHeaders(model),
    timeout: Number(options.timeout) > 0 ? Number(options.timeout) : 60000,
  });
  return parseAiJson(extractAiText(response.data));
}

class SeoWorkspaceController {
  async getScoreDetails(req,res) {
    try {
      const org = await getOrganization(req.user);
      const [site] = await query("SELECT id,name,last_score,last_score_model FROM seo_sites WHERE id=? AND organization_id=? AND status='active'", [req.params.id, org.id]);
      // 详情面板需要可重复打开；旧站点或尚未完成组织迁移时返回空结构，
      // 避免被全局 404 拦截器误判为“资源不存在”。
      if (!site) return success(res,{site:null,scan:null,score_model:{},issues:[],pages:[]});
      const [scan] = await query("SELECT id,score,issue_count,pages_scanned,pages_discovered,completed_at FROM seo_scan_jobs WHERE site_id=? AND organization_id=? AND status='completed' ORDER BY id DESC LIMIT 1",[site.id,org.id]);
      if (!scan) return success(res,{site,scan:null,dimensions:{},issues:[],pages:[]});
      const [issues,pages] = await Promise.all([
        query("SELECT id,rule_code,category,severity,title,evidence,recommendation,status,page_id FROM seo_issues WHERE site_id=? AND organization_id=? AND scan_id=? ORDER BY FIELD(severity,'critical','high','medium','low'),id",[site.id,org.id,scan.id]),
        query("SELECT id,url,title,http_status,facts FROM seo_pages WHERE site_id=? AND organization_id=? AND scan_id=? ORDER BY id",[site.id,org.id,scan.id])
      ]);
      const normalizedPages=pages.map(page=>{let facts=page.facts;try{if(typeof facts==='string')facts=JSON.parse(facts)}catch{facts={}}const model=facts?.score_model||{};return {...page,facts:undefined,page_score:model.score??null,onsite_score:model.onsiteScore??model.internalScore??null,dimensions:model.dimensions||{},weights:model.weights||{},coverage:model.coverage??null,status:model.status||'insufficient_data',breakdown:model.breakdown||[],score_gates:model.scoreGates||[]}});
      return success(res,{site,scan,score_model:normalizeLegacyScoreModel(site),issues,pages:normalizedPages});
    } catch (err) { logger.error('获取评分详情失败',{error:err.message}); return error(res,'获取评分详情失败',500); }
  }
  async listAdPrograms(req,res) { try { const org=await getOrganization(req.user); return success(res, await query('SELECT a.*,s.name site_name FROM seo_ad_programs a JOIN seo_sites s ON s.id=a.site_id WHERE a.organization_id=? ORDER BY a.created_at DESC',[org.id])); } catch { return error(res,'获取广告项目失败',500); } }
  async applyAdProgram(req,res) { try { const org=await getOrganization(req.user); const [site]=await query("SELECT id FROM seo_sites WHERE id=? AND organization_id=? AND ownership_status='verified' AND status='active'",[req.params.id,org.id]); if(!site)return error(res,'只有已验证站点可以申请广告投放',403); if(req.body?.consent!==true)return error(res,'请先明确同意广告投放授权',400); const result=await query('INSERT INTO seo_ad_programs(organization_id,site_id,consent_version,channels,budget,placements,created_by) VALUES(?,?,?,?,?,?,?)',[org.id,site.id,String(req.body.consent_version||'v1').slice(0,40),JSON.stringify(req.body.channels||[]),Number(req.body.budget||0),JSON.stringify(req.body.placements||[]),req.user.id]); return success(res,{id:result.insertId,status:'under_review'},'广告投放申请已提交',201); } catch { return error(res,'提交广告申请失败',500); } }
  async updateAdProgram(req,res) { try { const org=await getOrganization(req.user); const status=['paused','terminated'].includes(req.body?.status)?req.body.status:null; if(!status)return error(res,'仅支持暂停或终止广告项目',400); const result=await query('UPDATE seo_ad_programs SET status=? WHERE id=? AND organization_id=? AND status IN (\'under_review\',\'active\',\'paused\')',[status,req.params.id,org.id]); if(!result.affectedRows)return error(res,'广告项目不存在',404); return success(res,{status},'广告项目状态已更新'); } catch { return error(res,'更新广告项目失败',500); } }
  async gscAuthorize(req, res) {
    try {
      const org = await getOrganization(req.user);
      const [site] = await query("SELECT id,normalized_host FROM seo_sites WHERE id=? AND organization_id=? AND status='active'", [req.params.id, org.id]);
      if (!site) return error(res, '站点不存在', 404);
      const { clientId, redirectUri } = await getGoogleGscConfig();
      if (!clientId || !redirectUri) return error(res, 'Google Search Console 尚未配置 OAuth 客户端', 503);
      const state = crypto.randomBytes(24).toString('hex');
      if (req.session) req.session.gsc_oauth_state = { state, siteId:site.id,organizationId:org.id,userId:req.user.id,createdAt:Date.now() };
      const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'https://www.googleapis.com/auth/webmasters.readonly', access_type: 'offline', prompt: 'consent', state });
      return success(res, { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
    } catch { return error(res, '无法创建 Google 授权请求', 500); }
  }

  async gscCallback(req, res) {
    const frontendUrl = `${process.env.APP_URL || ''}/user/seo-sites`;
    try {
      const oauth = req.session?.gsc_oauth_state;
      if (req.session) delete req.session.gsc_oauth_state;
      if (!oauth || !req.query.state || req.query.state !== oauth.state || Date.now() - oauth.createdAt > 10 * 60 * 1000) return res.redirect(`${frontendUrl}?gsc=invalid_state`);
      if (!req.query.code) return res.redirect(`${frontendUrl}?gsc=denied`);
      const organizationId = Number(oauth.organizationId);
      const userId = Number(oauth.userId);
      if (!organizationId || !userId) return res.redirect(`${frontendUrl}?gsc=invalid_state`);
      const [site] = await query("SELECT id,normalized_host FROM seo_sites WHERE id=? AND organization_id=? AND status='active'", [oauth.siteId, organizationId]);
      if (!site) return res.redirect(`${frontendUrl}?gsc=site_missing`);
      const { clientId, clientSecret, redirectUri } = await getGoogleGscConfig();
      if (!clientId || !clientSecret || !redirectUri) return res.redirect(`${frontendUrl}?gsc=not_configured`);
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({ client_id:clientId,client_secret:clientSecret,code:String(req.query.code),grant_type:'authorization_code',redirect_uri:redirectUri }).toString(), { headers:{'Content-Type':'application/x-www-form-urlencoded'},timeout:15000 });
      const accessToken = tokenResponse.data?.access_token;
      if (!accessToken) throw new Error('Google 未返回访问令牌');
      const propertiesResponse = await axios.get('https://www.googleapis.com/webmasters/v3/sites', { headers:{Authorization:`Bearer ${accessToken}`,Accept:'application/json'},timeout:15000 });
      const properties = Array.isArray(propertiesResponse.data?.siteEntry) ? propertiesResponse.data.siteEntry : [];
      const matched = properties.find(item => {
        if (item.permissionLevel === 'siteUnverifiedUser') return false;
        const property = String(item.siteUrl || '');
        if (property.startsWith('sc-domain:')) return property.slice(10).toLowerCase() === site.normalized_host.toLowerCase();
        try { return new URL(property).hostname.toLowerCase() === site.normalized_host.toLowerCase(); } catch { return false; }
      });
      if (!matched) return res.redirect(`${frontendUrl}?gsc=no_matching_property`);
      const [existing]=await query('SELECT token_encrypted FROM seo_gsc_connections WHERE organization_id=? AND site_id=? LIMIT 1',[organizationId,site.id]);
      let refreshToken=tokenResponse.data?.refresh_token||null;
      if(!refreshToken&&existing?.token_encrypted){try{refreshToken=decryptCredentials(existing.token_encrypted).refresh_token||null}catch{}}
      const tokenEncrypted=encryptCredentials({access_token:accessToken,refresh_token:refreshToken,scope:tokenResponse.data?.scope||'https://www.googleapis.com/auth/webmasters.readonly'});
      const tokenExpiresAt=new Date(Date.now()+Number(tokenResponse.data?.expires_in||3600)*1000);
      const imported=await fetchPropertyData(accessToken,matched.siteUrl,`https://${site.normalized_host}/`);
      await saveGscImport({organizationId,siteId:site.id,userId,propertyUrl:matched.siteUrl,permissionLevel:matched.permissionLevel,tokenEncrypted,tokenExpiresAt,data:imported});
      await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address) VALUES(?,?,'site.gsc.import','seo_site',?,'success',?,?)`, [organizationId,userId,site.id,JSON.stringify({site_url:matched.siteUrl,permission_level:matched.permissionLevel,imported_at:new Date().toISOString()}),req.ip]);
      return res.redirect(`${frontendUrl}?gsc=imported`);
    } catch (err) {
      logger.warn('GSC 导入失败',{error:err.response?.data?.error_description||err.message});
      return res.redirect(`${frontendUrl}?gsc=failed`);
    }
  }

  async overview(req, res) {
    try {
      const org = await getOrganization(req.user);
      const [[siteStats], [issueStats], [scanStats], usage, [candidateStats], topIssues, [latestScan]] = await Promise.all([
        query(`SELECT COUNT(*) AS total,SUM(ownership_status='verified') AS verified FROM seo_sites WHERE organization_id=? AND status='active'`, [org.id]),
        query(`SELECT COUNT(*) AS open,SUM(severity IN ('critical','high')) AS serious FROM seo_issues WHERE organization_id=? AND status IN ('open','in_progress')`, [org.id]),
        query(`SELECT COUNT(*) AS total,SUM(status='completed') AS completed,MAX(completed_at) AS last_scan_at FROM seo_scan_jobs WHERE organization_id=?`, [org.id]),
        query(`SELECT metric,COALESCE(SUM(quantity),0) AS used FROM usage_ledgers WHERE organization_id=? AND status='settled'
          AND created_at>=DATE_FORMAT(NOW(),'%Y-%m-01') GROUP BY metric`, [org.id]),
        query(`SELECT COUNT(*) AS generated_count,SUM(status IN ('approved','exported')) AS approved_count,SUM(status='exported') AS exported_count
          FROM seo_change_candidates WHERE organization_id=?`, [org.id]),
        query(`SELECT i.id,i.category,i.severity,i.title,i.evidence,i.recommendation,s.name site_name,p.url
          FROM seo_issues i JOIN seo_sites s ON s.id=i.site_id LEFT JOIN seo_pages p ON p.id=i.page_id
          WHERE i.organization_id=? AND i.status IN ('open','in_progress')
          ORDER BY FIELD(i.severity,'critical','high','medium','low'),i.id DESC LIMIT 3`, [org.id]),
        query(`SELECT id,score,pages_scanned,issue_count,completed_at FROM seo_scan_jobs
          WHERE organization_id=? AND status='completed' ORDER BY completed_at DESC,id DESC LIMIT 1`, [org.id]),
      ]);
      const [scanTrend, siteHealth] = await Promise.all([
        query(`SELECT DATE(created_at) date,COUNT(*) jobs,COALESCE(SUM(pages_scanned),0) pages,
          ROUND(AVG(CASE WHEN status='completed' THEN score END),1) average_score
          FROM seo_scan_jobs WHERE organization_id=? AND created_at>=CURDATE()-INTERVAL 13 DAY
          GROUP BY DATE(created_at) ORDER BY date`, [org.id]),
        query(`SELECT s.id,s.name,s.normalized_host,s.last_score,s.last_scan_at,s.ownership_status,
          (SELECT COUNT(*) FROM seo_issues i WHERE i.site_id=s.id AND i.status IN ('open','in_progress')) open_issues,
          (SELECT COUNT(*) FROM seo_issues i WHERE i.site_id=s.id AND i.status IN ('open','in_progress') AND i.severity IN ('critical','high')) serious_issues,
          (SELECT status FROM seo_gsc_connections g WHERE g.site_id=s.id AND g.organization_id=s.organization_id LIMIT 1) gsc_status
          FROM seo_sites s WHERE s.organization_id=? AND s.status='active' ORDER BY serious_issues DESC,last_scan_at DESC LIMIT 6`, [org.id]),
      ]);
      const used = Object.fromEntries(usage.map(row => [row.metric, Number(row.used)]));
      const deductions = { critical: 20, high: 12, medium: 6, low: 2 };
      const categoryScores = { technical: 100, content: 100, authority: 100 };
      for (const item of topIssues) {
        if (categoryScores[item.category] !== undefined) categoryScores[item.category] = Math.max(0, categoryScores[item.category] - (deductions[item.severity] || 0));
      }
      return success(res, { organization: org, sites: siteStats, issues: issueStats, scans: scanStats,
        usage: { crawl_pages: used.crawl_page || 0, ai_points: used.ai_point || 0 },
        quota: { crawl_pages: org.entitlements.crawl_pages_monthly, ai_points: org.entitlements.ai_points_monthly },
        onboarding: { generated: Number(candidateStats.generated_count)||0, approved: Number(candidateStats.approved_count)||0,
          exported: Number(candidateStats.exported_count)||0 },
        first_value: { latest_scan: latestScan || null, scores: categoryScores, top_issues: topIssues },
        trends: { scans: scanTrend }, site_health: siteHealth });
    } catch (err) {
      logger.error('获取 SEO 工作区失败', { error: err.message });
      return error(res, '获取工作区失败', 500);
    }
  }

  async getSites(req, res) {
    try {
      const org = await getOrganization(req.user);
      const rows = await query(`SELECT s.*,
        (SELECT COUNT(*) FROM seo_issues i WHERE i.site_id=s.id AND i.status IN ('open','in_progress')) AS open_issues,
        (SELECT COUNT(*) FROM seo_sitemaps sm WHERE sm.site_id=s.id) AS sitemap_count,
        (SELECT COALESCE(SUM(sm.page_count),0) FROM seo_sitemaps sm WHERE sm.site_id=s.id) AS sitemap_page_count,
        (SELECT JSON_UNQUOTE(JSON_EXTRACT(a.details,'$.review_status')) FROM audit_logs a
          WHERE a.organization_id=s.organization_id AND a.resource_type='seo_site' AND a.resource_id=s.id
            AND a.action='site.connection.request' ORDER BY a.id DESC LIMIT 1) AS connection_status,
        (SELECT g.status FROM seo_gsc_connections g WHERE g.organization_id=s.organization_id AND g.site_id=s.id LIMIT 1) AS gsc_status,
        (SELECT g.property_url FROM seo_gsc_connections g WHERE g.organization_id=s.organization_id AND g.site_id=s.id LIMIT 1) AS gsc_property_url,
        (SELECT g.permission_level FROM seo_gsc_connections g WHERE g.organization_id=s.organization_id AND g.site_id=s.id LIMIT 1) AS gsc_permission_level,
        (SELECT g.index_verdict FROM seo_gsc_connections g WHERE g.organization_id=s.organization_id AND g.site_id=s.id LIMIT 1) AS gsc_index_verdict,
        (SELECT g.coverage_state FROM seo_gsc_connections g WHERE g.organization_id=s.organization_id AND g.site_id=s.id LIMIT 1) AS gsc_coverage_state,
        (SELECT g.last_synced_at FROM seo_gsc_connections g WHERE g.organization_id=s.organization_id AND g.site_id=s.id LIMIT 1) AS gsc_last_synced_at,
        (SELECT COALESCE(SUM(m.clicks),0) FROM seo_gsc_daily_metrics m WHERE m.organization_id=s.organization_id AND m.site_id=s.id AND m.metric_date>=CURDATE()-INTERVAL 28 DAY) AS gsc_clicks_28d,
        (SELECT COALESCE(SUM(m.impressions),0) FROM seo_gsc_daily_metrics m WHERE m.organization_id=s.organization_id AND m.site_id=s.id AND m.metric_date>=CURDATE()-INTERVAL 28 DAY) AS gsc_impressions_28d,
        (SELECT CASE WHEN SUM(m.impressions)>0 THEN SUM(m.clicks)/SUM(m.impressions) ELSE 0 END FROM seo_gsc_daily_metrics m WHERE m.organization_id=s.organization_id AND m.site_id=s.id AND m.metric_date>=CURDATE()-INTERVAL 28 DAY) AS gsc_ctr_28d,
        (SELECT CASE WHEN SUM(m.impressions)>0 THEN SUM(m.position*m.impressions)/SUM(m.impressions) ELSE NULL END FROM seo_gsc_daily_metrics m WHERE m.organization_id=s.organization_id AND m.site_id=s.id AND m.metric_date>=CURDATE()-INTERVAL 28 DAY) AS gsc_position_28d
        ,(SELECT j.id FROM seo_scan_jobs j WHERE j.organization_id=s.organization_id AND j.site_id=s.id AND j.status IN ('queued','running') ORDER BY j.id DESC LIMIT 1) AS active_scan_id
        FROM seo_sites s WHERE s.organization_id=? AND s.status<>'archived' ORDER BY s.created_at DESC`, [org.id]);
      const intervalHours = Math.max(0, Number(org.entitlements.scan_interval_hours || 0));
      return success(res, { organization: org, scan_policy: { interval_hours: intervalHours }, sites: rows.map(row => ({
        ...row,
        last_score: normalizeLegacyScoreModel(row).score,
        last_score_model: normalizeLegacyScoreModel(row),
        next_manual_scan_at: intervalHours && row.last_scan_at ? new Date(new Date(row.last_scan_at).getTime() + intervalHours * 3600000) : null,
      })) });
    } catch (err) { return error(res, '获取站点失败', 500); }
  }

  async refreshAuthority(req, res) {
    try {
      const org = await getOrganization(req.user);
      const [site] = await query("SELECT id,normalized_host,last_score_model FROM seo_sites WHERE id=? AND organization_id=? AND status='active'", [req.params.id, org.id]);
      if (!site) return error(res, '站点不存在', 404);
      const authority = await fetchAhrefsAuthority(site.normalized_host);
      const model = normalizeLegacyScoreModel(site);
      model.authorityStatus = authority.status;
      model.authorityMessage = authority.message || null;
      model.authorityFetchedAt = authority.fetched_at || (authority.domain_rating != null ? new Date().toISOString() : null);
      model.dimensions = { ...(model.dimensions || {}), backlink_authority:authority.domain_rating };

      if (authority.domain_rating == null) {
        model.status = 'limited';
        model.coverage = 66;
        model.score = null;
        model.missingDimensions = ['backlink_authority'];
        await query('UPDATE seo_sites SET last_score=NULL,last_score_model=? WHERE id=? AND organization_id=?', [JSON.stringify(model),site.id,org.id]);
        await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
          VALUES(?,?,'site.authority.refresh','seo_site',?,'failure',?,?)`, [org.id,req.user.id,site.id,JSON.stringify({provider:'ahrefs',status:authority.status,message:authority.message}),req.ip]);
        const statusCode = authority.status === 'not_configured' ? 409 : authority.status === 'auth_error' ? 422 : authority.status === 'rate_limited' ? 429 : 502;
        return res.status(statusCode).json({ success:false, code:`AHREFS_${authority.status.toUpperCase()}`, message:authority.message || '外链权威读取失败', data:{ authority_status:authority.status } });
      }

      const onsiteScore = Number(model.onsiteScore);
      if (!Number.isFinite(onsiteScore)) return error(res, '请先完成一次站内扫描，再刷新外链权威', 409);
      const completeScore = Math.round((onsiteScore + authority.domain_rating * 0.34) * 10) / 10;
      model.status = 'complete';
      model.coverage = 100;
      model.score = completeScore;
      model.missingDimensions = [];

      await transaction(async connection => {
        const [scans] = await connection.query("SELECT id FROM seo_scan_jobs WHERE organization_id=? AND site_id=? AND status='completed' ORDER BY id DESC LIMIT 1", [org.id,site.id]);
        const latestScan = scans[0];
        if (latestScan) {
          const [pages] = await connection.query('SELECT id,facts FROM seo_pages WHERE organization_id=? AND site_id=? AND scan_id=?', [org.id,site.id,latestScan.id]);
          for (const page of pages) {
            let facts = page.facts;
            try { if (typeof facts === 'string') facts = JSON.parse(facts || '{}'); } catch { facts = {}; }
            const pageModel = facts?.score_model || {};
            const pageOnsite = Number(pageModel.onsiteScore ?? pageModel.internalScore);
            pageModel.authorityStatus = authority.status;
            pageModel.authorityMessage = authority.message || null;
            pageModel.dimensions = { ...(pageModel.dimensions || {}), backlink_authority:authority.domain_rating };
            pageModel.coverage = 100;
            pageModel.status = 'complete';
            pageModel.score = Number.isFinite(pageOnsite) ? Math.round((pageOnsite + authority.domain_rating * 0.34) * 10) / 10 : null;
            facts.score_model = pageModel;
            await connection.query('UPDATE seo_pages SET facts=? WHERE id=? AND organization_id=?', [JSON.stringify(facts),page.id,org.id]);
          }
          await connection.query('UPDATE seo_scan_jobs SET score=? WHERE id=? AND organization_id=?', [completeScore,latestScan.id,org.id]);
        }
        await connection.query('UPDATE seo_sites SET last_score=?,last_score_model=? WHERE id=? AND organization_id=?', [completeScore,JSON.stringify(model),site.id,org.id]);
        await connection.query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
          VALUES(?,?,'site.authority.refresh','seo_site',?,'success',?,?)`, [org.id,req.user.id,site.id,JSON.stringify({provider:'ahrefs',status:authority.status,domain_rating:authority.domain_rating,score:completeScore}),req.ip]);
      });
      return success(res,{domain_rating:authority.domain_rating,authority_status:authority.status,score:completeScore,score_model:model},'外链权威已刷新并计入完整 SEO 分数');
    } catch (err) {
      logger.error('刷新外链权威失败',{site_id:req.params.id,error:err.message});
      return error(res,err.message || '刷新外链权威失败',500);
    }
  }

  async syncGsc(req,res){
    try{
      const org=await getOrganization(req.user);
      const [connection]=await query(`SELECT g.*,s.base_url FROM seo_gsc_connections g JOIN seo_sites s ON s.id=g.site_id WHERE g.organization_id=? AND g.site_id=? AND g.status='active' AND s.status='active'`,[org.id,req.params.id]);
      if(!connection)return error(res,'该站点尚未连接 Google Search Console',404);
      const config=await getGoogleGscConfig();
      if(!config.clientId||!config.clientSecret)return error(res,'Google OAuth 配置不完整',503);
      const token=await refreshAccessToken(connection,config);
      const imported=await fetchPropertyData(token.accessToken,connection.property_url,connection.base_url);
      await saveGscImport({organizationId:org.id,siteId:connection.site_id,userId:req.user.id,propertyUrl:connection.property_url,permissionLevel:connection.permission_level,tokenEncrypted:token.encrypted,tokenExpiresAt:token.expiresAt,data:imported});
      await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address) VALUES(?,?,'site.gsc.sync','seo_site',?,'success',?,?)`,[org.id,req.user.id,connection.site_id,JSON.stringify({rows:imported.metrics.length,range:imported.range,index_verdict:imported.inspection?.verdict||null}),req.ip]);
      return success(res,{rows:imported.metrics.length,range:imported.range,index_verdict:imported.inspection?.verdict||null},'Search Console 数据同步完成');
    }catch(err){logger.warn('GSC 同步失败',{site_id:req.params.id,error:err.response?.data?.error?.message||err.message});await query("UPDATE seo_gsc_connections SET status='error',last_error=? WHERE organization_id=? AND site_id=?",[String(err.response?.data?.error?.message||err.message).slice(0,500),(await getOrganization(req.user)).id,req.params.id]).catch(()=>{});return error(res,err.message||'Search Console 同步失败',502)}
  }

  async disconnectGsc(req,res){
    try{const org=await getOrganization(req.user);const result=await transaction(async connection=>{const [updated]=await connection.query("UPDATE seo_gsc_connections SET status='disconnected',token_encrypted=?,token_expires_at=NULL,last_error=NULL WHERE organization_id=? AND site_id=? AND status<>'disconnected'",[encryptCredentials({disconnected:true}),org.id,req.params.id]);if(updated.affectedRows)await connection.query('DELETE FROM seo_gsc_daily_metrics WHERE organization_id=? AND site_id=?',[org.id,req.params.id]);return updated});if(!result.affectedRows)return error(res,'该站点没有活动的 Search Console 连接',404);await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address) VALUES(?,?,'site.gsc.disconnect','seo_site',?,'success',?,?)`,[org.id,req.user.id,req.params.id,JSON.stringify({metrics_deleted:true}),req.ip]);return success(res,null,'Search Console 已断开，已删除本地指标与令牌')}catch{return error(res,'断开 Search Console 失败',500)}
  }

  async createSite(req, res) {
    try {
      const org = await getOrganization(req.user);
      const [count] = await query("SELECT COUNT(*) AS total FROM seo_sites WHERE organization_id=? AND status<>'archived'", [org.id]);
      if (count.total >= Number(org.entitlements.sites || 1)) return error(res, `${org.plan_name}最多可添加 ${org.entitlements.sites} 个站点`, 403);
      const url = await assertPublicUrl(req.body.url);
      const baseUrl = `${url.protocol}//${url.host}/`;
      const name = String(req.body.name || url.hostname).trim().slice(0, 120);
      const token = crypto.randomBytes(24).toString('hex');
      const [archived] = await query("SELECT id FROM seo_sites WHERE organization_id=? AND normalized_host=? AND status='archived' LIMIT 1", [org.id, url.hostname.toLowerCase()]);
      if (archived) {
        await query("UPDATE seo_sites SET status='active',name=?,base_url=?,ownership_status='pending',verification_method=NULL,verified_at=NULL,sitemap_url=NULL,sitemap_discovered_at=NULL,verification_token=?,created_by=? WHERE id=? AND organization_id=?", [name, baseUrl, token, req.user.id, archived.id, org.id]);
        const [site] = await query('SELECT * FROM seo_sites WHERE id=? AND organization_id=?', [archived.id, org.id]);
        return success(res, site, '已恢复此前归档的站点，请重新验证或添加 Sitemap', 201);
      }
      const result = await query(`INSERT INTO seo_sites(organization_id,name,base_url,normalized_host,verification_token,created_by)
        VALUES(?,?,?,?,?,?)`, [org.id, name, baseUrl, url.hostname.toLowerCase(), token, req.user.id]);
      const [site] = await query('SELECT * FROM seo_sites WHERE id=? AND organization_id=?', [result.insertId, org.id]);
      const detected = await detectSiteLanguages(site).catch(() => ({ primary: null, languages: [], source: 'pending', confidence: 0 }));
      const language = req.body.language && req.body.language !== 'auto' ? { primary: String(req.body.language).slice(0, 35), languages: [...new Set([String(req.body.language), ...detected.languages])], source: 'manual', confidence: 1 } : detected;
      await query('UPDATE seo_sites SET primary_language=?,detected_languages=?,language_source=?,language_confidence=? WHERE id=? AND organization_id=?', [language.primary, JSON.stringify(language.languages), language.source, language.confidence, site.id, org.id]);
      Object.assign(site, { ...language, detected_languages: language.languages });
      return success(res, site, '站点已添加，可以开始首次审计', 201);
    } catch (err) {
      logger.error('添加 SEO 站点失败', { error: err.message });
      if (err.code === 'ER_DUP_ENTRY') return error(res, '该站点已在当前工作区中', 409);
      return error(res, err.message || '添加站点失败', 400);
    }
  }

  async deleteSite(req,res){
    try{const org=await getOrganization(req.user);const [site]=await query("SELECT id,name,normalized_host,status FROM seo_sites WHERE id=? AND organization_id=? AND status<>'archived'",[req.params.id,org.id]);if(!site)return error(res,'站点不存在或已删除',404);await query("UPDATE seo_sites SET status='archived' WHERE id=? AND organization_id=?",[site.id,org.id]);await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address) VALUES(?,?,'site.archive','seo_site',?,'success',?,?)`,[org.id,req.user.id,site.id,JSON.stringify({name:site.name,host:site.normalized_host}),req.ip]);return success(res,{id:site.id,status:'archived'},'站点已删除（历史数据已保留）')}catch(e){logger.error('删除 SEO 站点失败',{error:e.message});return error(res,'删除站点失败',500)}
  }

  async verifySite(req, res) {
    try {
      const org = await getOrganization(req.user);
      const [site] = await query("SELECT * FROM seo_sites WHERE id=? AND organization_id=? AND status='active'", [req.params.id, org.id]);
      if (!site) return error(res, '站点不存在', 404);
      const method = await verifyOwnership(site, req.body?.method || null);
      const sitemap = await discoverSitemap(site);
      await query(`UPDATE seo_sites SET ownership_status='verified',verification_method=?,verified_at=NOW(),
        sitemap_url=?,sitemap_discovered_at=NOW() WHERE id=? AND organization_id=?`,
      [method, sitemap.sitemapUrl, site.id, org.id]);
      await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
        VALUES(?,?,'site.verify','seo_site',?,'success',?,?)`,
      [org.id,req.user.id,site.id,JSON.stringify({method,sitemap_url:sitemap.sitemapUrl,pages_discovered:sitemap.locations.length}),req.ip]);
      return success(res,{ method, sitemap_url:sitemap.sitemapUrl, pages_discovered:sitemap.locations.length, language:{primary:site.primary_language,detected:site.detected_languages,source:site.language_source,confidence:site.language_confidence} },'站点所有权验证成功');
    } catch (err) {
      logger.warn('站点所有权验证失败', { site_id:req.params.id,error:err.message });
      return error(res,err.message || '所有权验证失败',422);
    }
  }

  async scanSite(req, res) {
    let scanId;
    try {
      const org = await getOrganization(req.user);
      const [site] = await query("SELECT * FROM seo_sites WHERE id=? AND organization_id=? AND status='active'", [req.params.id, org.id]);
      if (!site) return error(res, '站点不存在', 404);
      const configuredSitemaps = await query('SELECT id,url FROM seo_sitemaps WHERE organization_id=? AND site_id=? ORDER BY id', [org.id, site.id]);
      if (site.ownership_status !== 'verified' && !configuredSitemaps.length && !site.sitemap_url && !req.body?.sitemap_url) return error(res, '请先添加 Sitemap 或完成所有权验证', 403);
      const intervalHours = Math.max(0, Number(org.entitlements.scan_interval_hours || 0));
      if (intervalHours && site.last_scan_at) {
        const nextScanAt = new Date(new Date(site.last_scan_at).getTime() + intervalHours * 3600000);
        if (nextScanAt > new Date()) {
          const message = `${org.plan_name}扫描间隔为 ${intervalHours >= 24 ? `${intervalHours / 24} 天` : `${intervalHours} 小时`}，下次可扫描时间：${nextScanAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`;
          return res.status(409).json({ success:false, code:'SCAN_INTERVAL', message, data:{ interval_hours:intervalHours, retry_at:nextScanAt.toISOString(), retry_after_seconds:Math.ceil((nextScanAt.getTime()-Date.now())/1000) } });
        }
      }
      const [monthly] = await query(`SELECT COALESCE(SUM(quantity),0) AS used FROM usage_ledgers WHERE organization_id=? AND metric='crawl_page'
        AND status='settled' AND created_at>=DATE_FORMAT(NOW(),'%Y-%m-01')`, [org.id]);
      if (monthly.used >= Number(org.entitlements.crawl_pages_monthly)) return error(res, '本月抓取额度已用完', 403);
      const reservation = await transaction(async connection => {
        await connection.query('SELECT id FROM seo_sites WHERE id=? AND organization_id=? FOR UPDATE', [site.id, org.id]);
        const [runningRows] = await connection.query("SELECT id,started_at FROM seo_scan_jobs WHERE organization_id=? AND site_id=? AND status IN ('queued','running') ORDER BY id DESC LIMIT 1", [org.id, site.id]);
        if (runningRows[0]) return { running: runningRows[0] };
        const [inserted] = await connection.query(`INSERT INTO seo_scan_jobs(organization_id,site_id,status,started_at,created_by)
          VALUES(?,?,'running',NOW(),?)`, [org.id, site.id, req.user.id]);
        return { insertId: inserted.insertId };
      });
      if (reservation.running) return res.status(409).json({ success:false, code:'SCAN_IN_PROGRESS', message:'该站点已有扫描任务正在运行，请等待完成后再试', data:{ scan_id:reservation.running.id, started_at:reservation.running.started_at } });
      scanId = reservation.insertId;
      const sitemapSources = req.body?.sitemap_url
        ? [{ id:null, url:String(req.body.sitemap_url).trim() }]
        : (configuredSitemaps.length ? configuredSitemaps : [{ id:null, url:site.sitemap_url }]);
      const sitemapResults = await Promise.all(sitemapSources.map(async source => {
        try {
          const result = await discoverSitemap({ ...site, sitemap_url:source.url });
          if (source.id) await query("UPDATE seo_sitemaps SET page_count=?,status='active',last_error=NULL,last_fetched_at=NOW() WHERE id=? AND organization_id=?", [result.locations.length, source.id, org.id]);
          return result;
        } catch (err) {
          if (source.id) await query("UPDATE seo_sitemaps SET status='error',last_error=?,last_fetched_at=NOW() WHERE id=? AND organization_id=?", [String(err.message).slice(0,500), source.id, org.id]);
          return { sitemapUrl:source.url, locations:[] };
        }
      }));
      const sitemap = { sitemapUrl:sitemapResults[0]?.sitemapUrl || null, locations:[...new Set(sitemapResults.flatMap(item => item.locations || []))] };
      const allowedPages = Math.max(1, Math.min(
        Number(org.entitlements.pages_per_scan || 100),
        Number(org.entitlements.crawl_pages_monthly || 500) - Number(monthly.used)
      ));
      const siteHost = new URL(site.base_url).hostname;
      const urls = [...new Set(sitemap.locations)]
        .filter(item => { try { return new URL(item).hostname === siteHost; } catch { return false; } })
        .slice(0, allowedPages);
      if (!urls.length) urls.push(site.base_url);
      const factsList = [];
      for (let offset=0; offset<urls.length; offset+=5) {
        const batch = await Promise.all(urls.slice(offset,offset+5).map(async url => {
          try { return await inspectPage(url); } catch (scanError) {
            return { finalUrl:url,httpStatus:null,responseTime:null,htmlBytes:null,title:'',description:'',canonical:'',
              h1Count:0,imageCount:0,missingAlt:0,hasSchema:false,hasRobots:false,score:0,score_model:{version:'three-pillar-seo-v1',coverage:66,status:'incomplete',dimensions:{technical:0,content:0}},
              issues:[{rule_code:'crawl-failed',category:'technical',severity:'critical',title:'页面抓取失败',
                evidence:String(scanError.message).slice(0,500),recommendation:'检查页面可访问性、DNS、证书和响应时间后重试。'}] };
          }
        }));
        factsList.push(...batch);
      }
      const issueTotal = factsList.reduce((sum,facts)=>sum+facts.issues.length,0);
      const score = null;
      const dimensionScores = ['technical_structure','content_structure'].reduce((out, key) => { out[key] = Math.round(factsList.reduce((s,f) => s + Number(f.score_model?.dimensions?.[key] || 0), 0) / factsList.length * 10) / 10; return out; }, {});
      const authority = await fetchAhrefsAuthority(site.normalized_host);
      dimensionScores.backlink_authority = authority.domain_rating;
      const onsiteScore = Math.round(factsList.reduce((sum,facts)=>sum+Number(facts.score_model?.onsiteScore||0),0)/factsList.length*10)/10;
      const completeScore = authority.domain_rating == null ? null : Math.round((onsiteScore + authority.domain_rating * 0.34) * 10) / 10;
      await transaction(async connection => {
        await connection.query("DELETE FROM seo_issues WHERE organization_id=? AND site_id=? AND status IN ('open','in_progress')", [org.id, site.id]);
        for (const facts of factsList) {
          if (facts.score_model) { facts.score_model.dimensions = {...(facts.score_model.dimensions||{}), backlink_authority:authority.domain_rating}; facts.score_model.authorityStatus=authority.status; facts.score_model.coverage=authority.domain_rating==null?66:100; facts.score_model.score=authority.domain_rating==null?null:Math.round((Number(facts.score_model.onsiteScore||0)+authority.domain_rating*0.34)*10)/10; }
          const [page] = await connection.query(`INSERT INTO seo_pages
          (organization_id,site_id,scan_id,url,http_status,title,meta_description,canonical_url,h1_count,image_count,
          image_missing_alt_count,has_schema,has_robots_meta,response_time_ms,content_bytes,facts)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [org.id,site.id,scanId,facts.finalUrl,facts.httpStatus,facts.title,
          facts.description,facts.canonical,facts.h1Count,facts.imageCount,facts.missingAlt,facts.hasSchema?1:0,
          facts.hasRobots?1:0,facts.responseTime,facts.htmlBytes,JSON.stringify({
            scanned_at:new Date().toISOString(),
            body_chars:facts.bodyChars ?? null,
            robots_noindex:facts.robotsNoindex ?? false,
            body_excerpt:facts.bodyExcerpt || '',
            headings:facts.headings || [],
            links:facts.links || [],
            schema:facts.schema || [],
            score_model:facts.score_model || null
          })]);
          for (const item of facts.issues) {
            await connection.query(`INSERT INTO seo_issues
            (organization_id,site_id,scan_id,page_id,rule_code,category,severity,title,evidence,recommendation)
            VALUES(?,?,?,?,?,?,?,?,?,?)`, [org.id,site.id,scanId,page.insertId,item.rule_code,item.category,item.severity,item.title,item.evidence,item.recommendation]);
          }
        }
        await connection.query(`UPDATE seo_scan_jobs SET status='completed',issue_count=?,
          score=?,completed_at=NOW(),pages_discovered=?,pages_scanned=? WHERE id=?`, [issueTotal,completeScore,sitemap.locations.length,factsList.length,scanId]);
        await connection.query(`UPDATE seo_sites SET sitemap_url=?,sitemap_discovered_at=NOW(),
          last_http_status=?,last_scan_at=NOW(),last_score=?,last_score_model=? WHERE id=? AND organization_id=?`,
        [sitemap.sitemapUrl,factsList[0].httpStatus,completeScore,JSON.stringify({version:'three-pillar-seo-v1',status:completeScore==null?'limited':'complete',coverage:completeScore==null?66:100,score:completeScore,onsiteScore,onsiteMaxScore:66,authorityStatus:authority.status,missingDimensions:completeScore==null?['backlink_authority']:[],weights:{technical_structure:33,content_structure:33,backlink_authority:34},dimensions:dimensionScores,confidence:Math.min(1, factsList.length/Math.max(1,sitemap.locations.length))}),site.id,org.id]);
        await connection.query(`INSERT INTO usage_ledgers(organization_id,user_id,metric,quantity,reference_type,reference_id,metadata)
          VALUES(?,?,'crawl_page',?,'scan',?,?)`, [org.id,req.user.id,factsList.length,scanId,JSON.stringify({ sitemap_url:sitemap.sitemapUrl,pages_discovered:sitemap.locations.length })]);
      });
      return success(res, { scan_id: scanId, score:completeScore, score_model:{ version:'three-pillar-seo-v1', status:completeScore==null?'limited':'complete', coverage:completeScore==null?66:100, score:completeScore, onsiteScore, onsiteMaxScore:66, authorityStatus:authority.status, dimensions:dimensionScores, confidence:Math.min(1, factsList.length/Math.max(1,sitemap.locations.length)) }, issues: issueTotal, pages_scanned:factsList.length,
        pages_discovered:sitemap.locations.length }, '站点审计已完成，已生成三维评分与页面证据');
    } catch (err) {
      if (scanId) await query("UPDATE seo_scan_jobs SET status='failed',error_message=?,completed_at=NOW() WHERE id=?", [String(err.message).slice(0,500),scanId]).catch(()=>{});
      logger.error('SEO 扫描失败', { error: err.message });
      return error(res, err.name === 'AbortError' ? '网站响应超时' : (err.message || '扫描失败'), 422);
    }
  }

  async addSitemap(req,res){
    try{const org=await getOrganization(req.user);const [site]=await query("SELECT * FROM seo_sites WHERE id=? AND organization_id=? AND status='active'",[req.params.id,org.id]);if(!site)return error(res,'站点不存在',404);const raw=String(req.body?.sitemap_url||'').trim();if(!raw)return error(res,'请输入 Sitemap 地址',400);const parsed=await assertPublicUrl(raw);if(parsed.hostname!==site.normalized_host)return error(res,'Sitemap 必须与当前站点使用同一域名',400);const found=await discoverSitemap({...site,sitemap_url:parsed.toString()});if(!found.locations.length)return error(res,'未发现可访问页面',422);const result=await query(`INSERT INTO seo_sitemaps(organization_id,site_id,url,page_count,status,last_fetched_at,created_by) VALUES(?,?,?,?,'active',NOW(),?) ON DUPLICATE KEY UPDATE page_count=VALUES(page_count),status='active',last_error=NULL,last_fetched_at=NOW()`,[org.id,site.id,parsed.toString(),found.locations.length,req.user.id]);await query('UPDATE seo_sites SET sitemap_url=COALESCE(sitemap_url,?),sitemap_discovered_at=NOW() WHERE id=? AND organization_id=?',[parsed.toString(),site.id,org.id]);await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address) VALUES(?,?,'site.sitemap.add','seo_site',?,'success',?,?)`,[org.id,req.user.id,site.id,JSON.stringify({sitemap_url:parsed.toString(),pages_discovered:found.locations.length,authorization_required:false}),req.ip]);return success(res,{id:result.insertId||null,sitemap_url:parsed.toString(),pages_discovered:found.locations.length,authorization_required:false},'Sitemap 已添加')}catch(e){if(e.code==='ER_DUP_ENTRY')return error(res,'该 Sitemap 已添加',409);return error(res,e.message||'添加 Sitemap 失败',422)}
  }

  async getSitemaps(req,res){try{const org=await getOrganization(req.user);const [site]=await query("SELECT id FROM seo_sites WHERE id=? AND organization_id=? AND status='active'",[req.params.id,org.id]);if(!site)return error(res,'站点不存在',404);return success(res,await query('SELECT id,url,page_count,status,last_error,last_fetched_at,created_at FROM seo_sitemaps WHERE organization_id=? AND site_id=? ORDER BY created_at DESC,id DESC',[org.id,site.id]))}catch(e){logger.error('获取 Sitemap 失败',{error:e.message});return error(res,'获取 Sitemap 失败',500)}}

  async deleteSitemap(req,res){try{const org=await getOrganization(req.user);const result=await query("DELETE sm FROM seo_sitemaps sm JOIN seo_sites s ON s.id=sm.site_id WHERE sm.id=? AND sm.site_id=? AND sm.organization_id=? AND s.status='active'",[req.params.sitemapId,req.params.id,org.id]);if(!result.affectedRows)return error(res,'Sitemap 不存在',404);const [next]=await query('SELECT url FROM seo_sitemaps WHERE site_id=? AND organization_id=? ORDER BY id LIMIT 1',[req.params.id,org.id]);await query('UPDATE seo_sites SET sitemap_url=? WHERE id=? AND organization_id=?',[next?.url||null,req.params.id,org.id]);return success(res,null,'Sitemap 已删除')}catch(e){logger.error('删除 Sitemap 失败',{error:e.message});return error(res,'删除 Sitemap 失败',500)}}

  async updateSchedule(req,res){
    try{const org=await getOrganization(req.user);const [site]=await query("SELECT id FROM seo_sites WHERE id=? AND organization_id=? AND status='active'",[req.params.id,org.id]);if(!site)return error(res,'站点不存在',404);const enabled=req.body?.enabled?1:0;const interval=Math.max(1,Number(org.entitlements.scan_interval_hours||24));await query('UPDATE seo_sites SET auto_scan_enabled=?,next_scan_at=CASE WHEN ?=1 THEN DATE_ADD(COALESCE(last_scan_at,NOW()),INTERVAL ? HOUR) ELSE NULL END WHERE id=? AND organization_id=?',[enabled,enabled,interval,site.id,org.id]);const [updated]=await query('SELECT auto_scan_enabled,next_scan_at FROM seo_sites WHERE id=? AND organization_id=?',[site.id,org.id]);return success(res,{enabled:!!updated.auto_scan_enabled,interval_hours:interval,next_scan_at:updated.next_scan_at||null},enabled?'定时扫描已开启':'定时扫描已关闭')}catch{return error(res,'更新定时扫描失败',500)}
  }

  async getScans(req, res) {
    try { const org=await getOrganization(req.user); const rows=await query(`SELECT j.*,s.name AS site_name,s.base_url,s.last_score_model FROM seo_scan_jobs j
      JOIN seo_sites s ON s.id=j.site_id WHERE j.organization_id=? AND s.status='active' ORDER BY j.created_at DESC LIMIT 100`,[org.id]); return success(res, rows); }
    catch { return error(res,'获取扫描记录失败',500); }
  }

  async getIssues(req, res) {
    try {
      const org=await getOrganization(req.user); const params=[org.id]; let where="i.organization_id=?";
      if(req.query.status){where+=' AND i.status=?';params.push(req.query.status)}
      if(req.query.severity){where+=' AND i.severity=?';params.push(req.query.severity)}
      return success(res,await query(`SELECT i.*,s.name AS site_name,p.url FROM seo_issues i JOIN seo_sites s ON s.id=i.site_id
        LEFT JOIN seo_pages p ON p.id=i.page_id WHERE ${where} AND s.status='active' ORDER BY FIELD(i.severity,'critical','high','medium','low'),i.created_at DESC LIMIT 300`,params));
    } catch { return error(res,'获取问题失败',500); }
  }

  async updateIssue(req,res){
    if(!['open','in_progress','resolved','ignored'].includes(req.body.status)) return error(res,'状态无效',400);
    try{const org=await getOrganization(req.user);const result=await query(`UPDATE seo_issues SET status=?,
      resolved_at=IF(?='resolved',NOW(),NULL) WHERE id=? AND organization_id=?`,[req.body.status,req.body.status,req.params.id,org.id]);
      if(!result.affectedRows)return error(res,'问题不存在',404);
      await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
        VALUES(?,?,'issue.status.update','seo_issue',?,'success',?,?)`,
      [org.id,req.user.id,req.params.id,JSON.stringify({status:req.body.status}),req.ip]);
      return success(res,null,'问题状态已更新');}
    catch{return error(res,'更新问题失败',500)}
  }

  async getPages(req, res) {
    try {
      const org = await getOrganization(req.user);
      const rows = await query(`SELECT p.id,p.site_id,p.scan_id,p.url,p.title,p.meta_description,p.http_status,p.h1_count,p.image_count,p.image_missing_alt_count,p.has_schema,p.has_robots_meta,p.response_time_ms,p.content_bytes,p.canonical_url,p.created_at,j.completed_at scan_completed_at,s.name site_name,
        JSON_UNQUOTE(JSON_EXTRACT(p.facts,'$.score_model.score')) page_score,
        JSON_UNQUOTE(JSON_EXTRACT(p.facts,'$.score_model.onsiteScore')) onsite_score,
        JSON_EXTRACT(p.facts,'$.score_model.dimensions') page_dimensions,
        JSON_UNQUOTE(JSON_EXTRACT(p.facts,'$.score_model.authorityStatus')) authority_status,
        JSON_UNQUOTE(JSON_EXTRACT(p.facts,'$.score_model.authorityMessage')) authority_message,
        JSON_UNQUOTE(JSON_EXTRACT(s.last_score_model,'$.authorityStatus')) site_authority_status,
        JSON_UNQUOTE(JSON_EXTRACT(s.last_score_model,'$.authorityMessage')) site_authority_message,
        JSON_EXTRACT(p.facts,'$.score_model.breakdown') score_breakdown,
        JSON_UNQUOTE(JSON_EXTRACT(p.facts,'$.body_chars')) body_chars,
        JSON_UNQUOTE(JSON_EXTRACT(p.facts,'$.robots_noindex')) robots_noindex,
        JSON_UNQUOTE(JSON_EXTRACT(p.facts,'$.score_model.coverage')) page_coverage
        FROM seo_pages p JOIN seo_sites s ON s.id=p.site_id JOIN seo_scan_jobs j ON j.id=p.scan_id
        WHERE p.organization_id=? AND s.status='active' AND p.scan_id=(SELECT MAX(p2.scan_id) FROM seo_pages p2 JOIN seo_sites s2 ON s2.id=p2.site_id WHERE p2.organization_id=p.organization_id AND s2.status='active' AND p2.site_id=p.site_id AND p2.url=p.url)
        ORDER BY p.created_at DESC,p.id DESC LIMIT 200`, [org.id]);
      return success(res, rows.map(row => {
        let dimensions = row.page_dimensions;
        try { if (Buffer.isBuffer(dimensions)) dimensions = dimensions.toString('utf8'); if (typeof dimensions === 'string') dimensions = JSON.parse(dimensions); } catch { dimensions = {}; }
        const recalculated=calculateSeoScores({httpStatus:Number(row.http_status),canonical:row.canonical_url||'',canonicalConflict:Boolean(row.canonical_url&&String(row.canonical_url).replace(/\/$/,'')!==String(row.url).replace(/\/$/,'')),hasRobots:Boolean(row.has_robots_meta),robotsNoindex:String(row.robots_noindex)==='true'||Number(row.robots_noindex)===1,responseTime:row.response_time_ms==null?null:Number(row.response_time_ms),title:row.title||'',description:row.meta_description||'',h1Count:Number(row.h1_count||0),bodyChars:row.body_chars==null?null:Number(row.body_chars),imageCount:Number(row.image_count||0),missingAlt:Number(row.image_missing_alt_count||0),hasSchema:Boolean(row.has_schema)});
        let breakdown=row.score_breakdown;try{if(Buffer.isBuffer(breakdown))breakdown=breakdown.toString('utf8');if(typeof breakdown==='string')breakdown=JSON.parse(breakdown)}catch{breakdown=[]}
        const domainRating = Number(dimensions?.backlink_authority);
        const hasAuthority = dimensions?.backlink_authority !== null && dimensions?.backlink_authority !== undefined && Number.isFinite(domainRating);
        const pageAuthorityStatus = row.authority_status && row.authority_status !== 'null' ? row.authority_status : null;
        const pageAuthorityMessage = row.authority_message && row.authority_message !== 'null' ? row.authority_message : null;
        const authorityStatus = !pageAuthorityStatus || pageAuthorityStatus === 'not_connected' ? (row.site_authority_status || pageAuthorityStatus || 'not_connected') : pageAuthorityStatus;
        return {...row,page_score:hasAuthority?Math.round((recalculated.onsiteScore+domainRating*0.34)*10)/10:null,onsite_score:recalculated.onsiteScore,page_dimensions:{...recalculated.dimensions,backlink_authority:hasAuthority?domainRating:null},authorityStatus,authorityMessage:pageAuthorityMessage||row.site_authority_message||null,score_breakdown:recalculated.breakdown,page_coverage:hasAuthority?100:recalculated.coverage,score_gates:recalculated.scoreGates};
      }));
    } catch { return error(res, '获取已扫描页面失败', 500); }
  }

  async getCandidates(req, res) {
    try {
      const org = await getOrganization(req.user);
      return success(res, await query(`SELECT c.*,p.url,s.name site_name FROM seo_change_candidates c
        JOIN seo_pages p ON p.id=c.page_id JOIN seo_sites s ON s.id=c.site_id
        WHERE c.organization_id=? ORDER BY c.created_at DESC,c.id DESC LIMIT 100`, [org.id]));
    } catch { return error(res, '获取候选失败', 500); }
  }

  async getPublishingWorkspace(req, res) {
    try {
      const org = await getOrganization(req.user);
      const [candidates,connectors,jobs] = await Promise.all([
        query(`SELECT c.id,c.site_id,c.page_id,c.candidate_title,c.candidate_description,c.status,c.approved_at,c.exported_at,c.created_at,
          p.url,s.name site_name FROM seo_change_candidates c JOIN seo_pages p ON p.id=c.page_id JOIN seo_sites s ON s.id=c.site_id
          WHERE c.organization_id=? AND c.status IN ('approved','exported','publishing','published','publish_failed') ORDER BY c.updated_at DESC,c.id DESC LIMIT 100`,[org.id]),
        query(`SELECT x.id,x.site_id,x.connector_type,x.endpoint,x.auth_type,x.status,x.last_test_status,x.last_test_at,x.reviewed_at,x.created_at,s.name site_name
          FROM seo_site_connectors x JOIN seo_sites s ON s.id=x.site_id WHERE x.organization_id=? ORDER BY x.updated_at DESC,x.id DESC`,[org.id]),
        query(`SELECT j.id,j.site_id,j.page_id,j.candidate_id,j.connector_id,j.status,j.remote_status,j.response_excerpt,j.verification,j.error_message,j.started_at,j.completed_at,
          s.name site_name,p.url FROM seo_publish_jobs j JOIN seo_sites s ON s.id=j.site_id JOIN seo_pages p ON p.id=j.page_id
          WHERE j.organization_id=? ORDER BY j.started_at DESC,j.id DESC LIMIT 100`,[org.id])
      ]);
      return success(res,{candidates,connectors,jobs,summary:{ready:candidates.filter(item=>['approved','exported','publish_failed'].includes(item.status)).length,running:candidates.filter(item=>item.status==='publishing').length,published:candidates.filter(item=>item.status==='published').length,failed:jobs.filter(item=>['failed','verification_failed'].includes(item.status)).length}});
    } catch (err) { logger.error('获取发布工作区失败',{error:err.message}); return error(res,'获取发布工作区失败',500); }
  }

  async generateMetadata(req, res) {
    try {
      const org = await getOrganization(req.user);
      const [page] = await query(`SELECT p.* FROM seo_pages p WHERE p.id=? AND p.organization_id=? LIMIT 1`, [req.body?.page_id, org.id]);
      if (!page) return error(res, '请选择当前组织中已完成扫描的页面', 404);
      const [usage] = await query(`SELECT COALESCE(SUM(quantity),0) used FROM usage_ledgers WHERE organization_id=?
        AND metric='ai_point' AND status='settled' AND created_at>=DATE_FORMAT(NOW(),'%Y-%m-01')`, [org.id]);
      const limit = Number(org.entitlements.ai_points_monthly || 0);
      if (Number(usage.used) + 1 > limit) return error(res, '本月 AI 算力不足，请升级套餐后重试', 403);
      const models = await query(`SELECT * FROM ai_models WHERE is_enabled=1 AND status='active'
        AND model_type='chat' AND api_url IS NOT NULL AND api_key IS NOT NULL
        AND api_url<>'' AND api_key<>'' ORDER BY is_default DESC,priority ASC,id ASC`);
      if (!models.length) return error(res, '当前没有可用的 AI 模型，请联系管理员', 503);
      let generated;
      let model;
      const upstreamErrors = [];
      for (const candidateModel of models) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            generated = await requestMetadataCandidate(candidateModel, page, { timeout: 90000 });
            model = candidateModel;
            break;
          } catch (err) {
            const status = err.response?.status || null;
            const code = err.response?.data?.error?.code || err.code || null;
            upstreamErrors.push({ model: candidateModel.model_code || candidateModel.model_name, status, code });
            logger.warn('元数据候选模型不可用，准备重试或切换模型', { model: candidateModel.model_code || candidateModel.model_name, attempt: attempt + 1, status, code, error: err.message });
            if (!isRetryableAiError(err) || attempt === 1) break;
            await wait(800);
          }
        }
        if (generated && model) break;
      }
      if (!generated || !model) {
        const last = upstreamErrors[upstreamErrors.length - 1] || {};
        const detail = last.status === 429 ? 'AI 服务当前繁忙，请稍后重试，本次未扣点' : 'AI 服务暂时不可用，本次未扣点';
        logger.error('所有元数据候选模型均不可用', { errors: upstreamErrors });
        return error(res, detail, 502);
      }
      const title = String(generated.title || '').trim().slice(0, 160);
      const description = String(generated.description || '').trim().slice(0, 500);
      const rationale = String(generated.rationale || '').trim().slice(0, 1000);
      if (!title || !description) return error(res, 'AI 候选缺少必要字段，本次未扣点', 502);
      const candidateId = await transaction(async connection => {
        const [result] = await connection.query(`INSERT INTO seo_change_candidates
          (organization_id,site_id,page_id,issue_id,original_title,original_description,candidate_title,candidate_description,
           rationale,evidence,model_code,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        [org.id,page.site_id,page.id,req.body?.issue_id || null,page.title,page.meta_description,title,description,rationale,
          JSON.stringify({ url:page.url,http_status:page.http_status,h1_count:page.h1_count,scan_id:page.scan_id }),model.model_code,req.user.id]);
        await connection.query(`INSERT INTO usage_ledgers(organization_id,user_id,metric,quantity,reference_type,reference_id,metadata)
          VALUES(?,?,'ai_point',1,'metadata_candidate',?,?)`, [org.id,req.user.id,result.insertId,JSON.stringify({model:model.model_code,page_id:page.id})]);
        await connection.query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
          VALUES(?,?,'metadata.candidate.generate','seo_change_candidate',?,'success',?,?)`,
        [org.id,req.user.id,result.insertId,JSON.stringify({page_id:page.id,model:model.model_code}),req.ip]);
        return result.insertId;
      });
      const [candidate] = await query('SELECT * FROM seo_change_candidates WHERE id=? AND organization_id=?', [candidateId, org.id]);
      return success(res, candidate, '元数据候选已生成');
    } catch (err) {
      logger.error('生成元数据候选失败', { error: err.message, status: err.response?.status, code: err.response?.data?.error?.code || err.code });
      return error(res, err.response ? 'AI 服务暂时不可用，本次未扣点' : (err.message || '生成失败'), 502);
    }
  }

  async analyzeFeature(req, res) {
    const allowed = ['content','internal-links','schema','geo'];
    if (!allowed.includes(req.params.module)) return error(res, '不支持的 SEO 分析模块', 400);
    try {
      const org = await getOrganization(req.user);
      const requested = String(req.body?.url || '').trim();
      const [page] = await query(`SELECT p.*,s.name site_name,s.base_url,s.normalized_host
        FROM seo_pages p JOIN seo_sites s ON s.id=p.site_id
        WHERE p.organization_id=? AND p.url=? AND s.status='active' LIMIT 1`, [org.id, requested]);
      if (!page) return error(res, '请输入当前工作区已扫描的页面 URL', 404);
      let facts = page.facts; try { if (typeof facts === 'string') facts = JSON.parse(facts); } catch { facts = {}; }
      const rawLinks = Array.isArray(facts.links) ? facts.links : [];
      const links = rawLinks.map(item => typeof item === 'string' ? {url:item,text:'',nofollow:false} : item).filter(item => item?.url);
      const bodyChars = Number(facts.body_chars ?? facts.bodyChars ?? 0);
      const headings = Array.isArray(facts.headings) ? facts.headings : [];
      const result = { module:req.params.module, url:page.url, page_id:page.id, site_id:page.site_id, site_name:page.site_name, analyzed_at:new Date().toISOString() };
      if (req.params.module === 'content') {
        const issues = await query(`SELECT title,evidence,recommendation,severity FROM seo_issues WHERE organization_id=? AND page_id=? AND status IN ('open','in_progress') ORDER BY FIELD(severity,'critical','high','medium','low')`,[org.id,page.id]);
        const recommendations = [];
        if (!page.title) recommendations.push('补充与页面主体一致的唯一 Title');
        if (!page.meta_description) recommendations.push('从页面已有事实中提炼 Meta Description');
        if (Number(page.h1_count)!==1) recommendations.push('将页面主标题整理为一个 H1');
        if (bodyChars<500) recommendations.push('补充能够回答目标用户核心问题的正文与事实依据');
        if (headings.filter(h=>h.level==='h2').length<2) recommendations.push('用 H2 建立清晰的问题与答案层级');
        result.summary={title:page.title||'',description:page.meta_description||'',h1_count:Number(page.h1_count||0),body_chars:bodyChars,headings,body_excerpt:String(facts.body_excerpt||'').slice(0,1200),issues,recommendations,brief:{page_url:page.url,primary_topic:page.title||headings[0]?.text||'',required_sections:headings.map(h=>h.text).slice(0,12),evidence_source:'最近一次真实页面扫描'}};
      }
      if (req.params.module === 'internal-links') {
        const outgoing=[]; const seen=new Set();
        for (const item of links) { try { const u=new URL(item.url,page.url); if(u.hostname!==page.normalized_host||u.toString().replace(/\/$/,'')===page.url.replace(/\/$/,'')||seen.has(u.toString())) continue; seen.add(u.toString()); outgoing.push({url:u.toString(),anchor:String(item.text||''),nofollow:Boolean(item.nofollow)}); } catch {} }
        const pages = await query(`SELECT p.url,p.title,p.facts FROM seo_pages p WHERE p.organization_id=? AND p.site_id=? AND p.scan_id=? AND p.id<>?`,[org.id,page.site_id,page.scan_id,page.id]);
        const linked=new Set(outgoing.map(item=>item.url.replace(/\/$/,'')));
        const sourceTerms=new Set(`${page.title||''} ${headings.map(h=>h.text).join(' ')}`.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>1));
        const opportunities=pages.map(target=>{ const terms=String(target.title||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>1); return {target_url:target.url,target_title:target.title||target.url,anchor_suggestion:target.title||'',relevance:terms.filter(w=>sourceTerms.has(w)).length}; }).filter(item=>!linked.has(item.target_url.replace(/\/$/,''))).sort((a,b)=>b.relevance-a.relevance).slice(0,10);
        result.links={outgoing,orphan:outgoing.length===0,opportunities,recommendation:opportunities.length?`发现 ${opportunities.length} 个尚未链接的同站页面，先审核相关性再添加自然锚文本`:(outgoing.length?'当前扫描范围内没有未链接页面':'该页面未发现同站出链')};
      }
      if (req.params.module === 'schema') {
        const schema=Array.isArray(facts.schema)?facts.schema:[];
        const validation=schema.map((block,index)=>({index:index+1,type:block?.['@type']||null,has_context:Boolean(block?.['@context']),valid:Boolean(block&&typeof block==='object'&&block['@context']&&block['@type']),missing:[!block?.['@context']?'@context':null,!block?.['@type']?'@type':null].filter(Boolean)}));
        const candidate={'@context':'https://schema.org','@type':'WebPage',url:page.url};
        if(page.title)candidate.name=page.title;
        if(page.meta_description)candidate.description=page.meta_description;
        result.schema={detected:schema,validation,valid:validation.length>0&&validation.every(item=>item.valid),missing:validation.length?validation.flatMap(item=>item.missing):['@context','@type'],candidate,recommendation:validation.length&&validation.every(item=>item.valid)?'现有 JSON-LD 基础语法完整，请继续核对实体字段与页面可见内容':'可审核下方仅由已扫描页面事实生成的 WebPage JSON-LD 候选'};
      }
      if (req.params.module === 'geo') {
        const [llms,robots]=await Promise.all([safeFetch(new URL('/llms.txt',page.base_url),{accept:'text/plain',maxBytes:256*1024}).catch(()=>null),safeFetch(new URL('/robots.txt',page.base_url),{accept:'text/plain',maxBytes:256*1024}).catch(()=>null)]);
        const llmsText=llms?.response?.ok?String(await llms.response.text()).slice(0,256000):'';
        const robotsText=robots?.response?.ok?String(await robots.response.text()).slice(0,256000):'';
        const agents=['GPTBot','Google-Extended','ClaudeBot','PerplexityBot'];
        const agentAccess=Object.fromEntries(agents.map(agent=>{ const section=(robotsText.match(new RegExp(`User-agent:\\s*${agent}([\\s\\S]*?)(?=User-agent:|$)`,'i'))||[])[1]||''; return [agent,!/Disallow:\s*\//i.test(section)]; }));
        const checks={indexable:!facts.robots_noindex,llms_available:Boolean(llmsText),llms_has_links:/https?:\/\//i.test(llmsText),has_schema:Boolean(page.has_schema),has_title:Boolean(page.title),substantial_content:bodyChars>=500,clear_headings:headings.length>=2};
        const passed=Object.values(checks).filter(Boolean).length;
        result.geo={llms_status:llms?.response?.status||0,llms_available:Boolean(llmsText),llms_excerpt:llmsText.slice(0,1000),robots_status:robots?.response?.status||0,agent_access:agentAccess,checks,score:Math.round(passed/Object.keys(checks).length*100),citation_ready:checks.indexable&&checks.has_title&&checks.substantial_content&&checks.clear_headings,recommendations:Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>({llms_available:'发布可访问的 /llms.txt',llms_has_links:'在 llms.txt 中列出重要内容的绝对 URL',has_schema:'补充与可见内容一致的结构化数据',has_title:'补充清晰页面标题',substantial_content:'增加可引用的事实性正文',clear_headings:'使用清晰的 H1/H2 内容层级',indexable:'移除页面 noindex 阻断'}[key]))};
      }
      await query(`INSERT INTO seo_feature_analyses(organization_id,site_id,page_id,module,result,created_by) VALUES(?,?,?,?,?,?)`,[org.id,page.site_id,page.id,req.params.module,JSON.stringify(result),req.user.id]);
      result.history = await query(`SELECT id,created_at FROM seo_feature_analyses WHERE organization_id=? AND page_id=? AND module=? ORDER BY id DESC LIMIT 10`,[org.id,page.id,req.params.module]);
      return success(res,result,'分析完成');
    } catch (err) { logger.error('SEO 功能分析失败',{module:req.params.module,error:err.message}); return error(res,'分析失败，请先完成该页面扫描',500); }
  }

  async reviewCandidate(req, res) {
    const status = req.body?.status;
    if (!['approved','rejected'].includes(status)) return error(res, '审核状态无效', 400);
    try {
      const org = await getOrganization(req.user);
      const result = await query(`UPDATE seo_change_candidates SET status=?,approved_by=?,approved_at=NOW()
        WHERE id=? AND organization_id=? AND status='draft'`, [status,req.user.id,req.params.id,org.id]);
      if (!result.affectedRows) return error(res, '候选不存在或已审核', 409);
      await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
        VALUES(?,?,'metadata.candidate.review','seo_change_candidate',?,'success',?,?)`,
      [org.id,req.user.id,req.params.id,JSON.stringify({status}),req.ip]);
      return success(res, null, status === 'approved' ? '候选已批准' : '候选已拒绝');
    } catch { return error(res, '审核候选失败', 500); }
  }

  async exportCandidate(req, res) {
    try {
      const org = await getOrganization(req.user);
      const [candidate] = await query(`SELECT c.*,p.url FROM seo_change_candidates c JOIN seo_pages p ON p.id=c.page_id
        WHERE c.id=? AND c.organization_id=? AND c.status IN ('approved','exported')`, [req.params.id,org.id]);
      if (!candidate) return error(res, '请先批准候选后再导出', 409);
      if (candidate.status !== 'exported') await transaction(async connection => {
        await connection.query("UPDATE seo_change_candidates SET status='exported',exported_at=NOW() WHERE id=? AND organization_id=?", [candidate.id,org.id]);
        if (candidate.issue_id) await connection.query("UPDATE seo_issues SET status='resolved',resolved_at=NOW() WHERE organization_id=? AND id=? AND status IN ('open','in_progress')", [org.id,candidate.issue_id]);
        await connection.query(`INSERT INTO usage_ledgers(organization_id,user_id,metric,quantity,reference_type,reference_id)
          VALUES(?,?,'export',1,'metadata_candidate',?)`, [org.id,req.user.id,candidate.id]);
        await connection.query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
          VALUES(?,?,'metadata.candidate.export','seo_change_candidate',?,'success',?,?)`,
        [org.id,req.user.id,candidate.id,JSON.stringify({page_id:candidate.page_id}),req.ip]);
      });
      return success(res, { url:candidate.url,title:candidate.candidate_title,description:candidate.candidate_description });
    } catch { return error(res, '导出候选失败', 500); }
  }

  async checkPublishCandidate(req, res) {
    let publishJobId;
    try {
      const org = await getOrganization(req.user);
      const [candidate] = await query(`SELECT c.id,c.site_id,c.page_id,c.issue_id,c.candidate_title,c.candidate_description,c.status,p.url,s.normalized_host
        FROM seo_change_candidates c JOIN seo_pages p ON p.id=c.page_id JOIN seo_sites s ON s.id=c.site_id
        WHERE c.id=? AND c.organization_id=? AND c.status IN ('approved','exported','publish_failed')`, [req.params.id, org.id]);
      if (!candidate) return error(res, '只有已批准、已导出或发布失败的候选可以进入发布流程', 409);
      const [connector] = await query(`SELECT * FROM seo_site_connectors WHERE organization_id=? AND site_id=? AND status='active'
        AND last_test_status BETWEEN 200 AND 299 ORDER BY last_test_at DESC,id DESC LIMIT 1`, [org.id,candidate.site_id]);
      if (!connector) return error(res, '当前站点没有通过健康检查的可写连接器，请先在“连接网站”中配置并测试', 409);
      const locked = await query("UPDATE seo_change_candidates SET status='publishing' WHERE id=? AND organization_id=? AND status IN ('approved','exported','publish_failed')", [candidate.id,org.id]);
      if (!locked.affectedRows) return error(res, '该候选正在发布或状态已变化', 409);
      const job = await query(`INSERT INTO seo_publish_jobs(organization_id,site_id,page_id,candidate_id,connector_id,created_by)
        VALUES(?,?,?,?,?,?)`, [org.id,candidate.site_id,candidate.page_id,candidate.id,connector.id,req.user.id]);
      publishJobId = job.insertId;
      const response = await callConnector(connector,candidate.normalized_host,{ action:'update_metadata',candidate_id:candidate.id,url:candidate.url,title:candidate.candidate_title,meta_description:candidate.candidate_description });
      const excerpt = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || {});
      if (response.status < 200 || response.status >= 300) throw Object.assign(new Error(`连接器返回 HTTP ${response.status}`),{remoteStatus:response.status,responseExcerpt:excerpt});
      const inspected = await inspectPage(candidate.url);
      const verification = { url:candidate.url,http_status:inspected.httpStatus,title_match:inspected.title===candidate.candidate_title,description_match:inspected.description===candidate.candidate_description,actual_title:inspected.title,actual_description:inspected.description };
      if (!verification.title_match || !verification.description_match) {
        await transaction(async connection => {
          await connection.query("UPDATE seo_publish_jobs SET status='verification_failed',remote_status=?,response_excerpt=?,verification=?,error_message='写入接口成功，但页面复扫未匹配候选',completed_at=NOW() WHERE id=?", [response.status,excerpt.slice(0,1000),JSON.stringify(verification),publishJobId]);
          await connection.query("UPDATE seo_change_candidates SET status='publish_failed' WHERE id=? AND organization_id=?", [candidate.id,org.id]);
        });
        return error(res,'连接器已接收修改，但原页面复扫未验证生效，请检查缓存或连接器实现',502,{publish_job_id:publishJobId,verification});
      }
      await transaction(async connection => {
        await connection.query("UPDATE seo_publish_jobs SET status='published',remote_status=?,response_excerpt=?,verification=?,completed_at=NOW() WHERE id=?", [response.status,excerpt.slice(0,1000),JSON.stringify(verification),publishJobId]);
        await connection.query("UPDATE seo_change_candidates SET status='published' WHERE id=? AND organization_id=?", [candidate.id,org.id]);
        if (candidate.issue_id) await connection.query("UPDATE seo_issues SET status='resolved',resolved_at=NOW() WHERE id=? AND organization_id=?", [candidate.issue_id,org.id]);
        await connection.query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
          VALUES(?,?,'metadata.candidate.publish','seo_change_candidate',?,'success',?,?)`, [org.id,req.user.id,candidate.id,JSON.stringify({publish_job_id:publishJobId,connector_id:connector.id,url:candidate.url,verification}),req.ip]);
      });
      return success(res,{publish_job_id:publishJobId,status:'published',verification},'发布并复扫验证成功');
    } catch (err) {
      if (publishJobId) await query("UPDATE seo_publish_jobs SET status='failed',remote_status=?,response_excerpt=?,error_message=?,completed_at=NOW() WHERE id=?", [err.remoteStatus||null,String(err.responseExcerpt||'').slice(0,1000),String(err.message||'发布失败').slice(0,500),publishJobId]).catch(()=>{});
      await query("UPDATE seo_change_candidates SET status='publish_failed' WHERE id=? AND status='publishing'", [req.params.id]).catch(()=>{});
      logger.error('发布候选失败',{candidate_id:req.params.id,error:err.message});
      return error(res,err.message||'发布检查失败',502);
    }
  }

  async simulatePublishCandidate(req, res) { return this.checkPublishCandidate(req, res); }

  async requestConnection(req, res) {
    const allowed = ['wordpress', 'rest', 'webhook'];
    if (!allowed.includes(req.body?.connector_type)) return error(res, '不支持的接入类型', 400);
    try {
      const org = await getOrganization(req.user);
      const [site] = await query("SELECT id,name,normalized_host,ownership_status FROM seo_sites WHERE id=? AND organization_id=? AND status='active'", [req.params.id, org.id]);
      if (!site) return error(res, '站点不存在', 404);
      if (site.ownership_status !== 'verified') return error(res, '请先完成站点所有权验证，再申请接入修改', 403);
      const authType = ['none','bearer','basic','hmac'].includes(req.body?.auth_type) ? req.body.auth_type : 'none';
      const endpoint = await validateConnectorEndpoint(String(req.body?.endpoint||'').trim(),site.normalized_host);
      const credentials = authType==='bearer' ? {token:String(req.body?.token||'').trim()} : authType==='basic' ? {username:String(req.body?.username||'').trim(),password:String(req.body?.password||'')} : authType==='hmac' ? {secret:String(req.body?.secret||'')} : {};
      if (authType==='bearer'&&!credentials.token || authType==='basic'&&(!credentials.username||!credentials.password) || authType==='hmac'&&!credentials.secret) return error(res,'请填写完整的连接器授权凭据',400);
      const [existing] = await query(`SELECT id,details,created_at FROM audit_logs
        WHERE organization_id=? AND resource_type='seo_site' AND resource_id=? AND action='site.connection.request'
          AND JSON_UNQUOTE(JSON_EXTRACT(details,'$.status'))='pending' ORDER BY id DESC LIMIT 1`, [org.id, site.id]);
      if (existing) return success(res, { site_id: site.id, status: 'pending', request_id: existing.id }, '该站点已有待审核接入申请');
      const connector = await query(`INSERT INTO seo_site_connectors(organization_id,site_id,connector_type,endpoint,auth_type,credentials_encrypted,created_by)
        VALUES(?,?,?,?,?,?,?)`, [org.id,site.id,req.body.connector_type,endpoint,authType,encryptCredentials(credentials),req.user.id]);
      const details = { connector_id:connector.insertId,connector_type:req.body.connector_type,endpoint,auth_type:authType,status:'pending',requested_at:new Date().toISOString() };
      await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
        VALUES(?,?,'site.connection.request','seo_site',?,'success',?,?)`, [org.id, req.user.id, site.id, JSON.stringify(details), req.ip]);
      return success(res, { site_id:site.id,connector_id:connector.insertId,status:'pending',connector_type:details.connector_type }, '接入申请已记录，等待管理员审核');
    } catch(err) { return error(res, err.message||'提交接入申请失败', 400); }
  }

  async testConnection(req, res) {
    try {
      const org = await getOrganization(req.user);
      const [site] = await query("SELECT id,normalized_host,ownership_status FROM seo_sites WHERE id=? AND organization_id=? AND status='active'", [req.params.id, org.id]);
      if (!site) return error(res, '站点不存在', 404);
      if (site.ownership_status !== 'verified') return error(res, '请先完成所有权验证', 403);
      const [request] = await query(`SELECT details FROM audit_logs WHERE organization_id=? AND resource_type='seo_site' AND resource_id=?
        AND action='site.connection.request' AND JSON_UNQUOTE(JSON_EXTRACT(details,'$.review_status'))='approved' ORDER BY id DESC LIMIT 1`, [org.id, site.id]);
      if (!request) return error(res, '请先获得管理员批准', 403);
      let details=request.details;try{if(typeof details==='string')details=JSON.parse(details)}catch{details={}};
      const [connector] = await query("SELECT * FROM seo_site_connectors WHERE id=? AND organization_id=? AND site_id=? AND status='active'", [details.connector_id,org.id,site.id]);
      if (!connector) return error(res,'已批准的连接器不存在或未启用',404);
      const response=await callConnector(connector,site.normalized_host,{action:'health_check',site_id:site.id});
      const ok=response.status>=200&&response.status<300;
      await query('UPDATE seo_site_connectors SET last_test_status=?,last_test_at=NOW() WHERE id=? AND organization_id=?',[response.status,connector.id,org.id]);
      await query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address) VALUES(?,?,'site.connection.test','seo_site',?,?,?,?)`, [org.id,req.user.id,site.id,ok?'success':'failure',JSON.stringify({connector_id:connector.id,endpoint:connector.endpoint,status:response.status}),req.ip]);
      return ok?success(res,{status:response.status,endpoint:connector.endpoint},'连接测试通过'):error(res,`连接返回 HTTP ${response.status}`,502);
    } catch(err) { return error(res, err.code==='ERR_INVALID_URL'?'连接地址无效':'连接测试失败',400); }
  }
}
module.exports = new SeoWorkspaceController();
