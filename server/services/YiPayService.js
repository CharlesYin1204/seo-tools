/**
 * 易支付(YiPay)服务
 * 支持支付宝/微信等多渠道聚合支付
 * 文档：submit.php 页面跳转(POST)，mapi.php API接口(POST)
 */
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');

class YiPayService {
  constructor() {
    this.apiUrl = process.env.YIPAY_API_URL || process.env.YIPAY_GATEWAY_URL || '';
    this.pid = process.env.YIPAY_PID || process.env.YIPAY_MERCHANT_ID || '';
    this.key = process.env.YIPAY_KEY || process.env.YIPAY_MERCHANT_KEY || '';
  }

  /**
   * 根据 APP_URL 自动构建 notify_url 和 return_url
   * 符合易支付API文档：notify_url=异步通知地址, return_url=页面跳转通知地址
   */
  _buildAutoUrls() {
    const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    if (appUrl) {
      this._notifyUrl = `${appUrl}/api/payment/notify/yipay`;
      this._returnUrl = `${appUrl}/api/payment/return/yipay`;
    }
  }

  async loadConfigFromDB() {
    try {
      const { query } = require('../config/database');
      const rows = await query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('yipay_pid','yipay_key','yipay_url','yipay_secret')"
      );
      const cfg = {};
      rows.forEach(r => { cfg[r.setting_key] = r.setting_value; });
      if (cfg.yipay_pid) this.pid = cfg.yipay_pid;
      if (cfg.yipay_key || cfg.yipay_secret) this.key = cfg.yipay_key || cfg.yipay_secret;
      if (cfg.yipay_url) {
        const base = cfg.yipay_url.replace(/\/$/, '');
        this.submitUrl = base + '/submit.php';
        this.mapiUrl = base + '/mapi.php';
        this.apiUrl = this.submitUrl;
      }
      this._buildAutoUrls();
    } catch (e) {
      logger.warn('YiPayService.loadConfigFromDB 失败', { error: e.message });
    }
  }

  /**
   * 从 HTML 中解析支付跳转 URL（form action、meta refresh、location.replace 等）
   */
  _parseHtmlPayUrl(html) {
    if (typeof html !== 'string') return null;
    const formAction = html.match(/<form[^>]+action\s*=\s*["']([^"']+)["']/i);
    if (formAction) return formAction[1];
    const metaRefresh = html.match(/<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]+content\s*=\s*["']?\d+;\s*url=([^"'\s>]+)/i);
    if (metaRefresh) return metaRefresh[1];
    const scriptAssign = html.match(/location\.(?:href|replace)\s*=\s*["']([^"']+)["']/i);
    if (scriptAssign) return scriptAssign[1];
    const scriptReplace = html.match(/location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i);
    if (scriptReplace) return scriptReplace[1];
    const scriptHref = html.match(/location\.href\s*=\s*["']([^"']+)["']/i);
    if (scriptHref) return scriptHref[1];
    return null;
  }

  /**
   * 创建支付订单（优先 submit.php 页面跳转，失败时尝试 mapi.php）
   * @param {Object} params - { outTradeNo, money, name, type, notifyUrl, returnUrl }
   * @returns {Promise<{ payUrl?: string, qrcode?: string }>}
   */
  async createPayment(params) {
    const { outTradeNo, money, name, type = 'alipay', notifyUrl, returnUrl } = params;

    if (!outTradeNo || !money || !name) {
      throw new Error('缺少必填参数: outTradeNo, money, name');
    }

    const requestParams = {
      pid: this.pid,
      type,
      out_trade_no: outTradeNo,
      notify_url: notifyUrl || this._notifyUrl || '',
      return_url: returnUrl || this._returnUrl || '',
      name: name.substring(0, 64),
      money: Number(money).toFixed(2),
    };

    requestParams.sign = this._sign(requestParams);
    requestParams.sign_type = 'MD5';

    try {
      const result = await this._createPaymentSubmit(requestParams, outTradeNo, type);
      if (result) return result;
      const mapiResult = await this._createPaymentMapi(requestParams, outTradeNo, type);
      if (mapiResult) return mapiResult;
      throw new Error('创建支付订单返回异常');
    } catch (error) {
      logger.error('YiPayService.createPayment 失败', {
        outTradeNo,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 使用 submit.php 创建订单（页面跳转，易支付文档要求 POST）
   */
  async _createPaymentSubmit(requestParams, outTradeNo, type) {
    const url = this.submitUrl || this.apiUrl;
    if (!url) return null;
    try {
      const res = await axios.post(url, new URLSearchParams(requestParams).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      if (res.headers?.location) {
        logger.info('YiPayService.createPayment 成功（302）', { outTradeNo, type });
        return { payUrl: res.headers.location };
      }

      if (res.data && typeof res.data === 'object') {
        if (res.data.code === 1 || res.data.payurl || res.data.url) {
          logger.info('YiPayService.createPayment 成功（JSON）', { outTradeNo, type });
          return {
            payUrl: res.data.payurl || res.data.url,
            qrcode: res.data.qrcode,
          };
        }
        logger.warn('YiPayService submit 返回失败', { outTradeNo, data: res.data });
        return null;
      }

      const htmlUrl = this._parseHtmlPayUrl(res.data);
      if (htmlUrl) {
        const payUrl = htmlUrl.startsWith('http') ? htmlUrl : new URL(htmlUrl, url).href;
        logger.info('YiPayService.createPayment 成功（HTML form）', { outTradeNo, type });
        return { payUrl };
      }

      logger.warn('YiPayService submit 无法解析响应', {
        outTradeNo,
        status: res.status,
        contentType: res.headers?.['content-type'],
        dataPreview: typeof res.data === 'string' ? res.data.substring(0, 200) : String(res.data).substring(0, 200),
      });
      return null;
    } catch (err) {
      if (err.response) {
        logger.warn('YiPayService submit 请求异常', {
          outTradeNo,
          status: err.response.status,
          data: err.response.data,
        });
      }
      return null;
    }
  }

  /**
   * 使用 mapi.php 创建订单（API 模式，返回 qrcode/code_url）
   */
  async _createPaymentMapi(requestParams, outTradeNo, type) {
    const url = this.mapiUrl;
    if (!url) return null;
    try {
      const res = await axios.post(url, new URLSearchParams(requestParams).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });

      const data = res.data;
      if (!data || typeof data !== 'object') return null;

      if (data.code === 200 || data.code === 1) {
        const payUrl = data.payurl || data.url || data.code_url || (data.qrcode && data.qrcode.startsWith('http') ? data.qrcode : null);
        const qrcode = data.qrcode || data.code_url;
        if (payUrl || qrcode) {
          logger.info('YiPayService.createPayment 成功（mapi）', { outTradeNo, type });
          return {
            payUrl: payUrl || (qrcode && qrcode.startsWith('http') ? qrcode : null),
            qrcode,
          };
        }
      }
      logger.warn('YiPayService mapi 返回失败', { outTradeNo, code: data.code, msg: data.msg });
      return null;
    } catch (err) {
      logger.warn('YiPayService mapi 请求异常', { outTradeNo, error: err.message });
      return null;
    }
  }

  /**
   * 构造浏览器端直接跳转的支付 URL（最可靠，由用户浏览器直接访问 submit.php）
   * @param {Object} params - { outTradeNo, money, name, type, notifyUrl, returnUrl }
   * @returns {string} 完整的支付跳转 URL
   */
  /**
   * 构造浏览器端直接跳转的支付 URL
   * 根据API文档参数：pid, type, out_trade_no, notify_url, return_url, name, money, sign, sign_type
   */
  getPaymentRedirectUrl(params) {
    const { outTradeNo, money, name, type = 'alipay' } = params;

    const requestParams = {
      pid: this.pid,
      type,
      out_trade_no: outTradeNo,
      notify_url: this._notifyUrl || '',
      return_url: this._returnUrl || '',
      name: name.substring(0, 64),
      money: Number(money).toFixed(2),
    };

    requestParams.sign = this._sign(requestParams);
    requestParams.sign_type = 'MD5';

    const baseUrl = this.submitUrl || this.apiUrl;
    const qs = new URLSearchParams(requestParams).toString();
    return `${baseUrl}?${qs}`;
  }

  /**
   * 生成用于 POST 表单提交的参数（API文档推荐 POST 方式）
   * 返回的参数直接作为 form hidden input 的 name/value，无需 URL 编码
   */
  getPaymentFormParams(params) {
    const { outTradeNo, money, name, type = 'alipay' } = params;

    const requestParams = {
      pid: this.pid,
      type,
      out_trade_no: outTradeNo,
      notify_url: this._notifyUrl || '',
      return_url: this._returnUrl || '',
      name: name.substring(0, 64),
      money: Number(money).toFixed(2),
    };

    requestParams.sign = this._sign(requestParams);
    requestParams.sign_type = 'MD5';

    return requestParams;
  }

  /**
   * 验证异步通知签名
   * @param {Object} params - 回调参数
   * @returns {{ verified: boolean, outTradeNo?: string, tradeNo?: string, tradeStatus?: string }}
   */
  verifyNotify(params) {
    try {
      const receivedSign = params.sign;
      const mySign = this._sign(params);

      if (receivedSign !== mySign) {
        logger.warn('YiPayService.verifyNotify 验签失败', {
          outTradeNo: params.out_trade_no,
        });
        return { verified: false };
      }

      const tradeStatus = params.trade_status;
      const isSuccess = tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'success';

      logger.info('YiPayService.verifyNotify 验签通过', {
        outTradeNo: params.out_trade_no,
        tradeStatus,
        isSuccess,
      });

      return {
        verified: true,
        outTradeNo: params.out_trade_no,
        tradeNo: params.trade_no,
        tradeStatus,
        isSuccess,
        money: params.money,
      };
    } catch (error) {
      logger.error('YiPayService.verifyNotify 失败', { error: error.message });
      return { verified: false };
    }
  }

  /**
   * 验证同步回调（return_url）参数
   * @param {Object} params - URL 查询参数
   * @returns {{ verified: boolean, outTradeNo?: string }}
   */
  verifyReturn(params) {
    return this.verifyNotify(params);
  }

  /**
   * 主动向易支付API查询订单状态
   * @param {string} outTradeNo - 商户订单号
   * @returns {Promise<{ status: number, trade_no?: string, money?: string }>}
   */
  async queryOrder(outTradeNo) {
    const baseUrl = (this.submitUrl || this.apiUrl || '').replace(/\/submit\.php$/, '');
    const url = `${baseUrl}/api.php`;
    try {
      const res = await axios.get(url, {
        params: {
          act: 'order',
          pid: this.pid,
          key: this.key,
          out_trade_no: outTradeNo,
        },
        timeout: 10000,
      });
      if (res.data?.code === 1) {
        return {
          found: true,
          status: parseInt(res.data.status, 10),
          paid: parseInt(res.data.status, 10) === 1,
          trade_no: res.data.trade_no,
          money: res.data.money,
          name: res.data.name,
        };
      }
      return { found: false, msg: res.data?.msg };
    } catch (err) {
      logger.warn('YiPayService.queryOrder 失败', { outTradeNo, error: err.message });
      return { found: false, error: err.message };
    }
  }

  /**
   * MD5 签名
   * @param {Object} params - 请求参数
   * @returns {string} 签名字符串
   */
  _sign(params) {
    const exclude = ['sign', 'sign_type'];
    const sorted = Object.keys(params)
      .filter((k) => !exclude.includes(k) && params[k] !== '' && params[k] != null)
      .sort();
    const str = sorted.map((k) => `${k}=${params[k]}`).join('&') + this.key;
    return crypto.createHash('md5').update(str, 'utf8').digest('hex');
  }
}

module.exports = new YiPayService();
