/**
 * 微信支付服务
 * 支持 Native / JSAPI / H5 支付下单、查询、退款、回调验签
 * 配置优先从数据库 system_settings 读取，回退到环境变量
 */
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');

const WECHAT_PAY_API = 'https://api.mch.weixin.qq.com';

class WeChatPayService {
  constructor() {
    this.appId = process.env.WECHAT_PAY_APP_ID || '';
    this.mchId = process.env.WECHAT_PAY_MCH_ID || '';
    this.apiKey = process.env.WECHAT_PAY_API_KEY || '';
    this.notifyUrl = '';
    this._configLoaded = false;
  }

  /**
   * 从数据库 system_settings 加载微信支付配置
   * 回调地址根据 APP_URL 自动生成，无需手动配置
   */
  async loadConfigFromDB() {
    try {
      const { query } = require('../config/database');
      const rows = await query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('wechat_app_id','wechat_app_secret','wechat_mch_id','wechat_api_key')"
      );
      const cfg = {};
      rows.forEach(r => { cfg[r.setting_key] = r.setting_value; });
      if (cfg.wechat_app_id) this.appId = cfg.wechat_app_id;
      if (cfg.wechat_app_secret) this.appSecret = cfg.wechat_app_secret;
      if (cfg.wechat_mch_id) this.mchId = cfg.wechat_mch_id;
      if (cfg.wechat_api_key) this.apiKey = cfg.wechat_api_key;
      this._buildAutoNotifyUrl();
      this._configLoaded = true;
    } catch (e) {
      logger.warn('WeChatPayService.loadConfigFromDB 失败', { error: e.message });
    }
  }

  /**
   * 根据 APP_URL 自动构建 notify_url，无需用户手动填写
   */
  _buildAutoNotifyUrl() {
    const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    if (appUrl) {
      this.notifyUrl = `${appUrl}/api/payment/notify/wechat`;
    }
  }

  /**
   * 检查微信支付是否已配置
   */
  isConfigured() {
    return !!(this.appId && this.mchId && this.apiKey);
  }

  /**
   * 创建统一下单
   * @param {Object} params - { outTradeNo, totalFee, body, tradeType, openid, clientIp }
   * @returns {Promise<{ prepayId?: string, codeUrl?: string, mwebUrl?: string }>}
   */
  async createOrder(params) {
    if (!this._configLoaded) await this.loadConfigFromDB();

    const { outTradeNo, totalFee, body, tradeType = 'NATIVE', openid, clientIp = '127.0.0.1' } = params;

    if (!outTradeNo || !totalFee || !body) {
      throw new Error('缺少必填参数: outTradeNo, totalFee, body');
    }

    if (!this.isConfigured()) {
      throw new Error('微信支付未配置，请在后台设置商户号、AppID和API密钥');
    }

    const nonceStr = this._generateNonce();
    const xmlParams = {
      appid: this.appId,
      mch_id: this.mchId,
      nonce_str: nonceStr,
      body: body.substring(0, 128),
      out_trade_no: outTradeNo,
      total_fee: Math.round(totalFee * 100),
      spbill_create_ip: clientIp,
      notify_url: this.notifyUrl,
      trade_type: tradeType,
    };

    if (tradeType === 'JSAPI' && openid) {
      xmlParams.openid = openid;
    }

    xmlParams.sign = this._sign(xmlParams);

    try {
      const xmlBody = this._buildXml(xmlParams);
      const res = await axios.post(`${WECHAT_PAY_API}/pay/unifiedorder`, xmlBody, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 15000,
      });

      const result = this._parseXml(res.data);

      if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') {
        const errMsg = result.err_code_des || result.return_msg || '下单失败';
        logger.error('WeChatPayService.createOrder 下单失败', {
          outTradeNo, errMsg, err_code: result.err_code,
          return_code: result.return_code, return_msg: result.return_msg,
        });
        throw new Error(errMsg);
      }

      logger.info('WeChatPayService.createOrder 下单成功', { outTradeNo, tradeType });

      return {
        prepayId: result.prepay_id,
        codeUrl: result.code_url,
        mwebUrl: result.mweb_url,
      };
    } catch (error) {
      logger.error('WeChatPayService.createOrder 失败', { outTradeNo, error: error.message });
      throw error;
    }
  }

  /**
   * 查询订单
   * @param {string} outTradeNo - 商户订单号
   * @returns {Promise<Object>}
   */
  async queryOrder(outTradeNo) {
    if (!this._configLoaded) await this.loadConfigFromDB();
    const nonceStr = this._generateNonce();
    const xmlParams = {
      appid: this.appId,
      mch_id: this.mchId,
      out_trade_no: outTradeNo,
      nonce_str: nonceStr,
    };
    xmlParams.sign = this._sign(xmlParams);

    try {
      const xmlBody = this._buildXml(xmlParams);
      const res = await axios.post(`${WECHAT_PAY_API}/pay/orderquery`, xmlBody, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 10000,
      });

      const result = this._parseXml(res.data);
      logger.info('WeChatPayService.queryOrder', { outTradeNo, tradeState: result.trade_state });
      return result;
    } catch (error) {
      logger.error('WeChatPayService.queryOrder 失败', { outTradeNo, error: error.message });
      throw error;
    }
  }

  /**
   * 验证支付回调签名
   * @param {string} xmlData - 微信回调的 XML 数据
   * @returns {{ verified: boolean, data: Object }}
   */
  async verifyCallback(xmlData) {
    if (!this._configLoaded) await this.loadConfigFromDB();
    try {
      const data = this._parseXml(xmlData);
      const receivedSign = data.sign;
      delete data.sign;

      const mySign = this._sign(data);
      const verified = receivedSign === mySign;

      if (!verified) {
        logger.warn('WeChatPayService.verifyCallback 验签失败', {
          outTradeNo: data.out_trade_no,
        });
      }

      return { verified, data };
    } catch (error) {
      logger.error('WeChatPayService.verifyCallback 解析失败', { error: error.message });
      return { verified: false, data: {} };
    }
  }

  /**
   * 生成 JSAPI 支付参数（前端调起支付用）
   * @param {string} prepayId
   * @returns {Object}
   */
  async getJsApiPayParams(prepayId) {
    if (!this._configLoaded) await this.loadConfigFromDB();
    const params = {
      appId: this.appId,
      timeStamp: String(Math.floor(Date.now() / 1000)),
      nonceStr: this._generateNonce(),
      package: `prepay_id=${prepayId}`,
      signType: 'MD5',
    };
    params.paySign = this._sign(params);
    return params;
  }

  /**
   * 生成回调成功响应 XML
   * @returns {string}
   */
  successResponse() {
    return '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
  }

  /**
   * 生成回调失败响应 XML
   * @param {string} msg
   * @returns {string}
   */
  failResponse(msg = 'FAIL') {
    return `<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[${msg}]]></return_msg></xml>`;
  }

  _sign(params) {
    const sorted = Object.keys(params)
      .filter((k) => params[k] !== '' && params[k] != null && k !== 'sign')
      .sort();
    const str = sorted.map((k) => `${k}=${params[k]}`).join('&') + `&key=${this.apiKey}`;
    return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
  }

  _generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  _buildXml(obj) {
    let xml = '<xml>';
    for (const [k, v] of Object.entries(obj)) {
      xml += typeof v === 'number'
        ? `<${k}>${v}</${k}>`
        : `<${k}><![CDATA[${v}]]></${k}>`;
    }
    xml += '</xml>';
    return xml;
  }

  _parseXml(xmlStr) {
    const result = {};
    const inner = xmlStr.replace(/<\/?xml>/g, '');
    const regex = /<(\w+)>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/\1>/gs;
    let match;
    while ((match = regex.exec(inner)) !== null) {
      result[match[1]] = match[2];
    }
    return result;
  }
}

module.exports = new WeChatPayService();
