const dns = require('dns').promises;
const net = require('net');
const { load } = require('cheerio');
const { XMLParser } = require('fast-xml-parser');
const { query, transaction } = require('../config/database');

function isPrivateIp(ip) {
  if (net.isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) || parts[0] >= 224;
  }
  const normalized = ip.toLowerCase();
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized.startsWith('::ffff:127.');
}

async function assertPublicUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('请输入有效的网站地址'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('仅支持 HTTP 或 HTTPS 网站');
  if (url.username || url.password) throw new Error('网站地址不能包含账号密码');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('仅支持标准 HTTP/HTTPS 端口');
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) throw new Error('该地址不允许扫描');
  url.hash = '';
  return url;
}

async function safeFetch(input, options = {}, redirectCount = 0) {
  if (redirectCount > 5) throw new Error('网站重定向次数超过安全限制');
  const url = await assertPublicUrl(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 15000);
  try {
    const response = await fetch(url, {
      redirect: 'manual', signal: controller.signal,
      headers: { 'User-Agent': 'SEOAI-AuditBot/1.0 (+site audit requested by owner)', Accept: options.accept || '*/*' },
    });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('网站返回了无目标的重定向');
      return safeFetch(new URL(location, url).toString(), options, redirectCount + 1);
    }
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > (options.maxBytes || 5 * 1024 * 1024)) throw new Error('响应内容超过安全限制');
    return { response, url };
  } finally { clearTimeout(timeout); }
}

async function detectSiteLanguages(site) {
  const { response } = await safeFetch(site.base_url, { accept: 'text/html', maxBytes: 2 * 1024 * 1024 });
  const html = await response.text(); const $ = load(html);
  const declared = String($('html').attr('lang') || '').trim();
  const header = String(response.headers.get('content-language') || '').split(',')[0].trim();
  const hreflangs = $('link[rel="alternate"][hreflang]').map((_, el) => $(el).attr('hreflang')).get().filter(Boolean);
  const languages = [...new Set([declared, header, ...hreflangs].map(v => v.toLowerCase()).filter(v => /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(v)))];
  const primary = languages[0] || (/[一-鿿]/.test($('body').text()) ? 'zh-CN' : 'en');
  return { primary, languages: languages.length ? languages : [primary], source: declared ? 'html_lang' : header ? 'content_language' : hreflangs.length ? 'hreflang' : 'text_detection', confidence: declared || header ? 1 : hreflangs.length ? 0.9 : 0.55 };
}

async function verifyOwnership(site, method = null) {
  const expected = String(site.verification_token || '');
  if (!expected) throw new Error('站点缺少验证令牌');
  try {
    if (method === 'html_file' || !method) {
      const fileUrl = new URL(`/kanseo-verification-${expected}.html`, site.base_url).toString();
      const fileResponse = await safeFetch(fileUrl, { accept: 'text/html,text/plain', maxBytes: 64 * 1024 });
      if (fileResponse.response.ok) {
        const body = await fileResponse.response.text();
        if (body.includes(expected) && new URL(fileUrl).hostname === site.normalized_host) return 'html_file';
      }
      if (method === 'html_file') throw new Error('未检测到匹配的 HTML 验证文件');
    }
    const records = await dns.resolveTxt(site.normalized_host);
    if (records.some(parts => parts.join('').trim() === `seo-ai-verification=${expected}`)) return 'dns_txt';
  } catch {}
  const { response } = await safeFetch(site.base_url, { accept: 'text/html', maxBytes: 2 * 1024 * 1024 });
  const html = await response.text();
  const $ = load(html);
  if ($('meta[name="seo-ai-verification"]').attr('content')?.trim() === expected) return 'html_meta';
  throw new Error('未检测到匹配的 DNS TXT 或 HTML Meta 验证记录');
}

function parseSitemap(xml) {
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
  const parsed = parser.parse(xml);
  const isIndex = Boolean(parsed.sitemapindex);
  const entries = parsed.urlset?.url || parsed.sitemapindex?.sitemap || [];
  return { isIndex, locations: (Array.isArray(entries) ? entries : [entries]).map(item => item?.loc).filter(Boolean) };
}

