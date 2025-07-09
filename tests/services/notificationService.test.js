const { 
  sendNotification, 
  sendVisitorArrivalNotification, 
  sendVisitorDepartureNotification,
  sendEmergencyNotification 
} = require('../../server/services/notificationService');
const { sendEmail } = require('../../server/services/emailService');
const { sendSMS } = require('../../server/services/smsService');
const { sendNotificationToUser } = require('../../server/services/socketService');

// Mock the services
jest.mock('../../server/services/emailService');
jest.mock('../../server/services/smsService');
jest.mock('../../server/services/socketService');

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    test('should send socket notification to user', async () => {
      const user = await global.testHelpers.createTestUser();
      
      const notification = {
        userId: user.id,
        type: 'visitor_arrival',
        title: 'Visitor Arrived',
        message: 'Your visitor has arrived',
        channels: ['socket']
      };

      const result = await sendNotification(notification);

      expect(result.socket).toBe(true);
      expect(sendNotificationToUser).toHaveBeenCalledWith(
        user.id,
        'notification',
        expect.objectContaining({
          type: 'visitor_arrival',
          title: 'Visitor Arrived',
          message: 'Your visitor has arrived'
        })
      );
    });

    test('should send email notification', async () => {
      const user = await global.testHelpers.createTestUser({
        preferences: {
          notifications: { email: true, sms: false, push: true }
        }
      });
      
      const notification = {
        userId: user.id,
        type: 'visitor_arrival',
        title: 'Visitor Arrived',
        message: 'Your visitor has arrived',
        channels: ['email']
      };

      const result = await sendNotification(notification);

      expect(result.email).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith({
        to: user.email,
        subject: 'Visitor Arrived',
        template: 'notification',
        data: expect.objectContaining({
          firstName: user.firstName,
          title: 'Visitor Arrived',
          message: 'Your visitor has arrived'
        })
      });
    });

    test('should send SMS notification', async () => {
      const user = await global.testHelpers.createTestUser({
        phone: '+1234567890',
        preferences: {
          notifications: { email: false, sms: true, push: false }
        }
      });
      
      const notification = {
        userId: user.id,
        type: 'visitor_arrival',
        title: 'Visitor Arrived',
        message: 'Your visitor has arrived',
        channels: ['sms']
      };

      const result = await sendNotification(notification);

      expect(result.sms).toBe(true);
      expect(sendSMS).toHaveBeenCalledWith({
        to: user.phone,
        message: 'Visitor Arrived: Your visitor has arrived'
      });
    });

    test('should send multi-channel notification', async () => {
      const user = await global.testHelpers.createTestUser({
        phone: '+1234567890',
        preferences: {
          notifications: { email: true, sms: true, push: true }
        }
      });
      
      const notification = {
        userId: user.id,
        type: 'visitor_arrival',
        title: 'Visitor Arrived',
        message: 'Your visitor has arrived',
        channels: ['socket', 'email', 'sms']
      };

      const result = await sendNotification(notification);

      expect(result.socket).toBe(true);
      expect(result.email).toBe(true);
      expect(result.sms).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle channel errors gracefully', async () => {
      const user = await global.testHelpers.createTestUser({
        preferences: {
          notifications: { email: true, sms: false, push: true }
        }
      });
      
      // Mock email service to throw error
      sendEmail.mockRejectedValue(new Error('Email service error'));
      
      const notification = {
        userId: user.id,
        type: 'visitor_arrival',
        title: 'Visitor Arrived',
        message: 'Your visitor has arrived',
        channels: ['socket', 'email']
      };

      const result = await sendNotification(notification);

      expect(result.socket).toBe(true);
      expect(result.email).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].channel).toBe('email');
    });

    test('should skip disabled notification channels', async () => {
      const user = await global.testHelpers.createTestUser({
        preferences: {
          notifications: { email: false, sms: false, push: true }
        }
      });
      
      const notification = {
        userId: user.id,
        type: 'visitor_arrival',
        title: 'Visitor Arrived',
        message: 'Your visitor has arrived',
        channels: ['email', 'sms']
      };

      const result = await sendNotification(notification);

      expect(result.email).toBe(false);
      expect(result.sms).toBe(false);
      expect(sendEmail).not.toHaveBeenCalled();
      expect(sendSMS).not.toHaveBeenCalled();
    });
  });

  describe('sendVisitorArrivalNotification', () => {
    test('should send arrival notification to host', async () => {
      const host = await global.testHelpers.createTestUser();
      const visitor = await global.testHelpers.createTestVisitor();
      const visit = await global.testHelpers.createTestVisit({
        hostId: host.id,
        visitorId: visitor.id,
        purpose: 'Business meeting',
        checkedInAt: new Date()
      });

      await sendVisitorArrivalNotification(visit);

      expect(sendNotificationToUser).toHaveBeenCalledWith(
        host.id,
        'notification',
        expect.objectContaining({
          type: 'visitor_arrival',
          title: 'Visitor Arrival'
        })
      );
    });

    test('should update visit notification status', async () => {
      const host = await global.testHelpers.createTestUser();
      const visitor = await global.testHelpers.createTestVisitor();
      const visit = await global.testHelpers.createTestVisit({
        hostId: host.id,
        visitorId: visitor.id,
        checkedInAt: new Date()
      });

      await sendVisitorArrivalNotification(visit);

      await visit.reload();
      expect(visit.hostNotified).toBe(true);
      expect(visit.hostNotifiedAt).toBeInstanceOf(Date);
    });

    test('should handle missing visitor gracefully', async () => {
      const host = await global.testHelpers.createTestUser();
      const visit = await global.testHelpers.createTestVisit({
        hostId: host.id,
        visitorId: 'non-existent-id',
        checkedInAt: new Date()
      });

      await expect(sendVisitorArrivalNotification(visit)).rejects.toThrow();
    });

    test('should handle missing host gracefully', async () => {
      const visitor = await global.testHelpers.createTestVisitor();
      const visit = await global.testHelpers.createTestVisit({
        hostId: 'non-existent-id',
        visitorId: visitor.id,
        checkedInAt: new Date()
      });

      await expect(sendVisitorArrivalNotification(visit)).rejects.toThrow();
    });
  });

  describe('sendVisitorDepartureNotification', () => {
    test('should send departure notification to host', async () => {
      const host = await global.testHelpers.createTestUser();
      const visitor = await global.testHelpers.createTestVisitor();
      const visit = await global.testHelpers.createTestVisit({
        hostId: host.id,
        visitorId: visitor.id,
        purpose: 'Business meeting',
        checkedInAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        checkedOutAt: new Date(),
        actualDuration: 60
      });

      await sendVisitorDepartureNotification(visit);

      expect(sendNotificationToUser).toHaveBeenCalledWith(
        host.id,
        'notification',
        expect.objectContaining({
          type: 'visitor_departure',
          title: 'Visitor Departure'
        })
      );
    });

    test('should include duration in notification', async () => {
      const host = await global.testHelpers.createTestUser();
      const visitor = await global.testHelpers.createTestVisitor();
      const visit = await global.testHelpers.createTestVisit({
        hostId: host.id,
        visitorId: visitor.id,
        checkedInAt: new Date(Date.now() - 90 * 60 * 1000), // 1.5 hours ago
        checkedOutAt: new Date(),
        actualDuration: 90
      });

      await sendVisitorDepartureNotification(visit);

      const notificationCall = sendNotificationToUser.mock.calls[0];
      expect(notificationCall[2].message).toContain('1h 30m');
    });

    test('should handle short duration visits', async () => {
      const host = await global.testHelpers.createTestUser();
      const visitor = await global.testHelpers.createTestVisitor();
      const visit = await global.testHelpers.createTestVisit({
        hostId: host.id,
        visitorId: visitor.id,
        checkedInAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        checkedOutAt: new Date(),
        actualDuration: 30
      });

      await sendVisitorDepartureNotification(visit);

      const notificationCall = sendNotificationToUser.mock.calls[0];
      expect(notificationCall[2].message).toContain('30m');
    });
  });

  describe('sendEmergencyNotification', () => {
    test('should send emergency alert to all users', async () => {
      const admin = await global.testHelpers.createTestUser({ role: 'admin' });
      const host = await global.testHelpers.createTestUser({ 
        role: 'host',
        email: 'host@example.com' 
      });
      
      const emergency = {
        type: 'FIRE',
        message: 'Fire detected in building',
        location: 'Floor 2',
        priority: 'critical',
        triggeredBy: admin.id,
        timestamp: new Date()
      };

      await sendEmergencyNotification(emergency);

      expect(sendNotificationToUser).toHaveBeenCalledWith(
        'all',
        'notification',
        expect.objectContaining({
          type: 'emergency',
          title: 'Emergency Alert'
        })
      );
    });

    test('should send SMS to emergency contacts', async () => {
      // Mock environment variable
      process.env.EMERGENCY_CONTACTS = 'emergency1@example.com,emergency2@example.com';
      
      const emergency = {
        type: 'FIRE',
        message: 'Fire detected in building',
        location: 'Floor 2',
        priority: 'critical',
        triggeredBy: 'admin-id',
        timestamp: new Date()
      };

      await sendEmergencyNotification(emergency);

      expect(sendSMS).toHaveBeenCalledWith({
        to: 'emergency1@example.com',
        message: 'EMERGENCY: FIRE - Fire detected in building at Floor 2'
      });
      
      expect(sendSMS).toHaveBeenCalledWith({
        to: 'emergency2@example.com',
        message: 'EMERGENCY: FIRE - Fire detected in building at Floor 2'
      });
    });

    test('should send email to admin users', async () => {
      const admin = await global.testHelpers.createTestUser({ role: 'admin' });
      const host = await global.testHelpers.createTestUser({ 
        role: 'host',
        email: 'host@example.com' 
      });
      
      const emergency = {
        type: 'FIRE',
        message: 'Fire detected in building',
        location: 'Floor 2',
        priority: 'critical',
        triggeredBy: admin.id,
        timestamp: new Date()
      };

      await sendEmergencyNotification(emergency);

      expect(sendEmail).toHaveBeenCalledWith({
        to: admin.email,
        subject: 'EMERGENCY ALERT: FIRE',
        template: 'emergency',
        data: expect.objectContaining({
          firstName: admin.firstName,
          emergencyType: 'FIRE',
          message: 'Fire detected in building',
          location: 'Floor 2'
        })
      });
    });

    test('should handle SMS errors gracefully', async () => {
      process.env.EMERGENCY_CONTACTS = 'emergency@example.com';
      sendSMS.mockRejectedValue(new Error('SMS service error'));
      
      const emergency = {
        type: 'FIRE',
        message: 'Fire detected in building',
        location: 'Floor 2',
        priority: 'critical',
        triggeredBy: 'admin-id',
        timestamp: new Date()
      };

      // Should not throw error
      await expect(sendEmergencyNotification(emergency)).resolves.not.toThrow();
    });

    test('should handle email errors gracefully', async () => {
      const admin = await global.testHelpers.createTestUser({ role: 'admin' });
      sendEmail.mockRejectedValue(new Error('Email service error'));
      
      const emergency = {
        type: 'FIRE',
        message: 'Fire detected in building',
        location: 'Floor 2',
        priority: 'critical',
        triggeredBy: admin.id,
        timestamp: new Date()
      };

      // Should not throw error
      await expect(sendEmergencyNotification(emergency)).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing user for notification', async () => {
      const notification = {
        userId: 'non-existent-id',
        type: 'test',
        title: 'Test',
        message: 'Test message',
        channels: ['email']
      };

      await expect(sendNotification(notification)).rejects.toThrow();
    });

    test('should handle service failures gracefully', async () => {
      const user = await global.testHelpers.createTestUser();
      
      // Mock all services to fail
      sendEmail.mockRejectedValue(new Error('Email failed'));
      sendSMS.mockRejectedValue(new Error('SMS failed'));
      sendNotificationToUser.mockImplementation(() => {
        throw new Error('Socket failed');
      });
      
      const notification = {
        userId: user.id,
        type: 'test',
        title: 'Test',
        message: 'Test message',
        channels: ['socket', 'email', 'sms']
      };

      const result = await sendNotification(notification);

      expect(result.socket).toBe(false);
      expect(result.email).toBe(false);
      expect(result.sms).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });
});