function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: Object.values(err.errors).map((e) => e.message).join(', '),
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Duplicate entry detected' });
  }

  // Never leak stack traces in production
  const error = process.env.NODE_ENV === 'production' ? null : err.stack;

  res.status(statusCode).json({
    success: false,
    message,
    error,
  });
}

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { notFound, errorHandler, AppError };
