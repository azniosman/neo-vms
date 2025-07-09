const request = require('supertest');
const express = require('express');
const { Visit, Visitor, User } = require('../../server/models');
const visitsRoutes = require('../../server/routes/visits');
const { createAuditLog } = require('../../server/services/auditService');
const { sendVisitorArrivalNotification, sendVisitorDepartureNotification } = require('../../server/services/notificationService');
const { sendNotificationToUser, sendNotificationToRole } = require('../../server/services/socketService');

// Mock services
jest.mock('../../server/services/auditService');
jest.mock('../../server/services/notificationService');
jest.mock('../../server/services/socketService');
jest.mock('qrcode');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Mock auth middleware
  app.use((req, res, next) => {
    req.user = global.testUser || { id: 'test-user-id', role: 'admin' };
    req.ip = '127.0.0.1';
    req.get = jest.fn().mockReturnValue('test-user-agent');
    next();
  });
  
  app.use('/api/visits', visitsRoutes);
  return app;
};

describe('Visits API Integration Tests', () => {
  let app;
  let testUser;
  let testHost;
  let testVisitor;
  let testVisit;

  beforeAll(() => {
    app = createTestApp();
    createAuditLog.mockResolvedValue({ id: 'audit-123' });
    sendVisitorArrivalNotification.mockResolvedValue();
    sendVisitorDepartureNotification.mockResolvedValue();
    sendNotificationToUser.mockImplementation(() => {});
    sendNotificationToRole.mockImplementation(() => {});
    
    // Mock QR code generation
    const QRCode = require('qrcode');
    QRCode.toDataURL = jest.fn().mockResolvedValue('data:image/png;base64,mock-qr-code');
  });

  beforeEach(async () => {
    testUser = await global.testHelpers.createTestUser({
      role: 'admin',
      firstName: 'Test',
      lastName: 'Admin'
    });

    testHost = await global.testHelpers.createTestUser({
      role: 'host',
      firstName: 'Test',
      lastName: 'Host',
      email: 'host@example.com'
    });

    testVisitor = await global.testHelpers.createTestVisitor({
      email: 'visitor@example.com',
      firstName: 'John',
      lastName: 'Doe',
      company: 'Test Company',
      gdprConsent: true
    });

    testVisit = await global.testHelpers.createTestVisit({
      visitorId: testVisitor.id,
      hostId: testHost.id,
      purpose: 'Business Meeting',
      status: 'pre_registered'
    });

    global.testUser = testUser;
  });

  describe('GET /api/visits', () => {
    it('should get all visits with pagination', async () => {
      const response = await request(app)
        .get('/api/visits')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.visits).toBeInstanceOf(Array);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISITS_VIEWED',
        category: 'data_access'
      }));
    });

    it('should filter visits by status', async () => {
      const response = await request(app)
        .get('/api/visits')
        .query({ status: 'pre_registered' });

      expect(response.status).toBe(200);
      expect(response.body.visits).toBeInstanceOf(Array);
      expect(response.body.visits.every(v => v.status === 'pre_registered')).toBe(true);
    });

    it('should filter visits by host ID', async () => {
      const response = await request(app)
        .get('/api/visits')
        .query({ hostId: testHost.id });

      expect(response.status).toBe(200);
      expect(response.body.visits).toBeInstanceOf(Array);
      expect(response.body.visits.every(v => v.hostId === testHost.id)).toBe(true);
    });

    it('should filter visits by visitor ID', async () => {
      const response = await request(app)
        .get('/api/visits')
        .query({ visitorId: testVisitor.id });

      expect(response.status).toBe(200);
      expect(response.body.visits).toBeInstanceOf(Array);
      expect(response.body.visits.every(v => v.visitorId === testVisitor.id)).toBe(true);
    });

    it('should filter visits by date range', async () => {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const response = await request(app)
        .get('/api/visits')
        .query({ 
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.visits).toBeInstanceOf(Array);
    });

    it('should include visit relationships', async () => {
      const response = await request(app)
        .get('/api/visits');

      expect(response.status).toBe(200);
      expect(response.body.visits).toBeInstanceOf(Array);
      if (response.body.visits.length > 0) {
        expect(response.body.visits[0]).toHaveProperty('visitor');
        expect(response.body.visits[0]).toHaveProperty('host');
      }
    });

    it('should require appropriate permissions', async () => {
      global.testUser = { id: 'test-user-id', role: 'host' };

      const response = await request(app)
        .get('/api/visits');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/visits/active', () => {
    beforeEach(async () => {
      await testVisit.update({ status: 'checked_in', checkedInAt: new Date() });
    });

    it('should get active visits', async () => {
      const response = await request(app)
        .get('/api/visits/active');

      expect(response.status).toBe(200);
      expect(response.body.visits).toBeInstanceOf(Array);
      expect(response.body.count).toBeDefined();
      expect(response.body.visits.every(v => v.status === 'checked_in')).toBe(true);
    });

    it('should include visitor and host information', async () => {
      const response = await request(app)
        .get('/api/visits/active');

      expect(response.status).toBe(200);
      if (response.body.visits.length > 0) {
        expect(response.body.visits[0]).toHaveProperty('visitor');
        expect(response.body.visits[0]).toHaveProperty('host');
      }
    });
  });

  describe('GET /api/visits/occupancy', () => {
    it('should get current occupancy', async () => {
      const response = await request(app)
        .get('/api/visits/occupancy');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('currentOccupancy');
      expect(response.body).toHaveProperty('maxOccupancy');
      expect(response.body).toHaveProperty('occupancyRate');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.currentOccupancy).toBe('number');
      expect(typeof response.body.maxOccupancy).toBe('number');
    });
  });

  describe('GET /api/visits/overdue', () => {
    it('should get overdue visits', async () => {
      const response = await request(app)
        .get('/api/visits/overdue');

      expect(response.status).toBe(200);
      expect(response.body.visits).toBeInstanceOf(Array);
      expect(response.body.count).toBeDefined();
    });
  });

  describe('GET /api/visits/:id', () => {
    it('should get visit by ID', async () => {
      const response = await request(app)
        .get(`/api/visits/${testVisit.id}`);

      expect(response.status).toBe(200);
      expect(response.body.visit).toHaveProperty('id', testVisit.id);
      expect(response.body.visit).toHaveProperty('purpose', testVisit.purpose);
      expect(response.body.visit).toHaveProperty('visitor');
      expect(response.body.visit).toHaveProperty('host');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISIT_VIEWED',
        category: 'data_access'
      }));
    });

    it('should return 404 for non-existent visit', async () => {
      const response = await request(app)
        .get('/api/visits/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Visit not found');
    });
  });

  describe('POST /api/visits', () => {
    it('should create new visit with valid data', async () => {
      const visitData = {
        visitorId: testVisitor.id,
        hostId: testHost.id,
        purpose: 'New Business Meeting',
        expectedDuration: 60,
        scheduledArrival: new Date().toISOString(),
        location: 'Conference Room A',
        floor: '5',
        room: 'A501'
      };

      const response = await request(app)
        .post('/api/visits')
        .send(visitData);

      expect(response.status).toBe(201);
      expect(response.body.visit).toHaveProperty('id');
      expect(response.body.visit.purpose).toBe(visitData.purpose);
      expect(response.body.visit.visitorId).toBe(visitData.visitorId);
      expect(response.body.visit.hostId).toBe(visitData.hostId);
      expect(response.body.visit.status).toBe('pre_registered');
      expect(response.body.qrCode).toBeDefined();
      expect(response.body.message).toBe('Visit created successfully');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISIT_CREATED',
        category: 'data_modification'
      }));
      expect(sendNotificationToUser).toHaveBeenCalledWith(
        testHost.id,
        'visit_scheduled',
        expect.any(Object)
      );
    });

    it('should return 404 for non-existent visitor', async () => {
      const visitData = {
        visitorId: 'non-existent-visitor',
        hostId: testHost.id,
        purpose: 'Test Meeting',
        expectedDuration: 60
      };

      const response = await request(app)
        .post('/api/visits')
        .send(visitData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Visitor not found');
    });

    it('should return 404 for non-existent host', async () => {
      const visitData = {
        visitorId: testVisitor.id,
        hostId: 'non-existent-host',
        purpose: 'Test Meeting',
        expectedDuration: 60
      };

      const response = await request(app)
        .post('/api/visits')
        .send(visitData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Host not found');
    });

    it('should reject visit for blacklisted visitor', async () => {
      await testVisitor.update({ isBlacklisted: true });

      const visitData = {
        visitorId: testVisitor.id,
        hostId: testHost.id,
        purpose: 'Test Meeting',
        expectedDuration: 60
      };

      const response = await request(app)
        .post('/api/visits')
        .send(visitData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Visitor blacklisted');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/visits')
        .send({
          visitorId: 'invalid-uuid',
          hostId: testHost.id,
          purpose: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should require admin or receptionist role', async () => {
      global.testUser = { id: 'test-user-id', role: 'host' };

      const response = await request(app)
        .post('/api/visits')
        .send({
          visitorId: testVisitor.id,
          hostId: testHost.id,
          purpose: 'Test Meeting'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/visits/:id/checkin', () => {
    it('should check in visitor successfully', async () => {
      const response = await request(app)
        .post(`/api/visits/${testVisit.id}/checkin`);

      expect(response.status).toBe(200);
      expect(response.body.visit.status).toBe('checked_in');
      expect(response.body.visit.checkedInAt).toBeDefined();
      expect(response.body.message).toBe('Visitor checked in successfully');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISITOR_CHECKED_IN',
        category: 'system_access'
      }));
      expect(sendVisitorArrivalNotification).toHaveBeenCalledWith(expect.any(Object));
      expect(sendNotificationToUser).toHaveBeenCalledWith(
        testVisit.hostId,
        'visitor_checked_in',
        expect.any(Object)
      );
    });

    it('should return 404 for non-existent visit', async () => {
      const response = await request(app)
        .post('/api/visits/non-existent-id/checkin');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Visit not found');
    });

    it('should reject check-in for already checked-in visitor', async () => {
      await testVisit.update({ status: 'checked_in', checkedInAt: new Date() });

      const response = await request(app)
        .post(`/api/visits/${testVisit.id}/checkin`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Already checked in');
    });

    it('should reject check-in for completed visit', async () => {
      await testVisit.update({ status: 'checked_out', checkedOutAt: new Date() });

      const response = await request(app)
        .post(`/api/visits/${testVisit.id}/checkin`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Visit completed');
    });

    it('should reject check-in for blacklisted visitor', async () => {
      await testVisitor.update({ isBlacklisted: true });

      const response = await request(app)
        .post(`/api/visits/${testVisit.id}/checkin`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Visitor blacklisted');
    });
  });

  describe('POST /api/visits/:id/checkout', () => {
    beforeEach(async () => {
      await testVisit.update({ status: 'checked_in', checkedInAt: new Date() });
    });

    it('should check out visitor successfully', async () => {
      const response = await request(app)
        .post(`/api/visits/${testVisit.id}/checkout`);

      expect(response.status).toBe(200);
      expect(response.body.visit.status).toBe('checked_out');
      expect(response.body.visit.checkedOutAt).toBeDefined();
      expect(response.body.message).toBe('Visitor checked out successfully');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISITOR_CHECKED_OUT',
        category: 'system_access'
      }));
      expect(sendVisitorDepartureNotification).toHaveBeenCalledWith(expect.any(Object));
      expect(sendNotificationToUser).toHaveBeenCalledWith(
        testVisit.hostId,
        'visitor_checked_out',
        expect.any(Object)
      );
    });

    it('should check out visitor with rating and feedback', async () => {
      const checkoutData = {
        rating: 5,
        feedback: 'Great visit experience!'
      };

      const response = await request(app)
        .post(`/api/visits/${testVisit.id}/checkout`)
        .send(checkoutData);

      expect(response.status).toBe(200);
      expect(response.body.visit.status).toBe('checked_out');
      expect(response.body.visit.ratingGiven).toBe(5);
      expect(response.body.visit.feedbackGiven).toBe('Great visit experience!');
      expect(response.body.visit.feedbackGivenAt).toBeDefined();
    });

    it('should return 404 for non-existent visit', async () => {
      const response = await request(app)
        .post('/api/visits/non-existent-id/checkout');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Visit not found');
    });

    it('should reject check-out for non-checked-in visitor', async () => {
      await testVisit.update({ status: 'pre_registered' });

      const response = await request(app)
        .post(`/api/visits/${testVisit.id}/checkout`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Not checked in');
    });
  });

  describe('PUT /api/visits/:id', () => {
    it('should update visit with valid data', async () => {
      const updateData = {
        purpose: 'Updated Meeting Purpose',
        expectedDuration: 90,
        location: 'Updated Location',
        floor: '6',
        room: 'B601'
      };

      const response = await request(app)
        .put(`/api/visits/${testVisit.id}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.visit.purpose).toBe('Updated Meeting Purpose');
      expect(response.body.visit.expectedDuration).toBe(90);
      expect(response.body.visit.location).toBe('Updated Location');
      expect(response.body.message).toBe('Visit updated successfully');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISIT_UPDATED',
        category: 'data_modification'
      }));
    });

    it('should return 404 for non-existent visit', async () => {
      const response = await request(app)
        .put('/api/visits/non-existent-id')
        .send({
          purpose: 'Updated Purpose'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Visit not found');
    });

    it('should reject update for completed visit', async () => {
      await testVisit.update({ status: 'checked_out', checkedOutAt: new Date() });

      const response = await request(app)
        .put(`/api/visits/${testVisit.id}`)
        .send({
          purpose: 'Updated Purpose'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Visit completed');
    });
  });

  describe('DELETE /api/visits/:id', () => {
    it('should cancel visit with valid reason', async () => {
      const reason = 'Meeting cancelled by host';

      const response = await request(app)
        .delete(`/api/visits/${testVisit.id}`)
        .send({ reason });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Visit cancelled successfully');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISIT_CANCELLED',
        category: 'data_modification'
      }));
      expect(sendNotificationToUser).toHaveBeenCalledWith(
        testVisit.hostId,
        'visit_cancelled',
        expect.any(Object)
      );

      // Verify visit was cancelled
      await testVisit.reload();
      expect(testVisit.status).toBe('cancelled');
    });

    it('should return 404 for non-existent visit', async () => {
      const response = await request(app)
        .delete('/api/visits/non-existent-id')
        .send({ reason: 'Test reason' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Visit not found');
    });

    it('should reject cancellation for completed visit', async () => {
      await testVisit.update({ status: 'checked_out', checkedOutAt: new Date() });

      const response = await request(app)
        .delete(`/api/visits/${testVisit.id}`)
        .send({ reason: 'Test reason' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Visit completed');
    });

    it('should reject cancellation for active visit', async () => {
      await testVisit.update({ status: 'checked_in', checkedInAt: new Date() });

      const response = await request(app)
        .delete(`/api/visits/${testVisit.id}`)
        .send({ reason: 'Test reason' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Visit active');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const originalFindAndCountAll = Visit.findAndCountAll;
      Visit.findAndCountAll = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/visits');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to retrieve visits');

      Visit.findAndCountAll = originalFindAndCountAll;
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/visits')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/visits')
        .send();

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle QR code generation errors', async () => {
      const QRCode = require('qrcode');
      QRCode.toDataURL = jest.fn().mockRejectedValue(new Error('QR code generation failed'));

      const visitData = {
        visitorId: testVisitor.id,
        hostId: testHost.id,
        purpose: 'Test Meeting',
        expectedDuration: 60
      };

      const response = await request(app)
        .post('/api/visits')
        .send(visitData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create visit');
    });
  });
});