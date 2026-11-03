/**
 * 媒体文件服务
 * 处理图片、视频上传，支持本地存储
 */
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const config = require('../config');

class MediaService {
  constructor() {
    this.uploadPath = config.storage?.uploadPath || process.env.UPLOAD_PATH || 'public/uploads';
    this.maxSize = (config.storage?.maxUploadSize || parseInt(process.env.MAX_UPLOAD_SIZE, 10) || 200) * 1024 * 1024;
  }

  /**
   * 上传图片
   * @param {Object} file - multer file { originalname, buffer, mimetype, size }
   * @returns {Promise<{ path: string, url: string }>}
   */
  async uploadImage(file) {
    if (!file || !file.buffer) {
      throw new Error('无效的文件对象');
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('不支持的图片格式');
    }
    if (file.size > this.maxSize) {
      throw new Error('文件大小超过限制');
    }
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const subdir = 'images';
    return this._saveFile(file.buffer, subdir, filename);
  }

  /**
   * 上传视频
   * @param {Object} file - multer file
   * @returns {Promise<{ path: string, url: string }>}
   */
  async uploadVideo(file) {
    if (!file || !file.buffer) {
      throw new Error('无效的文件对象');
    }
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('不支持的视频格式');
    }
    if (file.size > this.maxSize) {
      throw new Error('文件大小超过限制');
    }
    const ext = path.extname(file.originalname) || '.mp4';
    const filename = `vid_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const subdir = 'videos';
    return this._saveFile(file.buffer, subdir, filename);
  }

  /**
   * 删除文件
   * @param {string} filePath - 相对路径如 images/xxx.jpg
   * @returns {Promise<boolean>}
   */
  async deleteFile(filePath) {
    try {
      const fullPath = path.join(process.cwd(), this.uploadPath, filePath);
      await fs.unlink(fullPath);
      logger.info('MediaService.deleteFile 成功', { filePath });
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return true;
      logger.error('MediaService.deleteFile 失败', { filePath, error: error.message });
      throw error;
    }
  }

  async _saveFile(buffer, subdir, filename) {
    const dir = path.join(process.cwd(), this.uploadPath, subdir);
    await fs.mkdir(dir, { recursive: true });
    const fullPath = path.join(dir, filename);
    await fs.writeFile(fullPath, buffer);
    const relPath = path.join(subdir, filename).replace(/\\/g, '/');
    const baseUrl = config.app?.url || process.env.APP_URL || 'http://localhost:3000';
    const url = `${baseUrl.replace(/\/$/, '')}/${this.uploadPath}/${relPath}`;
    return { path: relPath, url };
  }
}

module.exports = new MediaService();
