const { Sequelize } = require('sequelize');
const path = require('path');
const logger = require('../utils/logger');

// Database configuration with latest Sequelize options
const config = {
  database: process.env.DB_NAME || 'neo_vms',
  username: process.env.DB_USER || 'neo_vms_user',
  password: process.env.DB_PASSWORD || 'secure_password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  dialect: process.env.DB_DIALECT || 'sqlite',
  logging: (msg) => logger.debug(msg),
  storage: process.env.DB_DIALECT === 'sqlite' ? path.join(__dirname, '../../database.sqlite') : undefined,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    useUTC: false,
    dateStrings: true,
    typeCast: true
  },
  timezone: '+00:00',
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    underscored: true,
    freezeTableName: true,
    timestamps: true
  }
};

// Initialize Sequelize
const sequelize = new Sequelize(config);

// Import models
const User = require('./User')(sequelize);
const Visitor = require('./Visitor')(sequelize);
const Visit = require('./Visit')(sequelize);
const ConsentRecord = require('./ConsentRecord')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);
const SystemSetting = require('./SystemSetting')(sequelize);
const NotificationTemplate = require('./NotificationTemplate')(sequelize);
const DataRetentionPolicy = require('./DataRetentionPolicy')(sequelize);
const EmergencyContact = require('./EmergencyContact')(sequelize);
const AccessLog = require('./AccessLog')(sequelize);

// Define associations
User.hasMany(Visit, { foreignKey: 'hostId', as: 'hostedVisits' });
Visit.belongsTo(User, { foreignKey: 'hostId', as: 'host' });

User.hasMany(Visit, { foreignKey: 'checkedInBy', as: 'checkedInVisits' });
Visit.belongsTo(User, { foreignKey: 'checkedInBy', as: 'checkedInByUser' });

User.hasMany(Visit, { foreignKey: 'checkedOutBy', as: 'checkedOutVisits' });
Visit.belongsTo(User, { foreignKey: 'checkedOutBy', as: 'checkedOutByUser' });

Visitor.hasMany(Visit, { foreignKey: 'visitorId', as: 'visits' });
Visit.belongsTo(Visitor, { foreignKey: 'visitorId', as: 'visitor' });

Visitor.hasMany(ConsentRecord, { foreignKey: 'visitorId', as: 'consents' });
ConsentRecord.belongsTo(Visitor, { foreignKey: 'visitorId', as: 'visitor' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Visitor.hasMany(AuditLog, { foreignKey: 'visitorId', as: 'auditLogs' });
AuditLog.belongsTo(Visitor, { foreignKey: 'visitorId', as: 'visitor' });

Visit.hasMany(AuditLog, { foreignKey: 'visitId', as: 'auditLogs' });
AuditLog.belongsTo(Visit, { foreignKey: 'visitId', as: 'visit' });

User.hasMany(AccessLog, { foreignKey: 'userId', as: 'accessLogs' });
AccessLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Export models and sequelize instance
module.exports = {
  sequelize,
  User,
  Visitor,
  Visit,
  ConsentRecord,
  AuditLog,
  SystemSetting,
  NotificationTemplate,
  DataRetentionPolicy,
  EmergencyContact,
  AccessLog
};