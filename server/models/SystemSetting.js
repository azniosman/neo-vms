const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SystemSetting = sequelize.define('SystemSetting', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: [1, 100]
      }
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('string', 'number', 'boolean', 'json', 'array'),
      allowNull: false,
      defaultValue: 'string'
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'general'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    defaultValue: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    validationRules: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    lastModifiedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
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
    tableName: 'system_settings',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['key']
      },
      {
        fields: ['category']
      },
      {
        fields: ['isPublic']
      }
    ]
  });

  // Instance methods
  SystemSetting.prototype.getValue = function() {
    if (!this.value) {
      return this.getDefaultValue();
    }

    switch (this.type) {
      case 'number':
        return parseFloat(this.value);
      case 'boolean':
        return this.value === 'true';
      case 'json':
        try {
          return JSON.parse(this.value);
        } catch (e) {
          return this.getDefaultValue();
        }
      case 'array':
        try {
          return JSON.parse(this.value);
        } catch (e) {
          return [];
        }
      default:
        return this.value;
    }
  };

  SystemSetting.prototype.getDefaultValue = function() {
    if (!this.defaultValue) {
      return null;
    }

    switch (this.type) {
      case 'number':
        return parseFloat(this.defaultValue);
      case 'boolean':
        return this.defaultValue === 'true';
      case 'json':
        try {
          return JSON.parse(this.defaultValue);
        } catch (e) {
          return null;
        }
      case 'array':
        try {
          return JSON.parse(this.defaultValue);
        } catch (e) {
          return [];
        }
      default:
        return this.defaultValue;
    }
  };

  SystemSetting.prototype.setValue = function(value) {
    switch (this.type) {
      case 'number':
        this.value = value.toString();
        break;
      case 'boolean':
        this.value = value ? 'true' : 'false';
        break;
      case 'json':
      case 'array':
        this.value = JSON.stringify(value);
        break;
      default:
        this.value = value;
    }
  };

  SystemSetting.prototype.validate = function(value) {
    const rules = this.validationRules || {};
    
    if (this.isRequired && (value === null || value === undefined || value === '')) {
      throw new Error(`Setting ${this.key} is required`);
    }

    if (this.type === 'number' && isNaN(value)) {
      throw new Error(`Setting ${this.key} must be a number`);
    }

    if (rules.min !== undefined && value < rules.min) {
      throw new Error(`Setting ${this.key} must be at least ${rules.min}`);
    }

    if (rules.max !== undefined && value > rules.max) {
      throw new Error(`Setting ${this.key} must not exceed ${rules.max}`);
    }

    if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
      throw new Error(`Setting ${this.key} does not match required pattern`);
    }

    if (rules.enum && !rules.enum.includes(value)) {
      throw new Error(`Setting ${this.key} must be one of: ${rules.enum.join(', ')}`);
    }

    return true;
  };

  // Class methods
  SystemSetting.getSetting = async function(key) {
    const setting = await this.findOne({ where: { key } });
    return setting ? setting.getValue() : null;
  };

  SystemSetting.setSetting = async function(key, value, userId = null) {
    const setting = await this.findOne({ where: { key } });
    
    if (!setting) {
      throw new Error(`Setting ${key} not found`);
    }

    setting.validate(value);
    setting.setValue(value);
    setting.lastModifiedBy = userId;
    await setting.save();
    
    return setting.getValue();
  };

  SystemSetting.getSettings = async function(category = null, isPublic = null) {
    const whereClause = {};
    
    if (category) {
      whereClause.category = category;
    }
    
    if (isPublic !== null) {
      whereClause.isPublic = isPublic;
    }

    const settings = await this.findAll({ where: whereClause });
    
    const result = {};
    settings.forEach(setting => {
      result[setting.key] = setting.getValue();
    });
    
    return result;
  };

  SystemSetting.getPublicSettings = function() {
    return this.getSettings(null, true);
  };

  SystemSetting.getSettingsByCategory = function(category) {
    return this.getSettings(category);
  };

  SystemSetting.createSetting = async function(settingData) {
    const {
      key,
      value,
      type = 'string',
      category = 'general',
      description,
      isPublic = false,
      isRequired = false,
      defaultValue,
      validationRules = {},
      lastModifiedBy
    } = settingData;

    const setting = await this.create({
      key,
      type,
      category,
      description,
      isPublic,
      isRequired,
      defaultValue,
      validationRules,
      lastModifiedBy
    });

    if (value !== undefined) {
      setting.setValue(value);
      await setting.save();
    }

    return setting;
  };

  SystemSetting.initializeDefaults = async function() {
    const defaultSettings = [
      // General settings
      {
        key: 'app_name',
        value: 'Neo VMS',
        type: 'string',
        category: 'general',
        description: 'Application name',
        isPublic: true,
        isRequired: true
      },
      {
        key: 'app_version',
        value: '1.0.0',
        type: 'string',
        category: 'general',
        description: 'Application version',
        isPublic: true,
        isRequired: true
      },
      {
        key: 'timezone',
        value: 'UTC',
        type: 'string',
        category: 'general',
        description: 'Default timezone',
        isPublic: true,
        isRequired: true
      },
      {
        key: 'language',
        value: 'en',
        type: 'string',
        category: 'general',
        description: 'Default language',
        isPublic: true,
        isRequired: true
      },
      
      // Security settings
      {
        key: 'max_login_attempts',
        value: '5',
        type: 'number',
        category: 'security',
        description: 'Maximum login attempts before lockout',
        isRequired: true,
        validationRules: { min: 1, max: 10 }
      },
      {
        key: 'lockout_duration_minutes',
        value: '30',
        type: 'number',
        category: 'security',
        description: 'Account lockout duration in minutes',
        isRequired: true,
        validationRules: { min: 1, max: 1440 }
      },
      {
        key: 'session_timeout_minutes',
        value: '60',
        type: 'number',
        category: 'security',
        description: 'Session timeout in minutes',
        isRequired: true,
        validationRules: { min: 15, max: 480 }
      },
      {
        key: 'require_mfa_for_admin',
        value: 'true',
        type: 'boolean',
        category: 'security',
        description: 'Require MFA for admin users',
        isRequired: true
      },
      
      // Visitor settings
      {
        key: 'max_occupancy',
        value: '100',
        type: 'number',
        category: 'visitor',
        description: 'Maximum building occupancy',
        isPublic: true,
        isRequired: true,
        validationRules: { min: 1, max: 10000 }
      },
      {
        key: 'default_visit_duration',
        value: '60',
        type: 'number',
        category: 'visitor',
        description: 'Default visit duration in minutes',
        isPublic: true,
        isRequired: true,
        validationRules: { min: 15, max: 1440 }
      },
      {
        key: 'qr_code_expiry_hours',
        value: '24',
        type: 'number',
        category: 'visitor',
        description: 'QR code expiry time in hours',
        isRequired: true,
        validationRules: { min: 1, max: 168 }
      },
      {
        key: 'auto_checkout_enabled',
        value: 'true',
        type: 'boolean',
        category: 'visitor',
        description: 'Enable automatic checkout for overdue visits',
        isRequired: true
      },
      {
        key: 'auto_checkout_hours',
        value: '8',
        type: 'number',
        category: 'visitor',
        description: 'Auto checkout after hours',
        isRequired: true,
        validationRules: { min: 1, max: 24 }
      },
      
      // PDPA settings
      {
        key: 'data_retention_years',
        value: '7',
        type: 'number',
        category: 'pdpa',
        description: 'Data retention period in years',
        isRequired: true,
        validationRules: { min: 1, max: 10 }
      },
      {
        key: 'photo_retention_days',
        value: '90',
        type: 'number',
        category: 'pdpa',
        description: 'Photo retention period in days',
        isRequired: true,
        validationRules: { min: 1, max: 365 }
      },
      {
        key: 'consent_required',
        value: 'true',
        type: 'boolean',
        category: 'pdpa',
        description: 'Require GDPR consent',
        isRequired: true
      },
      {
        key: 'auto_purge_enabled',
        value: 'true',
        type: 'boolean',
        category: 'pdpa',
        description: 'Enable automatic data purging',
        isRequired: true
      },
      
      // Notification settings
      {
        key: 'email_notifications_enabled',
        value: 'true',
        type: 'boolean',
        category: 'notifications',
        description: 'Enable email notifications',
        isRequired: true
      },
      {
        key: 'sms_notifications_enabled',
        value: 'false',
        type: 'boolean',
        category: 'notifications',
        description: 'Enable SMS notifications',
        isRequired: true
      },
      {
        key: 'push_notifications_enabled',
        value: 'true',
        type: 'boolean',
        category: 'notifications',
        description: 'Enable push notifications',
        isRequired: true
      },
      {
        key: 'notification_retry_attempts',
        value: '3',
        type: 'number',
        category: 'notifications',
        description: 'Notification retry attempts',
        isRequired: true,
        validationRules: { min: 1, max: 10 }
      }
    ];

    for (const setting of defaultSettings) {
      const existing = await this.findOne({ where: { key: setting.key } });
      if (!existing) {
        await this.create(setting);
      }
    }
  };

  return SystemSetting;
};