async function discoverSitemap(site) {
  const candidates = [];
  if (site.sitemap_url) candidates.push(String(site.sitemap_url).trim());
  try {
    const { response } = await safeFetch(new URL('/robots.txt', site.base_url), { maxBytes: 512 * 1024, accept: 'text/plain' });
    const robots = await response.text();
    for (const line of robots.split(/\r?\n/)) {
      const match = line.match(/^\s*Sitemap\s*:\s*(.+)\s*$/i);
      if (match) candidates.push(match[1].trim());
    }
  } catch {}
  candidates.push(new URL('/sitemap.xml', site.base_url).toString(), new URL('/sitemap_index.xml', site.base_url).toString());
  for (const candidate of [...new Set(candidates)]) {
    try {
      const { response, url } = await safeFetch(candidate, { maxBytes: 5 * 1024 * 1024, accept: 'application/xml,text/xml' });
      if (!response.ok) continue;
      const xml = await response.text();
      const parsed = parseSitemap(xml);
      if (!parsed.locations.length) continue;
      if (!parsed.isIndex) return { sitemapUrl: url.toString(), locations: parsed.locations };
      const pageLocations = [];
      const children = parsed.locations.slice(0, 100);
      for (let offset=0; offset<children.length && pageLocations.length<50000; offset+=5) {
        const results = await Promise.all(children.slice(offset,offset+5).map(async child => {
          try {
            if (new URL(child).hostname !== new URL(site.base_url).hostname) return [];
            const childResult = await safeFetch(child, { timeout:8000,maxBytes:5*1024*1024,accept:'application/xml,text/xml' });
            if (!childResult.response.ok) return [];
            const childParsed = parseSitemap(await childResult.response.text());
            return childParsed.isIndex ? [] : childParsed.locations;
          } catch { return []; }
        }));
        for (const locations of results) pageLocations.push(...locations);
      }
      if (pageLocations.length) return { sitemapUrl: url.toString(), locations: pageLocations.slice(0, 50000) };
    } catch {}
  }
  // Kanav and some SPA deployments do not publish a sitemap. Use only same-host
  // links from the public homepage as a bounded, real-data fallback.
  try {
    const { response, url } = await safeFetch(site.base_url, { accept: 'text/html', maxBytes: 5 * 1024 * 1024 });
    const html = await response.text();
    const $ = load(html);
    const host = new URL(site.base_url).hostname;
    const links = new Set([url.toString()]);
    $('a[href]').each((_, node) => {
      try {
        const target = new URL($(node).attr('href'), url);
        if (['http:', 'https:'].includes(target.protocol) && target.hostname === host) {
          target.hash = '';
          links.add(target.toString());
        }
      } catch {}
    });
    return { sitemapUrl: null, locations: [...links].slice(0, 500) };
  } catch {
    return { sitemapUrl: null, locations: [site.base_url] };
  }
}

