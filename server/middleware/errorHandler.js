/**
 * 全局错误处理中间件
 */
const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  logger.error('未处理的错误', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: '上传文件过大',
    });
  }

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      message: 'CSRF令牌无效',
    });
  }

  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : err.message || '服务器内部错误';

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `路由未找到: ${req.method} ${req.path}`,
  });
}

module.exports = { errorHandler, notFoundHandler };
