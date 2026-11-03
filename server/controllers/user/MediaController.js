/**
 * 用户端媒体库控制器
 * 获取、上传、删除媒体
 */
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

class MediaController {
  getUploadMiddleware() {
    return upload.fields([
      { name: 'files', maxCount: 10 },
      { name: 'file', maxCount: 1 },
    ]);
  }

  async getMedia(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20, type = '' } = req.query;
      let sql = 'SELECT * FROM media_files WHERE user_id = ?';
      const params = [userId];
      if (type) {
        sql += ' AND file_type = ?';
        params.push(type);
      }
      const countSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*) as total');
      const [countResult] = await query(countSql, params);
      const total = countResult ? countResult.total : 0;
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10));
      const data = await query(sql, params);
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async uploadMedia(req, res) {
    try {
      const userId = req.user.id;

      // upload.fields 返回 { files: [...], file: [...] }，合并为统一数组
      let uploadedFiles = [];
      if (req.files) {
        if (Array.isArray(req.files)) {
          uploadedFiles = req.files;
        } else {
          if (req.files.files) uploadedFiles.push(...req.files.files);
          if (req.files.file) uploadedFiles.push(...req.files.file);
        }
      }

      if (uploadedFiles.length > 0) {
        const uploadBase = process.env.UPLOAD_PATH || 'public/uploads';
        const urls = [];
        for (const file of uploadedFiles) {
          const ext = path.extname(file.originalname) || '.jpg';
          const mime = (file.mimetype || '').toLowerCase();
          let mediaType = 'image';
          if (mime.startsWith('video/')) mediaType = 'video';

          const subdir = mediaType + 's';
          const filename = `${mediaType}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
          const fullDir = path.join(process.cwd(), uploadBase, subdir);
          await fs.mkdir(fullDir, { recursive: true });
          await fs.writeFile(path.join(fullDir, filename), file.buffer);

          const fileUrl = `/uploads/${subdir}/${filename}`;
          const filePath = `${uploadBase}/${subdir}/${filename}`;
          await query(
            `INSERT INTO media_files (user_id, filename, stored_filename, file_path, file_url, file_type, mime_type, file_size, alt_text, storage_type, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', NOW())`,
            [userId, file.originalname || filename, filename, filePath, fileUrl, mediaType, file.mimetype || 'image/jpeg', file.size || 0, file.originalname || '']
          );
          urls.push(fileUrl);
        }
        const result = { urls };
        if (urls.length === 1) {
          result.url = urls[0];
          result.type = 'image';
        }
        return success(res, result, '上传成功', 201);
      }

      if (req.file && req.file.buffer) {
        const ext = path.extname(req.file.originalname) || '.jpg';
        const mime = (req.file.mimetype || '').toLowerCase();
        let mediaType = 'image';
        if (mime.startsWith('video/')) mediaType = 'video';

        const uploadBase = process.env.UPLOAD_PATH || 'public/uploads';
        const subdir = mediaType + 's';
        const filename = `${mediaType}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
        const fullDir = path.join(process.cwd(), uploadBase, subdir);
        await fs.mkdir(fullDir, { recursive: true });
        await fs.writeFile(path.join(fullDir, filename), req.file.buffer);

        const fileUrl = `/uploads/${subdir}/${filename}`;
        const filePath = `${uploadBase}/${subdir}/${filename}`;
        await query(
          `INSERT INTO media_files (user_id, filename, stored_filename, file_path, file_url, file_type, mime_type, file_size, alt_text, storage_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', NOW())`,
          [userId, req.file.originalname || filename, filename, filePath, fileUrl, mediaType, req.file.mimetype || 'image/jpeg', req.file.size || 0, req.file.originalname || '']
        );
        return success(res, { urls: [fileUrl], url: fileUrl, type: mediaType }, '上传成功', 201);
      }

      const { url, type = 'image', title = '' } = req.body;
      if (!url) {
        return error(res, '缺少媒体URL或文件', 400);
      }
      const result = await query(
        'INSERT INTO media_files (user_id, file_url, file_type, alt_text, created_at) VALUES (?, ?, ?, ?, NOW())',
        [userId, url, type, title]
      );
      const id = result?.insertId;
      const [row] = await query('SELECT * FROM media_files WHERE id = ?', [id]);
      return success(res, row || { id, url, type, title }, '上传成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async deleteMedia(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [row] = await query('SELECT * FROM media_files WHERE id = ? AND user_id = ?', [id, userId]);
      if (!row) {
        return error(res, '媒体不存在或无权限', 404);
      }
      await query('DELETE FROM media_files WHERE id = ? AND user_id = ?', [id, userId]);
      return success(res, null, '删除成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new MediaController();
