/**
 * 管理后台微信机器人控制器
 * 所有账号、联系人、统计、扫码登录 - 与 PHP 版本一致
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
let WeChatRobotService;
try { WeChatRobotService = require('../../services/WeChatRobotService'); } catch { WeChatRobotService = null; }
let WeChatRobotContact;
try { WeChatRobotContact = require('../../models/WeChatRobotContact'); } catch { WeChatRobotContact = null; }
let WeChatRobotAccount;
try { WeChatRobotAccount = require('../../models/WeChatRobotAccount'); } catch { WeChatRobotAccount = null; }
const { parseMediaUrlsFromSnsXml, extractMomentMediaUrlsFromSns, parseFavoriteNoteFromXml, parseContentStyleFromXml, parseFullContentFromXml } = require('../../utils/snsXmlMediaParser');

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
  const rows = await query(
    'SELECT wxid FROM wechat_robot_contacts WHERE robot_id = ? AND is_blocked = 1',
    [robotId]
  ).catch(() => []);
  return new Set((rows || []).map((r) => String(r.wxid || '').trim()).filter(Boolean));
}

const MAX_MOMENTS_PER_REFRESH = 2000;
const MOMENTS_PAGE_DELAY_MS = 600;

class WeChatRobotController {
  /**
   * 获取机器人账号列表（含用户信息：username, email, display_name, wechat_robot_limit, wechat_robot_expire_at）
   */
  async getAllAccounts(req, res) {
    try {
      const rows = await query(
        `SELECT ra.*, u.username, u.email, u.display_name as user_display_name,
                u.wechat_robot_limit, u.wechat_robot_expire_at,
                ra.created_at as activated_at
         FROM wechat_robot_accounts ra
         LEFT JOIN users u ON ra.user_id = u.id
         ORDER BY ra.is_default DESC, ra.created_at DESC`
      );
      return success(res, rows || []);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getAllContacts(req, res) {
    try {
      const { accountId = '' } = req.query;
      let sql =
        'SELECT c.*, a.nickname as account_nickname FROM wechat_robot_contacts c LEFT JOIN wechat_robot_accounts a ON c.robot_id = a.id WHERE 1=1';
      const params = [];
      if (accountId) {
        sql += ' AND c.robot_id = ?';
        params.push(accountId);
      }
      sql += ' ORDER BY c.updated_at DESC LIMIT 500';
      const rows = await query(sql, params);
      return success(res, rows);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 获取统计数据 - 9 项与 PHP 版本一致
   */
  async getStatistics(req, res) {
    try {
      const [
        totalRobotsRow,
        onlineRobotsRow,
        activeOnlineRow,
        contactsRow,
        groupsRow,
        messagesRow,
        todayMessagesRow,
        momentsRow,
        autoRepliesRow,
      ] = await Promise.all([
        query("SELECT COUNT(*) as val FROM wechat_robot_accounts WHERE is_active = 1"),
        query("SELECT COUNT(*) as val FROM wechat_robot_accounts WHERE status = 'online' AND is_active = 1"),
        query(
          `SELECT COUNT(*) as val FROM wechat_robot_accounts ra
           INNER JOIN users u ON ra.user_id = u.id
           WHERE ra.status = 'online' AND ra.is_active = 1
           AND (u.wechat_robot_expire_at IS NULL OR u.wechat_robot_expire_at > NOW())`
        ),
        query('SELECT COUNT(*) as val FROM wechat_robot_contacts'),
        query('SELECT COUNT(*) as val FROM wechat_robot_groups'),
        query('SELECT COUNT(*) as val FROM wechat_robot_messages'),
        query('SELECT COUNT(*) as val FROM wechat_robot_messages WHERE DATE(created_at) = CURDATE()'),
        query("SELECT COUNT(*) as val FROM wechat_robot_moments WHERE status = 'published'"),
        query('SELECT COUNT(*) as val FROM wechat_robot_auto_replies WHERE is_active = 1'),
      ]);

      const getVal = (row) => (Array.isArray(row) && row[0] ? parseInt(row[0].val, 10) : 0);

      return success(res, {
        total_robots: getVal(totalRobotsRow),
        online_robots: getVal(onlineRobotsRow),
        active_online_robots: getVal(activeOnlineRow),
        total_contacts: getVal(contactsRow),
        total_groups: getVal(groupsRow),
        total_messages: getVal(messagesRow),
        today_messages: getVal(todayMessagesRow),
        total_moments: getVal(momentsRow),
        total_auto_replies: getVal(autoRepliesRow),
      });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 获取微信机器人 API 配置（管理员全局配置，存于 wechat_robot_api_config 表 user_id=0）
   */
  async getApiConfig(req, res) {
    try {
      const rows = await query('SELECT * FROM wechat_robot_api_config WHERE user_id = 0 LIMIT 1');
      const config = rows && rows[0] ? rows[0] : {};
      let settings = {};
      if (config.settings) {
        try {
          settings = typeof config.settings === 'string' ? JSON.parse(config.settings) : config.settings;
        } catch { settings = {}; }
      }
      return success(res, {
        api_name: config.api_name ?? '',
        api_url: config.api_url ?? '',
        api_key: config.api_key ?? '',
        api_secret: config.api_secret ?? '',
        token: config.token ?? '',
        webhook_url: config.webhook_url ?? '',
        allow_user_config: !!(settings.allow_user_config),
        max_robots_per_user: parseInt(settings.max_robots_per_user, 10) || 1,
        require_membership: !!(settings.require_membership),
      });
    } catch (err) {
      return error(res, '获取配置失败: ' + err.message, 500);
    }
  }

  /**
   * 保存微信机器人 API 配置（写入 wechat_robot_api_config 表 user_id=0）
   */
  async saveApiConfig(req, res) {
    try {
      const {
        api_name, api_url, api_key, api_secret, token, webhook_url,
        allow_user_config, max_robots_per_user, require_membership,
      } = req.body || {};

      const settings = JSON.stringify({
        allow_user_config: allow_user_config ? 1 : 0,
        max_robots_per_user: parseInt(max_robots_per_user, 10) || 1,
        require_membership: require_membership ? 1 : 0,
      });

      const existing = await query('SELECT id FROM wechat_robot_api_config WHERE user_id = 0 LIMIT 1');
      if (existing && existing.length > 0) {
        await query(
          `UPDATE wechat_robot_api_config 
           SET api_name = ?, api_url = ?, api_key = ?, api_secret = ?, token = ?, webhook_url = ?, settings = ?, updated_at = NOW()
           WHERE user_id = 0`,
          [api_name || '', api_url || '', api_key || '', api_secret || '', token || '', webhook_url || '', settings]
        );
      } else {
        await query(
          `INSERT INTO wechat_robot_api_config (user_id, api_name, api_url, api_key, api_secret, token, webhook_url, settings, status, created_at, updated_at)
           VALUES (0, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
          [api_name || '', api_url || '', api_key || '', api_secret || '', token || '', webhook_url || '', settings]
        );
      }
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message || '保存失败', 500);
    }
  }
  /**
   * 管理员获取指定账号的通讯录
   */
  async getContactsByRobotId(req, res) {
    try {
      const { robotId } = req.params;
      const { page = 1, per_page = 20, pageSize, search = '', contactType = '', type = '' } = req.query;
      const ps = parseInt(pageSize || per_page, 10) || 20;
      const pg = parseInt(page, 10) || 1;
      const offset = (pg - 1) * ps;
      let sql = 'SELECT * FROM wechat_robot_contacts WHERE robot_id = ?';
      const params = [robotId];
      const t = type || contactType;
      if (t) { sql += ' AND contact_type = ?'; params.push(t); }
      const keyword = search || req.query.keyword || '';
      if (keyword) { sql += ' AND (nickname LIKE ? OR wxid LIKE ? OR remark LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countRows = await query(countSql, params);
      const total = (countRows && countRows[0]) ? countRows[0].total : 0;
      sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      params.push(ps, offset);
      const rows = await query(sql, params);
      return success(res, { data: rows || [], total, pagination: { total, current_page: pg, per_page: ps } });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 管理员同步指定账号的通讯录
   */
  async syncContacts(req, res) {
    try {
      const { robotId } = req.params;
      const acct = await this._getAccount(robotId);
      if (!acct) return error(res, '账号不存在', 404);
      const deviceId = acct.device_id;
      if (!deviceId) return error(res, '设备ID不存在，请重新登录微信');
      const config = await this._getApiConfig(acct.user_id);
      if (!config) return error(res, '请先配置API');

      // 先实时检查设备状态
      if (acct.status !== 'online') {
        try {
          const onlineCheck = await WeChatRobotService.checkDeviceOnline(config.api_url, config.token, deviceId);
          const isOnline = onlineCheck?.data === true || onlineCheck?.data?.online === true || (onlineCheck?.ret === 200 && onlineCheck?.data !== false);
          if (!isOnline) return error(res, '账号未在线，请先登录');
          await query('UPDATE wechat_robot_accounts SET status = ?, updated_at = NOW() WHERE id = ?', ['online', robotId]);
        } catch {
          return error(res, '账号未在线，请先登录');
        }
      }

      const result = await WeChatRobotService.syncContacts(config.api_url, config.token, deviceId);
      if (result && result.data && result.data.length > 0 && WeChatRobotContact) {
        // 批量获取联系人详情（每批20个，最多处理200个新联系人）
        const contacts = [];
        const batchSize = 20;
        const wxidsToFetch = result.data.slice(0, 200);
        for (let i = 0; i < wxidsToFetch.length; i += batchSize) {
          const batch = wxidsToFetch.slice(i, i + batchSize);
          try {
            const details = await WeChatRobotService.getContactDetails(config.api_url, config.token, deviceId, batch);
            if (details && details.length > 0) {
              for (const d of details) {
                contacts.push({
                  wxid: d.userName || d.wxid || batch[details.indexOf(d)] || null,
                  nickname: d.nickName || d.nickname || null,
                  avatar: d.bigHeadImgUrl || d.smallHeadImgUrl || d.headImgUrl || d.avatar || null,
                  remark: d.remark || null,
                  contact_type: (d.userName || '').endsWith('@chatroom') ? 'group_member' : (d.userName || '').startsWith('gh_') ? 'official' : 'friend',
                  is_blocked: parseBlockedFlag(d),
                });
              }
              continue;
            }
          } catch { /* 详情获取失败，使用基本信息 */ }
          for (const wxid of batch) {
            contacts.push({
              wxid,
              nickname: null,
              avatar: null,
              remark: null,
              contact_type: wxid.endsWith('@chatroom') ? 'group_member' : wxid.startsWith('gh_') ? 'official' : 'friend',
              is_blocked: 0,
            });
          }
        }
        for (let i = 200; i < result.data.length; i++) {
          const wxid = result.data[i];
          contacts.push({
            wxid,
            nickname: null,
            avatar: null,
            remark: null,
            contact_type: wxid.endsWith('@chatroom') ? 'group_member' : wxid.startsWith('gh_') ? 'official' : 'friend',
            is_blocked: 0,
          });
        }
        await WeChatRobotContact.syncContacts(robotId, acct.user_id, contacts);
      }
      return success(res, { total: result?.total || 0 }, '同步完成');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }


  async getFavorites(req, res) {
    const userController = require('../user/WeChatRobotController');
    return userController.getFavorites(req, res);
  }

  async syncFavorites(req, res) {
    const userController = require('../user/WeChatRobotController');
    return userController.syncFavorites(req, res);
  }

  async deleteFavorite(req, res) {
    const userController = require('../user/WeChatRobotController');
    return userController.deleteFavorite(req, res);
  }

  /**
   * 管理员添加微信账号
   */
  async addAccount(req, res) {
    try {
      const adminUser = await query('SELECT id FROM users WHERE role = ? LIMIT 1', ['admin']);
      const userId = adminUser && adminUser[0] ? adminUser[0].id : 1;
      const result = await query(
        'INSERT INTO wechat_robot_accounts (user_id, nickname, status, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, NOW(), NOW())',
        [userId, req.body.nickname || '微信账号', 'offline']
      );
      return success(res, { id: result.insertId }, '创建成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 管理员删除微信账号
   */
  async deleteAccount(req, res) {
    try {
      await query('DELETE FROM wechat_robot_accounts WHERE id = ?', [req.params.id]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async setDefaultAccount(req, res) {
    try {
      const { id } = req.params;
      const [account] = await query('SELECT id, user_id, is_default FROM wechat_robot_accounts WHERE id = ?', [id]);
      if (!account) return error(res, '账号不存在', 404);
      if (account.is_default === 1) {
        await query('UPDATE wechat_robot_accounts SET is_default = 0 WHERE id = ?', [id]);
        return success(res, null, '已取消默认');
      } else {
        await query('UPDATE wechat_robot_accounts SET is_default = 0 WHERE user_id = ?', [account.user_id]);
        await query('UPDATE wechat_robot_accounts SET is_default = 1 WHERE id = ?', [id]);
        return success(res, null, '已设为默认');
      }
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 管理员获取扫码登录二维码
   * 使用mac设备类型登录，配合autoSliding=true可自动验证，用户扫码后手机直接显示确认按钮
   * 如果已有appId获取二维码失败（设备过期/类型不匹配），自动用空appId创建新设备重试
   */
  async getLoginQrCode(req, res) {
    try {
      const { robotId } = req.params;
      const regionId = req.query.region_id || '310000';
      const acct = await this._getAccount(robotId);
      if (!acct) return error(res, '账号不存在', 404);
      const config = await this._getApiConfig(acct.user_id);
      if (!config) return error(res, '请先配置API');
      const appId = acct.device_id || acct.wxid || '';
      let result = null;
      if (appId) {
        try {
          result = await WeChatRobotService.getLoginQrCode(config.api_url, config.token, appId, regionId, 'mac');
        } catch { result = null; }
      }
      if (!result || result.ret !== 200 || !result.data || !result.data.qrImgBase64) {
        result = await WeChatRobotService.getLoginQrCode(config.api_url, config.token, '', regionId, 'mac');
      }
      if (result && result.ret === 200 && result.data) {
        const d = result.data;
        const newAppId = d.appId || appId;
        const uuid = d.uuid || '';
        let existingSettings = {};
        try {
          existingSettings = acct.settings ? (typeof acct.settings === 'string' ? JSON.parse(acct.settings) : acct.settings) : {};
        } catch { existingSettings = {}; }
        existingSettings.uuid = uuid;
        existingSettings.qr_data = d.qrData || '';
        existingSettings.login_type = 'mac';
        await query(
          'UPDATE wechat_robot_accounts SET status = ?, device_id = ?, settings = ? WHERE id = ?',
          ['logging', newAppId, JSON.stringify(existingSettings), robotId]
        );
        return success(res, {
          qrcode_url: d.qrImgBase64 || d.qrUrl || '',
          appId: newAppId,
          uuid,
        });
      }
      return error(res, '获取二维码失败，请检查API配置');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 管理员检查登录状态
   * Mac登录 + autoSliding=true: 自动验证，用户扫码后手机直接显示确认按钮
   */
  async checkLoginStatus(req, res) {
    try {
      const { robotId } = req.params;
      const acct = await this._getAccount(robotId);
      if (!acct) return error(res, '账号不存在', 404);
      const config = await this._getApiConfig(acct.user_id);
      if (!config) return error(res, '请先配置API');
      const appId = acct.device_id || acct.wxid;
      let settings = {};
      try {
        settings = acct.settings ? (typeof acct.settings === 'string' ? JSON.parse(acct.settings) : acct.settings) : {};
      } catch { settings = {}; }
      const uuid = settings.uuid || '';
      if (!uuid) {
        return success(res, { status: 'logging', loginStatus: 0, message: '请先获取登录二维码' });
      }
      const loginType = settings.login_type || 'mac';
      const autoSliding = loginType === 'mac';
      const result = await WeChatRobotService.checkLoginStatus(config.api_url, config.token, appId, uuid, autoSliding);
      const d = result?.data || result || {};
      const loginStatus = d.status ?? d.loginStatus ?? 0;
      if (loginStatus === 2 || d.loginInfo) {
        const loginInfo = d.loginInfo || d;
        const wxid = loginInfo.wxId || loginInfo.wxid || loginInfo.userName || acct.wxid || '';
        const nickname = loginInfo.nickName || loginInfo.nickname || acct.nickname || '';
        const avatar = loginInfo.headUrl || loginInfo.headImgUrl || loginInfo.avatar || acct.avatar || '';
        await query('UPDATE wechat_robot_accounts SET status = ?, wxid = COALESCE(?, wxid), nickname = COALESCE(?, nickname), avatar = COALESCE(?, avatar), updated_at = NOW() WHERE id = ?',
          ['online', wxid || null, nickname || null, avatar || null, robotId]);
        return success(res, { status: 'online', loginStatus: 2, nickname, wxid });
      }
      let message = d.msg || '';
      if (loginStatus === 0) {
        message = message || '等待扫码';
      } else if (loginStatus === 1) {
        message = '已扫码，请在手机上点击"登录"按钮完成验证';
      }
      return success(res, { status: 'logging', loginStatus, message });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 管理员检查设备状态
   */
  async checkDeviceStatus(req, res) {
    try {
      const { robotId } = req.params;
      const acct = await this._getAccount(robotId);
      if (!acct) return success(res, { status: 'offline' });
      const config = await this._getApiConfig(acct.user_id);
      if (!config) return success(res, { status: acct.status || 'offline' });
      try {
        const appId = acct.device_id || acct.wxid;
        if (!appId) return success(res, { status: acct.status || 'offline' });
        const result = await WeChatRobotService.checkDeviceOnline(config.api_url, config.token, appId);
        // API返回 { ret: 200, data: true/false } 或 { ret: 200, data: { online: true } }
        const isOnline = result?.data === true || result?.data?.online === true || (result?.ret === 200 && result?.data !== false);
        const newStatus = isOnline ? 'online' : 'offline';
        if (newStatus !== acct.status) {
          await query('UPDATE wechat_robot_accounts SET status = ?, updated_at = NOW() WHERE id = ?', [newStatus, robotId]);
          return success(res, { status: newStatus, status_changed: true });
        }
        return success(res, { status: acct.status });
      } catch {
        return success(res, { status: acct.status || 'offline' });
      }
    } catch (err) {
      return success(res, { status: 'offline' });
    }
  }

  /**
   * 管理员退出微信登录
   */
  async logoutAccount(req, res) {
    try {
      const { robotId } = req.params;
      const acct = await this._getAccount(robotId);
      if (!acct) return error(res, '账号不存在', 404);
      const config = await this._getApiConfig(acct.user_id);
      if (config) {
        const appId = acct.device_id || acct.wxid;
        try { await WeChatRobotService.logoutDevice(config.api_url, config.token, appId); } catch {}
      }
      await query('UPDATE wechat_robot_accounts SET status = ? WHERE id = ?', ['offline', robotId]);
      return success(res, null, '已退出登录');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 管理员同步群组列表
   */
  async syncGroups(req, res) {
    try {
      const { robotId } = req.params;
      const acct = await this._getAccount(robotId);
      if (!acct) return error(res, '账号不存在', 404);
      const deviceId = acct.device_id;
      if (!deviceId) return error(res, '设备ID不存在');
      const config = await this._getApiConfig(acct.user_id);
      if (!config) return error(res, '请先配置API');

      if (acct.status !== 'online') {
        try {
          const onlineCheck = await WeChatRobotService.checkDeviceOnline(config.api_url, config.token, deviceId);
          const isOnline = onlineCheck?.data === true || (onlineCheck?.ret === 200 && onlineCheck?.data !== false);
          if (!isOnline) return error(res, '账号未在线，请先登录');
          await query('UPDATE wechat_robot_accounts SET status = ?, updated_at = NOW() WHERE id = ?', ['online', robotId]);
        } catch {
          return error(res, '账号未在线，请先登录');
        }
      }

      const syncResult = await WeChatRobotService.syncContacts(config.api_url, config.token, deviceId);
      const chatroomIds = syncResult?.chatrooms || [];
      if (!chatroomIds.length) return success(res, { total: 0 }, '未获取到群列表');

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

          const existing = await query('SELECT id FROM wechat_robot_groups WHERE robot_id = ? AND chatroom_id = ? LIMIT 1', [robotId, chatroomId]);
          if (existing && existing.length > 0) {
            await query('UPDATE wechat_robot_groups SET name = ?, avatar = ?, member_count = ?, owner_wxid = ?, members = ?, updated_at = NOW() WHERE id = ?',
              [name, avatar, memberCount, ownerWxid, members, existing[0].id]);
          } else {
            await query('INSERT INTO wechat_robot_groups (robot_id, user_id, chatroom_id, name, avatar, member_count, owner_wxid, members, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
              [robotId, acct.user_id, chatroomId, name, avatar, memberCount, ownerWxid, members]);
          }
          savedCount++;
        } catch (e) { /* 忽略单个群错误 */ }
      }
      return success(res, { total: chatroomIds.length, saved: savedCount }, `同步完成，共${chatroomIds.length}个群`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 管理员获取群列表
   */
  async getGroups(req, res) {
    try {
      const { robotId } = req.params;
      const { page = 1, per_page = 20, pageSize, search = '' } = req.query;
      const ps = parseInt(pageSize || per_page, 10) || 20;
      const pg = parseInt(page, 10) || 1;
      const offset = (pg - 1) * ps;

      let whereSql = 'WHERE g.robot_id = ?';
      const params = [robotId];
      if (search) { whereSql += ' AND g.name LIKE ?'; params.push(`%${search}%`); }

      const countSql = `SELECT COUNT(*) as total FROM wechat_robot_groups g ${whereSql}`;
      const countRows = await query(countSql, params);
      const total = (countRows && countRows[0]) ? countRows[0].total : 0;

      const sql = `
        SELECT g.*, 
          COALESCE(tm.today_msg_count, 0) as today_message_count,
          COALESCE(am.total_msg_count, 0) as total_message_count
        FROM wechat_robot_groups g
        LEFT JOIN (
          SELECT chatroom_id, COUNT(*) as today_msg_count 
          FROM wechat_robot_messages 
          WHERE robot_id = ? AND chatroom_id IS NOT NULL AND chatroom_id != '' AND DATE(created_at) = CURDATE()
          GROUP BY chatroom_id
        ) tm ON tm.chatroom_id = g.chatroom_id
        LEFT JOIN (
          SELECT chatroom_id, COUNT(*) as total_msg_count 
          FROM wechat_robot_messages 
          WHERE robot_id = ? AND chatroom_id IS NOT NULL AND chatroom_id != ''
          GROUP BY chatroom_id
        ) am ON am.chatroom_id = g.chatroom_id
        ${whereSql}
        ORDER BY g.updated_at DESC
        LIMIT ? OFFSET ?
      `;
      const fullParams = [robotId, robotId, ...params, ps, offset];
      const rows = await query(sql, fullParams);
      return success(res, { data: rows || [], total, pagination: { total, current_page: pg, per_page: ps } });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 获取朋友圈刷新设置
   */
  async getMomentsRefreshSettings(req, res) {
    try {
      const { robotId } = req.params;
      const key = `moments_refresh_admin_${robotId}`;
      const rows = await query('SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1', [key]);
      const data = rows && rows.length ? JSON.parse(rows[0].setting_value || '{}') : {};
      return success(res, data);
    } catch {
      return success(res, {});
    }
  }

  /**
   * 保存朋友圈刷新设置
   */
  async saveMomentsRefreshSettings(req, res) {
    try {
      const { robotId } = req.params;
      const key = `moments_refresh_admin_${robotId}`;
      const value = JSON.stringify(req.body);
      await query(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, value, value]
      );
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, '保存失败', 500);
    }
  }

  /**
   * 立即刷新朋友圈
   */
  async refreshMomentsNow(req, res) {
    try {
      const { robotId } = req.params;
      const acct = await WeChatRobotAccount.findById(robotId);
      if (!acct) return error(res, '账号不存在', 404);
      const config = await WeChatRobotService.getApiConfig(acct.user_id);
      if (!config || !config.api_url) return error(res, '请先配置API', 400);
      const deviceId = acct.device_id || acct.app_id || '';
      if (!deviceId) return error(res, '设备ID不存在', 400);
      const result = await WeChatRobotService.getMoments(config.api_url, config.token, deviceId);
      return success(res, result, '刷新成功');
    } catch (err) {
      return error(res, err.message || '刷新失败', 500);
    }
  }

  /**
   * 获取朋友圈刷新日志
   */
  async getMomentsRefreshLogs(req, res) {
    try {
      const { robotId } = req.params;
      const { page = 1, pageSize = 10 } = req.query;
      const ps = parseInt(pageSize) || 10;
      const pg = parseInt(page) || 1;
      const offset = (pg - 1) * ps;
      const countRows = await query('SELECT COUNT(*) as total FROM wechat_robot_moments_refresh_logs WHERE robot_id = ?', [robotId]);
      const total = countRows && countRows[0] ? countRows[0].total : 0;
      let items = [];
      if (total > 0) {
        items = await query(
          `SELECT id, refresh_type, status, moments_count, new_count, duration_ms, error_message, created_at
           FROM wechat_robot_moments_refresh_logs
           WHERE robot_id = ?
           ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          [robotId, ps, offset]
        );
      }
      return success(res, { data: items || [], total, pagination: { total, page: pg, pageSize: ps } });
    } catch (err) {
      return success(res, { data: [], total: 0 });
    }
  }

  /**
   * 获取朋友圈刷新统计
   */
  async getMomentsRefreshStats(req, res) {
    try {
      const { robotId } = req.params;
      const countRows = await query(
        'SELECT COUNT(*) as cnt FROM wechat_robot_moments_refresh_logs WHERE robot_id = ? AND DATE(created_at) = CURDATE()',
        [robotId]
      );
      const newRows = await query(
        'SELECT COALESCE(SUM(new_count), 0) as cnt FROM wechat_robot_moments_refresh_logs WHERE robot_id = ? AND DATE(created_at) = CURDATE()',
        [robotId]
      );
      return success(res, {
        today_refresh_count: countRows && countRows[0] ? countRows[0].cnt : 0,
        today_new_moments: newRows && newRows[0] ? newRows[0].cnt : 0,
      });
    } catch {
      return success(res, { today_refresh_count: 0, today_new_moments: 0 });
    }
  }

  /**
   * 从snsXml中解析正文（支持收藏笔记 noteinfo）
   */
  _parseContentFromXml(snsXml) {
    if (!snsXml) return '';
    try {
      return WeChatRobotController._decodeHtmlEntities(parseFullContentFromXml(snsXml));
    } catch {}
    return '';
  }

  static _decodeHtmlEntities(text) {
    if (!text) return text;
    return String(text)
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        const code = parseInt(hex, 16);
        if (code === 0x0A) return '\n';
        if (code === 0x0D) return '';
        if (code < 0x20 && code !== 0x09) return '';
        return String.fromCharCode(code);
      })
      .replace(/&#(\d+);/g, (_, dec) => {
        const code = parseInt(dec, 10);
        if (code === 10) return '\n';
        if (code === 13) return '';
        if (code < 32 && code !== 9) return '';
        return String.fromCharCode(code);
      })
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  /**
   * 从snsXml中提取媒体URL列表
   */
  _parseMediaFromXml(snsXml) {
    return parseMediaUrlsFromSnsXml(snsXml);
  }

  /**
   * 管理员刷新朋友圈
   */
  async refreshMoments(req, res) {
    try {
      const { robotId } = req.params;
      const acct = await this._getAccount(robotId);
      if (!acct) return error(res, '账号不存在', 404);
      const deviceId = acct.device_id;
      if (!deviceId) return error(res, '设备ID不存在');
      const config = await this._getApiConfig(acct.user_id);
      if (!config) return error(res, '请先配置API');

      if (acct.status !== 'online') {
        try {
          const onlineCheck = await WeChatRobotService.checkDeviceOnline(config.api_url, config.token, deviceId);
          const isOnline = onlineCheck?.data === true || (onlineCheck?.ret === 200 && onlineCheck?.data !== false);
          if (!isOnline) return error(res, '账号未在线，请先登录');
          await query('UPDATE wechat_robot_accounts SET status = ?, updated_at = NOW() WHERE id = ?', ['online', robotId]);
        } catch {
          return error(res, '账号未在线，请先登录');
        }
      }

      const blockedWxidSet = await loadBlockedWxidSet(robotId);
      const myWxid = acct.wxid || '';
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
          const snsXml = sns.snsXml || '';
          let content = WeChatRobotController._decodeHtmlEntities(sns.contentDesc || sns.content || '');
          if (content && content.includes('CDATA')) content = '';
          if (!content && snsXml) {
            content = this._parseContentFromXml(snsXml);
          }
          let mediaUrls = extractMomentMediaUrlsFromSns(sns);
          const createTime = sns.createTime || 0;
          const isOwn = userName === myWxid ? 1 : 0;
          const contentStyle = parseContentStyleFromXml(snsXml);
          let favContent = null;
          if (snsXml.includes('<noteinfo>')) {
            const note = parseFavoriteNoteFromXml(snsXml);
            if (note.text) favContent = note.text;
            if (note.mediaUrls.length && !mediaUrls.length) mediaUrls = note.mediaUrls;
          }
          try {
            const existing = await query('SELECT id FROM wechat_robot_moments WHERE robot_id = ? AND moment_id = ? LIMIT 1', [robotId, momentId]);
            if (!existing || !existing.length) {
              await query(
                `INSERT INTO wechat_robot_moments (robot_id, user_id, moment_id, owner_wxid, owner_nickname, content, is_own, status, create_time, like_count, comment_count, raw_snsxml, media_list, content_style, fav_content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [robotId, acct.user_id, momentId, userName || null, sns.nickName || null, content || null, isOwn, createTime || null, sns.likeCount || 0, sns.commentCount || 0, snsXml || null, mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null, contentStyle, favContent]
              );
              newCount++;
            } else {
              const updates = [];
              const updateParams = [];
              if (content) { updates.push('content = COALESCE(NULLIF(content, \'\'), ?)'); updateParams.push(content); }
              if (mediaUrls.length > 0) { updates.push('media_list = COALESCE(media_list, ?)'); updateParams.push(JSON.stringify(mediaUrls)); }
              if (createTime) { updates.push('create_time = COALESCE(create_time, ?)'); updateParams.push(createTime); }
              if (contentStyle !== 1) { updates.push('content_style = ?'); updateParams.push(contentStyle); }
              if (favContent) { updates.push('fav_content = COALESCE(NULLIF(fav_content, \'\'), ?)'); updateParams.push(favContent); }
              if (updates.length > 0) {
                updateParams.push(existing[0].id);
                await query(`UPDATE wechat_robot_moments SET ${updates.join(', ')} WHERE id = ?`, updateParams);
              }
            }
          } catch { /* 忽略错误 */ }
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

  /**
   * 管理员获取会话列表
   */
  async getConversations(req, res) {
    try {
      const { robotId } = req.params;
      const sql = `
        SELECT 
          CASE 
            WHEN m.chatroom_id IS NOT NULL AND m.chatroom_id != '' THEN m.chatroom_id 
            WHEN m.direction = 'receive' THEN m.from_wxid 
            ELSE m.to_wxid 
          END as wxid,
          COALESCE(c.nickname, g.name, 
            CASE WHEN m.direction = 'receive' THEN m.from_wxid ELSE m.to_wxid END
          ) as nickname,
          COALESCE(c.avatar, '') as avatar,
          COALESCE(c.remark, '') as remark,
          m.content as last_message,
          m.created_at as last_time,
          CASE WHEN m.chatroom_id IS NOT NULL AND m.chatroom_id != '' THEN 'group' ELSE 'private' END as chat_type
        FROM wechat_robot_messages m
        INNER JOIN (
          SELECT MAX(id) as max_id
          FROM wechat_robot_messages 
          WHERE robot_id = ?
          GROUP BY CASE 
            WHEN chatroom_id IS NOT NULL AND chatroom_id != '' THEN chatroom_id 
            WHEN direction = 'receive' THEN from_wxid 
            ELSE to_wxid 
          END
        ) latest ON m.id = latest.max_id
        LEFT JOIN wechat_robot_contacts c ON c.wxid = (
          CASE WHEN m.direction = 'receive' THEN m.from_wxid ELSE m.to_wxid END
        ) AND c.robot_id = m.robot_id
        LEFT JOIN wechat_robot_groups g ON g.chatroom_id = m.chatroom_id AND g.robot_id = m.robot_id
        ORDER BY m.created_at DESC
        LIMIT 100
      `;
      const rows = await query(sql, [robotId]);
      return success(res, rows || []);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 管理员获取聊天记录
   */
  async getChatHistory(req, res) {
    try {
      const { robotId, contactWxid } = req.params;
      const { page = 1, per_page = 50, pageSize } = req.query;
      const ps = parseInt(pageSize || per_page, 10) || 50;
      const pg = parseInt(page, 10) || 1;
      const offset = (pg - 1) * ps;
      let sql = `SELECT * FROM wechat_robot_messages WHERE robot_id = ? AND (from_wxid = ? OR to_wxid = ? OR chatroom_id = ?)`;
      const params = [robotId, contactWxid, contactWxid, contactWxid];
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countRows = await query(countSql, params);
      const total = (countRows && countRows[0]) ? countRows[0].total : 0;
      sql += ` ORDER BY created_at ASC LIMIT ? OFFSET ?`;
      params.push(ps, offset);
      const rows = await query(sql, params);
      return success(res, { data: rows || [], total, pagination: { total, current_page: pg, per_page: ps } });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 管理员发送消息
   */
  async sendMessage(req, res) {
    try {
      const { robotId } = req.params;
      const { toWxid, content, msgType = 'text', mediaUrl } = req.body;
      const acct = await this._getAccount(robotId);
      if (!acct) return error(res, '账号不存在', 404);
      const config = await this._getApiConfig(acct.user_id);
      if (!config) return error(res, '请先配置API');
      const deviceAppId = acct.device_id || null;
      let result;
      if (msgType === 'image') {
        result = await WeChatRobotService.sendImageMessage(config.api_url, config.token, acct.wxid, toWxid, mediaUrl, deviceAppId);
      } else {
        result = await WeChatRobotService.sendTextMessage(config.api_url, config.token, acct.wxid, toWxid, content, deviceAppId);
      }
      return success(res, result, '发送成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 管理员获取朋友圈列表
   */
  async getMoments(req, res) {
    try {
      const { robotId } = req.params;
      const { page = 1, per_page = 20, pageSize, search = '' } = req.query;
      const ps = parseInt(pageSize || per_page, 10) || 20;
      const pg = parseInt(page, 10) || 1;
      const offset = (pg - 1) * ps;
      let sql = 'SELECT * FROM wechat_robot_moments WHERE robot_id = ?';
      const params = [robotId];
      if (search) { sql += ' AND (content LIKE ? OR fav_content LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countRows = await query(countSql, params);
      const total = (countRows && countRows[0]) ? countRows[0].total : 0;
      sql += ' ORDER BY create_time DESC LIMIT ? OFFSET ?';
      params.push(ps, offset);
      const rows = await query(sql, params);
      return success(res, { data: rows || [], total, pagination: { total, current_page: pg, per_page: ps } });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * 管理员获取账号统计
   */
  async getAccountStats(req, res) {
    try {
      const rows = await query('SELECT id FROM wechat_robot_accounts WHERE is_active = 1');
      const accountStats = {};
      for (const row of (rows || [])) {
        const [c] = await query('SELECT COUNT(*) as cnt FROM wechat_robot_contacts WHERE robot_id = ?', [row.id]);
        const [g] = await query('SELECT COUNT(*) as cnt FROM wechat_robot_groups WHERE robot_id = ?', [row.id]);
        const [m] = await query('SELECT COUNT(*) as cnt FROM wechat_robot_messages WHERE robot_id = ?', [row.id]);
        accountStats[row.id] = { contacts: c?.cnt || 0, groups: g?.cnt || 0, messages: m?.cnt || 0 };
      }
      const [tc] = await query('SELECT COUNT(*) as cnt FROM wechat_robot_contacts');
      const [tg] = await query('SELECT COUNT(*) as cnt FROM wechat_robot_groups');
      const [tm] = await query('SELECT COUNT(*) as cnt FROM wechat_robot_messages');
      return success(res, { total_contacts: tc?.cnt||0, total_groups: tg?.cnt||0, total_messages: tm?.cnt||0, accounts: accountStats });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /** 内部：获取账号记录 */
  async _getAccount(robotId) {
    const rows = await query('SELECT * FROM wechat_robot_accounts WHERE id = ? LIMIT 1', [robotId]);
    return rows && rows[0] ? rows[0] : null;
  }

  /** 内部：获取API配置（优先全局管理员配置，回退到账号所属用户配置） */
  async _getApiConfig(userId) {
    const globalCfg = await query('SELECT * FROM wechat_robot_api_config WHERE user_id = 0 LIMIT 1');
    if (globalCfg && globalCfg[0] && globalCfg[0].api_url) return globalCfg[0];
    if (userId) {
      const userCfg = await query('SELECT * FROM wechat_robot_api_config WHERE user_id = ? LIMIT 1', [userId]);
      if (userCfg && userCfg[0] && userCfg[0].api_url) return userCfg[0];
    }
    return null;
  }
}

module.exports = new WeChatRobotController();
