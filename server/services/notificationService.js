const { sendNotificationToUser, sendNotificationToRole } = require('./socketService');
const { sendEmail } = require('./emailService');
const { sendSMS } = require('./smsService');
const { createAuditLog } = require('./auditService');
const { NotificationTemplate } = require('../models');
const logger = require('../utils/logger');

/**
 * Send notification through multiple channels
 */
const sendNotification = async ({
  userId = null,
  userRole = null,
  type,
  title,
  message,
  data = {},
  channels = ['socket'],
  priority = 'normal',
  templateId = null,
  templateData = {}
}) => {
  try {
    const notification = {
      type,
      title,
      message,
      data,
      priority,
      timestamp: new Date(),
      id: require('uuid').v4()
    };

    // If template is specified, use it
    if (templateId) {
      const template = await NotificationTemplate.findByPk(templateId);
      if (template) {
        notification.title = template.renderTitle(templateData);
        notification.message = template.renderMessage(templateData);
      }
    }

    const results = {
      socket: false,
      email: false,
      sms: false,
      errors: []
    };

    // Send via Socket.IO
    if (channels.includes('socket')) {
      try {
        if (userId) {
          sendNotificationToUser(userId, 'notification', notification);
        } else if (userRole) {
          sendNotificationToRole(userRole, 'notification', notification);
        }
        results.socket = true;
      } catch (error) {
        logger.error('Failed to send socket notification:', error);
        results.errors.push({ channel: 'socket', error: error.message });
      }
    }

    // Send via Email
    if (channels.includes('email') && userId) {
      try {
        const { User } = require('../models');
        const user = await User.findByPk(userId);
        
        if (user && user.preferences.notifications.email) {
          await sendEmail({
            to: user.email,
            subject: notification.title,
            template: 'notification',
            data: {
              firstName: user.firstName,
              title: notification.title,
              message: notification.message,
              ...templateData
            }
          });
          results.email = true;
        }
      } catch (error) {
        logger.error('Failed to send email notification:', error);
        results.errors.push({ channel: 'email', error: error.message });
      }
    }

    // Send via SMS
    if (channels.includes('sms') && userId) {
      try {
        const { User } = require('../models');
        const user = await User.findByPk(userId);
        
        if (user && user.phone && user.preferences.notifications.sms) {
          await sendSMS({
            to: user.phone,
            message: `${notification.title}: ${notification.message}`
          });
          results.sms = true;
        }
      } catch (error) {
        logger.error('Failed to send SMS notification:', error);
        results.errors.push({ channel: 'sms', error: error.message });
      }
    }

    // Audit log
    await createAuditLog({
      userId,
      action: 'NOTIFICATION_SENT',
      details: {
        type,
        title,
        channels,
        priority,
        results
      },
      category: 'system_access'
    });

    return results;

  } catch (error) {
    logger.error('Error sending notification:', error);
    throw error;
  }
};

/**
 * Send visitor arrival notification
 */
const sendVisitorArrivalNotification = async (visit) => {
  try {
    const { Visitor, User } = require('../models');
    
    const visitor = await Visitor.findByPk(visit.visitorId);
    const host = await User.findByPk(visit.hostId);
    
    if (!visitor || !host) {
      throw new Error('Visitor or host not found');
    }

    await sendNotification({
      userId: host.id,
      type: 'visitor_arrival',
      title: 'Visitor Arrival',
      message: `${visitor.getFullName()} from ${visitor.company || 'N/A'} has arrived for: ${visit.purpose}`,
      data: {
        visitId: visit.id,
        visitorId: visitor.id,
        visitorName: visitor.getFullName(),
        company: visitor.company,
        purpose: visit.purpose,
        checkedInAt: visit.checkedInAt
      },
      channels: ['socket', 'email', 'sms'],
      priority: 'high'
    });

    // Update visit to mark host as notified
    await visit.update({
      hostNotified: true,
      hostNotifiedAt: new Date()
    });

  } catch (error) {
    logger.error('Error sending visitor arrival notification:', error);
    throw error;
  }
};

