const smsService = require('../../server/services/smsService');
const logger = require('../../server/utils/logger');

// Mock dependencies
jest.mock('../../server/utils/logger');

// Mock SMS providers
const mockTwilioProvider = {
  sendSMS: jest.fn(),
  verifyConfig: jest.fn(),
  getStatus: jest.fn()
};

const mockNexmoProvider = {
  sendSMS: jest.fn(),
  verifyConfig: jest.fn(),
  getStatus: jest.fn()
};

const mockAWSProvider = {
  sendSMS: jest.fn(),
  verifyConfig: jest.fn(),
  getStatus: jest.fn()
};

jest.mock('../../server/services/smsProviders/twilio', () => mockTwilioProvider);
jest.mock('../../server/services/smsProviders/nexmo', () => mockNexmoProvider);
jest.mock('../../server/services/smsProviders/awsSns', () => mockAWSProvider);

describe('SMS Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.SMS_PROVIDER = 'twilio';
    process.env.SMS_API_KEY = 'test-api-key';
    process.env.SMS_API_SECRET = 'test-api-secret';
    process.env.SMS_FROM_NUMBER = '+1234567890';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SMS_PROVIDER;
    delete process.env.SMS_API_KEY;
    delete process.env.SMS_API_SECRET;
    delete process.env.SMS_FROM_NUMBER;
  });

  describe('sendSMS', () => {
    it('should send SMS successfully', async () => {
      mockTwilioProvider.sendSMS.mockResolvedValue({
        messageId: 'sms-123',
        success: true
      });

      const result = await smsService.sendSMS({
        to: '+1234567890',
        message: 'Test message'
      });

      expect(mockTwilioProvider.sendSMS).toHaveBeenCalledWith({
        to: '+1234567890',
        message: 'Test message',
        from: '+1234567890',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        priority: 'normal'
      });
      expect(result.messageId).toBe('sms-123');
      expect(logger.info).toHaveBeenCalledWith('SMS sent successfully', expect.any(Object));
    });

    it('should handle invalid phone number format', async () => {
      await expect(smsService.sendSMS({
        to: 'invalid-phone',
        message: 'Test message'
      })).rejects.toThrow('Invalid phone number format');
    });

    it('should handle missing SMS configuration', async () => {
      delete process.env.SMS_API_KEY;
      delete process.env.SMS_API_SECRET;

      const result = await smsService.sendSMS({
        to: '+1234567890',
        message: 'Test message'
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('SMS service not configured');
      expect(logger.warn).toHaveBeenCalledWith('SMS service not configured, skipping SMS send');
    });

    it('should handle unsupported SMS provider', async () => {
      process.env.SMS_PROVIDER = 'unsupported';

      await expect(smsService.sendSMS({
        to: '+1234567890',
        message: 'Test message'
      })).rejects.toThrow('SMS provider \'unsupported\' not supported');
    });

    it('should handle SMS sending errors', async () => {
      mockTwilioProvider.sendSMS.mockRejectedValue(new Error('SMS send failed'));

      await expect(smsService.sendSMS({
        to: '+1234567890',
        message: 'Test message'
      })).rejects.toThrow('SMS send failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to send SMS:', expect.any(Object));
    });

    it('should handle different priority levels', async () => {
      mockTwilioProvider.sendSMS.mockResolvedValue({
        messageId: 'sms-123',
        success: true
      });

      await smsService.sendSMS({
        to: '+1234567890',
        message: 'Urgent message',
        priority: 'high'
      });

      expect(mockTwilioProvider.sendSMS).toHaveBeenCalledWith(expect.objectContaining({
        priority: 'high'
      }));
    });
  });

  describe('sendBulkSMS', () => {
    it('should send multiple SMS messages', async () => {
      const messages = [
        { to: '+1234567890', message: 'Message 1' },
        { to: '+1234567891', message: 'Message 2' }
      ];

      mockTwilioProvider.sendSMS.mockResolvedValue({
        messageId: 'sms-123',
        success: true
      });

      const results = await smsService.sendBulkSMS(messages);

      expect(mockTwilioProvider.sendSMS).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle partial failures in bulk send', async () => {
      const messages = [
        { to: '+1234567890', message: 'Message 1' },
        { to: '+1234567891', message: 'Message 2' }
      ];

      mockTwilioProvider.sendSMS
        .mockResolvedValueOnce({ messageId: 'sms-123', success: true })
        .mockRejectedValueOnce(new Error('SMS send failed'));

      const results = await smsService.sendBulkSMS(messages);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('SMS send failed');
    });

    it('should handle bulk SMS errors', async () => {
      mockTwilioProvider.sendSMS.mockRejectedValue(new Error('Provider error'));

      await expect(smsService.sendBulkSMS([
        { to: '+1234567890', message: 'Message 1' }
      ])).rejects.toThrow('Provider error');
      expect(logger.error).toHaveBeenCalledWith('Error sending bulk SMS:', expect.any(Error));
    });
  });

  describe('verifySMSConfig', () => {
    it('should verify SMS configuration successfully', async () => {
      mockTwilioProvider.verifyConfig.mockResolvedValue(true);

      const result = await smsService.verifySMSConfig();

      expect(mockTwilioProvider.verifyConfig).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret'
      });
      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('SMS configuration verified successfully');
    });

    it('should handle missing configuration', async () => {
      delete process.env.SMS_API_KEY;
      delete process.env.SMS_API_SECRET;

      const result = await smsService.verifySMSConfig();

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('SMS configuration incomplete');
    });

    it('should handle unsupported provider', async () => {
      process.env.SMS_PROVIDER = 'unsupported';

      const result = await smsService.verifySMSConfig();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('SMS provider \'unsupported\' not supported');
    });

    it('should handle verification failure', async () => {
      mockTwilioProvider.verifyConfig.mockResolvedValue(false);

      const result = await smsService.verifySMSConfig();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('SMS configuration verification failed');
    });

    it('should handle verification errors', async () => {
      mockTwilioProvider.verifyConfig.mockRejectedValue(new Error('Verification failed'));

      const result = await smsService.verifySMSConfig();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('SMS configuration verification failed:', expect.any(Error));
    });
  });

  describe('sendTestSMS', () => {
    it('should send test SMS successfully', async () => {
      mockTwilioProvider.sendSMS.mockResolvedValue({
        messageId: 'sms-123',
        success: true
      });

      const result = await smsService.sendTestSMS('+1234567890');

      expect(mockTwilioProvider.sendSMS).toHaveBeenCalledWith(expect.objectContaining({
        to: '+1234567890',
        message: expect.stringContaining('Test SMS from Neo VMS')
      }));
      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Test SMS sent successfully', { to: '+1234567890' });
    });

    it('should handle test SMS failure', async () => {
      mockTwilioProvider.sendSMS.mockRejectedValue(new Error('Test SMS failed'));

      const result = await smsService.sendTestSMS('+1234567890');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Failed to send test SMS:', expect.any(Error));
    });
  });

  describe('sendVisitorArrivalSMS', () => {
    it('should send visitor arrival SMS', async () => {
      mockTwilioProvider.sendSMS.mockResolvedValue({
        messageId: 'sms-123',
        success: true
      });

      await smsService.sendVisitorArrivalSMS('+1234567890', 'John Doe', 'Tech Corp', 'Business Meeting');

      expect(mockTwilioProvider.sendSMS).toHaveBeenCalledWith(expect.objectContaining({
        to: '+1234567890',
        message: expect.stringContaining('John Doe from Tech Corp has arrived'),
        priority: 'high'
      }));
    });

    it('should handle visitor arrival SMS errors', async () => {
      mockTwilioProvider.sendSMS.mockRejectedValue(new Error('SMS send failed'));

      await expect(smsService.sendVisitorArrivalSMS('+1234567890', 'John Doe', 'Tech Corp', 'Meeting'))
        .rejects.toThrow('SMS send failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to send visitor arrival SMS:', expect.any(Error));
    });
  });

  describe('sendOverdueVisitSMS', () => {
    it('should send overdue visit SMS', async () => {
      mockTwilioProvider.sendSMS.mockResolvedValue({
        messageId: 'sms-123',
        success: true
      });

      await smsService.sendOverdueVisitSMS('+1234567890', 'John Doe', 30);

      expect(mockTwilioProvider.sendSMS).toHaveBeenCalledWith(expect.objectContaining({
        to: '+1234567890',
        message: expect.stringContaining('John Doe is overdue by 30 minutes'),
        priority: 'high'
      }));
    });

    it('should handle overdue visit SMS errors', async () => {
      mockTwilioProvider.sendSMS.mockRejectedValue(new Error('SMS send failed'));

      await expect(smsService.sendOverdueVisitSMS('+1234567890', 'John Doe', 30))
        .rejects.toThrow('SMS send failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to send overdue visit SMS:', expect.any(Error));
    });
  });

  describe('sendEmergencySMS', () => {
    it('should send emergency SMS to multiple numbers', async () => {
      const phoneNumbers = ['+1234567890', '+1234567891'];
      
      mockTwilioProvider.sendSMS.mockResolvedValue({
        messageId: 'sms-123',
        success: true
      });

      const results = await smsService.sendEmergencySMS(phoneNumbers, 'Fire', 'Fire detected', 'Building A');

      expect(mockTwilioProvider.sendSMS).toHaveBeenCalledTimes(2);
      expect(mockTwilioProvider.sendSMS).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('EMERGENCY: Fire - Fire detected at Building A'),
        priority: 'critical'
      }));
      expect(results).toHaveLength(2);
    });

    it('should handle emergency SMS errors', async () => {
      mockTwilioProvider.sendSMS.mockRejectedValue(new Error('SMS send failed'));

      await expect(smsService.sendEmergencySMS(['+1234567890'], 'Fire', 'Fire detected', 'Building A'))
        .rejects.toThrow('SMS send failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to send emergency SMS:', expect.any(Error));
    });
  });

  describe('sendSecurityAlertSMS', () => {
    it('should send security alert SMS', async () => {
      const phoneNumbers = ['+1234567890', '+1234567891'];
      
      mockTwilioProvider.sendSMS.mockResolvedValue({
        messageId: 'sms-123',
        success: true
      });

      const results = await smsService.sendSecurityAlertSMS(phoneNumbers, 'Unauthorized Access', 'Door forced open', 'Building B');

      expect(mockTwilioProvider.sendSMS).toHaveBeenCalledTimes(2);
      expect(mockTwilioProvider.sendSMS).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Security Alert: Unauthorized Access at Building B'),
        priority: 'high'
      }));
      expect(results).toHaveLength(2);
    });

    it('should handle security alert SMS errors', async () => {
      mockTwilioProvider.sendSMS.mockRejectedValue(new Error('SMS send failed'));

      await expect(smsService.sendSecurityAlertSMS(['+1234567890'], 'Alert', 'Details', 'Location'))
        .rejects.toThrow('SMS send failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to send security alert SMS:', expect.any(Error));
    });
  });

  describe('sendVisitorReminderSMS', () => {
    it('should send visitor reminder SMS', async () => {
      mockTwilioProvider.sendSMS.mockResolvedValue({
        messageId: 'sms-123',
        success: true
      });

      await smsService.sendVisitorReminderSMS('+1234567890', 'Jane Smith', '2024-01-15 10:00 AM', 'Building A');

      expect(mockTwilioProvider.sendSMS).toHaveBeenCalledWith(expect.objectContaining({
        to: '+1234567890',
        message: expect.stringContaining('scheduled visit with Jane Smith at 2024-01-15 10:00 AM'),
        priority: 'normal'
      }));
    });

    it('should handle visitor reminder SMS errors', async () => {
      mockTwilioProvider.sendSMS.mockRejectedValue(new Error('SMS send failed'));

      await expect(smsService.sendVisitorReminderSMS('+1234567890', 'Jane Smith', '10:00 AM', 'Building A'))
        .rejects.toThrow('SMS send failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to send visitor reminder SMS:', expect.any(Error));
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format 10-digit US number', () => {
      const result = smsService.formatPhoneNumber('1234567890');
      expect(result).toBe('+11234567890');
    });

    it('should format 11-digit number starting with 1', () => {
      const result = smsService.formatPhoneNumber('11234567890');
      expect(result).toBe('+11234567890');
    });

    it('should format international number', () => {
      const result = smsService.formatPhoneNumber('441234567890');
      expect(result).toBe('+441234567890');
    });

    it('should handle numbers with special characters', () => {
      const result = smsService.formatPhoneNumber('(123) 456-7890');
      expect(result).toBe('+11234567890');
    });

    it('should return as-is for unclear format', () => {
      const result = smsService.formatPhoneNumber('123');
      expect(result).toBe('123');
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate correct phone numbers', () => {
      expect(smsService.validatePhoneNumber('+1234567890')).toBe(true);
      expect(smsService.validatePhoneNumber('1234567890')).toBe(true);
      expect(smsService.validatePhoneNumber('+441234567890')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(smsService.validatePhoneNumber('invalid')).toBe(false);
      expect(smsService.validatePhoneNumber('123')).toBe(false);
      expect(smsService.validatePhoneNumber('+0123456789')).toBe(false);
      expect(smsService.validatePhoneNumber('')).toBe(false);
    });
  });

  describe('getSMSStatus', () => {
    it('should get SMS status', async () => {
      mockTwilioProvider.getStatus.mockResolvedValue({
        messageId: 'sms-123',
        status: 'delivered'
      });

      const result = await smsService.getSMSStatus('sms-123');

      expect(mockTwilioProvider.getStatus).toHaveBeenCalledWith({
        messageId: 'sms-123',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret'
      });
      expect(result.status).toBe('delivered');
    });

    it('should handle providers without status support', async () => {
      delete mockTwilioProvider.getStatus;

      await expect(smsService.getSMSStatus('sms-123'))
        .rejects.toThrow('SMS status check not supported by provider');
    });

    it('should handle status check errors', async () => {
      mockTwilioProvider.getStatus.mockRejectedValue(new Error('Status check failed'));

      await expect(smsService.getSMSStatus('sms-123'))
        .rejects.toThrow('Status check failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to get SMS status:', expect.any(Error));
    });
  });

  describe('Different SMS Providers', () => {
    it('should work with Nexmo provider', async () => {
      process.env.SMS_PROVIDER = 'nexmo';
      
      mockNexmoProvider.sendSMS.mockResolvedValue({
        messageId: 'nexmo-123',
        success: true
      });

      const result = await smsService.sendSMS({
        to: '+1234567890',
        message: 'Test message'
      });

      expect(mockNexmoProvider.sendSMS).toHaveBeenCalled();
      expect(result.messageId).toBe('nexmo-123');
    });

    it('should work with AWS SNS provider', async () => {
      process.env.SMS_PROVIDER = 'aws-sns';
      
      mockAWSProvider.sendSMS.mockResolvedValue({
        messageId: 'aws-123',
        success: true
      });

      const result = await smsService.sendSMS({
        to: '+1234567890',
        message: 'Test message'
      });

      expect(mockAWSProvider.sendSMS).toHaveBeenCalled();
      expect(result.messageId).toBe('aws-123');
    });
  });
});