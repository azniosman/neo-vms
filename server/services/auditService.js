const { AuditLog } = require('../models');
const logger = require('../utils/logger');

/**
 * Create an audit log entry
 */
const createAuditLog = async ({
  userId = null,
  visitorId = null,
  visitId = null,
  action,
  resource = null,
  resourceId = null,
  details = {},
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
  sessionId = null,
  requestId = null,
  method = null,
  endpoint = null,
  statusCode = null,
  responseTime = null,
  severity = 'medium',
  category = 'data_access',
  outcome = 'success',
  riskLevel = 'low',
  complianceFlags = [],
  tags = [],
  metadata = {}
}) => {
  try {
    const auditLog = await AuditLog.create({
      userId,
      visitorId,
      visitId,
      action,
      resource,
      resourceId,
      details,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      sessionId,
      requestId,
      method,
      endpoint,
      statusCode,
      responseTime,
      severity,
      category,
      outcome,
      riskLevel,
      complianceFlags,
      tags,
      metadata
    });

    // Log to Winston for additional processing
    logger.audit(`Audit log created: ${action}`, {
      auditLogId: auditLog.id,
      userId,
      visitorId,
      visitId,
      action,
      resource,
      severity,
      category,
      outcome,
      riskLevel
    });

    return auditLog;
  } catch (error) {
    logger.error('Failed to create audit log:', error);
    throw error;
  }
};

/**
 * Get audit logs with filtering and pagination
 */
const getAuditLogs = async ({
  userId = null,
  visitorId = null,
  visitId = null,
  action = null,
  resource = null,
  category = null,
  severity = null,
  outcome = null,
  riskLevel = null,
  startDate = null,
  endDate = null,
  ipAddress = null,
  page = 1,
  limit = 50,
  orderBy = 'createdAt',
  orderDirection = 'DESC'
}) => {
  try {
    const whereClause = {};

    // Build where clause based on filters
    if (userId) whereClause.userId = userId;
    if (visitorId) whereClause.visitorId = visitorId;
    if (visitId) whereClause.visitId = visitId;
    if (action) whereClause.action = action;
    if (resource) whereClause.resource = resource;
    if (category) whereClause.category = category;
    if (severity) whereClause.severity = severity;
    if (outcome) whereClause.outcome = outcome;
    if (riskLevel) whereClause.riskLevel = riskLevel;
    if (ipAddress) whereClause.ipAddress = ipAddress;

    // Date range filter
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[AuditLog.sequelize.Sequelize.Op.gte] = startDate;
      if (endDate) whereClause.createdAt[AuditLog.sequelize.Sequelize.Op.lte] = endDate;
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await AuditLog.findAndCountAll({
      where: whereClause,
      order: [[orderBy, orderDirection]],
      limit,
      offset,
      include: [
        {
          model: AuditLog.sequelize.models.User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'role']
        },
        {
          model: AuditLog.sequelize.models.Visitor,
          as: 'visitor',
          attributes: ['id', 'email', 'firstName', 'lastName', 'company']
        },
        {
          model: AuditLog.sequelize.models.Visit,
          as: 'visit',
          attributes: ['id', 'purpose', 'status', 'checkedInAt', 'checkedOutAt']
        }
      ]
    });

    return {
      auditLogs: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  } catch (error) {
    logger.error('Failed to get audit logs:', error);
    throw error;
  }
};

/**
 * Get audit log statistics
 */
