const axios = require('axios');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { encryptCredentials, decryptCredentials } = require('./seoConnectorService');

const DEFAULT_ENDPOINT = 'https://api.ahrefs.com/v3/public/domain-rating-free';

function normalizeEndpoint(value) {
  const endpoint = String(value || DEFAULT_ENDPOINT).trim();
  let parsed;
  try { parsed = new URL(endpoint); } catch { throw new Error('Ahrefs API 地址格式无效'); }
  if (parsed.protocol !== 'https:') throw new Error('Ahrefs API 必须使用 HTTPS');
  if (parsed.hostname.toLowerCase() !== 'api.ahrefs.com') throw new Error('Ahrefs API 地址必须使用 api.ahrefs.com');
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function normalizeTarget(value) {
  let target = String(value || '').trim().toLowerCase();
  if (!target) throw new Error('请输入用于测试的站点域名');
  try { target = new URL(target.includes('://') ? target : `https://${target}`).hostname.toLowerCase(); } catch { throw new Error('测试域名格式无效'); }
  if (!target || target === 'localhost' || !target.includes('.')) throw new Error('测试域名格式无效');
  return target;
}

function encryptToken(token) { return encryptCredentials({ token: String(token || '').trim() }); }
function decryptToken(value) {
  if (!value) return '';
  try { return String(decryptCredentials(value).token || ''); } catch { return String(value); }
}

async function getAhrefsSettings() {
  const rows = await query("SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN ('seo_ahrefs_enabled','seo_ahrefs_endpoint','seo_ahrefs_token','seo_ahrefs_refresh_hours')");
  const settings = Object.fromEntries(rows.map(row => [row.setting_key, row.setting_value]));
  return { enabled: settings.seo_ahrefs_enabled === '1', endpoint: normalizeEndpoint(settings.seo_ahrefs_endpoint || DEFAULT_ENDPOINT), token: decryptToken(settings.seo_ahrefs_token), tokenConfigured: Boolean(settings.seo_ahrefs_token), tokenEncrypted: Boolean(settings.seo_ahrefs_token && String(settings.seo_ahrefs_token).split('.').length === 3), refreshHours: Math.max(1, Number(settings.seo_ahrefs_refresh_hours) || 24) };
}

async function requestDomainRating({ endpoint, token, target }) {
  if (!token) throw new Error('Ahrefs API Token 尚未配置');
  const normalizedTarget = normalizeTarget(target);
  const url = new URL(normalizeEndpoint(endpoint));
  url.searchParams.set('target', normalizedTarget);
  url.searchParams.set('output', 'json');
  const response = await axios.get(url.toString(), { timeout: 15000, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const rating = Number(response.data?.domain_rating?.domain_rating ?? response.data?.domain_rating);
  if (!Number.isFinite(rating)) throw new Error('Ahrefs API 未返回有效 Domain Rating');
  return { target: normalizedTarget, domain_rating: Math.max(0, Math.min(100, rating)) };
}

async function fetchAhrefsAuthority(host) {
  const settings = await getAhrefsSettings();
  if (!settings.enabled || !settings.token) return { status: 'not_configured', domain_rating: null };
  const target = normalizeTarget(host);
  const [cached] = await query("SELECT domain_rating,fetched_at FROM seo_authority_metrics WHERE normalized_host=? AND provider='ahrefs' LIMIT 1", [target]);
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < settings.refreshHours * 3600000) return { status: 'cached', domain_rating: Number(cached.domain_rating), fetched_at: cached.fetched_at };
  try {
    const result = await requestDomainRating({ endpoint: settings.endpoint, token: settings.token, target });
    await query(`INSERT INTO seo_authority_metrics(normalized_host,provider,domain_rating,fetched_at) VALUES(?,'ahrefs',?,NOW()) ON DUPLICATE KEY UPDATE domain_rating=VALUES(domain_rating),fetched_at=VALUES(fetched_at)`, [target, result.domain_rating]);
    return { status: 'connected', domain_rating: result.domain_rating };
  } catch (err) {
    logger.warn('Ahrefs 外链权威读取失败', { host: target, status: err.response?.status, error: err.message });
    if (cached) return { status: 'stale', domain_rating: Number(cached.domain_rating), fetched_at: cached.fetched_at, message: 'Ahrefs 暂时不可用，当前展示最近一次成功数据' };
    const httpStatus = Number(err.response?.status || 0);
    if ([401, 403].includes(httpStatus)) return { status: 'auth_error', domain_rating: null, message: 'Ahrefs API Token 无效或当前 Ahrefs 套餐没有 API 权限' };
    if (httpStatus === 429) return { status: 'rate_limited', domain_rating: null, message: 'Ahrefs API 请求频率已达上限，请稍后刷新' };
    return { status: 'unavailable', domain_rating: null, message: err.code === 'ECONNABORTED' ? 'Ahrefs API 响应超时' : 'Ahrefs API 暂时不可用' };
  }
}

module.exports = { normalizeEndpoint, normalizeTarget, encryptToken, getAhrefsSettings, requestDomainRating, fetchAhrefsAuthority };
