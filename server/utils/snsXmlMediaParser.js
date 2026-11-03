/**
 * 朋友圈 sns 媒体 URL 解析（weiti /sns/snsList 等）
 * 优先使用接口 JSON 中的媒体数组，再回退解析 snsXml，兼容多种 XML 形态。
 */

const VIDEO_EXT_RE = /\.(mp4|mov|avi|m4v|webm|ogg)(\?|$)/i;

function normalizeMediaUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  return url
    .replace(/^http:\/\/mmsns\.qpic\.cn/i, 'https://mmsns.qpic.cn')
    .replace(/^http:\/\/shmmsns\.qpic\.cn/i, 'https://shmmsns.qpic.cn');
}

function dedupePreserveOrder(urls) {
  const seen = new Set();
  const out = [];
  for (const raw of urls) {
    const u = normalizeMediaUrl(raw);
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function normalizeMediaItem(item) {
  if (!item) return '';
  if (typeof item === 'string') return normalizeMediaUrl(item);
  if (typeof item === 'object') {
    return normalizeMediaUrl(
      item.url || item.thumb || item.cdnUrl || item.src || item.file_url || item.imageUrl || ''
    );
  }
  return '';
}

/**
 * 从 snsXml 提取媒体 URL
 */
function parseMediaUrlsFromSnsXml(snsXml) {
  if (!snsXml || typeof snsXml !== 'string') return [];
  const urls = [];
  const seen = new Set();
  function push(u) {
    const t = normalizeMediaUrl(u);
    if (!t || seen.has(t)) return;
    if (!/^https?:\/\//i.test(t)) return;
    seen.add(t);
    urls.push(t);
  }
  try {
    const reMediaBlock = /<media>[\s\S]*?<url[^>]*><!\[CDATA\[(.*?)\]\]><\/url>[\s\S]*?<\/media>/g;
    let m;
    while ((m = reMediaBlock.exec(snsXml)) !== null) {
      if (m[1]) push(m[1]);
    }
    const reCdataUrl = /<url[^>]*><!\[CDATA\[(https?:\/\/[^\]]+)\]\]><\/url>/gi;
    while ((m = reCdataUrl.exec(snsXml)) !== null) {
      if (m[1]) push(m[1]);
    }
    const rePlainUrl = /<url[^>]*>(https?:\/\/[^<\s]+)<\/url>/gi;
    while ((m = rePlainUrl.exec(snsXml)) !== null) {
      if (m[1]) push(m[1]);
    }
  } catch { /* ignore */ }
  return urls;
}

/**
 * 从单条 sns 提取媒体 URL（JSON 字段优先，其次 snsXml）
 */
function extractMomentMediaUrlsFromSns(sns) {
  if (!sns || typeof sns !== 'object') {
    return parseMediaUrlsFromSnsXml('');
  }
  const jsonKeys = [
    'mediaList', 'media_list', 'images', 'imageList', 'picList',
    'snsImg', 'mediaUrls', 'urls', 'imageUrls', 'thumbUrls',
  ];
  for (const key of jsonKeys) {
    const val = sns[key];
    if (!Array.isArray(val) || !val.length) continue;
    const collected = [];
    for (const it of val) {
      const u = normalizeMediaItem(it);
      if (u && /^https?:\/\//i.test(u)) collected.push(u);
    }
    if (collected.length) return dedupePreserveOrder(collected);
  }

  // 回退：优先从 snsXml 提取普通媒体，再合并收藏笔记（noteinfo）中的真实图片
  let urls = parseMediaUrlsFromSnsXml(sns.snsXml || '');
  if (urls.length === 0 && (sns.snsXml || '').includes('<noteinfo>')) {
    const note = parseFavoriteNoteFromXml(sns.snsXml);
    if (note.mediaUrls.length) {
      // noteinfo 里 CDN key 格式（无 http）的图片不加入，微信笔记封面本身不应作为房源图片
      urls = note.mediaUrls.filter(u => /^https?:\/\//i.test(u));
    }
  }
  return urls;
}

/**
 * 解析媒体数组（兼容 JSON 字符串和数组）
 */
function parseMediaArray(mediaUrls) {
  if (mediaUrls == null || mediaUrls === '') return [];
  let arr = mediaUrls;
  if (typeof mediaUrls === 'string') {
    try { arr = JSON.parse(mediaUrls); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (typeof item === 'string') return normalizeMediaUrl(item);
    if (item && typeof item === 'object') {
      return {
        ...item,
        url: normalizeMediaUrl(item.url || ''),
        thumb: normalizeMediaUrl(item.thumb || ''),
        file_url: normalizeMediaUrl(item.file_url || ''),
      };
    }
    return item;
  });
}

/**
 * 统计有效图片数量（排除视频）
 */
function countNonVideoMedia(mediaUrls) {
  const arr = parseMediaArray(mediaUrls);
  let count = 0;
  for (const item of arr) {
    const url = typeof item === 'string' ? item : (item && (item.url || item.thumb || item.file_url)) || '';
    const u = normalizeMediaUrl(url);
    if (u && !VIDEO_EXT_RE.test(u)) count++;
  }
  return count;
}

/**
 * 列表封面：首个非视频媒体 URL
 * 当朋友圈只有 1 张图（非视频）时返回空串，由调用方使用默认封面
 */
function pickFirstNonVideoMediaUrl(mediaUrls) {
  const arr = parseMediaArray(mediaUrls);
  if (!arr.length) return '';
  const nonVideoUrls = [];
  for (const item of arr) {
    const url = typeof item === 'string' ? item : (item && (item.url || item.thumb || item.file_url)) || '';
    const u = normalizeMediaUrl(url);
    if (u && !VIDEO_EXT_RE.test(u)) nonVideoUrls.push(u);
  }
  if (nonVideoUrls.length <= 1) return '';
  return nonVideoUrls[0];
}

/**
 * 从数据库读取后台设置的默认封面图 URL
 * key 兼容 default_property_cover_image 和 default_property_cover
 */
const DEFAULT_COVER_SETTING_KEY = 'default_property_cover_image';
const DEFAULT_COVER_SETTING_KEY_ALT = 'default_property_cover';
let _cachedDefaultCover = null;
let _cachedDefaultCoverTs = 0;
const DEFAULT_COVER_CACHE_MS = 5 * 60 * 1000;

async function getDefaultCoverImage(queryFn) {
  if (_cachedDefaultCover !== null && Date.now() - _cachedDefaultCoverTs < DEFAULT_COVER_CACHE_MS) {
    return _cachedDefaultCover;
  }
  const fallback = '/images/no-image.png';
  try {
    const rows = await queryFn(
      `SELECT setting_value FROM system_settings WHERE setting_key IN (?, ?) AND setting_value IS NOT NULL AND setting_value != '' LIMIT 1`,
      [DEFAULT_COVER_SETTING_KEY, DEFAULT_COVER_SETTING_KEY_ALT]
    );
    const result = Array.isArray(rows[0]) && Array.isArray(rows[0]) ? rows[0] : rows;
    const val = result?.[0]?.setting_value || fallback;
    _cachedDefaultCover = val;
    _cachedDefaultCoverTs = Date.now();
    return val;
  } catch {
    return fallback;
  }
}

/**
 * 从 snsXml 中提取 contentStyle 值
 */
function parseContentStyleFromXml(snsXml) {
  if (!snsXml || typeof snsXml !== 'string') return 1;
  const m1 = snsXml.match(/<contentStyle><!\[CDATA\[(\d+)\]\]><\/contentStyle>/);
  if (m1) return parseInt(m1[1], 10) || 1;
  const m2 = snsXml.match(/<contentStyle>(\d+)<\/contentStyle>/);
  if (m2) return parseInt(m2[1], 10) || 1;
  return 1;
}

/**
 * 从 snsXml 的 <ContentObject><title> 中提取标题
 */
function parseTitleFromXml(snsXml) {
  if (!snsXml) return '';
  const m1 = snsXml.match(/<ContentObject>[\s\S]*?<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/);
  if (m1 && m1[1]) return m1[1].trim();
  const m2 = snsXml.match(/<ContentObject>[\s\S]*?<title>([\s\S]*?)<\/title>/);
  if (m2 && m2[1]) return m2[1].trim();
  return '';
}

/**
 * 解析收藏笔记（favorite note）中的文本和图片。
 * contentStyle=26 的朋友圈，正文在 <noteinfo><datalist><dataitem> 里。
 * datatype="1" -> 文本（<datadesc> 中）
 * datatype="2" -> 图片（<cdndataurl>/<cdnthumburl>中）
 * datatype="4" -> 视频
 * datatype="6" -> 位置（<locitem> 中的 <label>/<poiname>）
 *
 * 返回 { text: string, mediaUrls: string[], locations: string[] }
 */
function parseFavoriteNoteFromXml(snsXml) {
  const result = { text: '', mediaUrls: [], locations: [] };
  if (!snsXml || typeof snsXml !== 'string') return result;
  if (!snsXml.includes('<noteinfo>')) return result;

  const noteMatch = snsXml.match(/<noteinfo>([\s\S]*?)<\/noteinfo>/);
  if (!noteMatch) return result;
  const noteXml = noteMatch[1];

  const textParts = [];
  const mediaUrls = [];
  const locations = [];

  const dataItemRe = /<dataitem\s[^>]*datatype="(\d+)"[^>]*>([\s\S]*?)<\/dataitem>/g;
  let m;
  while ((m = dataItemRe.exec(noteXml)) !== null) {
    const datatype = m[1];
    const inner = m[2];

    if (datatype === '1') {
      const descMatch = inner.match(/<datadesc><!\[CDATA\[([\s\S]*?)\]\]><\/datadesc>/) ||
                         inner.match(/<datadesc>([\s\S]*?)<\/datadesc>/);
      if (descMatch && descMatch[1] && descMatch[1].trim()) {
        textParts.push(descMatch[1].trim().replace(/&#x0A;/g, '\n').replace(/&amp;/g, '&'));
      }
    } else if (datatype === '2') {
      // 笔记里的图片没有 http URL，只有 CDN key，暂从 <url> 和 thumb 取
      const urlMatch = inner.match(/<url[^>]*><!\[CDATA\[(https?:\/\/[^\]]+)\]\]><\/url>/) ||
                       inner.match(/<url[^>]*>(https?:\/\/[^<\s]+)<\/url>/);
      if (urlMatch && urlMatch[1]) mediaUrls.push(normalizeMediaUrl(urlMatch[1]));
      const thumbMatch = inner.match(/<thumb[^>]*><!\[CDATA\[(https?:\/\/[^\]]+)\]\]><\/thumb>/) ||
                         inner.match(/<thumb[^>]*>(https?:\/\/[^<\s]+)<\/thumb>/);
      if (thumbMatch && thumbMatch[1] && !mediaUrls.includes(normalizeMediaUrl(thumbMatch[1]))) {
        mediaUrls.push(normalizeMediaUrl(thumbMatch[1]));
      }
    } else if (datatype === '6') {
      const labelMatch = inner.match(/<label>([\s\S]*?)<\/label>/);
      const poiMatch = inner.match(/<poiname>([\s\S]*?)<\/poiname>/);
      const loc = (poiMatch && poiMatch[1] ? poiMatch[1].trim() : '') +
                  (labelMatch && labelMatch[1] ? ' ' + labelMatch[1].trim() : '');
      if (loc.trim()) locations.push(loc.trim());
    }
  }

  result.text = textParts.join('\n');
  result.mediaUrls = dedupePreserveOrder(mediaUrls);
  result.locations = locations;
  return result;
}

/**
 * 从 snsXml 中全面提取内容文本（支持 contentDesc + 收藏笔记 title/datadesc）
 * 对于收藏笔记(contentStyle=26)，即使contentDesc非空也要合并noteinfo内容
 */
function parseFullContentFromXml(snsXml) {
  if (!snsXml || typeof snsXml !== 'string') return '';
  let contentDesc = '';
  const m1 = snsXml.match(/<contentDesc><!\[CDATA\[([\s\S]*?)\]\]><\/contentDesc>/);
  if (m1 && m1[1] && m1[1].trim()) {
    contentDesc = m1[1].trim().replace(/&#x0A;/g, '\n').replace(/&amp;/g, '&');
  }
  if (!contentDesc) {
    const m2 = snsXml.match(/<contentDesc>([\s\S]*?)<\/contentDesc>/);
    if (m2 && m2[1] && m2[1].trim()) {
      contentDesc = m2[1].trim().replace(/&#x0A;/g, '\n').replace(/&amp;/g, '&');
    }
  }

  // 检查是否含有收藏笔记 noteinfo
  const hasNoteinfo = snsXml.includes('<noteinfo>');
  if (hasNoteinfo) {
    const title = parseTitleFromXml(snsXml);
    const note = parseFavoriteNoteFromXml(snsXml);
    const parts = [];
    if (title && !title.includes('不支持展示该内容')) parts.push(title);
    if (note.text) parts.push(note.text);
    if (note.locations.length) parts.push(note.locations.join(' | '));
    const noteText = parts.join('\n');

    if (noteText) {
      // 如果contentDesc是noteText的子串或相同，直接用noteText（更完整）
      if (!contentDesc || noteText.length >= contentDesc.length) return noteText;
      // 如果contentDesc有额外信息且noteText也有独有内容，合并
      if (!contentDesc.includes(noteText.substring(0, Math.min(20, noteText.length)))) {
        return contentDesc + '\n' + noteText;
      }
      return noteText;
    }
  }

  if (contentDesc) return contentDesc;

  // 兜底：非收藏笔记且contentDesc为空
  const title = parseTitleFromXml(snsXml);
  if (title && !title.includes('不支持展示该内容')) return title;
  return '';
}

module.exports = {
  parseMediaUrlsFromSnsXml,
  extractMomentMediaUrlsFromSns,
  pickFirstNonVideoMediaUrl,
  countNonVideoMedia,
  getDefaultCoverImage,
  parseFavoriteNoteFromXml,
  parseContentStyleFromXml,
  parseTitleFromXml,
  parseFullContentFromXml,
};
