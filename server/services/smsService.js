const logger = require('../utils/logger');

// SMS service configuration
const smsConfig = {
  provider: process.env.SMS_PROVIDER || 'twilio', // twilio, nexmo, aws-sns
  apiKey: process.env.SMS_API_KEY,
  apiSecret: process.env.SMS_API_SECRET,
  fromNumber: process.env.SMS_FROM_NUMBER
};

// SMS providers
const providers = {
  twilio: require('./smsProviders/twilio'),
  nexmo: require('./smsProviders/nexmo'),
  'aws-sns': require('./smsProviders/awsSns')
};

/**
 * Send SMS message
 */
const sendSMS = async ({ to, message, priority = 'normal' }) => {
  try {
    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to)) {
      throw new Error('Invalid phone number format');
    }

    // Check if SMS is enabled
    if (!smsConfig.apiKey || !smsConfig.apiSecret) {
      logger.warn('SMS service not configured, skipping SMS send');
      return { success: false, reason: 'SMS service not configured' };
    }

    // Get SMS provider
    const provider = providers[smsConfig.provider];
    if (!provider) {
      throw new Error(`SMS provider '${smsConfig.provider}' not supported`);
    }

    // Send SMS
    const result = await provider.sendSMS({
      to,
      message,
      from: smsConfig.fromNumber,
      apiKey: smsConfig.apiKey,
      apiSecret: smsConfig.apiSecret,
      priority
    });

    logger.info('SMS sent successfully', {
      to,
      messageLength: message.length,
      provider: smsConfig.provider,
      messageId: result.messageId
    });

    return result;

  } catch (error) {
    logger.error('Failed to send SMS:', {
      error: error.message,
      to,
      messageLength: message?.length,
      provider: smsConfig.provider
    });
    throw error;
  }
};

/**
 * Send bulk SMS messages
 */
const sendBulkSMS = async (messages) => {
  try {
    const results = [];
    
    for (const message of messages) {
      try {
        const result = await sendSMS(message);
        results.push({ ...message, result, success: true });
      } catch (error) {
        logger.error('Failed to send bulk SMS:', error);
        results.push({ ...message, error: error.message, success: false });
      }
    }
    
    return results;
    
  } catch (error) {
    logger.error('Error sending bulk SMS:', error);
    throw error;
  }
};

/**
 * Verify SMS configuration
 */
const verifySMSConfig = async () => {
  try {
    if (!smsConfig.apiKey || !smsConfig.apiSecret) {
      logger.warn('SMS configuration incomplete');
      return false;
    }

    const provider = providers[smsConfig.provider];
    if (!provider) {
      logger.error(`SMS provider '${smsConfig.provider}' not supported`);
      return false;
    }

    // Test SMS configuration
    const isValid = await provider.verifyConfig({
      apiKey: smsConfig.apiKey,
      apiSecret: smsConfig.apiSecret
    });

    if (isValid) {
      logger.info('SMS configuration verified successfully');
    } else {
      logger.error('SMS configuration verification failed');
    }

    return isValid;

  } catch (error) {
    logger.error('SMS configuration verification failed:', error);
    return false;
  }
};

/**
 * Send test SMS
 */
const sendTestSMS = async (to) => {
  try {
    await sendSMS({
      to,
      message: `Test SMS from Neo VMS. Sent at ${new Date().toISOString()}`
    });
    
    logger.info('Test SMS sent successfully', { to });
    return true;
    
  } catch (error) {
    logger.error('Failed to send test SMS:', error);
    return false;
  }
};

/**
 * Send visitor arrival SMS
 */
const sendVisitorArrivalSMS = async (hostPhone, visitorName, company, purpose) => {
  try {
    const message = `Visitor Alert: ${visitorName} from ${company || 'N/A'} has arrived for: ${purpose}. Please come to reception.`;
    
    await sendSMS({
      to: hostPhone,
      message,
      priority: 'high'
    });
    
  } catch (error) {
    logger.error('Failed to send visitor arrival SMS:', error);
    throw error;
  }
};

/**
 * Send overdue visit SMS
 */
const sendOverdueVisitSMS = async (hostPhone, visitorName, overdueMinutes) => {
  try {
    const message = `Visit Overdue: ${visitorName} is overdue by ${overdueMinutes} minutes. Please check on your visitor.`;
    
    await sendSMS({
      to: hostPhone,
      message,
      priority: 'high'
    });
    
  } catch (error) {
    logger.error('Failed to send overdue visit SMS:', error);
    throw error;
  }
};

/**
 * Send emergency SMS
 */
const sendEmergencySMS = async (phoneNumbers, emergencyType, message, location) => {
  try {
    const smsMessage = `EMERGENCY: ${emergencyType} - ${message} at ${location}. Follow emergency procedures immediately.`;
    
    const messages = phoneNumbers.map(phone => ({
      to: phone,
      message: smsMessage,
      priority: 'critical'
    }));
    
    return await sendBulkSMS(messages);
    
  } catch (error) {
    logger.error('Failed to send emergency SMS:', error);
    throw error;
  }
};

/**
 * Send security alert SMS
 */
const sendSecurityAlertSMS = async (phoneNumbers, alertType, details, location) => {
  try {
    const message = `Security Alert: ${alertType} at ${location}. ${details}. Please investigate immediately.`;
    
    const messages = phoneNumbers.map(phone => ({
      to: phone,
      message,
      priority: 'high'
    }));
    
    return await sendBulkSMS(messages);
    
  } catch (error) {
    logger.error('Failed to send security alert SMS:', error);
    throw error;
  }
};

/**
 * Send visitor reminder SMS
 */
const sendVisitorReminderSMS = async (visitorPhone, hostName, scheduledTime, location) => {
  try {
    const message = `Reminder: You have a scheduled visit with ${hostName} at ${scheduledTime} at ${location}. Please arrive on time.`;
    
    await sendSMS({
      to: visitorPhone,
      message,
      priority: 'normal'
    });
    
  } catch (error) {
    logger.error('Failed to send visitor reminder SMS:', error);
    throw error;
  }
};

/**
 * Format phone number for SMS
 */
const formatPhoneNumber = (phoneNumber) => {
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Add country code if missing
  if (cleaned.length === 10) {
    return `+1${cleaned}`; // Default to US/Canada
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  } else if (cleaned.length > 11) {
    return `+${cleaned}`;
  }
  
  return phoneNumber; // Return as-is if format is unclear
};

/**
 * Validate phone number
 */
const validatePhoneNumber = (phoneNumber) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
};

/**
 * Get SMS delivery status
 */
const getSMSStatus = async (messageId) => {
  try {
    const provider = providers[smsConfig.provider];
    if (!provider || !provider.getStatus) {
      throw new Error('SMS status check not supported by provider');
    }

    return await provider.getStatus({
      messageId,
      apiKey: smsConfig.apiKey,
      apiSecret: smsConfig.apiSecret
    });

  } catch (error) {
    logger.error('Failed to get SMS status:', error);
    throw error;
  }
};

module.exports = {
  sendSMS,
  sendBulkSMS,
  verifySMSConfig,
  sendTestSMS,
  sendVisitorArrivalSMS,
  sendOverdueVisitSMS,
  sendEmergencySMS,
  sendSecurityAlertSMS,
  sendVisitorReminderSMS,
  formatPhoneNumber,
  validatePhoneNumber,
  getSMSStatus
};