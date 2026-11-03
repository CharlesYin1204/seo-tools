/**
 * 房源媒体URL合并工具
 * 与 admin PropertyLibraryController 列表逻辑一致：
 * 当 media_urls 为空时，从关联朋友圈 wechat_robot_moments 补全媒体。
 */

function parseJsonSafe(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 将朋友圈媒体合并进 row.media_urls（仅当 media_urls 无有效项时）
 * 并清理临时 JOIN 字段 moment_media_list / moment_local_media
 */
function mergeMomentMedia(row) {
  if (!row) return row;

  if (row.media_urls && typeof row.media_urls === 'string') {
    try { row.media_urls = JSON.parse(row.media_urls); } catch { row.media_urls = []; }
  }

  if (!Array.isArray(row.media_urls) || !row.media_urls.length) {
    row.media_urls = [];
    const fallback = row.moment_local_media || row.moment_media_list
      || row.moment_local_media2 || row.moment_media_list2;
    if (fallback) {
      const arr = parseJsonSafe(fallback);
      if (arr.length) {
        row.media_urls = arr
          .map(u => typeof u === 'string' ? u : (u?.url || u?.thumb || u?.file_url || ''))
          .filter(Boolean);
      }
    }
  }

  delete row.moment_media_list;
  delete row.moment_local_media;
  delete row.moment_media_list2;
  delete row.moment_local_media2;
  return row;
}

module.exports = { mergeMomentMedia };
