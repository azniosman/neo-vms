const { createAuditLog } = require('./auditService');
const { requireSocketRole, createSocketRateLimit, logSocketEvent } = require('../middleware/socketAuth');
const logger = require('../utils/logger');

// Store active connections
const activeConnections = new Map();
const userSockets = new Map(); // userId -> Set of socketIds
const roomMembers = new Map(); // roomName -> Set of socketIds

/**
 * Initialize Socket.IO service
 */
const initializeSocket = (io) => {
  // Rate limiting middleware
  const rateLimiter = createSocketRateLimit(20, 60000); // 20 requests per minute

  io.on('connection', (socket) => {
    logger.info('New socket connection', {
      socketId: socket.id,
      userId: socket.userId,
      userRole: socket.userRole,
      ip: socket.handshake.address
    });

    // Store connection
    activeConnections.set(socket.id, {
      userId: socket.userId,
      userRole: socket.userRole,
      connectedAt: new Date(),
      ip: socket.handshake.address
    });

    // Track user sockets
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
    }
    userSockets.get(socket.userId).add(socket.id);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);
    
    // Join role-based rooms
    socket.join(`role_${socket.userRole}`);
    
    // Join admin users to admin room
    if (socket.userRole === 'admin') {
      socket.join('admin');
    }

    // Join receptionists and security to front desk room
    if (['receptionist', 'security'].includes(socket.userRole)) {
      socket.join('front_desk');
    }

    // Send initial connection confirmation
    socket.emit('connected', {
      message: 'Connected to Neo VMS',
      userId: socket.userId,
      role: socket.userRole,
      timestamp: new Date()
    });

    // Handle visitor check-in notifications
    socket.on('visitor_checkin', rateLimiter, logSocketEvent('visitor_checkin'), async (data) => {
      try {
        const { visitId, visitorId, hostId } = data;
        
        // Notify the host
        io.to(`user_${hostId}`).emit('visitor_arrived', {
          visitId,
          visitorId,
          message: 'Your visitor has arrived',
          timestamp: new Date()
        });
        
        // Notify front desk
        io.to('front_desk').emit('visitor_checked_in', {
          visitId,
          visitorId,
          hostId,
          timestamp: new Date()
        });

        await createAuditLog({
          userId: socket.userId,
          visitId,
          visitorId,
          action: 'VISITOR_CHECKIN_NOTIFICATION',
          details: { notifiedHost: hostId },
          ipAddress: socket.handshake.address,
          category: 'system_access'
        });

      } catch (error) {
        logger.error('Error handling visitor check-in notification:', error);
        socket.emit('error', { message: 'Failed to send notification' });
      }
    });

    // Handle visitor check-out notifications
    socket.on('visitor_checkout', rateLimiter, logSocketEvent('visitor_checkout'), async (data) => {
      try {
        const { visitId, visitorId, hostId } = data;
        
        // Notify the host
        io.to(`user_${hostId}`).emit('visitor_departed', {
          visitId,
          visitorId,
          message: 'Your visitor has checked out',
          timestamp: new Date()
        });
        
        // Notify front desk
        io.to('front_desk').emit('visitor_checked_out', {
          visitId,
          visitorId,
          hostId,
          timestamp: new Date()
        });

        await createAuditLog({
          userId: socket.userId,
          visitId,
          visitorId,
          action: 'VISITOR_CHECKOUT_NOTIFICATION',
          details: { notifiedHost: hostId },
          ipAddress: socket.handshake.address,
          category: 'system_access'
        });

      } catch (error) {
        logger.error('Error handling visitor check-out notification:', error);
        socket.emit('error', { message: 'Failed to send notification' });
      }
    });

    // Handle emergency notifications
    socket.on('emergency_alert', rateLimiter, requireSocketRole(['admin', 'security']), logSocketEvent('emergency_alert'), async (data) => {
      try {
        const { type, message, location, priority = 'high' } = data;
        
        const emergencyData = {
          type,
          message,
          location,
          priority,
          triggeredBy: socket.userId,
          timestamp: new Date()
        };

        // Notify all connected users
        io.emit('emergency_notification', emergencyData);
        
        // Send to external systems if configured
        await broadcastEmergencyAlert(emergencyData);

        await createAuditLog({
          userId: socket.userId,
          action: 'EMERGENCY_ALERT_SENT',
          details: { type, message, location, priority },
          ipAddress: socket.handshake.address,
          category: 'security',
          severity: 'critical',
          riskLevel: 'critical'
        });

      } catch (error) {
        logger.error('Error handling emergency alert:', error);
        socket.emit('error', { message: 'Failed to send emergency alert' });
      }
    });

    // Handle occupancy updates
    socket.on('occupancy_update', rateLimiter, requireSocketRole(['admin', 'receptionist', 'security']), logSocketEvent('occupancy_update'), async (data) => {
      try {
        const { currentOccupancy, maxOccupancy, location } = data;
        
        // Broadcast to all front desk users
        io.to('front_desk').emit('occupancy_changed', {
          currentOccupancy,
          maxOccupancy,
          location,
          timestamp: new Date()
        });

        // Send alerts if approaching capacity
        const occupancyRate = currentOccupancy / maxOccupancy;
        if (occupancyRate >= 0.9) {
          io.to('admin').emit('occupancy_alert', {
            message: 'Approaching maximum occupancy',
            currentOccupancy,
            maxOccupancy,
            location,
            level: 'warning',
            timestamp: new Date()
          });
        }

      } catch (error) {
        logger.error('Error handling occupancy update:', error);
        socket.emit('error', { message: 'Failed to update occupancy' });
      }
    });

    // Handle visit status updates
    socket.on('visit_status_update', rateLimiter, logSocketEvent('visit_status_update'), async (data) => {
      try {
        const { visitId, status, visitorId, hostId } = data;
        
        // Notify relevant parties
        io.to(`user_${hostId}`).emit('visit_status_changed', {
          visitId,
          status,
          timestamp: new Date()
        });

        if (status === 'overdue') {
          io.to('front_desk').emit('visit_overdue', {
            visitId,
            visitorId,
            hostId,
            timestamp: new Date()
          });
        }

      } catch (error) {
        logger.error('Error handling visit status update:', error);
        socket.emit('error', { message: 'Failed to update visit status' });
      }
    });

    // Handle chat messages (for host-visitor communication)
    socket.on('send_message', rateLimiter, logSocketEvent('send_message'), async (data) => {
      try {
        const { visitId, message, recipientId } = data;
        
        // Send message to recipient
        io.to(`user_${recipientId}`).emit('new_message', {
          visitId,
          message,
          senderId: socket.userId,
          timestamp: new Date()
        });

        await createAuditLog({
          userId: socket.userId,
          visitId,
          action: 'MESSAGE_SENT',
          details: { recipientId, messageLength: message.length },
          ipAddress: socket.handshake.address,
          category: 'data_access'
        });

      } catch (error) {
        logger.error('Error handling message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle system notifications
    socket.on('system_notification', rateLimiter, requireSocketRole(['admin']), logSocketEvent('system_notification'), async (data) => {
      try {
        const { message, type = 'info', targetRole = 'all' } = data;
        
        const notification = {
          message,
          type,
          timestamp: new Date(),
          from: 'system'
        };

        if (targetRole === 'all') {
          io.emit('system_message', notification);
        } else {
          io.to(`role_${targetRole}`).emit('system_message', notification);
        }

        await createAuditLog({
          userId: socket.userId,
          action: 'SYSTEM_NOTIFICATION_SENT',
          details: { message, type, targetRole },
          ipAddress: socket.handshake.address,
          category: 'system_access'
        });

      } catch (error) {
        logger.error('Error handling system notification:', error);
        socket.emit('error', { message: 'Failed to send system notification' });
      }
    });

    // Handle getting current occupancy
    socket.on('get_occupancy', rateLimiter, logSocketEvent('get_occupancy'), async () => {
      try {
        const { Visit } = require('../models');
        const currentOccupancy = await Visit.findCurrentOccupancy();
        
        socket.emit('occupancy_data', {
          currentOccupancy,
          timestamp: new Date()
        });

      } catch (error) {
        logger.error('Error getting occupancy:', error);
        socket.emit('error', { message: 'Failed to get occupancy data' });
      }
    });

    // Handle getting active visits
    socket.on('get_active_visits', rateLimiter, requireSocketRole(['admin', 'receptionist', 'security']), logSocketEvent('get_active_visits'), async () => {
      try {
        const { Visit } = require('../models');
        const activeVisits = await Visit.findActive();
        
        socket.emit('active_visits_data', {
          visits: activeVisits,
          count: activeVisits.length,
          timestamp: new Date()
        });

      } catch (error) {
        logger.error('Error getting active visits:', error);
        socket.emit('error', { message: 'Failed to get active visits' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async (reason) => {
      logger.info('Socket disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        reason,
        duration: Date.now() - activeConnections.get(socket.id)?.connectedAt
      });

      // Remove from active connections
      activeConnections.delete(socket.id);
      
      // Remove from user sockets
      if (userSockets.has(socket.userId)) {
        userSockets.get(socket.userId).delete(socket.id);
        if (userSockets.get(socket.userId).size === 0) {
          userSockets.delete(socket.userId);
        }
      }

      // Remove from rooms
      roomMembers.forEach((members, roomName) => {
        members.delete(socket.id);
        if (members.size === 0) {
          roomMembers.delete(roomName);
        }
      });

      await createAuditLog({
        userId: socket.userId,
        action: 'SOCKET_DISCONNECTED',
        details: { reason },
        ipAddress: socket.handshake.address,
        category: 'system_access'
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error:', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
    });
  });

  // Set up periodic cleanup
  setInterval(() => {
    cleanupStaleConnections();
  }, 5 * 60 * 1000); // Every 5 minutes
};

/**
 * Send notification to specific user
 */
const sendNotificationToUser = (userId, event, data) => {
  const io = require('../index').io;
  if (io) {
    io.to(`user_${userId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  }
};

/**
 * Send notification to role
 */
const sendNotificationToRole = (role, event, data) => {
  const io = require('../index').io;
  if (io) {
    io.to(`role_${role}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  }
};

/**
 * Broadcast emergency alert to external systems
 */
const broadcastEmergencyAlert = async (alertData) => {
  try {
    // Here you would integrate with external systems
    // Examples: SMS gateway, email alerts, fire alarm systems, etc.
    
    logger.info('Emergency alert broadcasted', {
      type: alertData.type,
      priority: alertData.priority,
      location: alertData.location
    });
    
    // TODO: Implement external system integrations
    // - SMS alerts to emergency contacts
    // - Email notifications
    // - Integration with fire alarm systems
    // - Push notifications to mobile apps
    
  } catch (error) {
    logger.error('Error broadcasting emergency alert:', error);
  }
};

/**
 * Clean up stale connections
 */
const cleanupStaleConnections = () => {
  const now = Date.now();
  const staleThreshold = 30 * 60 * 1000; // 30 minutes
  
  activeConnections.forEach((connection, socketId) => {
    if (now - connection.connectedAt > staleThreshold) {
      logger.info('Cleaning up stale connection', {
        socketId,
        userId: connection.userId,
        duration: now - connection.connectedAt
      });
      
      activeConnections.delete(socketId);
      
      // Clean up user sockets
      if (userSockets.has(connection.userId)) {
        userSockets.get(connection.userId).delete(socketId);
        if (userSockets.get(connection.userId).size === 0) {
          userSockets.delete(connection.userId);
        }
      }
    }
  });
};

/**
 * Get connection statistics
 */
const getConnectionStats = () => {
  const stats = {
    totalConnections: activeConnections.size,
    uniqueUsers: userSockets.size,
    connectionsByRole: {}
  };
  
  activeConnections.forEach((connection) => {
    const role = connection.userRole;
    stats.connectionsByRole[role] = (stats.connectionsByRole[role] || 0) + 1;
  });
  
  return stats;
};

/**
 * Check if user is online
 */
const isUserOnline = (userId) => {
  return userSockets.has(userId) && userSockets.get(userId).size > 0;
};

module.exports = {
  initializeSocket,
  sendNotificationToUser,
  sendNotificationToRole,
  getConnectionStats,
  isUserOnline,
  broadcastEmergencyAlert
};