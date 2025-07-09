# Neo VMS - Modern PDPA-Compliant Visitor Management System

A comprehensive, production-ready visitor management system that prioritizes security, privacy, and compliance with the Personal Data Protection Act (PDPA). Built as a full-stack web application with modern architecture and best practices.

## Features

### 🔐 Authentication & Authorization
- JWT-based authentication with refresh token rotation
- Role-based access control (Admin, Receptionist, Host, Security)
- Multi-factor authentication (MFA) support for admin accounts
- Account lockout after failed login attempts
- Secure password reset flow with time-limited tokens

### 👥 Visitor Management
- QR code generation system for visitor pre-registration
- Mobile-responsive visitor self-service portal
- Contactless check-in with QR code scanning
- Visitor badge printing with photo and details
- Recurring visitor management
- Visitor blacklist functionality

### 📱 Real-time Notifications
- Multi-channel host notifications (Email, SMS, Slack integration)
- Real-time WebSocket notifications for immediate alerts
- Customizable notification templates and preferences
- Emergency notification broadcast system

### 📸 Photo Management & Privacy
- Secure photo capture with camera integration
- Image compression and optimization
- Automatic photo deletion based on retention policies
- Privacy-first photo storage with encryption
- Photo access logs and audit trails

### 🛡️ Security Features
- CSRF protection with double-submit cookie pattern
- SQL injection prevention with parameterized queries
- XSS protection with Content Security Policy (CSP)
- Rate limiting on authentication and sensitive endpoints
- Comprehensive audit logging with tamper-proof storage
- End-to-end encryption for sensitive data

### 📋 PDPA Compliance
- Granular consent collection and tracking
- Data subject rights implementation (access, rectification, erasure, portability)
- Automated data retention policies
- Consent withdrawal mechanisms
- Privacy impact assessment tools
- Breach detection and notification systems

### 🚨 Emergency Management
- Real-time occupancy tracking and display
- Emergency evacuation reporting system
- Visitor location tracking within premises
- Integration with fire safety and security systems

### 📊 Analytics & Reporting
- Comprehensive visitor analytics dashboard
- Real-time visitor statistics and trends
- Custom report generation with filters
- Data export capabilities (CSV, PDF, Excel)
- Audit trail reporting

## Technology Stack

### Backend
- **Framework**: Node.js with Express
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: JWT with refresh token rotation
- **Real-time**: Socket.io for WebSocket communication
- **File Storage**: Local filesystem with organized structure
- **Email/SMS**: Configurable service providers

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI)
- **State Management**: Redux Toolkit
- **Form Handling**: React Hook Form with Yup validation
- **Real-time**: Socket.io client integration
- **PWA**: Progressive Web App capabilities

### Infrastructure
- **Deployment**: Docker Compose for containerization
- **SSL**: Self-signed certificates or Let's Encrypt
- **Monitoring**: Winston logging with log rotation
- **Backup**: Automated local backups

## Installation

### Prerequisites
- Node.js 16+ and npm 8+
- Docker and Docker Compose (optional)
- Modern web browser with camera support

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/azniosman/neo-vms.git
   cd neo-vms
   ```

2. **Install dependencies**
   ```bash
   npm run setup
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

### Docker Deployment

1. **Build and start containers**
   ```bash
   npm run docker:build
   npm run docker:up
   ```

2. **Access the application**
   - Application: https://localhost (with SSL)
   - API: https://localhost/api

## Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Server
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database
DB_DIALECT=sqlite
DB_NAME=neo_vms

# JWT Security
JWT_SECRET=your_secure_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# PDPA Compliance
DATA_RETENTION_DAYS=2555
PHOTO_RETENTION_DAYS=90
AUTO_PURGE_ENABLED=true