async function getOrganization(user) {
  const rows = await query(`SELECT o.id,o.name,o.status,om.role,
    COALESCE(p.code,fp.code,'free') AS plan_code,COALESCE(p.name,fp.name,'Free 免费版') AS plan_name,
    COALESCE(p.entitlements,fp.entitlements,JSON_OBJECT('sites',1,'crawl_pages_monthly',500,'pages_per_scan',100,'ai_points_monthly',20,'members',1,'history_days',7)) AS entitlements
    FROM organization_members om JOIN organizations o ON o.id=om.organization_id
    LEFT JOIN subscriptions s ON s.organization_id=o.id AND s.status IN ('trialing','active') AND s.current_period_end>NOW()
    LEFT JOIN plans p ON p.id=s.plan_id LEFT JOIN plans fp ON fp.code='free'
    WHERE om.user_id=? AND om.status='active' AND o.status<>'archived'
    ORDER BY (om.role='owner') DESC,o.id LIMIT 1`, [user.id]);
  if (rows[0]) {
    rows[0].entitlements = typeof rows[0].entitlements === 'string' ? JSON.parse(rows[0].entitlements) : rows[0].entitlements;
    return rows[0];
  }
  return transaction(async connection => {
    const slug = `workspace-${user.id}-${Date.now().toString(36)}`;
    const [orgResult] = await connection.query('INSERT INTO organizations(name,slug,owner_user_id) VALUES(?,?,?)',
      [`${user.display_name || user.username || '用户'}的工作区`, slug, user.id]);
    await connection.query("INSERT INTO organization_members(organization_id,user_id,role,status,joined_at) VALUES(?,?,'owner','active',NOW())", [orgResult.insertId, user.id]);
    const [plans] = await connection.query("SELECT id,code,name,entitlements FROM plans WHERE code='free' LIMIT 1");
    await connection.query(`INSERT INTO subscriptions(organization_id,plan_id,status,current_period_start,current_period_end)
      VALUES(?,?,'active',NOW(),DATE_ADD(NOW(),INTERVAL 100 YEAR))`, [orgResult.insertId, plans[0].id]);
    return { id: orgResult.insertId, name: `${user.display_name || user.username || '用户'}的工作区`, status: 'active',
      role: 'owner', plan_code: plans[0].code, plan_name: plans[0].name,
      entitlements: typeof plans[0].entitlements === 'string' ? JSON.parse(plans[0].entitlements) : plans[0].entitlements };
  });
}

function issue(rule_code, category, severity, title, evidence, recommendation) {
  return { rule_code, category, severity, title, evidence, recommendation };
}