/**
 * Send visitor departure notification
 */
const sendVisitorDepartureNotification = async (visit) => {
  try {
    const { Visitor, User } = require('../models');
    
    const visitor = await Visitor.findByPk(visit.visitorId);
    const host = await User.findByPk(visit.hostId);
    
    if (!visitor || !host) {
      throw new Error('Visitor or host not found');
    }

    const duration = visit.getDurationInMinutes();
    const durationText = duration > 60 ? 
      `${Math.floor(duration / 60)}h ${duration % 60}m` : 
      `${duration}m`;

    await sendNotification({
      userId: host.id,
      type: 'visitor_departure',
      title: 'Visitor Departure',
      message: `${visitor.getFullName()} has checked out after ${durationText}`,
      data: {
        visitId: visit.id,
        visitorId: visitor.id,
        visitorName: visitor.getFullName(),
        company: visitor.company,
        duration: duration,
        checkedOutAt: visit.checkedOutAt
      },
      channels: ['socket', 'email'],
      priority: 'normal'
    });

  } catch (error) {
    logger.error('Error sending visitor departure notification:', error);
    throw error;
  }
};

/**
 * Send overdue visit notification
 */
const sendOverdueVisitNotification = async (visit) => {
  try {
    const { Visitor, User } = require('../models');
    
    const visitor = await Visitor.findByPk(visit.visitorId);
    const host = await User.findByPk(visit.hostId);
    
    if (!visitor || !host) {
      throw new Error('Visitor or host not found');
    }

    const overdueMinutes = Math.floor((new Date() - visit.expectedCheckout) / (1000 * 60));

    await sendNotification({
      userId: host.id,
      type: 'visit_overdue',
      title: 'Visit Overdue',
      message: `${visitor.getFullName()}'s visit is overdue by ${overdueMinutes} minutes`,
      data: {
        visitId: visit.id,
        visitorId: visitor.id,
        visitorName: visitor.getFullName(),
        company: visitor.company,
        overdueMinutes,
        expectedCheckout: visit.expectedCheckout
      },
      channels: ['socket', 'email', 'sms'],
      priority: 'high'
    });

    // Also notify security/reception
    await sendNotification({
      userRole: 'security',
      type: 'visit_overdue',
      title: 'Overdue Visit Alert',
      message: `Visit by ${visitor.getFullName()} (Host: ${host.getFullName()}) is overdue by ${overdueMinutes} minutes`,
      data: {
        visitId: visit.id,
        visitorId: visitor.id,
        hostId: host.id,
        visitorName: visitor.getFullName(),
        hostName: host.getFullName(),
        overdueMinutes
      },
      channels: ['socket'],
      priority: 'high'
    });

  } catch (error) {
    logger.error('Error sending overdue visit notification:', error);
    throw error;
  }
};

/**
 * Send emergency notification
 */
const sendEmergencyNotification = async (emergency) => {
  try {
    const { User } = require('../models');
    
    // Get all active users
    const activeUsers = await User.findActive();
    
    // Send to all users via socket
    await sendNotification({
      userRole: 'all',
      type: 'emergency',
      title: 'Emergency Alert',
      message: `${emergency.type}: ${emergency.message}`,
      data: {
        emergencyType: emergency.type,
        location: emergency.location,
        priority: emergency.priority,
        triggeredBy: emergency.triggeredBy,
        timestamp: emergency.timestamp
      },
      channels: ['socket'],
      priority: 'critical'
    });

    // Send SMS to emergency contacts
    const emergencyContacts = process.env.EMERGENCY_CONTACTS?.split(',') || [];
    for (const contact of emergencyContacts) {
      try {
        await sendSMS({
          to: contact,
          message: `EMERGENCY: ${emergency.type} - ${emergency.message} at ${emergency.location}`
        });
      } catch (error) {
        logger.error('Failed to send emergency SMS:', error);
      }
    }

    // Send email to admins
    const adminUsers = await User.findByRole('admin');
    for (const admin of adminUsers) {
      try {
        await sendEmail({
          to: admin.email,
          subject: `EMERGENCY ALERT: ${emergency.type}`,
          template: 'emergency',
          data: {
            firstName: admin.firstName,
            emergencyType: emergency.type,
            message: emergency.message,
            location: emergency.location,
            timestamp: emergency.timestamp
          }
        });
      } catch (error) {
        logger.error('Failed to send emergency email:', error);
      }
    }

  } catch (error) {
    logger.error('Error sending emergency notification:', error);
    throw error;
  }
};

