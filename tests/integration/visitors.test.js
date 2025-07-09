const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Visitor, User, Visit, ConsentRecord } = require('../../server/models');
const visitorsRoutes = require('../../server/routes/visitors');
const { createAuditLog } = require('../../server/services/auditService');

// Mock services
jest.mock('../../server/services/auditService');
jest.mock('../../server/services/notificationService');

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
  
  app.use('/api/visitors', visitorsRoutes);
  return app;
};

describe('Visitors API Integration Tests', () => {
  let app;
  let testUser;
  let testVisitor;

  beforeAll(() => {
    app = createTestApp();
    createAuditLog.mockResolvedValue({ id: 'audit-123' });
  });

  beforeEach(async () => {
    testUser = await global.testHelpers.createTestUser({
      role: 'admin',
      firstName: 'Test',
      lastName: 'Admin'
    });
    global.testUser = testUser;

    testVisitor = await global.testHelpers.createTestVisitor({
      email: 'visitor@example.com',
      firstName: 'John',
      lastName: 'Doe',
      company: 'Test Company',
      gdprConsent: true
    });
  });

  describe('GET /api/visitors', () => {
    it('should get all visitors with pagination', async () => {
      const response = await request(app)
        .get('/api/visitors')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.visitors).toBeInstanceOf(Array);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISITORS_VIEWED',
        category: 'data_access'
      }));
    });

    it('should filter visitors by search term', async () => {
      const response = await request(app)
        .get('/api/visitors')
        .query({ search: 'John' });

      expect(response.status).toBe(200);
      expect(response.body.visitors).toBeInstanceOf(Array);
      // Should include our test visitor
      expect(response.body.visitors.some(v => v.firstName === 'John')).toBe(true);
    });

    it('should filter visitors by visitor type', async () => {
      await global.testHelpers.createTestVisitor({
        email: 'contractor@example.com',
        visitorType: 'contractor'
      });

      const response = await request(app)
        .get('/api/visitors')
        .query({ visitorType: 'contractor' });

      expect(response.status).toBe(200);
      expect(response.body.visitors).toBeInstanceOf(Array);
      expect(response.body.visitors.every(v => v.visitorType === 'contractor')).toBe(true);
    });

    it('should filter visitors by blacklist status', async () => {
      await global.testHelpers.createTestVisitor({
        email: 'blacklisted@example.com',
        isBlacklisted: true
      });

      const response = await request(app)
        .get('/api/visitors')
        .query({ isBlacklisted: 'true' });

      expect(response.status).toBe(200);
      expect(response.body.visitors).toBeInstanceOf(Array);
      expect(response.body.visitors.every(v => v.isBlacklisted === true)).toBe(true);
    });

    it('should sort visitors by specified field', async () => {
      const response = await request(app)
        .get('/api/visitors')
        .query({ sortBy: 'firstName', sortOrder: 'ASC' });

      expect(response.status).toBe(200);
      expect(response.body.visitors).toBeInstanceOf(Array);
    });

    it('should require appropriate permissions', async () => {
      global.testUser = { id: 'test-user-id', role: 'host' };

      const response = await request(app)
        .get('/api/visitors');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/visitors/:id', () => {
    it('should get visitor by ID', async () => {
      const response = await request(app)
        .get(`/api/visitors/${testVisitor.id}`);

      expect(response.status).toBe(200);
      expect(response.body.visitor).toHaveProperty('id', testVisitor.id);
      expect(response.body.visitor).toHaveProperty('email', testVisitor.email);
      expect(response.body.visitor).toHaveProperty('firstName', testVisitor.firstName);
      expect(response.body.visitor).toHaveProperty('lastName', testVisitor.lastName);
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISITOR_VIEWED',
        category: 'data_access'
      }));
    });

    it('should return 404 for non-existent visitor', async () => {
      const response = await request(app)
        .get('/api/visitors/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Visitor not found');
    });

    it('should include visitor relationships', async () => {
      const response = await request(app)
        .get(`/api/visitors/${testVisitor.id}`);

      expect(response.status).toBe(200);
      expect(response.body.visitor).toHaveProperty('visits');
      expect(response.body.visitor).toHaveProperty('consents');
    });
  });

  describe('POST /api/visitors', () => {
    it('should create new visitor with valid data', async () => {
      const visitorData = {
        email: 'newvisitor@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1234567890',
        company: 'New Company',
        visitorType: 'guest',
        gdprConsent: true,
        photoConsent: false,
        marketingConsent: true,
        biometricConsent: false
      };

      const response = await request(app)
        .post('/api/visitors')
        .send(visitorData);

      expect(response.status).toBe(201);
      expect(response.body.visitor).toHaveProperty('id');
      expect(response.body.visitor.email).toBe(visitorData.email);
      expect(response.body.visitor.firstName).toBe(visitorData.firstName);
      expect(response.body.visitor.lastName).toBe(visitorData.lastName);
      expect(response.body.visitor.gdprConsent).toBe(true);
      expect(response.body.visitor.marketingConsent).toBe(true);
      expect(response.body.message).toBe('Visitor created successfully');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISITOR_CREATED',
        category: 'data_modification'
      }));
    });

    it('should create consent records for granted consents', async () => {
      const visitorData = {
        email: 'consent@example.com',
        firstName: 'Consent',
        lastName: 'Test',
        gdprConsent: true,
        photoConsent: true,
        marketingConsent: true,
        biometricConsent: true
      };

      const response = await request(app)
        .post('/api/visitors')
        .send(visitorData);

      expect(response.status).toBe(201);
      
      // Check if consent records were created
      const consentRecords = await ConsentRecord.findAll({
        where: { visitorId: response.body.visitor.id }
      });
      
      expect(consentRecords.length).toBe(4); // GDPR, photo, marketing, biometric
      expect(consentRecords.every(record => record.consentStatus === 'granted')).toBe(true);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/visitors')
        .send({
          email: 'invalid-email',
          firstName: '',
          lastName: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject duplicate email', async () => {
      const visitorData = {
        email: testVisitor.email,
        firstName: 'Duplicate',
        lastName: 'Test',
        gdprConsent: true
      };

      const response = await request(app)
        .post('/api/visitors')
        .send(visitorData);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Visitor already exists');
    });

    it('should validate visitor type', async () => {
      const visitorData = {
        email: 'invalid@example.com',
        firstName: 'Invalid',
        lastName: 'Type',
        visitorType: 'invalid_type',
        gdprConsent: true
      };

      const response = await request(app)
        .post('/api/visitors')
        .send(visitorData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should require admin or receptionist role', async () => {
      global.testUser = { id: 'test-user-id', role: 'host' };

      const response = await request(app)
        .post('/api/visitors')
        .send({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          gdprConsent: true
        });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/visitors/:id', () => {
    it('should update visitor with valid data', async () => {
      const updateData = {
        email: testVisitor.email,
        firstName: 'Updated',
        lastName: 'Name',
        phone: '+0987654321',
        company: 'Updated Company',
        visitorType: 'contractor',
        gdprConsent: true
      };

      const response = await request(app)
        .put(`/api/visitors/${testVisitor.id}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.visitor.firstName).toBe('Updated');
      expect(response.body.visitor.lastName).toBe('Name');
      expect(response.body.visitor.company).toBe('Updated Company');
      expect(response.body.visitor.visitorType).toBe('contractor');
      expect(response.body.message).toBe('Visitor updated successfully');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISITOR_UPDATED',
        category: 'data_modification'
      }));
    });

    it('should return 404 for non-existent visitor', async () => {
      const response = await request(app)
        .put('/api/visitors/non-existent-id')
        .send({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'Test',
          gdprConsent: true
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Visitor not found');
    });

    it('should validate email uniqueness when changing email', async () => {
      const otherVisitor = await global.testHelpers.createTestVisitor({
        email: 'other@example.com'
      });

      const response = await request(app)
        .put(`/api/visitors/${testVisitor.id}`)
        .send({
          email: otherVisitor.email,
          firstName: 'Test',
          lastName: 'Test',
          gdprConsent: true
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Email already exists');
    });

    it('should validate input data', async () => {
      const response = await request(app)
        .put(`/api/visitors/${testVisitor.id}`)
        .send({
          email: 'invalid-email',
          firstName: '',
          lastName: 'Test',
          gdprConsent: true
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/visitors/:id/photo', () => {
    it('should upload visitor photo successfully', async () => {
      // Mock visitor with photo consent
      const mockVisitor = {
        ...testVisitor.toJSON(),
        photoConsent: true,
        canTakePhoto: jest.fn().mockReturnValue(true),
        update: jest.fn().mockResolvedValue(true)
      };
      
      jest.spyOn(Visitor, 'findByPk').mockResolvedValue(mockVisitor);

      const response = await request(app)
        .post(`/api/visitors/${testVisitor.id}/photo`)
        .attach('photo', Buffer.from('fake-image-data'), 'test.jpg');

      expect(response.status).toBe(200);
      expect(response.body.photo).toBeDefined();
      expect(response.body.message).toBe('Photo uploaded successfully');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISITOR_PHOTO_UPLOADED',
        category: 'data_modification'
      }));
    });

    it('should return 404 for non-existent visitor', async () => {
      const response = await request(app)
        .post('/api/visitors/non-existent-id/photo')
        .attach('photo', Buffer.from('fake-image-data'), 'test.jpg');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Visitor not found');
    });

    it('should reject photo upload without consent', async () => {
      const mockVisitor = {
        ...testVisitor.toJSON(),
        photoConsent: false,
        canTakePhoto: jest.fn().mockReturnValue(false)
      };
      
      jest.spyOn(Visitor, 'findByPk').mockResolvedValue(mockVisitor);

      const response = await request(app)
        .post(`/api/visitors/${testVisitor.id}/photo`)
        .attach('photo', Buffer.from('fake-image-data'), 'test.jpg');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Photo consent required');
    });

    it('should reject request without file', async () => {
      const mockVisitor = {
        ...testVisitor.toJSON(),
        photoConsent: true,
        canTakePhoto: jest.fn().mockReturnValue(true)
      };
      
      jest.spyOn(Visitor, 'findByPk').mockResolvedValue(mockVisitor);

      const response = await request(app)
        .post(`/api/visitors/${testVisitor.id}/photo`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file uploaded');
    });
  });

  describe('POST /api/visitors/:id/blacklist', () => {
    it('should blacklist visitor with valid reason', async () => {
      const reason = 'Security incident';

      const response = await request(app)
        .post(`/api/visitors/${testVisitor.id}/blacklist`)
        .send({ reason });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Visitor blacklisted successfully');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISITOR_BLACKLISTED',
        category: 'security',
        severity: 'high',
        riskLevel: 'high'
      }));

      // Verify visitor was actually blacklisted
      await testVisitor.reload();
      expect(testVisitor.isBlacklisted).toBe(true);
      expect(testVisitor.blacklistReason).toBe(reason);
    });

    it('should return 404 for non-existent visitor', async () => {
      const response = await request(app)
        .post('/api/visitors/non-existent-id/blacklist')
        .send({ reason: 'Test reason' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Visitor not found');
    });

    it('should require reason for blacklisting', async () => {
      const response = await request(app)
        .post(`/api/visitors/${testVisitor.id}/blacklist`)
        .send({ reason: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Reason required');
    });

    it('should reject blacklisting already blacklisted visitor', async () => {
      await testVisitor.update({ isBlacklisted: true });

      const response = await request(app)
        .post(`/api/visitors/${testVisitor.id}/blacklist`)
        .send({ reason: 'Test reason' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Already blacklisted');
    });
  });

  describe('DELETE /api/visitors/:id/blacklist', () => {
    beforeEach(async () => {
      await testVisitor.update({
        isBlacklisted: true,
        blacklistReason: 'Test reason',
        blacklistedBy: testUser.id,
        blacklistedAt: new Date()
      });
    });

    it('should remove visitor from blacklist', async () => {
      const response = await request(app)
        .delete(`/api/visitors/${testVisitor.id}/blacklist`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Visitor removed from blacklist successfully');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VISITOR_UNBLACKLISTED',
        category: 'security',
        severity: 'medium'
      }));

      // Verify visitor was actually removed from blacklist
      await testVisitor.reload();
      expect(testVisitor.isBlacklisted).toBe(false);
      expect(testVisitor.blacklistReason).toBeNull();
    });

    it('should return 404 for non-existent visitor', async () => {
      const response = await request(app)
        .delete('/api/visitors/non-existent-id/blacklist');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Visitor not found');
    });

    it('should reject removing non-blacklisted visitor from blacklist', async () => {
      await testVisitor.update({ isBlacklisted: false });

      const response = await request(app)
        .delete(`/api/visitors/${testVisitor.id}/blacklist`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Not blacklisted');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const originalFindAndCountAll = Visitor.findAndCountAll;
      Visitor.findAndCountAll = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/visitors');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to retrieve visitors');

      Visitor.findAndCountAll = originalFindAndCountAll;
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/visitors')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/visitors')
        .send();

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle file upload errors', async () => {
      const mockVisitor = {
        ...testVisitor.toJSON(),
        photoConsent: true,
        canTakePhoto: jest.fn().mockReturnValue(true)
      };
      
      jest.spyOn(Visitor, 'findByPk').mockResolvedValue(mockVisitor);

      const response = await request(app)
        .post(`/api/visitors/${testVisitor.id}/photo`)
        .attach('photo', Buffer.from('fake-image-data'), 'test.txt'); // Invalid file type

      expect(response.status).toBe(400);
    });
  });
});