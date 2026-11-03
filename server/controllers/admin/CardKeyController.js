/**
 * 管理后台 - 卡密管理控制器
 * 支持功能模块卡密和余额卡密的批量生成、查询、停用
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const crypto = require('crypto');

function generateCardCode() {
  return crypto.randomBytes(12).toString('hex').toUpperCase().replace(/(.{4})/g, '$1-').slice(0, 19);
}

class CardKeyController {
  /**
   * 获取卡密列表（分页+筛选）
   */
  async getCardKeys(req, res) {
    try {
      const { page = 1, pageSize = 20, type, status, batch_no, keyword } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const params = [];
      let where = '1=1';

      if (type) { where += ' AND ck.type = ?'; params.push(type); }
      if (status) { where += ' AND ck.status = ?'; params.push(status); }
      if (batch_no) { where += ' AND ck.batch_no = ?'; params.push(batch_no); }
      if (keyword) { where += ' AND (ck.card_code LIKE ? OR u.username LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }

      const [countRow] = await query(
        `SELECT COUNT(*) as total FROM card_keys ck LEFT JOIN users u ON ck.redeemed_by = u.id WHERE ${where}`, params
      );
      const total = countRow?.total || 0;

      const rows = await query(
        `SELECT ck.*, fm.name as module_name, u.username as redeemed_username, u.display_name as redeemed_display_name
         FROM card_keys ck
         LEFT JOIN feature_modules fm ON ck.module_id = fm.id
         LEFT JOIN users u ON ck.redeemed_by = u.id
         WHERE ${where}
         ORDER BY ck.created_at DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(pageSize, 10), offset]
      );

      return success(res, { list: rows, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
    } catch (err) {
      logger.error('获取卡密列表失败', { error: err.message });
      return error(res, '获取卡密列表失败', 500);
    }
  }

  /**
   * 批量生成功能模块卡密
   */
  async generateFeatureKeys(req, res) {
    try {
      const { module_id, duration_months, count } = req.body;
      if (!module_id || !duration_months || !count) {
        return error(res, '请填写完整参数', 400);
      }

      const [mod] = await query('SELECT id, name FROM feature_modules WHERE id = ?', [module_id]);
      if (!mod) {
        return error(res, '功能模块不存在', 404);
      }

      const batchNo = 'F' + Date.now().toString(36).toUpperCase();
      const adminId = req.user?.id || 0;
      const num = Math.min(parseInt(count, 10) || 1, 500);

      const values = [];
      const codes = [];
      for (let i = 0; i < num; i++) {
        const code = generateCardCode();
        codes.push(code);
        values.push(`('${code}', 'feature', ${module_id}, ${parseInt(duration_months, 10)}, NULL, 'unused', '${batchNo}', ${adminId}, NOW())`);
      }

      await query(
        `INSERT INTO card_keys (card_code, type, module_id, duration_months, balance_amount, status, batch_no, created_by, created_at) VALUES ${values.join(',')}`
      );

      logger.info('批量生成功能卡密', { module_id, duration_months, count: num, batch_no: batchNo });
      return success(res, { batch_no: batchNo, count: num, codes }, `成功生成 ${num} 张功能卡密`);
    } catch (err) {
      logger.error('生成功能卡密失败', { error: err.message });
      return error(res, '生成卡密失败', 500);
    }
  }

  /**
   * 批量生成余额卡密
   */
  async generateBalanceKeys(req, res) {
    try {
      const { balance_amount, count } = req.body;
      const allowedAmounts = [50, 100, 200, 500];
      const amount = parseFloat(balance_amount);

      if (!allowedAmounts.includes(amount)) {
        return error(res, '余额面额只能是 50, 100, 200, 500', 400);
      }
      if (!count) {
        return error(res, '请填写生成数量', 400);
      }

      const batchNo = 'B' + Date.now().toString(36).toUpperCase();
      const adminId = req.user?.id || 0;
      const num = Math.min(parseInt(count, 10) || 1, 500);

      const values = [];
      const codes = [];
      for (let i = 0; i < num; i++) {
        const code = generateCardCode();
        codes.push(code);
        values.push(`('${code}', 'balance', NULL, NULL, ${amount}, 'unused', '${batchNo}', ${adminId}, NOW())`);
      }

      await query(
        `INSERT INTO card_keys (card_code, type, module_id, duration_months, balance_amount, status, batch_no, created_by, created_at) VALUES ${values.join(',')}`
      );

      logger.info('批量生成余额卡密', { balance_amount: amount, count: num, batch_no: batchNo });
      return success(res, { batch_no: batchNo, count: num, codes }, `成功生成 ${num} 张余额卡密`);
    } catch (err) {
      logger.error('生成余额卡密失败', { error: err.message });
      return error(res, '生成卡密失败', 500);
    }
  }

  /**
   * 停用卡密
   */
  async disableCardKey(req, res) {
    try {
      const { id } = req.params;
      const [card] = await query('SELECT * FROM card_keys WHERE id = ?', [id]);
      if (!card) return error(res, '卡密不存在', 404);
      if (card.status === 'used') return error(res, '已使用的卡密无法停用', 400);

      await query("UPDATE card_keys SET status = 'disabled', updated_at = NOW() WHERE id = ?", [id]);
      return success(res, null, '卡密已停用');
    } catch (err) {
      logger.error('停用卡密失败', { error: err.message });
      return error(res, '停用卡密失败', 500);
    }
  }

  /**
   * 获取卡密统计
   */
  async getCardKeyStats(req, res) {
    try {
      const [stats] = await query(`
        SELECT 
          COUNT(*) as total,
          SUM(status = 'unused') as unused_count,
          SUM(status = 'used') as used_count,
          SUM(status = 'disabled') as disabled_count,
          SUM(type = 'feature') as feature_count,
          SUM(type = 'balance') as balance_count
        FROM card_keys
      `);
      return success(res, stats);
    } catch (err) {
      return error(res, '获取统计失败', 500);
    }
  }

  /**
   * 获取批次列表
   */
  async getBatches(req, res) {
    try {
      const rows = await query(`
        SELECT batch_no, type, 
               COUNT(*) as total_count,
               SUM(status='unused') as unused_count,
               SUM(status='used') as used_count,
               MIN(created_at) as created_at,
               MAX(CASE WHEN type='feature' THEN module_id END) as module_id,
               MAX(CASE WHEN type='feature' THEN duration_months END) as duration_months,
               MAX(CASE WHEN type='balance' THEN balance_amount END) as balance_amount
        FROM card_keys
        GROUP BY batch_no, type
        ORDER BY created_at DESC
        LIMIT 100
      `);
      return success(res, rows);
    } catch (err) {
      return error(res, '获取批次列表失败', 500);
    }
  }
}

module.exports = new CardKeyController();
