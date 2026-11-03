const crypto = require('crypto');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const DEFAULT_ALLOWED_FIELDS = [
  'id', 'robot_id', 'original_content', 'favorites_content', 'moment_content',
  'community', 'district', 'price', 'price_value', 'custom_price', 'display_price',
  'bedrooms', 'bathrooms', 'is_duplex', 'outdoor_features', 'has_elevator',
  'has_parking', 'has_commission', 'metro_lines', 'metro_stations',
  'metro_distance', 'effective_metro_distance', 'latitude', 'longitude',
  'publisher_name', 'contact_info', 'content_type', 'media_urls', 'local_images',
  'moment_media_list', 'property_code', 'share_code', 'title', 'description',
  'moment_publish_time', 'created_at', 'is_listed', 'is_in_poi',
];

const SENSITIVE_FIELDS = new Set([
  'contact_info',
  'original_content',
  'favorites_content',
  'moment_content',
  'publisher_name',
]);

let initialized = false;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function createPlainKey() {
  return `eh_${crypto.randomBytes(24).toString('hex')}`;
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

async function ensureTables() {
  if (initialized) return;

  await query(`
    CREATE TABLE IF NOT EXISTS open_api_apps (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      app_name VARCHAR(100) NOT NULL,
      app_id VARCHAR(64) NOT NULL,
      description VARCHAR(255) NULL,
      allowed_ips TEXT NULL,
      allowed_fields JSON NULL,
      permissions JSON NULL,
      rate_limit_per_minute INT UNSIGNED NOT NULL DEFAULT 60,
      daily_limit INT UNSIGNED NOT NULL DEFAULT 10000,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_open_api_apps_app_id (app_id),
      KEY idx_open_api_apps_enabled (is_enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS open_api_keys (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      app_id INT UNSIGNED NOT NULL,
      key_hash CHAR(64) NOT NULL,
      key_prefix VARCHAR(16) NOT NULL,
      last_used_at DATETIME NULL,
      expires_at DATETIME NULL,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_open_api_keys_hash (key_hash),
      KEY idx_open_api_keys_app (app_id, is_enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS open_api_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      app_id INT UNSIGNED NULL,
      app_key_id INT UNSIGNED NULL,
      request_method VARCHAR(12) NOT NULL,
      request_path VARCHAR(255) NOT NULL,
      request_query JSON NULL,
      response_status INT NOT NULL DEFAULT 0,
      result_count INT UNSIGNED NOT NULL DEFAULT 0,
      duration_ms INT UNSIGNED NOT NULL DEFAULT 0,
      client_ip VARCHAR(64) NULL,
      user_agent VARCHAR(255) NULL,
      error_message VARCHAR(500) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_open_api_logs_app_time (app_id, created_at),
      KEY idx_open_api_logs_path_time (request_path, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  initialized = true;
}

function normalizeApp(row) {
  if (!row) return null;
  return {
    ...row,
    allowed_ips: parseJson(row.allowed_ips, []),
    allowed_fields: parseJson(row.allowed_fields, DEFAULT_ALLOWED_FIELDS),
    permissions: parseJson(row.permissions, ['properties:list', 'properties:detail', 'filters:read', 'health:read']),
  };
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.connection?.remoteAddress || '';
}

function isIpAllowed(allowedIps, clientIp) {
  if (!Array.isArray(allowedIps) || allowedIps.length === 0) return true;
  return allowedIps.map(String).map(v => v.trim()).filter(Boolean).includes(clientIp);
}

async function findAppByCredentials(appId, apiKey) {
  await ensureTables();
  if (!appId || !apiKey) return null;

  const rows = await query(
    `SELECT a.*, k.id as key_id, k.key_prefix, k.expires_at
     FROM open_api_apps a
     JOIN open_api_keys k ON k.app_id = a.id
     WHERE a.app_id = ? AND k.key_hash = ? AND a.is_enabled = 1 AND k.is_enabled = 1
     LIMIT 1`,
    [appId, sha256(apiKey)]
  );
  return normalizeApp(rows[0]);
}

async function touchKey(keyId) {
  if (!keyId) return;
  await query('UPDATE open_api_keys SET last_used_at = NOW() WHERE id = ?', [keyId]).catch(() => {});
}

async function createApp(payload, adminId) {
  await ensureTables();
  const appId = `app_${crypto.randomBytes(10).toString('hex')}`;
  const apiKey = createPlainKey();
  const allowedIps = Array.isArray(payload.allowed_ips) ? payload.allowed_ips : [];
  const allowedFields = Array.isArray(payload.allowed_fields) && payload.allowed_fields.length
    ? payload.allowed_fields
    : DEFAULT_ALLOWED_FIELDS;
  const permissions = Array.isArray(payload.permissions) && payload.permissions.length
    ? payload.permissions
    : ['properties:list', 'properties:detail', 'filters:read', 'health:read'];

  const result = await query(
    `INSERT INTO open_api_apps
      (app_name, app_id, description, allowed_ips, allowed_fields, permissions, rate_limit_per_minute, daily_limit, is_enabled, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.app_name,
      appId,
      payload.description || '',
      JSON.stringify(allowedIps),
      JSON.stringify(allowedFields),
      JSON.stringify(permissions),
      Math.max(1, parseInt(payload.rate_limit_per_minute, 10) || 60),
      Math.max(1, parseInt(payload.daily_limit, 10) || 10000),
      payload.is_enabled === false ? 0 : 1,
      adminId || null,
    ]
  );

  await query(
    'INSERT INTO open_api_keys (app_id, key_hash, key_prefix) VALUES (?, ?, ?)',
    [result.insertId, sha256(apiKey), apiKey.slice(0, 10)]
  );

  return { id: result.insertId, app_id: appId, api_key: apiKey };
}

async function listApps() {
  await ensureTables();
  const rows = await query(`
    SELECT a.*,
      k.id as key_id,
      k.key_prefix,
      k.last_used_at,
      (SELECT COUNT(*) FROM open_api_logs l WHERE l.app_id = a.id AND l.created_at >= CURDATE()) as today_calls
    FROM open_api_apps a
    LEFT JOIN open_api_keys k ON k.app_id = a.id AND k.is_enabled = 1
    ORDER BY a.created_at DESC
  `);
  return rows.map(normalizeApp);
}

async function updateApp(id, payload) {
  await ensureTables();
  const updates = [];
  const params = [];
  const set = (field, value) => {
    updates.push(`${field} = ?`);
    params.push(value);
  };

  if (payload.app_name !== undefined) set('app_name', payload.app_name);
  if (payload.description !== undefined) set('description', payload.description || '');
  if (payload.allowed_ips !== undefined) set('allowed_ips', JSON.stringify(Array.isArray(payload.allowed_ips) ? payload.allowed_ips : []));
  if (payload.allowed_fields !== undefined) set('allowed_fields', JSON.stringify(Array.isArray(payload.allowed_fields) ? payload.allowed_fields : DEFAULT_ALLOWED_FIELDS));
  if (payload.permissions !== undefined) set('permissions', JSON.stringify(Array.isArray(payload.permissions) ? payload.permissions : []));
  if (payload.rate_limit_per_minute !== undefined) set('rate_limit_per_minute', Math.max(1, parseInt(payload.rate_limit_per_minute, 10) || 60));
  if (payload.daily_limit !== undefined) set('daily_limit', Math.max(1, parseInt(payload.daily_limit, 10) || 10000));
  if (payload.is_enabled !== undefined) set('is_enabled', payload.is_enabled ? 1 : 0);

  if (!updates.length) return;
  params.push(id);
  await query(`UPDATE open_api_apps SET ${updates.join(', ')} WHERE id = ?`, params);
}

async function resetKey(id) {
  await ensureTables();
  const apiKey = createPlainKey();
  await query('UPDATE open_api_keys SET is_enabled = 0 WHERE app_id = ?', [id]);
  await query(
    'INSERT INTO open_api_keys (app_id, key_hash, key_prefix) VALUES (?, ?, ?)',
    [id, sha256(apiKey), apiKey.slice(0, 10)]
  );
  return apiKey;
}

async function checkRateLimit(app, req) {
  const clientIp = getClientIp(req);
  if (!isIpAllowed(app.allowed_ips, clientIp)) {
    return { ok: false, status: 403, message: '当前IP未被允许访问该开放接口' };
  }

  const [minuteRow] = await query(
    `SELECT COUNT(*) as cnt FROM open_api_logs
     WHERE app_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
    [app.id]
  );
  if ((minuteRow?.cnt || 0) >= Number(app.rate_limit_per_minute || 60)) {
    return { ok: false, status: 429, message: '接口调用过于频繁，请稍后再试' };
  }

  const [dayRow] = await query(
    'SELECT COUNT(*) as cnt FROM open_api_logs WHERE app_id = ? AND created_at >= CURDATE()',
    [app.id]
  );
  if ((dayRow?.cnt || 0) >= Number(app.daily_limit || 10000)) {
    return { ok: false, status: 429, message: '今日接口调用次数已达上限' };
  }

  return { ok: true };
}

function hasPermission(app, permission) {
  return Array.isArray(app.permissions) && app.permissions.includes(permission);
}

function filterRecordFields(record, app) {
  const allowed = new Set(Array.isArray(app.allowed_fields) ? app.allowed_fields : DEFAULT_ALLOWED_FIELDS);
  const out = {};
  Object.keys(record || {}).forEach((key) => {
    if (allowed.has(key)) out[key] = record[key];
  });
  return out;
}

function getDefaultFields() {
  return DEFAULT_ALLOWED_FIELDS.slice();
}

function getSensitiveFields() {
  return Array.from(SENSITIVE_FIELDS);
}

async function writeLog({ req, app, status, resultCount = 0, durationMs = 0, errorMessage = '' }) {
  try {
    await ensureTables();
    await query(
      `INSERT INTO open_api_logs
        (app_id, app_key_id, request_method, request_path, request_query, response_status, result_count, duration_ms, client_ip, user_agent, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        app?.id || null,
        app?.key_id || null,
        req.method,
        req.path,
        JSON.stringify(req.query || {}),
        status || 0,
        resultCount || 0,
        durationMs || 0,
        getClientIp(req),
        String(req.headers['user-agent'] || '').slice(0, 255),
        errorMessage ? String(errorMessage).slice(0, 500) : null,
      ]
    );
  } catch (err) {
    logger.warn('开放API调用日志写入失败', { error: err.message });
  }
}

async function listLogs(params = {}) {
  await ensureTables();
  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(params.per_page, 10) || 20));
  const offset = (page - 1) * perPage;
  const where = [];
  const values = [];
  if (params.app_id) {
    where.push('l.app_id = ?');
    values.push(params.app_id);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [countRow] = await query(`SELECT COUNT(*) as total FROM open_api_logs l ${whereSql}`, values);
  const rows = await query(
    `SELECT l.*, a.app_name, a.app_id as public_app_id
     FROM open_api_logs l
     LEFT JOIN open_api_apps a ON a.id = l.app_id
     ${whereSql}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, perPage, offset]
  );

  return {
    data: rows.map(row => ({ ...row, request_query: parseJson(row.request_query, {}) })),
    pagination: { total: countRow?.total || 0, current_page: page, per_page: perPage, total_pages: Math.ceil((countRow?.total || 0) / perPage) },
  };
}

module.exports = {
  ensureTables,
  findAppByCredentials,
  touchKey,
  createApp,
  listApps,
  updateApp,
  resetKey,
  checkRateLimit,
  hasPermission,
  filterRecordFields,
  getDefaultFields,
  getSensitiveFields,
  writeLog,
  listLogs,
};