/**
 * Send system maintenance notification
 */
const sendMaintenanceNotification = async (maintenance) => {
  try {
    await sendNotification({
      userRole: 'all',
      type: 'maintenance',
      title: 'System Maintenance',
      message: maintenance.message,
      data: {
        startTime: maintenance.startTime,
        endTime: maintenance.endTime,
        affectedServices: maintenance.affectedServices
      },
      channels: ['socket', 'email'],
      priority: 'normal'
    });

  } catch (error) {
    logger.error('Error sending maintenance notification:', error);
    throw error;
  }
};

/**
 * Send security alert notification
 */
const sendSecurityAlertNotification = async (alert) => {
  try {
    // Notify security team
    await sendNotification({
      userRole: 'security',
      type: 'security_alert',
      title: 'Security Alert',
      message: alert.message,
      data: {
        alertType: alert.type,
        severity: alert.severity,
        location: alert.location,
        details: alert.details
      },
      channels: ['socket', 'email', 'sms'],
      priority: 'high'
    });

    // Notify admins for high severity alerts
    if (alert.severity === 'high' || alert.severity === 'critical') {
      await sendNotification({
        userRole: 'admin',
        type: 'security_alert',
        title: 'High Priority Security Alert',
        message: alert.message,
        data: {
          alertType: alert.type,
          severity: alert.severity,
          location: alert.location,
          details: alert.details
        },
        channels: ['socket', 'email'],
        priority: 'critical'
      });
    }

  } catch (error) {
    logger.error('Error sending security alert notification:', error);
    throw error;
  }
};

/**
 * Send batch notifications
 */
const sendBatchNotifications = async (notifications) => {
  try {
    const results = [];
    
    for (const notification of notifications) {
      try {
        const result = await sendNotification(notification);
        results.push({ ...notification, result, success: true });
      } catch (error) {
        logger.error('Failed to send batch notification:', error);
        results.push({ ...notification, error: error.message, success: false });
      }
    }
    
    return results;
  } catch (error) {
    logger.error('Error sending batch notifications:', error);
    throw error;
  }
};

/**
 * Schedule notification for later delivery
 */
const scheduleNotification = async (notification, deliveryTime) => {
  try {
    // This would typically use a job queue like Bull or Agenda
    // For now, we'll use a simple setTimeout (not recommended for production)
    
    const delay = deliveryTime.getTime() - Date.now();
    
    if (delay > 0) {
      setTimeout(async () => {
        try {
          await sendNotification(notification);
        } catch (error) {
          logger.error('Failed to send scheduled notification:', error);
        }
      }, delay);
      
      logger.info('Notification scheduled', {
        deliveryTime,
        delay,
        type: notification.type
      });
    } else {
      // Deliver immediately if time has passed
      await sendNotification(notification);
    }
    
  } catch (error) {
    logger.error('Error scheduling notification:', error);
    throw error;
  }
};

module.exports = {
  sendNotification,
  sendVisitorArrivalNotification,
  sendVisitorDepartureNotification,
  sendOverdueVisitNotification,
  sendEmergencyNotification,
  sendMaintenanceNotification,
  sendSecurityAlertNotification,
  sendBatchNotifications,
  scheduleNotification
};