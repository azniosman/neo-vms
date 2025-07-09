const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

/**
 * Socket.io authentication middleware
 */
const setupSocketAuth = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        logger.warn('Socket connection attempted without token', {
          socketId: socket.id,
          ip: socket.handshake.address
        });
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Get user from database
      const user = await User.findByPk(decoded.id);
      
      if (!user) {
        logger.warn('Socket connection with invalid user', {
          socketId: socket.id,
          userId: decoded.id,
          ip: socket.handshake.address
        });
        return next(new Error('User not found'));
      }

      if (!user.isActive) {
        logger.warn('Socket connection with inactive user', {
          socketId: socket.id,
          userId: user.id,
          ip: socket.handshake.address
        });
        return next(new Error('User account is disabled'));
      }

      if (user.isLocked()) {
        logger.warn('Socket connection with locked user', {
          socketId: socket.id,
          userId: user.id,
          ip: socket.handshake.address
        });
        return next(new Error('User account is locked'));
      }

      // Attach user to socket
      socket.user = user;
      socket.userId = user.id;
      socket.userRole = user.role;
      
      logger.info('Socket authenticated successfully', {
        socketId: socket.id,
        userId: user.id,
        userRole: user.role,
        ip: socket.handshake.address
      });

      next();
    } catch (error) {
      logger.error('Socket authentication error:', {
        error: error.message,
        socketId: socket.id,
        ip: socket.handshake.address
      });
      
      if (error.name === 'TokenExpiredError') {
        return next(new Error('Token expired'));
      }
      
      if (error.name === 'JsonWebTokenError') {
        return next(new Error('Invalid token'));
      }
      
      return next(new Error('Authentication failed'));
    }
  });
};

/**
 * Check if user has required role for socket operation
 */
const requireSocketRole = (roles) => {
  return (socket, next) => {
    if (!socket.user) {
      return next(new Error('Authentication required'));
    }

    const userRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!userRoles.includes(socket.userRole)) {
      logger.warn('Socket operation denied due to insufficient role', {
        socketId: socket.id,
        userId: socket.userId,
        userRole: socket.userRole,
        requiredRoles: userRoles
      });
      return next(new Error('Insufficient permissions'));
    }

    next();
  };
};

/**
 * Rate limiting for socket events
 */
const createSocketRateLimit = (maxRequests = 10, windowMs = 60000) => {
  const clients = new Map();
  
  return (socket, next) => {
    const clientId = socket.userId || socket.handshake.address;
    const now = Date.now();
    
    if (!clients.has(clientId)) {
      clients.set(clientId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const client = clients.get(clientId);
    
    if (now > client.resetTime) {
      client.count = 1;
      client.resetTime = now + windowMs;
      return next();
    }
    
    if (client.count >= maxRequests) {
      logger.warn('Socket rate limit exceeded', {
        socketId: socket.id,
        clientId,
        count: client.count,
        maxRequests
      });
      return next(new Error('Rate limit exceeded'));
    }
    
    client.count++;
    next();
  };
};

/**
 * Log socket events for audit
 */
const logSocketEvent = (eventName, data = {}) => {
  return (socket, next) => {
    logger.info(`Socket event: ${eventName}`, {
      socketId: socket.id,
      userId: socket.userId,
      userRole: socket.userRole,
      eventName,
      data: JSON.stringify(data),
      ip: socket.handshake.address
    });
    next();
  };
};

module.exports = {
  setupSocketAuth,
  requireSocketRole,
  createSocketRateLimit,
  logSocketEvent
};