/**
 * 微信开放平台回调控制器
 * 处理第三方平台授权事件和消息回调
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

class WeChatCallbackController {
  /**
   * 第三方平台回调 - 处理 component_verify_ticket、authorized、unauthorized 等事件
   * POST /wechat/component/callback
   */
  async componentCallback(req, res) {
    try {
      const data = req.body;
      const infoType = data.InfoType || data.info_type || '';

      logger.info('收到微信平台回调', { infoType });

      switch (infoType) {
        case 'component_verify_ticket': {
          const ticket = data.ComponentVerifyTicket || data.component_verify_ticket || '';
          if (ticket) {
            await query(
              "INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES ('wechat_component_verify_ticket', ?, NOW()) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()",
              [ticket]
            );
            logger.info('已更新component_verify_ticket');
          }
          break;
        }
        case 'authorized': {
          const authorizerAppid = data.AuthorizerAppid || data.authorizer_appid || '';
          const authCode = data.AuthorizationCode || data.authorization_code || '';
          logger.info('公众号授权成功', { authorizerAppid });
          await query(
            "INSERT INTO wechat_official_accounts (appid, authorization_code, status, created_at, updated_at) VALUES (?, ?, 'active', NOW(), NOW()) ON DUPLICATE KEY UPDATE authorization_code = VALUES(authorization_code), status = 'active', updated_at = NOW()",
            [authorizerAppid, authCode]
          ).catch(err => logger.error('保存授权信息失败', { error: err.message }));
          break;
        }
        case 'unauthorized': {
          const unauthorizedAppid = data.AuthorizerAppid || data.authorizer_appid || '';
          logger.info('公众号取消授权', { appid: unauthorizedAppid });
          await query(
            "UPDATE wechat_official_accounts SET status = 'unauthorized', updated_at = NOW() WHERE appid = ?",
            [unauthorizedAppid]
          ).catch(err => logger.error('更新取消授权状态失败', { error: err.message }));
          break;
        }
        default:
          logger.info('未处理的微信平台事件', { infoType, data });
      }

      return res.send('success');
    } catch (err) {
      logger.error('微信平台回调处理异常', { error: err.message });
      return res.send('success');
    }
  }

  /**
   * 已授权公众号消息回调
   * POST /wechat/callback/:appid
   */
  async messageCallback(req, res) {
    try {
      const { appid } = req.params;
      const data = req.body;
      const msgType = data.MsgType || data.msg_type || '';

      logger.info('收到公众号消息回调', { appid, msgType });

      await query(
        'INSERT INTO wechat_official_messages (appid, msg_type, from_user, to_user, content, raw_data, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [
          appid,
          msgType,
          data.FromUserName || data.from_user || '',
          data.ToUserName || data.to_user || '',
          data.Content || data.content || '',
          JSON.stringify(data),
        ]
      ).catch(err => logger.error('记录公众号消息失败', { error: err.message }));

      return res.send('success');
    } catch (err) {
      logger.error('公众号消息回调处理异常', { error: err.message });
      return res.send('success');
    }
  }
}

module.exports = new WeChatCallbackController();
