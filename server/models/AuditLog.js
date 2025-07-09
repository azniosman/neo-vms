const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    visitorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'visitors',
        key: 'id'
      }
    },
    visitId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'visits',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 100]
      }
    },
    resource: {
      type: DataTypes.STRING,
      allowNull: true
    },
    resourceId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    oldValues: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    newValues: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    requestId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    method: {
      type: DataTypes.STRING,
      allowNull: true
    },
    endpoint: {
      type: DataTypes.STRING,
      allowNull: true
    },
    statusCode: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    responseTime: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'medium'
    },
    category: {
      type: DataTypes.ENUM(
        'authentication',
        'authorization',
        'data_access',
        'data_modification',
        'system_access',
        'security',
        'privacy',
        'compliance',
        'error',
        'performance'
      ),
      allowNull: false,
      defaultValue: 'data_access'
    },
    outcome: {
      type: DataTypes.ENUM('success', 'failure', 'error', 'warning'),
      allowNull: false,
      defaultValue: 'success'
    },
    riskLevel: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'low'
    },
    complianceFlags: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    retentionDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isAnonymized: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    anonymizedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'audit_logs',
    timestamps: false,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['visitorId']
      },
      {
        fields: ['visitId']
      },
      {
        fields: ['action']
      },
      {
        fields: ['resource']
      },
      {
        fields: ['resourceId']
      },
      {
        fields: ['category']
      },
      {
        fields: ['severity']
      },
      {
        fields: ['outcome']
      },
      {
        fields: ['riskLevel']
      },
      {
        fields: ['ipAddress']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: ['retentionDate']
      },
      {
        fields: ['isAnonymized']
      }
    ],
    hooks: {
      beforeCreate: (auditLog) => {
        // Set retention date if not already set
        if (!auditLog.retentionDate) {
          const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS) || 2555; // 7 years default
          auditLog.retentionDate = new Date(Date.now() + (retentionDays * 24 * 60 * 60 * 1000));
        }
      }
    }
  });

  // Instance methods
  AuditLog.prototype.isRetentionExpired = function() {
    return this.retentionDate && this.retentionDate < new Date();
  };

  AuditLog.prototype.anonymize = async function() {
    if (this.isAnonymized) {
      return;
    }

    // Remove or hash sensitive data
    this.ipAddress = this.ipAddress ? this.hashData(this.ipAddress) : null;
    this.userAgent = null;
    this.sessionId = null;
    this.requestId = null;
    
    // Remove sensitive details
    if (this.details && typeof this.details === 'object') {
      delete this.details.email;
      delete this.details.phone;
      delete this.details.nationalId;
      delete this.details.address;
    }

    if (this.oldValues && typeof this.oldValues === 'object') {
      delete this.oldValues.email;
      delete this.oldValues.phone;
      delete this.oldValues.nationalId;
      delete this.oldValues.address;
    }

    if (this.newValues && typeof this.newValues === 'object') {
      delete this.newValues.email;
      delete this.newValues.phone;
      delete this.newValues.nationalId;
      delete this.newValues.address;
    }

    this.isAnonymized = true;
    this.anonymizedAt = new Date();
    await this.save();
  };

  AuditLog.prototype.hashData = function(data) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  };

  AuditLog.prototype.isHighRisk = function() {
    return this.riskLevel === 'high' || this.riskLevel === 'critical';
  };

  AuditLog.prototype.isSecurityEvent = function() {
    return this.category === 'security' || this.category === 'authentication';
  };

  AuditLog.prototype.isPrivacyEvent = function() {
    return this.category === 'privacy' || this.category === 'compliance';
  };

  // Class methods
  AuditLog.findByUser = function(userId) {
    return this.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });
  };

  AuditLog.findByVisitor = function(visitorId) {
    return this.findAll({
      where: { visitorId },
      order: [['createdAt', 'DESC']]
    });
  };

  AuditLog.findByAction = function(action) {
    return this.findAll({
      where: { action },
      order: [['createdAt', 'DESC']]
    });
  };

  AuditLog.findByCategory = function(category) {
    return this.findAll({
      where: { category },
      order: [['createdAt', 'DESC']]
    });
  };

  AuditLog.findBySeverity = function(severity) {
    return this.findAll({
      where: { severity },
      order: [['createdAt', 'DESC']]
    });
  };

  AuditLog.findByRiskLevel = function(riskLevel) {
    return this.findAll({
      where: { riskLevel },
      order: [['createdAt', 'DESC']]
    });
  };

  AuditLog.findByDateRange = function(startDate, endDate) {
    return this.findAll({
      where: {
        createdAt: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      order: [['createdAt', 'DESC']]
    });
  };

  AuditLog.findSecurityEvents = function(limit = 100) {
    return this.findAll({
      where: {
        category: {
          [sequelize.Sequelize.Op.in]: ['security', 'authentication']
        }
      },
      order: [['createdAt', 'DESC']],
      limit
    });
  };

  AuditLog.findFailedOperations = function(limit = 100) {
    return this.findAll({
      where: {
        outcome: {
          [sequelize.Sequelize.Op.in]: ['failure', 'error']
        }
      },
      order: [['createdAt', 'DESC']],
      limit
    });
  };

  AuditLog.findHighRiskEvents = function(limit = 100) {
    return this.findAll({
      where: {
        riskLevel: {
          [sequelize.Sequelize.Op.in]: ['high', 'critical']
        }
      },
      order: [['createdAt', 'DESC']],
      limit
    });
  };

  AuditLog.findExpiredRetention = function() {
    return this.findAll({
      where: {
        retentionDate: {
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    });
  };

  AuditLog.findByIpAddress = function(ipAddress) {
    return this.findAll({
      where: { ipAddress },
      order: [['createdAt', 'DESC']]
    });
  };

  AuditLog.getActivitySummary = async function(userId, startDate, endDate) {
    const activities = await this.findAll({
      where: {
        userId,
        createdAt: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'action',
        'category',
        'outcome',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['action', 'category', 'outcome']
    });

    return activities;
  };

  AuditLog.getSecurityReport = async function(startDate, endDate) {
    const securityEvents = await this.findAll({
      where: {
        category: {
          [sequelize.Sequelize.Op.in]: ['security', 'authentication']
        },
        createdAt: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'action',
        'outcome',
        'riskLevel',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['action', 'outcome', 'riskLevel']
    });

    return securityEvents;
  };

  AuditLog.getComplianceReport = async function(startDate, endDate) {
    const complianceEvents = await this.findAll({
      where: {
        category: {
          [sequelize.Sequelize.Op.in]: ['privacy', 'compliance']
        },
        createdAt: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'action',
        'complianceFlags',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['action', 'complianceFlags']
    });

    return complianceEvents;
  };

  return AuditLog;
};