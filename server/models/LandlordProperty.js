/**
 * 房东房源模型
 * 对应 properties 表（房东/中介发布的房源）
 * 与 Property 模型不同：Property 使用 wechat_robot_expat_parsed_properties 表
 */
const BaseModel = require('./BaseModel');

/** properties 表有效列名（避免使用不存在的列） */
const PROPERTIES_VALID_COLUMNS = new Set([
  'user_id', 'title', 'description', 'property_type', 'price', 'rent_type', 'deposit',
  'payment_terms', 'room_config', 'payment_method', 'bedrooms', 'bathrooms', 'area',
  'floor', 'total_floors', 'furnished', 'pets_allowed', 'available_from', 'source_type',
  'source_landlord_id', 'is_rented', 'rented_at', 'address', 'metro_line', 'metro_station',
  'city', 'district', 'subway_line', 'subway_station', 'latitude', 'longitude',
  'features', 'amenities', 'images', 'videos', 'status', 'approval_status', 'approved_by',
  'approved_at', 'approval_notes', 'featured', 'views', 'created_at', 'updated_at',
  'livingrooms', 'kitchens',
]);

/**
 * 过滤并映射请求数据为 properties 表有效列
 * - reject_reason -> approval_notes
 * - decoration -> furnished
 * - 移除 contact_phone, contact_name, building_name 等不存在的列
 */
function filterForProperties(data, forUpdate = false) {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id' && forUpdate) continue;
    if (key === 'reject_reason') {
      result.approval_notes = value;
      continue;
    }
    if (key === 'decoration') {
      result.furnished = value;
      continue;
    }
    if (key === 'contact_phone' || key === 'contact_name' || key === 'building_name') {
      continue;
    }
    if (PROPERTIES_VALID_COLUMNS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

class LandlordProperty extends BaseModel {
  constructor() {
    super('properties');
  }

  /**
   * 插入时过滤有效列
   */
  async create(data) {
    const filtered = filterForProperties(data, false);
    return super.create(filtered);
  }

  /**
   * 更新时过滤有效列
   */
  async update(id, data) {
    const filtered = filterForProperties(data, true);
    if (Object.keys(filtered).length === 0) return 0;
    return super.update(id, filtered);
  }
}

module.exports = new LandlordProperty();
module.exports.filterForProperties = filterForProperties;
