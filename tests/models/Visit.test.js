const { Visit } = require('../../server/models');

describe('Visit Model', () => {
  describe('Visit Creation', () => {
    test('should create a visit with valid data', async () => {
      const user = await global.testHelpers.createTestUser();
      const visitor = await global.testHelpers.createTestVisitor();
      
      const visitData = {
        visitorId: visitor.id,
        hostId: user.id,
        purpose: 'Business meeting',
        expectedDuration: 60,
        location: 'Conference Room A',
        floor: '2nd',
        room: 'A-201'
      };

      const visit = await Visit.create(visitData);

      expect(visit.id).toBeDefined();
      expect(visit.visitorId).toBe(visitor.id);
      expect(visit.hostId).toBe(user.id);
      expect(visit.purpose).toBe(visitData.purpose);
      expect(visit.expectedDuration).toBe(visitData.expectedDuration);
      expect(visit.location).toBe(visitData.location);
      expect(visit.floor).toBe(visitData.floor);
      expect(visit.room).toBe(visitData.room);
      expect(visit.status).toBe('pre_registered');
      expect(visit.emergencyEvacuated).toBe(false);
      expect(visit.badgePrinted).toBe(false);
      expect(visit.hostNotified).toBe(false);
      expect(visit.hostConfirmed).toBe(false);
      expect(visit.securityApproved).toBe(false);
    });

    test('should set default status to pre_registered', async () => {
      const visit = await global.testHelpers.createTestVisit();
      expect(visit.status).toBe('pre_registered');
    });

    test('should calculate expected checkout on save', async () => {
      const visit = await global.testHelpers.createTestVisit({
        expectedDuration: 60,
        checkedInAt: new Date()
      });

      expect(visit.expectedCheckout).toBeInstanceOf(Date);
      expect(visit.expectedCheckout.getTime()).toBeGreaterThan(visit.checkedInAt.getTime());
    });
  });

  describe('Instance Methods', () => {
    test('should check if visit is active', async () => {
      const activeVisit = await global.testHelpers.createTestVisit({
        status: 'checked_in'
      });
      
      const inactiveVisit = await global.testHelpers.createTestVisit({
        status: 'pre_registered'
      });

      expect(activeVisit.isActive()).toBe(true);
      expect(inactiveVisit.isActive()).toBe(false);
    });

    test('should check if visit is overdue', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      const overdueVisit = await global.testHelpers.createTestVisit({
        status: 'checked_in',
        expectedCheckout: pastDate
      });
      
      const onTimeVisit = await global.testHelpers.createTestVisit({
        status: 'checked_in',
        expectedCheckout: futureDate
      });

      expect(overdueVisit.isOverdue()).toBe(true);
      expect(onTimeVisit.isOverdue()).toBe(false);
    });

    test('should check if QR code is expired', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      const expiredVisit = await global.testHelpers.createTestVisit({
        qrCodeExpiry: pastDate
      });
      
      const validVisit = await global.testHelpers.createTestVisit({
        qrCodeExpiry: futureDate
      });

      expect(expiredVisit.isExpired()).toBe(true);
      expect(validVisit.isExpired()).toBe(false);
    });

    test('should calculate duration in minutes', async () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const activeVisit = await global.testHelpers.createTestVisit({
        status: 'checked_in',
        checkedInAt: hourAgo
      });
      
      const completedVisit = await global.testHelpers.createTestVisit({
        status: 'checked_out',
        actualDuration: 90
      });

      expect(activeVisit.getDurationInMinutes()).toBeCloseTo(60, 0);
      expect(completedVisit.getDurationInMinutes()).toBe(90);
    });

    test('should check in visitor', async () => {
      const visit = await global.testHelpers.createTestVisit();
      const user = await global.testHelpers.createTestUser();
      
      await visit.checkIn(user.id);
      
      expect(visit.status).toBe('checked_in');
      expect(visit.checkedInAt).toBeInstanceOf(Date);
      expect(visit.checkedInBy).toBe(user.id);
      expect(visit.expectedCheckout).toBeInstanceOf(Date);
    });

    test('should check out visitor', async () => {
      const visit = await global.testHelpers.createTestVisit({
        status: 'checked_in',
        checkedInAt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      });
      const user = await global.testHelpers.createTestUser();
      
      await visit.checkOut(user.id);
      
      expect(visit.status).toBe('checked_out');
      expect(visit.checkedOutAt).toBeInstanceOf(Date);
      expect(visit.checkedOutBy).toBe(user.id);
      expect(visit.actualDuration).toBeCloseTo(60, 0);
    });

    test('should mark as evacuated', async () => {
      const visit = await global.testHelpers.createTestVisit({
        status: 'checked_in'
      });
      
      const evacuationData = {
        evacuationReason: 'Fire alarm',
        evacuationLocation: 'Assembly point A',
        evacuatedBy: 'security-user-id'
      };
      
      await visit.markEvacuated(evacuationData);
      
      expect(visit.emergencyEvacuated).toBe(true);
      expect(visit.evacuation).toBeDefined();
      expect(visit.evacuation.evacuationReason).toBe(evacuationData.evacuationReason);
      expect(visit.evacuation.evacuatedAt).toBeInstanceOf(Date);
    });

    test('should add notification', async () => {
      const visit = await global.testHelpers.createTestVisit();
      
      await visit.addNotification('host_notified', {
        method: 'email',
        recipient: 'host@example.com'
      });
      
      expect(visit.notificationsSent).toHaveLength(1);
      expect(visit.notificationsSent[0].type).toBe('host_notified');
      expect(visit.notificationsSent[0].sentAt).toBeInstanceOf(Date);
    });
  });

  describe('Class Methods', () => {
    test('should find active visits', async () => {
      await global.testHelpers.createTestVisit({ status: 'checked_in' });
      await global.testHelpers.createTestVisit({ status: 'checked_out' });

      const activeVisits = await Visit.findActive();
      expect(activeVisits).toHaveLength(1);
      expect(activeVisits[0].status).toBe('checked_in');
    });

    test('should find visits by visitor', async () => {
      const visitor = await global.testHelpers.createTestVisitor();
      const anotherVisitor = await global.testHelpers.createTestVisitor({ 
        email: 'another@example.com' 
      });
      
      await global.testHelpers.createTestVisit({ visitorId: visitor.id });
      await global.testHelpers.createTestVisit({ visitorId: anotherVisitor.id });

      const visitorVisits = await Visit.findByVisitor(visitor.id);
      expect(visitorVisits).toHaveLength(1);
      expect(visitorVisits[0].visitorId).toBe(visitor.id);
    });

    test('should find visits by host', async () => {
      const host = await global.testHelpers.createTestUser();
      const anotherHost = await global.testHelpers.createTestUser({ 
        email: 'another@example.com' 
      });
      
      await global.testHelpers.createTestVisit({ hostId: host.id });
      await global.testHelpers.createTestVisit({ hostId: anotherHost.id });

      const hostVisits = await Visit.findByHost(host.id);
      expect(hostVisits).toHaveLength(1);
      expect(hostVisits[0].hostId).toBe(host.id);
    });

    test('should find visits by status', async () => {
      await global.testHelpers.createTestVisit({ status: 'checked_in' });
      await global.testHelpers.createTestVisit({ status: 'checked_out' });

      const checkedInVisits = await Visit.findByStatus('checked_in');
      expect(checkedInVisits).toHaveLength(1);
      expect(checkedInVisits[0].status).toBe('checked_in');
    });

    test('should find overdue visits', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      
      await global.testHelpers.createTestVisit({
        status: 'checked_in',
        expectedCheckout: pastDate
      });
      
      await global.testHelpers.createTestVisit({
        status: 'checked_in',
        expectedCheckout: futureDate
      });

      const overdueVisits = await Visit.findOverdue();
      expect(overdueVisits).toHaveLength(1);
      expect(overdueVisits[0].isOverdue()).toBe(true);
    });

    test('should find visits by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await global.testHelpers.createTestVisit({
        checkedInAt: new Date()
      });
      
      await global.testHelpers.createTestVisit({
        checkedInAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      });

      const recentVisits = await Visit.findByDateRange(yesterday, tomorrow);
      expect(recentVisits).toHaveLength(1);
    });

    test('should find today visits', async () => {
      const today = new Date();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      await global.testHelpers.createTestVisit({
        checkedInAt: today
      });
      
      await global.testHelpers.createTestVisit({
        checkedInAt: yesterday
      });

      const todayVisits = await Visit.findTodayVisits();
      expect(todayVisits).toHaveLength(1);
    });

    test('should find current occupancy', async () => {
      await global.testHelpers.createTestVisit({ status: 'checked_in' });
      await global.testHelpers.createTestVisit({ status: 'checked_in' });
      await global.testHelpers.createTestVisit({ status: 'checked_out' });

      const occupancy = await Visit.findCurrentOccupancy();
      expect(occupancy).toBe(2);
    });

    test('should find evacuation list', async () => {
      await global.testHelpers.createTestVisit({
        status: 'checked_in',
        emergencyEvacuated: false
      });
      
      await global.testHelpers.createTestVisit({
        status: 'checked_in',
        emergencyEvacuated: true
      });
      
      await global.testHelpers.createTestVisit({
        status: 'checked_out',
        emergencyEvacuated: false
      });

      const evacuationList = await Visit.findEvacuationList();
      expect(evacuationList).toHaveLength(1);
      expect(evacuationList[0].status).toBe('checked_in');
      expect(evacuationList[0].emergencyEvacuated).toBe(false);
    });
  });

  describe('Hooks', () => {
    test('should calculate actual duration on save', async () => {
      const visit = await global.testHelpers.createTestVisit({
        checkedInAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        checkedOutAt: new Date()
      });

      expect(visit.actualDuration).toBeCloseTo(60, 0);
    });

    test('should set expected checkout on save', async () => {
      const visit = await global.testHelpers.createTestVisit({
        checkedInAt: new Date(),
        expectedDuration: 120
      });

      expect(visit.expectedCheckout).toBeInstanceOf(Date);
      expect(visit.expectedCheckout.getTime()).toBeGreaterThan(visit.checkedInAt.getTime());
    });
  });

  describe('Validation', () => {
    test('should require visitor ID', async () => {
      const user = await global.testHelpers.createTestUser();
      
      await expect(Visit.create({
        hostId: user.id,
        purpose: 'Test meeting'
      })).rejects.toThrow();
    });

    test('should require host ID', async () => {
      const visitor = await global.testHelpers.createTestVisitor();
      
      await expect(Visit.create({
        visitorId: visitor.id,
        purpose: 'Test meeting'
      })).rejects.toThrow();
    });

    test('should require purpose', async () => {
      const user = await global.testHelpers.createTestUser();
      const visitor = await global.testHelpers.createTestVisitor();
      
      await expect(Visit.create({
        visitorId: visitor.id,
        hostId: user.id
      })).rejects.toThrow();
    });

    test('should validate status enum', async () => {
      const visit = await global.testHelpers.createTestVisit();
      
      await expect(visit.update({
        status: 'invalid_status'
      })).rejects.toThrow();
    });
  });
});