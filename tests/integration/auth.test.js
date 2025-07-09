const request = require('supertest');
const express = require('express');
const { User } = require('../../server/models');
const authRoutes = require('../../server/routes/auth');
const { setupCSRF } = require('../../server/middleware/csrf');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Skip CSRF for tests
  app.use((req, res, next) => {
    req.csrfToken = () => 'test-csrf-token';
    next();
  });
  
  app.use('/api/auth', authRoutes);
  return app;
};

describe('Auth API Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const user = await global.testHelpers.createTestUser({
        email: 'test@example.com',
        password: 'password123'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(user.id);
      expect(response.body.user.email).toBe(user.email);
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.message).toBe('Login successful');
    });

    test('should reject invalid credentials', async () => {
      await global.testHelpers.createTestUser({
        email: 'test@example.com',
        password: 'password123'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should reject inactive user', async () => {
      await global.testHelpers.createTestUser({
        email: 'inactive@example.com',
        password: 'password123',
        isActive: false
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Account disabled');
    });

    test('should reject locked user', async () => {
      const user = await global.testHelpers.createTestUser({
        email: 'locked@example.com',
        password: 'password123',
        lockedUntil: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'locked@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Account locked');
    });

    test('should require MFA when enabled', async () => {
      await global.testHelpers.createTestUser({
        email: 'mfa@example.com',
        password: 'password123',
        mfaEnabled: true,
        mfaSecret: 'test-secret'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'mfa@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.mfaRequired).toBe(true);
      expect(response.body.accessToken).toBeUndefined();
    });

    test('should validate input data', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: '123' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should increment failed attempts on wrong password', async () => {
      const user = await global.testHelpers.createTestUser({
        email: 'test@example.com',
        password: 'password123'
      });

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      await user.reload();
      expect(user.failedLoginAttempts).toBe(1);
    });

    test('should reset failed attempts on successful login', async () => {
      const user = await global.testHelpers.createTestUser({
        email: 'test@example.com',
        password: 'password123',
        failedLoginAttempts: 3
      });

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      await user.reload();
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lastLogin).toBeInstanceOf(Date);
    });
  });

  describe('POST /api/auth/register', () => {
    test('should register new user with valid data', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'host'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.firstName).toBe(userData.firstName);
      expect(response.body.user.lastName).toBe(userData.lastName);
      expect(response.body.user.role).toBe(userData.role);
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.message).toBe('User registered successfully');
    });

    test('should default to host role if not specified', async () => {
      const userData = {
        email: 'defaultrole@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('host');
    });

    test('should reject duplicate email', async () => {
      await global.testHelpers.createTestUser({
        email: 'duplicate@example.com'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('User already exists');
    });

    test('should validate input data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: '123', // Too short
          firstName: '', // Empty
          lastName: 'Doe'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should reject invalid role', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'invalid_role'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout authenticated user', async () => {
      const user = await global.testHelpers.createTestUser();
      const token = global.testHelpers.generateTestToken(user);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout successful');
    });

    test('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return current user info', async () => {
      const user = await global.testHelpers.createTestUser();
      const token = global.testHelpers.generateTestToken(user);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(user.id);
      expect(response.body.user.email).toBe(user.email);
      expect(response.body.user.password).toBeUndefined();
    });

    test('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    test('should process password reset request', async () => {
      const user = await global.testHelpers.createTestUser({
        email: 'forgot@example.com'
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'forgot@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('If the email exists, a password reset link has been sent');

      // Check if reset token was set
      await user.reload();
      expect(user.passwordResetToken).toBeDefined();
      expect(user.passwordResetExpires).toBeInstanceOf(Date);
    });

    test('should return same message for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('If the email exists, a password reset link has been sent');
    });

    test('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    test('should reset password with valid token', async () => {
      const user = await global.testHelpers.createTestUser({
        passwordResetToken: 'valid-token',
        passwordResetExpires: new Date(Date.now() + 3600000) // 1 hour from now
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
          password: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password reset successful');

      // Check if token was cleared
      await user.reload();
      expect(user.passwordResetToken).toBeNull();
      expect(user.passwordResetExpires).toBeNull();
      expect(user.failedLoginAttempts).toBe(0);
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'newpassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    test('should reject expired token', async () => {
      await global.testHelpers.createTestUser({
        passwordResetToken: 'expired-token',
        passwordResetExpires: new Date(Date.now() - 3600000) // 1 hour ago
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'expired-token',
          password: 'newpassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    test('should validate new password', async () => {
      const user = await global.testHelpers.createTestUser({
        passwordResetToken: 'valid-token',
        passwordResetExpires: new Date(Date.now() + 3600000)
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
          password: '123' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Mock database error
      const originalFindOne = User.findOne;
      User.findOne = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Login failed');

      // Restore original method
      User.findOne = originalFindOne;
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    test('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send();

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });
});