const getAuditStatistics = async (startDate, endDate) => {
  try {
    const whereClause = {};
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[AuditLog.sequelize.Sequelize.Op.gte] = startDate;
      if (endDate) whereClause.createdAt[AuditLog.sequelize.Sequelize.Op.lte] = endDate;
    }

    const [
      totalLogs,
      categoryStats,
      severityStats,
      outcomeStats,
      riskLevelStats,
      topActions,
      topUsers,
      recentHighRisk
    ] = await Promise.all([
      // Total logs count
      AuditLog.count({ where: whereClause }),

      // Category statistics
      AuditLog.findAll({
        where: whereClause,
        attributes: [
          'category',
          [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
        ],
        group: ['category']
      }),

      // Severity statistics
      AuditLog.findAll({
        where: whereClause,
        attributes: [
          'severity',
          [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
        ],
        group: ['severity']
      }),

      // Outcome statistics
      AuditLog.findAll({
        where: whereClause,
        attributes: [
          'outcome',
          [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
        ],
        group: ['outcome']
      }),

      // Risk level statistics
      AuditLog.findAll({
        where: whereClause,
        attributes: [
          'riskLevel',
          [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
        ],
        group: ['riskLevel']
      }),

      // Top actions
      AuditLog.findAll({
        where: whereClause,
        attributes: [
          'action',
          [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
        ],
        group: ['action'],
        order: [[AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'DESC']],
        limit: 10
      }),

      // Top users
      AuditLog.findAll({
        where: { ...whereClause, userId: { [AuditLog.sequelize.Sequelize.Op.not]: null } },
        attributes: [
          'userId',
          [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
        ],
        group: ['userId'],
        order: [[AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'DESC']],
        limit: 10,
        include: [
          {
            model: AuditLog.sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'firstName', 'lastName', 'role']
          }
        ]
      }),

      // Recent high risk events
      AuditLog.findAll({
        where: {
          ...whereClause,
          riskLevel: {
            [AuditLog.sequelize.Sequelize.Op.in]: ['high', 'critical']
          }
        },
        order: [['createdAt', 'DESC']],
        limit: 20
      })
    ]);

    return {
      totalLogs,
      categoryStats,
      severityStats,
      outcomeStats,
      riskLevelStats,
      topActions,
      topUsers,
      recentHighRisk
    };
  } catch (error) {
    logger.error('Failed to get audit statistics:', error);
    throw error;
  }
};

/**
 * Get security events report
 */
const getSecurityReport = async (startDate, endDate) => {
  try {
    const whereClause = {
      category: {
        [AuditLog.sequelize.Sequelize.Op.in]: ['security', 'authentication']
      }
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[AuditLog.sequelize.Sequelize.Op.gte] = startDate;
      if (endDate) whereClause.createdAt[AuditLog.sequelize.Sequelize.Op.lte] = endDate;
    }

    const [
      totalSecurityEvents,
      failedLogins,
      successfulLogins,
      accountLockouts,
      privilegeEscalations,
      suspiciousActivities,
      ipAddressStats
    ] = await Promise.all([
      // Total security events
      AuditLog.count({ where: whereClause }),

      // Failed login attempts
      AuditLog.count({
        where: {
          ...whereClause,
          action: 'LOGIN_FAILED'
        }
      }),

      // Successful logins
      AuditLog.count({
        where: {
          ...whereClause,
          action: 'LOGIN_SUCCESS'
        }
      }),

      // Account lockouts
      AuditLog.count({
        where: {
          ...whereClause,
          action: 'ACCOUNT_LOCKED'
        }
      }),

      // Privilege escalations
      AuditLog.count({
        where: {
          ...whereClause,
          action: {
            [AuditLog.sequelize.Sequelize.Op.like]: '%PRIVILEGE%'
          }
        }
      }),

      // Suspicious activities
      AuditLog.findAll({
        where: {
          ...whereClause,
          riskLevel: {
            [AuditLog.sequelize.Sequelize.Op.in]: ['high', 'critical']
          }
        },
        order: [['createdAt', 'DESC']],
        limit: 50
      }),

      // IP address statistics
      AuditLog.findAll({
        where: whereClause,
        attributes: [
          'ipAddress',
          [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
        ],
        group: ['ipAddress'],
        order: [[AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'DESC']],
        limit: 20
      })
    ]);

    return {
      totalSecurityEvents,
      failedLogins,
      successfulLogins,
      accountLockouts,
      privilegeEscalations,
      suspiciousActivities,
      ipAddressStats
    };
  } catch (error) {
    logger.error('Failed to get security report:', error);
    throw error;
  }
};

/**
 * Clean up expired audit logs
 */
const cleanupExpiredLogs = async () => {
  try {
    const expiredLogs = await AuditLog.findExpiredRetention();
    
    if (expiredLogs.length === 0) {
      logger.info('No expired audit logs found for cleanup');
      return { deletedCount: 0 };
    }

    // Anonymize logs before deletion if required
    const anonymizeBeforeDelete = process.env.ANONYMIZE_BEFORE_DELETE === 'true';
    
    if (anonymizeBeforeDelete) {
      for (const log of expiredLogs) {
        await log.anonymize();
      }
      logger.info(`Anonymized ${expiredLogs.length} expired audit logs`);
    } else {
      // Delete expired logs
      const deletedCount = await AuditLog.destroy({
        where: {
          retentionDate: {
            [AuditLog.sequelize.Sequelize.Op.lt]: new Date()
          }
        }
      });
      
      logger.info(`Deleted ${deletedCount} expired audit logs`);
      return { deletedCount };
    }
  } catch (error) {
    logger.error('Failed to cleanup expired audit logs:', error);
    throw error;
  }
};

/**
 * Export audit logs
 */
const exportAuditLogs = async (filters, format = 'json') => {
  try {
    const auditLogs = await AuditLog.findAll({
      where: filters,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: AuditLog.sequelize.models.User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'role']
        },
        {
          model: AuditLog.sequelize.models.Visitor,
          as: 'visitor',
          attributes: ['id', 'email', 'firstName', 'lastName', 'company']
        }
      ]
    });

    if (format === 'csv') {
      const csv = require('csv-stringify');
      const columns = [
        'id', 'createdAt', 'userId', 'visitorId', 'action', 'resource',
        'category', 'severity', 'outcome', 'riskLevel', 'ipAddress'
      ];
      
      return new Promise((resolve, reject) => {
        csv(auditLogs.map(log => log.toJSON()), { columns, header: true }, (err, output) => {
          if (err) reject(err);
          else resolve(output);
        });
      });
    }

    return auditLogs;
  } catch (error) {
    logger.error('Failed to export audit logs:', error);
    throw error;
  }
};

module.exports = {
  createAuditLog,
  getAuditLogs,
  getAuditStatistics,
  getSecurityReport,
  cleanupExpiredLogs,
  exportAuditLogs
};