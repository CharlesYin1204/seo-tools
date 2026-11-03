const axios = require('axios');
const logger = require('../utils/logger');
const { query } = require('../config/database');

class WeChatRobotService {
  normalizeBaseUrl(apiUrl = '') {
    let baseUrl = String(apiUrl || '').trim().replace(/\/$/, '');

    if (baseUrl && !/\/finder\/v\d+\/api$/i.test(baseUrl) && !/\/api$/i.test(baseUrl)) {
      baseUrl = `${baseUrl}/finder/v2/api`;
    }

    return baseUrl;
  }

  async callApi(apiUrl, token, endpoint, data = {}, timeout = 30000) {
    try {
      let baseUrl = this.normalizeBaseUrl(apiUrl);

      if (endpoint.startsWith('/api/') && baseUrl.endsWith('/api')) {
        endpoint = endpoint.substring(4);
      }

      const url = `${baseUrl}${endpoint}`;
      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-GEWE-TOKEN': token,
          'X-finder-TOKEN': token,
          Authorization: `Bearer ${token}`,
        },
        timeout,
      });

      return response.data;
    } catch (error) {
      logger.error('WeChat robot API call failed', {
        endpoint,
        error: error.message,
        response: error.response?.data,
      });

      throw new Error(`API调用失败: ${error.message}`);
    }
  }

  async callApiWithFallbacks(apiUrl, token, endpoints, data = {}, timeout = 30000) {
    const endpointList = Array.isArray(endpoints) ? endpoints : [endpoints];
    let lastError = null;

    for (const endpoint of endpointList.filter(Boolean)) {
      try {
        return await this.callApi(apiUrl, token, endpoint, data, timeout);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('API调用失败: no usable endpoint');
  }

  async getApiConfig(userId) {
    const sql = 'SELECT * FROM wechat_robot_api_config WHERE user_id = ? LIMIT 1';
    const rows = await query(sql, [userId]);
    return rows[0] || null;
  }

  async saveApiConfig(userId, configData) {
    const sql = `INSERT INTO wechat_robot_api_config (user_id, api_name, api_url, api_key, token, webhook_url, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE api_name = ?, api_url = ?, api_key = ?, token = ?, webhook_url = ?, updated_at = NOW()`;
    const { api_name, api_url, api_key, token, webhook_url } = configData;

    return query(sql, [
      userId, api_name, api_url, api_key, token, webhook_url,
      api_name, api_url, api_key, token, webhook_url,
    ]);
  }

  async getLoginQrCode(apiUrl, token, appId = '', regionId = '', type = 'mac') {
    const data = { appId: appId || '', type: type || 'mac' };
    if (regionId) data.regionId = regionId;
    return this.callApi(apiUrl, token, '/login/getLoginQrCode', data);
  }

  async checkLoginStatus(apiUrl, token, appId, uuid, autoSliding = true) {
    const data = { appId, uuid: uuid || '', autoSliding };
    return this.callApi(apiUrl, token, '/login/checkLogin', data);
  }

  async checkDeviceOnline(apiUrl, token, appId) {
    return this.callApi(apiUrl, token, '/login/checkOnline', { appId });
  }

  async logoutDevice(apiUrl, token, appId) {
    return this.callApi(apiUrl, token, '/login/logout', { appId });
  }

  async syncContacts(apiUrl, token, appId) {
    let allWxids = [];
    let chatrooms = [];
    let needCache = false;

    try {
      const listResult = await this.callApi(apiUrl, token, '/contacts/fetchContactsList', { appId }, 150000);
      if (listResult && listResult.ret === 200 && listResult.data) {
        const friends = listResult.data.friends || [];
        const ghs = listResult.data.ghs || [];
        chatrooms = listResult.data.chatrooms || [];
        allWxids = [...friends, ...ghs];
      } else {
        needCache = true;
      }
    } catch {
      needCache = true;
    }

    if (needCache || allWxids.length < 100) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      for (let i = 0; i < 10; i += 1) {
        try {
          const cacheResult = await this.callApi(apiUrl, token, '/contacts/fetchContactsListCache', { appId }, 30000);
          if (cacheResult && cacheResult.ret === 200 && cacheResult.data) {
            const friends = cacheResult.data.friends || [];
            const ghs = cacheResult.data.ghs || [];
            const cacheWxids = [...friends, ...ghs];
            if (!chatrooms.length) chatrooms = cacheResult.data.chatrooms || [];
            if (cacheWxids.length > allWxids.length) allWxids = cacheWxids;
            if (cacheWxids.length >= 100) break;
          }
        } catch {}

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    const systemAccounts = [
      'tmessage',
      'medianote',
      'qmessage',
      'qqmail',
      'qqsafe',
      'weixin',
      'exmail_tool',
      'filehelper',
      'floatbottle',
      'shakeapp',
      'lbsapp',
      'newsapp',
    ];

    allWxids = allWxids.filter((wxid) => wxid && !systemAccounts.includes(wxid));

    return { data: allWxids, chatrooms, total: allWxids.length };
  }

  async getContactDetails(apiUrl, token, appId, wxids) {
    try {
      const result = await this.callApi(apiUrl, token, '/contacts/getDetailInfo', { appId, wxids }, 30000);
      if (result && result.ret === 200 && result.data) {
        return Array.isArray(result.data) ? result.data : [];
      }
      return [];
    } catch {
      return [];
    }
  }

  async getContactBriefInfo(apiUrl, token, appId, wxids) {
    try {
      const result = await this.callApi(apiUrl, token, '/contacts/getBriefInfo', { appId, wxids }, 30000);
      if (result && result.ret === 200 && result.data) {
        return Array.isArray(result.data) ? result.data : [];
      }
      return [];
    } catch {
      return [];
    }
  }

  async getChatroomInfo(apiUrl, token, appId, chatroomId) {
    return this.callApi(apiUrl, token, '/group/getChatroomInfo', { appId, chatroomId }, 10000);
  }

  async sendTextMessage(apiUrl, token, wxid, toWxid, content, appId = null) {
    const data = { wxid, toWxid, content };
    if (appId) data.appId = appId;
    return this.callApiWithFallbacks(apiUrl, token, ['/message/postText', '/message/sendText'], data);
  }

  async sendImageMessage(apiUrl, token, wxid, toWxid, imageUrl, appId = null) {
    const data = { wxid, toWxid, imageUrl, imgUrl: imageUrl };
    if (appId) data.appId = appId;
    return this.callApiWithFallbacks(apiUrl, token, ['/message/postImage', '/message/sendImage'], data);
  }

  async getGroupList(apiUrl, token, wxid) {
    return this.callApi(apiUrl, token, '/group/getGroupList', { wxid });
  }

  async getMoments(apiUrl, token, appId, maxId = 0) {
    return this.callApi(apiUrl, token, '/sns/snsList', { appId, maxId: maxId || 0, decrypt: true }, 60000);
  }

  async postMoment(apiUrl, token, wxid, content, mediaUrls = []) {
    return this.callApi(apiUrl, token, '/sns/postTimeLine', { wxid, content, mediaUrls });
  }

  async searchMoments(apiUrl, token, wxid, keyword) {
    return this.callApi(apiUrl, token, '/sns/searchTimeLine', { wxid, keyword });
  }

  async syncFavorites(apiUrl, token, appId, syncKey = '') {
    return this.callApi(apiUrl, token, '/favor/sync', { appId, syncKey: syncKey || '' }, 60000);
  }

  async getFavoriteContent(apiUrl, token, appId, favId) {
    return this.callApi(apiUrl, token, '/favor/getContent', { appId, favId: Number(favId) }, 30000);
  }

  async downloadImage(apiUrl, token, appId, xml, type = 1) {
    return this.callApi(apiUrl, token, '/message/downloadImage', {
      appId,
      type: Number(type) || 1,
      xml,
    }, 60000);
  }

  async getFavorites(apiUrl, token, wxid) {
    return this.callApi(apiUrl, token, '/favorite/getList', { wxid });
  }

  async getFinderInfo(apiUrl, token, wxid) {
    return this.callApiWithFallbacks(apiUrl, token, ['/finder/getProfile', '/finder/getMyInfo'], { wxid });
  }
}

module.exports = new WeChatRobotService();
