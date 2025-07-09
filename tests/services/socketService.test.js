const socketService = require('../../server/services/socketService');
const { createAuditLog } = require('../../server/services/auditService');
const logger = require('../../server/utils/logger');

// Mock dependencies
jest.mock('../../server/services/auditService');
jest.mock('../../server/utils/logger');
jest.mock('../../server/models');

describe('Socket Service', () => {
  let mockSocket;
  let mockIo;
  let mockVisitModel;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock socket object
    mockSocket = {
      id: 'socket-123',
      userId: 'user-123',
      userRole: 'host',
      handshake: { address: '192.168.1.1' },
      join: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() }))
    };

    // Mock io object
    mockIo = {
      on: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() })),
      emit: jest.fn()
    };

    // Mock Visit model
    mockVisitModel = {
      findCurrentOccupancy: jest.fn(),
      findActive: jest.fn()
    };

    // Mock require for models
    require('../../server/models').Visit = mockVisitModel;
    require('../../server/index').io = mockIo;
    
    // Mock audit service
    createAuditLog.mockResolvedValue({ id: 'audit-123' });
  });

  describe('initializeSocket', () => {
    it('should initialize socket with proper event handlers', () => {
      socketService.initializeSocket(mockIo);

      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should handle new socket connection', () => {
      socketService.initializeSocket(mockIo);
      const connectionHandler = mockIo.on.mock.calls[0][1];
      
      connectionHandler(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('user_user-123');
      expect(mockSocket.join).toHaveBeenCalledWith('role_host');
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', expect.objectContaining({
        message: 'Connected to Neo VMS',
        userId: 'user-123',
        role: 'host'
      }));
      expect(logger.info).toHaveBeenCalledWith('New socket connection', expect.any(Object));
    });

    it('should join admin users to admin room', () => {
      mockSocket.userRole = 'admin';
      socketService.initializeSocket(mockIo);
      const connectionHandler = mockIo.on.mock.calls[0][1];
      
      connectionHandler(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('admin');
    });

    it('should join reception and security to front desk room', () => {
      mockSocket.userRole = 'receptionist';
      socketService.initializeSocket(mockIo);
      const connectionHandler = mockIo.on.mock.calls[0][1];
      
      connectionHandler(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('front_desk');
    });
  });

  describe('sendNotificationToUser', () => {
    it('should send notification to specific user', () => {
      const mockToEmit = jest.fn();
      mockIo.to = jest.fn(() => ({ emit: mockToEmit }));
      
      socketService.sendNotificationToUser('user-123', 'test_event', {
        message: 'Test message'
      });

      expect(mockIo.to).toHaveBeenCalledWith('user_user-123');
      expect(mockToEmit).toHaveBeenCalledWith('test_event', expect.objectContaining({
        message: 'Test message',
        timestamp: expect.any(Date)
      }));
    });

    it('should handle missing io instance gracefully', () => {
      require('../../server/index').io = null;
      
      expect(() => {
        socketService.sendNotificationToUser('user-123', 'test_event', {});
      }).not.toThrow();
    });
  });

  describe('sendNotificationToRole', () => {
    it('should send notification to specific role', () => {
      const mockToEmit = jest.fn();
      mockIo.to = jest.fn(() => ({ emit: mockToEmit }));
      
      socketService.sendNotificationToRole('admin', 'test_event', {
        message: 'Test message'
      });

      expect(mockIo.to).toHaveBeenCalledWith('role_admin');
      expect(mockToEmit).toHaveBeenCalledWith('test_event', expect.objectContaining({
        message: 'Test message',
        timestamp: expect.any(Date)
      }));
    });
  });

  describe('getConnectionStats', () => {
    it('should return connection statistics', () => {
      // Mock active connections
      const stats = socketService.getConnectionStats();
      
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('uniqueUsers');
      expect(stats).toHaveProperty('connectionsByRole');
      expect(typeof stats.totalConnections).toBe('number');
      expect(typeof stats.uniqueUsers).toBe('number');
      expect(typeof stats.connectionsByRole).toBe('object');
    });
  });

  describe('isUserOnline', () => {
    it('should check if user is online', () => {
      const result = socketService.isUserOnline('user-123');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('broadcastEmergencyAlert', () => {
    it('should broadcast emergency alert', async () => {
      const alertData = {
        type: 'fire',
        message: 'Fire detected',
        location: 'Building A',
        priority: 'critical'
      };

      await socketService.broadcastEmergencyAlert(alertData);

      expect(logger.info).toHaveBeenCalledWith('Emergency alert broadcasted', expect.objectContaining({
        type: 'fire',
        priority: 'critical',
        location: 'Building A'
      }));
    });

    it('should handle broadcast errors gracefully', async () => {
      const alertData = {
        type: 'fire',
        message: 'Fire detected',
        location: 'Building A',
        priority: 'critical'
      };

      // Mock logger to throw error
      logger.info.mockImplementation(() => {
        throw new Error('Broadcast failed');
      });

      await expect(socketService.broadcastEmergencyAlert(alertData)).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalledWith('Error broadcasting emergency alert:', expect.any(Error));
    });
  });

  describe('Socket Event Handlers', () => {
    let eventHandlers;

    beforeEach(() => {
      socketService.initializeSocket(mockIo);
      const connectionHandler = mockIo.on.mock.calls[0][1];
      
      // Capture event handlers
      eventHandlers = {};
      mockSocket.on.mockImplementation((event, ...handlers) => {
        eventHandlers[event] = handlers[handlers.length - 1]; // Get the actual handler (last parameter)
      });
      
      connectionHandler(mockSocket);
    });

    describe('visitor_checkin handler', () => {
      it('should handle visitor check-in notification', async () => {
        const mockToEmit = jest.fn();
        mockIo.to = jest.fn(() => ({ emit: mockToEmit }));
        
        const data = {
          visitId: 'visit-123',
          visitorId: 'visitor-123',
          hostId: 'host-123'
        };

        await eventHandlers.visitor_checkin(data);

        expect(mockIo.to).toHaveBeenCalledWith('user_host-123');
        expect(mockIo.to).toHaveBeenCalledWith('front_desk');
        expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
          userId: 'user-123',
          action: 'VISITOR_CHECKIN_NOTIFICATION',
          category: 'system_access'
        }));
      });

      it('should handle visitor check-in errors', async () => {
        createAuditLog.mockRejectedValue(new Error('Database error'));
        
        const data = {
          visitId: 'visit-123',
          visitorId: 'visitor-123',
          hostId: 'host-123'
        };

        await eventHandlers.visitor_checkin(data);

        expect(logger.error).toHaveBeenCalledWith('Error handling visitor check-in notification:', expect.any(Error));
        expect(mockSocket.emit).toHaveBeenCalledWith('error', {
          message: 'Failed to send notification'
        });
      });
    });

    describe('visitor_checkout handler', () => {
      it('should handle visitor check-out notification', async () => {
        const mockToEmit = jest.fn();
        mockIo.to = jest.fn(() => ({ emit: mockToEmit }));
        
        const data = {
          visitId: 'visit-123',
          visitorId: 'visitor-123',
          hostId: 'host-123'
        };

        await eventHandlers.visitor_checkout(data);

        expect(mockIo.to).toHaveBeenCalledWith('user_host-123');
        expect(mockIo.to).toHaveBeenCalledWith('front_desk');
        expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
          action: 'VISITOR_CHECKOUT_NOTIFICATION'
        }));
      });
    });

    describe('emergency_alert handler', () => {
      it('should handle emergency alert for authorized users', async () => {
        mockSocket.userRole = 'admin';
        
        const data = {
          type: 'fire',
          message: 'Fire detected',
          location: 'Building A',
          priority: 'high'
        };

        await eventHandlers.emergency_alert(data);

        expect(mockIo.emit).toHaveBeenCalledWith('emergency_notification', expect.objectContaining({
          type: 'fire',
          message: 'Fire detected',
          location: 'Building A',
          priority: 'high'
        }));
      });
    });

    describe('occupancy_update handler', () => {
      it('should handle occupancy update', async () => {
        mockSocket.userRole = 'receptionist';
        const mockToEmit = jest.fn();
        mockIo.to = jest.fn(() => ({ emit: mockToEmit }));
        
        const data = {
          currentOccupancy: 90,
          maxOccupancy: 100,
          location: 'Building A'
        };

        await eventHandlers.occupancy_update(data);

        expect(mockIo.to).toHaveBeenCalledWith('front_desk');
        expect(mockToEmit).toHaveBeenCalledWith('occupancy_changed', expect.objectContaining({
          currentOccupancy: 90,
          maxOccupancy: 100,
          location: 'Building A'
        }));
      });

      it('should send occupancy alert when approaching capacity', async () => {
        mockSocket.userRole = 'receptionist';
        const mockToEmit = jest.fn();
        mockIo.to = jest.fn(() => ({ emit: mockToEmit }));
        
        const data = {
          currentOccupancy: 95,
          maxOccupancy: 100,
          location: 'Building A'
        };

        await eventHandlers.occupancy_update(data);

        expect(mockIo.to).toHaveBeenCalledWith('admin');
        expect(mockToEmit).toHaveBeenCalledWith('occupancy_alert', expect.objectContaining({
          message: 'Approaching maximum occupancy',
          level: 'warning'
        }));
      });
    });

    describe('send_message handler', () => {
      it('should handle message sending', async () => {
        const mockToEmit = jest.fn();
        mockIo.to = jest.fn(() => ({ emit: mockToEmit }));
        
        const data = {
          visitId: 'visit-123',
          message: 'Hello from host',
          recipientId: 'visitor-123'
        };

        await eventHandlers.send_message(data);

        expect(mockIo.to).toHaveBeenCalledWith('user_visitor-123');
        expect(mockToEmit).toHaveBeenCalledWith('new_message', expect.objectContaining({
          visitId: 'visit-123',
          message: 'Hello from host',
          senderId: 'user-123'
        }));
      });
    });

    describe('get_occupancy handler', () => {
      it('should handle occupancy request', async () => {
        mockVisitModel.findCurrentOccupancy.mockResolvedValue(45);
        
        await eventHandlers.get_occupancy();

        expect(mockVisitModel.findCurrentOccupancy).toHaveBeenCalled();
        expect(mockSocket.emit).toHaveBeenCalledWith('occupancy_data', expect.objectContaining({
          currentOccupancy: 45
        }));
      });

      it('should handle occupancy request errors', async () => {
        mockVisitModel.findCurrentOccupancy.mockRejectedValue(new Error('Database error'));
        
        await eventHandlers.get_occupancy();

        expect(logger.error).toHaveBeenCalledWith('Error getting occupancy:', expect.any(Error));
        expect(mockSocket.emit).toHaveBeenCalledWith('error', {
          message: 'Failed to get occupancy data'
        });
      });
    });

    describe('get_active_visits handler', () => {
      it('should handle active visits request for authorized users', async () => {
        mockSocket.userRole = 'admin';
        const mockVisits = [
          { id: 'visit-1', status: 'active' },
          { id: 'visit-2', status: 'active' }
        ];
        mockVisitModel.findActive.mockResolvedValue(mockVisits);
        
        await eventHandlers.get_active_visits();

        expect(mockVisitModel.findActive).toHaveBeenCalled();
        expect(mockSocket.emit).toHaveBeenCalledWith('active_visits_data', expect.objectContaining({
          visits: mockVisits,
          count: 2
        }));
      });
    });

    describe('disconnect handler', () => {
      it('should handle socket disconnection', async () => {
        await eventHandlers.disconnect('client disconnect');

        expect(logger.info).toHaveBeenCalledWith('Socket disconnected', expect.objectContaining({
          socketId: 'socket-123',
          userId: 'user-123',
          reason: 'client disconnect'
        }));
        expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
          action: 'SOCKET_DISCONNECTED',
          details: { reason: 'client disconnect' }
        }));
      });
    });

    describe('error handler', () => {
      it('should handle socket errors', () => {
        const error = new Error('Socket error');
        eventHandlers.error(error);

        expect(logger.error).toHaveBeenCalledWith('Socket error:', expect.objectContaining({
          socketId: 'socket-123',
          userId: 'user-123',
          error: 'Socket error'
        }));
      });
    });
  });
});