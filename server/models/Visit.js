const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Visit = sequelize.define('Visit', {
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
    hostId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    checkedInBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    checkedOutBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    purpose: {
      type: DataTypes.STRING,
      allowNull: false
    },
    expectedDuration: {
      type: DataTypes.INTEGER, // in minutes
      allowNull: true
    },
    actualDuration: {
      type: DataTypes.INTEGER, // in minutes
      allowNull: true
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    floor: {
      type: DataTypes.STRING,
      allowNull: true
    },
    room: {
      type: DataTypes.STRING,
      allowNull: true
    },
    accompaniedBy: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    vehicleNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    parkingSlot: {
      type: DataTypes.STRING,
      allowNull: true
    },
    items: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    emergencyEvacuated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    evacuation: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    status: {
      type: DataTypes.ENUM('pre_registered', 'checked_in', 'checked_out', 'expired', 'cancelled', 'no_show'),
      allowNull: false,
      defaultValue: 'pre_registered'
    },
    qrCode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    qrCodeExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    badgeNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    badgePrinted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    badgePrintedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    preRegisteredAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    scheduledArrival: {
      type: DataTypes.DATE,
      allowNull: true
    },
    checkedInAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    checkedOutAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expectedCheckout: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notificationsSent: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    hostNotified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    hostNotifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    hostConfirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    hostConfirmedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    securityApproved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    securityApprovedBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    securityApprovedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    securityNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    temperature: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true
    },
    healthDeclaration: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    customFields: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ratingGiven: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    feedbackGiven: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    feedbackGivenAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isRecurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    recurringParentId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    recurringInstanceDate: {
      type: DataTypes.DATE,
      allowNull: true
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
    tableName: 'visits',
    timestamps: true,
    indexes: [
      {
        fields: ['visitorId']
      },
      {
        fields: ['hostId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['checkedInAt']
      },
      {
        fields: ['checkedOutAt']
      },
      {
        fields: ['scheduledArrival']
      },
      {
        fields: ['qrCode']
      },
      {
        fields: ['badgeNumber']
      },
      {
        fields: ['emergencyEvacuated']
      },
      {
        fields: ['isRecurring']
      },
      {
        fields: ['recurringParentId']
      }
    ],
    hooks: {
      beforeSave: async (visit) => {
        // Calculate actual duration on checkout
        if (visit.checkedOutAt && visit.checkedInAt) {
          const duration = Math.round((visit.checkedOutAt - visit.checkedInAt) / (1000 * 60));
          visit.actualDuration = duration;
        }
        
        // Set expected checkout if not set
        if (visit.checkedInAt && visit.expectedDuration && !visit.expectedCheckout) {
          visit.expectedCheckout = new Date(visit.checkedInAt.getTime() + (visit.expectedDuration * 60 * 1000));
        }
      }
    }
  });

  // Instance methods
  Visit.prototype.isActive = function() {
    return this.status === 'checked_in';
  };

  Visit.prototype.isOverdue = function() {
    return this.expectedCheckout && this.expectedCheckout < new Date() && this.status === 'checked_in';
  };

  Visit.prototype.isExpired = function() {
    return this.qrCodeExpiry && this.qrCodeExpiry < new Date();
  };

  Visit.prototype.getDurationInMinutes = function() {
    if (this.actualDuration) {
      return this.actualDuration;
    }
    
    if (this.checkedInAt && this.status === 'checked_in') {
      return Math.round((new Date() - this.checkedInAt) / (1000 * 60));
    }
    
    return 0;
  };

  Visit.prototype.checkIn = async function(checkedInBy) {
    this.status = 'checked_in';
    this.checkedInAt = new Date();
    this.checkedInBy = checkedInBy;
    
    if (this.expectedDuration) {
      this.expectedCheckout = new Date(Date.now() + (this.expectedDuration * 60 * 1000));
    }
    
    await this.save();
  };

  Visit.prototype.checkOut = async function(checkedOutBy) {
    this.status = 'checked_out';
    this.checkedOutAt = new Date();
    this.checkedOutBy = checkedOutBy;
    
    if (this.checkedInAt) {
      this.actualDuration = Math.round((this.checkedOutAt - this.checkedInAt) / (1000 * 60));
    }
    
    await this.save();
  };

  Visit.prototype.markEvacuated = async function(evacuationData) {
    this.emergencyEvacuated = true;
    this.evacuation = {
      ...evacuationData,
      evacuatedAt: new Date()
    };
    await this.save();
  };

  Visit.prototype.addNotification = async function(notificationType, details) {
    if (!this.notificationsSent) {
      this.notificationsSent = [];
    }
    
    this.notificationsSent.push({
      type: notificationType,
      sentAt: new Date(),
      details
    });
    
    await this.save();
  };

  // Class methods
  Visit.findActive = function() {
    return this.findAll({ where: { status: 'checked_in' } });
  };

  Visit.findByVisitor = function(visitorId) {
    return this.findAll({ where: { visitorId } });
  };

  Visit.findByHost = function(hostId) {
    return this.findAll({ where: { hostId } });
  };

  Visit.findByStatus = function(status) {
    return this.findAll({ where: { status } });
  };

  Visit.findOverdue = function() {
    return this.findAll({
      where: {
        status: 'checked_in',
        expectedCheckout: {
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    });
  };

  Visit.findByDateRange = function(startDate, endDate) {
    return this.findAll({
      where: {
        checkedInAt: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      }
    });
  };

  Visit.findTodayVisits = function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.findByDateRange(today, tomorrow);
  };

  Visit.findCurrentOccupancy = function() {
    return this.count({ where: { status: 'checked_in' } });
  };

  Visit.findEvacuationList = function() {
    return this.findAll({
      where: {
        status: 'checked_in',
        emergencyEvacuated: false
      }
    });
  };

  return Visit;
};