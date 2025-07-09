const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Visitor = sequelize.define('Visitor', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 100]
      }
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 100]
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [10, 20]
      }
    },
    company: {
      type: DataTypes.STRING,
      allowNull: true
    },
    nationalId: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [5, 50]
      }
    },
    photo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    emergencyContact: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    customFields: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    isBlacklisted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    blacklistReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    blacklistedBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    blacklistedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isRecurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    recurringPattern: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    visitorType: {
      type: DataTypes.ENUM('guest', 'contractor', 'vendor', 'employee_guest', 'interview', 'delivery', 'maintenance', 'other'),
      allowNull: false,
      defaultValue: 'guest'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    dataRetentionDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    gdprConsent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    gdprConsentDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    marketingConsent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    marketingConsentDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    photoConsent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    photoConsentDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    biometricConsent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    biometricConsentDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastVisit: {
      type: DataTypes.DATE,
      allowNull: true
    },
    totalVisits: {
      type: DataTypes.INTEGER,
      defaultValue: 0
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
    tableName: 'visitors',
    timestamps: true,
    indexes: [
      {
        fields: ['email']
      },
      {
        fields: ['phone']
      },
      {
        fields: ['nationalId']
      },
      {
        fields: ['company']
      },
      {
        fields: ['visitorType']
      },
      {
        fields: ['isBlacklisted']
      },
      {
        fields: ['isRecurring']
      },
      {
        fields: ['lastVisit']
      },
      {
        fields: ['dataRetentionDate']
      }
    ],
    hooks: {
      beforeSave: async (visitor) => {
        // Set data retention date if not already set
        if (!visitor.dataRetentionDate) {
          const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS) || 2555; // 7 years default
          visitor.dataRetentionDate = new Date(Date.now() + (retentionDays * 24 * 60 * 60 * 1000));
        }
      }
    }
  });

  // Instance methods
  Visitor.prototype.getFullName = function() {
    return `${this.firstName} ${this.lastName}`;
  };

  Visitor.prototype.isRetentionExpired = function() {
    return this.dataRetentionDate && this.dataRetentionDate < new Date();
  };

  Visitor.prototype.hasValidConsent = function() {
    return this.gdprConsent && this.gdprConsentDate;
  };

  Visitor.prototype.canTakePhoto = function() {
    return this.photoConsent && this.photoConsentDate;
  };

  Visitor.prototype.canUseBiometrics = function() {
    return this.biometricConsent && this.biometricConsentDate;
  };

  Visitor.prototype.updateVisitStats = async function() {
    this.totalVisits += 1;
    this.lastVisit = new Date();
    await this.save();
  };

  Visitor.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    // Remove sensitive data based on user role or context
    if (this.isRetentionExpired()) {
      delete values.nationalId;
      delete values.address;
      delete values.emergencyContact;
      delete values.customFields;
    }
    return values;
  };

  // Class methods
  Visitor.findByEmail = function(email) {
    return this.findOne({ where: { email: email.toLowerCase() } });
  };

  Visitor.findByPhone = function(phone) {
    return this.findOne({ where: { phone } });
  };

  Visitor.findByNationalId = function(nationalId) {
    return this.findOne({ where: { nationalId } });
  };

  Visitor.findActive = function() {
    return this.findAll({ where: { isBlacklisted: false } });
  };

  Visitor.findBlacklisted = function() {
    return this.findAll({ where: { isBlacklisted: true } });
  };

  Visitor.findRecurring = function() {
    return this.findAll({ where: { isRecurring: true } });
  };

  Visitor.findByType = function(visitorType) {
    return this.findAll({ where: { visitorType } });
  };

  Visitor.findExpiredRetention = function() {
    return this.findAll({
      where: {
        dataRetentionDate: {
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    });
  };

  return Visitor;
};