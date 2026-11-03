/**
 * AI 模型服务
 * 调用各类 AI API（OpenAI 兼容、自定义等）
 */
const axios = require('axios');
const AIModel = require('../models/AIModel');
const logger = require('../utils/logger');

class AIService {
  /**
   * 发送对话请求
   * @param {string|number} modelId - 模型ID或code
   * @param {Array<{ role: string, content: string }>} messages
   * @returns {Promise<string>} 助手回复内容
   */
  async chat(modelId, messages) {
    const model = typeof modelId === 'number'
      ? await AIModel.findById(modelId)
      : await AIModel.findByCode(modelId);
    if (!model) throw new Error('模型不存在');

    const baseUrl = model.api_base || process.env.AI_API_BASE || 'https://api.openai.com/v1';
    const apiKey = model.api_key || process.env.AI_API_KEY || '';

    const res = await axios.post(
      `${baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        model: model.model_code || model.model_name || 'gpt-3.5-turbo',
        messages,
        temperature: 0.3,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    const choice = res.data?.choices?.[0];
    if (!choice) throw new Error('AI 返回为空');
    return choice.message?.content || choice.text || '';
  }

  /**
   * 获取活跃模型列表
   * @returns {Promise<Array>}
   */
  async getActiveModels() {
    return AIModel.findActive();
  }

  /**
   * 测试模型连接
   * @param {number} modelId - 模型ID
   * @returns {Promise<{ ok: boolean, message?: string }>}
   */
  async testModel(modelId) {
    try {
      await this.chat(modelId, [{ role: 'user', content: 'hello' }]);
      return { ok: true };
    } catch (error) {
      logger.warn('AIService.testModel 失败', { modelId, error: error.message });
      return { ok: false, message: error.message };
    }
  }
}

module.exports = new AIService();
