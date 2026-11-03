const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const PUBLIC_ROOT = path.join(PROJECT_ROOT, 'public');
const RETENTION_DAYS = Math.max(1, parseInt(process.env.MOMENT_DATA_RETENTION_DAYS || '15', 10));
const CUTOFF_SQL = `DATE_SUB(CURDATE(), INTERVAL ${RETENTION_DAYS} DAY)`;
const RETENTION_DATE_CONDITION = `COALESCE(moment_publish_time, created_at) >= ${CUTOFF_SQL}`;
const RETENTION_DATE_CONDITION_P = `COALESCE(p.moment_publish_time, p.created_at) >= ${CUTOFF_SQL}`;
const RETENTION_DATE_CONDITION_PP = `COALESCE(pp.moment_publish_time, pp.created_at) >= ${CUTOFF_SQL}`;
const MOMENT_RETENTION_CONDITION = `COALESCE(FROM_UNIXTIME(create_time), publish_at, created_at) >= ${CUTOFF_SQL}`;
const MOMENT_RETENTION_CONDITION_M = `COALESCE(FROM_UNIXTIME(m.create_time), m.publish_at, m.created_at) >= ${CUTOFF_SQL}`;

let cleanupRunning = false;

function normalizeJson(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return value;
  }
}

function collectUrls(value, out = new Set()) {
  const parsed = normalizeJson(value);
  if (!parsed) return out;
  if (typeof parsed === 'string') {
    out.add(parsed);
    return out;
  }
  if (Array.isArray(parsed)) {
    parsed.forEach((item) => collectUrls(item, out));
    return out;
  }
  if (typeof parsed === 'object') {
    Object.values(parsed).forEach((item) => collectUrls(item, out));
  }
  return out;
}

function resolveLocalUploadPath(url) {
  if (!url || typeof url !== 'string') return null;
  let pathname = url.trim();
  if (!pathname) return null;
  try {
    if (/^https?:\/\//i.test(pathname)) {
      const parsed = new URL(pathname);
      pathname = parsed.pathname || '';
    }
  } catch (_) {
    return null;
  }
  if (!pathname.startsWith('/uploads/')) return null;
  const relative = decodeURIComponent(pathname.replace(/^\/+/, '')).replace(/[\\/]+/g, path.sep);
  const fullPath = path.resolve(PUBLIC_ROOT, relative);
  if (!fullPath.startsWith(PUBLIC_ROOT + path.sep)) return null;
  return fullPath;
}

function pruneEmptyParents(filePath) {
  let dir = path.dirname(filePath);
  const uploadsRoot = path.join(PUBLIC_ROOT, 'uploads');
  while (dir.startsWith(uploadsRoot + path.sep) && dir !== uploadsRoot) {
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
      } else {
        break;
      }
    } catch (_) {
      break;
    }
  }
}

function deleteLocalFiles(urls) {
  let deletedFiles = 0;
  for (const url of urls) {
    const filePath = resolveLocalUploadPath(url);
    if (!filePath) continue;
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        deletedFiles++;
        pruneEmptyParents(filePath);
      }
    } catch (err) {
      logger.warn('朋友圈过期媒体删除失败', { filePath, error: err.message });
    }
  }
  return deletedFiles;
}

async function collectExpiredMediaUrls(limit = 5000) {
  const urls = new Set();
  const parsedRows = await query(
    `SELECT media_urls, local_images, local_videos
     FROM wechat_robot_expat_parsed_properties
     WHERE deleted_at IS NULL AND COALESCE(moment_publish_time, created_at) < ${CUTOFF_SQL}
     LIMIT ?`,
    [limit]
  );
  for (const row of parsedRows || []) {
    collectUrls(row.media_urls, urls);
    collectUrls(row.local_images, urls);
    collectUrls(row.local_videos, urls);
  }

  const momentRows = await query(
    `SELECT media_list, local_media_urls, fav_media_list, link_thumb
     FROM wechat_robot_moments
     WHERE status <> 'deleted'
       AND COALESCE(FROM_UNIXTIME(create_time), publish_at, created_at) < ${CUTOFF_SQL}
     LIMIT ?`,
    [limit]
  );
  for (const row of momentRows || []) {
    collectUrls(row.media_list, urls);
    collectUrls(row.local_media_urls, urls);
    collectUrls(row.fav_media_list, urls);
    collectUrls(row.link_thumb, urls);
  }

  const expatRows = await query(
    `SELECT media_urls, local_images, local_videos
     FROM wechat_robot_expat_properties
     WHERE COALESCE(moment_publish_time, publish_time, created_at) < ${CUTOFF_SQL}
     LIMIT ?`,
    [limit]
  );
  for (const row of expatRows || []) {
    collectUrls(row.media_urls, urls);
    collectUrls(row.local_images, urls);
    collectUrls(row.local_videos, urls);
  }
  return urls;
}

async function cleanupExpiredMomentData(options = {}) {
  if (cleanupRunning) return { skipped: true };
  cleanupRunning = true;
  const limit = Math.max(100, parseInt(options.limit || 5000, 10));
  try {
    const urls = await collectExpiredMediaUrls(limit);
    const deletedFiles = deleteLocalFiles(urls);

    await query(
      `DELETE qsr FROM wechat_robot_quick_search_results qsr
       LEFT JOIN wechat_robot_expat_parsed_properties pp ON qsr.parsed_property_id = pp.id
       LEFT JOIN wechat_robot_moments m ON qsr.moment_id = m.moment_id
       WHERE COALESCE(qsr.publish_time, pp.moment_publish_time, pp.created_at, FROM_UNIXTIME(m.create_time), m.publish_at, m.created_at, qsr.created_at) < ${CUTOFF_SQL}`
    );

    await query(
      `DELETE FROM wechat_robot_expat_parsed_properties
       WHERE deleted_at IS NULL AND COALESCE(moment_publish_time, created_at) < ${CUTOFF_SQL}
       LIMIT ?`,
      [limit]
    );

    await query(
      `DELETE FROM wechat_robot_expat_properties
       WHERE COALESCE(moment_publish_time, publish_time, created_at) < ${CUTOFF_SQL}
       LIMIT ?`,
      [limit]
    );

    await query(
      `DELETE FROM wechat_robot_moments
       WHERE COALESCE(FROM_UNIXTIME(create_time), publish_at, created_at) < ${CUTOFF_SQL}
       LIMIT ?`,
      [limit]
    );

    logger.info('朋友圈15天保留清理完成', { retentionDays: RETENTION_DAYS, deletedFiles, scannedUrls: urls.size });
    return { retentionDays: RETENTION_DAYS, deletedFiles, scannedUrls: urls.size };
  } catch (err) {
    logger.error('朋友圈15天保留清理失败', { error: err.message });
    throw err;
  } finally {
    cleanupRunning = false;
  }
}

module.exports = {
  RETENTION_DAYS,
  CUTOFF_SQL,
  RETENTION_DATE_CONDITION,
  RETENTION_DATE_CONDITION_P,
  RETENTION_DATE_CONDITION_PP,
  MOMENT_RETENTION_CONDITION,
  MOMENT_RETENTION_CONDITION_M,
  cleanupExpiredMomentData,
};
