const { User } = require('../../server/models');
const bcrypt = require('bcryptjs');

describe('User Model', () => {
  describe('User Creation', () => {
    test('should create a user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'host'
      };

      const user = await User.create(userData);

      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.firstName).toBe(userData.firstName);
      expect(user.lastName).toBe(userData.lastName);
      expect(user.role).toBe(userData.role);
      expect(user.isActive).toBe(true);
      expect(user.mfaEnabled).toBe(false);
      expect(user.failedLoginAttempts).toBe(0);
    });

    test('should hash password on creation', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'host'
      };

      const user = await User.create(userData);

      expect(user.password).not.toBe(userData.password);
      expect(await bcrypt.compare(userData.password, user.password)).toBe(true);
    });

    test('should set lastPasswordChange on creation', async () => {
      const user = await global.testHelpers.createTestUser();
      
      expect(user.lastPasswordChange).toBeInstanceOf(Date);
      expect(user.lastPasswordChange.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should fail with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'host'
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    test('should fail with duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'host'
      };

      await User.create(userData);
      await expect(User.create(userData)).rejects.toThrow();
    });
  });

  describe('Password Validation', () => {
    test('should validate correct password', async () => {
      const password = 'password123';
      const user = await global.testHelpers.createTestUser({ password });

      const isValid = await user.validatePassword(password);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const user = await global.testHelpers.createTestUser({ password: 'password123' });

      const isValid = await user.validatePassword('wrongpassword');
      expect(isValid).toBe(false);
    });
  });

  describe('Account Locking', () => {
    test('should not be locked initially', async () => {
      const user = await global.testHelpers.createTestUser();
      expect(user.isLocked()).toBe(false);
    });

    test('should increment failed attempts', async () => {
      const user = await global.testHelpers.createTestUser();
      
      await user.incrementFailedAttempts();
      expect(user.failedLoginAttempts).toBe(1);
      expect(user.isLocked()).toBe(false);
    });

    test('should lock account after max attempts', async () => {
      const user = await global.testHelpers.createTestUser();
      
      // Increment to max attempts (5)
      for (let i = 0; i < 5; i++) {
        await user.incrementFailedAttempts();
      }
      
      expect(user.failedLoginAttempts).toBe(5);
      expect(user.isLocked()).toBe(true);
      expect(user.lockedUntil).toBeInstanceOf(Date);
    });

    test('should reset failed attempts on successful login', async () => {
      const user = await global.testHelpers.createTestUser();
      
      // Add some failed attempts
      user.failedLoginAttempts = 3;
      await user.save();
      
      await user.resetFailedAttempts();
      
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
      expect(user.lastLogin).toBeInstanceOf(Date);
    });
  });

  describe('Class Methods', () => {
    test('should find user by email', async () => {
      const email = 'test@example.com';
      const user = await global.testHelpers.createTestUser({ email });

      const foundUser = await User.findByEmail(email);
      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(user.id);
    });

    test('should find active users', async () => {
      await global.testHelpers.createTestUser({ isActive: true });
      await global.testHelpers.createTestUser({ isActive: false, email: 'inactive@example.com' });

      const activeUsers = await User.findActive();
      expect(activeUsers).toHaveLength(1);
      expect(activeUsers[0].isActive).toBe(true);
    });

    test('should find users by role', async () => {
      await global.testHelpers.createTestUser({ role: 'admin', email: 'admin@example.com' });
      await global.testHelpers.createTestUser({ role: 'host', email: 'host@example.com' });

      const adminUsers = await User.findByRole('admin');
      expect(adminUsers).toHaveLength(1);
      expect(adminUsers[0].role).toBe('admin');
    });
  });

  describe('JSON Serialization', () => {
    test('should exclude sensitive fields from JSON', async () => {
      const user = await global.testHelpers.createTestUser();
      const json = user.toJSON();

      expect(json.password).toBeUndefined();
      expect(json.mfaSecret).toBeUndefined();
      expect(json.passwordResetToken).toBeUndefined();
      expect(json.emailVerificationToken).toBeUndefined();
      expect(json.id).toBeDefined();
      expect(json.email).toBeDefined();
      expect(json.firstName).toBeDefined();
      expect(json.lastName).toBeDefined();
    });
  });

  describe('Password Update', () => {
    test('should hash new password on update', async () => {
      const user = await global.testHelpers.createTestUser({ password: 'oldpassword' });
      const oldPasswordHash = user.password;
      const oldPasswordChangeDate = user.lastPasswordChange;
      
      // Wait a bit to ensure timestamp difference
      await global.testHelpers.wait(100);
      
      user.password = 'newpassword';
      await user.save();
      
      expect(user.password).not.toBe('newpassword');
      expect(user.password).not.toBe(oldPasswordHash);
      expect(user.lastPasswordChange.getTime()).toBeGreaterThan(oldPasswordChangeDate.getTime());
      expect(await bcrypt.compare('newpassword', user.password)).toBe(true);
    });
  });

  describe('Default Values', () => {
    test('should set default preferences', async () => {
      const user = await global.testHelpers.createTestUser();
      
      expect(user.preferences).toBeDefined();
      expect(user.preferences.notifications).toBeDefined();
      expect(user.preferences.notifications.email).toBe(true);
      expect(user.preferences.notifications.sms).toBe(false);
      expect(user.preferences.notifications.push).toBe(true);
      expect(user.preferences.language).toBe('en');
      expect(user.preferences.timezone).toBe('UTC');
    });

    test('should set default role to host', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      });
      
      expect(user.role).toBe('host');
    });
  });
});