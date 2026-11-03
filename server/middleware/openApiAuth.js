const { error } = require('../utils/response');
const OpenApiService = require('../services/OpenApiService');

function requireOpenApi(permission) {
  return async (req, res, next) => {
    const startedAt = Date.now();
    let app = null;

    try {
      const appId = req.headers['x-app-id'] || req.query.app_id;
      const apiKey = req.headers['x-api-key'] || req.query.api_key;
      app = await OpenApiService.findAppByCredentials(appId, apiKey);

      if (!app) {
        await OpenApiService.writeLog({ req, app, status: 401, durationMs: Date.now() - startedAt, errorMessage: '无效的开放API凭证' });
        return error(res, '无效的开放API凭证', 401);
      }

      if (app.expires_at && new Date(app.expires_at).getTime() < Date.now()) {
        await OpenApiService.writeLog({ req, app, status: 401, durationMs: Date.now() - startedAt, errorMessage: '开放API密钥已过期' });
        return error(res, '开放API密钥已过期', 401);
      }

      if (permission && !OpenApiService.hasPermission(app, permission)) {
        await OpenApiService.writeLog({ req, app, status: 403, durationMs: Date.now() - startedAt, errorMessage: '应用无接口权限' });
        return error(res, '应用无接口权限', 403);
      }

      const limit = await OpenApiService.checkRateLimit(app, req);
      if (!limit.ok) {
        await OpenApiService.writeLog({ req, app, status: limit.status, durationMs: Date.now() - startedAt, errorMessage: limit.message });
        return error(res, limit.message, limit.status);
      }

      req.openApiApp = app;
      req.openApiStartedAt = startedAt;
      await OpenApiService.touchKey(app.key_id);
      return next();
    } catch (err) {
      await OpenApiService.writeLog({ req, app, status: 500, durationMs: Date.now() - startedAt, errorMessage: err.message });
      return error(res, '开放API鉴权失败', 500);
    }
  };
}

module.exports = { requireOpenApi };
