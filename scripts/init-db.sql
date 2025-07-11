-- Neo VMS Database Initialization Script
-- This script creates the database and initial user if they don't exist

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE neo_vms' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'neo_vms');

-- Connect to neo_vms database
\c neo_vms

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create initial tables will be handled by Sequelize migrations
-- This script just ensures the database exists and is ready

-- Initial admin user will be created by the application on startup
-- Database schema will be created by Sequelize models

-- Log successful initialization
SELECT 'Neo VMS database initialized successfully' AS status;