/**
 * 管理后台媒体库控制器
 * 全部媒体、上传、删除、水印配置
 */
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { success, error } = require('../../utils/response');
const { query, getPool } = require('../../config/database');
const config = require('../../config');

const WATERMARK_SETTING_KEY = 'media_watermark_config';
const DEFAULT_WATERMARK_CONFIG = {
  enabled: false,
  text: 'ExpatHome',
  position: 'bottom-right',
  opacity: 70,
  size: 'medium',
  font_size: null,
};

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!size) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function normalizeWatermarkConfig(raw = {}) {
  const opacityNum = Math.min(100, Math.max(10, Number(raw.opacity ?? DEFAULT_WATERMARK_CONFIG.opacity)));
  const size = ['small', 'medium', 'large', 'custom'].includes(raw.size) ? raw.size : 'medium';
  const fontSizeRaw = raw.font_size == null || raw.font_size === '' ? null : Number(raw.font_size);
  const fontSize = Number.isFinite(fontSizeRaw) ? Math.min(500, Math.max(12, fontSizeRaw)) : null;

  return {
    enabled: normalizeBoolean(raw.enabled),
    text: String(raw.text || DEFAULT_WATERMARK_CONFIG.text).trim() || DEFAULT_WATERMARK_CONFIG.text,
    position: raw.position || DEFAULT_WATERMARK_CONFIG.position,
    opacity: opacityNum,
    size,
    font_size: size === 'custom' ? fontSize : null,
  };
}

function tryRepairMojibake(value) {
  if (typeof value !== 'string' || !value.trim()) return value;
  // 常见 UTF-8 被按 latin1 解码后的特征字符
  const mojibakePattern = /[ÃÂÅæçèéêëìíîïðñòóôõöøùúûüýþÿ]/;
  if (!mojibakePattern.test(value)) return value;
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8');
    if (repaired && repaired !== value) return repaired;
  } catch {
    // ignore
  }
  return value;
}

function mapMediaRow(row) {
  const fixedFilename = tryRepairMojibake(row.filename);
  const fixedAltText = tryRepairMojibake(row.alt_text);
  const fixedStoredFilename = tryRepairMojibake(row.stored_filename);
  return {
    ...row,
    filename: fixedFilename || row.filename,
    alt_text: fixedAltText || row.alt_text,
    stored_filename: fixedStoredFilename || row.stored_filename,
    name: fixedFilename || fixedAltText || fixedStoredFilename || `media_${row.id}`,
    url: row.file_url,
    type: row.file_type || 'other',
    size_text: formatFileSize(row.file_size),
    user_name: row.user_name || row.display_name || '-',
  };
}

/** 房源媒体 JSON 数组去重、删除时用的 URL 归一化 */
function normalizeMediaUrlForCompare(u) {
  let s = typeof u === 'string' ? u.trim() : '';
  if (!s) return '';
  try {
    if (s.includes('/api/proxy/image')) {
      const m = s.match(/[?&]url=([^&]+)/);
      if (m) s = decodeURIComponent(m[1]);
    }
  } catch { /* ignore */ }
  try {
    if (s.includes('X-Amz-Signature') && /^https?:/i.test(s)) {
      const p = new URL(s);
      return `${p.origin}${p.pathname}`;
    }
  } catch { /* ignore */ }
  return s.split('?')[0];
}