// Deterministic three-pillar model. External authority is intentionally absent
// until a verified backlink import/API is available (coverage remains 66%).
function calculateSeoScores(facts) {
  const rules = [
    ['technical_structure','http','HTTP 状态策略',35, facts.httpStatus >= 200 && facts.httpStatus < 300 ? 1 : 0, `HTTP ${facts.httpStatus || '无响应'}`],
    ['technical_structure','canonical','Canonical 策略',30, facts.canonical ? (facts.canonicalConflict ? 0 : 1) : 0, facts.canonical ? (facts.canonicalConflict ? `指向其他 URL：${facts.canonical}` : facts.canonical) : '未检测到 Canonical'],
    ['technical_structure','robots','Robots 策略',25, facts.robotsNoindex ? 0 : 1, facts.robotsNoindex ? 'Robots noindex 阻断' : '允许 index, follow'],
    ['technical_structure','schema_valid','JSON-LD 可解析',35, facts.hasSchema ? 1 : 0, facts.hasSchema ? '检测到 JSON-LD' : '未检测到 JSON-LD'],
    ['technical_structure','response_time','服务器响应时间',15, facts.responseTime == null ? null : (facts.responseTime <= 1000 ? 1 : facts.responseTime <= 2500 ? 0.5 : 0), facts.responseTime == null ? '未记录响应时间' : `${facts.responseTime}ms`],
    ['content_structure','title_present','SEO 标题已提供',10, facts.title ? 1 : 0, facts.title ? `${facts.title.length} 个字符` : 'Title 为空'],
    ['content_structure','title_display_ready','SEO 标题可完整展示',5, facts.title ? (facts.title.length >= 15 && facts.title.length <= 65 ? 1 : 0) : 0, facts.title ? `${facts.title.length} 个字符；规则 15-65` : '无标题'],
    ['content_structure','title_encoding_clean','SEO 标题无异常编码',5, facts.title && !/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);|\uFFFD/i.test(facts.title) ? 1 : 0, facts.title ? '检查 HTML 实体及替换字符' : '无标题'],
    ['content_structure','description_present','介绍已提供',10, facts.description ? 1 : 0, facts.description ? `${facts.description.length} 个字符` : 'Meta Description 为空'],
    ['content_structure','description_display_ready','介绍具备摘要信息量',10, facts.description && facts.description.length >= 50 && facts.description.length <= 180 ? 1 : 0, facts.description ? `${facts.description.length} 个字符；规则 50-180` : '无介绍'],
    ['content_structure','h1_present','H1 已提供',10, facts.h1Count > 0 ? 1 : 0, `检测到 ${facts.h1Count} 个 H1`],
    ['content_structure','body','正文信息量',15, facts.bodyChars == null ? null : (facts.bodyChars >= 600 ? 1 : facts.bodyChars >= 200 ? 0.5 : 0), facts.bodyChars == null ? '未抓取正文' : `${facts.bodyChars} 个字符`],
    ['content_structure','alt','图片替代文本',20, facts.imageCount === 0 ? null : (facts.missingAlt === 0 ? 1 : Math.max(0, (facts.imageCount-facts.missingAlt)/facts.imageCount)), facts.imageCount ? `${facts.imageCount-facts.missingAlt}/${facts.imageCount} 张图片已有 ALT` : '页面无图片'],
  ];
  const dimensions = {};
  for (const dimension of ['technical_structure','content_structure']) {
    const applicable = rules.filter(r => r[0] === dimension && r[4] !== null);
    const total = applicable.reduce((s,r) => s + r[3], 0);
    dimensions[dimension] = total ? Math.round(applicable.reduce((s,r) => s + r[3] * r[4], 0) / total * 1000) / 10 : null;
  }
  dimensions.backlink_authority = null;
  const rawOnsite = Math.round((dimensions.technical_structure * 33 + dimensions.content_structure * 33) / 100 * 10) / 10;
  const gates = [];
  if (!(facts.httpStatus >= 200 && facts.httpStatus < 300)) gates.push({key:'index_http_blocked',cap:39,reason:`HTTP ${facts.httpStatus || '无响应'}`});
  if (facts.robotsNoindex) gates.push({key:'index_robots_blocked',cap:39,reason:'Robots noindex 阻断'});
  if (facts.canonicalConflict) gates.push({key:'canonical_conflict',cap:59,reason:'Canonical 指向其他 URL'});
  const onsiteScore = Math.min(rawOnsite, ...(gates.map(g=>g.cap)), 66);
  const breakdown = rules.map(r=>({dimension:r[0],key:r[1],label:r[2],weight:r[3],points:r[4]===null?0:Math.round(r[3]*r[4]*10)/10,status:r[4]===null?'not_applicable':r[4]>=1?'good':r[4]>0?'improve':'problem',evidence:r[5]}));
  return { score:null, evidenceScore:Math.round((dimensions.technical_structure+dimensions.content_structure)/2*10)/10, onsiteScore, onsiteMaxScore:66, dimensions, weights:{technical_structure:33,content_structure:33,backlink_authority:34}, coverage:66, status:'limited', authorityStatus:'not_connected', missingDimensions:['backlink_authority'], scoreGates:gates, breakdown, version:'three-pillar-seo-v1' };
}

