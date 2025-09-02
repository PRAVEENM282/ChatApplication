// A simple custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Catches async errors and passes them to the global error handler
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Global error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log the error for debugging purposes
  console.error('Global error handler:', err);

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    // You might want to add the error stack in development mode
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

export { AppError, catchAsync, globalErrorHandler };