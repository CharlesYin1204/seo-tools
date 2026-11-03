/**
 * 管理后台存储配置控制器
 * 获取、保存、测试连接
 * 支持: local, oss, cos, qiniu
 */
const path = require('path');
const fs = require('fs');
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');

/** 前端字段 -> 数据库 storage_ 前缀 key */
const CONFIG_KEYS = [
  'driver', 'local_path', 'local_url_prefix', 'local_domain', 'max_file_size',
  'oss_access_key', 'oss_secret_key', 'oss_bucket', 'oss_region', 'oss_domain', 'oss_prefix',
  'cos_secret_id', 'cos_secret_key', 'cos_bucket', 'cos_region', 'cos_domain',
  'qiniu_access_key', 'qiniu_secret_key', 'qiniu_bucket', 'qiniu_domain',
  's3_access_key', 's3_secret_key', 's3_bucket', 's3_region', 's3_endpoint',
  'upyun_service', 'upyun_operator', 'upyun_password', 'upyun_domain',
  'rainyun_access_key', 'rainyun_secret_key', 'rainyun_bucket', 'rainyun_endpoint', 'rainyun_domain',
];

const DRIVER_MAP = {
  aliyun_oss: 'oss', tencent_cos: 'cos', amazon_s3: 's3',
  qiniu: 'qiniu', upyun: 'upyun', rainyun_s3: 'rainyun_s3', local: 'local'
};
const DRIVER_MAP_REVERSE = Object.fromEntries(
  Object.entries(DRIVER_MAP).map(([k, v]) => [v, k])
);

class StorageConfigController {

