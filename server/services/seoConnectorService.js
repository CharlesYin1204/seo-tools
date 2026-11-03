const crypto = require('crypto');
const axios = require('axios');
const { assertPublicUrl } = require('./seoSiteService');

function encryptionKey() {
  const secret = process.env.SEO_CONNECTOR_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error('未配置连接器加密密钥');
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptCredentials(credentials) {
  if (!credentials || !Object.keys(credentials).length) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString('base64url')).join('.');
}

function decryptCredentials(payload) {
  if (!payload) return {};
  const [iv, tag, encrypted] = String(payload).split('.').map(value => Buffer.from(value, 'base64url'));
  if (!iv?.length || !tag?.length || !encrypted?.length) throw new Error('连接器凭据格式无效');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
}

async function validateConnectorEndpoint(endpoint, siteHost) {
  const parsed = await assertPublicUrl(endpoint);
  if (parsed.protocol !== 'https:') throw new Error('发布连接器必须使用 HTTPS');
  if (parsed.hostname.toLowerCase() !== String(siteHost).toLowerCase()) throw new Error('连接器地址必须属于已验证站点域名');
  return parsed.toString();
}

function requestHeaders(connector, body) {
  const credentials = decryptCredentials(connector.credentials_encrypted);
  const headers = { 'Content-Type':'application/json',Accept:'application/json','User-Agent':'SEOAI-Publisher/1.0' };
  if (connector.auth_type === 'bearer') headers.Authorization = `Bearer ${credentials.token || ''}`;
  if (connector.auth_type === 'basic') headers.Authorization = `Basic ${Buffer.from(`${credentials.username || ''}:${credentials.password || ''}`).toString('base64')}`;
  if (connector.auth_type === 'hmac') {
    const timestamp = Math.floor(Date.now()/1000).toString();
    headers['X-SEOAI-Timestamp'] = timestamp;
    headers['X-SEOAI-Signature'] = crypto.createHmac('sha256',credentials.secret||'').update(`${timestamp}.${body}`).digest('hex');
  }
  return headers;
}

async function callConnector(connector, siteHost, payload, method = 'post') {
  const endpoint = await validateConnectorEndpoint(connector.endpoint, siteHost);
  const body = JSON.stringify(payload);
  return axios({ method,url:endpoint,data:method==='get'?undefined:body,headers:requestHeaders(connector,body),timeout:20000,maxContentLength:1024*1024,validateStatus:()=>true });
}

module.exports = { encryptCredentials, decryptCredentials, validateConnectorEndpoint, callConnector };
