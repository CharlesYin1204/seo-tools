/**
 * 用户端AI租房助手控制器
 * 提问、历史、删除历史
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class AIRentalAssistantController {
  async index(req, res) {
    try {
      return success(res, { message: 'AI租房助手页面' });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async ask(req, res) {
    try {
      const userId = req.user.id;
      const { question } = req.body;
      if (!question || typeof question !== 'string') {
        return error(res, '请输入问题', 400);
      }
      const q = question.trim();
      if (!q) {
        return error(res, '请输入有效问题', 400);
      }
      const placeholderReply = '您好，我是AI租房助手。您的咨询已记录，详细建议将根据房源数据为您生成。';
      await query(
        'INSERT INTO ai_rental_assistant_history (user_id, question, answer, created_at) VALUES (?, ?, ?, NOW())',
        [userId, q, placeholderReply]
      );
      const [row] = await query(
        'SELECT * FROM ai_rental_assistant_history WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
      );
      return success(res, { question: q, reply: placeholderReply, record: row }, '回答已生成');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20 } = req.query;
      const countSql = 'SELECT COUNT(*) as total FROM ai_rental_assistant_history WHERE user_id = ?';
      const [countResult] = await query(countSql, [userId]);
      const total = countResult ? countResult.total : 0;
      const data = await query(
        'SELECT * FROM ai_rental_assistant_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [userId, parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10)]
      );
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteHistory(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [existing] = await query('SELECT * FROM ai_rental_assistant_history WHERE id = ? AND user_id = ?', [
        id,
        userId,
      ]);
      if (!existing) {
        return error(res, '记录不存在或无权限', 404);
      }
      await query('DELETE FROM ai_rental_assistant_history WHERE id = ? AND user_id = ?', [id, userId]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new AIRentalAssistantController();