async function inspectPage(siteUrl) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const { response, url: initial } = await safeFetch(siteUrl, { accept: 'text/html,application/xhtml+xml' });
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) throw new Error('首页不是可审计的 HTML 页面');
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > 5 * 1024 * 1024) throw new Error('页面内容超过 5MB 安全限制');
    const html = await response.text();
    if (Buffer.byteLength(html) > 5 * 1024 * 1024) throw new Error('页面内容超过 5MB 安全限制');
    const $ = load(html);
    const title = $('title').first().text().trim();
    const description = $('meta[name="description" i]').attr('content')?.trim() || '';
    const canonical = $('link[rel="canonical" i]').attr('href') || '';
    const h1Count = $('h1').length;
    const images = $('img');
    let missingAlt = 0;
    images.each((_, el) => { if (!$(el).attr('alt')?.trim()) missingAlt += 1; });
    const schemaBlocks = [];
    $('script[type="application/ld+json"]').each((_, node) => { try { schemaBlocks.push(JSON.parse($(node).text())); } catch {} });
    const hasSchema = schemaBlocks.length > 0;
    const links = [];
    $('a[href]').each((_, node) => { try {
      const linkUrl = new URL($(node).attr('href'), initial);
      if (!['http:','https:'].includes(linkUrl.protocol)) return;
      linkUrl.hash = '';
      links.push({ url:linkUrl.toString(), text:$(node).text().replace(/\s+/g,' ').trim().slice(0,200), nofollow:/\bnofollow\b/i.test($(node).attr('rel') || '') });
    } catch {} });
    const hasRobots = $('meta[name="robots" i]').length > 0;
    const robotsContent = $('meta[name="robots" i]').attr('content') || '';
    const robotsNoindex = /\bnoindex\b/i.test(robotsContent);
    const bodyText = $('main,article,[role="main"],body').first().text().replace(/\s+/g, ' ').trim();
    const headings = [];
    $('h1,h2,h3').each((_, node) => {
      const text = $(node).text().replace(/\s+/g,' ').trim();
      if (text) headings.push({ level:String(node.tagName || node.name || '').toLowerCase(), text:text.slice(0,300) });
    });
    const issues = [];
    if (!response.ok) issues.push(issue('http-status','technical','critical','首页 HTTP 状态异常',`实际返回 HTTP ${response.status}`,'修复服务器响应后重新扫描。'));
    if (!title) issues.push(issue('missing-title','content','high','页面缺少 Title','HTML 中未找到非空 title 元素。','添加准确描述页面主题的唯一标题。'));
    else if (title.length < 10 || title.length > 60) issues.push(issue('title-length','content','medium','Title 长度不理想',`当前 Title 为 ${title.length} 个字符。`,'建议控制在 10-60 个字符并保留核心主题。'));
    if (!description) issues.push(issue('missing-description','content','high','缺少 Meta Description','未找到 name=description 的 Meta 标签。','添加基于真实页面内容的摘要。'));
    if (h1Count !== 1) issues.push(issue('h1-count','content','medium','H1 数量异常',`页面实际包含 ${h1Count} 个 H1。`,'每个页面保留一个清晰的主标题。'));
    if (!canonical) issues.push(issue('missing-canonical','technical','medium','缺少 Canonical','未发现 rel=canonical 链接。','添加指向首选页面 URL 的 Canonical。'));
    if (missingAlt) issues.push(issue('image-alt','content','medium','图片缺少替代文本',`${images.length} 张图片中有 ${missingAlt} 张缺少 ALT。`,'为承载内容信息的图片补充准确 ALT。'));
    if (!hasSchema) issues.push(issue('missing-schema','geo','low','未发现 JSON-LD Schema','页面没有 application/ld+json 数据块。','根据真实实体字段添加适用的结构化数据。'));
    let canonicalConflict = false;
    if (canonical) {
      try { canonicalConflict = new URL(canonical, initial).toString().replace(/\/$/,'') !== initial.toString().replace(/\/$/,''); } catch { canonicalConflict = true; }
    }
    const scoreModel = calculateSeoScores({ httpStatus: response.status, canonical, canonicalConflict, hasRobots, responseTime: Date.now()-started,
      title, description, h1Count, imageCount: images.length, missingAlt, bodyChars: bodyText.length, robotsNoindex, hasSchema });
    const score = scoreModel.score;
    return { finalUrl: initial.toString(), httpStatus: response.status, responseTime: Date.now()-started, htmlBytes: Buffer.byteLength(html),
      title, description, canonical, h1Count, imageCount: images.length, missingAlt, hasSchema, hasRobots, bodyChars: bodyText.length,
      bodyExcerpt:bodyText.slice(0,12000), headings:headings.slice(0,100), links:links.slice(0,1000), schema: schemaBlocks,
      robotsNoindex, issues, score, score_model: scoreModel };
  } finally { clearTimeout(timeout); }
}

module.exports = { assertPublicUrl, safeFetch, getOrganization, inspectPage, verifyOwnership, detectSiteLanguages, discoverSitemap, calculateSeoScores };
