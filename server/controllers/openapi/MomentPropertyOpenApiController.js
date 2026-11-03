const { success, error } = require('../../utils/response');
const OpenApiService = require('../../services/OpenApiService');
const MomentPropertyOpenApiService = require('../../services/MomentPropertyOpenApiService');

class MomentPropertyOpenApiController {
  async health(req, res) {
    const startedAt = req.openApiStartedAt || Date.now();
    await OpenApiService.writeLog({
      req,
      app: req.openApiApp,
      status: 200,
      resultCount: 1,
      durationMs: Date.now() - startedAt,
    });
    return success(res, {
      status: 'ok',
      app_id: req.openApiApp?.app_id,
      timestamp: new Date().toISOString(),
    });
  }

  async list(req, res) {
    const startedAt = req.openApiStartedAt || Date.now();
    try {
      const result = await MomentPropertyOpenApiService.listProperties(req.query);
      const data = result.data.map(row => OpenApiService.filterRecordFields(row, req.openApiApp));
      await OpenApiService.writeLog({
        req,
        app: req.openApiApp,
        status: 200,
        resultCount: data.length,
        durationMs: Date.now() - startedAt,
      });
      return success(res, {
        data,
        pagination: result.pagination,
      });
    } catch (err) {
      await OpenApiService.writeLog({ req, app: req.openApiApp, status: 500, durationMs: Date.now() - startedAt, errorMessage: err.message });
      return error(res, '获取朋友圈房源数据失败: ' + err.message, 500);
    }
  }

  async detail(req, res) {
    const startedAt = req.openApiStartedAt || Date.now();
    try {
      const row = await MomentPropertyOpenApiService.detail(req.params.id);
      if (!row) {
        await OpenApiService.writeLog({ req, app: req.openApiApp, status: 404, durationMs: Date.now() - startedAt, errorMessage: '房源不存在' });
        return error(res, '房源不存在', 404);
      }
      const data = OpenApiService.filterRecordFields(row, req.openApiApp);
      await OpenApiService.writeLog({ req, app: req.openApiApp, status: 200, resultCount: 1, durationMs: Date.now() - startedAt });
      return success(res, data);
    } catch (err) {
      await OpenApiService.writeLog({ req, app: req.openApiApp, status: 500, durationMs: Date.now() - startedAt, errorMessage: err.message });
      return error(res, '获取朋友圈房源详情失败: ' + err.message, 500);
    }
  }

  async filters(req, res) {
    const startedAt = req.openApiStartedAt || Date.now();
    try {
      const data = await MomentPropertyOpenApiService.filters();
      await OpenApiService.writeLog({ req, app: req.openApiApp, status: 200, resultCount: 1, durationMs: Date.now() - startedAt });
      return success(res, data);
    } catch (err) {
      await OpenApiService.writeLog({ req, app: req.openApiApp, status: 500, durationMs: Date.now() - startedAt, errorMessage: err.message });
      return error(res, '获取筛选项失败: ' + err.message, 500);
    }
  }
}

module.exports = new MomentPropertyOpenApiController();
