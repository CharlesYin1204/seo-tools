/**
 * 支付服务 - YiPay 易支付集成
 */
const crypto = require('crypto');
const axios = require('axios');
const { query } = require('../config/database');
const logger = require('../utils/logger');

class PaymentService {
  constructor() {
    this.gatewayUrl = process.env.YIPAY_GATEWAY_URL || '';
    this.merchantId = process.env.YIPAY_MERCHANT_ID || '';
    this.merchantKey = process.env.YIPAY_MERCHANT_KEY || '';
  }

  /**
   * 创建支付订单
   * @param {Object} data - { out_trade_no, amount, subject, return_url, notify_url }
   * @returns {Promise<{ payUrl?: string, qrcode?: string }>}
   */
  async createOrder(data) {
    const { out_trade_no, amount, subject, return_url, notify_url } = data;
    if (!out_trade_no || !amount || !subject) {
      throw new Error('缺少必填参数');
    }
    const params = {
      pid: this.merchantId,
      type: data.type || 'alipay',
      out_trade_no,
      notify_url: notify_url || process.env.YIPAY_NOTIFY_URL,
      return_url: return_url || process.env.YIPAY_RETURN_URL,
      name: subject.substring(0, 64),
      money: Number(amount).toFixed(2),
    };
    params.sign = this._sign(params);
    params.sign_type = 'MD5';

    try {
      const res = await axios.get(this.gatewayUrl, {
        params,
        timeout: 15000,
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
      });
      if (res.data && typeof res.data === 'object') {
        return { payUrl: res.data.payurl || res.data.url, qrcode: res.data.qrcode };
      }
      if (typeof res.data === 'string' && res.data.startsWith('http')) {
        return { payUrl: res.data };
      }
      throw new Error('创建订单失败');
    } catch (error) {
      logger.error('PaymentService.createOrder 失败', { out_trade_no, error: error.message });
      throw error;
    }
  }

  /**
   * 处理异步通知（验签 + 更新订单）
   * @param {Object} data - 回调参数
   * @returns {Promise<{ success: boolean, out_trade_no?: string }>}
   */
  async handleNotify(data) {
    const sign = data.sign;
    const mySign = this._sign(data);
    if (sign !== mySign) {
      logger.warn('PaymentService.handleNotify 验签失败');
      return { success: false };
    }
    const { out_trade_no, trade_status } = data;
    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'success') {
      await query(
        'UPDATE orders SET status = ?, paid_at = NOW(), trade_no = ? WHERE order_no = ?',
        ['paid', data.trade_no || null, out_trade_no]
      );
      return { success: true, out_trade_no };
    }
    return { success: false };
  }

  /**
   * 查询订单状态
   * @param {string} orderId - 订单号
   * @returns {Promise<Object|null>}
   */
  async queryOrder(orderId) {
    const rows = await query(
      'SELECT * FROM orders WHERE order_no = ? OR id = ? LIMIT 1',
      [orderId, orderId]
    );
    return rows[0] || null;
  }

  _sign(params) {
    const exclude = ['sign', 'sign_type'];
    const sorted = Object.keys(params)
      .filter((k) => !exclude.includes(k) && params[k] !== '' && params[k] != null)
      .sort();
    const str = sorted.map((k) => `${k}=${params[k]}`).join('&') + this.merchantKey;
    return crypto.createHash('md5').update(str).digest('hex');
  }
}

module.exports = new PaymentService();
