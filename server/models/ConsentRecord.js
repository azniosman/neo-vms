const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ConsentRecord = sequelize.define('ConsentRecord', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    visitorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'visitors',
        key: 'id'
      }
    },
    consentType: {
      type: DataTypes.ENUM(
        'gdpr_processing',
        'marketing_communications',
        'photo_capture',
        'biometric_data',
        'data_sharing',
        'cookies',
        'location_tracking',
        'emergency_contact'
      ),
      allowNull: false
    },
    consentStatus: {
      type: DataTypes.ENUM('granted', 'denied', 'withdrawn'),
      allowNull: false
    },
    consentVersion: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '1.0'
    },
    consentText: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    consentMethod: {
      type: DataTypes.ENUM('web_form', 'mobile_app', 'paper_form', 'verbal', 'automatic'),
      allowNull: false,
      defaultValue: 'web_form'
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    geoLocation: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    witnessedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    withdrawnAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    withdrawnReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    renewalRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    renewalDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    parentConsentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'consent_records',
        key: 'id'
      }
    },
    legalBasis: {
      type: DataTypes.ENUM(
        'consent',
        'contract',
        'legal_obligation',
        'vital_interests',
        'public_task',
        'legitimate_interests'
      ),
      allowNull: false,
      defaultValue: 'consent'
    },
    processingPurpose: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    dataCategories: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    recipientCategories: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    retentionPeriod: {
      type: DataTypes.STRING,
      allowNull: true
    },
    transferCountries: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'consent_records',
    timestamps: true,
    indexes: [
      {
        fields: ['visitorId']
      },
      {
        fields: ['consentType']
      },
      {
        fields: ['consentStatus']
      },
      {
        fields: ['consentVersion']
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['expiresAt']
      },
      {
        fields: ['renewalDate']
      },
      {
        fields: ['withdrawnAt']
      },
      {
        fields: ['parentConsentId']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  // Instance methods
  ConsentRecord.prototype.isExpired = function() {
    return this.expiresAt && this.expiresAt < new Date();
  };

  ConsentRecord.prototype.isWithdrawn = function() {
    return this.consentStatus === 'withdrawn';
  };

  ConsentRecord.prototype.isValid = function() {
    return this.isActive && 
           this.consentStatus === 'granted' && 
           !this.isExpired() && 
           !this.isWithdrawn();
  };

  ConsentRecord.prototype.needsRenewal = function() {
    return this.renewalRequired && 
           this.renewalDate && 
           this.renewalDate <= new Date();
  };

  ConsentRecord.prototype.withdraw = async function(reason) {
    this.consentStatus = 'withdrawn';
    this.withdrawnAt = new Date();
    this.withdrawnReason = reason;
    this.isActive = false;
    await this.save();
  };

  ConsentRecord.prototype.renew = async function(newConsentText, newVersion) {
    // Create new consent record
    const newConsent = await ConsentRecord.create({
      visitorId: this.visitorId,
      consentType: this.consentType,
      consentStatus: 'granted',
      consentVersion: newVersion || this.consentVersion,
      consentText: newConsentText,
      consentMethod: this.consentMethod,
      parentConsentId: this.id,
      legalBasis: this.legalBasis,
      processingPurpose: this.processingPurpose,
      dataCategories: this.dataCategories,
      recipientCategories: this.recipientCategories,
      retentionPeriod: this.retentionPeriod,
      transferCountries: this.transferCountries
    });

    // Deactivate old consent
    this.isActive = false;
    await this.save();

    return newConsent;
  };

  // Class methods
  ConsentRecord.findByVisitor = function(visitorId) {
    return this.findAll({
      where: { visitorId, isActive: true }
    });
  };

  ConsentRecord.findByType = function(consentType) {
    return this.findAll({
      where: { consentType, isActive: true }
    });
  };

  ConsentRecord.findActive = function() {
    return this.findAll({
      where: { 
        isActive: true,
        consentStatus: 'granted'
      }
    });
  };

  ConsentRecord.findExpired = function() {
    return this.findAll({
      where: {
        isActive: true,
        expiresAt: {
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    });
  };

  ConsentRecord.findNeedingRenewal = function() {
    return this.findAll({
      where: {
        isActive: true,
        renewalRequired: true,
        renewalDate: {
          [sequelize.Sequelize.Op.lte]: new Date()
        }
      }
    });
  };

  ConsentRecord.findWithdrawn = function() {
    return this.findAll({
      where: { consentStatus: 'withdrawn' }
    });
  };

  ConsentRecord.findByVisitorAndType = function(visitorId, consentType) {
    return this.findOne({
      where: {
        visitorId,
        consentType,
        isActive: true
      },
      order: [['createdAt', 'DESC']]
    });
  };

  ConsentRecord.getConsentHistory = function(visitorId, consentType) {
    return this.findAll({
      where: {
        visitorId,
        consentType
      },
      order: [['createdAt', 'DESC']]
    });
  };

  ConsentRecord.getConsentStatistics = async function() {
    const stats = await this.findAll({
      attributes: [
        'consentType',
        'consentStatus',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: { isActive: true },
      group: ['consentType', 'consentStatus']
    });

    return stats;
  };

  return ConsentRecord;
};