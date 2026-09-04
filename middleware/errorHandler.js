function isApiPath(request) {
  return request.path === '/api' || request.path.startsWith('/api/');
}

function sendJsonError(response, status, code, message) {
  return response.status(status).json({
    success: false,
    code,
    message
  });
}

function apiNotFoundHandler(request, response) {
  return sendJsonError(response, 404, 'NOT_FOUND', 'Resource not found');
}

function notFoundHandler(request, response, next) {
  const error = new Error('Resource not found');
  error.status = 404;
  error.code = 'NOT_FOUND';
  next(error);
}

function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  const status = error.status || error.statusCode || 500;
  const code = status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR';
  const message = status === 404 ? 'Resource not found' : 'Internal server error';

  if (isApiPath(request)) {
    sendJsonError(response, status, code, message);
    return;
  }

  response.status(status).render('404');
}

module.exports = errorHandler;
module.exports.apiNotFoundHandler = apiNotFoundHandler;
module.exports.notFoundHandler = notFoundHandler;
