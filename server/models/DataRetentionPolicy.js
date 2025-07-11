const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DataRetentionPolicy = sequelize.define('DataRetentionPolicy', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    dataType: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    retentionPeriod: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Retention period in days'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    autoDelete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'data_retention_policies',
    timestamps: true,
    indexes: [
      {
        fields: ['dataType']
      }
    ]
  });

  return DataRetentionPolicy;
};