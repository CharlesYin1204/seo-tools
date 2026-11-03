/**
 * 用户余额控制器
 * 查询余额、交易记录、在线充值
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error, paginated } = require('../../utils/response');
const YiPayService = require('../../services/YiPayService');
const WeChatPayService = require('../../services/WeChatPayService');

class BalanceController {
  /**
   * 获取用户余额
   */
  async getBalance(req, res) {
    try {
      const userId = req.user.id;

      const [user] = await query(
        'SELECT balance FROM users WHERE id = ? LIMIT 1',
        [userId]
      ).catch(() => [null]);

      if (!user) {
        return error(res, '用户不存在', 404);
      }

      const balanceVal = parseFloat(user.balance) || 0;

      return success(res, {
        balance: balanceVal,
        frozen_balance: 0,
        available: balanceVal,
      });
    } catch (err) {
      logger.error('获取余额失败', { error: err.message, userId: req.user?.id });
      return error(res, '获取余额失败', 500);
    }
  }

  /**
   * 获取交易记录（分页）
   */
  async getTransactions(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20, type } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const params = [userId];

      let where = 'WHERE t.user_id = ?';
      if (type) {
        where += ' AND t.type = ?';
        params.push(type);
      }

      const countSql = `SELECT COUNT(*) as total FROM transactions t ${where}`;
      const [countRow] = await query(countSql, params).catch(() => [{ total: 0 }]);
      const total = countRow?.total || 0;

      const dataSql = `
        SELECT t.id, t.type, t.amount, t.balance_after, t.description, t.created_at
        FROM transactions t
        ${where}
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, parseInt(pageSize, 10), offset];
      const transactions = await query(dataSql, dataParams).catch(() => []);

      return paginated(res, transactions, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      logger.error('获取交易记录失败', { error: err.message, userId: req.user?.id });
      return error(res, '获取交易记录失败', 500);
    }
  }

  /**
   * 创建余额充值订单并返回支付链接
   * POST body: { amount, payment_method }
   * payment_method: yipay 时，可传 pay_type: alipay|wxpay
   */
  async createRechargeOrder(req, res) {
    try {
      const userId = req.user.id;
      const amount = parseFloat(req.body?.amount);
      const paymentMethod = req.body?.payment_method || 'yipay';
      const payType = req.body?.pay_type || 'alipay';

      if (!amount || amount < 1 || amount > 50000) {
        return error(res, '充值金额需在 1～50000 元之间', 400);
      }

      const orderNo = 'BR' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();

      if (paymentMethod === 'wechat') {
        await WeChatPayService.loadConfigFromDB();
        if (!WeChatPayService.isConfigured()) {
          return error(res, '微信支付未配置，请联系管理员', 400);
        }

        const tradeType = req.body?.trade_type || 'NATIVE';
        const openid = req.body?.openid || '';

        await query(
          "INSERT INTO orders (order_id, user_id, title, amount, status, payment_method, created_at) VALUES (?, ?, ?, ?, 'pending', ?, NOW())",
          [orderNo, userId, '余额充值', amount, 'wechat']
        );

        const result = await WeChatPayService.createOrder({
          outTradeNo: orderNo,
          totalFee: amount,
          body: 'ExpatHome 余额充值',
          tradeType: tradeType,
          openid: openid,
          clientIp: req.ip || req.connection?.remoteAddress || '127.0.0.1',
        });

        const responseData = {
          order_no: orderNo,
          amount,
          payment_method: 'wechat',
          code_url: result.codeUrl,
          prepay_id: result.prepayId,
          mweb_url: result.mwebUrl,
        };

        if (tradeType === 'JSAPI' && result.prepayId) {
          responseData.jsapi_params = await WeChatPayService.getJsApiPayParams(result.prepayId);
        }

        return success(res, responseData, '微信支付订单已创建');
      }

      if (paymentMethod !== 'yipay') {
        return error(res, '暂不支持此支付方式', 400);
      }

      await YiPayService.loadConfigFromDB();
      if (!YiPayService.pid || !YiPayService.key || !YiPayService.apiUrl) {
        return error(res, '易支付未配置，请联系管理员', 400);
      }

      await query(
        "INSERT INTO orders (order_id, user_id, title, amount, status, payment_method, created_at) VALUES (?, ?, ?, ?, 'pending', ?, NOW())",
        [orderNo, userId, '余额充值', amount, 'yipay']
      );

      const payUrl = YiPayService.getPaymentRedirectUrl({
        outTradeNo: orderNo,
        money: amount,
        name: 'ExpatHome 余额充值',
        type: payType,
      });

      return success(res, {
        order_no: orderNo,
        amount,
        pay_url: payUrl,
      }, '订单已创建');
    } catch (err) {
      logger.error('创建余额充值订单失败', { error: err.message, userId: req.user?.id });
      return error(res, err.message || '创建订单失败', 500);
    }
  }
}

module.exports = new BalanceController();
