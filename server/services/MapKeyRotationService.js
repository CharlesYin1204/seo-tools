/**
 * 地图API Key轮训服务
 * 管理多组高德地图Key的轮训、限流检测和自动切换
 */
const axios = require('axios');
const { query } = require('../config/database');
const logger = require('../utils/logger');

class MapKeyRotationService {
  constructor() {
    this._cache = null;
    this._cacheTime = 0;
    this._roundRobinIndex = 0;
    this._cacheTTL = 60 * 1000;
  }

  /**
   * 清除缓存（配置变更后调用）
   */
  clearCache() {
    this._cache = null;
    this._cacheTime = 0;
  }

  /**
   * 获取所有启用的Key组列表（带缓存）
   * @returns {Promise<Array>}
   */
  async getEnabledGroups() {
    const now = Date.now();
    if (this._cache && (now - this._cacheTime) < this._cacheTTL) {
      return this._cache;
    }
    try {
      const rows = await query(
        `SELECT * FROM system_map_key_groups 
         WHERE is_enabled = 1 
         ORDER BY is_default DESC, sort_order ASC, id ASC`
      );
      this._cache = rows;
      this._cacheTime = now;
      return rows;
    } catch (err) {
      logger.error('MapKeyRotationService.getEnabledGroups 失败', { error: err.message });
      return this._cache || [];
    }
  }

  /**
   * 获取轮训模式配置
   * @returns {Promise<{rotation_mode: string, current_group_index: number}>}
   */
  async getRotationConfig() {
    try {
      const [row] = await query(
        `SELECT rotation_mode, current_group_index FROM system_map_settings LIMIT 1`
      );
      return {
        rotation_mode: row?.rotation_mode || 'default_first',
        current_group_index: row?.current_group_index || 0,
      };
    } catch (err) {
      return { rotation_mode: 'default_first', current_group_index: 0 };
    }
  }

  /**
   * 根据轮训规则选取当前使用的Key组
   * @param {string} keyType - 'api_key' | 'js_api_key'
   * @returns {Promise<{api_key:string, js_api_key:string, security_js_key:string, group_id:number}|null>}
   */
  async getCurrentKeyGroup(keyType = 'api_key') {
    const groups = await this.getEnabledGroups();
    if (!groups.length) return null;

    const today = new Date().toISOString().slice(0, 10);
    const available = groups.filter(g => {
      if (g.status === 'error') return false;
      if (g.daily_limit > 0 && g.used_date === today && g.used_count >= g.daily_limit) {
        return false;
      }
      return true;
    });

    if (!available.length) {
      logger.warn('MapKeyRotationService: 所有Key组均不可用，使用默认组');
      const defaultGroup = groups.find(g => g.is_default) || groups[0];
      return this._formatGroup(defaultGroup);
    }

    const config = await this.getRotationConfig();
    let selected;

    switch (config.rotation_mode) {
      case 'round_robin': {
        const idx = this._roundRobinIndex % available.length;
        selected = available[idx];
        this._roundRobinIndex = (this._roundRobinIndex + 1) % available.length;
        await this._updateGroupIndex(this._roundRobinIndex).catch(() => {});
        break;
      }
      case 'random': {
        const idx = Math.floor(Math.random() * available.length);
        selected = available[idx];
        break;
      }
      case 'failover': {
        const defaultGroup = available.find(g => g.is_default);
        selected = defaultGroup || available[0];
        break;
      }
      case 'default_first':
      default: {
        const defaultGroup = available.find(g => g.is_default);
        selected = defaultGroup || available[0];
        break;
      }
    }

    await this._incrementUsage(selected.id).catch(() => {});
    return this._formatGroup(selected);
  }

  /**
   * 获取Web服务API Key（给地理编码等后端服务使用）
   * @returns {Promise<string>}
   */
  async getApiKey() {
    const group = await this.getCurrentKeyGroup('api_key');
    return group?.api_key || process.env.AMAP_API_KEY || '';
  }

  /**
   * 获取JS API Key（给前端地图使用）
   * @returns {Promise<{js_api_key:string, security_js_key:string}>}
   */
  async getJsApiKey() {
    const group = await this.getCurrentKeyGroup('js_api_key');
    return {
      js_api_key: group?.js_api_key || '',
      security_js_key: group?.security_js_key || '',
    };
  }

