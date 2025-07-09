const csrf = require('csurf');
const logger = require('../utils/logger');

// CSRF protection middleware
const csrfProtection = csrf({
  cookie: {
    key: '_csrf',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400000 // 24 hours
  },
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  value: (req) => {
    // Check multiple sources for CSRF token
    return req.body._csrf || 
           req.query._csrf || 
           req.headers['x-csrf-token'] ||
           req.headers['x-xsrf-token'];
  }
});

// Setup CSRF protection
const setupCSRF = (app) => {
  // Enable CSRF protection for all routes except specified ones
  app.use((req, res, next) => {
    // Skip CSRF for certain routes
    const skipRoutes = [
      '/api/health',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/visitor/pre-register' // Allow public visitor pre-registration
    ];

    // Skip CSRF for WebSocket connections
    if (req.headers.upgrade === 'websocket') {
      return next();
    }

    // Skip CSRF for specific routes
    if (skipRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }

    // Apply CSRF protection
    csrfProtection(req, res, next);
  });

  // CSRF token endpoint
  app.get('/api/csrf-token', (req, res) => {
    res.json({
      csrfToken: req.csrfToken()
    });
  });

  // CSRF error handler
  app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
      logger.warn('CSRF token validation failed', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        method: req.method
      });

      return res.status(403).json({
        error: 'Invalid CSRF token',
        message: 'CSRF token validation failed'
      });
    }
    next(err);
  });
};

// Custom CSRF validation for API endpoints
const validateCSRF = (req, res, next) => {
  const token = req.body._csrf || 
                req.query._csrf || 
                req.headers['x-csrf-token'] ||
                req.headers['x-xsrf-token'];

  if (!token) {
    return res.status(403).json({
      error: 'CSRF token required',
      message: 'CSRF token is missing'
    });
  }

  try {
    // Validate token using the CSRF middleware
    csrfProtection(req, res, next);
  } catch (error) {
    logger.error('CSRF validation error:', error);
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Invalid CSRF token'
    });
  }
};

// Double-submit cookie pattern for additional security
const doubleSubmitCookie = (req, res, next) => {
  const cookieToken = req.cookies['csrf-token'];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken) {
    return res.status(403).json({
      error: 'CSRF protection required',
      message: 'CSRF tokens are missing'
    });
  }

  if (cookieToken !== headerToken) {
    return res.status(403).json({
      error: 'CSRF token mismatch',
      message: 'CSRF tokens do not match'
    });
  }

  next();
};

// Set CSRF token in response headers
const setCSRFHeader = (req, res, next) => {
  if (req.csrfToken) {
    res.setHeader('X-CSRF-Token', req.csrfToken());
  }
  next();
};

module.exports = {
  setupCSRF,
  validateCSRF,
  doubleSubmitCookie,
  setCSRFHeader,
  csrfProtection
};