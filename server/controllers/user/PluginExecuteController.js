/**
 * 插件功能执行控制器
 * 处理所有插件的实际业务逻辑
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const https = require('https');
const http = require('http');
const url = require('url');
const { getOrganization } = require('../../services/seoSiteService');

class PluginExecuteController {

  /* ==================== 通用数据CRUD ==================== */

  async saveData(req, res) {
    try {
      const userId = req.user.id;
      const { slug } = req.params;
      const { data_type = 'default', title = '', content = '', data_json = {}, id } = req.body;
      const jsonStr = typeof data_json === 'object' ? JSON.stringify(data_json) : data_json;

      if (id) {
        await query('UPDATE plugin_user_data SET title=?, content=?, data_json=?, data_type=?, updated_at=NOW() WHERE id=? AND user_id=? AND plugin_slug=?',
          [title, content, jsonStr, data_type, id, userId, slug]);
        return success(res, { id }, '保存成功');
      }
      const result = await query(
        'INSERT INTO plugin_user_data (user_id, plugin_slug, data_type, title, content, data_json) VALUES (?,?,?,?,?,?)',
        [userId, slug, data_type, title, content, jsonStr]);
      return success(res, { id: result.insertId }, '保存成功');
    } catch (err) {
      logger.error('插件保存数据失败', { error: err.message });
      return error(res, '保存失败', 500);
    }
  }

  async getData(req, res) {
    try {
      const userId = req.user.id;
      const { slug } = req.params;
      const { data_type = '', page = 1, pageSize = 50 } = req.query;
      let sql = 'SELECT * FROM plugin_user_data WHERE user_id=? AND plugin_slug=?';
      const params = [userId, slug];
      if (data_type) { sql += ' AND data_type=?'; params.push(data_type); }
      sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
      const rows = await query(sql, params);
      return success(res, rows);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return success(res, []);
      return error(res, '获取数据失败', 500);
    }
  }

  async deleteData(req, res) {
    try {
      const userId = req.user.id;
      const { slug, dataId } = req.params;
      await query('DELETE FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug=?', [dataId, userId, slug]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, '删除失败', 500);
    }
  }

  /* ==================== 视频/图片下载解析 ==================== */

  async parseMediaUrl(req, res) {
    try {
      const { url: targetUrl, platform } = req.body;
      if (!targetUrl) return error(res, '请输入链接', 400);

      const result = await this._fetchAndParseUrl(targetUrl, platform);
      return success(res, result);
    } catch (err) {
      logger.error('解析媒体链接失败', { error: err.message });
      return error(res, '解析失败: ' + err.message, 500);
    }
  }

  _fetchAndParseUrl(targetUrl, platform) {
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(targetUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        timeout: 15000,
      };

      const req = client.request(options, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return this._fetchAndParseUrl(response.headers.location, platform).then(resolve).catch(reject);
        }
        let body = '';
        response.on('data', chunk => body += chunk);
        response.on('end', () => {
          try {
            const result = this._extractMediaFromHtml(body, platform, targetUrl);
            resolve(result);
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
      req.end();
    });
  }

  _extractMediaFromHtml(html, platform, originalUrl) {
    const result = { title: '', description: '', videos: [], images: [], author: '', platform };

    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) result.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
    if (descMatch) result.description = descMatch[1];

    const videoPatterns = [
      /https?:\/\/[^"'\s]+\.mp4[^"'\s]*/gi,
      /https?:\/\/[^"'\s]+video[^"'\s]*\.m3u8[^"'\s]*/gi,
      /"url"\s*:\s*"(https?:\/\/[^"]+\.mp4[^"]*)"/gi,
      /data-src=["'](https?:\/\/[^"']+\.mp4[^"']*)/gi,
      /src=["'](https?:\/\/[^"']+\.mp4[^"']*)/gi,
    ];

    for (const pattern of videoPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const videoUrl = match[1] || match[0];
        if (!result.videos.includes(videoUrl)) result.videos.push(videoUrl);
      }
    }

    const imgPatterns = [
      /<img[^>]+src=["'](https?:\/\/[^"']+)/gi,
      /"originImage"\s*:\s*"(https?:\/\/[^"]+)"/gi,
      /"imageList"\s*:\s*\[(.*?)\]/gi,
    ];

    for (const pattern of imgPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const imgUrl = match[1] || match[0];
        if (imgUrl.match(/\.(jpg|jpeg|png|webp|gif)/i) && !result.images.includes(imgUrl)) {
          result.images.push(imgUrl);
        }
      }
    }

    if (platform === 'xiaohongshu') {
      const noteMatch = html.match(/"noteCard"\s*:\s*(\{[\s\S]*?\})\s*[,}]/);
      if (noteMatch) {
        try {
          const noteStr = noteMatch[1].replace(/\\"/g, '"');
          const imgUrls = noteStr.match(/https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi) || [];
          result.images = [...new Set([...result.images, ...imgUrls])];
        } catch {}
      }
    }

    if (result.videos.length === 0 && result.images.length === 0) {
      result.title = result.title || '内容解析';
      result.description = '已获取页面信息，请复制下方链接在浏览器中打开后手动保存';
      result.fallbackUrl = originalUrl;
    }

    return result;
  }

  /* ==================== AI智能描述 ==================== */

  async generateAiDescription(req, res) {
    try {
      const userId = req.user.id;
      const { property_info, language = 'zh', style = 'professional' } = req.body;
      if (!property_info) return error(res, '请输入房源信息', 400);
      const org = await getOrganization(req.user);
      const [[usage]] = await Promise.all([query(`SELECT COALESCE(SUM(quantity),0) used FROM usage_ledgers WHERE organization_id=? AND metric='ai_point' AND status='settled' AND created_at>=DATE_FORMAT(NOW(),'%Y-%m-01')`, [org.id])]);
      const limit = Number(org.entitlements?.ai_points_monthly ?? 0);
      if (limit >= 0 && Number(usage.used) + 2 > limit) return error(res, '本月 AI 算力额度不足，请升级套餐后重试', 403);

      const aiModels = await query('SELECT * FROM ai_models WHERE is_default = 1 AND status = 1 LIMIT 1');
      const aiModel = aiModels && aiModels[0] ? aiModels[0] : null;

      let description = '';
      if (aiModel && aiModel.api_key && aiModel.api_url) {
        try {
          description = await this._callAiApi(aiModel, property_info, language, style);
        } catch (e) {
          logger.error('AI API调用失败，使用本地生成', { error: e.message });
          description = this._generateLocalDescription(property_info, language, style);
        }
      } else {
        description = this._generateLocalDescription(property_info, language, style);
      }

      await query('INSERT INTO plugin_user_data (user_id, plugin_slug, data_type, title, content, data_json) VALUES (?,?,?,?,?,?)',
        [userId, 'ai-property-desc', 'generation', property_info.substring(0, 100), description, JSON.stringify({ property_info, language, style })]);
      await query(`INSERT INTO usage_ledgers(organization_id,user_id,metric,quantity,reference_type,metadata) VALUES(?,?, 'ai_point',2,'ai_description',?)`, [org.id, userId, JSON.stringify({ language, style, model: aiModel?.model_name || 'local' })]);

      return success(res, { description, language, style });
    } catch (err) {
      logger.error('AI描述生成失败', { error: err.message });
      return error(res, '生成失败: ' + err.message, 500);
    }
  }

  _callAiApi(model, propertyInfo, language, style) {
    return new Promise((resolve, reject) => {
      const langMap = { zh: '中文', en: 'English', ja: '日本語', ko: '한국어' };
      const styleMap = { professional: '专业正式', casual: '轻松活泼', luxury: '高端奢华', friendly: '亲切温馨' };
      const prompt = `请根据以下房源信息，用${langMap[language] || '中文'}生成一段${styleMap[style] || '专业'}风格的房源描述。要求：突出卖点，吸引租客，150-300字。\n\n房源信息：${propertyInfo}`;

      const parsedUrl = url.parse(model.api_url);
      const postData = JSON.stringify({
        model: model.model_name || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.7,
      });

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.path || '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${model.api_key}`,
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 30000,
      };

      const client = parsedUrl.protocol === 'https:' ? https : http;
      const req = client.request(options, (response) => {
        let body = '';
        response.on('data', chunk => body += chunk);
        response.on('end', () => {
          try {
            const data = JSON.parse(body);
            const text = data.choices?.[0]?.message?.content || data.result || '';
            resolve(text.trim());
          } catch { reject(new Error('AI响应解析失败')); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('AI请求超时')); });
      req.write(postData);
      req.end();
    });
  }

  _generateLocalDescription(info, language, style) {
    if (language === 'en') {
      return `Premium rental property available! ${info}. This well-maintained unit offers modern amenities and convenient location. Perfect for expats seeking quality living in Shanghai. Contact us now for viewing arrangements!`;
    }
    return `优质房源推荐！${info}。该房源配套齐全，位置优越，交通便利，周边生活设施完善。精装修，拎包入住，非常适合外籍人士居住。详情请联系我们预约看房！`;
  }

  /* ==================== 翻译 ==================== */

  async translateText(req, res) {
    try {
      const userId = req.user.id;
      const { text, source_lang = 'auto', target_lang = 'en' } = req.body;
      if (!text) return error(res, '请输入需要翻译的文本', 400);

      let translated = '';
      const aiModels = await query('SELECT * FROM ai_models WHERE is_default = 1 AND status = 1 LIMIT 1');
      const aiModel = aiModels && aiModels[0] ? aiModels[0] : null;

      if (aiModel && aiModel.api_key && aiModel.api_url) {
        try {
          const langMap = { zh: '中文', en: '英语', ja: '日语', ko: '韩语', fr: '法语', de: '德语', es: '西班牙语', ru: '俄语', ar: '阿拉伯语' };
          const prompt = `请将以下文本翻译为${langMap[target_lang] || target_lang}，只返回翻译结果，不要其他内容：\n\n${text}`;
          translated = await this._callAiApi(aiModel, prompt, target_lang, 'professional');
          translated = translated.replace(/^["'`]+|["'`]+$/g, '').trim();
        } catch {
          translated = this._simpleTranslate(text, target_lang);
        }
      } else {
        translated = this._simpleTranslate(text, target_lang);
      }

      return success(res, { translated, source_lang, target_lang });
    } catch (err) {
      return error(res, '翻译失败: ' + err.message, 500);
    }
  }

  _simpleTranslate(text, targetLang) {
    if (targetLang === 'en') return `[Translation] ${text}`;
    if (targetLang === 'zh') return `[翻译] ${text}`;
    return `[${targetLang}] ${text}`;
  }

  /* ==================== CRM客户管理（增强版） ==================== */

  _parseCrmData(r) {
    let data = {};
    try { data = typeof r.data_json === 'string' ? JSON.parse(r.data_json) : (r.data_json || {}); } catch {}
    return {
      id: r.id,
      name: r.title,
      ...data,
      followups: data.followups || [],
      sent_property_ids: data.sent_property_ids || [],
      is_pinned: data.is_pinned || false,
      importance: data.importance || 0,
      sort_order: data.sort_order ?? 9999,
      notes: r.content,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  async getCrmClients(req, res) {
    try {
      const userId = req.user.id;
      const { status = '', keyword = '', importance = '' } = req.query;
      let sql = "SELECT * FROM plugin_user_data WHERE user_id=? AND plugin_slug='customer-crm' AND data_type='client'";
      const params = [userId];
      if (keyword) {
        sql += ' AND (title LIKE ? OR content LIKE ? OR data_json LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }
      sql += ' ORDER BY updated_at DESC';
      const rows = await query(sql, params);
      let clients = rows.map(r => this._parseCrmData(r));
      if (status) clients = clients.filter(c => c.status === status);
      if (importance) clients = clients.filter(c => c.importance >= parseInt(importance));
      clients.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return (a.sort_order ?? 9999) - (b.sort_order ?? 9999);
      });
      return success(res, clients);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return success(res, []);
      logger.error('获取CRM客户列表失败', { error: err.message });
      return error(res, '获取客户列表失败', 500);
    }
  }

  async getCrmClientDetail(req, res) {
    try {
      const userId = req.user.id;
      const { clientId } = req.params;
      const rows = await query("SELECT * FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug='customer-crm' AND data_type='client'", [clientId, userId]);
      if (!rows.length) return error(res, '客户不存在', 404);
      const client = this._parseCrmData(rows[0]);
      if (client.sent_property_ids?.length) {
        try {
          const props = await query('SELECT id, title, price, district, address, bedrooms FROM properties WHERE id IN (?) AND user_id=?', [client.sent_property_ids, userId]);
          client.sent_properties = props;
        } catch { client.sent_properties = []; }
      } else {
        client.sent_properties = [];
      }
      return success(res, client);
    } catch (err) {
      logger.error('获取CRM客户详情失败', { error: err.message });
      return error(res, '获取详情失败', 500);
    }
  }

  async saveCrmClient(req, res) {
    try {
      const userId = req.user.id;
      const { id, name, nationality, phone, wechat, email, company, source, cooperative_partner,
        status, importance, is_pinned, sort_order,
        demand_budget_min, demand_budget_max, demand_bedrooms, demand_district,
        demand_metro_lines, demand_metro_stations, demand_property_type,
        demand_has_elevator, demand_has_parking, demand_outdoor_features, demand_notes,
        inquiry_date, rental_start_date, rental_duration,
        followups, sent_property_ids, notes } = req.body;

      if (!name?.trim()) return error(res, '请输入客户姓名', 400);

      const coopPartner = source === 'cooperative_listing' && cooperative_partner?.trim()
        ? cooperative_partner.trim()
        : '';
      const dataJson = {
        name, nationality, phone, wechat, email, company, source,
        cooperative_partner: coopPartner,
        status: status || 'potential',
        importance: importance || 0,
        is_pinned: is_pinned || false,
        sort_order: sort_order ?? 9999,
        demand_budget_min, demand_budget_max, demand_bedrooms, demand_district,
        demand_metro_lines: demand_metro_lines || [],
        demand_metro_stations: demand_metro_stations || [],
        demand_property_type, demand_has_elevator, demand_has_parking,
        demand_outdoor_features: demand_outdoor_features || [],
        demand_notes,
        inquiry_date, rental_start_date, rental_duration,
        followups: followups || [],
        sent_property_ids: sent_property_ids || [],
      };
      const jsonStr = JSON.stringify(dataJson);

      if (id) {
        const existing = await query("SELECT id, data_json FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug='customer-crm'", [id, userId]);
        if (!existing.length) return error(res, '客户不存在', 404);
        let oldData = {};
        try { oldData = typeof existing[0].data_json === 'string' ? JSON.parse(existing[0].data_json) : (existing[0].data_json || {}); } catch {}
        if (!dataJson.followups.length && oldData.followups?.length) {
          dataJson.followups = oldData.followups;
        }
        if (!dataJson.sent_property_ids.length && oldData.sent_property_ids?.length) {
          dataJson.sent_property_ids = oldData.sent_property_ids;
        }
        const mergedJson = JSON.stringify(dataJson);
        await query("UPDATE plugin_user_data SET title=?, content=?, data_json=?, updated_at=NOW() WHERE id=? AND user_id=? AND plugin_slug='customer-crm'",
          [name, notes || '', mergedJson, id, userId]);
        return success(res, { id }, '保存成功');
      }

      const result = await query(
        'INSERT INTO plugin_user_data (user_id, plugin_slug, data_type, title, content, data_json) VALUES (?,?,?,?,?,?)',
        [userId, 'customer-crm', 'client', name, notes || '', jsonStr]);
      return success(res, { id: result.insertId }, '保存成功');
    } catch (err) {
      logger.error('保存CRM客户失败', { error: err.message });
      return error(res, '保存失败', 500);
    }
  }

  async addCrmFollowup(req, res) {
    try {
      const userId = req.user.id;
      const { clientId } = req.params;
      const { content, type = 'note' } = req.body;
      if (!content?.trim()) return error(res, '请输入跟进内容', 400);

      const rows = await query("SELECT * FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug='customer-crm' AND data_type='client'", [clientId, userId]);
      if (!rows.length) return error(res, '客户不存在', 404);

      let data = {};
      try { data = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : (rows[0].data_json || {}); } catch {}
      if (!data.followups) data.followups = [];

      data.followups.unshift({
        id: Date.now(),
        content: content.trim(),
        type,
        created_at: new Date().toISOString(),
      });
      data.last_followup = new Date().toISOString();

      await query("UPDATE plugin_user_data SET data_json=?, content=?, updated_at=NOW() WHERE id=? AND user_id=?",
        [JSON.stringify(data), (rows[0].content ? rows[0].content + '\n' : '') + `[${new Date().toLocaleDateString('zh-CN')}] ${content}`, clientId, userId]);
      return success(res, { followups: data.followups }, '跟进已记录');
    } catch (err) {
      logger.error('添加CRM跟进失败', { error: err.message });
      return error(res, '保存失败', 500);
    }
  }

  async deleteCrmFollowup(req, res) {
    try {
      const userId = req.user.id;
      const { clientId, followupId } = req.params;
      const rows = await query("SELECT * FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug='customer-crm' AND data_type='client'", [clientId, userId]);
      if (!rows.length) return error(res, '客户不存在', 404);

      let data = {};
      try { data = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : (rows[0].data_json || {}); } catch {}
      data.followups = (data.followups || []).filter(f => String(f.id) !== String(followupId));

      await query("UPDATE plugin_user_data SET data_json=?, updated_at=NOW() WHERE id=? AND user_id=?", [JSON.stringify(data), clientId, userId]);
      return success(res, null, '已删除');
    } catch (err) {
      return error(res, '删除失败', 500);
    }
  }

  async toggleCrmPin(req, res) {
    try {
      const userId = req.user.id;
      const { clientId } = req.params;
      const rows = await query("SELECT * FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug='customer-crm' AND data_type='client'", [clientId, userId]);
      if (!rows.length) return error(res, '客户不存在', 404);

      let data = {};
      try { data = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : (rows[0].data_json || {}); } catch {}
      data.is_pinned = !data.is_pinned;

      await query("UPDATE plugin_user_data SET data_json=?, updated_at=NOW() WHERE id=? AND user_id=?", [JSON.stringify(data), clientId, userId]);
      return success(res, { is_pinned: data.is_pinned }, data.is_pinned ? '已置顶' : '已取消置顶');
    } catch (err) {
      return error(res, '操作失败', 500);
    }
  }

  async setCrmImportance(req, res) {
    try {
      const userId = req.user.id;
      const { clientId } = req.params;
      const { importance } = req.body;
      const rows = await query("SELECT * FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug='customer-crm' AND data_type='client'", [clientId, userId]);
      if (!rows.length) return error(res, '客户不存在', 404);

      let data = {};
      try { data = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : (rows[0].data_json || {}); } catch {}
      data.importance = parseInt(importance) || 0;

      await query("UPDATE plugin_user_data SET data_json=?, updated_at=NOW() WHERE id=? AND user_id=?", [JSON.stringify(data), clientId, userId]);
      return success(res, { importance: data.importance }, '已更新');
    } catch (err) {
      return error(res, '操作失败', 500);
    }
  }

  async reorderCrmClients(req, res) {
    try {
      const userId = req.user.id;
      const { orders } = req.body;
      if (!Array.isArray(orders)) return error(res, '参数错误', 400);

      for (const item of orders) {
        const rows = await query("SELECT data_json FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug='customer-crm'", [item.id, userId]);
        if (!rows.length) continue;
        let data = {};
        try { data = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : (rows[0].data_json || {}); } catch {}
        data.sort_order = item.sort_order;
        await query("UPDATE plugin_user_data SET data_json=? WHERE id=? AND user_id=?", [JSON.stringify(data), item.id, userId]);
      }
      return success(res, null, '排序已更新');
    } catch (err) {
      return error(res, '排序失败', 500);
    }
  }

  async saveCrmSentProperties(req, res) {
    try {
      const userId = req.user.id;
      const { clientId } = req.params;
      const { property_ids } = req.body;
      if (!Array.isArray(property_ids)) return error(res, '参数错误', 400);

      const rows = await query("SELECT * FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug='customer-crm' AND data_type='client'", [clientId, userId]);
      if (!rows.length) return error(res, '客户不存在', 404);

      let data = {};
      try { data = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : (rows[0].data_json || {}); } catch {}
      data.sent_property_ids = property_ids;

      await query("UPDATE plugin_user_data SET data_json=?, updated_at=NOW() WHERE id=? AND user_id=?", [JSON.stringify(data), clientId, userId]);
      return success(res, null, '已更新');
    } catch (err) {
      return error(res, '保存失败', 500);
    }
  }

  async searchCrmProperties(req, res) {
    try {
      const userId = req.user.id;
      const { keyword = '', page = 1, pageSize = 20 } = req.query;
      let sql = 'SELECT id, title, price, district, address, bedrooms, bathrooms, area, subway_line, subway_station FROM properties WHERE user_id=?';
      const params = [userId];
      if (keyword) {
        sql += ' AND (title LIKE ? OR property_code LIKE ? OR community LIKE ? OR district LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }
      sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
      const rows = await query(sql, params);
      return success(res, rows);
    } catch (err) {
      return success(res, []);
    }
  }

  /* ==================== 需求订阅插件 ==================== */

  async getSubscriptions(req, res) {
    try {
      const userId = req.user.id;
      const { status = '' } = req.query;
      let sql = "SELECT * FROM plugin_user_data WHERE user_id=? AND plugin_slug='demand-subscribe' AND data_type='subscription' ORDER BY updated_at DESC";
      const rows = await query(sql, [userId]);
      let subs = rows.map(r => {
        let data = {};
        try { data = typeof r.data_json === 'string' ? JSON.parse(r.data_json) : (r.data_json || {}); } catch {}
        return { id: r.id, name: r.title, ...data, created_at: r.created_at, updated_at: r.updated_at };
      });
      if (status) subs = subs.filter(s => s.status === status);
      return success(res, subs);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return success(res, []);
      logger.error('获取订阅列表失败', { error: err.message });
      return error(res, '获取失败', 500);
    }
  }

  async saveSubscription(req, res) {
    try {
      const userId = req.user.id;
      const { id, name, client_name, client_id,
        budget_min, budget_max, bedrooms, district, metro_lines, metro_stations,
        property_type, has_elevator, has_parking, outdoor_features, keywords,
        monitor_start, monitor_end,
        notify_email, notify_sms, notify_wechat_official,
        email_address, phone_number,
        status } = req.body;

      if (!name?.trim()) return error(res, '请输入订阅名称', 400);

      const dataJson = {
        client_name, client_id,
        budget_min, budget_max, bedrooms, district,
        metro_lines: metro_lines || [], metro_stations: metro_stations || [],
        property_type, has_elevator, has_parking,
        outdoor_features: outdoor_features || [], keywords,
        monitor_start, monitor_end,
        notify_email: notify_email || false, notify_sms: notify_sms || false,
        notify_wechat_official: notify_wechat_official || false,
        email_address, phone_number,
        status: status || 'active',
        matches: [],
        stats: { total: 0, unread: 0, read: 0 },
      };

      if (id) {
        const existing = await query("SELECT data_json FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug='demand-subscribe'", [id, userId]);
        if (!existing.length) return error(res, '订阅不存在', 404);
        let oldData = {};
        try { oldData = typeof existing[0].data_json === 'string' ? JSON.parse(existing[0].data_json) : (existing[0].data_json || {}); } catch {}
        dataJson.matches = oldData.matches || [];
        dataJson.stats = oldData.stats || { total: 0, unread: 0, read: 0 };
        await query("UPDATE plugin_user_data SET title=?, data_json=?, updated_at=NOW() WHERE id=? AND user_id=?",
          [name, JSON.stringify(dataJson), id, userId]);
        return success(res, { id }, '保存成功');
      }

      const result = await query(
        'INSERT INTO plugin_user_data (user_id, plugin_slug, data_type, title, content, data_json) VALUES (?,?,?,?,?,?)',
        [userId, 'demand-subscribe', 'subscription', name, '', JSON.stringify(dataJson)]);
      return success(res, { id: result.insertId }, '创建成功');
    } catch (err) {
      logger.error('保存订阅失败', { error: err.message });
      return error(res, '保存失败', 500);
    }
  }

  async toggleSubscriptionStatus(req, res) {
    try {
      const userId = req.user.id;
      const { subId } = req.params;
      const { status } = req.body;
      if (!['active', 'paused', 'ended'].includes(status)) return error(res, '无效状态', 400);

      const rows = await query("SELECT data_json FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug='demand-subscribe'", [subId, userId]);
      if (!rows.length) return error(res, '订阅不存在', 404);

      let data = {};
      try { data = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : (rows[0].data_json || {}); } catch {}
      data.status = status;
      await query("UPDATE plugin_user_data SET data_json=?, updated_at=NOW() WHERE id=? AND user_id=?", [JSON.stringify(data), subId, userId]);
      return success(res, { status }, '状态已更新');
    } catch (err) {
      return error(res, '操作失败', 500);
    }
  }

  async runSubscriptionMatch(req, res) {
    try {
      const userId = req.user.id;
      const { subId } = req.params;
      const rows = await query("SELECT * FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug='demand-subscribe'", [subId, userId]);
      if (!rows.length) return error(res, '订阅不存在', 404);

      let data = {};
      try { data = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : (rows[0].data_json || {}); } catch {}

      let sql = "SELECT id, title, price, district, address, bedrooms, bathrooms, area, subway_line, subway_station, metro_line, metro_station, features, created_at FROM properties WHERE user_id=? AND status='published'";
      const params = [userId];

      if (data.budget_min) { sql += ' AND price >= ?'; params.push(parseInt(data.budget_min)); }
      if (data.budget_max) { sql += ' AND price <= ?'; params.push(parseInt(data.budget_max)); }
      if (data.bedrooms) { sql += ' AND bedrooms = ?'; params.push(parseInt(data.bedrooms)); }
      if (data.district) { sql += ' AND district LIKE ?'; params.push(`%${data.district}%`); }
      if (data.monitor_start) { sql += ' AND created_at >= ?'; params.push(data.monitor_start); }
      if (data.monitor_end) { sql += ' AND created_at <= ?'; params.push(data.monitor_end + ' 23:59:59'); }
      if (data.keywords) {
        sql += ' AND (title LIKE ? OR description LIKE ? OR address LIKE ?)';
        params.push(`%${data.keywords}%`, `%${data.keywords}%`, `%${data.keywords}%`);
      }
      sql += ' ORDER BY created_at DESC LIMIT 100';

      let matched = await query(sql, params);

      if (data.metro_lines?.length) {
        matched = matched.filter(p => {
          const pLines = (p.subway_line || p.metro_line || '').toLowerCase();
          return data.metro_lines.some(l => pLines.includes(l.replace('号线', '').toLowerCase()) || pLines.includes(l.toLowerCase()));
        });
      }

      const existingIds = new Set((data.matches || []).map(m => m.property_id));
      const readIds = new Set((data.matches || []).filter(m => m.is_read).map(m => m.property_id));

      const newMatches = matched.map(p => ({
        property_id: p.id,
        title: p.title || p.address || '未命名',
        price: p.price,
        district: p.district,
        bedrooms: p.bedrooms,
        address: p.address,
        matched_at: existingIds.has(p.id) ? ((data.matches || []).find(m => m.property_id === p.id)?.matched_at || new Date().toISOString()) : new Date().toISOString(),
        is_read: readIds.has(p.id),
      }));

      data.matches = newMatches;
      data.stats = {
        total: newMatches.length,
        unread: newMatches.filter(m => !m.is_read).length,
        read: newMatches.filter(m => m.is_read).length,
      };
      data.last_match_time = new Date().toISOString();

      await query("UPDATE plugin_user_data SET data_json=?, updated_at=NOW() WHERE id=? AND user_id=?", [JSON.stringify(data), subId, userId]);
      return success(res, { stats: data.stats, matches: newMatches });
    } catch (err) {
      logger.error('需求匹配执行失败', { error: err.message });
      return error(res, '匹配失败', 500);
    }
  }

  async markSubscriptionRead(req, res) {
    try {
      const userId = req.user.id;
      const { subId } = req.params;
      const { property_ids } = req.body;
      if (!Array.isArray(property_ids)) return error(res, '参数错误', 400);

      const rows = await query("SELECT data_json FROM plugin_user_data WHERE id=? AND user_id=? AND plugin_slug='demand-subscribe'", [subId, userId]);
      if (!rows.length) return error(res, '订阅不存在', 404);

      let data = {};
      try { data = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : (rows[0].data_json || {}); } catch {}
      const idSet = new Set(property_ids);
      (data.matches || []).forEach(m => { if (idSet.has(m.property_id)) m.is_read = true; });
      data.stats = {
        total: (data.matches || []).length,
        unread: (data.matches || []).filter(m => !m.is_read).length,
        read: (data.matches || []).filter(m => m.is_read).length,
      };

      await query("UPDATE plugin_user_data SET data_json=?, updated_at=NOW() WHERE id=? AND user_id=?", [JSON.stringify(data), subId, userId]);
      return success(res, { stats: data.stats }, '已标记已读');
    } catch (err) {
      return error(res, '操作失败', 500);
    }
  }

  /* ==================== 数据统计 ==================== */

  async getAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const propCount = await query('SELECT COUNT(*) as cnt FROM properties WHERE user_id=?', [userId]).catch(() => [{ cnt: 0 }]);
      const parsedCount = await query('SELECT COUNT(*) as cnt FROM wechat_robot_parsed_properties WHERE user_id=?', [userId]).catch(() => [{ cnt: 0 }]);
      const viewCount = await query("SELECT COALESCE(SUM(view_count),0) as cnt FROM properties WHERE user_id=?", [userId]).catch(() => [{ cnt: 0 }]);
      const shareCount = await query('SELECT COUNT(*) as cnt FROM wechat_robot_share_history WHERE user_id=?', [userId]).catch(() => [{ cnt: 0 }]);

      const recentProps = await query(
        'SELECT DATE(created_at) as date, COUNT(*) as count FROM properties WHERE user_id=? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY DATE(created_at) ORDER BY date',
        [userId]
      ).catch(() => []);

      return success(res, {
        totalProperties: propCount[0]?.cnt || 0,
        parsedProperties: parsedCount[0]?.cnt || 0,
        totalViews: viewCount[0]?.cnt || 0,
        totalShares: shareCount[0]?.cnt || 0,
        recentTrend: recentProps,
      });
    } catch (err) {
      return success(res, { totalProperties: 0, parsedProperties: 0, totalViews: 0, totalShares: 0, recentTrend: [] });
    }
  }

  /* ==================== SEO分析 ==================== */

  async analyzeSeo(req, res) {
    try {
      const { url: pageUrl } = req.body;
      if (!pageUrl) return error(res, '请输入页面URL', 400);

      const html = await this._fetchPage(pageUrl);
      const analysis = this._analyzeSeoFromHtml(html, pageUrl);
      return success(res, analysis);
    } catch (err) {
      return error(res, 'SEO分析失败: ' + err.message, 500);
    }
  }

  _fetchPage(targetUrl) {
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(targetUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const req = client.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, (response) => {
        let body = '';
        response.on('data', chunk => body += chunk);
        response.on('end', () => resolve(body));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
    });
  }

  _analyzeSeoFromHtml(html, pageUrl) {
    const issues = [];
    const suggestions = [];
    let score = 100;

    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    if (!title) { issues.push('缺少页面标题(title)'); score -= 15; }
    else if (title.length < 10) { suggestions.push('标题过短，建议15-60个字符'); score -= 5; }
    else if (title.length > 60) { suggestions.push('标题过长，建议控制在60字符以内'); score -= 5; }

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
    const desc = descMatch ? descMatch[1].trim() : '';
    if (!desc) { issues.push('缺少meta description'); score -= 15; }
    else if (desc.length < 50) { suggestions.push('description过短，建议120-160字符'); score -= 5; }

    if (!html.match(/<h1[^>]*>/i)) { issues.push('缺少H1标签'); score -= 10; }
    if (!html.match(/<meta[^>]*name=["']viewport["']/i)) { issues.push('缺少viewport meta标签（影响移动端）'); score -= 10; }
    if (!html.match(/<meta[^>]*charset/i)) { suggestions.push('建议添加charset meta标签'); score -= 3; }

    const imgNoAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;
    if (imgNoAlt > 0) { suggestions.push(`${imgNoAlt}张图片缺少alt属性`); score -= Math.min(imgNoAlt * 2, 10); }

    if (!html.match(/<link[^>]*rel=["']canonical["']/i)) { suggestions.push('建议添加canonical链接'); score -= 5; }
    const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
    if (h2Count === 0) { suggestions.push('建议添加H2子标题来组织内容'); score -= 3; }

    return { score: Math.max(0, score), title, description: desc, issues, suggestions, pageUrl };
  }
}

module.exports = new PluginExecuteController();
