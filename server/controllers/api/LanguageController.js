/**
 * 语言API控制器
 * 支持的语言列表、翻译
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error } = require('../../utils/response');

class LanguageController {
  /**
   * 获取支持的语言列表
   */
  async getLanguages(req, res) {
    try {
      const languages = await query(
        "SELECT code, name, local_name as native_name, is_default FROM languages WHERE is_enabled = 1 ORDER BY sort_order ASC"
      ).catch(() => []);

      if (languages.length === 0) {
        return success(res, [
          { code: 'zh', name: 'Chinese', native_name: '中文', is_default: 1 },
          { code: 'en', name: 'English', native_name: 'English', is_default: 0 },
          { code: 'ja', name: 'Japanese', native_name: '日本語', is_default: 0 },
          { code: 'ko', name: 'Korean', native_name: '한국어', is_default: 0 },
        ]);
      }

      return success(res, languages);
    } catch (err) {
      logger.error('获取语言列表失败', { error: err.message });
      return error(res, '获取语言列表失败', 500);
    }
  }

  /**
   * 翻译文本
   */
  async translate(req, res) {
    try {
      const { text, from = 'auto', to = 'en' } = req.body;

      if (!text) {
        return error(res, '请输入待翻译文本', 400);
      }

      if (!to) {
        return error(res, '请指定目标语言', 400);
      }

      await query(
        `INSERT INTO translation_logs (text_hash, source_lang, target_lang, char_count, created_at)
         VALUES (MD5(?), ?, ?, ?, NOW())`,
        [text, from, to, text.length]
      ).catch(() => {});

      // TODO: 对接翻译API（如百度、有道、DeepL）
      return success(res, {
        original: text,
        translated: text,
        from,
        to,
        message: '需对接第三方翻译API',
      });
    } catch (err) {
      logger.error('翻译失败', { error: err.message });
      return error(res, '翻译失败', 500);
    }
  }
}

module.exports = new LanguageController();
