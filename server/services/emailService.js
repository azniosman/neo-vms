const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Email templates
const emailTemplates = {
  welcome: {
    subject: 'Welcome to Neo VMS',
    template: `
      <h2>Welcome to Neo VMS, {{firstName}}!</h2>
      <p>Your account has been created successfully. Please verify your email address by clicking the link below:</p>
      <a href="{{verificationUrl}}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
      <p>If you didn't create this account, please ignore this email.</p>
    `
  },
  
  'password-reset': {
    subject: 'Password Reset - Neo VMS',
    template: `
      <h2>Password Reset Request</h2>
      <p>Hello {{firstName}},</p>
      <p>We received a request to reset your password for your Neo VMS account.</p>
      <p>Click the link below to reset your password:</p>
      <a href="{{resetUrl}}" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this password reset, please ignore this email.</p>
    `
  },
  
  notification: {
    subject: '{{title}}',
    template: `
      <h2>{{title}}</h2>
      <p>Hello {{firstName}},</p>
      <p>{{message}}</p>
      <p>This notification was sent from Neo VMS.</p>
    `
  },
  
  'visitor-arrival': {
    subject: 'Visitor Arrival - Neo VMS',
    template: `
      <h2>Your Visitor Has Arrived</h2>
      <p>Hello {{firstName}},</p>
      <p><strong>{{visitorName}}</strong> from {{company}} has arrived for:</p>
      <p><em>{{purpose}}</em></p>
      <p>Check-in time: {{checkedInAt}}</p>
      <p>Please come to the reception area to meet your visitor.</p>
    `
  },
  
  'visitor-departure': {
    subject: 'Visitor Departure - Neo VMS',
    template: `
      <h2>Visitor Departure</h2>
      <p>Hello {{firstName}},</p>
      <p><strong>{{visitorName}}</strong> has checked out.</p>
      <p>Visit duration: {{duration}}</p>
      <p>Check-out time: {{checkedOutAt}}</p>
      <p>Thank you for hosting your visitor.</p>
    `
  },
  
  emergency: {
    subject: 'EMERGENCY ALERT - {{emergencyType}}',
    template: `
      <h2 style="color: red;">EMERGENCY ALERT</h2>
      <p>Hello {{firstName}},</p>
      <p><strong>Emergency Type:</strong> {{emergencyType}}</p>
      <p><strong>Message:</strong> {{message}}</p>
      <p><strong>Location:</strong> {{location}}</p>
      <p><strong>Time:</strong> {{timestamp}}</p>
      <p style="color: red;"><strong>Please follow emergency procedures immediately.</strong></p>
    `
  },
  
  'visit-overdue': {
    subject: 'Visit Overdue - Neo VMS',
    template: `
      <h2>Visit Overdue Alert</h2>
      <p>Hello {{firstName}},</p>
      <p>Your visitor <strong>{{visitorName}}</strong> from {{company}} is overdue by {{overdueMinutes}} minutes.</p>
      <p>Expected checkout time: {{expectedCheckout}}</p>
      <p>Please check on your visitor or contact security if needed.</p>
    `
  },
  
  'security-alert': {
    subject: 'Security Alert - Neo VMS',
    template: `
      <h2>Security Alert</h2>
      <p>Hello {{firstName}},</p>
      <p><strong>Alert Type:</strong> {{alertType}}</p>
      <p><strong>Severity:</strong> {{severity}}</p>
      <p><strong>Location:</strong> {{location}}</p>
      <p><strong>Details:</strong> {{details}}</p>
      <p>Please investigate immediately.</p>
    `
  }
};

// Create transporter
let transporter = null;

const createTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  return transporter;
};

/**
 * Render email template with data
 */
const renderTemplate = (templateName, data) => {
  const template = emailTemplates[templateName];
  if (!template) {
    throw new Error(`Email template '${templateName}' not found`);
  }
  
  let subject = template.subject;
  let html = template.template;
  
  // Replace placeholders
  Object.keys(data).forEach(key => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    subject = subject.replace(placeholder, data[key] || '');
    html = html.replace(placeholder, data[key] || '');
  });
  
  return { subject, html };
};

