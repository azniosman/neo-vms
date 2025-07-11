const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EmergencyContact = sequelize.define('EmergencyContact', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    department: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Priority order for emergency notifications'
    }
  }, {
    tableName: 'emergency_contacts',
    timestamps: true,
    indexes: [
      {
        fields: ['priority']
      },
      {
        fields: ['isActive']
      }
    ]
  });

  return EmergencyContact;
};