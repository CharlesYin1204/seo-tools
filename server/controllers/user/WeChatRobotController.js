/**
 * 用户端-微信机器人控制器
 * 处理微信账号管理、通讯录、消息、群组、朋友圈等功能
 */
const WeChatRobotAccount = require('../../models/WeChatRobotAccount');
const WeChatRobotContact = require('../../models/WeChatRobotContact');
const WeChatRobotMessage = require('../../models/WeChatRobotMessage');
const WeChatRobotGroup = require('../../models/WeChatRobotGroup');
const WeChatRobotMoment = require('../../models/WeChatRobotMoment');
const WeChatRobotAutoReply = require('../../models/WeChatRobotAutoReply');
const WeChatRobotMaterial = require('../../models/WeChatRobotMaterial');
const WeChatRobotScheduledTask = require('../../models/WeChatRobotScheduledTask');
const WeChatRobotService = require('../../services/WeChatRobotService');
const { extractMomentMediaUrlsFromSns, parseFavoriteNoteFromXml, parseContentStyleFromXml, parseFullContentFromXml } = require('../../utils/snsXmlMediaParser');
const { success, error, paginated } = require('../../utils/response');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const favoriteMediaJobs = new Set();
const favoriteMediaFailures = new Map();
const FAVORITE_MEDIA_FAILURE_TTL_MS = 60 * 60 * 1000;

function _detectImageExtension(buffer) {
  if (!buffer || buffer.length < 12) return '';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'gif';
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'bmp';
  return '';
}

function _decodeHtmlEntities(text) {
  if (!text) return text;
  return String(text)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      if (code === 0x0A) return '\n';
      if (code === 0x0D) return '';
      if (code < 0x20 && code !== 0x09) return '';
      return String.fromCodePoint(code);
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      if (code === 10) return '\n';
      if (code === 13) return '';
      if (code < 32 && code !== 9) return '';
      return String.fromCodePoint(code);
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * 获取有效的API配置（优先用户自己的，其次全局配置 user_id=0）
 */
async function getEffectiveApiConfig(userId) {
  let config = await WeChatRobotService.getApiConfig(userId);
  if (config && config.api_url) return config;
  const { query: dbQuery } = require('../../config/database');
  const rows = await dbQuery('SELECT * FROM wechat_robot_api_config WHERE user_id = 0 LIMIT 1');
  if (rows && rows.length > 0 && rows[0].api_url) {
    return rows[0];
  }
  return null;
}

/**
 * 判定contact_type（兼容数据库枚举）
 */
function resolveContactType(wxid) {
  if (!wxid) return 'friend';
  if (wxid.endsWith('@chatroom')) return 'group_member';
  if (wxid.startsWith('gh_')) return 'official';
  return 'friend';
}


function _normalizeFavoriteText(text) {
  if (!text) return '';
  return _decodeHtmlEntities(String(text))
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function _isReadableFavoriteText(text) {
  const value = _normalizeFavoriteText(text);
  if (!value) return false;
  if (/^\d+(\.\d+)?\s*(KB|MB|GB|B)$/i.test(value)) return false;
  if (/^[a-f0-9]{16,}$/i.test(value)) return false;
  if (/^[a-z0-9_-]+\.html?$/i.test(value)) return false;
  if (/^wxid_/i.test(value) || /^gh_/i.test(value)) return false;
  if (/^Adb[a-f0-9]+$/i.test(value)) return false;
  if (/^\d{8,}$/.test(value)) return false;
  if (/^(0|false|null|undefined)$/i.test(value)) return false;
  return /[\u4e00-\u9fa5A-Za-z]/.test(value);
}

function _extractXmlTagValues(xml, tagName) {
  const values = [];
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  let match;
  while ((match = re.exec(xml)) !== null) {
    const value = _normalizeFavoriteText(match[1]);
    if (_isReadableFavoriteText(value)) values.push(value);
  }
  return values;
}

function _extractRawXmlTagValues(xml, tagName) {
  const values = [];
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  let match;
  while ((match = re.exec(String(xml || ''))) !== null) {
    const value = _decodeHtmlEntities(String(match[1] || ''))
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .trim();
    if (value) values.push(value);
  }
  return values;
}

function extractFavoriteDisplayContent(rawContent) {
  if (!rawContent) return '';
  const xml = _decodeHtmlEntities(String(rawContent));
  const textBlocks = [
    ..._extractXmlTagValues(xml, 'desc'),
    ..._extractXmlTagValues(xml, 'datadesc'),
    ..._extractXmlTagValues(xml, 'pagetitle'),
    ..._extractXmlTagValues(xml, 'datatitle'),
    ..._extractXmlTagValues(xml, 'title'),
  ];
  const uniqueBlocks = [];
  for (const block of textBlocks) {
    const coveredIndex = uniqueBlocks.findIndex((item) => item === block || item.includes(block) || block.includes(item));
    if (coveredIndex >= 0) {
      if (block.length > uniqueBlocks[coveredIndex].length) uniqueBlocks[coveredIndex] = block;
    } else {
      uniqueBlocks.push(block);
    }
  }
  return uniqueBlocks.join('\n\n').slice(0, 1200);
}

function extractFavoriteMediaUrls(rawContent) {
  if (!rawContent) return [];
  const xml = _decodeHtmlEntities(String(rawContent));
  const urls = [];
  const tags = ['url', 'thumburl', 'thumb_url', 'pagethumb_url', 'cdn_thumburl', 'cdn_dataurl', 'stream_weburl', 'dataext'];
  for (const tag of tags) {
    for (const value of _extractXmlTagValues(xml, tag)) {
      if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp)(\?.*)?$/i.test(value) || /^\/.+\.(png|jpe?g|gif|webp|bmp)(\?.*)?$/i.test(value)) {
        urls.push(value);
      }
    }
  }
  return [...new Set(urls)];
}

