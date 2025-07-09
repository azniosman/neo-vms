const { sequelize } = require('../server/models');
const logger = require('../server/utils/logger');

// Mock logger to reduce noise in tests
jest.mock('../server/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  audit: jest.fn(),
  security: jest.fn(),
  performance: jest.fn(),
  database: jest.fn(),
  api: jest.fn()
}));

// Mock email service
jest.mock('../server/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  sendBulkEmails: jest.fn().mockResolvedValue([]),
  verifyEmailConfig: jest.fn().mockResolvedValue(true),
  sendTestEmail: jest.fn().mockResolvedValue(true)
}));

// Mock SMS service
jest.mock('../server/services/smsService', () => ({
  sendSMS: jest.fn().mockResolvedValue({ success: true, messageId: 'test-sms-id' }),
  sendBulkSMS: jest.fn().mockResolvedValue([]),
  verifySMSConfig: jest.fn().mockResolvedValue(true),
  sendTestSMS: jest.fn().mockResolvedValue(true)
}));

// Mock socket service
jest.mock('../server/services/socketService', () => ({
  sendNotificationToUser: jest.fn(),
  sendNotificationToRole: jest.fn(),
  initializeSocket: jest.fn(),
  getConnectionStats: jest.fn().mockReturnValue({ totalConnections: 0 }),
  isUserOnline: jest.fn().mockReturnValue(false)
}));

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.SESSION_SECRET = 'test-session-secret';
  process.env.CSRF_SECRET = 'test-csrf-secret';
  process.env.BCRYPT_ROUNDS = '4'; // Lower rounds for faster tests
  
  // Initialize test database
  await sequelize.sync({ force: true });
});

// Clean up after each test
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Clean up database
  const models = sequelize.models;
  for (const model of Object.values(models)) {
    await model.destroy({ where: {}, truncate: true });
  }
});

// Global test teardown
afterAll(async () => {
  await sequelize.close();
});

// Helper functions for tests
global.testHelpers = {
  // Create test user
  createTestUser: async (userData = {}) => {
    const { User } = require('../server/models');
    return await User.create({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'host',
      ...userData
    });
  },
  
  // Create test visitor
  createTestVisitor: async (visitorData = {}) => {
    const { Visitor } = require('../server/models');
    return await Visitor.create({
      email: 'visitor@example.com',
      firstName: 'Test',
      lastName: 'Visitor',
      company: 'Test Company',
      gdprConsent: true,
      gdprConsentDate: new Date(),
      ...visitorData
    });
  },
  
  // Create test visit
  createTestVisit: async (visitData = {}) => {
    const { Visit } = require('../server/models');
    const user = await global.testHelpers.createTestUser();
    const visitor = await global.testHelpers.createTestVisitor();
    
    return await Visit.create({
      visitorId: visitor.id,
      hostId: user.id,
      purpose: 'Test meeting',
      status: 'pre_registered',
      ...visitData
    });
  },
  
  // Generate test JWT token
  generateTestToken: (user) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },
  
  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};