/**
 * Send email
 */
const sendEmail = async ({
  to,
  subject = '',
  html = '',
  template = null,
  data = {},
  attachments = []
}) => {
  try {
    const emailTransporter = createTransporter();
    
    let emailSubject = subject;
    let emailHtml = html;
    
    // Use template if provided
    if (template) {
      const rendered = renderTemplate(template, data);
      emailSubject = rendered.subject;
      emailHtml = rendered.html;
    }
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'Neo VMS <noreply@neo-vms.local>',
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: emailSubject,
      html: emailHtml,
      attachments
    };
    
    const result = await emailTransporter.sendMail(mailOptions);
    
    logger.info('Email sent successfully', {
      to: mailOptions.to,
      subject: emailSubject,
      messageId: result.messageId
    });
    
    return result;
    
  } catch (error) {
    logger.error('Failed to send email:', {
      error: error.message,
      to,
      subject,
      template
    });
    throw error;
  }
};

/**
 * Send bulk emails
 */
const sendBulkEmails = async (emails) => {
  try {
    const results = [];
    
    for (const email of emails) {
      try {
        const result = await sendEmail(email);
        results.push({ ...email, result, success: true });
      } catch (error) {
        logger.error('Failed to send bulk email:', error);
        results.push({ ...email, error: error.message, success: false });
      }
    }
    
    return results;
    
  } catch (error) {
    logger.error('Error sending bulk emails:', error);
    throw error;
  }
};

/**
 * Verify email configuration
 */
const verifyEmailConfig = async () => {
  try {
    const emailTransporter = createTransporter();
    await emailTransporter.verify();
    logger.info('Email configuration verified successfully');
    return true;
  } catch (error) {
    logger.error('Email configuration verification failed:', error);
    return false;
  }
};

/**
 * Send test email
 */
