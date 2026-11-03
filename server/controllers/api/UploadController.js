/**
 * API上传控制器
 * 图片、视频、文档上传
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');

class UploadController {
  async uploadImage(req, res) {
    try {
      const url = req.file?.path || req.body?.url;
      if (!url) {
        return error(res, '请上传图片或提供URL', 400);
      }
      const userId = req.user?.id;
      if (userId) {
        await query(
          'INSERT INTO user_media (user_id, url, type, created_at) VALUES (?, ?, ?, NOW())',
          [userId, url, 'image']
        ).catch(() => {});
      }
      return success(res, { url }, '上传成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async uploadVideo(req, res) {
    try {
      const url = req.file?.path || req.body?.url;
      if (!url) {
        return error(res, '请上传视频或提供URL', 400);
      }
      const userId = req.user?.id;
      if (userId) {
        await query(
          'INSERT INTO user_media (user_id, url, type, created_at) VALUES (?, ?, ?, NOW())',
          [userId, url, 'video']
        ).catch(() => {});
      }
      return success(res, { url }, '上传成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async uploadDocument(req, res) {
    try {
      const url = req.file?.path || req.body?.url;
      if (!url) {
        return error(res, '请上传文档或提供URL', 400);
      }
      const userId = req.user?.id;
      if (userId) {
        await query(
          'INSERT INTO user_media (user_id, url, type, created_at) VALUES (?, ?, ?, NOW())',
          [userId, url, 'document']
        ).catch(() => {});
      }
      return success(res, { url }, '上传成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new UploadController();
