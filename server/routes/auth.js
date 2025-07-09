const express = require('express');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { User, AuditLog } = require('../models');
const { 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken, 
  authenticateToken,
  authRateLimit 
} = require('../middleware/auth');
const logger = require('../utils/logger');
const { sendEmail } = require('../services/emailService');
const { createAuditLog } = require('../services/auditService');

const router = express.Router();

// Apply rate limiting to auth routes
router.use(authRateLimit);

// Validation middleware
const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
];

const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('firstName').isLength({ min: 1, max: 100 }).trim(),
  body('lastName').isLength({ min: 1, max: 100 }).trim(),
  body('role').isIn(['admin', 'receptionist', 'host', 'security']).optional()
];

const forgotPasswordValidation = [
  body('email').isEmail().normalizeEmail()
];

const resetPasswordValidation = [
  body('token').isLength({ min: 1 }),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
];

// Login endpoint
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0].msg
      });
    }

    const { email, password, mfaToken } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      await createAuditLog({
        action: 'LOGIN_FAILED',
        details: { email, reason: 'User not found' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      await createAuditLog({
        action: 'LOGIN_FAILED',
        details: { email, reason: 'Account locked' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        userId: user.id
      });
      
      return res.status(401).json({
        error: 'Account locked',
        message: 'Account is temporarily locked due to failed login attempts'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      await createAuditLog({
        action: 'LOGIN_FAILED',
        details: { email, reason: 'Account disabled' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        userId: user.id
      });
      
      return res.status(401).json({
        error: 'Account disabled',
        message: 'User account is disabled'
      });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      await user.incrementFailedAttempts();
      
      await createAuditLog({
        action: 'LOGIN_FAILED',
        details: { email, reason: 'Invalid password' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        userId: user.id
      });
      
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Check MFA if enabled
    if (user.mfaEnabled) {
      if (!mfaToken) {
        return res.status(200).json({
          mfaRequired: true,
          message: 'MFA token required'
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: mfaToken,
        window: 2
      });

      if (!verified) {
        await createAuditLog({
          action: 'LOGIN_FAILED',
          details: { email, reason: 'Invalid MFA token' },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          userId: user.id
        });
        
        return res.status(401).json({
          error: 'Invalid MFA token',
          message: 'Multi-factor authentication failed'
        });
      }
    }

    // Reset failed attempts on successful login
    await user.resetFailedAttempts();

    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    await createAuditLog({
      action: 'LOGIN_SUCCESS',
      details: { email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      userId: user.id
    });

    res.json({
      user: user.toJSON(),
      accessToken,
      message: 'Login successful'
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error'
    });
  }
});

// Register endpoint (admin only in production)
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0].msg
      });
    }

    const { email, password, firstName, lastName, role = 'host', phone, department } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'Email address is already registered'
      });
    }

    // Create new user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role,
      phone,
      department,
      emailVerificationToken: uuidv4()
    });

    // Send verification email
    if (process.env.NODE_ENV === 'production') {
      await sendEmail({
        to: email,
        subject: 'Welcome to Neo VMS - Please verify your email',
        template: 'welcome',
        data: {
          firstName,
          verificationToken: user.emailVerificationToken
        }
      });
    }

    await createAuditLog({
      action: 'USER_REGISTERED',
      details: { email, role },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      userId: user.id
    });

    res.status(201).json({
      user: user.toJSON(),
      message: 'User registered successfully'
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error'
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required',
        message: 'No refresh token provided'
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findByPk(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'User not found or inactive'
      });
    }

    // Generate new access token
    const accessToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Set new refresh token
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      accessToken,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Token refresh failed',
      message: 'Invalid refresh token'
    });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    await createAuditLog({
      action: 'LOGOUT',
      details: { email: req.user.email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user.id
    });

    res.json({ message: 'Logout successful' });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'Internal server error'
    });
  }
});

// Forgot password endpoint
router.post('/forgot-password', forgotPasswordValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0].msg
      });
    }

    const { email } = req.body;
    const user = await User.findByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        message: 'If the email exists, a password reset link has been sent'
      });
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpiry;
    await user.save();

    // Send password reset email
    await sendEmail({
      to: email,
      subject: 'Password Reset - Neo VMS',
      template: 'password-reset',
      data: {
        firstName: user.firstName,
        resetToken,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      }
    });

    await createAuditLog({
      action: 'PASSWORD_RESET_REQUESTED',
      details: { email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      userId: user.id
    });

    res.json({
      message: 'If the email exists, a password reset link has been sent'
    });

  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: 'Internal server error'
    });
  }
});

// Reset password endpoint
router.post('/reset-password', resetPasswordValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0].msg
      });
    }

    const { token, password } = req.body;

    const user = await User.findOne({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          [User.sequelize.Sequelize.Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired token',
        message: 'Password reset token is invalid or expired'
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    await createAuditLog({
      action: 'PASSWORD_RESET_SUCCESS',
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      userId: user.id
    });

    res.json({
      message: 'Password reset successful'
    });

  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: 'Internal server error'
    });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: req.user.toJSON()
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      error: 'Failed to get user',
      message: 'Internal server error'
    });
  }
});

// Setup MFA
router.post('/setup-mfa', authenticateToken, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Neo VMS (${req.user.email})`,
      issuer: 'Neo VMS'
    });

    // Store secret temporarily (will be confirmed when user verifies)
    req.user.mfaSecret = secret.base32;
    await req.user.save();

    res.json({
      secret: secret.base32,
      qrCode: secret.otpauth_url,
      message: 'MFA setup initiated'
    });

  } catch (error) {
    logger.error('MFA setup error:', error);
    res.status(500).json({
      error: 'MFA setup failed',
      message: 'Internal server error'
    });
  }
});

// Verify MFA setup
router.post('/verify-mfa', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'MFA token required',
        message: 'No MFA token provided'
      });
    }

    const verified = speakeasy.totp.verify({
      secret: req.user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({
        error: 'Invalid MFA token',
        message: 'MFA token verification failed'
      });
    }

    // Enable MFA
    req.user.mfaEnabled = true;
    await req.user.save();

    await createAuditLog({
      action: 'MFA_ENABLED',
      details: { email: req.user.email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user.id
    });

    res.json({
      message: 'MFA enabled successfully'
    });

  } catch (error) {
    logger.error('MFA verification error:', error);
    res.status(500).json({
      error: 'MFA verification failed',
      message: 'Internal server error'
    });
  }
});

// Disable MFA
router.post('/disable-mfa', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Password required',
        message: 'Password is required to disable MFA'
      });
    }

    const isValidPassword = await req.user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid password',
        message: 'Password is incorrect'
      });
    }

    // Disable MFA
    req.user.mfaEnabled = false;
    req.user.mfaSecret = null;
    await req.user.save();

    await createAuditLog({
      action: 'MFA_DISABLED',
      details: { email: req.user.email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user.id
    });

    res.json({
      message: 'MFA disabled successfully'
    });

  } catch (error) {
    logger.error('MFA disable error:', error);
    res.status(500).json({
      error: 'MFA disable failed',
      message: 'Internal server error'
    });
  }
});

module.exports = router;