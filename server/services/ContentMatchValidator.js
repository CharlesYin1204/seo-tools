/**
 * Content match validator used by AI parse pipeline.
 * Keeps checks strict but layout-aware for common moments formats.
 */
const logger = require('../utils/logger');

class ContentMatchValidator {
  async parseContent(content, aiConfig = null) {
    const data = this._ruleBasedParse(content);
    if (aiConfig && aiConfig.enabled) {
      try {
        const aiResult = await this._aiParse(content, aiConfig);
        if (aiResult && typeof aiResult === 'object') Object.assign(data, aiResult);
      } catch (e) {
        logger.warn('ContentMatchValidator.parseContent AI parse failed', { error: e.message });
      }
    }
    return data;
  }

  validateParsedData(data, originalContent) {
    const issues = [];
    const content = String(originalContent || '');

    if (data.price_value && Number(data.price_value) < 1000) {
      issues.push('price_value 低于最低租金阈值');
    }
    if (data.price_value && !this._priceInContent(Number(data.price_value), content)) {
      issues.push('price_value 在原文中未找到对应表述');
    }
    if (data.community && (String(data.community).length < 2 || String(data.community).length > 50)) {
      issues.push('community 长度异常');
    }
    if (data.community && /(?:路|街|道|大道)$/.test(String(data.community)) && !/\d+弄|\d+号/.test(String(data.community))) {
      issues.push('community 疑似纯道路名（以路/街/道结尾且无弄号）');
    }
    // 只有原文明确写了户型/卧室时，才校验卧室值是否能在原文中找到。
    // 如果原文没写，允许上层默认回填为 1。
    if (data.bedrooms && Number(data.bedrooms) > 0 && this._hasExplicitLayoutHint(content) && !this._layoutInContent(Number(data.bedrooms), content)) {
      issues.push('bedrooms 在原文中未找到对应表述');
    }

    return { valid: issues.length === 0, issues };
  }

  calculateConfidence(data) {
    let score = 0;
    const weights = {
      price_value: 25,
      community: 20,
      district: 15,
      bedrooms: 15,
      area_sqm: 10,
      metro_stations: 5,
      bathrooms: 5,
      features: 5,
    };
    for (const [key, weight] of Object.entries(weights)) {
      const v = data[key];
      if (v != null && v !== '' && (typeof v !== 'number' || v > 0)) score += weight;
    }
    return Math.min(100, score);
  }

  _ruleBasedParse(content) {
    const text = String(content || '');
    const data = {};

    const priceMatch = text.match(/(\d{4,7})\s*(?:元\/月|\/月|[kK])/) || text.match(/月租[：:\s]*(\d{4,7})/);
    if (priceMatch) data.price_value = parseInt(priceMatch[1], 10);

    const sep = '(?:/|／|\\||｜|-|—|–|－|﹣)';
    const xyz = text.match(new RegExp(`(?<!\\d)(\\d)\\s*${sep}\\s*(\\d)\\s*${sep}\\s*(\\d)(?!\\d)`));
    if (xyz) {
      data.bedrooms = parseInt(xyz[1], 10);
      data.livingrooms = parseInt(xyz[2], 10);
      data.bathrooms = parseInt(xyz[3], 10);
    }

    const areaMatch = text.match(/(\d{2,4})\s*(?:平|㎡|平方|m²|m2)/i);
    if (areaMatch) data.area_sqm = parseInt(areaMatch[1], 10);
    return data;
  }

  async _aiParse(_content, _aiConfig) {
    return null;
  }

  _priceInContent(price, content) {
    if (!price || !Number.isFinite(price)) return true;
    const text = String(content || '');
    const intVal = Math.round(price);
    const formatted = String(intVal).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (text.includes(String(intVal)) || text.includes(formatted)) return true;
    if (new RegExp(`${intVal}\\s*(?:元|块|/月|每月)`, 'i').test(text)) return true;

    const wan = intVal / 10000;
    if (wan >= 1 && new RegExp(`${wan.toFixed(1).replace(/\\.0$/, '')}\\s*万`, 'i').test(text)) return true;
    const k = intVal / 1000;
    if (k >= 1 && new RegExp(`${k.toFixed(1).replace(/\\.0$/, '')}\\s*[kK]`, 'i').test(text)) return true;

    return false;
  }

  _hasExplicitLayoutHint(content) {
    const text = String(content || '');
    return /(?:户型|房型|格局)\s*[:：]?\s*\d/.test(text)
      || /\d\s*[房室居]/.test(text)
      || /[一二两兩三四五六七八九十]\s*[房室卧臥居]/.test(text)
      || /(?:双|雙)\s*(?:卧室|臥室|卧房|臥房|卧|臥|房|室|居)/.test(text)
      || /\d\s*(?:\/|／|\||｜|-|—|–|－|﹣)\s*\d\s*(?:\/|／|\||｜|-|—|–|－|﹣)\s*\d/.test(text)
      || /\d\s*[+＋]\s*\d/.test(text);
  }

  _layoutInContent(bedrooms, content) {
    const text = String(content || '');
    const n = Number(bedrooms);
    if (!n || n <= 0) return false;

    const cn = ['', '\u4e00', '[\u4e8c\u4e24\u5169]', '\u4e09', '\u56db', '\u4e94', '\u516d', '\u4e03', '\u516b', '\u4e5d'];
    if (new RegExp(`${n}\\s*(?:室|房)`, 'u').test(text)) return true;
    if (n <= 9 && new RegExp(`${cn[n]}\\s*(?:室|房)`, 'u').test(text)) return true;
    if (n === 2 && /(?:双|雙)\s*(?:卧室|臥室|卧房|臥房|卧|臥|房|室|居)/u.test(text)) return true;

    const sep = '(?:\\/|／|\\||｜|-|—|–|－|﹣)';
    if (new RegExp(`(^|[^\\d])${n}\\s*${sep}\\s*\\d\\s*${sep}\\s*\\d(?:\\s*${sep}\\s*\\d+)?(?:\\s*${sep})?(?!\\d)`, 'u').test(text)) return true;
    if (new RegExp(`${n}\\s*[+＋]\\s*\\d\\s*(?:房|室)?`, 'u').test(text)) return true;
    return false;
  }
}

module.exports = new ContentMatchValidator();