function _safeJsonArray(value) {
  try {
    if (!value) return [];
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function _extractFavoriteSourceKeys(rawContent) {
  const xml = String(rawContent || '');
  const keys = [];
  for (const tagName of ['sourceid', 'eventid']) {
    for (const value of _extractRawXmlTagValues(xml, tagName)) {
      if (value) keys.push(value);
      if (value.includes('#')) keys.push(...value.split('#').filter(Boolean));
    }
  }
  return [...new Set(keys.map((key) => String(key).trim()).filter(Boolean))];
}


function _appendMomentMediaUrls(target, row) {
  if (!row) return;
  target.push(..._safeJsonArray(row.media_list));
  target.push(..._safeJsonArray(row.local_media_urls));
  target.push(..._safeJsonArray(row.fav_media_list));
}

function _sourceMomentPrefixes(keys) {
  return [...new Set(
    keys
      .filter((key) => /^\d{12,}$/.test(key))
      .map((key) => key.slice(0, 14))
      .filter(Boolean)
  )].slice(0, 6);
}

async function findFavoriteSourceMediaUrls(robotId, rawContent, displayContent = '', favId = null) {
  const { query: dbQuery } = require('../../config/database');
  const keys = _extractFavoriteSourceKeys(rawContent).slice(0, 6);
  const mediaUrls = [];
  if (favId) {
    const favRows = await dbQuery(
      'SELECT media_list, local_media_urls, fav_media_list FROM wechat_robot_moments WHERE robot_id = ? AND fav_id = ? ORDER BY created_at DESC LIMIT 1',
      [robotId, favId]
    ).catch(() => []);
    _appendMomentMediaUrls(mediaUrls, favRows?.[0]);
  }
  if (keys.length && !mediaUrls.length) {
    const numericKeys = keys.filter((key) => /^\d+$/.test(key)).slice(0, 6);
    if (numericKeys.length) {
      const rows = await dbQuery(
        'SELECT media_list, local_media_urls, fav_media_list FROM wechat_robot_moments WHERE robot_id = ? AND moment_id IN (' + numericKeys.map(() => '?').join(',') + ') ORDER BY created_at DESC LIMIT 1',
        [robotId, ...numericKeys]
      ).catch(() => []);
      _appendMomentMediaUrls(mediaUrls, rows?.[0]);
    }
  }
  if (keys.length && !mediaUrls.length) {
    const prefixes = _sourceMomentPrefixes(keys);
    if (prefixes.length) {
      const rows = await dbQuery(
        'SELECT media_list, local_media_urls, fav_media_list FROM wechat_robot_moments WHERE robot_id = ? AND (' + prefixes.map(() => 'moment_id LIKE ?').join(' OR ') + ') ORDER BY created_at DESC LIMIT 1',
        [robotId, ...prefixes.map((prefix) => prefix + '%')]
      ).catch(() => []);
      _appendMomentMediaUrls(mediaUrls, rows?.[0]);
    }
  }
  return [...new Set(mediaUrls)].filter((url) => /^https?:\/\//i.test(url) || /^\/uploads\//i.test(url));
}
function getCachedFavoriteMediaUrls(rawContent, robotId, favId, limit = 9) {
  const items = _extractFavoriteImageItems(rawContent, limit);
  const urls = [];
  const publicDir = path.join(__dirname, '..', '..', '..', 'public', 'uploads', 'wechat-favorites', String(robotId), String(favId));
  for (let i = 0; i < items.length; i += 1) {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']) {
      const cachedUrl = `/uploads/wechat-favorites/${robotId}/${favId}/${i}_${items[i].key}.${ext}`;
      const cachedPath = path.join(publicDir, `${i}_${items[i].key}.${ext}`);
      if (fs.existsSync(cachedPath)) {
        const detectedExt = _detectImageExtension(fs.readFileSync(cachedPath, { flag: 'r' }));
        if (detectedExt) urls.push(cachedUrl);
        else fs.unlinkSync(cachedPath);
        break;
      }
    }
  }
  return urls;
}

function _extractXmlTagValue(block, tagName) {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = String(block || '').match(re);
  return match ? _decodeHtmlEntities(match[1]).trim() : '';
}

function _escapeXmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function _extractFavoriteImageItems(rawContent, limit = 9) {
  if (!rawContent) return [];
  const xml = _decodeHtmlEntities(String(rawContent));
  const items = [];
  const re = /<dataitem\b[^>]*\bdatatype=["']?2["']?[^>]*>[\s\S]*?<\/dataitem>/gi;
  let match;
  while ((match = re.exec(xml)) !== null && items.length < limit) {
    const itemXml = match[0];
    const cdnDataUrl = _extractXmlTagValue(itemXml, 'cdn_dataurl');
    const cdnDataKey = _extractXmlTagValue(itemXml, 'cdn_datakey');
    const cdnThumbUrl = _extractXmlTagValue(itemXml, 'cdn_thumburl');
    const cdnThumbKey = _extractXmlTagValue(itemXml, 'cdn_thumbkey');
    const fullMd5 = _extractXmlTagValue(itemXml, 'fullmd5');
    const fullSize = _extractXmlTagValue(itemXml, 'fullsize');
    const thumbSize = _extractXmlTagValue(itemXml, 'thumbfullsize') || _extractXmlTagValue(itemXml, 'thumbsize');
    const thumbWidth = _extractXmlTagValue(itemXml, 'thumb_width');
    const thumbHeight = _extractXmlTagValue(itemXml, 'thumb_height');
    const dataFmt = _extractXmlTagValue(itemXml, 'datafmt') || 'jpg';
    if (!cdnDataUrl && !cdnThumbUrl) continue;
    const aesKey = cdnDataKey || cdnThumbKey;
    const thumbAesKey = cdnThumbKey || cdnDataKey;
    const thumbUrl = cdnThumbUrl || cdnDataUrl;
    const dataUrl = cdnDataUrl || cdnThumbUrl;
    items.push({
      xml: `<?xml version="1.0"?>\n<msg>\n\t<img aeskey="${_escapeXmlAttr(aesKey)}" encryver="1" cdnthumbaeskey="${_escapeXmlAttr(thumbAesKey)}" cdnthumburl="${_escapeXmlAttr(thumbUrl)}" cdnthumblength="${_escapeXmlAttr(thumbSize || 0)}" cdnthumbheight="${_escapeXmlAttr(thumbHeight || 0)}" cdnthumbwidth="${_escapeXmlAttr(thumbWidth || 0)}" cdnmidheight="0" cdnmidwidth="0" cdnhdheight="0" cdnhdwidth="0" cdnmidimgurl="${_escapeXmlAttr(dataUrl)}" length="${_escapeXmlAttr(fullSize || 0)}" cdnbigimgurl="${_escapeXmlAttr(dataUrl)}" hdlength="${_escapeXmlAttr(fullSize || 0)}" md5="${_escapeXmlAttr(fullMd5)}" originsourcemd5="${_escapeXmlAttr(fullMd5)}">\n\t\t<live><duration>0</duration><size>0</size><md5 /><fileid /><hdsize>0</hdsize><hdmd5 /><hdfileid /><stillimagetimems>0</stillimagetimems></live>\n\t</img>\n\t<platform_signature />\n\t<imgdatahash />\n\t<ImgSourceInfo><ImgSourceUrl /><BizType>0</BizType></ImgSourceInfo>\n</msg>`,
      key: `${fullMd5 || cdnDataKey || cdnThumbKey || cdnDataUrl || cdnThumbUrl}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80),
    });
  }
  return items;
}

function _extractDownloadedImageUrl(result) {
  const data = result?.data || result || {};
  const candidates = [
    data.fileUrl, data.file_url, data.url, data.imageUrl, data.imgUrl,
    data.path, data.filePath, data.file_path, data.downloadUrl, data.download_url,
    data?.data?.fileUrl, data?.data?.url, data?.data?.imageUrl,
  ];
  return candidates.find((url) => typeof url === 'string' && /^https?:\/\//i.test(url)) || '';
}

async function _cacheRemoteFavoriteImage(remoteUrl, robotId, favId, index, key) {
  const safeKey = key || `${Date.now()}_${index}`;
  const relativeDir = `/uploads/wechat-favorites/${robotId}/${favId}`;
  const publicDir = path.join(__dirname, '..', '..', '..', 'public', 'uploads', 'wechat-favorites', String(robotId), String(favId));
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']) {
    const existingName = `${index}_${safeKey}.${ext}`;
    const existingPath = path.join(publicDir, existingName);
    if (fs.existsSync(existingPath) && _detectImageExtension(fs.readFileSync(existingPath, { flag: 'r' }))) {
      return `${relativeDir}/${existingName}`;
    }
  }
  fs.mkdirSync(publicDir, { recursive: true });
  const response = await axios.get(remoteUrl, { responseType: 'arraybuffer', timeout: 60000 });
  const buffer = Buffer.from(response.data);
  const ext = _detectImageExtension(buffer);
  if (!ext) throw new Error('下载结果不是可预览图片');
  const fileName = `${index}_${safeKey}.${ext}`;
  const filePath = path.join(publicDir, fileName);
  const publicUrl = `${relativeDir}/${fileName}`;
  fs.writeFileSync(filePath, buffer);
  return publicUrl;
}

async function hydrateFavoriteMediaUrls(req, robotId, favorites) {
  const candidates = (favorites || []).filter((item) => item?.content && hasFavoriteMedia(item.content));
  if (!candidates.length) return favorites;

  let account = await WeChatRobotAccount.getAccountWithApiConfig(robotId, req.user.id, isAdminUser(req));
  if (!account && isAdminUser(req)) account = await WeChatRobotAccount.findById(robotId);
  if (!account) return favorites;
  const config = await getEffectiveApiConfig(isAdminUser(req) ? account.user_id : req.user.id);
  const appId = account.device_id || account.app_id || '';
  if (!config?.api_url || !appId) return favorites;

  for (const item of candidates.slice(0, 3)) {
    if (Array.isArray(item.media_urls) && item.media_urls.length) continue;
    const sourceMediaUrls = await findFavoriteSourceMediaUrls(robotId, item.content, item.display_content, item.fav_id);
    if (sourceMediaUrls.length) {
      item.media_urls = sourceMediaUrls;
      item.media_status = 'ready';
      continue;
    }
    const imageItems = _extractFavoriteImageItems(item.content, 3);
    const urls = [];
    for (let i = 0; i < imageItems.length; i += 1) {
      try {
        const imageItem = imageItems[i];
        const failureKey = `${robotId}:${item.fav_id}:${imageItem.key}`;
        const lastFailureAt = favoriteMediaFailures.get(failureKey) || 0;
        if (lastFailureAt && Date.now() - lastFailureAt < FAVORITE_MEDIA_FAILURE_TTL_MS) continue;
        const cachedUrls = getCachedFavoriteMediaUrls(item.content, robotId, item.fav_id, i + 1);
        const cachedUrl = cachedUrls.find((url) => url.includes(`/${i}_${imageItem.key}.`));
        if (cachedUrl) {
          urls.push(cachedUrl);
          continue;
        }
        let downloadResult = null;
        let remoteUrl = '';
        for (const imageType of [1, 2, 3]) {
          downloadResult = await WeChatRobotService.downloadImage(config.api_url, config.token, appId, imageItem.xml, imageType);
          remoteUrl = _extractDownloadedImageUrl(downloadResult);
          if (remoteUrl) break;
        }
        if (!remoteUrl) {
          logger.warn('收藏图片下载接口未返回图片地址', { robotId, favId: item.fav_id, ret: downloadResult?.ret, msg: downloadResult?.msg });
          favoriteMediaFailures.set(failureKey, Date.now());
          continue;
        }
        urls.push(await _cacheRemoteFavoriteImage(remoteUrl, robotId, item.fav_id, i, imageItem.key));
      } catch (downloadError) {
        const imageItem = imageItems[i] || {};
        if (imageItem.key) favoriteMediaFailures.set(`${robotId}:${item.fav_id}:${imageItem.key}`, Date.now());
        logger.warn('收藏图片缓存失败', { robotId, favId: item.fav_id, error: downloadError.message });
      }
    }
    item.media_urls = urls;
    item.media_status = urls.length ? 'ready' : 'unavailable';
  }
  return favorites;
}

function queueFavoriteMediaHydration(req, robotId, favorites) {
  const jobKey = `${robotId}:${(favorites || []).map((item) => item.fav_id).join(',')}`;
  if (favoriteMediaJobs.has(jobKey)) return;
  favoriteMediaJobs.add(jobKey);
  const safeReq = {
    user: { id: req.user.id, role: req.user.role },
  };
  setImmediate(async () => {
    try {
      await hydrateFavoriteMediaUrls(safeReq, robotId, favorites);
    } catch (jobError) {
      logger.warn('收藏图片后台缓存任务失败', { robotId, error: jobError.message });
    } finally {
      favoriteMediaJobs.delete(jobKey);
    }
  });
}

async function attachFavoriteSourceMediaUrls(robotId, favorites) {
  const pending = (favorites || []).filter((row) => row.has_media && (!row.media_urls || !row.media_urls.length));
  if (!pending.length) return;
  const prefixMap = new Map();
  for (const item of pending) {
    const prefixes = _sourceMomentPrefixes(_extractFavoriteSourceKeys(item.content));
    for (const prefix of prefixes) {
      if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
      prefixMap.get(prefix).push(item);
    }
  }
  const prefixes = [...prefixMap.keys()].slice(0, 30);
  if (!prefixes.length) return;
  const { query: dbQuery } = require('../../config/database');
  const rows = await dbQuery(
    'SELECT moment_id, media_list, local_media_urls, fav_media_list FROM wechat_robot_moments WHERE robot_id = ? AND (' + prefixes.map(() => 'moment_id LIKE ?').join(' OR ') + ') ORDER BY created_at DESC LIMIT ' + prefixes.length,
    [robotId, ...prefixes.map((prefix) => prefix + '%')]
  ).catch(() => []);
  for (const row of rows || []) {
    const matchedPrefix = prefixes.find((prefix) => String(row.moment_id || '').startsWith(prefix));
    if (!matchedPrefix) continue;
    const urls = [];
    _appendMomentMediaUrls(urls, row);
    const uniqueUrls = [...new Set(urls)].filter((url) => /^https?:\/\//i.test(url) || /^\/uploads\//i.test(url));
    if (!uniqueUrls.length) continue;
    for (const item of prefixMap.get(matchedPrefix) || []) {
      if (!item.media_urls || !item.media_urls.length) {
        item.media_urls = uniqueUrls;
        item.media_status = 'ready';
      }
    }
  }
}
function hasFavoriteMedia(rawContent) {
  if (!rawContent) return false;
  const xml = String(rawContent);
  return /<dataitem\b[^>]*\bdatatype=["']?(2|4|15|16)["']?/i.test(xml)
    || /<(cdn_thumburl|cdn_dataurl|thumburl|pagethumb_url)>[\s\S]*?<\/\1>/i.test(xml);
}

function resolveFavoriteTypeClass(type) {
  const numeric = Number(type);
  if (numeric === 2) return 'image';
  if (numeric === 4 || numeric === 16) return 'video';
  if (numeric === 5 || numeric === 7) return 'link';
  if (numeric === 6 || numeric === 8) return 'file';
  if (numeric === 18) return 'note';
  return 'text';
}

function parseFavoriteSettings(settings) {
  try {
    if (!settings) return {};
    return typeof settings === 'string' ? JSON.parse(settings) : settings;
  } catch {
    return {};
  }
}

function parseBlockedFlag(detail = {}) {
  const directFlagKeys = ['is_blocked', 'isBlocked', 'is_block', 'isBlock', 'blocked', 'blacklist', 'in_blacklist', 'isInBlackList'];
  for (const key of directFlagKeys) {
    if (detail[key] === true || detail[key] === 1 || detail[key] === '1') return 1;
  }
  const denyFlagKeys = ['canSeeMoments', 'can_view_moments', 'momentsVisible', 'canSeeFriendCircle', 'canSeeTimeline'];
  for (const key of denyFlagKeys) {
    if (Object.prototype.hasOwnProperty.call(detail, key)) {
      const v = detail[key];
      if (v === false || v === 0 || v === '0' || String(v).toLowerCase() === 'false') return 1;
    }
  }
  const permission = detail.snsPermission ?? detail.momentsPermission ?? detail.circlePermission ?? detail.timelinePermission;
  if (typeof permission === 'string' && /(deny|block|hidden|forbid)/i.test(permission)) return 1;
  return 0;
}

async function loadBlockedWxidSet(robotId) {
  const { query: dbQuery } = require('../../config/database');
  const rows = await dbQuery(
    'SELECT wxid FROM wechat_robot_contacts WHERE robot_id = ? AND is_blocked = 1',
    [robotId]
  ).catch(() => []);
  return new Set((rows || []).map((r) => String(r.wxid || '').trim()).filter(Boolean));
}

const MAX_MOMENTS_PER_REFRESH = 2000;
const MOMENTS_PAGE_DELAY_MS = 600;

function isAdminUser(req) {
  return req.user && req.user.role === 'admin';
}

class WeChatRobotController {
  // ============ 账号管理 ============

  async getAccounts(req, res) {
    try {
      const accounts = await WeChatRobotAccount.findAll({ where: {}, orderBy: 'is_default DESC, id DESC', limit: 500 });
      return success(res, accounts);
    } catch (err) {
      return error(res, '获取账号列表失败', 500);
    }
  }

  async addAccount(req, res) {
    try {
      const { nickname, wxid, api_url, token } = req.body;
      const id = await WeChatRobotAccount.create({
        user_id: req.user.id,
        nickname,
        wxid: wxid || '',
        api_url: api_url || '',
        token: token || '',
        status: 'offline',
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
      const account = await WeChatRobotAccount.findById(id);
      return success(res, account, '添加成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteAccount(req, res) {
    try {
      const account = await WeChatRobotAccount.findById(req.params.id);
      if (!account) {
        return error(res, '账号不存在', 404);
      }
      const isAdmin = req.user && req.user.role === 'admin';
      if (!isAdmin && account.user_id !== req.user.id) {
        return error(res, '无权删除该账号', 403);
      }
      await WeChatRobotAccount.delete(req.params.id);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async setDefaultAccount(req, res) {
    try {
      const { id } = req.params;
      const account = await WeChatRobotAccount.findById(id);
      if (!account) return error(res, '账号不存在', 404);
      const isAdmin = req.user && req.user.role === 'admin';
      if (!isAdmin && account.user_id !== req.user.id) return error(res, '无权操作', 403);
      const isCurrentDefault = account.is_default === 1;
      if (isCurrentDefault) {
        await WeChatRobotAccount.clearDefault(id, account.user_id);
        return success(res, null, '已取消默认');
      } else {
        await WeChatRobotAccount.setDefault(id, account.user_id);
        return success(res, null, '已设为默认');
      }
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getLoginQrCode(req, res) {
    try {
      const config = await getEffectiveApiConfig(req.user.id);
      if (!config) return error(res, '请先配置API');
      const { robotId } = req.params;
      const { region_id } = req.query;
      let appId = '';
      let account = null;
      if (robotId) {
        account = await WeChatRobotAccount.findById(robotId);
        if (account) appId = account.app_id || account.device_id || '';
      }
      let result = null;
      if (appId) {
        try {
          result = await WeChatRobotService.getLoginQrCode(config.api_url, config.token, appId, region_id || '', 'mac');
        } catch { result = null; }
      }
      if (!result || result.ret !== 200 || !result.data || !result.data.qrImgBase64) {
        result = await WeChatRobotService.getLoginQrCode(config.api_url, config.token, '', region_id || '', 'mac');
      }
      if (result && result.ret === 200 && result.data) {
        const d = result.data;
        const newAppId = d.appId || appId;
        const uuid = d.uuid || '';
        if (robotId) {
          let existingSettings = {};
          try {
            existingSettings = account && account.settings ? (typeof account.settings === 'string' ? JSON.parse(account.settings) : account.settings) : {};
          } catch { existingSettings = {}; }
          existingSettings.uuid = uuid;
          existingSettings.qr_data = d.qrData || '';
          existingSettings.login_type = 'mac';
          await WeChatRobotAccount.update(robotId, {
            app_id: newAppId,
            device_id: newAppId,
            status: 'logging',
            settings: JSON.stringify(existingSettings),
          });
        }
        return success(res, {
          qrcode_url: d.qrImgBase64 || d.qrImgUrl || d.qrUrl || d.qrcode_url || d.qrData || '',
          uuid,
          appId: newAppId,
        });
      }
      return error(res, '获取二维码失败，请检查API配置');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 检查登录状态（扫码后轮询）
   */
  async checkLoginStatus(req, res) {
    try {
      const config = await getEffectiveApiConfig(req.user.id);
      if (!config) return error(res, '请先配置API');
      const { robotId } = req.params;
      const account = await WeChatRobotAccount.findById(robotId);
      if (!account) return error(res, '账号不存在', 404);
      const appId = account.app_id || account.device_id || '';
      if (!appId) return success(res, { status: 'logging', loginStatus: 0, message: '等待获取二维码' });
      // 与PHP版本一致：从settings字段读取uuid
      let settings = {};
      try {
        settings = account.settings ? (typeof account.settings === 'string' ? JSON.parse(account.settings) : account.settings) : {};
      } catch { settings = {}; }
      const uuid = settings.uuid || '';
      if (!uuid) {
        return success(res, { status: 'logging', loginStatus: 0, message: '请先获取登录二维码' });
      }
      const loginType = settings.login_type || 'mac';
      const autoSliding = loginType === 'mac';
      const result = await WeChatRobotService.checkLoginStatus(config.api_url, config.token, appId, uuid, autoSliding);
      if (result && result.data) {
        const loginStatus = result.data.status ?? result.data.loginStatus ?? 0;
        if (loginStatus === 2 || result.data.loginInfo) {
          const loginInfo = result.data.loginInfo || result.data;
          const wxid = loginInfo.wxId || loginInfo.wxid || loginInfo.userName || account.wxid || '';
          const nickname = loginInfo.nickName || loginInfo.nickname || account.nickname || '';
          const avatar = loginInfo.headUrl || loginInfo.headImgUrl || loginInfo.avatar || account.avatar || '';
          await WeChatRobotAccount.update(robotId, { status: 'online', wxid, nickname, avatar });
          return success(res, { status: 'online', loginStatus: 2, wxid, nickname });
        }
        let message = result.data.message || result.data.msg || '';
        if (loginStatus === 0) {
          message = message || '等待扫码';
        } else if (loginStatus === 1) {
          message = '已扫码，请在手机上点击"登录"按钮完成验证';
        }
        return success(res, {
          status: 'logging',
          loginStatus,
          message,
        });
      }
      return success(res, { status: 'logging', loginStatus: 0 });
    } catch (err) {
      return success(res, { status: 'logging', loginStatus: 0, message: err.message });
    }
  }

  /**
   * 检查设备在线状态
   */
  async checkDeviceStatus(req, res) {
    try {
      const config = await getEffectiveApiConfig(req.user.id);
      if (!config) return success(res, { is_online: false, status: 'offline', message: 'API未配置' });
      const { robotId } = req.params;
      const account = await WeChatRobotAccount.findById(robotId);
      if (!account) return error(res, '账号不存在', 404);
      const appId = account.app_id || account.device_id || '';
      if (!appId) return success(res, { is_online: false, status: 'offline', status_changed: false });
      const result = await WeChatRobotService.checkDeviceOnline(config.api_url, config.token, appId);
      let isOnline = false;
      if (result) {
        // API返回 { ret: 200, data: true/false } 或 { ret: 200, data: { online: true } }
        isOnline = result.data === true || result.data?.online === true || result.data?.isOnline === true || (result.ret === 200 && result.data !== false);
      }
      const oldStatus = account.status;
      const newStatus = isOnline ? 'online' : 'offline';
      const statusChanged = oldStatus !== newStatus;
      if (statusChanged) {
        await WeChatRobotAccount.update(robotId, { status: newStatus });
      }
      return success(res, { is_online: isOnline, status: newStatus, status_changed: statusChanged, app_id: appId, message: result?.data?.message || '' });
    } catch (err) {
      return success(res, { is_online: false, status: 'unknown', status_changed: false, message: err.message });
    }
  }

  /**
   * 退出登录
   */
  async logoutAccount(req, res) {
    try {
      const config = await getEffectiveApiConfig(req.user.id);
      const { robotId } = req.params;
      const account = await WeChatRobotAccount.findById(robotId);
      if (!account || account.user_id !== req.user.id) return error(res, '账号不存在', 404);
      if (config) {
        const appId = account.app_id || account.device_id || '';
        if (appId) {
          try { await WeChatRobotService.logoutDevice(config.api_url, config.token, appId); } catch (e) { logger.warn('退出登录API调用失败', e.message); }
        }
      }
      await WeChatRobotAccount.update(robotId, { status: 'offline' });
      return success(res, null, '已退出登录');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 获取用户级统计数据
   */
  async getStats(req, res) {
    try {
      const userId = req.user.id;
      const { query: dbQuery } = require('../../config/database');
      const accounts = await WeChatRobotAccount.findByUserId(userId);
      const robotIds = accounts.map(a => a.id);
      let totalContacts = 0, totalGroups = 0, totalMessages = 0;
      const accountStats = {};
      if (robotIds.length > 0) {
        const placeholders = robotIds.map(() => '?').join(',');
        const [contactRows] = await dbQuery(`SELECT robot_id, COUNT(*) as cnt FROM wechat_robot_contacts WHERE robot_id IN (${placeholders}) GROUP BY robot_id`, robotIds).catch(() => [[]]);
        const [groupRows] = await dbQuery(`SELECT robot_id, COUNT(*) as cnt FROM wechat_robot_groups WHERE robot_id IN (${placeholders}) GROUP BY robot_id`, robotIds).catch(() => [[]]);
        const [msgRows] = await dbQuery(`SELECT robot_id, COUNT(*) as cnt FROM wechat_robot_messages WHERE robot_id IN (${placeholders}) GROUP BY robot_id`, robotIds).catch(() => [[]]);
        const contactMap = {}, groupMap = {}, msgMap = {};
        (Array.isArray(contactRows) ? contactRows : []).forEach(r => { contactMap[r.robot_id] = parseInt(r.cnt); totalContacts += parseInt(r.cnt); });
        (Array.isArray(groupRows) ? groupRows : []).forEach(r => { groupMap[r.robot_id] = parseInt(r.cnt); totalGroups += parseInt(r.cnt); });
        (Array.isArray(msgRows) ? msgRows : []).forEach(r => { msgMap[r.robot_id] = parseInt(r.cnt); totalMessages += parseInt(r.cnt); });
        robotIds.forEach(id => {
          accountStats[id] = { contacts: contactMap[id] || 0, groups: groupMap[id] || 0, messages: msgMap[id] || 0 };
        });
      }
      return success(res, { total_contacts: totalContacts, total_groups: totalGroups, total_messages: totalMessages, accounts: accountStats });
    } catch (err) {
      return success(res, { total_contacts: 0, total_groups: 0, total_messages: 0, accounts: {} });
    }
  }

  // ============ API配置 ============

  async getApiConfig(req, res) {
    try {
      const config = await WeChatRobotService.getApiConfig(req.user.id);
      return success(res, config);
    } catch (err) {
      return error(res, '获取配置失败', 500);
    }
  }

  async saveApiConfig(req, res) {
    try {
      await WeChatRobotService.saveApiConfig(req.user.id, req.body);
      return success(res, null, '配置保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 通讯录 ============

  async getContacts(req, res) {
    try {
      const { robotId } = req.params;
      const { page = 1, pageSize = 20, search = '', contactType = '' } = req.query;
      const result = await WeChatRobotContact.findByRobotId(robotId, {
        page: parseInt(page, 10), pageSize: parseInt(pageSize, 10), search, contactType,
      });
      return paginated(res, result.data, result.total, result.page, result.pageSize);
    } catch (err) {
      return error(res, '获取通讯录失败', 500);
    }
  }

  async syncContacts(req, res) {
    try {
      const { robotId } = req.params;
      const isAdmin = isAdminUser(req);
      let account = await WeChatRobotAccount.getAccountWithApiConfig(robotId, req.user.id, isAdmin);
      if (!account && isAdmin) {
        account = await WeChatRobotAccount.findById(robotId);
      }
      if (!account) return error(res, '账号不存在', 404);

      const config = await getEffectiveApiConfig(isAdmin ? account.user_id : req.user.id);
      if (!config || !config.api_url) return error(res, '请先配置API');
      const deviceId = account.device_id;
      if (!deviceId) return error(res, '设备ID不存在，请重新登录微信');

      if (account.status !== 'online') {
        try {
          const onlineCheck = await WeChatRobotService.checkDeviceOnline(config.api_url, config.token, deviceId);
          const isOnline = onlineCheck?.data === true || onlineCheck?.data?.online === true || (onlineCheck?.ret === 200 && onlineCheck?.data !== false);
          if (!isOnline) return error(res, '账号未在线，请先登录');
          await WeChatRobotAccount.update(robotId, { status: 'online' });
        } catch {
          return error(res, '账号未在线，请先登录');
        }
      }

      const result = await WeChatRobotService.syncContacts(config.api_url, config.token, deviceId);
      if (result && result.data && result.data.length > 0) {
        const contacts = [];
        const batchSize = 100;

        for (let i = 0; i < result.data.length; i += batchSize) {
          const batch = result.data.slice(i, i + batchSize);
          try {
            const details = await WeChatRobotService.getContactBriefInfo(config.api_url, config.token, deviceId, batch);
            if (details && details.length > 0) {
              const detailMap = new Map();
              for (const d of details) {
                detailMap.set(d.userName || d.wxid, d);
              }
              for (const wxid of batch) {
                const d = detailMap.get(wxid);
                if (d) {
                  contacts.push({
                    wxid: d.userName || d.wxid || wxid,
                    nickname: d.nickName || d.nickname || null,
                    avatar: d.bigHeadImgUrl || d.smallHeadImgUrl || d.headImgUrl || d.avatar || null,
                    remark: d.remark || null,
                    contact_type: resolveContactType(d.userName || d.wxid || wxid),
                    is_blocked: parseBlockedFlag(d),
                  });
                } else {
                  contacts.push({ wxid, nickname: null, avatar: null, remark: null, contact_type: resolveContactType(wxid), is_blocked: 0 });
                }
              }
              continue;
            }
          } catch { /* fallback to basic */ }
          for (const wxid of batch) {
            contacts.push({ wxid, nickname: null, avatar: null, remark: null, contact_type: resolveContactType(wxid), is_blocked: 0 });
          }
        }

        await WeChatRobotContact.syncContacts(robotId, account.user_id, contacts);
      }
      return success(res, { total: result?.total || 0 }, '同步完成');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 消息 ============

  async getConversations(req, res) {
    try {
      const { robotId } = req.params;
      const conversations = await WeChatRobotMessage.getConversations(robotId);
      return success(res, conversations);
    } catch (err) {
      return error(res, '获取会话列表失败', 500);
    }
  }

  async getChatHistory(req, res) {
    try {
      const { robotId, contactWxid } = req.params;
      const { page = 1, pageSize = 50 } = req.query;
      const result = await WeChatRobotMessage.getChatHistory(robotId, contactWxid, {
        page: parseInt(page, 10), pageSize: parseInt(pageSize, 10),
      });
      return paginated(res, result.data, result.total, result.page, result.pageSize);
    } catch (err) {
      return error(res, '获取聊天记录失败', 500);
    }
  }

  async sendMessage(req, res) {
    try {
      const { robotId } = req.params;
      const { toWxid, content, msgType = 'text', mediaUrl } = req.body;
      const isAdmin = isAdminUser(req);
      let account = await WeChatRobotAccount.getAccountWithApiConfig(robotId, req.user.id, isAdmin);
      if (!account && isAdmin) {
        account = await WeChatRobotAccount.findById(robotId);
      }
      if (!account) return error(res, '账号不存在', 404);

      const config = await getEffectiveApiConfig(isAdmin ? account.user_id : req.user.id);
      if (!config || !config.api_url) return error(res, '请先配置API');
      let result;
      const deviceAppId = account.device_id || null;
      if (msgType === 'image') {
        result = await WeChatRobotService.sendImageMessage(config.api_url, config.token, account.wxid, toWxid, mediaUrl, deviceAppId);
      } else {
        result = await WeChatRobotService.sendTextMessage(config.api_url, config.token, account.wxid, toWxid, content, deviceAppId);
      }

      return success(res, result, '发送成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 群组 ============

  async getGroups(req, res) {
    try {
      const { robotId } = req.params;
      const { page = 1, pageSize = 20, search = '' } = req.query;
      const result = await WeChatRobotGroup.findByRobotId(robotId, {
        page: parseInt(page, 10), pageSize: parseInt(pageSize, 10), search,
      });
      return paginated(res, result.data, result.total, result.page, result.pageSize);
    } catch (err) {
      return error(res, '获取群组失败', 500);
    }
  }

  async syncGroups(req, res) {
    try {
      const { robotId } = req.params;
      const isAdmin = isAdminUser(req);
      const account = await WeChatRobotAccount.getAccountWithApiConfig(robotId, req.user.id, isAdmin);
      if (!account) return error(res, '账号不存在', 404);
      const config = await getEffectiveApiConfig(isAdmin ? account.user_id : req.user.id);
      if (!config || !config.api_url) return error(res, '请先配置API');
      const deviceId = account.device_id;
      if (!deviceId) return error(res, '设备ID不存在');

      if (account.status !== 'online') {
        try {
          const onlineCheck = await WeChatRobotService.checkDeviceOnline(config.api_url, config.token, deviceId);
          const isOnline = onlineCheck?.data === true || (onlineCheck?.ret === 200 && onlineCheck?.data !== false);
          if (!isOnline) return error(res, '账号未在线，请先登录');
          await WeChatRobotAccount.update(robotId, { status: 'online' });
        } catch {
          return error(res, '账号未在线，请先登录');
        }
      }

      const syncResult = await WeChatRobotService.syncContacts(config.api_url, config.token, deviceId);
      const chatroomIds = syncResult?.chatrooms || [];
      if (!chatroomIds.length) return success(res, { total: 0 }, '未获取到群列表');

      const { query: dbQuery } = require('../../config/database');
      let savedCount = 0;
      for (const chatroomId of chatroomIds) {
        try {
          const info = await WeChatRobotService.getChatroomInfo(config.api_url, config.token, deviceId, chatroomId);
          const d = info?.data || {};
          if (!d.chatroomId && !d.nickName) continue;
          const name = d.nickName || chatroomId;
          const avatar = d.smallHeadImgUrl || null;
          const memberCount = Array.isArray(d.memberList) ? d.memberList.length : (d.memberCount || d.totalMember || 0);
          const ownerWxid = d.chatRoomOwner || null;
          const members = Array.isArray(d.memberList) ? JSON.stringify(d.memberList) : null;

          const existing = await dbQuery('SELECT id FROM wechat_robot_groups WHERE robot_id = ? AND chatroom_id = ? LIMIT 1', [robotId, chatroomId]);
          if (existing && existing.length > 0) {
            await dbQuery('UPDATE wechat_robot_groups SET name = ?, avatar = ?, member_count = ?, owner_wxid = ?, members = ?, updated_at = NOW() WHERE id = ?',
              [name, avatar, memberCount, ownerWxid, members, existing[0].id]);
          } else {
            await dbQuery('INSERT INTO wechat_robot_groups (robot_id, user_id, chatroom_id, name, avatar, member_count, owner_wxid, members, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
              [robotId, account.user_id, chatroomId, name, avatar, memberCount, ownerWxid, members]);
          }
          savedCount++;
        } catch { /* 忽略单个群错误 */ }
      }
      return success(res, { total: chatroomIds.length, saved: savedCount }, `同步完成，共${chatroomIds.length}个群`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 朋友圈 ============

  async getMoments(req, res) {
    try {
      const { robotId } = req.params;
      const { page = 1, pageSize = 20, search = '', ownerWxid = '' } = req.query;
      const result = await WeChatRobotMoment.findByRobotId(robotId, {
        page: parseInt(page, 10), pageSize: parseInt(pageSize, 10), search, ownerWxid,
      });
      return paginated(res, result.data, result.total, result.page, result.pageSize);
    } catch (err) {
      return error(res, '获取朋友圈失败', 500);
    }
  }

  async refreshMoments(req, res) {
    try {
      const { robotId } = req.params;
      const isAdmin = isAdminUser(req);
      const account = await WeChatRobotAccount.getAccountWithApiConfig(robotId, req.user.id, isAdmin);
      if (!account) return error(res, '账号不存在', 404);

      const config = await getEffectiveApiConfig(isAdmin ? account.user_id : req.user.id);
      if (!config || !config.api_url) return error(res, '请先配置API');
      const deviceId = account.device_id;
      if (!deviceId) return error(res, '设备ID不存在');

      if (account.status !== 'online') {
        try {
          const onlineCheck = await WeChatRobotService.checkDeviceOnline(config.api_url, config.token, deviceId);
          const isOnline = onlineCheck?.data === true || (onlineCheck?.ret === 200 && onlineCheck?.data !== false);
          if (!isOnline) return error(res, '账号未在线，请先登录');
          await WeChatRobotAccount.update(robotId, { status: 'online' });
        } catch {
          return error(res, '账号未在线，请先登录');
        }
      }

      const { query: dbQuery } = require('../../config/database');
      const blockedWxidSet = await loadBlockedWxidSet(robotId);
      const myWxid = account.wxid || '';
      let maxId = 0;
      let totalFetched = 0;
      let newCount = 0;
      let consecutiveEmpty = 0;

      while (totalFetched < MAX_MOMENTS_PER_REFRESH) {
        const result = await WeChatRobotService.getMoments(config.api_url, config.token, deviceId, maxId);
        const snsList = result?.data?.snsList || [];
        if (!snsList.length) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 2) break;
          await new Promise((r) => setTimeout(r, MOMENTS_PAGE_DELAY_MS));
          continue;
        }
        consecutiveEmpty = 0;

        for (const sns of snsList) {
          const momentId = String(sns.id || '');
          const userName = sns.userName || '';
          if (!momentId || (userName && blockedWxidSet.has(userName))) continue;
          const nickName = sns.nickName || '';
          const snsXml = sns.snsXml || '';
          let content = _decodeHtmlEntities(sns.contentDesc || sns.content || '');
          if (content && content.includes('CDATA')) content = '';
          if (!content && snsXml) {
            try { content = _decodeHtmlEntities(parseFullContentFromXml(snsXml)); } catch {}
          }
          let mediaUrls = extractMomentMediaUrlsFromSns(sns);
          const createTime = sns.createTime || 0;
          const isOwn = userName === myWxid ? 1 : 0;
          const likeCount = sns.likeCount || 0;
          const commentCount = sns.commentCount || 0;
          const contentStyle = parseContentStyleFromXml(snsXml);
          let favContent = null;
          if (snsXml.includes('<noteinfo>')) {
            const note = parseFavoriteNoteFromXml(snsXml);
            if (note.text) favContent = note.text;
            if (note.mediaUrls.length && !mediaUrls.length) mediaUrls = note.mediaUrls;
          }
          try {
            const existing = await dbQuery('SELECT id FROM wechat_robot_moments WHERE robot_id = ? AND moment_id = ? LIMIT 1', [robotId, momentId]);
            if (!existing || !existing.length) {
              await dbQuery(
                `INSERT INTO wechat_robot_moments (robot_id, user_id, moment_id, owner_wxid, owner_nickname, content, is_own, status, create_time, like_count, comment_count, raw_snsxml, media_list, content_style, fav_content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [robotId, account.user_id, momentId, userName || null, nickName || null, content || null, isOwn, createTime || null, likeCount, commentCount, snsXml || null, mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null, contentStyle, favContent]
              );
              newCount++;
            } else if (content || mediaUrls.length > 0 || favContent) {
              const updates = [];
              const updateParams = [];
              if (content) { updates.push("content = COALESCE(NULLIF(content, ''), ?)"); updateParams.push(content); }
              if (mediaUrls.length > 0) { updates.push('media_list = COALESCE(media_list, ?)'); updateParams.push(JSON.stringify(mediaUrls)); }
              if (createTime) { updates.push('create_time = COALESCE(create_time, ?)'); updateParams.push(createTime); }
              if (contentStyle !== 1) { updates.push('content_style = ?'); updateParams.push(contentStyle); }
              if (favContent) { updates.push("fav_content = COALESCE(NULLIF(fav_content, ''), ?)"); updateParams.push(favContent); }
              if (updates.length > 0) {
                updateParams.push(existing[0].id);
                await dbQuery(`UPDATE wechat_robot_moments SET ${updates.join(', ')} WHERE id = ?`, updateParams);
              }
            }
          } catch { /* 忽略重复 */ }
        }

        totalFetched += snsList.length;
        const lastSns = snsList[snsList.length - 1];
        const lastId = lastSns?.id || 0;
        if (!lastId || lastId === maxId) break;
        maxId = lastId;
        await new Promise((r) => setTimeout(r, MOMENTS_PAGE_DELAY_MS));
      }

      if (totalFetched > 0) {
        return success(res, { total: totalFetched, new_count: newCount }, `刷新成功，获取${totalFetched}条，新增${newCount}条`);
      }
      return success(res, { total: 0, new_count: 0 }, '刷新完成，暂无新数据');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 自动回复 ============

  async getAutoReplies(req, res) {
    try {
      const { robotId } = req.params;
      const rules = await WeChatRobotAutoReply.findByRobotId(robotId);
      return success(res, rules);
    } catch (err) {
      return error(res, '获取自动回复规则失败', 500);
    }
  }

  async saveAutoReply(req, res) {
    try {
      const { robotId } = req.params;
      const data = { ...req.body, robot_id: robotId };
      if (data.id) {
        await WeChatRobotAutoReply.update(data.id, data);
      } else {
        data.created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
        data.id = await WeChatRobotAutoReply.create(data);
      }
      return success(res, data, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteAutoReply(req, res) {
    try {
      await WeChatRobotAutoReply.delete(req.params.ruleId);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 素材库 ============

  async getMaterials(req, res) {
    try {
      const { page = 1, pageSize = 20, type = '', categoryId = '', search = '' } = req.query;
      const result = await WeChatRobotMaterial.findByUserId(req.user.id, {
        page: parseInt(page, 10), pageSize: parseInt(pageSize, 10), type, categoryId, search,
      });
      return paginated(res, result.data, result.total, result.page, result.pageSize);
    } catch (err) {
      return error(res, '获取素材失败', 500);
    }
  }

  async getMaterialCategories(req, res) {
    try {
      const categories = await WeChatRobotMaterial.getCategories(req.user.id);
      return success(res, categories);
    } catch (err) {
      return error(res, '获取分类失败', 500);
    }
  }

  async saveMaterial(req, res) {
    try {
      const data = { ...req.body, user_id: req.user.id };
      if (data.id) {
        await WeChatRobotMaterial.update(data.id, data);
      } else {
        data.created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
        data.id = await WeChatRobotMaterial.create(data);
      }
      return success(res, data, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteMaterial(req, res) {
    try {
      await WeChatRobotMaterial.delete(req.params.id);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 定时发送 ============

  async getScheduledTasks(req, res) {
    try {
      const { robotId } = req.params;
      const { page = 1, pageSize = 20, status = '' } = req.query;
      const result = await WeChatRobotScheduledTask.findByRobotId(robotId, {
        page: parseInt(page, 10), pageSize: parseInt(pageSize, 10), status,
      });
      return paginated(res, result.data, result.total, result.page, result.pageSize);
    } catch (err) {
      return error(res, '获取定时任务失败', 500);
    }
  }

  async saveScheduledTask(req, res) {
    try {
      const { robotId } = req.params;
      const data = { ...req.body, robot_id: robotId };
      if (data.id) {
        await WeChatRobotScheduledTask.update(data.id, data);
      } else {
        data.created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
        data.id = await WeChatRobotScheduledTask.create(data);
      }
      return success(res, data, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteScheduledTask(req, res) {
    try {
      await WeChatRobotScheduledTask.delete(req.params.taskId);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getTaskLogs(req, res) {
    try {
      const logs = await WeChatRobotScheduledTask.getTaskLogs(req.params.taskId);
      return success(res, logs);
    } catch (err) {
      return error(res, '获取任务日志失败', 500);
    }
  }

  // ============ AI配置 ============

  async getAiConfig(req, res) {
    try {
      const { robotId } = req.params;
      const { query } = require('../../config/database');
      const [config] = await query(
        'SELECT * FROM wechat_robot_ai_config WHERE robot_id = ? LIMIT 1', [robotId]
      ).catch(() => [null]);
      return success(res, config || {});
    } catch (err) {
      return error(res, '获取AI配置失败', 500);
    }
  }

  async saveAiConfig(req, res) {
    try {
      const { robotId } = req.params;
      const { query } = require('../../config/database');
      const [existing] = await query(
        'SELECT id FROM wechat_robot_ai_config WHERE robot_id = ? LIMIT 1', [robotId]
      ).catch(() => [null]);
      const data = req.body;
      if (existing) {
        await query('UPDATE wechat_robot_ai_config SET ? WHERE robot_id = ?', [data, robotId]);
      } else {
        data.robot_id = robotId;
        await query('INSERT INTO wechat_robot_ai_config SET ?', [data]);
      }
      return success(res, null, 'AI配置保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 联系人标签 ============

  async getContactTags(req, res) {
    try {
      const { query } = require('../../config/database');
      const tags = await query(
        'SELECT * FROM wechat_robot_contact_tags WHERE user_id = ? ORDER BY name ASC', [req.user.id]
      ).catch(() => []);
      return success(res, tags);
    } catch (err) {
      return error(res, '获取标签失败', 500);
    }
  }

  async saveContactTag(req, res) {
    try {
      const { query } = require('../../config/database');
      const { name, color } = req.body;
      if (!name) return error(res, '标签名称不能为空');
      const result = await query(
        'INSERT INTO wechat_robot_contact_tags (user_id, name, color, created_at) VALUES (?, ?, ?, NOW())',
        [req.user.id, name, color || '#409EFF']
      );
      return success(res, { id: result.insertId, name, color }, '标签创建成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteContactTag(req, res) {
    try {
      const { query } = require('../../config/database');
      await query('DELETE FROM wechat_robot_contact_tags WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      return success(res, null, '标签删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 收藏夹 ============

  async getFavorites(req, res) {
    try {
      const { robotId } = req.params;
      const { query } = require('../../config/database');
      const { page = 1, pageSize, per_page: perPage, type = '', includeDeleted = '' } = req.query;
      const pg = Math.max(parseInt(page, 10) || 1, 1);
      const ps = Math.min(Math.max(parseInt(pageSize || perPage, 10) || 20, 1), 100);
      const offset = (pg - 1) * ps;
      const where = ['robot_id = ?'];
      const params = [robotId];
      if (includeDeleted !== '1') where.push('COALESCE(flag, 0) = 0');
      if (type !== '') {
        const typeMap = { text: [1], image: [2], video: [4, 16], link: [5, 7], file: [6, 8], note: [18] };
        const mapped = typeMap[type] || [];
        if (mapped.length) {
          where.push(`type IN (${mapped.map(() => '?').join(',')})`);
          params.push(...mapped);
        } else if (/^\d+$/.test(String(type))) {
          where.push('type = ?');
          params.push(Number(type));
        }
      }
      const whereSql = where.join(' AND ');
      const favorites = await query(
        `SELECT *, content as raw_content FROM wechat_robot_favorites WHERE ${whereSql} ORDER BY update_time DESC, created_at DESC LIMIT ? OFFSET ?`,
        [...params, ps, offset]
      ).catch(() => []);
      const [countRow] = await query(
        `SELECT COUNT(*) as total FROM wechat_robot_favorites WHERE ${whereSql}`, params
      ).catch(() => [{ total: 0 }]);
      const rows = (favorites || []).map((item) => ({
        ...item,
        type_class: resolveFavoriteTypeClass(item.type),
        display_content: extractFavoriteDisplayContent(item.content),
        media_urls: [
          ...extractFavoriteMediaUrls(item.content),
          ...getCachedFavoriteMediaUrls(item.content, robotId, item.fav_id),
        ],
        has_media: hasFavoriteMedia(item.content),
      }));
      await attachFavoriteSourceMediaUrls(robotId, rows);
      // 图片下载接口对收藏图片经常返回不可预览二进制，列表接口不再触发后台下载，避免点击笔记超时。
      return paginated(res, rows, countRow?.total || 0, pg, ps);
    } catch (err) {
      logger.error('获取收藏失败', { robotId: req.params.robotId, error: err.message });
      return error(res, '获取收藏失败', 500);
    }
  }

  async syncFavorites(req, res) {
    try {
      const { robotId } = req.params;
      const { query: dbQuery } = require('../../config/database');
      const isAdmin = isAdminUser(req);
      let account = await WeChatRobotAccount.getAccountWithApiConfig(robotId, req.user.id, isAdmin);
      if (!account && isAdmin) {
        account = await WeChatRobotAccount.findById(robotId);
      }
      if (!account) return error(res, '账号不存在', 404);

      const config = await getEffectiveApiConfig(isAdmin ? account.user_id : req.user.id);
      if (!config || !config.api_url) return error(res, '请先配置API');
      const appId = account.device_id || account.app_id || '';
      if (!appId) return error(res, '设备ID不存在，请重新登录微信');

      if (account.status !== 'online') {
        try {
          const onlineCheck = await WeChatRobotService.checkDeviceOnline(config.api_url, config.token, appId);
          const isOnline = onlineCheck?.data === true || onlineCheck?.data?.online === true || (onlineCheck?.ret === 200 && onlineCheck?.data !== false);
          if (!isOnline) return error(res, '账号未在线，请先登录');
          await WeChatRobotAccount.update(robotId, { status: 'online' });
        } catch {
          return error(res, '账号未在线，请先登录');
        }
      }

      const settings = parseFavoriteSettings(account.settings);
      const syncKey = String(req.body?.syncKey ?? settings.favorite_sync_key ?? '');
      const syncResult = await WeChatRobotService.syncFavorites(config.api_url, config.token, appId, syncKey);
      if (!syncResult || syncResult.ret !== 200) {
        return error(res, syncResult?.msg || '同步收藏夹失败', 500);
      }

      const data = syncResult.data || {};
      const list = Array.isArray(data.list) ? data.list : [];
      let inserted = 0;
      let updated = 0;
      let deleted = 0;
      let contentSynced = 0;

      for (const item of list) {
        const favId = Number(item.favId ?? item.fav_id ?? item.id);
        if (!favId) continue;
        const favType = Number(item.type ?? 0);
        const flag = Number(item.flag ?? 0);
        const updateTime = Number(item.updateTime ?? item.update_time ?? 0);
        const existingRows = await dbQuery('SELECT id, content FROM wechat_robot_favorites WHERE robot_id = ? AND fav_id = ? LIMIT 1', [robotId, favId]);
        const existed = existingRows && existingRows.length > 0;
        let content = existed ? existingRows[0].content : null;

        if (flag !== 1 && !content) {
          try {
            const contentResult = await WeChatRobotService.getFavoriteContent(config.api_url, config.token, appId, favId);
            if (contentResult && contentResult.ret === 200 && contentResult.data) {
              content = contentResult.data.content || null;
              if (content) contentSynced += 1;
            }
          } catch (contentError) {
            logger.warn('收藏内容获取失败', { robotId, favId, error: contentError.message });
          }
        }

        await dbQuery(
          `INSERT INTO wechat_robot_favorites (robot_id, user_id, fav_id, type, flag, update_time, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE type = VALUES(type), flag = VALUES(flag), update_time = VALUES(update_time), content = COALESCE(VALUES(content), content), updated_at = NOW()`,
          [robotId, account.user_id, favId, favType, flag, updateTime, content]
        );

        if (flag === 1) deleted += 1;
        else if (existed) updated += 1;
        else inserted += 1;
      }

      if (data.syncKey) {
        settings.favorite_sync_key = data.syncKey;
        await dbQuery('UPDATE wechat_robot_accounts SET settings = ?, updated_at = NOW() WHERE id = ?', [JSON.stringify(settings), robotId]);
      }

      return success(res, { total: list.length, inserted, updated, deleted, content_synced: contentSynced, sync_key: data.syncKey || syncKey }, '同步收藏夹完成');
    } catch (err) {
      logger.error('同步收藏夹失败', { robotId: req.params.robotId, error: err.message });
      return error(res, err.message || '同步收藏夹失败', 500);
    }
  }

  async deleteFavorite(req, res) {
    try {
      const { query } = require('../../config/database');
      await query('DELETE FROM wechat_robot_favorites WHERE id = ? AND robot_id = ?', [req.params.id, req.params.robotId]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ============ 视频号 ============

  async getFinder(req, res) {
    try {
      const { robotId } = req.params;
      const { query } = require('../../config/database');
      const data = await query(
        'SELECT * FROM wechat_channel_qrcodes WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]
      ).catch(() => []);
      return success(res, data);
    } catch (err) {
      return error(res, '获取视频号数据失败', 500);
    }
  }

  async searchFinder(req, res) {
    try {
      const { keyword } = req.body;
      return success(res, [], '搜索完成');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new WeChatRobotController();
