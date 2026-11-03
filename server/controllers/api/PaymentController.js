/**
 * 支付回调控制器
 * 处理易支付、微信支付等回调通知
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const WeChatPayService = require('../../services/WeChatPayService');
const YiPayService = require('../../services/YiPayService');
const MembershipController = require('../user/MembershipController');

class PaymentController {
  /**
   * 创建微信支付订单
   */
  async createWechatPayment(req, res) {
    try {
      await WeChatPayService.loadConfigFromDB();

      const { order_no, out_trade_no, amount, body, trade_type, openid } = req.body;
      const finalOrderNo = order_no || out_trade_no;
      if (!finalOrderNo || !amount) {
        return error(res, '缺少订单号或金额', 400);
      }

      if (!WeChatPayService.isConfigured()) {
        return error(res, '微信支付未配置，请联系管理员', 400);
      }

      const result = await WeChatPayService.createOrder({
        outTradeNo: finalOrderNo,
        totalFee: Number(amount),
        body: body || 'ExpatHome Order',
        tradeType: trade_type || 'NATIVE',
        openid: openid || '',
        clientIp: req.ip || req.connection?.remoteAddress || '127.0.0.1',
      });

      return success(res, result, '微信支付创建成功');
    } catch (err) {
      logger.error('创建微信支付订单失败', { error: err.message });
      return error(res, err.message || '创建微信支付订单失败', 500);
    }
  }

  /**
   * 获取微信JSAPI授权URL（微信浏览器内获取openid）
   * house.expatshome.cn 已配置为网页授权域名，直接使用
   * GET: ?redirect_uri=xxx
   */
  async getWechatJsapiAuthUrl(req, res) {
    try {
      await WeChatPayService.loadConfigFromDB();
      const appId = WeChatPayService.appId;
      if (!appId) {
        return error(res, '微信支付未配置', 400);
      }
      const redirectUri = req.query.redirect_uri;
      if (!redirectUri) {
        return error(res, '缺少redirect_uri参数', 400);
      }
      const state = 'jsapi_pay';
      const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_base&state=${state}#wechat_redirect`;
      return success(res, { auth_url: authUrl });
    } catch (err) {
      logger.error('获取微信JSAPI授权URL失败', { error: err.message });
      return error(res, '获取授权URL失败', 500);
    }
  }

  /**
   * 用微信授权code换取openid
   * GET: ?code=xxx
   */
  async getWechatOpenid(req, res) {
    try {
      const { code } = req.query;
      if (!code) {
        return error(res, '缺少code参数', 400);
      }
      await WeChatPayService.loadConfigFromDB();
      const appId = WeChatPayService.appId;
      const appSecret = WeChatPayService.appSecret;
      if (!appId || !appSecret) {
        return error(res, '微信支付未配置', 400);
      }
      const axios = require('axios');
      const tokenRes = await axios.get('https://api.weixin.qq.com/sns/oauth2/access_token', {
        params: {
          appid: appId,
          secret: appSecret,
          code: code,
          grant_type: 'authorization_code',
        },
        timeout: 10000,
      });
      const data = tokenRes.data;
      if (data.errcode) {
        logger.warn('获取微信openid失败', { errcode: data.errcode, errmsg: data.errmsg });
        return error(res, data.errmsg || '获取openid失败', 400);
      }
      return success(res, { openid: data.openid });
    } catch (err) {
      logger.error('获取微信openid异常', { error: err.message });
      return error(res, '获取openid失败', 500);
    }
  }

  /**
   * 获取当前登录用户已保存的微信openid（从user_oauth表）
   * 如果用户通过微信登录过，则无需重复OAuth授权
   * GET: (需要用户认证)
   */
  async getSavedOpenid(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return error(res, '请先登录', 401);

      const rows = await query(
        "SELECT oauth_id FROM user_oauth WHERE user_id = ? AND oauth_type = 'wx' ORDER BY updated_at DESC LIMIT 1",
        [userId]
      );
      const openid = rows?.[0]?.oauth_id || '';
      return success(res, { openid });
    } catch (err) {
      logger.error('获取已保存openid失败', { error: err.message });
      return error(res, '获取openid失败', 500);
    }
  }

  /**
   * 查询微信支付订单
   */
  async queryWechatPayment(req, res) {
    try {
      const outTradeNo = req.query.order_no || req.query.out_trade_no;
      if (!outTradeNo) {
        return error(res, '缺少订单号', 400);
      }
      const result = await WeChatPayService.queryOrder(outTradeNo);
      return success(res, result, '查询成功');
    } catch (err) {
      logger.error('查询微信支付订单失败', { error: err.message });
      return error(res, err.message || '查询微信支付订单失败', 500);
    }
  }

  /**
   * 易支付回调通知（GET/POST）
   * 参数：pid, trade_no, out_trade_no, type, name, money, trade_status, sign, sign_type
   */
  async yipayNotify(req, res) {
    try {
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      const params = { ...req.query, ...req.body };
      const { trade_no, out_trade_no, trade_status, money, sign } = params;

      logger.info('收到易支付回调', {
        method: req.method,
        trade_no,
        out_trade_no,
        trade_status,
        money,
        pid: params.pid,
        type: params.type,
      });

      if (!out_trade_no || !sign) {
        logger.warn('易支付回调缺少必填参数', { out_trade_no, sign: !!sign });
        return res.send('fail');
      }

      await YiPayService.loadConfigFromDB();
      const result = YiPayService.verifyNotify(params);

      if (!result.verified) {
        logger.warn('易支付签名验证失败', {
          out_trade_no,
          receivedSign: sign,
          params: Object.keys(params).filter(k => k !== 'sign' && k !== 'sign_type').join(','),
        });
        return res.send('fail');
      }

      if (result.isSuccess) {
        const [order] = await query(
          "SELECT * FROM orders WHERE order_id = ? AND status = 'pending'",
          [out_trade_no]
        ).catch(() => [null]);

        if (order) {
          await query(
            "UPDATE orders SET status = 'paid', trade_no = ?, paid_at = NOW(), updated_at = NOW() WHERE order_id = ? AND status = 'pending'",
            [trade_no || result.tradeNo, out_trade_no]
          );
          await this._handleOrderPaid(order);
          logger.info('订单支付成功', { out_trade_no, trade_no: trade_no || result.tradeNo, money });
        } else {
          logger.info('易支付回调：订单不存在或已处理', { out_trade_no });
        }
      }

      return res.send('success');
    } catch (err) {
      logger.error('易支付回调处理异常', { error: err.message, stack: err.stack });
      return res.send('fail');
    }
  }

  /**
   * 微信支付回调通知
   * POST: XML body
   */
  async wechatPayNotify(req, res) {
    try {
      await WeChatPayService.loadConfigFromDB();

      let xmlBody = req.body;
      if (typeof xmlBody !== 'string' && Buffer.isBuffer(xmlBody)) {
        xmlBody = xmlBody.toString('utf-8');
      }
      logger.info('收到微信支付回调', { body: typeof xmlBody === 'string' ? xmlBody.substring(0, 300) : JSON.stringify(xmlBody).substring(0, 300) });

      if (typeof xmlBody === 'string' && xmlBody.includes('<xml>')) {
        const { verified, data } = await WeChatPayService.verifyCallback(xmlBody);
        if (!verified) {
          logger.warn('微信支付回调验签失败', { out_trade_no: data.out_trade_no });
          return res.set('Content-Type', 'application/xml').send(WeChatPayService.failResponse('签名验证失败'));
        }

        if (data.return_code === 'SUCCESS' && data.result_code === 'SUCCESS') {
          const [order] = await query("SELECT * FROM orders WHERE order_id = ? AND status = 'pending'", [data.out_trade_no]).catch(() => [null]);
          if (order) {
            await query(
              "UPDATE orders SET status = 'paid', trade_no = ?, paid_at = NOW(), updated_at = NOW() WHERE order_id = ? AND status = 'pending'",
              [data.transaction_id, data.out_trade_no]
            );
            await this._handleOrderPaid(order);
            logger.info('微信支付订单更新成功', { out_trade_no: data.out_trade_no, transaction_id: data.transaction_id });
          }
        }
      } else {
        let data = xmlBody;
        if (typeof xmlBody === 'string') {
          try { data = JSON.parse(xmlBody); } catch { /* not JSON */ }
        }
        if (data && data.return_code === 'SUCCESS' && data.result_code === 'SUCCESS' && data.out_trade_no) {
          const [order] = await query("SELECT * FROM orders WHERE order_id = ? AND status = 'pending'", [data.out_trade_no]).catch(() => [null]);
          if (order) {
            await query(
              "UPDATE orders SET status = 'paid', trade_no = ?, paid_at = NOW(), updated_at = NOW() WHERE order_id = ? AND status = 'pending'",
              [data.transaction_id || '', data.out_trade_no]
            );
            await this._handleOrderPaid(order);
            logger.info('微信支付订单更新成功(非XML)', { out_trade_no: data.out_trade_no });
          }
        }
      }

      return res.set('Content-Type', 'application/xml').send(WeChatPayService.successResponse());
    } catch (err) {
      logger.error('微信支付回调处理异常', { error: err.message, stack: err.stack });
      return res.set('Content-Type', 'application/xml').send(WeChatPayService.failResponse('ERROR'));
    }
  }

  /**
   * 易支付同步回调（return_url）
   * API文档：和 notify_url 参数格式完全一致，请求方式 GET
   * 易支付服务器也会用 got 库访问此地址做验证，必须正确返回
   * 浏览器访问时：验签 → 更新订单 → 302 重定向到前端成功页
   * 非浏览器访问时：验签 → 更新订单 → 返回 success 文本
   */
  async yipayReturn(req, res) {
    try {
      const params = { ...req.query };
      const { trade_no, out_trade_no, trade_status, money, sign } = params;

      logger.info('收到易支付同步回调(return_url)', {
        method: req.method,
        trade_no,
        out_trade_no,
        trade_status,
        money,
        pid: params.pid,
        type: params.type,
        ua: req.headers['user-agent'],
      });

      if (out_trade_no && sign) {
        await YiPayService.loadConfigFromDB();
        const result = YiPayService.verifyNotify(params);

        if (result.verified && result.isSuccess) {
          const [order] = await query(
            "SELECT * FROM orders WHERE order_id = ? AND status = 'pending'",
            [out_trade_no]
          ).catch(() => [null]);

          if (order) {
            await query(
              "UPDATE orders SET status = 'paid', trade_no = ?, paid_at = NOW(), updated_at = NOW() WHERE order_id = ? AND status = 'pending'",
              [trade_no || result.tradeNo, out_trade_no]
            );
            await this._handleOrderPaid(order);
            logger.info('同步回调处理订单支付成功', { out_trade_no, trade_no });
          }
        }
      }

      const accepts = req.headers['accept'] || '';
      const isBrowser = accepts.includes('text/html');

      if (isBrowser) {
        const qs = new URLSearchParams(params).toString();
        return res.redirect(302, `/payment/success?${qs}`);
      }

      res.set('Content-Type', 'text/plain; charset=utf-8');
      return res.send('success');
    } catch (err) {
      logger.error('易支付同步回调处理异常', { error: err.message });
      const accepts = req.headers['accept'] || '';
      if (accepts.includes('text/html')) {
        return res.redirect(302, '/payment/success');
      }
      return res.send('success');
    }
  }

  /**
   * 检查订单支付状态
   * 先查本地DB，如果pending再查易支付API确认
   * GET: ?out_trade_no=xxx
   */
  async checkStatus(req, res) {
    try {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      const { out_trade_no } = req.query;
      if (!out_trade_no) {
        return error(res, '缺少订单号', 400);
      }

      const [order] = await query(
        'SELECT * FROM orders WHERE order_id = ? LIMIT 1',
        [out_trade_no]
      ).catch(() => [null]);

      if (!order) {
        return error(res, '订单不存在', 404);
      }

      if (order.status === 'paid') {
        return success(res, {
          out_trade_no: order.order_id,
          order_id: order.order_id,
          status: 'paid',
          paid: true,
          amount: order.amount,
          title: order.title,
          paid_at: order.paid_at,
        });
      }

      if (order.payment_method === 'wechat') {
        try {
          await WeChatPayService.loadConfigFromDB();
          if (WeChatPayService.isConfigured()) {
            const wxResult = await WeChatPayService.queryOrder(out_trade_no);
            if (wxResult.trade_state === 'SUCCESS') {
              await query(
                "UPDATE orders SET status = 'paid', trade_no = ?, paid_at = NOW(), updated_at = NOW() WHERE order_id = ? AND status = 'pending'",
                [wxResult.transaction_id || '', out_trade_no]
              );
              await this._handleOrderPaid(order);
              logger.info('通过微信主动查询确认支付成功', { out_trade_no, transaction_id: wxResult.transaction_id });
              return success(res, {
                out_trade_no: order.order_id,
                order_id: order.order_id,
                status: 'paid',
                paid: true,
                amount: order.amount,
                title: order.title,
                paid_at: new Date().toISOString(),
              });
            }
          }
        } catch (queryErr) {
          logger.warn('查询微信支付订单失败', { out_trade_no, error: queryErr.message });
        }
      } else {
        try {
          await YiPayService.loadConfigFromDB();
          const yipayResult = await YiPayService.queryOrder(out_trade_no);
          if (yipayResult.found && yipayResult.paid) {
            await query(
              "UPDATE orders SET status = 'paid', trade_no = ?, paid_at = NOW(), updated_at = NOW() WHERE order_id = ? AND status = 'pending'",
              [yipayResult.trade_no || '', out_trade_no]
            );
            await this._handleOrderPaid(order);
            logger.info('通过主动查询确认支付成功', { out_trade_no, trade_no: yipayResult.trade_no });
            return success(res, {
              out_trade_no: order.order_id,
              order_id: order.order_id,
              status: 'paid',
              paid: true,
              amount: order.amount,
              title: order.title,
              paid_at: new Date().toISOString(),
            });
          }
        } catch (queryErr) {
          logger.warn('查询易支付订单失败', { out_trade_no, error: queryErr.message });
        }
      }

      return success(res, {
        out_trade_no: order.order_id,
        order_id: order.order_id,
        status: order.status,
        paid: false,
        amount: order.amount,
        title: order.title,
        paid_at: order.paid_at,
      });
    } catch (err) {
      logger.error('查询订单状态失败', { error: err.message });
      return error(res, '查询订单状态失败', 500);
    }
  }
  /**
   * 订单支付成功后处理业务逻辑
   * 功能模块订单(FM开头)自动激活订阅
   */
  async _handleOrderPaid(order) {
    try {
      if (!order || !order.order_id) return;

      // Commercial SEO orders must activate the organization subscription immediately
      // after the payment callback, rather than waiting for a later status poll.
      await MembershipController.reconcilePaidOrder({ ...order, status: 'paid' });

      if (order.order_id.startsWith('BR')) {
        const amount = parseFloat(order.amount) || 0;
        if (amount > 0 && order.user_id) {
          await query('UPDATE users SET balance = COALESCE(balance, 0) + ? WHERE id = ?', [amount, order.user_id]);
          const [user] = await query('SELECT balance FROM users WHERE id = ?', [order.user_id]);
          const newBalance = parseFloat(user?.balance) || amount;
          await query(
            "INSERT INTO user_balance (user_id, amount, balance, type, description, status, created_at) VALUES (?, ?, ?, 'recharge', ?, 'completed', NOW())",
            [order.user_id, amount, newBalance, `在线充值 订单${order.order_id}`]
          );
          logger.info('余额充值成功', { userId: order.user_id, amount, orderId: order.order_id });
        }
        return;
      }

      if (order.order_id.startsWith('FM')) {
        const titleMatch = order.title?.match(/(.+?)\s*-\s*(\d+)个月/);
        if (!titleMatch) return;

        const durationMonths = parseInt(titleMatch[2], 10) || 1;
        const [mod] = await query(
          'SELECT id FROM feature_modules WHERE name = ? OR name LIKE ? LIMIT 1',
          [titleMatch[1].trim(), `%${titleMatch[1].trim()}%`]
        ).catch(() => [null]);

        if (!mod) {
          logger.warn('订单对应的功能模块未找到', { title: order.title, orderId: order.order_id });
          return;
        }

        const [existingSub] = await query(
          "SELECT * FROM user_feature_subscriptions WHERE user_id = ? AND module_id = ? AND status = 'active' AND end_date >= NOW() ORDER BY end_date DESC LIMIT 1",
          [order.user_id, mod.id]
        ).catch(() => [null]);

        let startDate, endDate;
        if (existingSub) {
          startDate = new Date(existingSub.end_date);
          endDate = new Date(existingSub.end_date);
        } else {
          startDate = new Date();
          endDate = new Date();
        }
        endDate.setMonth(endDate.getMonth() + durationMonths);

        await query(
          "INSERT INTO user_feature_subscriptions (user_id, module_id, start_date, end_date, status, source, order_id) VALUES (?, ?, ?, ?, 'active', 'payment', ?)",
          [order.user_id, mod.id, startDate, endDate, order.order_id]
        );

        logger.info('功能模块订阅已自动激活', { userId: order.user_id, moduleId: mod.id, months: durationMonths });
      }
    } catch (err) {
      logger.error('处理订单支付后业务失败', { error: err.message, orderId: order?.order_id });
    }
  }
}

module.exports = new PaymentController();
