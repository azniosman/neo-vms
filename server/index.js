const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
require('dotenv').config();

// Import modules
const { sequelize } = require('./models');
const logger = require('./utils/logger');
const authRoutes = require('./routes/auth');
const visitorRoutes = require('./routes/visitors');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/upload');
const emergencyRoutes = require('./routes/emergency');
const { authenticateToken } = require('./middleware/auth');
const { setupCSRF } = require('./middleware/csrf');
const { setupSocketAuth } = require('./middleware/socketAuth');
const { initializeSocket } = require('./services/socketService');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CORS middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// CSRF protection
setupCSRF(app);

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/visitors', authenticateToken, visitorRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/upload', authenticateToken, uploadRoutes);
app.use('/api/emergency', authenticateToken, emergencyRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Sync database models
    await sequelize.sync({ force: false });
    logger.info('Database models synchronized');
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Create SSL certificates directory if it doesn't exist
    const sslDir = path.join(__dirname, '../ssl');
    if (!fs.existsSync(sslDir)) {
      fs.mkdirSync(sslDir, { recursive: true });
    }
    
    // Start server with HTTPS if certificates exist
    const sslCertPath = process.env.SSL_CERT_PATH || path.join(__dirname, '../ssl/cert.pem');
    const sslKeyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '../ssl/key.pem');
    
    let server;
    
    if (fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath)) {
      const privateKey = fs.readFileSync(sslKeyPath, 'utf8');
      const certificate = fs.readFileSync(sslCertPath, 'utf8');
      const credentials = { key: privateKey, cert: certificate };
      
      server = https.createServer(credentials, app);
      logger.info('HTTPS server enabled');
    } else {
      server = http.createServer(app);
      logger.info('HTTP server enabled (no SSL certificates found)');
    }
    
    // Initialize Socket.IO
    const io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
      }
    });
    
    // Setup socket authentication
    setupSocketAuth(io);
    
    // Initialize socket service
    initializeSocket(io);
    
    // Start listening
    server.listen(PORT, HOST, () => {
      logger.info(`Server running on ${server instanceof https.Server ? 'https' : 'http'}://${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

// Start the server
startServer();