const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Error:', { message: err.message, stack: err.stack, url: req.url });

  const isDev = process.env.NODE_ENV === 'development';

  if (err.name === 'ValidationError') {
    return res
      .status(400)
      .json({ error: 'Validation error', details: isDev ? err.details : undefined });
  }

  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack }),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found', path: req.url });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, notFoundHandler, asyncHandler };
