/**
 * 统一API响应格式工具
 */

function success(res, data = null, message = '操作成功', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function error(res, message = '操作失败', statusCode = 400, errors = null) {
  const response = {
    success: false,
    message,
  };
  if (errors) {
    response.errors = errors;
  }
  return res.status(statusCode).json(response);
}

function paginated(res, data, total, page, pageSize, message = '获取成功') {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

function unauthorized(res, message = '请先登录') {
  return error(res, message, 401);
}

function forbidden(res, message = '没有权限') {
  return error(res, message, 403);
}

function notFound(res, message = '资源不存在') {
  return error(res, message, 404);
}

function serverError(res, message = '服务器内部错误') {
  return error(res, message, 500);
}

module.exports = {
  success,
  error,
  paginated,
  unauthorized,
  forbidden,
  notFound,
  serverError,
};
