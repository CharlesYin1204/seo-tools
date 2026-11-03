/**
 * S3代理服务 - 为rains3/S3存储的媒体文件生成预签名URL或代理访问
 * 解决S3 bucket 403 Forbidden 问题
 */
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { query } = require('../config/database');

let cachedClient = null;
let cachedConfig = null;
let configLoadedAt = 0;
const CONFIG_TTL = 5 * 60 * 1000;

async function getS3Config() {
  if (cachedConfig && Date.now() - configLoadedAt < CONFIG_TTL) return cachedConfig;

  try {
    const rows = await query(
      "SELECT config_value FROM system_configs WHERE config_key = 'storage_rainyun_s3'"
    );
    const raw = Array.isArray(rows[0]) ? rows[0] : rows;
    if (!raw || !raw.length) return null;

    const parsed = JSON.parse(raw[0].config_value);
    if (!parsed || parsed.enabled !== '1') return null;

    cachedConfig = {
      accessKey: parsed.access_key,
      secretKey: parsed.secret_key,
      bucket: parsed.bucket_name,
      endpoint: parsed.endpoint,
      domain: parsed.custom_domain || '',
    };
    configLoadedAt = Date.now();
    return cachedConfig;
  } catch (err) {
    console.error('[S3ProxyService] Failed to load config:', err.message);
    return null;
  }
}

function getS3Client(config) {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${config.endpoint}`,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true,
  });
  return cachedClient;
}

/**
 * 为S3 URL 生成预签名访问URL
 * @param {string} originalUrl - https://cn-sy1.rains3.com/bucket/path/to/file.jpg
 * @returns {Promise<string>} 预签名URL，失败返回原始URL
 */
async function getPresignedUrl(originalUrl) {
  try {
    const config = await getS3Config();
    if (!config) return originalUrl;

    const urlObj = new URL(originalUrl);
    if (!urlObj.hostname.includes('rains3.com')) return originalUrl;

    // 从URL路径提取key: /bucket/path/to/file.jpg -> path/to/file.jpg
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return originalUrl;
    const bucketInPath = pathParts[0];
    const key = pathParts.slice(1).join('/');

    const client = getS3Client(config);
    const command = new GetObjectCommand({
      Bucket: bucketInPath === config.bucket ? config.bucket : bucketInPath,
      Key: key,
    });

    const presigned = await getSignedUrl(client, command, { expiresIn: 7200 });
    return presigned;
  } catch (err) {
    console.error('[S3ProxyService] Presign failed:', err.message);
    return originalUrl;
  }
}

/**
 * 批量为媒体URL数组生成预签名URL
 * @param {Array} mediaUrls - URL字符串数组或对象数组
 * @returns {Promise<Array>} 处理后的URL数组
 */
async function presignMediaUrls(mediaUrls) {
  if (!Array.isArray(mediaUrls) || !mediaUrls.length) return mediaUrls;

  const config = await getS3Config();
  if (!config) return mediaUrls;

  const results = [];
  for (const item of mediaUrls) {
    if (typeof item === 'string') {
      results.push(await getPresignedUrl(item));
    } else if (item && typeof item === 'object') {
      const newItem = { ...item };
      if (newItem.url) newItem.url = await getPresignedUrl(newItem.url);
      if (newItem.thumb) newItem.thumb = await getPresignedUrl(newItem.thumb);
      if (newItem.file_url) newItem.file_url = await getPresignedUrl(newItem.file_url);
      results.push(newItem);
    } else {
      results.push(item);
    }
  }
  return results;
}

/**
 * 检查URL是否需要S3代理
 */
function isS3Url(url) {
  return url && typeof url === 'string' && url.includes('rains3.com');
}

module.exports = { getPresignedUrl, presignMediaUrls, isS3Url, getS3Config };