  /**
   * 检测单个Key组的可用性和额度
   * @param {number} groupId
   * @returns {Promise<Object>} 检测结果
   */
  async checkKeyStatus(groupId) {
    try {
      const [group] = await query('SELECT * FROM system_map_key_groups WHERE id = ?', [groupId]);
      if (!group) return { success: false, message: 'Key组不存在' };

      const results = {
        group_id: groupId,
        group_name: group.group_name,
        api_key_status: null,
        js_api_key_status: null,
        checked_at: new Date().toISOString(),
      };

      if (group.api_key) {
        results.api_key_status = await this._testApiKey(group.api_key);
      }

      if (group.js_api_key) {
        results.js_api_key_status = await this._testJsApiKey(group.js_api_key);
      }

      let newStatus = 'normal';
      const apiStatus = results.api_key_status;
      const jsStatus = results.js_api_key_status;

      if (apiStatus?.limited || jsStatus?.limited) {
        newStatus = 'limited';
      }
      if (apiStatus?.error || jsStatus?.error) {
        newStatus = 'error';
      }

      await query(
        `UPDATE system_map_key_groups 
         SET status = ?, last_check_at = NOW(), check_result = ?, updated_at = NOW()
         WHERE id = ?`,
        [newStatus, JSON.stringify(results), groupId]
      );

      this.clearCache();
      return { success: true, status: newStatus, details: results };
    } catch (err) {
      logger.error('MapKeyRotationService.checkKeyStatus 失败', { groupId, error: err.message });
      return { success: false, message: err.message };
    }
  }

  /**
   * 测试Web服务API Key是否有效
   */
  async _testApiKey(apiKey) {
    try {
      const res = await axios.get('https://restapi.amap.com/v3/geocode/geo', {
        params: { key: apiKey, address: '上海市浦东新区' },
        timeout: 8000,
      });
      const data = res.data;
      if (data.status === '1') {
        return { valid: true, limited: false, error: false, info: data.info || 'OK', infocode: data.infocode };
      }
      const limited = ['10003', '10004', '10009', '10044'].includes(data.infocode);
      return {
        valid: false,
        limited,
        error: !limited,
        info: data.info || '未知错误',
        infocode: data.infocode,
      };
    } catch (err) {
      return { valid: false, limited: false, error: true, info: err.message };
    }
  }

  /**
   * 测试JS API Key是否有效（通过Web服务API进行简单探测）
   */
  async _testJsApiKey(jsApiKey) {
    try {
      const res = await axios.get('https://restapi.amap.com/v3/config/district', {
        params: { key: jsApiKey, keywords: '上海', subdistrict: 0 },
        timeout: 8000,
      });
      const data = res.data;
      if (data.status === '1') {
        return { valid: true, limited: false, error: false, info: data.info || 'OK', infocode: data.infocode };
      }
      const limited = ['10003', '10004', '10009', '10044'].includes(data.infocode);
      return {
        valid: false,
        limited,
        error: !limited,
        info: data.info || '未知错误',
        infocode: data.infocode,
      };
    } catch (err) {
      return { valid: false, limited: false, error: true, info: err.message };
    }
  }

  _formatGroup(group) {
    return {
      group_id: group.id,
      group_name: group.group_name,
      api_key: group.api_key || '',
      js_api_key: group.js_api_key || '',
      security_js_key: group.security_js_key || '',
    };
  }

  async _incrementUsage(groupId) {
    const today = new Date().toISOString().slice(0, 10);
    await query(
      `UPDATE system_map_key_groups 
       SET used_count = IF(used_date = ?, used_count + 1, 1),
           used_date = ?,
           last_used_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [today, today, groupId]
    );
  }

  async _updateGroupIndex(index) {
    await query(
      `UPDATE system_map_settings SET current_group_index = ? WHERE id = (SELECT id FROM (SELECT id FROM system_map_settings LIMIT 1) t)`,
      [index]
    );
  }
}

module.exports = new MapKeyRotationService();
