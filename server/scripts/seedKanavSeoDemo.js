/*
 * Seed a Kanav SEO demo workspace from a real crawl.
 * Usage: node server/scripts/seedKanavSeoDemo.js <user_id> [base_url]
 * The crawl facts are real; connector approval and publish records are demo-only.
 */
require('dotenv').config();
const crypto = require('crypto');
const { query, transaction } = require('../config/database');
const { assertPublicUrl, inspectPage, discoverSitemap } = require('../services/seoSiteService');

async function main() {
  const userId = Number(process.argv[2]);
  const inputUrl = process.argv[3] || 'https://av-web-client.test4.cc/';
  if (!Number.isInteger(userId) || userId <= 0) throw new Error('请提供有效的 user_id');
  const url = await assertPublicUrl(inputUrl);
  const baseUrl = `${url.protocol}//${url.host}/`;
  const host = url.hostname.toLowerCase();
  const facts = await inspectPage(baseUrl);
  const sitemap = await discoverSitemap({ base_url: baseUrl });

  await transaction(async connection => {
    const [orgRows] = await connection.query(
      'SELECT o.id FROM organizations o WHERE o.owner_user_id=? AND o.status<>\'archived\' ORDER BY o.id LIMIT 1', [userId]);
    let orgId = orgRows[0]?.id;
    if (!orgId) {
      const slug = `kanav-demo-${userId}-${Date.now().toString(36)}`;
      const [org] = await connection.query('INSERT INTO organizations(name,slug,owner_user_id) VALUES(?,?,?)', ['Kanav SEO 演示工作区', slug, userId]);
      orgId = org.insertId;
      await connection.query('INSERT INTO organization_members(organization_id,user_id,role,status,joined_at) VALUES(?,? ,\'owner\',\'active\',NOW())', [orgId, userId]);
    }
    const [sites] = await connection.query('SELECT id FROM seo_sites WHERE organization_id=? AND normalized_host=? LIMIT 1', [orgId, host]);
    let siteId = sites[0]?.id;
    if (!siteId) {
      const token = crypto.randomBytes(24).toString('hex');
      const [site] = await connection.query(`INSERT INTO seo_sites
        (organization_id,name,base_url,normalized_host,ownership_status,verification_method,verification_token,verified_at,sitemap_url,sitemap_discovered_at,created_by)
        VALUES(?,?,?,?,'verified','demo',?,NOW(),?,NOW(),?)`,
      [orgId, 'Kanav 国内版测试站', baseUrl, host, token, sitemap.sitemapUrl, userId]);
      siteId = site.insertId;
    }
    const [scan] = await connection.query(`INSERT INTO seo_scan_jobs
      (organization_id,site_id,trigger_type,status,pages_discovered,pages_scanned,issue_count,score,started_at,completed_at,created_by)
      VALUES(?,?, 'manual','completed',?,?,?,?,NOW(),NOW(),?)`,
    [orgId, siteId, sitemap.locations.length, 1, facts.issues.length, facts.score, userId]);
    const [page] = await connection.query(`INSERT INTO seo_pages
      (organization_id,site_id,scan_id,url,http_status,title,meta_description,canonical_url,h1_count,image_count,image_missing_alt_count,has_schema,has_robots_meta,response_time_ms,content_bytes,facts)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [orgId, siteId, scan.insertId, facts.finalUrl, facts.httpStatus, facts.title, facts.description, facts.canonical,
      facts.h1Count, facts.imageCount, facts.missingAlt, facts.hasSchema ? 1 : 0, facts.hasRobots ? 1 : 0,
      facts.responseTime, facts.htmlBytes, JSON.stringify({ score_model: facts.score_model, demo_seeded_at: new Date().toISOString() })]);
    for (const item of facts.issues) await connection.query(`INSERT INTO seo_issues
      (organization_id,site_id,scan_id,page_id,rule_code,category,severity,title,evidence,recommendation)
      VALUES(?,?,?,?,?,?,?,?,?,?)`, [orgId, siteId, scan.insertId, page.insertId, item.rule_code, item.category, item.severity, item.title, item.evidence, item.recommendation]);
    const demoTitle = facts.title || 'Kanav 国内版测试站';
    const demoDescription = facts.description || 'Kanav 国内版测试环境页面，基于真实页面事实生成的 SEO 演示摘要。';
    await connection.query(`INSERT INTO seo_change_candidates
      (organization_id,site_id,page_id,original_title,original_description,candidate_title,candidate_description,rationale,evidence,model_code,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [orgId, siteId, page.insertId, facts.title, facts.description, demoTitle, demoDescription,
      '演示候选：仅复用真实页面已有 Title/Description；未调用外部模型。', JSON.stringify({ url: facts.finalUrl, http_status: facts.httpStatus, score: facts.score, demo: true }), 'demo', userId]);
    await connection.query(`UPDATE seo_sites SET last_http_status=?,last_scan_at=NOW(),last_score=?,sitemap_url=?,sitemap_discovered_at=NOW() WHERE id=?`,
      [facts.httpStatus, facts.score, sitemap.sitemapUrl, siteId]);
    await connection.query(`INSERT INTO audit_logs(organization_id,user_id,action,resource_type,resource_id,result,details,ip_address)
      VALUES(?,?,'site.connection.request','seo_site',?,'success',?,NULL)`,
    [orgId, userId, siteId, JSON.stringify({ connector_type: 'rest', endpoint: baseUrl, status: 'pending', demo: true })]);
    console.log(JSON.stringify({ organization_id: orgId, site_id: siteId, scan_id: scan.insertId, page_id: page.insertId,
      real_crawl: { url: facts.finalUrl, score: facts.score, issues: facts.issues.length, sitemap: sitemap.sitemapUrl }, simulated: { connection_request: true } }, null, 2));
  });
}

main().then(() => process.exit(0)).catch(err => { console.error(err.message); process.exit(1); });
