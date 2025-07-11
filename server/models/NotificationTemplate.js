const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NotificationTemplate = sequelize.define('NotificationTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    type: {
      type: DataTypes.ENUM('email', 'sms', 'push'),
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: true
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    variables: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    language: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'en'
    }
  }, {
    tableName: 'notification_templates',
    timestamps: true,
    indexes: [
      {
        fields: ['name']
      },
      {
        fields: ['type']
      }
    ]
  });

  return NotificationTemplate;
};