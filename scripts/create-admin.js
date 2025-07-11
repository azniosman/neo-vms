#!/usr/bin/env node

/**
 * Create Admin User Script
 * This script creates the first admin user for Neo VMS
 */

const { User } = require('../server/models');
const { sequelize } = require('../server/models');
const logger = require('../server/utils/logger');

// Default admin credentials
const DEFAULT_ADMIN = {
  email: 'admin@neo-vms.local',
  password: 'AdminPassword123!',
  firstName: 'System',
  lastName: 'Administrator',
  role: 'admin',
  department: 'IT',
  phone: '+65 1234 5678',
  isActive: true,
  emailVerified: true
};

async function createAdminUser() {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established');

    // Sync models
    await sequelize.sync({ force: false });
    logger.info('Database models synchronized');

    // Check if admin user already exists
    const existingAdmin = await User.findByEmail(DEFAULT_ADMIN.email);
    if (existingAdmin) {
      logger.info('Admin user already exists');
      console.log('\n✅ Admin user already exists');
      console.log(`📧 Email: ${DEFAULT_ADMIN.email}`);
      console.log('🔑 Password: (use the one you set during registration)');
      return;
    }

    // Create admin user
    const adminUser = await User.create(DEFAULT_ADMIN);
    
    logger.info('Admin user created successfully', {
      userId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role
    });

    console.log('\n🎉 Admin user created successfully!');
    console.log('=====================================');
    console.log(`📧 Email: ${DEFAULT_ADMIN.email}`);
    console.log(`🔑 Password: ${DEFAULT_ADMIN.password}`);
    console.log(`👤 Name: ${DEFAULT_ADMIN.firstName} ${DEFAULT_ADMIN.lastName}`);
    console.log(`🔧 Role: ${DEFAULT_ADMIN.role}`);
    console.log('=====================================');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    console.log('\nYou can now login at: http://localhost:3000/login');

  } catch (error) {
    logger.error('Failed to create admin user:', error);
    console.error('\n❌ Failed to create admin user:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the script
if (require.main === module) {
  createAdminUser();
}

module.exports = { createAdminUser, DEFAULT_ADMIN }; 