const { success, error } = require('../../utils/response');
const OpenApiService = require('../../services/OpenApiService');

class OpenApiAdminController {
  async meta(req, res) {
    try {
      await OpenApiService.ensureTables();
      return success(res, {
        fields: OpenApiService.getDefaultFields(),
        sensitive_fields: OpenApiService.getSensitiveFields(),
        permissions: [
          { value: 'properties:list', label: '朋友圈房源列表' },
          { value: 'properties:detail', label: '朋友圈房源详情' },
          { value: 'filters:read', label: '筛选项读取' },
          { value: 'health:read', label: '健康检查' },
        ],
      });
    } catch (err) {
      return error(res, '获取开放API配置失败: ' + err.message, 500);
    }
  }

  async listApps(req, res) {
    try {
      const apps = await OpenApiService.listApps();
      return success(res, { apps });
    } catch (err) {
      return error(res, '获取应用列表失败: ' + err.message, 500);
    }
  }

  async createApp(req, res) {
    try {
      if (!req.body.app_name) return error(res, '应用名称不能为空', 400);
      const created = await OpenApiService.createApp(req.body, req.user?.id);
      return success(res, created, '创建成功');
    } catch (err) {
      return error(res, '创建应用失败: ' + err.message, 500);
    }
  }

  async updateApp(req, res) {
    try {
      await OpenApiService.updateApp(req.params.id, req.body);
      return success(res, null, '保存成功');
    } catch (err) {
      return error(res, '保存应用失败: ' + err.message, 500);
    }
  }

  async resetKey(req, res) {
    try {
      const apiKey = await OpenApiService.resetKey(req.params.id);
      return success(res, { api_key: apiKey }, '密钥已重置');
    } catch (err) {
      return error(res, '重置密钥失败: ' + err.message, 500);
    }
  }

  async logs(req, res) {
    try {
      const result = await OpenApiService.listLogs(req.query);
      return success(res, result);
    } catch (err) {
      return error(res, '获取调用日志失败: ' + err.message, 500);
    }
  }
}

module.exports = new OpenApiAdminController();
