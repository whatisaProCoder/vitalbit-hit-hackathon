function errorHandler(err, req, res, next) {
  console.error('[API ERROR]', {
    message: err.message,
    code: err.code,
    path: req.originalUrl
  });

  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      error: 'Database unavailable',
      details: 'Cannot connect to PostgreSQL. Start your DB service and verify DATABASE_URL.'
    });
  }

  if (err.code === '3D000') {
    return res.status(503).json({
      error: 'Database unavailable',
      details: 'Configured PostgreSQL database does not exist. Create it and run schema.sql.'
    });
  }

  if (err.code === '42P01' || err.code === '42703') {
    return res.status(500).json({
      error: 'Database schema mismatch',
      details: 'Run backend/db/schema.sql to apply required tables and columns.'
    });
  }

  if (err.response?.data) {
    return res.status(err.response.status || 500).json({
      error: 'Upstream service failure',
      details: err.response.data
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    details: err.message || 'Unexpected error'
  });
}

module.exports = errorHandler;
