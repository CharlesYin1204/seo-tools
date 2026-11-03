/**
 * 前端首页控制器
 * 与PHP版HomeController功能一致
 */
const Property = require('../../models/Property');
const PropertySettings = require('../../models/PropertySettings');
const SystemSetting = require('../../models/SystemSetting');
const { query } = require('../../config/database');
const { success, error, paginated } = require('../../utils/response');
const logger = require('../../utils/logger');
const { buildListedPropertyFilter } = require('../../utils/publishFilter');

function parseJsonArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (err) {
    return [];
  }
}

function parsePriceValue(rawValue, fallbackValue) {
  const directValue = Number(rawValue);
  if (Number.isFinite(directValue) && directValue > 0) {
    return directValue;
  }

  const fallbackText = fallbackValue == null ? '' : String(fallbackValue);
  const cleanedText = fallbackText.replace(/[^\d.]/g, '');
  const parsedValue = Number(cleanedText);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function splitContactInfo(value) {
  if (!value) return [];

  return [...new Set(
    String(value)
      .split(/[,\n，、/|\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

function splitOutdoorFeatures(value) {
  if (!value) return [];

  return [...new Set(
    String(value)
      .split(/[,\n，、/|]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

const PROPERTY_TYPE_LABELS = {
  apartment: 'Apartment',
  house: 'House',
  condo: 'Condo',
  townhouse: 'Townhouse',
  studio: 'Studio',
  loft: 'Loft',
  other: 'Other',
  entire_rent: 'Entire Rental',
  entire_rental: 'Entire Rental',
  shared_rent: 'Shared Rental',
  shared_rental: 'Shared Rental',
  serviced_apartment: 'Serviced Apartment',
};

const METRO_LINE_COLORS = {
  '1号线': '#E4002B', '2号线': '#97D700', '3号线': '#FFD100', '4号线': '#5F259F',
  '5号线': '#A05EB5', '6号线': '#D9027D', '7号线': '#F3560F', '8号线': '#009BDA',
  '9号线': '#71C5E8', '10号线': '#C7A1DB', '11号线': '#8D2323', '12号线': '#007B5F',
  '13号线': '#E8AEC4', '14号线': '#82C0C0', '15号线': '#B89268', '16号线': '#00B9E4',
  '17号线': '#BE82C0', '18号线': '#CA8A31',
  'Line 1': '#E4002B', 'Line 2': '#97D700', 'Line 3': '#FFD100', 'Line 4': '#5F259F',
  'Line 5': '#A05EB5', 'Line 6': '#D9027D', 'Line 7': '#F3560F', 'Line 8': '#009BDA',
  'Line 9': '#71C5E8', 'Line 10': '#C7A1DB', 'Line 11': '#8D2323', 'Line 12': '#007B5F',
  'Line 13': '#E8AEC4', 'Line 14': '#82C0C0', 'Line 15': '#B89268', 'Line 16': '#00B9E4',
  'Line 17': '#BE82C0', 'Line 18': '#CA8A31',
};

function getFirstMetroLineColor(metroLines) {
  if (!metroLines) return '#666666';
  const firstLine = String(metroLines).split(',')[0].trim();
  return METRO_LINE_COLORS[firstLine] || '#666666';
}

function normalizeParsedProperty(row) {
  if (!row) return null;

  const { mergeMomentMedia } = require('../../utils/propertyMediaMerge');
  mergeMomentMedia(row);

  const localImages = parseJsonArray(row.local_images);
  const rawMediaUrls = localImages.length > 0 ? localImages : parseJsonArray(row.media_urls);
  // 统一提取URL字符串（兼容纯字符串和 {url, thumb} 对象格式）
  const mediaUrls = rawMediaUrls.map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') return item.url || item.thumb || item.file_url || '';
    return '';
  }).filter(Boolean);
  const videoExtensions = /\.(mp4|mov|avi|m4v|webm|ogg)(\?|$)/i;
  const imageList = mediaUrls.filter(url => !videoExtensions.test(String(url)));
  const videoList = mediaUrls.filter(url => videoExtensions.test(String(url)));
  const priceValue = parsePriceValue(row.price_value, row.price);
  const displayTitle = row.title || row.community || [row.district, row.street].filter(Boolean).join(' ');
  const address = row.address || row.street || row.community || '';
  const featureList = [];

  if (parseInt(row.has_elevator, 10) === 1) {
    featureList.push('Elevator');
  }

  if (parseInt(row.has_parking, 10) === 1) {
    featureList.push('Parking');
  }

  if (row.decoration) {
    featureList.push(row.decoration);
  }

  if (row.orientation) {
    featureList.push(row.orientation);
  }

  featureList.push(...splitOutdoorFeatures(row.outdoor_features));

  const metroLines = row.metro_lines || '';
  const rawType = row.property_type || '';

  const finalImages = imageList.length > 0 ? imageList : mediaUrls.filter(url => !videoExtensions.test(String(url)));

  return {
    ...row,
    title: displayTitle,
    display_title: displayTitle,
    address,
    area: row.area || row.area_sqm || null,
    area_sqm: row.area_sqm || row.area || null,
    floor: row.floor || row.floor_info || '',
    floor_info: row.floor_info || row.floor || '',
    price_value: priceValue,
    custom_price: row.custom_price || null,
    display_price: row.display_price || null,
    price_display: (row.display_price || row.custom_price || priceValue) > 0 ? `¥${Math.round(row.display_price || row.custom_price || priceValue)}` : (row.price || ''),
    property_type_display: PROPERTY_TYPE_LABELS[rawType] || rawType || 'Apartment',
    subway_line_name: metroLines,
    subway_station_name: row.metro_stations || '',
    metro_line_color: getFirstMetroLineColor(metroLines),
    media_urls: mediaUrls,
    images: finalImages,
    videos: videoList,
    _single_image: finalImages.length <= 1,
    description: row.description || row.original_content || '',
    original_content: row.original_content || '',
    contact_phone_list: splitContactInfo(row.contact_info),
    feature_list: [...new Set(featureList)],
    posted_at: row.moment_publish_time || row.created_at || '',
  };
}

class HomeController {
  /**
   * 首页 - 与PHP版propertyListingHome()一致
   * 返回房源列表 + 筛选配置 + 联系方式
   */
  async index(req, res) {
    try {
      const { page = 1, district, bedrooms, price_range, metro_line, metro_station, search, sort = 'publish_time' } = req.query;
      const { query: dbQuery } = require('../../config/database');

      const properties = await Property.findListed({
        page: parseInt(page, 10),
        pageSize: 20,
        district: district || '',
        bedrooms: parseInt(bedrooms, 10) || 0,
        price_range: price_range || '',
        metro_line: metro_line || '',
        metro_station: metro_station || '',
        search: search || '',
        sort: sort || 'publish_time',
      });

      let filter_configs = { districts: [], metro_lines: [], metro_stations: [] };
      try {
        filter_configs.districts = await PropertySettings.getDistricts();
        filter_configs.metro_lines = await PropertySettings.getMetroLines();
        filter_configs.metro_stations = await dbQuery(
          `SELECT s.id, s.name_cn, s.name_en, s.line_id, s.sort_order, l.name_cn as line_name
           FROM property_metro_stations s
           LEFT JOIN property_metro_lines l ON s.line_id = l.id
           WHERE s.is_active = 1 ORDER BY s.line_id ASC, s.sort_order ASC`
        );
      } catch (e) {
        logger.warn('获取筛选配置失败', { error: e.message });
      }

      let contactInfo = { phone: '', wechat_id: '', wechat_qrcode: '' };
      try {
        const [floatContact] = await dbQuery('SELECT wechat_id, wechat_qrcode FROM float_contact_settings WHERE id = 1');
        if (floatContact) {
          contactInfo.wechat_id = floatContact.wechat_id || '';
          contactInfo.wechat_qrcode = floatContact.wechat_qrcode || '';
        }
        const [phoneSetting] = await dbQuery("SELECT setting_value FROM website_settings WHERE setting_key = 'site_contact_phone'");
        if (phoneSetting) contactInfo.phone = phoneSetting.setting_value || '';
      } catch {}

      const { getDefaultCoverImage } = require('../../utils/snsXmlMediaParser');
      const defaultCoverImage = await getDefaultCoverImage(dbQuery);

      return success(res, {
        properties: properties.data,
        total: properties.total,
        pagination: {
          current_page: properties.page,
          total_pages: properties.totalPages,
          total_items: properties.total,
          per_page: properties.pageSize,
        },
        filter_configs,
        filters: { district, bedrooms, price_range, metro_line, metro_station, search, sort },
        contactInfo,
        defaultCoverImage,
      });
    } catch (err) {
      logger.error('首页数据获取失败', { error: err.message, stack: err.stack });
      return error(res, '获取数据失败', 500);
    }
  }

  async mapSearch(req, res) {
    try {
      const properties = await Property.getMapProperties({ user: req.query.user || '' });
      const districts = await PropertySettings.getDistricts();
      const metroLines = await PropertySettings.getMetroLines();
      const metroStations = await query(
        `SELECT s.id, s.name_cn, s.name_en, s.line_id, l.name_cn as line_name, l.name_en as line_name_en
         FROM property_metro_stations s
         LEFT JOIN property_metro_lines l ON s.line_id = l.id
         WHERE s.is_active = 1 ORDER BY l.sort_order, s.sort_order`
      );
      const mapConfig = await this.getMapConfig();
      return success(res, { properties, districts, metroLines, metroStations, map_config: mapConfig });
    } catch (err) {
      logger.error('地图数据获取失败', { error: err.message });
      return error(res, '获取地图数据失败', 500);
    }
  }

  async mapPropertiesApi(req, res) {
    try {
      const properties = await Property.getMapProperties();
      return success(res, properties);
    } catch (err) {
      return error(res, '获取房源数据失败', 500);
    }
  }

  async searchProperties(req, res) {
    try {
      const { page = 1, pageSize = 20, district, price_range, bedrooms, metro_line, metro_station, search, sort, priceMin, priceMax, area } = req.query;
      const result = await Property.findListed({
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        district, price_range,
        bedrooms: parseInt(bedrooms, 10) || 0,
        metro_line, metro_station, search, sort,
        priceMin: parseFloat(priceMin) || 0,
        priceMax: parseFloat(priceMax) || 0,
        area,
      });
      return paginated(res, result.data, result.total, result.page, result.pageSize);
    } catch (err) {
      return error(res, '搜索失败', 500);
    }
  }

  async propertyDetail(req, res) {
    try {
      const propertyId = parseInt(req.params.id, 10);
      if (!propertyId) {
        return error(res, '房源ID无效', 400);
      }

      const pf = await buildListedPropertyFilter('p', { includeDedup: true });
      const detailWhere = ['p.id = ?', 'p.deleted_at IS NULL', "p.status = 'published'", ...pf.conditions].join(' AND ');
      const [propertyRow] = await query(
        `SELECT p.*, m.media_list as moment_media_list, m.local_media_urls as moment_local_media
         FROM wechat_robot_expat_parsed_properties p
         LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
         WHERE ${detailWhere}
         LIMIT 1`,
        [propertyId, ...pf.params]
      );

      if (!propertyRow) {
        return error(res, '房源不存在', 404);
      }

      const property = normalizeParsedProperty(propertyRow);

      let ownerUserId = property.user_id;
      if (req.params.username) {
        try {
          const [userRow] = await query('SELECT id FROM users WHERE username = ? LIMIT 1', [req.params.username]);
          if (userRow) ownerUserId = userRow.id;
        } catch {}
      }

      const agent = ownerUserId ? await this.getPropertyAgent(ownerUserId) : null;
      const similarProperties = await this.getSimilarProperties(property);
      const agentProperties = ownerUserId
        ? await this.getAgentOtherProperties(ownerUserId, property.id)
        : [];
      const mapConfig = await this.getMapConfig();
      const ownerSettings = ownerUserId ? await this.getOwnerLinkSettings(ownerUserId) : {};

      const currentUser = req.user?.id ? await this.getCurrentViewer(req.user.id) : null;
      const hasContactedAgent = currentUser && property.user_id
        ? await this.hasContactedAgent({
            agentId: property.user_id,
            propertyId: property.id,
            userId: currentUser.id,
            phone: currentUser.phone || '',
          })
        : false;

      let i18nMaps = { districts: {}, metro_lines: {}, metro_stations: {} };
      try {
        const districts = await query('SELECT name_cn, name_en FROM property_districts WHERE is_active = 1');
        const lines = await query('SELECT name_cn, name_en FROM property_metro_lines WHERE is_active = 1');
        const stations = await query('SELECT name_cn, name_en FROM property_metro_stations WHERE is_active = 1');
        districts.forEach(d => { i18nMaps.districts[d.name_cn] = d.name_en; });
        lines.forEach(l => { i18nMaps.metro_lines[l.name_cn] = l.name_en; });
        stations.forEach(s => { i18nMaps.metro_stations[s.name_cn] = s.name_en; });
      } catch {}

      return success(res, {
        property,
        agent,
        similar_properties: similarProperties,
        agent_properties: agentProperties,
        current_user: currentUser,
        has_contacted_agent: hasContactedAgent,
        map_config: mapConfig,
        owner_settings: ownerSettings,
        i18n_maps: i18nMaps,
      });
    } catch (err) {
      logger.error('房源详情获取失败', { error: err.message, propertyId: req.params.id });
      return error(res, '获取房源详情失败', 500);
    }
  }

  async getMapConfig() {
    try {
      const [settings] = await query(
        `SELECT js_api_key, security_js_key, default_center_lng, default_center_lat, default_zoom
         FROM system_map_settings
         WHERE provider = 'amap' AND is_enabled = 1
         ORDER BY id DESC
         LIMIT 1`
      );

      if (!settings) {
        return {
          enabled: false,
          js_api_key: '',
          security_js_key: '',
          default_center_lng: 121.4737021,
          default_center_lat: 31.2304324,
          default_zoom: 14,
        };
      }

      let jsKey = settings.js_api_key || '';
      let secKey = settings.security_js_key || '';
      try {
        const MapKeyRotationService = require('../../services/MapKeyRotationService');
        const rotatedKey = await MapKeyRotationService.getJsApiKey();
        if (rotatedKey.js_api_key) {
          jsKey = rotatedKey.js_api_key;
          secKey = rotatedKey.security_js_key || secKey;
        }
      } catch (e) {
        logger.warn('HomeController: 轮训服务获取JS Key失败，使用默认值');
      }

      return {
        enabled: Boolean(jsKey),
        js_api_key: jsKey,
        security_js_key: secKey,
        default_center_lng: Number(settings.default_center_lng) || 121.4737021,
        default_center_lat: Number(settings.default_center_lat) || 31.2304324,
        default_zoom: Number(settings.default_zoom) || 14,
      };
    } catch (err) {
      logger.warn('获取地图配置失败', { error: err.message });
      return {
        enabled: false,
        js_api_key: '',
        security_js_key: '',
        default_center_lng: 121.4737021,
        default_center_lat: 31.2304324,
        default_zoom: 14,
      };
    }
  }

  async getPropertyAgent(userId) {
    try {
      const [agent] = await query(
        `SELECT id, username, display_name, avatar, phone, wechat_id, email, role, status
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId]
      );

      if (!agent) return null;

      return {
        ...agent,
        name: agent.display_name || agent.username || 'Contact Agent',
      };
    } catch (err) {
      logger.warn('获取经纪人信息失败', { error: err.message, userId });
      return null;
    }
  }

  async getOwnerLinkSettings(userId) {
    try {
      let rows = await query(
        'SELECT settings FROM wechat_robot_expat_link_settings WHERE user_id = ? AND robot_id = 0',
        [userId]
      );
      let arr = Array.isArray(rows[0]) && Array.isArray(rows[0]) ? rows[0] : rows;
      if (!arr || !arr[0]) {
        rows = await query(
          'SELECT settings FROM wechat_robot_expat_link_settings WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
          [userId]
        );
        arr = Array.isArray(rows[0]) && Array.isArray(rows[0]) ? rows[0] : rows;
      }
      if (arr && arr[0] && arr[0].settings) {
        const parsed = typeof arr[0].settings === 'string' ? JSON.parse(arr[0].settings) : arr[0].settings;
        return parsed || {};
      }
      return {};
    } catch (err) {
      logger.warn('获取房源所有者链接设置失败', { error: err.message, userId });
      return {};
    }
  }

  async getCurrentViewer(userId) {
    try {
      const [viewer] = await query(
        `SELECT id, username, display_name, phone, phone_verified, wechat_id, avatar
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId]
      );

      if (!viewer) return null;

      const canUsePhone = viewer.phone && (
        viewer.phone_verified == null || parseInt(viewer.phone_verified, 10) === 1
      );

      return {
        id: viewer.id,
        name: viewer.display_name || viewer.username || '',
        phone: canUsePhone ? viewer.phone : '',
        wechat_id: viewer.wechat_id || '',
        avatar: viewer.avatar || '',
      };
    } catch (err) {
      logger.warn('获取当前用户详情失败', { error: err.message, userId });
      return null;
    }
  }

  async hasContactedAgent({ agentId, propertyId, userId, phone }) {
    try {
      const [contactRecord] = await query(
        `SELECT id
         FROM contact_agent_records
         WHERE agent_id = ? AND property_id = ? AND user_id = ?
         LIMIT 1`,
        [agentId, propertyId, userId]
      );

      if (contactRecord) {
        return true;
      }

      const clientParams = [agentId, userId];
      let clientSql = `
        SELECT id
        FROM clients
        WHERE agent_id = ? AND (user_id = ?
      `;

      if (phone) {
        clientSql += ' OR (phone IS NOT NULL AND phone = ?)';
        clientParams.push(phone);
      }

      clientSql += ') LIMIT 1';

      const [clientRecord] = await query(clientSql, clientParams);
      return Boolean(clientRecord);
    } catch (err) {
      logger.warn('检查咨询状态失败', {
        error: err.message,
        agentId,
        propertyId,
        userId,
      });
      return false;
    }
  }

  async getSimilarProperties(property) {
    try {
      const priceValue = Number(property.price_value) || 0;
      const priceRange = priceValue > 0 ? Math.max(priceValue * 0.2, 1500) : 0;

      const spf = await buildListedPropertyFilter('p', { includeDedup: true });
      const simWhere = ['p.id != ?', 'p.deleted_at IS NULL', "p.status = 'published'", ...spf.conditions].join(' AND ');
      const rows = await query(
        `SELECT p.*, m.media_list as moment_media_list, m.local_media_urls as moment_local_media
         FROM wechat_robot_expat_parsed_properties p
         LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
         WHERE ${simWhere}
           AND (
             (? != '' AND p.district = ?)
             OR (? > 0 AND p.user_id = ?)
             OR (? > 0 AND ABS(COALESCE(p.price_value, 0) - ?) <= ?)
           )
         ORDER BY
           (p.district = ?) DESC,
           (p.user_id = ?) DESC,
           ABS(COALESCE(p.price_value, 0) - ?) ASC,
           p.moment_publish_time DESC,
           p.created_at DESC
         LIMIT 4`,
        [
          property.id, ...spf.params,
          property.district || '',
          property.district || '',
          property.user_id || 0,
          property.user_id || 0,
          priceValue,
          priceValue,
          priceRange,
          property.district || '',
          property.user_id || 0,
          priceValue,
        ]
      );

      return rows.map((row) => normalizeParsedProperty(row));
    } catch (err) {
      logger.warn('获取相似房源失败', { error: err.message, propertyId: property.id });
      return [];
    }
  }

  async getAgentOtherProperties(agentId, excludeId) {
    try {
      const apf = await buildListedPropertyFilter('p', { includeDedup: true });
      const agentWhere = ['p.user_id = ?', 'p.id != ?', 'p.deleted_at IS NULL', "p.status = 'published'", ...apf.conditions].join(' AND ');
      const rows = await query(
        `SELECT p.*, m.media_list as moment_media_list, m.local_media_urls as moment_local_media
         FROM wechat_robot_expat_parsed_properties p
         LEFT JOIN wechat_robot_moments m ON p.moment_id = m.moment_id
         WHERE ${agentWhere}
         ORDER BY p.moment_publish_time DESC, p.created_at DESC
         LIMIT 6`,
        [agentId, excludeId, ...apf.params]
      );

      return rows.map((row) => normalizeParsedProperty(row));
    } catch (err) {
      logger.warn('获取经纪人其他房源失败', { error: err.message, agentId, excludeId });
      return [];
    }
  }

  async getDistricts(req, res) {
    try {
      const districts = await PropertySettings.getDistricts();
      return success(res, districts);
    } catch (err) {
      return error(res, '获取区域列表失败', 500);
    }
  }

  async getMetroLines(req, res) {
    try {
      const lines = await PropertySettings.getMetroLines();
      return success(res, lines);
    } catch (err) {
      return error(res, '获取地铁线路失败', 500);
    }
  }

  async getMetroStations(req, res) {
    try {
      const { line_name } = req.query;
      const { query: dbQuery } = require('../../config/database');
      let sql = `SELECT s.id, s.name_cn, s.name_en, s.line_id, l.name_cn as line_name
                 FROM property_metro_stations s
                 LEFT JOIN property_metro_lines l ON s.line_id = l.id
                 WHERE s.is_active = 1`;
      const params = [];
      if (line_name) {
        sql += ` AND l.name_cn = ?`;
        params.push(line_name);
      }
      sql += ` ORDER BY s.sort_order ASC`;
      const stations = await dbQuery(sql, params);
      return success(res, stations);
    } catch (err) {
      return error(res, '获取地铁站点失败', 500);
    }
  }

  async about(req, res) {
    try {
      const settings = await SystemSetting.getAll();
      return success(res, { site_name: settings.site_name || 'ExpatHome', about_content: settings.about_content || '' });
    } catch (err) {
      return error(res, '获取关于页面失败', 500);
    }
  }

  async contact(req, res) {
    try {
      const settings = await SystemSetting.getAll();
      return success(res, {
        contact_email: settings.contact_email || '',
        contact_phone: settings.contact_phone || '',
        contact_address: settings.contact_address || '',
        contact_wechat: settings.contact_wechat || '',
      });
    } catch (err) {
      return error(res, '获取联系信息失败', 500);
    }
  }

  async services(req, res) {
    try {
      const settings = await SystemSetting.getAll();
      return success(res, { services_content: settings.services_content || '', site_name: settings.site_name || 'ExpatHome' });
    } catch (err) {
      return error(res, '获取服务页面失败', 500);
    }
  }

  async searchSuggestions(req, res) {
    try {
      const { q } = req.query;
      if (!q || q.length < 2) return success(res, []);
      const { query: dbQuery } = require('../../config/database');
      const sgFilter = await buildListedPropertyFilter('p', { includeDedup: true });
      const sgWhere = ['p.deleted_at IS NULL', "p.status = 'published'", ...sgFilter.conditions].join(' AND ');
      const suggestions = await dbQuery(
        `SELECT DISTINCT p.district as text FROM wechat_robot_expat_parsed_properties p WHERE ${sgWhere} AND p.district LIKE ? LIMIT 10`,
        [...sgFilter.params, `%${q}%`]
      );
      return success(res, suggestions);
    } catch (err) {
      return success(res, []);
    }
  }

  async wechatRobotHome(req, res) {
    try { return success(res, { site_name: 'ExpatHome' }); } catch (err) { return error(res, '获取页面失败', 500); }
  }

  async wechatMatrixHome(req, res) {
    try { return success(res, { site_name: 'ExpatHome' }); } catch (err) { return error(res, '获取页面失败', 500); }
  }

  async switchLanguage(req, res) {
    try {
      const { lang } = req.body;
      if (!lang) return error(res, '缺少语言参数', 400);
      return success(res, { lang }, '语言切换成功');
    } catch (err) {
      return error(res, '切换语言失败', 500);
    }
  }

  async agents(req, res) {
    try {
      const { query: dbQuery } = require('../../config/database');
      const { page = 1, pageSize = 20 } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const agents = await dbQuery(
        `SELECT u.id, u.username, u.display_name, u.avatar, u.email, ap.company, ap.description, ap.phone
         FROM users u LEFT JOIN agent_profiles ap ON u.id = ap.user_id
         WHERE u.role = 'agent' ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
        [parseInt(pageSize, 10), offset]
      ).catch(() => []);
      const [countRow] = await dbQuery("SELECT COUNT(*) as total FROM users WHERE role = 'agent'").catch(() => [{ total: 0 }]);
      return success(res, { agents, total: countRow?.total || 0 });
    } catch (err) {
      return error(res, '获取中介列表失败', 500);
    }
  }

  async agentProfile(req, res) {
    try {
      const { query: dbQuery } = require('../../config/database');
      const { id } = req.params;
      const [agent] = await dbQuery(
        `SELECT u.id, u.username, u.display_name, u.avatar, u.email, ap.company, ap.description, ap.phone
         FROM users u LEFT JOIN agent_profiles ap ON u.id = ap.user_id WHERE u.id = ? AND u.role = 'agent'`, [id]
      ).catch(() => []);
      if (!agent) return error(res, '中介不存在', 404);
      return success(res, { agent });
    } catch (err) {
      return error(res, '获取中介详情失败', 500);
    }
  }
}

module.exports = new HomeController();
