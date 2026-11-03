/**
 * API AI控制器
 * 对话、模型列表、测试模型
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');

class AIController {
  async chat(req, res) {
    try {
      const { message, modelId, conversationId } = req.body;
      if (!message) {
        return error(res, '请输入消息', 400);
      }
      return success(res, {
        reply: 'AI回复占位，需对接大模型API',
        conversationId: conversationId || 'conv_' + Date.now(),
      });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getModels(req, res) {
    try {
      const rows = await query(
        'SELECT id, model_name AS name, model_provider AS provider, model_code AS model_id, is_enabled AS is_active FROM ai_models WHERE is_enabled = 1 ORDER BY priority ASC'
      );
      return success(res, rows);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async testModel(req, res) {
    try {
      const { modelId } = req.params;
      const [model] = await query('SELECT * FROM ai_models WHERE id = ?', [modelId]);
      if (!model) {
        return error(res, '模型不存在', 404);
      }
      return success(res, { ok: true, latency: 0 }, '测试成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new AIController();
