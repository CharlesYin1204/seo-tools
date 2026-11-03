/**
 * 水印API控制器
 * 为图片添加水印后返回
 */
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { success, error } = require('../../utils/response');
const path = require('path');
const fs = require('fs');

class WatermarkController {
  /**
   * 添加水印后返回图片
   */
  async getImage(req, res) {
    try {
      const { image_url, text, position = 'bottom-right', opacity = 0.5 } = req.query;

      if (!image_url) {
        return error(res, '图片URL不能为空', 400);
      }

      const [config] = await query(
        "SELECT setting_value FROM system_settings WHERE setting_key = 'watermark_config' LIMIT 1"
      ).catch(() => [null]);

      const watermarkConfig = config ? JSON.parse(config.setting_value || '{}') : {};
      const watermarkText = text || watermarkConfig.default_text || 'ExpatsHome';

      // TODO: 集成图片处理库(如sharp)添加实际水印
      return success(res, {
        original_url: image_url,
        watermarked_url: image_url,
        watermark: {
          text: watermarkText,
          position,
          opacity: parseFloat(opacity),
        },
        message: '需集成图片处理库实现实际水印功能',
      });
    } catch (err) {
      logger.error('添加水印失败', { error: err.message });
      return error(res, '添加水印失败', 500);
    }
  }
}

module.exports = new WatermarkController();
