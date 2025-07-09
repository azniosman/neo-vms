const { Visitor } = require('../../server/models');

describe('Visitor Model', () => {
  describe('Visitor Creation', () => {
    test('should create a visitor with valid data', async () => {
      const visitorData = {
        email: 'visitor@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        company: 'Test Company',
        phone: '+1234567890',
        visitorType: 'guest',
        gdprConsent: true,
        gdprConsentDate: new Date()
      };

      const visitor = await Visitor.create(visitorData);

      expect(visitor.id).toBeDefined();
      expect(visitor.email).toBe(visitorData.email);
      expect(visitor.firstName).toBe(visitorData.firstName);
      expect(visitor.lastName).toBe(visitorData.lastName);
      expect(visitor.company).toBe(visitorData.company);
      expect(visitor.phone).toBe(visitorData.phone);
      expect(visitor.visitorType).toBe(visitorData.visitorType);
      expect(visitor.gdprConsent).toBe(true);
      expect(visitor.isBlacklisted).toBe(false);
      expect(visitor.isRecurring).toBe(false);
      expect(visitor.totalVisits).toBe(0);
    });

    test('should set default visitor type to guest', async () => {
      const visitor = await Visitor.create({
        email: 'visitor@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        gdprConsent: true,
        gdprConsentDate: new Date()
      });

      expect(visitor.visitorType).toBe('guest');
    });

    test('should set data retention date on creation', async () => {
      const visitor = await global.testHelpers.createTestVisitor();
      
      expect(visitor.dataRetentionDate).toBeInstanceOf(Date);
      expect(visitor.dataRetentionDate.getTime()).toBeGreaterThan(Date.now());
    });

    test('should fail with invalid email', async () => {
      const visitorData = {
        email: 'invalid-email',
        firstName: 'Jane',
        lastName: 'Smith',
        gdprConsent: true
      };

      await expect(Visitor.create(visitorData)).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    test('should return full name', async () => {
      const visitor = await global.testHelpers.createTestVisitor({
        firstName: 'Jane',
        lastName: 'Smith'
      });

      expect(visitor.getFullName()).toBe('Jane Smith');
    });

    test('should check if retention is expired', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      
      const expiredVisitor = await global.testHelpers.createTestVisitor({
        dataRetentionDate: pastDate
      });
      
      const validVisitor = await global.testHelpers.createTestVisitor({
        email: 'valid@example.com',
        dataRetentionDate: futureDate
      });

      expect(expiredVisitor.isRetentionExpired()).toBe(true);
      expect(validVisitor.isRetentionExpired()).toBe(false);
    });

    test('should check valid consent', async () => {
      const withConsent = await global.testHelpers.createTestVisitor({
        gdprConsent: true,
        gdprConsentDate: new Date()
      });
      
      const withoutConsent = await global.testHelpers.createTestVisitor({
        email: 'noconsent@example.com',
        gdprConsent: false,
        gdprConsentDate: null
      });

      expect(withConsent.hasValidConsent()).toBe(true);
      expect(withoutConsent.hasValidConsent()).toBe(false);
    });

    test('should check photo consent', async () => {
      const withPhotoConsent = await global.testHelpers.createTestVisitor({
        photoConsent: true,
        photoConsentDate: new Date()
      });
      
      const withoutPhotoConsent = await global.testHelpers.createTestVisitor({
        email: 'nophoto@example.com',
        photoConsent: false
      });

      expect(withPhotoConsent.canTakePhoto()).toBe(true);
      expect(withoutPhotoConsent.canTakePhoto()).toBe(false);
    });

    test('should check biometric consent', async () => {
      const withBiometricConsent = await global.testHelpers.createTestVisitor({
        biometricConsent: true,
        biometricConsentDate: new Date()
      });
      
      const withoutBiometricConsent = await global.testHelpers.createTestVisitor({
        email: 'nobiometric@example.com',
        biometricConsent: false
      });

      expect(withBiometricConsent.canUseBiometrics()).toBe(true);
      expect(withoutBiometricConsent.canUseBiometrics()).toBe(false);
    });

    test('should update visit statistics', async () => {
      const visitor = await global.testHelpers.createTestVisitor();
      
      expect(visitor.totalVisits).toBe(0);
      expect(visitor.lastVisit).toBeNull();
      
      await visitor.updateVisitStats();
      
      expect(visitor.totalVisits).toBe(1);
      expect(visitor.lastVisit).toBeInstanceOf(Date);
    });
  });

  describe('Class Methods', () => {
    test('should find visitor by email', async () => {
      const email = 'test@example.com';
      const visitor = await global.testHelpers.createTestVisitor({ email });

      const foundVisitor = await Visitor.findByEmail(email);
      expect(foundVisitor).toBeDefined();
      expect(foundVisitor.id).toBe(visitor.id);
    });

    test('should find visitor by phone', async () => {
      const phone = '+1234567890';
      const visitor = await global.testHelpers.createTestVisitor({ phone });

      const foundVisitor = await Visitor.findByPhone(phone);
      expect(foundVisitor).toBeDefined();
      expect(foundVisitor.id).toBe(visitor.id);
    });

    test('should find visitor by national ID', async () => {
      const nationalId = 'ID123456789';
      const visitor = await global.testHelpers.createTestVisitor({ nationalId });

      const foundVisitor = await Visitor.findByNationalId(nationalId);
      expect(foundVisitor).toBeDefined();
      expect(foundVisitor.id).toBe(visitor.id);
    });

    test('should find active visitors', async () => {
      await global.testHelpers.createTestVisitor({ isBlacklisted: false });
      await global.testHelpers.createTestVisitor({ 
        email: 'blacklisted@example.com', 
        isBlacklisted: true 
      });

      const activeVisitors = await Visitor.findActive();
      expect(activeVisitors).toHaveLength(1);
      expect(activeVisitors[0].isBlacklisted).toBe(false);
    });

    test('should find blacklisted visitors', async () => {
      await global.testHelpers.createTestVisitor({ isBlacklisted: false });
      await global.testHelpers.createTestVisitor({ 
        email: 'blacklisted@example.com', 
        isBlacklisted: true 
      });

      const blacklistedVisitors = await Visitor.findBlacklisted();
      expect(blacklistedVisitors).toHaveLength(1);
      expect(blacklistedVisitors[0].isBlacklisted).toBe(true);
    });

    test('should find recurring visitors', async () => {
      await global.testHelpers.createTestVisitor({ isRecurring: false });
      await global.testHelpers.createTestVisitor({ 
        email: 'recurring@example.com', 
        isRecurring: true 
      });

      const recurringVisitors = await Visitor.findRecurring();
      expect(recurringVisitors).toHaveLength(1);
      expect(recurringVisitors[0].isRecurring).toBe(true);
    });

    test('should find visitors by type', async () => {
      await global.testHelpers.createTestVisitor({ visitorType: 'guest' });
      await global.testHelpers.createTestVisitor({ 
        email: 'contractor@example.com', 
        visitorType: 'contractor' 
      });

      const contractors = await Visitor.findByType('contractor');
      expect(contractors).toHaveLength(1);
      expect(contractors[0].visitorType).toBe('contractor');
    });

    test('should find visitors with expired retention', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await global.testHelpers.createTestVisitor({ dataRetentionDate: pastDate });
      await global.testHelpers.createTestVisitor({ 
        email: 'future@example.com', 
        dataRetentionDate: futureDate 
      });

      const expiredVisitors = await Visitor.findExpiredRetention();
      expect(expiredVisitors).toHaveLength(1);
      expect(expiredVisitors[0].isRetentionExpired()).toBe(true);
    });
  });

  describe('JSON Serialization', () => {
    test('should exclude sensitive data for expired retention', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const visitor = await global.testHelpers.createTestVisitor({
        dataRetentionDate: pastDate,
        nationalId: 'ID123456789',
        address: '123 Main St'
      });

      const json = visitor.toJSON();

      expect(json.nationalId).toBeUndefined();
      expect(json.address).toBeUndefined();
      expect(json.emergencyContact).toBeUndefined();
      expect(json.customFields).toBeUndefined();
      expect(json.id).toBeDefined();
      expect(json.email).toBeDefined();
    });

    test('should include all data for valid retention', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const visitor = await global.testHelpers.createTestVisitor({
        dataRetentionDate: futureDate,
        nationalId: 'ID123456789',
        address: '123 Main St'
      });

      const json = visitor.toJSON();

      expect(json.nationalId).toBeDefined();
      expect(json.address).toBeDefined();
      expect(json.id).toBeDefined();
      expect(json.email).toBeDefined();
    });
  });

  describe('Validation', () => {
    test('should validate email format', async () => {
      const invalidData = {
        email: 'invalid-email',
        firstName: 'Jane',
        lastName: 'Smith',
        gdprConsent: true
      };

      await expect(Visitor.create(invalidData)).rejects.toThrow();
    });

    test('should validate phone length', async () => {
      const invalidData = {
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '123', // Too short
        gdprConsent: true
      };

      await expect(Visitor.create(invalidData)).rejects.toThrow();
    });

    test('should validate visitor type enum', async () => {
      const invalidData = {
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        visitorType: 'invalid_type',
        gdprConsent: true
      };

      await expect(Visitor.create(invalidData)).rejects.toThrow();
    });
  });
});