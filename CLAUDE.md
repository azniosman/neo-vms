# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern PDPA-compliant visitor management system designed for local deployment. The system prioritizes security, privacy, and compliance with the Personal Data Protection Act (PDPA).

## Architecture

This is a full-stack web application with the following key components:

### Backend (Node.js/Express or Python/FastAPI)
- JWT-based authentication with refresh token rotation
- Role-based access control (Admin, Receptionist, Host, Security)
- Multi-factor authentication support
- SQLite/PostgreSQL database
- Real-time WebSocket notifications
- File storage with local filesystem

### Frontend (React/TypeScript or Vue.js)
- Material-UI or Tailwind CSS for professional design
- Redux Toolkit or Zustand for state management
- Progressive Web App (PWA) capabilities
- WCAG 2.1 AA compliance
- Mobile-responsive design

### Local Infrastructure
- Single server setup with Docker Compose
- Local SSL with self-signed certificates
- Local network access (e.g., 192.168.1.100)
- No cloud dependencies - fully self-contained

## Core Features

### 1. Authentication & Authorization
- JWT with refresh token rotation
- RBAC with 4 roles: Admin, Receptionist, Host, Security
- MFA for admin accounts
- Account lockout after failed attempts
- Secure password reset flow

### 2. Visitor Management
- QR code generation for pre-registration
- Contactless check-in with QR scanning
- Visitor badge printing with photos
- Recurring visitor support
- Real-time occupancy tracking

### 3. Privacy & PDPA Compliance
- Data minimization principles
- Granular consent management
- Data subject rights (access, rectification, erasure, portability)
- Automated retention policies
- Privacy-first photo storage with encryption

### 4. Security Features
- CSRF protection with double-submit cookie pattern
- SQL injection prevention with parameterized queries
- XSS protection with CSP
- Rate limiting on sensitive endpoints
- Comprehensive audit logging
- End-to-end encryption for sensitive data

### 5. Real-time Notifications
- Multi-channel host notifications (Email, SMS, Slack)
- WebSocket notifications for immediate alerts
- Emergency notification broadcast system
- Customizable notification templates

## Security Implementation Requirements

When working on this codebase, ensure:
- All user inputs are validated and sanitized
- Parameterized queries for database operations
- Rate limiting on authentication and sensitive endpoints
- Comprehensive audit logging for all sensitive operations
- TLS 1.3 enforcement
- Security headers (HSTS, X-Frame-Options, CSP)
- httpOnly and secure cookies for session management

## PDPA Compliance Requirements

Always implement:
- Data minimization in all data collection
- Default privacy settings
- Consent tracking and withdrawal mechanisms
- Data retention policies with automated purging
- Data subject rights fulfillment mechanisms
- Breach detection and notification systems
- Privacy impact assessment tools

## Local Deployment Considerations

- System works without external dependencies
- Local network access only (192.168.1.100)
- Docker Compose for easy deployment
- Local SSL certificate generation
- Automated database initialization
- Local backup to external storage
- Offline capabilities for basic functionality

## Development Guidelines

- Use TypeScript for type safety
- Implement comprehensive testing (>80% coverage)
- Follow SOLID principles and clean architecture
- Use dependency injection for testability
- Implement proper error handling without information disclosure
- Create comprehensive API documentation with OpenAPI/Swagger
- Never expose sensitive information in logs or error messages

## Integration Points

- Local access control systems (door locks, turnstiles)
- Thermal printer integration for visitor badges
- Local CCTV system integration
- Building intercom systems
- Local employee directory (CSV import)
- Hardware sensors (motion, occupancy)

## Emergency Management

- Real-time occupancy tracking
- Emergency evacuation reporting
- Visitor location tracking within premises
- Integration with fire safety systems
- Evacuation status dashboard

## File Structure Considerations

When implementing this system:
- Organize by feature modules (auth, visitors, notifications, etc.)
- Separate concerns (controllers, services, models)
- Keep security middleware centralized
- Implement proper logging structure
- Create clear separation between public and private API endpoints

## GIT Repository
https://github.com/azniosman/neo-vms.git