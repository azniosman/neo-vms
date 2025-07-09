const emailService = require('../../server/services/emailService');
const nodemailer = require('nodemailer');
const logger = require('../../server/utils/logger');

// Mock dependencies
jest.mock('nodemailer');
jest.mock('../../server/utils/logger');
jest.mock('qrcode');

describe('Email Service', () => {
  let mockTransporter;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock transporter
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn()
    };
    
    nodemailer.createTransporter = jest.fn(() => mockTransporter);
    
    // Mock environment variables
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASSWORD = 'password';
    process.env.SMTP_FROM = 'Neo VMS <noreply@neo-vms.local>';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_FROM;
  });

  describe('sendEmail', () => {
    it('should send email with subject and html', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>'
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      const result = await emailService.sendEmail(emailData);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        from: 'Neo VMS <noreply@neo-vms.local>',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>'
      }));
      expect(result.messageId).toBe('test-message-id');
      expect(logger.info).toHaveBeenCalledWith('Email sent successfully', expect.any(Object));
    });

    it('should send email with template', async () => {
      const emailData = {
        to: 'test@example.com',
        template: 'welcome',
        data: {
          firstName: 'John',
          verificationUrl: 'http://example.com/verify'
        }
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      await emailService.sendEmail(emailData);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'test@example.com',
        subject: 'Welcome to Neo VMS',
        html: expect.stringContaining('John')
      }));
    });

    it('should handle multiple recipients', async () => {
      const emailData = {
        to: ['test1@example.com', 'test2@example.com'],
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>'
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      await emailService.sendEmail(emailData);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'test1@example.com, test2@example.com'
      }));
    });

    it('should handle attachments', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>',
        attachments: [
          {
            filename: 'test.pdf',
            path: '/path/to/test.pdf'
          }
        ]
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      await emailService.sendEmail(emailData);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        attachments: emailData.attachments
      }));
    });

    it('should handle email sending errors', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>'
      };

      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(emailService.sendEmail(emailData)).rejects.toThrow('SMTP error');
      expect(logger.error).toHaveBeenCalledWith('Failed to send email:', expect.any(Object));
    });

    it('should throw error for invalid template', async () => {
      const emailData = {
        to: 'test@example.com',
        template: 'invalid-template',
        data: {}
      };

      await expect(emailService.sendEmail(emailData)).rejects.toThrow('Email template \'invalid-template\' not found');
    });
  });

  describe('sendBulkEmails', () => {
    it('should send multiple emails', async () => {
      const emails = [
        {
          to: 'test1@example.com',
          subject: 'Test 1',
          html: '<h1>Test 1</h1>'
        },
        {
          to: 'test2@example.com',
          subject: 'Test 2',
          html: '<h1>Test 2</h1>'
        }
      ];

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      const results = await emailService.sendBulkEmails(emails);

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle partial failures in bulk send', async () => {
      const emails = [
        {
          to: 'test1@example.com',
          subject: 'Test 1',
          html: '<h1>Test 1</h1>'
        },
        {
          to: 'test2@example.com',
          subject: 'Test 2',
          html: '<h1>Test 2</h1>'
        }
      ];

      mockTransporter.sendMail
        .mockResolvedValueOnce({ messageId: 'test-message-id' })
        .mockRejectedValueOnce(new Error('SMTP error'));

      const results = await emailService.sendBulkEmails(emails);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('SMTP error');
    });
  });

  describe('verifyEmailConfig', () => {
    it('should verify email configuration successfully', async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const result = await emailService.verifyEmailConfig();

      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Email configuration verified successfully');
    });

    it('should handle verification failure', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Verification failed'));

      const result = await emailService.verifyEmailConfig();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Email configuration verification failed:', expect.any(Error));
    });
  });

  describe('sendTestEmail', () => {
    it('should send test email successfully', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      const result = await emailService.sendTestEmail('test@example.com');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'test@example.com',
        subject: 'Test Email from Neo VMS'
      }));
      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Test email sent successfully', { to: 'test@example.com' });
    });

    it('should handle test email failure', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('Test email failed'));

      const result = await emailService.sendTestEmail('test@example.com');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Failed to send test email:', expect.any(Error));
    });
  });

  describe('sendVisitorPreRegistrationEmail', () => {
    it('should send visitor pre-registration email with QR code', async () => {
      const mockQRCode = require('qrcode');
      mockQRCode.toBuffer = jest.fn().mockResolvedValue(Buffer.from('qr-code-data'));

      const visit = {
        purpose: 'Business Meeting',
        scheduledArrival: '2024-01-15T10:00:00Z',
        location: 'Conference Room A'
      };

      const visitor = {
        email: 'visitor@example.com',
        getFullName: jest.fn().mockReturnValue('John Doe')
      };

      const host = {
        getFullName: jest.fn().mockReturnValue('Jane Smith'),
        department: 'Engineering'
      };

      const qrCode = 'qr-code-data';

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      await emailService.sendVisitorPreRegistrationEmail(visit, visitor, host, qrCode);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'visitor@example.com',
        subject: expect.stringContaining('Pre-Registration Confirmation'),
        html: expect.stringContaining('John Doe'),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: 'qr-code.png',
            cid: 'qrcode'
          })
        ])
      }));
    });

    it('should handle pre-registration email errors', async () => {
      const mockQRCode = require('qrcode');
      mockQRCode.toBuffer = jest.fn().mockRejectedValue(new Error('QR code generation failed'));

      const visit = {};
      const visitor = { email: 'visitor@example.com' };
      const host = {};
      const qrCode = 'qr-code-data';

      await expect(emailService.sendVisitorPreRegistrationEmail(visit, visitor, host, qrCode))
        .rejects.toThrow('QR code generation failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to send visitor pre-registration email:', expect.any(Error));
    });
  });

  describe('sendDailySummaryEmail', () => {
    it('should send daily summary emails to users', async () => {
      const users = [
        { email: 'user1@example.com', firstName: 'John' },
        { email: 'user2@example.com', firstName: 'Jane' }
      ];

      const summaryData = {
        totalVisits: 25,
        activeVisits: 5,
        newVisitors: 12,
        topCompanies: ['Company A', 'Company B'],
        averageVisitDuration: '2.5 hours'
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      const results = await emailService.sendDailySummaryEmail(users, summaryData);

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle daily summary email errors', async () => {
      const users = [{ email: 'user1@example.com', firstName: 'John' }];
      const summaryData = {};

      mockTransporter.sendMail.mockRejectedValue(new Error('Send failed'));

      await expect(emailService.sendDailySummaryEmail(users, summaryData))
        .rejects.toThrow('Send failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to send daily summary emails:', expect.any(Error));
    });
  });

  describe('sendSecurityDigestEmail', () => {
    it('should send security digest emails to security users', async () => {
      const securityUsers = [
        { email: 'security1@example.com', firstName: 'Security' },
        { email: 'security2@example.com', firstName: 'Guard' }
      ];

      const digestData = {
        totalSecurityEvents: 10,
        failedLogins: 3,
        suspiciousActivities: 2,
        blacklistedVisitors: 1,
        emergencyAlerts: 0
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      const results = await emailService.sendSecurityDigestEmail(securityUsers, digestData);

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle security digest email errors', async () => {
      const securityUsers = [{ email: 'security1@example.com', firstName: 'Security' }];
      const digestData = {};

      mockTransporter.sendMail.mockRejectedValue(new Error('Send failed'));

      await expect(emailService.sendSecurityDigestEmail(securityUsers, digestData))
        .rejects.toThrow('Send failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to send security digest emails:', expect.any(Error));
    });
  });

  describe('renderTemplate', () => {
    it('should render template with data', () => {
      const result = emailService.renderTemplate('welcome', {
        firstName: 'John',
        verificationUrl: 'http://example.com/verify'
      });

      expect(result.subject).toBe('Welcome to Neo VMS');
      expect(result.html).toContain('John');
      expect(result.html).toContain('http://example.com/verify');
    });

    it('should handle missing template data gracefully', () => {
      const result = emailService.renderTemplate('welcome', {
        firstName: 'John'
        // Missing verificationUrl
      });

      expect(result.subject).toBe('Welcome to Neo VMS');
      expect(result.html).toContain('John');
      expect(result.html).not.toContain('{{verificationUrl}}');
    });

    it('should throw error for invalid template', () => {
      expect(() => {
        emailService.renderTemplate('invalid-template', {});
      }).toThrow('Email template \'invalid-template\' not found');
    });
  });

  describe('Email Templates', () => {
    it('should render visitor arrival template correctly', () => {
      const data = {
        firstName: 'John',
        visitorName: 'Jane Doe',
        company: 'Tech Corp',
        purpose: 'Business Meeting',
        checkedInAt: '2024-01-15T10:00:00Z'
      };

      const result = emailService.renderTemplate('visitor-arrival', data);

      expect(result.subject).toBe('Visitor Arrival - Neo VMS');
      expect(result.html).toContain('John');
      expect(result.html).toContain('Jane Doe');
      expect(result.html).toContain('Tech Corp');
      expect(result.html).toContain('Business Meeting');
    });

    it('should render emergency template correctly', () => {
      const data = {
        firstName: 'John',
        emergencyType: 'Fire',
        message: 'Fire detected on 3rd floor',
        location: 'Building A',
        timestamp: '2024-01-15T10:00:00Z'
      };

      const result = emailService.renderTemplate('emergency', data);

      expect(result.subject).toBe('EMERGENCY ALERT - Fire');
      expect(result.html).toContain('John');
      expect(result.html).toContain('Fire');
      expect(result.html).toContain('Fire detected on 3rd floor');
      expect(result.html).toContain('Building A');
    });

    it('should render password reset template correctly', () => {
      const data = {
        firstName: 'John',
        resetUrl: 'http://example.com/reset'
      };

      const result = emailService.renderTemplate('password-reset', data);

      expect(result.subject).toBe('Password Reset - Neo VMS');
      expect(result.html).toContain('John');
      expect(result.html).toContain('http://example.com/reset');
    });
  });
});