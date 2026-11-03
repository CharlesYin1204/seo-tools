/**
 * 房源数据验证服务
 * 校验并提取房源关键字段（价格、卧室数、面积等）
 */
const logger = require('../utils/logger');

class PropertyValidator {
  /**
   * 验证房源数据完整性
   * @param {Object} data - 房源数据
   * @returns {{ valid: boolean, errors: string[] }} 验证结果
   */
  validateProperty(data) {
    const errors = [];

    if (!data) {
      return { valid: false, errors: ['数据为空'] };
    }

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 2) {
      errors.push('标题不能为空且至少2个字符');
    }

    const price = Number(data.price);
    if (data.price != null && data.price !== '') {
      if (isNaN(price) || price < 0) {
        errors.push('价格必须为非负数值');
      }
      if (price > 999999) {
        errors.push('价格超出合理范围（>999999）');
      }
    }

    const bedrooms = Number(data.bedrooms);
    if (data.bedrooms != null && data.bedrooms !== '') {
      if (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 20) {
        errors.push('卧室数必须为0-20之间的整数');
      }
    }

    const area = Number(data.area);
    if (data.area != null && data.area !== '') {
      if (isNaN(area) || area <= 0) {
        errors.push('面积必须为正数');
      }
      if (area > 9999) {
        errors.push('面积超出合理范围（>9999平方米）');
      }
    }

    if (data.district && typeof data.district !== 'string') {
      errors.push('区域字段必须为字符串');
    }

    if (data.latitude != null) {
      const lat = Number(data.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.push('纬度必须在 -90 到 90 之间');
      }
    }

    if (data.longitude != null) {
      const lng = Number(data.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errors.push('经度必须在 -180 到 180 之间');
      }
    }

    if (errors.length > 0) {
      logger.warn('PropertyValidator.validateProperty 未通过验证', { errors, title: data.title });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 从文本中提取价格（元/月）
   * @param {string} text - 包含价格的文本
   * @returns {number|null} 提取到的价格
   */
  extractPrice(text) {
    if (!text || typeof text !== 'string') return null;

    const patterns = [
      /(\d[\d,]*(?:\.\d+)?)\s*(?:元|¥|￥|RMB|CNY)\s*(?:\/\s*(?:月|month))?/i,
      /(?:rent|租金|价格|月租)\s*[:：]?\s*(\d[\d,]*(?:\.\d+)?)/i,
      /(\d[\d,]*(?:\.\d+)?)\s*(?:\/\s*(?:月|month|mo))/i,
      /¥\s*(\d[\d,]*(?:\.\d+)?)/,
      /(\d{3,6})\s*(?:per\s*month|a\s*month|\/month)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        if (price > 0 && price < 999999) return price;
      }
    }

    return null;
  }

  /**
   * 从文本中提取卧室数
   * @param {string} text - 包含卧室信息的文本
   * @returns {number|null} 卧室数
   */
  extractBedrooms(text) {
    if (!text || typeof text !== 'string') return null;

    const patterns = [
      /(\d+)\s*(?:室|房间|卧室|居)/,
      /(\d+)\s*(?:bedroom|bed|br|room)s?/i,
      /(\d+)\s*[bB](?:\d+[hH])?/,
      /(?:studio|单间|开间)/i,
    ];

    if (/(?:studio|单间|开间)/i.test(text)) return 0;

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num >= 0 && num <= 20) return num;
      }
    }

    return null;
  }

  /**
   * 从文本中提取面积（平方米）
   * @param {string} text - 包含面积信息的文本
   * @returns {number|null} 面积（平方米）
   */
  extractArea(text) {
    if (!text || typeof text !== 'string') return null;

    const patterns = [
      /(\d+(?:\.\d+)?)\s*(?:平方米|平米|㎡|m²|sqm|sq\.?\s*m)/i,
      /(\d+(?:\.\d+)?)\s*(?:平)/,
      /(?:面积|area)\s*[:：]?\s*(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const idx = match[1] ? 1 : 2;
        const area = parseFloat(match[idx]);
        if (area > 0 && area < 9999) return area;
      }
    }

    const sqftMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|平方英尺)/i);
    if (sqftMatch) {
      const sqft = parseFloat(sqftMatch[1]);
      const sqm = Math.round(sqft * 0.0929 * 100) / 100;
      if (sqm > 0 && sqm < 9999) return sqm;
    }

    return null;
  }

  /**
   * 批量验证房源数组
   * @param {Object[]} items - 房源数据数组
   * @returns {{ valid: Object[], invalid: { data: Object, errors: string[] }[] }}
   */
  validateBatch(items) {
    const valid = [];
    const invalid = [];

    for (const item of items) {
      const result = this.validateProperty(item);
      if (result.valid) {
        valid.push(item);
      } else {
        invalid.push({ data: item, errors: result.errors });
      }
    }

    if (invalid.length > 0) {
      logger.warn('PropertyValidator.validateBatch 部分数据未通过', {
        total: items.length,
        validCount: valid.length,
        invalidCount: invalid.length,
      });
    }

    return { valid, invalid };
  }
}

module.exports = new PropertyValidator();
