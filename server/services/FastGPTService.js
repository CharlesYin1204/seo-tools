/**
 * FastGPT 知识库服务
 * 对接 FastGPT 知识库问答
 */
const axios = require('axios');
const logger = require('../utils/logger');

class FastGPTService {
  constructor() {
    this.baseUrl = (process.env.FASTGPT_API_URL || '').replace(/\/$/, '');
    this.apiKey = process.env.FASTGPT_API_KEY || '';
  }

  /**
   * 知识库问答
   * @param {string} question - 问题
   * @param {string} kbId - 知识库ID
   * @returns {Promise<string>} 回复内容
   */
  async query(question, kbId) {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('FastGPT 未配置');
    }
    try {
      const res = await axios.post(
        `${this.baseUrl}/api/v1/chat/completions`,
        {
          chatId: `node_${Date.now()}`,
          stream: false,
          detail: false,
          messages: [{ role: 'user', content: question }],
          systemPrompt: '',
          kbIds: [kbId],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000,
        }
      );

      const choice = res.data?.choices?.[0];
      if (!choice) throw new Error('FastGPT 返回为空');
      return choice.message?.content || choice.text || '';
    } catch (error) {
      logger.error('FastGPTService.query 失败', { question, kbId, error: error.message });
      throw error;
    }
  }

  /**
   * 获取知识库列表
   * @returns {Promise<Array<{ id: string, name: string }>>}
   */
  async getKnowledgeBases() {
    if (!this.baseUrl || !this.apiKey) return [];
    try {
      const res = await axios.get(`${this.baseUrl}/api/v1/kb/list`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 10000,
      });
      const list = res.data?.data || res.data || [];
      return Array.isArray(list) ? list.map((k) => ({ id: k.id || k._id, name: k.name || k.title })) : [];
    } catch (error) {
      logger.warn('FastGPTService.getKnowledgeBases 失败', { error: error.message });
      return [];
    }
  }
}

module.exports = new FastGPTService();
