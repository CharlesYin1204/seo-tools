/**
 * 用户端 - 功能模块控制器
 * 查看可购买模块、检查权限、兑换卡密、创建购买订单
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const crypto = require('crypto');

class FeatureModuleController {
  // 兼容历史模块数据，用户端统一使用 SEO 产品术语
  _normalizeModule(mod) {
    const map = {
      '快速找房': ['SEO 快速审计', '输入站点 URL，快速发现技术与内容问题。'],
      '房源库管理': ['站点内容库', '集中管理页面内容、事实字段与优化状态。'],
      '房源管理': ['站点项目管理', '管理站点接入、页面资产与优化任务。'],
    };
    const replacement = map[mod.name];
    if (replacement) { mod.name = replacement[0]; mod.description = replacement[1]; }
    return mod;
  }
  /**
   * 获取所有功能模块及其套餐（用户端展示）
   */
  async getModules(req, res) {
    try {
      const userId = req.user.id;
      const modules = await query(
        'SELECT id, name, slug, description, icon FROM feature_modules WHERE is_active = 1 ORDER BY sort_order ASC'
      );

      for (const raw of modules) {
        const mod = this._normalizeModule(raw);
        mod.plans = await query(
          'SELECT id, duration_months, price, original_price, label FROM feature_module_plans WHERE module_id = ? AND is_active = 1 ORDER BY sort_order ASC',
          [mod.id]
        );

        const [sub] = await query(
          "SELECT * FROM user_feature_subscriptions WHERE user_id = ? AND module_id = ? AND status = 'active' AND end_date >= NOW() ORDER BY end_date DESC LIMIT 1",
          [userId, mod.id]
        ).catch(() => [null]);

        mod.subscription = sub || null;
        mod.is_subscribed = !!sub;
      }

      return success(res, modules);
    } catch (err) {
      logger.error('获取功能模块失败', { error: err.message, userId: req.user?.id });
      return error(res, '获取功能模块失败', 500);
    }
  }

  /**
   * 检查用户是否有某功能模块的访问权限
   */
  async checkAccess(req, res) {
    try {
      const userId = req.user.id;
      const { slug } = req.params;

      const access = await this._checkFeatureAccess(userId, slug);
      return success(res, access);
    } catch (err) {
      logger.error('检查功能权限失败', { error: err.message });
      return error(res, '检查权限失败', 500);
    }
  }

  /**
   * 内部方法：检查功能访问权限
   */
  async _checkFeatureAccess(userId, slug) {
    const [mod] = await query('SELECT id, name FROM feature_modules WHERE slug = ? AND is_active = 1', [slug]);
    if (!mod) return { allowed: true, reason: 'module_not_found' };

    const [sub] = await query(
      "SELECT * FROM user_feature_subscriptions WHERE user_id = ? AND module_id = ? AND status = 'active' AND end_date >= NOW() ORDER BY end_date DESC LIMIT 1",
      [userId, mod.id]
    ).catch(() => [null]);

    if (sub) {
      return { allowed: true, source: sub.source, end_date: sub.end_date, module_name: mod.name };
    }

    const [user] = await query(
      'SELECT is_trial, trial_start_date, trial_end_date FROM users WHERE id = ?', [userId]
    ).catch(() => [null]);

    if (user?.is_trial && user.trial_end_date && new Date(user.trial_end_date) > new Date()) {
      return { allowed: true, source: 'trial', end_date: user.trial_end_date, module_name: mod.name };
    }

    const [trialSub] = await query(
      "SELECT * FROM user_feature_subscriptions WHERE user_id = ? AND module_id = ? AND source = 'trial' LIMIT 1",
      [userId, mod.id]
    ).catch(() => [null]);

    if (!trialSub) {
      const [setting] = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'feature_trial_days'").catch(() => [null]);
      const parsed = setting ? parseInt(setting.setting_value, 10) : NaN;
      const trialDays = Number.isNaN(parsed) ? 7 : parsed;

      if (trialDays > 0) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + trialDays);
        await query(
          "INSERT INTO user_feature_subscriptions (user_id, module_id, start_date, end_date, status, source) VALUES (?, ?, ?, ?, 'active', 'trial')",
          [userId, mod.id, startDate, endDate]
        );
        return { allowed: true, source: 'trial', end_date: endDate, is_new_trial: true, trial_days: trialDays, module_name: mod.name };
      }
    }

    return { allowed: false, module_id: mod.id, module_name: mod.name };
  }

  /**
   * 兑换功能卡密
   */
  async redeemCardKey(req, res) {
    try {
      const userId = req.user.id;
      const { card_code } = req.body;

      if (!card_code) return error(res, '请输入卡密', 400);

      const normalizedCode = card_code.trim().toUpperCase();
      const [card] = await query(
        "SELECT * FROM card_keys WHERE card_code = ? AND type = 'feature' AND status = 'unused'",
        [normalizedCode]
      );

      if (!card) return error(res, '卡密无效或已使用', 400);

      const [mod] = await query('SELECT * FROM feature_modules WHERE id = ?', [card.module_id]);
      if (!mod) return error(res, '卡密对应的功能模块不存在', 400);

      const months = card.duration_months || 1;
      const [existingSub] = await query(
        "SELECT * FROM user_feature_subscriptions WHERE user_id = ? AND module_id = ? AND status = 'active' AND end_date >= NOW() ORDER BY end_date DESC LIMIT 1",
        [userId, card.module_id]
      ).catch(() => [null]);

      let startDate, endDate;
      if (existingSub) {
        startDate = new Date(existingSub.end_date);
        endDate = new Date(existingSub.end_date);
      } else {
        startDate = new Date();
        endDate = new Date();
      }
      endDate.setMonth(endDate.getMonth() + months);

      await query(
        "INSERT INTO user_feature_subscriptions (user_id, module_id, start_date, end_date, status, source, card_key_id) VALUES (?, ?, ?, ?, 'active', 'card_key', ?)",
        [userId, card.module_id, startDate, endDate, card.id]
      );

      await query(
        "UPDATE card_keys SET status = 'used', redeemed_by = ?, redeemed_at = NOW(), updated_at = NOW() WHERE id = ?",
        [userId, card.id]
      );

      logger.info('用户兑换功能卡密', { userId, cardId: card.id, moduleId: card.module_id, months });
      return success(res, { module_name: mod.name, months, end_date: endDate }, '兑换成功');
    } catch (err) {
      logger.error('兑换功能卡密失败', { error: err.message, userId: req.user?.id });
      return error(res, '兑换失败', 500);
    }
  }

  /**
   * 兑换余额卡密
   */
  async redeemBalanceCardKey(req, res) {
    try {
      const userId = req.user.id;
      const { card_code } = req.body;

      if (!card_code) return error(res, '请输入卡密', 400);

      const normalizedCode = card_code.trim().toUpperCase();
      const [card] = await query(
        "SELECT * FROM card_keys WHERE card_code = ? AND type = 'balance' AND status = 'unused'",
        [normalizedCode]
      );

      if (!card) return error(res, '卡密无效或已使用', 400);

      const amount = parseFloat(card.balance_amount) || 0;
      if (amount <= 0) return error(res, '卡密金额异常', 400);

      await query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, userId]);

      const [user] = await query('SELECT balance FROM users WHERE id = ?', [userId]);
      const newBalance = parseFloat(user?.balance) || amount;

      await query(
        "INSERT INTO user_balance (user_id, amount, balance, type, description, status, created_at) VALUES (?, ?, ?, 'recharge', ?, 'completed', NOW())",
        [userId, amount, newBalance, `卡密充值 ${normalizedCode.substring(0, 9)}...`]
      );

      await query(
        "UPDATE card_keys SET status = 'used', redeemed_by = ?, redeemed_at = NOW(), updated_at = NOW() WHERE id = ?",
        [userId, card.id]
      );

      logger.info('用户兑换余额卡密', { userId, cardId: card.id, amount });
      return success(res, { amount, new_balance: newBalance }, `成功充值 ¥${amount}`);
    } catch (err) {
      logger.error('兑换余额卡密失败', { error: err.message, userId: req.user?.id });
      return error(res, '兑换失败', 500);
    }
  }

  /**
   * 创建功能购买订单并返回支付链接
   */
  async createOrder(req, res) {
    try {
      const userId = req.user.id;
      const { module_id, plan_id, payment_method, pay_type } = req.body;

      if (!module_id || !plan_id) return error(res, '请选择功能模块和套餐', 400);

      const [plan] = await query(
        'SELECT fmp.*, fm.name as module_name FROM feature_module_plans fmp LEFT JOIN feature_modules fm ON fmp.module_id = fm.id WHERE fmp.id = ? AND fmp.module_id = ? AND fmp.is_active = 1',
        [plan_id, module_id]
      );
      if (!plan) return error(res, '套餐不存在', 404);

      const orderNo = 'FM' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
      const title = `${plan.module_name} - ${plan.duration_months}个月`;

      if (payment_method === 'wechat') {
        const WeChatPayService = require('../../services/WeChatPayService');
        await WeChatPayService.loadConfigFromDB();
        if (!WeChatPayService.isConfigured()) {
          return error(res, '微信支付未配置，请联系管理员', 400);
        }

        const tradeType = req.body?.trade_type || 'NATIVE';
        const openid = req.body?.openid || '';

        await query(
          "INSERT INTO orders (order_id, user_id, title, amount, status, payment_method, created_at) VALUES (?, ?, ?, ?, 'pending', ?, NOW())",
          [orderNo, userId, title, plan.price, 'wechat']
        );

        const result = await WeChatPayService.createOrder({
          outTradeNo: orderNo,
          totalFee: plan.price,
          body: title,
          tradeType: tradeType,
          openid: openid,
          clientIp: req.ip || req.connection?.remoteAddress || '127.0.0.1',
        });

        const responseData = {
          order_no: orderNo,
          amount: plan.price,
          title,
          module_id,
          plan_id,
          duration_months: plan.duration_months,
          payment_method: 'wechat',
          code_url: result.codeUrl,
          prepay_id: result.prepayId,
          mweb_url: result.mwebUrl,
        };

        if (tradeType === 'JSAPI' && result.prepayId) {
          responseData.jsapi_params = await WeChatPayService.getJsApiPayParams(result.prepayId);
        }

        return success(res, responseData, '微信支付订单创建成功');
      }

      await query(
        "INSERT INTO orders (order_id, user_id, title, amount, status, payment_method, created_at) VALUES (?, ?, ?, ?, 'pending', ?, NOW())",
        [orderNo, userId, title, plan.price, payment_method || 'yipay']
      );

      const YiPayService = require('../../services/YiPayService');
      await YiPayService.loadConfigFromDB();

      if (!YiPayService.pid || !YiPayService.key || !YiPayService.apiUrl) {
        return error(res, '支付未配置，请联系管理员', 400);
      }

      const payUrl = YiPayService.getPaymentRedirectUrl({
        outTradeNo: orderNo,
        money: plan.price,
        name: title,
        type: pay_type || 'alipay',
      });

      return success(res, {
        order_no: orderNo,
        amount: plan.price,
        title,
        module_id,
        plan_id,
        duration_months: plan.duration_months,
        pay_url: payUrl,
      }, '订单创建成功');
    } catch (err) {
      logger.error('创建功能购买订单失败', { error: err.message, userId: req.user?.id });
      return error(res, '创建订单失败', 500);
    }
  }

  /**
   * 获取我的所有功能订阅
   */
  async getMySubscriptions(req, res) {
    try {
      const userId = req.user.id;
      const rows = await query(
        `SELECT ufs.*, fm.name as module_name, fm.slug as module_slug, fm.icon as module_icon
         FROM user_feature_subscriptions ufs
         LEFT JOIN feature_modules fm ON ufs.module_id = fm.id
         WHERE ufs.user_id = ?
         ORDER BY ufs.end_date DESC`,
        [userId]
      );
      return success(res, rows.map(row => {
        const normalized = this._normalizeModule({ name: row.module_name, description: '' });
        return { ...row, module_name: normalized.name };
      }));
    } catch (err) {
      return error(res, '获取订阅信息失败', 500);
    }
  }
}

module.exports = new FeatureModuleController();
