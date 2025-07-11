const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AccessLog = sequelize.define('AccessLog', {
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
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: false
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    resource: {
      type: DataTypes.STRING,
      allowNull: true
    },
    method: {
      type: DataTypes.STRING,
      allowNull: false
    },
    endpoint: {
      type: DataTypes.STRING,
      allowNull: false
    },
    statusCode: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    responseTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Response time in milliseconds'
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'access_logs',
    timestamps: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['ipAddress']
      },
      {
        fields: ['action']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return AccessLog;
};