function parseJsonMediaArray(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

function jsonMediaArrayContains(arrRaw, candidateUrl) {
  const key = normalizeMediaUrlForCompare(candidateUrl);
  for (const item of parseJsonMediaArray(arrRaw)) {
    const val = typeof item === 'string' ? item : (item?.url || item?.thumb || item?.file_url || '');
    if (normalizeMediaUrlForCompare(val) === key) return true;
  }
  return false;
}

function filterJsonMediaArrayByUrl(raw, removeUrl) {
  const targetKey = normalizeMediaUrlForCompare(removeUrl);
  return parseJsonMediaArray(raw).filter((item) => {
    const val = typeof item === 'string' ? item : (item?.url || item?.thumb || item?.file_url || '');
    return normalizeMediaUrlForCompare(val) !== targetKey;
  });
}

/* 上传中间件：内存存储，支持多文件 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (config.storage?.maxUploadSize || 200) * 1024 * 1024 },
});

class MediaController {
  /** 获取上传中间件（供路由使用） */
  getUploadMiddleware() {
    return upload.single('file');
  }

  async getAllMedia(req, res) {
    try {
      const { page = 1, pageSize = 20, userId = '', type = '', search = '', plugin = '', source = '' } = req.query;
      const conditions = ['m.status = ?'];
      const params = ['active'];

      if (userId) { conditions.push('m.user_id = ?'); params.push(userId); }
      if (type === 'other') {
        conditions.push("m.file_type NOT IN ('image', 'video', 'document', 'audio')");
      } else if (type) {
        conditions.push('m.file_type = ?'); params.push(type);
      }
      if (plugin) { conditions.push('m.plugin_slug = ?'); params.push(plugin); }
      if (source) { conditions.push('m.source = ?'); params.push(source); }
      if (search && search.trim()) {
        conditions.push('(m.filename LIKE ? OR m.alt_text LIKE ? OR m.file_url LIKE ?)');
        const like = `%${search.trim()}%`;
        params.push(like, like, like);
      }

      const whereClause = conditions.join(' AND ');
      const countSql = `SELECT COUNT(*) as total FROM media_files m WHERE ${whereClause}`;
      const [countResult] = await query(countSql, [...params]);
      const total = countResult ? countResult.total : 0;
      const sql = `SELECT m.*, COALESCE(u.display_name, u.username) as user_name FROM media_files m LEFT JOIN users u ON m.user_id = u.id WHERE ${whereClause} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
      const dataParams = [...params, parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10)];
      const rows = await query(sql, dataParams);
      return success(res, { data: rows.map(mapMediaRow), total }, '获取成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async uploadMedia(req, res) {
    try {
      const file = req.file;
      if (!file || !file.buffer) {
        return error(res, '请选择要上传的文件', 400);
      }
      const userId = req.user?.id;
      if (!userId) {
        return error(res, '登录状态无效，请重新登录', 401);
      }
      const ext = path.extname(file.originalname) || '';
      const mime = (file.mimetype || '').toLowerCase();
      let mediaType = 'document';
      if (mime.startsWith('image/')) mediaType = 'image';
      else if (mime.startsWith('video/')) mediaType = 'video';
      else if (mime.startsWith('audio/')) mediaType = 'audio';

      const uploadPath = config.storage?.uploadPath || process.env.UPLOAD_PATH || 'public/uploads';
      const subdir = mediaType + 's';
      const storedFilename = `${mediaType}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
      const relPath = path.join(subdir, storedFilename).replace(/\\/g, '/');
      const fullPath = path.join(process.cwd(), uploadPath, subdir);
      await fs.mkdir(fullPath, { recursive: true });
      await fs.writeFile(path.join(fullPath, storedFilename), file.buffer);

      const fileUrl = `/${uploadPath}/${relPath}`;
      const pool = getPool();
      const [insertResult] = await pool.execute(
        `INSERT INTO media_files 
          (user_id, filename, stored_filename, file_path, file_url, file_type, mime_type, file_size, alt_text, storage_type, source, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
        [
          userId,
          file.originalname || storedFilename,
          storedFilename,
          relPath,
          fileUrl,
          mediaType,
          file.mimetype || 'application/octet-stream',
          Number(file.size || file.buffer.length || 0),
          file.originalname || storedFilename,
          'local',
          'admin_upload',
        ]
      );
      const newId = insertResult?.insertId;
      const [rows] = newId
        ? await pool.execute(
            'SELECT m.*, COALESCE(u.display_name, u.username) as user_name FROM media_files m LEFT JOIN users u ON m.user_id = u.id WHERE m.id = ?',
            [newId]
          )
        : [[{ file_url: fileUrl, file_type: mediaType, filename: file.originalname || storedFilename, file_size: Number(file.size || file.buffer.length || 0) }]];
      return success(res, mapMediaRow(rows?.[0] || {}), '上传成功', 201);
    } catch (err) {
      return error(res, err.message || '上传失败', 500);
    }
  }

  async deleteMedia(req, res) {
    try {
      const { id } = req.params;
      const [existing] = await query('SELECT * FROM media_files WHERE id = ?', [id]);
      if (!existing) {
        return error(res, '媒体不存在', 404);
      }
      await query('UPDATE media_files SET status = ?, updated_at = NOW() WHERE id = ?', ['deleted', id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getWatermarkConfig(req, res) {
    try {
      const [row] = await query(
        'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
        [WATERMARK_SETTING_KEY]
      );

      if (row?.setting_value) {
        try {
          const parsed = JSON.parse(row.setting_value);
          return success(res, normalizeWatermarkConfig(parsed));
        } catch {
          return success(res, { ...DEFAULT_WATERMARK_CONFIG });
        }
      }

      const legacyRows = await query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'watermark_%'"
      );
      if (!legacyRows.length) {
        return success(res, { ...DEFAULT_WATERMARK_CONFIG });
      }

      const legacy = {};
      legacyRows.forEach((item) => {
        legacy[item.setting_key] = item.setting_value;
      });

      return success(res, normalizeWatermarkConfig({
        enabled: legacy.watermark_enabled,
        text: legacy.watermark_text,
        position: legacy.watermark_position,
        opacity: legacy.watermark_opacity,
        size: legacy.watermark_size,
        font_size: legacy.watermark_font_size,
      }));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async saveWatermarkConfig(req, res) {
    try {
      const settings = normalizeWatermarkConfig(req.body || {});
      const serialized = JSON.stringify(settings);
      await query(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [WATERMARK_SETTING_KEY, serialized, serialized]
      );
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
  async getCommunityImages(req, res) {
    try {
      const { community = '', page = 1, pageSize = 50 } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

      let whereExtra = '';
      const params = [];
      if (community && community.trim()) {
        whereExtra = ' AND p.community LIKE ?';
        params.push(`%${community.trim()}%`);
      }

      // 查询已发布房源（is_listed = 1）的小区及其媒体，JOIN朋友圈表获取图片
      const countSql = `
        SELECT COUNT(DISTINCT p.community) as total
        FROM wechat_robot_expat_parsed_properties p
        LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
        WHERE p.deleted_at IS NULL
          AND p.is_listed = 1
          AND p.community IS NOT NULL AND p.community != ''
          AND (
            (p.media_urls IS NOT NULL AND p.media_urls != '[]' AND p.media_urls != '' AND JSON_LENGTH(CASE WHEN JSON_VALID(p.media_urls) THEN p.media_urls ELSE NULL END) > 0)
            OR
            (p.local_images IS NOT NULL AND p.local_images != '[]' AND p.local_images != '' AND JSON_LENGTH(CASE WHEN JSON_VALID(p.local_images) THEN p.local_images ELSE NULL END) > 0)
            OR
            (m.media_list IS NOT NULL AND m.media_list != '[]' AND m.media_list != '' AND JSON_LENGTH(CASE WHEN JSON_VALID(m.media_list) THEN m.media_list ELSE NULL END) > 0)
            OR
            (m.local_media_urls IS NOT NULL AND m.local_media_urls != '[]' AND m.local_media_urls != '' AND JSON_LENGTH(CASE WHEN JSON_VALID(m.local_media_urls) THEN m.local_media_urls ELSE NULL END) > 0)
          )
          ${whereExtra}`;
      const [countResult] = await query(countSql, [...params]);
      const total = countResult?.total || 0;

      const groupSql = `
        SELECT p.community,
               COUNT(DISTINCT p.id) as property_count,
               SUM(
                 GREATEST(
                   COALESCE(JSON_LENGTH(CASE WHEN JSON_VALID(p.media_urls) THEN p.media_urls ELSE NULL END), 0),
                   COALESCE(JSON_LENGTH(CASE WHEN JSON_VALID(p.local_images) THEN p.local_images ELSE NULL END), 0),
                   COALESCE(JSON_LENGTH(CASE WHEN JSON_VALID(m.media_list) THEN m.media_list ELSE NULL END), 0),
                   COALESCE(JSON_LENGTH(CASE WHEN JSON_VALID(m.local_media_urls) THEN m.local_media_urls ELSE NULL END), 0)
                 )
               ) as image_count
        FROM wechat_robot_expat_parsed_properties p
        LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
        WHERE p.deleted_at IS NULL
          AND p.is_listed = 1
          AND p.community IS NOT NULL AND p.community != ''
          AND (
            (p.media_urls IS NOT NULL AND p.media_urls != '[]' AND p.media_urls != '' AND JSON_LENGTH(CASE WHEN JSON_VALID(p.media_urls) THEN p.media_urls ELSE NULL END) > 0)
            OR
            (p.local_images IS NOT NULL AND p.local_images != '[]' AND p.local_images != '' AND JSON_LENGTH(CASE WHEN JSON_VALID(p.local_images) THEN p.local_images ELSE NULL END) > 0)
            OR
            (m.media_list IS NOT NULL AND m.media_list != '[]' AND m.media_list != '' AND JSON_LENGTH(CASE WHEN JSON_VALID(m.media_list) THEN m.media_list ELSE NULL END) > 0)
            OR
            (m.local_media_urls IS NOT NULL AND m.local_media_urls != '[]' AND m.local_media_urls != '' AND JSON_LENGTH(CASE WHEN JSON_VALID(m.local_media_urls) THEN m.local_media_urls ELSE NULL END) > 0)
          )
          ${whereExtra}
        GROUP BY p.community
        ORDER BY image_count DESC
        LIMIT ? OFFSET ?`;
      const groups = await query(groupSql, [...params, parseInt(pageSize, 10), offset]);

      // 为每个小区获取房源列表和媒体，JOIN朋友圈表获取图片
      const result = [];
      for (const grp of (groups || [])) {
        const props = await query(
          `SELECT p.id, p.property_code, p.community, p.media_urls, p.local_images, p.moment_id,
                  m.media_list as moment_media_list, m.local_media_urls as moment_local_media
           FROM wechat_robot_expat_parsed_properties p
           LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
           WHERE p.deleted_at IS NULL AND p.is_listed = 1 AND p.community = ?
           ORDER BY p.id DESC LIMIT 30`,
          [grp.community]
        );

        const EXTERNAL_VIDEO_RE = /video\.qq\.com|snsvideodownload/i;
        const VIDEO_EXT_RE = /\.(mp4|mov|avi|m4v|wmv|flv|mkv|mp3|wav|ogg|aac)(\?|$)/i;

        function extractImageUrls(prop) {
          const seen = new Set();
          const out = [];

          function pushItem(u) {
            const val = typeof u === 'string' ? u.trim() : (u?.url || u?.thumb || u?.file_url || '').trim();
            if (!val || seen.has(val) || val.length < 10) return;
            seen.add(val);
            if (VIDEO_EXT_RE.test(val) || EXTERNAL_VIDEO_RE.test(val)) return;
            out.push(val);
          }

          function tryParse(raw) {
            if (Array.isArray(raw)) return raw;
            if (!raw) return [];
            if (typeof raw !== 'string') return [];
            try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
          }

          // 合并 local_images 与 media_urls（去重），与房源编辑页保存的 media_urls 同步展示；再无则从朋友圈取
          for (const item of tryParse(prop.local_images)) pushItem(item);
          for (const item of tryParse(prop.media_urls)) pushItem(item);
          if (out.length === 0) {
            const fallback = prop.moment_local_media || prop.moment_media_list;
            if (fallback) {
              for (const item of tryParse(fallback)) pushItem(item);
            }
          }
          return out;
        }

        const images = [];
        for (const prop of (props || [])) {
          const urls = extractImageUrls(prop);
          if (urls.length === 0) continue;

          const propCode = prop.property_code || String(prop.id);
          const safeCommunity = String(grp.community || '未知小区').replace(/[\/\\:*?"<>|]/g, '_');
          const folderName = `${safeCommunity}_${propCode}`;

          for (const url of urls) {
            let displayUrl = url;
            if (!url.startsWith('/')) {
              // 外部链接走图片代理
              displayUrl = `/api/proxy/image?url=${encodeURIComponent(url)}`;
            }
            images.push({
              url: displayUrl,
              original_url: url,
              filename: folderName,
              property_id: prop.id,
              property_code: prop.property_code,
              community: grp.community,
            });
          }
        }

        // 只有有实际图片的小区才返回
        if (images.length > 0) {
          result.push({
            community: grp.community,
            property_count: grp.property_count,
            image_count: images.length,
            images: images.slice(0, 50),
          });
        }
      }

      // 重新计算实际有图片的小区总数
      const actualTotal = result.length < parseInt(pageSize, 10) ? (offset + result.length) : total;
      return success(res, { groups: result, total: actualTotal, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 从指定房源的 media_urls / local_images 中移除一张图（与房源库、小区图片展示同步）
   */
  async removeCommunityPropertyImage(req, res) {
    try {
      const propertyId = parseInt(req.body.property_id, 10);
      const removeUrl = (req.body.original_url || req.body.url || '').trim();
      if (!propertyId || !removeUrl) {
        return error(res, '缺少 property_id 或图片地址', 400);
      }

      const [row] = await query(
        `SELECT id, media_urls, local_images FROM wechat_robot_expat_parsed_properties WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [propertyId]
      );

      if (!row) return error(res, '房源不存在', 404);

      const beforeM = parseJsonMediaArray(row.media_urls).length;
      const beforeL = parseJsonMediaArray(row.local_images).length;
      const nextMedia = filterJsonMediaArrayByUrl(row.media_urls, removeUrl);
      const nextLocal = filterJsonMediaArrayByUrl(row.local_images, removeUrl);
      if (nextMedia.length === beforeM && nextLocal.length === beforeL) {
        return error(res, '未找到对应图片链接', 404);
      }

      await query(
        'UPDATE wechat_robot_expat_parsed_properties SET media_urls = ?, local_images = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(nextMedia), JSON.stringify(nextLocal), propertyId]
      );
      return success(res, { media_count: nextMedia.length }, '已删除该图片');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 向指定房源追加图片（media_urls + local_images 同步，与房源库编辑一致）
   * multipart：file + property_id；或仅 body：property_id + image_url
   */
  async addCommunityPropertyImage(req, res) {
    try {
      const propertyId = parseInt(req.body.property_id, 10);
      if (!propertyId) {
        return error(res, '缺少 property_id', 400);
      }
      const userId = req.user?.id;
      if (!userId) {
        return error(res, '登录状态无效，请重新登录', 401);
      }

      let newUrl = '';
      if (req.file && req.file.buffer) {
        const file = req.file;
        const mime = (file.mimetype || '').toLowerCase();
        if (!mime.startsWith('image/')) {
          return error(res, '请上传图片文件', 400);
        }
        const ext = path.extname(file.originalname || '') || '';
        const uploadPath = config.storage?.uploadPath || process.env.UPLOAD_PATH || 'public/uploads';
        const subdir = 'images';
        const storedFilename = `image_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
        const relPath = path.join(subdir, storedFilename).replace(/\\/g, '/');
        const dirFs = path.join(process.cwd(), uploadPath, subdir);
        await fs.mkdir(dirFs, { recursive: true });
        await fs.writeFile(path.join(dirFs, storedFilename), file.buffer);
        newUrl = `/${uploadPath}/${relPath}`;

        const pool = getPool();
        await pool.execute(
          `INSERT INTO media_files 
            (user_id, filename, stored_filename, file_path, file_url, file_type, mime_type, file_size, alt_text, storage_type, source, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'image', ?, ?, ?, 'local', 'admin_community_property', 'active', NOW(), NOW())`,
          [
            userId,
            file.originalname || storedFilename,
            storedFilename,
            relPath,
            newUrl,
            file.mimetype || 'image/jpeg',
            Number(file.size || file.buffer.length || 0),
            file.originalname || storedFilename,
          ]
        );
      } else {
        const raw = (req.body.image_url || '').trim();
        if (!raw) {
          return error(res, '请上传文件或填写 image_url', 400);
        }
        const urlOk =
          /^https:\/\//i.test(raw) ||
          /^http:\/\//i.test(raw) ||
          (raw.startsWith('/') && !raw.includes('..'));
        if (!urlOk) {
          return error(res, '图片地址仅支持 http(s) 或本站以 / 开头的路径', 400);
        }
        newUrl = raw;
      }

      const [row] = await query(
        `SELECT id, media_urls, local_images FROM wechat_robot_expat_parsed_properties WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [propertyId]
      );
      if (!row) {
        return error(res, '房源不存在', 404);
      }

      let media = parseJsonMediaArray(row.media_urls);
      let local = parseJsonMediaArray(row.local_images);
      const inM = jsonMediaArrayContains(media, newUrl);
      const inL = jsonMediaArrayContains(local, newUrl);
      if (inM && inL) {
        return success(res, { url: newUrl, media_count: media.length, duplicate: true }, '该图片已在该房源中');
      }
      if (!inM) media = [...media, newUrl];
      if (!inL) local = [...local, newUrl];
      await query(
        'UPDATE wechat_robot_expat_parsed_properties SET media_urls = ?, local_images = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(media), JSON.stringify(local), propertyId]
      );
      return success(res, { url: newUrl, media_count: media.length, duplicate: false }, '已添加图片');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getMediaStats(req, res) {
    try {
      const [r1] = await query("SELECT COUNT(*) as c FROM media_files WHERE status = 'active'");
      const [r2] = await query("SELECT COUNT(*) as c FROM media_files WHERE status = 'active' AND file_type = 'image'");
      const [r3] = await query("SELECT COUNT(*) as c FROM media_files WHERE status = 'active' AND (file_type = 'video' OR file_type = 'audio')");
      const [r4] = await query("SELECT COALESCE(SUM(file_size),0) as s FROM media_files WHERE status = 'active'");
      const sources = await query("SELECT source, COUNT(*) as count FROM media_files WHERE status = 'active' AND source IS NOT NULL GROUP BY source ORDER BY count DESC");
      const plugins = await query("SELECT plugin_slug, COUNT(*) as count FROM media_files WHERE status = 'active' AND plugin_slug IS NOT NULL AND plugin_slug != '' GROUP BY plugin_slug ORDER BY count DESC");
      return success(res, {
        total_files: r1?.c || 0,
        image_count: r2?.c || 0,
        video_audio_count: r3?.c || 0,
        total_size: r4?.s || 0,
        sources: sources || [],
        plugins: plugins || []
      });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new MediaController();
