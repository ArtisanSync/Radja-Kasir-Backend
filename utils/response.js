// Success response
export const successResponse = (
  res,
  data,
  message = "Success",
  statusCode = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

// Error response
export const errorResponse = (
  res,
  message = "Error",
  statusCode = 500,
  errors = null
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
  });
};
