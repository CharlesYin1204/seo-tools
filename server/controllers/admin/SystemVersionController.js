/**
 * 系统版本管理控制器
 * 查询系统版本信息、版本历史、当前版本及 CRUD
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs');

/* 兼容 released_at / release_date，PHP 可能使用 release_date */
const SYSTEM_VERSIONS_SCHEMA = `
CREATE TABLE IF NOT EXISTS system_versions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(50) NOT NULL,
  title VARCHAR(200) DEFAULT '',
  changelog TEXT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  released_at DATE DEFAULT NULL,
  release_date DATE DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

/** 标准化版本记录为前端格式 */
function toVersionItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    version: row.version_number || row.version || '',
    title: row.version_name || row.title || '',
    changelog: row.release_notes || row.changelog || row.description || '',
    description: row.release_notes || row.description || '',
    release_date: row.release_date || row.released_at || '',
    status: row.status || 'completed',
  };
}

class SystemVersionController {
  /**
   * 获取版本列表（含当前版本）
   * GET /admin/system-version
   * 返回 { current, history }
   */
  async getVersions(req, res) {
    try {
      const current = await this._getCurrentVersionData();
      let history = [];

      try {
        const rows = await query(
          'SELECT * FROM system_versions ORDER BY COALESCE(release_date, created_at) DESC, id DESC'
        );
        history = rows.map(toVersionItem);
      } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
          logger.warn('system_versions 表不存在');
          await query(SYSTEM_VERSIONS_SCHEMA);
        } else {
          logger.warn('查询 system_versions 失败，尝试兼容模式', { error: e.message });
          try {
            const rows2 = await query('SELECT * FROM system_versions ORDER BY id DESC');
            history = rows2.map(toVersionItem);
          } catch (e2) {
            logger.warn('system_versions 兼容模式也失败', { error: e2.message });
          }
        }
      }

      return success(res, { current, history });
    } catch (err) {
      logger.error('获取系统版本列表失败', { error: err.message });
      return error(res, '获取版本列表失败', 500);
    }
  }

  async _getCurrentVersionData() {
    const pkgPath = path.join(__dirname, '../../../package.json');
    let pkgVersion = '1.0.0';
    let pkgName = 'expatshome-node';
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkgVersion = pkg.version || '1.0.0';
      pkgName = pkg.name || 'expatshome-node';
    }

    let dbVersion = null;
    try {
      const [row] = await query(
        "SELECT setting_value FROM system_settings WHERE setting_key = 'system_version' LIMIT 1"
      );
      if (row) dbVersion = row.setting_value;
    } catch (e) {
      logger.warn('无法从 system_settings 读取版本', { error: e.message });
    }

    return {
      version: dbVersion || pkgVersion,
      release_date: new Date().toISOString().split('T')[0],
      environment: process.env.NODE_ENV || 'production',
      node_version: process.version,
      description: `${pkgName} v${dbVersion || pkgVersion}`,
    };
  }

  /**
   * 获取当前版本信息
   * GET /admin/system-version/current
   */
  async getCurrentVersion(req, res) {
    try {
      const data = await this._getCurrentVersionData();
      const pkgPath = path.join(__dirname, '../../../package.json');
      let pkgVersion = '1.0.0';
      let pkgName = 'expatshome-node';
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkgVersion = pkg.version || '1.0.0';
        pkgName = pkg.name || 'expatshome-node';
      }
      return success(res, {
        ...data,
        name: pkgName,
        package_version: pkgVersion,
        platform: process.platform,
        uptime: Math.floor(process.uptime()),
        memory_usage: process.memoryUsage(),
      });
    } catch (err) {
      logger.error('获取当前版本信息失败', { error: err.message });
      return error(res, '获取当前版本失败', 500);
    }
  }

  /**
   * 创建版本记录
   * POST /admin/system-version
   */
  async createVersion(req, res) {
    try {
      const { version, title, changelog, release_date } = req.body || {};
      if (!version || !version.trim()) {
        return error(res, '版本号不能为空', 400);
      }

      try {
        await query('SELECT 1 FROM system_versions LIMIT 1');
      } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
          await query(SYSTEM_VERSIONS_SCHEMA);
        } else {
          throw e;
        }
      }

      const releasedAt = release_date || new Date().toISOString().split('T')[0];
      const args = [version.trim(), (title || '').trim(), (changelog || '').trim(), releasedAt];
      await query(
        'INSERT INTO system_versions (version_number, version_name, release_notes, release_date) VALUES (?, ?, ?, ?)',
        args
      );
      const [row] = await query('SELECT LAST_INSERT_ID() as id');
      const id = row?.id;
      const [newRow] = await query('SELECT * FROM system_versions WHERE id = ?', [id]);
      return success(res, toVersionItem(newRow), '添加成功');
    } catch (err) {
      logger.error('添加版本记录失败', { error: err.message });
      return error(res, err.message || '添加失败', 500);
    }
  }

  /**
   * 更新版本记录
   * PUT /admin/system-version/:id
   */
  async updateVersion(req, res) {
    try {
      const id = req.params.id;
      const { version, title, changelog, release_date } = req.body || {};
      if (!id) return error(res, 'ID 不能为空', 400);

      const updates = [];
      const params = [];
      if (version !== undefined) {
        updates.push('version_number = ?');
        params.push(version.trim());
      }
      if (title !== undefined) {
        updates.push('version_name = ?');
        params.push(title.trim());
      }
      if (changelog !== undefined) {
        updates.push('release_notes = ?');
        params.push(changelog.trim());
      }
      if (release_date !== undefined) {
        updates.push('release_date = ?');
        params.push(release_date || null);
      }

      if (updates.length === 0) {
        return error(res, '没有要更新的字段', 400);
      }

      params.push(id);
      await query(
        `UPDATE system_versions SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      const [row] = await query('SELECT * FROM system_versions WHERE id = ?', [id]);
      if (!row) return error(res, '版本记录不存在', 404);
      return success(res, toVersionItem(row), '更新成功');
    } catch (err) {
      logger.error('更新版本记录失败', { error: err.message });
      return error(res, err.message || '更新失败', 500);
    }
  }

  /**
   * 删除版本记录
   * DELETE /admin/system-version/:id
   */
  async deleteVersion(req, res) {
    try {
      const id = req.params.id;
      if (!id) return error(res, 'ID 不能为空', 400);

      const [row] = await query('SELECT id FROM system_versions WHERE id = ?', [id]);
      if (!row) return error(res, '版本记录不存在', 404);

      await query('DELETE FROM system_versions WHERE id = ?', [id]);
      return success(res, null, '删除成功');
    } catch (err) {
      logger.error('删除版本记录失败', { error: err.message });
      return error(res, err.message || '删除失败', 500);
    }
  }
}

module.exports = new SystemVersionController();