# Email/SMS Configuration
SMTP_HOST=localhost
SMTP_PORT=587
```

### SSL Configuration

For production deployment:

1. **Generate SSL certificates**
   ```bash
   mkdir ssl
   openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
   ```

2. **Configure SSL paths in .env**
   ```bash
   SSL_CERT_PATH=./ssl/cert.pem
   SSL_KEY_PATH=./ssl/key.pem
   ```

## Usage

### Admin Setup

1. **Create admin account**
   ```bash
   POST /api/auth/register
   {
     "email": "admin@company.com",
     "password": "SecurePassword123!",
     "firstName": "Admin",
     "lastName": "User",
     "role": "admin"
   }
   ```

2. **Configure system settings**
   - Access admin panel at `/admin`
   - Configure notification templates
   - Set up data retention policies
   - Configure integrations

### Visitor Flow

1. **Pre-registration** (Optional)
   - Visitor receives QR code via email
   - QR code contains visit details and expiry

2. **Check-in**
   - Scan QR code or manual check-in
   - Photo capture (with consent)
   - Badge printing
   - Host notification

3. **During Visit**
   - Real-time occupancy tracking
   - Location updates
   - Emergency evacuation support

4. **Check-out**
   - Manual or automatic check-out
   - Visit summary and feedback
   - Badge return

## Security Best Practices

### Production Deployment

1. **Use HTTPS only**
   ```bash
   # Force HTTPS redirect
   app.use((req, res, next) => {
     if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
       return res.redirect(301, 'https://' + req.get('host') + req.url);
     }
     next();
   });
   ```

2. **Secure headers**
   - Helmet.js for security headers
   - CSP for XSS protection
   - HSTS for HTTPS enforcement

3. **Rate limiting**
   - Authentication endpoints: 5 requests/15 minutes
   - API endpoints: 100 requests/15 minutes
   - File uploads: 10 requests/hour

4. **Data protection**
   - Encrypt sensitive data at rest
   - Hash passwords with bcrypt (12+ rounds)
   - Sanitize all user inputs
   - Use prepared statements for SQL queries

### PDPA Compliance

1. **Consent management**
   - Explicit consent for data processing
   - Granular consent options
   - Easy consent withdrawal
   - Consent audit trails

2. **Data subject rights**
   - Access: Self-service data export
   - Rectification: Profile update functionality
   - Erasure: Automated and manual deletion
   - Portability: JSON/CSV export formats

3. **Data retention**
   - Automated retention policy enforcement
   - Configurable retention periods
   - Secure data deletion
   - Retention audit reports

## API Documentation

### Authentication

```bash
# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123",
  "mfaToken": "123456"
}

# Refresh token
POST /api/auth/refresh
# Uses httpOnly cookie

# Logout
POST /api/auth/logout
```

### Visitors

```bash
# Create visitor
POST /api/visitors
{
  "email": "visitor@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "company": "Example Corp",
  "gdprConsent": true,
  "photoConsent": true
}

# Get visitors (paginated)
GET /api/visitors?page=1&limit=20&search=john

# Upload photo
POST /api/visitors/:id/photo
Content-Type: multipart/form-data
```

### Visits

```bash
# Create visit
POST /api/visits
{
  "visitorId": "uuid",
  "hostId": "uuid",
  "purpose": "Business meeting",
  "expectedDuration": 120,
  "scheduledArrival": "2024-01-15T10:00:00Z"
}

# Check-in
POST /api/visits/:id/checkin

# Check-out
POST /api/visits/:id/checkout
```

## Development

### Project Structure

```
neo-vms/
├── server/                 # Backend API
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── middleware/        # Custom middleware
│   ├── services/          # Business logic
│   └── utils/             # Utility functions
├── client/                # Frontend React app
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   └── store/         # Redux store
├── uploads/               # File uploads
├── logs/                  # Application logs
├── ssl/                   # SSL certificates
└── docker-compose.yml     # Docker configuration
```

### Development Commands

```bash
# Start development server
npm run dev

# Run backend only
npm run server:dev

# Run frontend only
npm run client:dev

# Run tests
npm test

# Lint code
npm run lint

# Type checking
npm run typecheck

# Build for production
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test suite
npm test -- --testNamePattern="Auth"
```

## Deployment

### Production Deployment

1. **Prepare production build**
   ```bash
   npm run build
   ```

2. **Configure production environment**
   ```bash
   NODE_ENV=production
   PORT=443
   SSL_CERT_PATH=/etc/ssl/certs/cert.pem
   SSL_KEY_PATH=/etc/ssl/private/key.pem
   ```

3. **Start production server**
   ```bash
   npm start
   ```

### Docker Deployment

1. **Build production image**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
   ```

2. **Deploy with Docker Compose**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

### Backup and Recovery

1. **Database backup**
   ```bash
   # SQLite
   cp database.sqlite backups/database-$(date +%Y%m%d).sqlite
   
   # PostgreSQL
   pg_dump neo_vms > backups/database-$(date +%Y%m%d).sql
   ```

2. **File backup**
   ```bash
   tar -czf backups/uploads-$(date +%Y%m%d).tar.gz uploads/
   ```

3. **Automated backups**
   - Configure cron job for daily backups
   - Set up offsite backup storage
   - Test recovery procedures regularly

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Email: support@neo-vms.com
- Documentation: https://docs.neo-vms.com

## Roadmap

- [ ] Mobile app for iOS and Android
- [ ] Facial recognition integration
- [ ] Advanced analytics dashboard
- [ ] Integration with access control systems
- [ ] Multi-language support
- [ ] API rate limiting improvements
- [ ] Advanced reporting features

---

**Neo VMS** - Secure, compliant, and modern visitor management for the digital age.