const sendTestEmail = async (to) => {
  try {
    await sendEmail({
      to,
      subject: 'Test Email from Neo VMS',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from Neo VMS to verify email configuration.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `
    });
    
    logger.info('Test email sent successfully', { to });
    return true;
    
  } catch (error) {
    logger.error('Failed to send test email:', error);
    return false;
  }
};

/**
 * Send visitor pre-registration email
 */
const sendVisitorPreRegistrationEmail = async (visit, visitor, host, qrCode) => {
  try {
    const qrCodeBuffer = await require('qrcode').toBuffer(qrCode);
    
    await sendEmail({
      to: visitor.email,
      template: 'visitor-pre-registration',
      data: {
        visitorName: visitor.getFullName(),
        hostName: host.getFullName(),
        company: host.department || 'N/A',
        purpose: visit.purpose,
        scheduledArrival: visit.scheduledArrival,
        location: visit.location,
        qrCode
      },
      attachments: [
        {
          filename: 'qr-code.png',
          content: qrCodeBuffer,
          cid: 'qrcode'
        }
      ]
    });
    
  } catch (error) {
    logger.error('Failed to send visitor pre-registration email:', error);
    throw error;
  }
};

/**
 * Send daily summary email
 */
const sendDailySummaryEmail = async (users, summaryData) => {
  try {
    const emails = users.map(user => ({
      to: user.email,
      template: 'daily-summary',
      data: {
        firstName: user.firstName,
        date: new Date().toDateString(),
        totalVisits: summaryData.totalVisits,
        activeVisits: summaryData.activeVisits,
        newVisitors: summaryData.newVisitors,
        topCompanies: summaryData.topCompanies,
        averageVisitDuration: summaryData.averageVisitDuration
      }
    }));
    
    return await sendBulkEmails(emails);
    
  } catch (error) {
    logger.error('Failed to send daily summary emails:', error);
    throw error;
  }
};

/**
 * Send security digest email
 */
const sendSecurityDigestEmail = async (securityUsers, digestData) => {
  try {
    const emails = securityUsers.map(user => ({
      to: user.email,
      template: 'security-digest',
      data: {
        firstName: user.firstName,
        date: new Date().toDateString(),
        totalSecurityEvents: digestData.totalSecurityEvents,
        failedLogins: digestData.failedLogins,
        suspiciousActivities: digestData.suspiciousActivities,
        blacklistedVisitors: digestData.blacklistedVisitors,
        emergencyAlerts: digestData.emergencyAlerts
      }
    }));
    
    return await sendBulkEmails(emails);
    
  } catch (error) {
    logger.error('Failed to send security digest emails:', error);
    throw error;
  }
};

// Add visitor pre-registration template
emailTemplates['visitor-pre-registration'] = {
  subject: 'Your Visit to {{company}} - Pre-Registration Confirmation',
  template: `
    <h2>Visit Confirmation</h2>
    <p>Hello {{visitorName}},</p>
    <p>Your visit to meet <strong>{{hostName}}</strong> has been confirmed.</p>
    
    <h3>Visit Details:</h3>
    <ul>
      <li><strong>Host:</strong> {{hostName}}</li>
      <li><strong>Purpose:</strong> {{purpose}}</li>
      <li><strong>Scheduled Arrival:</strong> {{scheduledArrival}}</li>
      <li><strong>Location:</strong> {{location}}</li>
    </ul>
    
    <h3>Instructions:</h3>
    <p>Please present the QR code below when you arrive at the reception:</p>
    <img src="cid:qrcode" alt="QR Code" style="border: 1px solid #ccc; padding: 10px;" />
    
    <p>If you need to reschedule or cancel your visit, please contact your host directly.</p>
    
    <p>Thank you!</p>
  `
};

// Add daily summary template
emailTemplates['daily-summary'] = {
  subject: 'Daily Visitor Summary - {{date}}',
  template: `
    <h2>Daily Visitor Summary</h2>
    <p>Hello {{firstName}},</p>
    <p>Here's your daily visitor summary for {{date}}:</p>
    
    <h3>Overview:</h3>
    <ul>
      <li><strong>Total Visits:</strong> {{totalVisits}}</li>
      <li><strong>Active Visits:</strong> {{activeVisits}}</li>
      <li><strong>New Visitors:</strong> {{newVisitors}}</li>
      <li><strong>Average Visit Duration:</strong> {{averageVisitDuration}}</li>
    </ul>
    
    <h3>Top Companies:</h3>
    <ul>
      {{#each topCompanies}}
      <li>{{name}}: {{count}} visits</li>
      {{/each}}
    </ul>
    
    <p>For detailed reports, please visit the Neo VMS dashboard.</p>
  `
};

// Add security digest template
emailTemplates['security-digest'] = {
  subject: 'Security Digest - {{date}}',
  template: `
    <h2>Security Digest</h2>
    <p>Hello {{firstName}},</p>
    <p>Here's your security digest for {{date}}:</p>
    
    <h3>Security Events:</h3>
    <ul>
      <li><strong>Total Security Events:</strong> {{totalSecurityEvents}}</li>
      <li><strong>Failed Logins:</strong> {{failedLogins}}</li>
      <li><strong>Suspicious Activities:</strong> {{suspiciousActivities}}</li>
      <li><strong>Blacklisted Visitors:</strong> {{blacklistedVisitors}}</li>
      <li><strong>Emergency Alerts:</strong> {{emergencyAlerts}}</li>
    </ul>
    
    <p>Please review the security dashboard for detailed information.</p>
    
    <p style="color: orange;">If you notice any concerning patterns, please investigate immediately.</p>
  `
};

module.exports = {
  sendEmail,
  sendBulkEmails,
  verifyEmailConfig,
  sendTestEmail,
  sendVisitorPreRegistrationEmail,
  sendDailySummaryEmail,
  sendSecurityDigestEmail,
  renderTemplate
};