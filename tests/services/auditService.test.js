const { createAuditLog, getAuditLogs, getAuditStatistics } = require('../../server/services/auditService');
const { AuditLog, User, Visitor } = require('../../server/models');

describe('Audit Service', () => {
  describe('createAuditLog', () => {
    test('should create audit log with required fields', async () => {
      const user = await global.testHelpers.createTestUser();
      
      const auditData = {
        userId: user.id,
        action: 'USER_LOGIN',
        resource: 'user',
        resourceId: user.id,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        category: 'authentication',
        outcome: 'success'
      };

      const auditLog = await createAuditLog(auditData);

      expect(auditLog.id).toBeDefined();
      expect(auditLog.userId).toBe(user.id);
      expect(auditLog.action).toBe('USER_LOGIN');
      expect(auditLog.resource).toBe('user');
      expect(auditLog.resourceId).toBe(user.id);
      expect(auditLog.ipAddress).toBe('127.0.0.1');
      expect(auditLog.userAgent).toBe('Test Agent');
      expect(auditLog.category).toBe('authentication');
      expect(auditLog.outcome).toBe('success');
      expect(auditLog.severity).toBe('medium');
      expect(auditLog.riskLevel).toBe('low');
    });

    test('should create audit log with optional fields', async () => {
      const user = await global.testHelpers.createTestUser();
      
      const auditData = {
        userId: user.id,
        action: 'DATA_MODIFIED',
        details: { field: 'email', oldValue: 'old@example.com', newValue: 'new@example.com' },
        oldValues: { email: 'old@example.com' },
        newValues: { email: 'new@example.com' },
        severity: 'high',
        riskLevel: 'high',
        complianceFlags: ['GDPR', 'PDPA'],
        tags: ['email_change', 'user_data']
      };

      const auditLog = await createAuditLog(auditData);

      expect(auditLog.details).toEqual(auditData.details);
      expect(auditLog.oldValues).toEqual(auditData.oldValues);
      expect(auditLog.newValues).toEqual(auditData.newValues);
      expect(auditLog.severity).toBe('high');
      expect(auditLog.riskLevel).toBe('high');
      expect(auditLog.complianceFlags).toEqual(['GDPR', 'PDPA']);
      expect(auditLog.tags).toEqual(['email_change', 'user_data']);
    });

    test('should set retention date automatically', async () => {
      const user = await global.testHelpers.createTestUser();
      
      const auditData = {
        userId: user.id,
        action: 'USER_LOGIN',
        category: 'authentication'
      };

      const auditLog = await createAuditLog(auditData);

      expect(auditLog.retentionDate).toBeInstanceOf(Date);
      expect(auditLog.retentionDate.getTime()).toBeGreaterThan(Date.now());
    });

    test('should create audit log without user', async () => {
      const auditData = {
        action: 'SYSTEM_STARTUP',
        category: 'system_access',
        details: { version: '1.0.0' }
      };

      const auditLog = await createAuditLog(auditData);

      expect(auditLog.userId).toBeNull();
      expect(auditLog.action).toBe('SYSTEM_STARTUP');
      expect(auditLog.category).toBe('system_access');
    });
  });

  describe('getAuditLogs', () => {
    beforeEach(async () => {
      const user = await global.testHelpers.createTestUser();
      const visitor = await global.testHelpers.createTestVisitor();
      
      // Create multiple audit logs for testing
      await createAuditLog({
        userId: user.id,
        action: 'USER_LOGIN',
        category: 'authentication',
        outcome: 'success'
      });
      
      await createAuditLog({
        userId: user.id,
        visitorId: visitor.id,
        action: 'VISITOR_CREATED',
        category: 'data_modification',
        outcome: 'success'
      });
      
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        category: 'authentication',
        outcome: 'failure'
      });
    });

    test('should get all audit logs with pagination', async () => {
      const result = await getAuditLogs({
        page: 1,
        limit: 10
      });

      expect(result.auditLogs).toHaveLength(3);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.totalPages).toBe(1);
    });

    test('should filter by userId', async () => {
      const user = await global.testHelpers.createTestUser({ email: 'filter@example.com' });
      
      await createAuditLog({
        userId: user.id,
        action: 'USER_UPDATE',
        category: 'data_modification'
      });

      const result = await getAuditLogs({ userId: user.id });

      expect(result.auditLogs).toHaveLength(1);
      expect(result.auditLogs[0].userId).toBe(user.id);
    });

    test('should filter by action', async () => {
      const result = await getAuditLogs({ action: 'USER_LOGIN' });

      expect(result.auditLogs).toHaveLength(1);
      expect(result.auditLogs[0].action).toBe('USER_LOGIN');
    });

    test('should filter by category', async () => {
      const result = await getAuditLogs({ category: 'authentication' });

      expect(result.auditLogs).toHaveLength(2);
      result.auditLogs.forEach(log => {
        expect(log.category).toBe('authentication');
      });
    });

    test('should filter by outcome', async () => {
      const result = await getAuditLogs({ outcome: 'failure' });

      expect(result.auditLogs).toHaveLength(1);
      expect(result.auditLogs[0].outcome).toBe('failure');
    });

    test('should filter by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const result = await getAuditLogs({
        startDate: yesterday,
        endDate: tomorrow
      });

      expect(result.auditLogs).toHaveLength(3);
    });

    test('should order by specified field', async () => {
      const result = await getAuditLogs({
        orderBy: 'action',
        orderDirection: 'ASC'
      });

      expect(result.auditLogs[0].action).toBe('LOGIN_FAILED');
      expect(result.auditLogs[1].action).toBe('USER_LOGIN');
      expect(result.auditLogs[2].action).toBe('VISITOR_CREATED');
    });

    test('should handle pagination correctly', async () => {
      const result = await getAuditLogs({
        page: 2,
        limit: 2
      });

      expect(result.auditLogs).toHaveLength(1);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.totalPages).toBe(2);
    });
  });

  describe('getAuditStatistics', () => {
    beforeEach(async () => {
      const user = await global.testHelpers.createTestUser();
      
      // Create various audit logs for statistics
      await createAuditLog({
        userId: user.id,
        action: 'USER_LOGIN',
        category: 'authentication',
        severity: 'medium',
        outcome: 'success',
        riskLevel: 'low'
      });
      
      await createAuditLog({
        userId: user.id,
        action: 'USER_LOGIN',
        category: 'authentication',
        severity: 'medium',
        outcome: 'success',
        riskLevel: 'low'
      });
      
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        category: 'authentication',
        severity: 'high',
        outcome: 'failure',
        riskLevel: 'high'
      });
      
      await createAuditLog({
        userId: user.id,
        action: 'DATA_MODIFIED',
        category: 'data_modification',
        severity: 'medium',
        outcome: 'success',
        riskLevel: 'medium'
      });
    });

    test('should return comprehensive statistics', async () => {
      const stats = await getAuditStatistics();

      expect(stats.totalLogs).toBe(4);
      expect(stats.categoryStats).toHaveLength(2);
      expect(stats.severityStats).toHaveLength(2);
      expect(stats.outcomeStats).toHaveLength(2);
      expect(stats.riskLevelStats).toHaveLength(3);
      expect(stats.topActions).toHaveLength(3);
      expect(stats.topUsers).toHaveLength(1);
    });

    test('should filter statistics by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const stats = await getAuditStatistics(yesterday, tomorrow);

      expect(stats.totalLogs).toBe(4);
    });

    test('should return category statistics', async () => {
      const stats = await getAuditStatistics();

      const authStats = stats.categoryStats.find(s => s.category === 'authentication');
      const dataStats = stats.categoryStats.find(s => s.category === 'data_modification');

      expect(authStats.count).toBe('3');
      expect(dataStats.count).toBe('1');
    });

    test('should return severity statistics', async () => {
      const stats = await getAuditStatistics();

      const mediumStats = stats.severityStats.find(s => s.severity === 'medium');
      const highStats = stats.severityStats.find(s => s.severity === 'high');

      expect(mediumStats.count).toBe('3');
      expect(highStats.count).toBe('1');
    });

    test('should return outcome statistics', async () => {
      const stats = await getAuditStatistics();

      const successStats = stats.outcomeStats.find(s => s.outcome === 'success');
      const failureStats = stats.outcomeStats.find(s => s.outcome === 'failure');

      expect(successStats.count).toBe('3');
      expect(failureStats.count).toBe('1');
    });

    test('should return top actions', async () => {
      const stats = await getAuditStatistics();

      const topAction = stats.topActions[0];
      expect(topAction.action).toBe('USER_LOGIN');
      expect(topAction.count).toBe('2');
    });

    test('should return recent high risk events', async () => {
      const stats = await getAuditStatistics();

      expect(stats.recentHighRisk).toHaveLength(1);
      expect(stats.recentHighRisk[0].riskLevel).toBe('high');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing required fields', async () => {
      await expect(createAuditLog({})).rejects.toThrow();
    });

    test('should handle invalid userId', async () => {
      const auditData = {
        userId: 'invalid-id',
        action: 'USER_LOGIN',
        category: 'authentication'
      };

      await expect(createAuditLog(auditData)).rejects.toThrow();
    });

    test('should handle database errors gracefully', async () => {
      // Mock database error
      const originalCreate = AuditLog.create;
      AuditLog.create = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(createAuditLog({
        action: 'TEST_ACTION',
        category: 'test'
      })).rejects.toThrow('Database error');

      // Restore original method
      AuditLog.create = originalCreate;
    });
  });
});