  async getStorageConfig(req, res) {
    try {
      const config = {};
      let hasSystemConfigs = false;

      try {
        const configRows = await query(
          "SELECT config_key, config_value FROM system_configs WHERE config_key LIKE 'storage_%'"
        );
        if (configRows && configRows.length > 0) {
          hasSystemConfigs = true;
          configRows.forEach((r) => {
            const type = r.config_key.replace(/^storage_/, '');
            if (type === 'default_storage') {
              let val = r.config_value;
              try { val = JSON.parse(val); } catch {}
              config.driver = DRIVER_MAP[val] || val || 'local';
              return;
            }
            try {
              const parsed = JSON.parse(r.config_value);
              if (parsed && typeof parsed === 'object') {
                if (type === 'aliyun_oss') {
                  config.oss_access_key = parsed.access_key_id || '';
                  config.oss_secret_key = parsed.access_key_secret || '';
                  config.oss_bucket = parsed.bucket || '';
                  config.oss_region = parsed.endpoint || '';
                  config.oss_domain = parsed.custom_domain || '';
                  config.oss_prefix = parsed.path_prefix || '';
                  config.oss_enabled = parsed.enabled === '1' || parsed.enabled === true;
                } else if (type === 'tencent_cos') {
                  config.cos_secret_id = parsed.secret_id || '';
                  config.cos_secret_key = parsed.secret_key || '';
                  config.cos_bucket = parsed.bucket || '';
                  config.cos_region = parsed.region || '';
                  config.cos_domain = parsed.custom_domain || '';
                  config.cos_enabled = parsed.enabled === '1' || parsed.enabled === true;
                } else if (type === 'amazon_s3') {
                  config.s3_access_key = parsed.access_key || '';
                  config.s3_secret_key = parsed.secret_key || '';
                  config.s3_bucket = parsed.bucket || '';
                  config.s3_region = parsed.region || '';
                  config.s3_endpoint = parsed.endpoint || '';
                  config.s3_enabled = parsed.enabled === '1' || parsed.enabled === true;
                } else if (type === 'qiniu') {
                  config.qiniu_access_key = parsed.access_key || '';
                  config.qiniu_secret_key = parsed.secret_key || '';
                  config.qiniu_bucket = parsed.bucket || '';
                  config.qiniu_domain = parsed.custom_domain || '';
                  config.qiniu_enabled = parsed.enabled === '1' || parsed.enabled === true;
                } else if (type === 'upyun') {
                  config.upyun_service = parsed.service_name || '';
                  config.upyun_operator = parsed.operator_name || '';
                  config.upyun_password = parsed.operator_password || '';
                  config.upyun_domain = parsed.custom_domain || '';
                  config.upyun_enabled = parsed.enabled === '1' || parsed.enabled === true;
                } else if (type === 'rainyun_s3') {
                  config.rainyun_access_key = parsed.access_key || '';
                  config.rainyun_secret_key = parsed.secret_key || '';
                  config.rainyun_bucket = parsed.bucket_name || '';
                  config.rainyun_endpoint = parsed.endpoint || '';
                  config.rainyun_domain = parsed.custom_domain || '';
                  config.rainyun_enabled = parsed.enabled === '1' || parsed.enabled === true;
                } else if (type === 'local') {
                  config.local_path = parsed.upload_path || 'uploads';
                  config.local_url_prefix = parsed.base_url || '';
                  config.max_file_size = parsed.max_file_size || '';
                  config.local_enabled = parsed.enabled === '1' || parsed.enabled === true;
                }
              }
            } catch {}
          });
        }
      } catch {}

      if (!hasSystemConfigs) {
        const rows = await query(
          "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'storage_%'"
        );
        rows.forEach((r) => {
          const key = r.setting_key.replace(/^storage_/, '');
          if (CONFIG_KEYS.includes(key)) config[key] = r.setting_value;
        });
        if (!config.driver) config.driver = 'local';
      }

      return success(res, config);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async saveStorageConfig(req, res) {
    try {
      const body = req.body || {};

      let hasSystemConfigs = false;
      try {
        const [check] = await query("SELECT COUNT(*) as c FROM system_configs WHERE config_key LIKE 'storage_%'");
        hasSystemConfigs = check && check.c > 0;
      } catch {}

      if (hasSystemConfigs) {
        if (body.driver !== undefined) {
          const storageType = DRIVER_MAP_REVERSE[body.driver] || body.driver;
          const val = JSON.stringify(storageType);
          await query(
            'INSERT INTO system_configs (config_key, config_value, created_at, updated_at) VALUES (?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE config_value = ?, updated_at = NOW()',
            ['storage_default_storage', val, val]
          );
        }

        const saveGroup = (phpType, jsonObj) => {
          const val = JSON.stringify(jsonObj);
          return query(
            'INSERT INTO system_configs (config_key, config_value, created_at, updated_at) VALUES (?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE config_value = ?, updated_at = NOW()',
            [`storage_${phpType}`, val, val]
          );
        };

        if (body.oss_access_key !== undefined || body.oss_bucket !== undefined) {
          await saveGroup('aliyun_oss', {
            enabled: body.oss_enabled ? '1' : '0', access_key_id: body.oss_access_key || '',
            access_key_secret: body.oss_secret_key || '', endpoint: body.oss_region || '',
            bucket: body.oss_bucket || '', custom_domain: body.oss_domain || '', path_prefix: body.oss_prefix || ''
          });
        }
        if (body.cos_secret_id !== undefined || body.cos_bucket !== undefined) {
          await saveGroup('tencent_cos', {
            enabled: body.cos_enabled ? '1' : '0', secret_id: body.cos_secret_id || '',
            secret_key: body.cos_secret_key || '', bucket: body.cos_bucket || '',
            region: body.cos_region || '', custom_domain: body.cos_domain || ''
          });
        }
        if (body.rainyun_access_key !== undefined || body.rainyun_bucket !== undefined) {
          await saveGroup('rainyun_s3', {
            enabled: body.rainyun_enabled ? '1' : '0', access_key: body.rainyun_access_key || '',
            secret_key: body.rainyun_secret_key || '', bucket_name: body.rainyun_bucket || '',
            endpoint: body.rainyun_endpoint || '', custom_domain: body.rainyun_domain || ''
          });
        }
        if (body.local_path !== undefined) {
          await saveGroup('local', {
            enabled: body.local_enabled ? '1' : '0', upload_path: body.local_path || 'uploads',
            base_url: body.local_url_prefix || '', max_file_size: body.max_file_size || '10485760'
          });
        }
      } else {
        const updates = new Map();
        for (const k of CONFIG_KEYS) {
          const v = body[k];
          if (v !== undefined) updates.set('storage_' + k, String(v ?? ''));
        }
        if (body.driver !== undefined) updates.set('storage_driver', body.driver);
        for (const [key, value] of updates) {
          await query(
            'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, value, value]
          );
        }
      }

      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async testConnection(req, res) {
    try {
      const cfg = req.body || {};
      const driver = cfg.driver || cfg.type || 'local';

      if (driver === 'local') {
        const localPath = cfg.local_path || 'uploads/';
        const resolved = path.isAbsolute(localPath)
          ? localPath
          : path.join(process.cwd(), localPath);
        try {
          if (!fs.existsSync(resolved)) {
            fs.mkdirSync(resolved, { recursive: true });
          }
          const testFile = path.join(resolved, '.storage_test');
          fs.writeFileSync(testFile, 'ok');
          fs.unlinkSync(testFile);
          return success(res, { connected: true }, '连接成功');
        } catch (e) {
          return error(res, e.message || '本地存储路径不可写', 400);
        }
      }

      if (driver === 'oss') {
        const ok = cfg.oss_access_key && cfg.oss_secret_key && cfg.oss_bucket && cfg.oss_region;
        if (!ok) return error(res, '请填写完整的 OSS 配置（AccessKey、Secret、Bucket、区域）', 400);
        return success(res, { connected: true }, '配置校验通过');
      }

      if (driver === 'cos') {
        const ok = cfg.cos_secret_id && cfg.cos_secret_key && cfg.cos_bucket && cfg.cos_region;
        if (!ok) return error(res, '请填写完整的 COS 配置', 400);
        return success(res, { connected: true }, '配置校验通过');
      }

      if (driver === 'qiniu') {
        const ok = cfg.qiniu_access_key && cfg.qiniu_secret_key && cfg.qiniu_bucket;
        if (!ok) return error(res, '请填写完整的七牛云配置', 400);
        return success(res, { connected: true }, '配置校验通过');
      }

      if (driver === 's3') {
        const ok = cfg.s3_access_key && cfg.s3_secret_key && cfg.s3_bucket && cfg.s3_region;
        if (!ok) return error(res, '请填写完整的 S3 配置', 400);
        return success(res, { connected: true }, '配置校验通过');
      }

      if (driver === 'upyun') {
        const ok = cfg.upyun_service && cfg.upyun_operator && cfg.upyun_password;
        if (!ok) return error(res, '请填写完整的又拍云配置', 400);
        return success(res, { connected: true }, '配置校验通过');
      }

      if (driver === 'rainyun_s3') {
        const ok = cfg.rainyun_access_key && cfg.rainyun_secret_key && cfg.rainyun_bucket;
        if (!ok) return error(res, '请填写完整的雨云S3配置', 400);
        return success(res, { connected: true }, '配置校验通过');
      }

      return error(res, '不支持的存储类型', 400);
    } catch (err) {
      return error(res, err.message || '连接失败', 500);
    }
  }
}

module.exports = new StorageConfigController();
