const express = require('express');
const { body, validationResult, query } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const { Visitor, Visit, User, ConsentRecord } = require('../models');
const { requireAdminOrReceptionist, requireAdminOrReceptionistOrSecurity } = require('../middleware/auth');
const { createAuditLog } = require('../services/auditService');
const { sendNotification } = require('../services/notificationService');
const logger = require('../utils/logger');

const router = express.Router();

// Multer configuration for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/photos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `visitor-${uniqueSuffix}.${file.originalname.split('.').pop()}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'));
    }
  }
});

// Validation middleware
const visitorValidation = [
  body('email').isEmail().normalizeEmail(),
  body('firstName').isLength({ min: 1, max: 100 }).trim(),
  body('lastName').isLength({ min: 1, max: 100 }).trim(),
  body('phone').optional().isLength({ min: 10, max: 20 }),
  body('company').optional().isLength({ max: 200 }),
  body('nationalId').optional().isLength({ min: 5, max: 50 }),
  body('visitorType').optional().isIn(['guest', 'contractor', 'vendor', 'employee_guest', 'interview', 'delivery', 'maintenance', 'other']),
  body('gdprConsent').isBoolean(),
  body('photoConsent').optional().isBoolean(),
  body('marketingConsent').optional().isBoolean()
];

const visitValidation = [
  body('purpose').isLength({ min: 1, max: 500 }).trim(),
  body('hostId').isUUID(),
  body('expectedDuration').optional().isInt({ min: 15, max: 1440 }), // 15 minutes to 24 hours
  body('scheduledArrival').optional().isISO8601(),
  body('location').optional().isLength({ max: 100 }),
  body('floor').optional().isLength({ max: 10 }),
  body('room').optional().isLength({ max: 50 })
];

// GET /api/visitors - Get all visitors with filtering and pagination
router.get('/', requireAdminOrReceptionistOrSecurity, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      visitorType = '',
      isBlacklisted = '',
      isRecurring = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const whereClause = {};
    
    // Search filter
    if (search) {
      whereClause[Visitor.sequelize.Sequelize.Op.or] = [
        { firstName: { [Visitor.sequelize.Sequelize.Op.iLike]: `%${search}%` } },
        { lastName: { [Visitor.sequelize.Sequelize.Op.iLike]: `%${search}%` } },
        { email: { [Visitor.sequelize.Sequelize.Op.iLike]: `%${search}%` } },
        { company: { [Visitor.sequelize.Sequelize.Op.iLike]: `%${search}%` } }
      ];
    }

    // Filters
    if (visitorType) whereClause.visitorType = visitorType;
    if (isBlacklisted !== '') whereClause.isBlacklisted = isBlacklisted === 'true';
    if (isRecurring !== '') whereClause.isRecurring = isRecurring === 'true';

    const offset = (page - 1) * limit;

    const { count, rows } = await Visitor.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset,
      include: [
        {
          model: Visit,
          as: 'visits',
          attributes: ['id', 'purpose', 'status', 'checkedInAt', 'checkedOutAt'],
          limit: 5,
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'VISITORS_VIEWED',
      resource: 'visitors',
      details: { page, limit, search, visitorType, isBlacklisted, isRecurring },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'data_access'
    });

    res.json({
      visitors: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    logger.error('Failed to get visitors:', error);
    res.status(500).json({
      error: 'Failed to retrieve visitors',
      message: 'Internal server error'
    });
  }
});

// GET /api/visitors/:id - Get visitor by ID
router.get('/:id', requireAdminOrReceptionistOrSecurity, async (req, res) => {
  try {
    const visitor = await Visitor.findByPk(req.params.id, {
      include: [
        {
          model: Visit,
          as: 'visits',
          include: [
            {
              model: User,
              as: 'host',
              attributes: ['id', 'firstName', 'lastName', 'email', 'department']
            }
          ],
          order: [['createdAt', 'DESC']]
        },
        {
          model: ConsentRecord,
          as: 'consents',
          where: { isActive: true },
          required: false
        }
      ]
    });

    if (!visitor) {
      return res.status(404).json({
        error: 'Visitor not found',
        message: 'The requested visitor does not exist'
      });
    }

    await createAuditLog({
      userId: req.user.id,
      visitorId: visitor.id,
      action: 'VISITOR_VIEWED',
      resource: 'visitor',
      resourceId: visitor.id,
      details: { visitorEmail: visitor.email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'data_access'
    });

    res.json({ visitor });

  } catch (error) {
    logger.error('Failed to get visitor:', error);
    res.status(500).json({
      error: 'Failed to retrieve visitor',
      message: 'Internal server error'
    });
  }
});

// POST /api/visitors - Create new visitor
router.post('/', requireAdminOrReceptionist, visitorValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0].msg
      });
    }

    const {
      email,
      firstName,
      lastName,
      phone,
      company,
      nationalId,
      address,
      emergencyContact,
      customFields,
      visitorType,
      notes,
      gdprConsent,
      photoConsent,
      marketingConsent,
      biometricConsent
    } = req.body;

    // Check if visitor already exists
    const existingVisitor = await Visitor.findByEmail(email);
    if (existingVisitor) {
      return res.status(409).json({
        error: 'Visitor already exists',
        message: 'A visitor with this email already exists'
      });
    }

    // Create visitor
    const visitor = await Visitor.create({
      email,
      firstName,
      lastName,
      phone,
      company,
      nationalId,
      address,
      emergencyContact,
      customFields,
      visitorType,
      notes,
      gdprConsent,
      gdprConsentDate: gdprConsent ? new Date() : null,
      photoConsent: photoConsent || false,
      photoConsentDate: photoConsent ? new Date() : null,
      marketingConsent: marketingConsent || false,
      marketingConsentDate: marketingConsent ? new Date() : null,
      biometricConsent: biometricConsent || false,
      biometricConsentDate: biometricConsent ? new Date() : null
    });

    // Create consent records
    const consentRecords = [];
    
    if (gdprConsent) {
      consentRecords.push({
        visitorId: visitor.id,
        consentType: 'gdpr_processing',
        consentStatus: 'granted',
        consentText: 'I consent to the processing of my personal data for visitor management purposes',
        consentMethod: 'web_form',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        processingPurpose: 'Visitor management and security',
        dataCategories: ['personal_data', 'contact_information'],
        legalBasis: 'consent'
      });
    }

    if (photoConsent) {
      consentRecords.push({
        visitorId: visitor.id,
        consentType: 'photo_capture',
        consentStatus: 'granted',
        consentText: 'I consent to having my photo taken for visitor identification purposes',
        consentMethod: 'web_form',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        processingPurpose: 'Visitor identification and security',
        dataCategories: ['biometric_data', 'photos'],
        legalBasis: 'consent'
      });
    }

    if (marketingConsent) {
      consentRecords.push({
        visitorId: visitor.id,
        consentType: 'marketing_communications',
        consentStatus: 'granted',
        consentText: 'I consent to receive marketing communications',
        consentMethod: 'web_form',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        processingPurpose: 'Marketing and promotional communications',
        dataCategories: ['contact_information'],
        legalBasis: 'consent'
      });
    }

    if (biometricConsent) {
      consentRecords.push({
        visitorId: visitor.id,
        consentType: 'biometric_data',
        consentStatus: 'granted',
        consentText: 'I consent to biometric data processing for identification purposes',
        consentMethod: 'web_form',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        processingPurpose: 'Biometric identification and security',
        dataCategories: ['biometric_data'],
        legalBasis: 'consent'
      });
    }

    if (consentRecords.length > 0) {
      await ConsentRecord.bulkCreate(consentRecords);
    }

    await createAuditLog({
      userId: req.user.id,
      visitorId: visitor.id,
      action: 'VISITOR_CREATED',
      resource: 'visitor',
      resourceId: visitor.id,
      details: { visitorEmail: visitor.email, visitorType },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'data_modification',
      severity: 'medium'
    });

    res.status(201).json({
      visitor,
      message: 'Visitor created successfully'
    });

  } catch (error) {
    logger.error('Failed to create visitor:', error);
    res.status(500).json({
      error: 'Failed to create visitor',
      message: 'Internal server error'
    });
  }
});

// PUT /api/visitors/:id - Update visitor
router.put('/:id', requireAdminOrReceptionist, visitorValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0].msg
      });
    }

    const visitor = await Visitor.findByPk(req.params.id);
    if (!visitor) {
      return res.status(404).json({
        error: 'Visitor not found',
        message: 'The requested visitor does not exist'
      });
    }

    const oldValues = visitor.toJSON();
    const {
      email,
      firstName,
      lastName,
      phone,
      company,
      nationalId,
      address,
      emergencyContact,
      customFields,
      visitorType,
      notes
    } = req.body;

    // Check if email is being changed and if it conflicts with existing visitor
    if (email !== visitor.email) {
      const existingVisitor = await Visitor.findByEmail(email);
      if (existingVisitor && existingVisitor.id !== visitor.id) {
        return res.status(409).json({
          error: 'Email already exists',
          message: 'Another visitor with this email already exists'
        });
      }
    }

    // Update visitor
    await visitor.update({
      email,
      firstName,
      lastName,
      phone,
      company,
      nationalId,
      address,
      emergencyContact,
      customFields,
      visitorType,
      notes
    });

    await createAuditLog({
      userId: req.user.id,
      visitorId: visitor.id,
      action: 'VISITOR_UPDATED',
      resource: 'visitor',
      resourceId: visitor.id,
      details: { visitorEmail: visitor.email },
      oldValues,
      newValues: visitor.toJSON(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'data_modification',
      severity: 'medium'
    });

    res.json({
      visitor,
      message: 'Visitor updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update visitor:', error);
    res.status(500).json({
      error: 'Failed to update visitor',
      message: 'Internal server error'
    });
  }
});

// POST /api/visitors/:id/photo - Upload visitor photo
router.post('/:id/photo', requireAdminOrReceptionist, upload.single('photo'), async (req, res) => {
  try {
    const visitor = await Visitor.findByPk(req.params.id);
    if (!visitor) {
      return res.status(404).json({
        error: 'Visitor not found',
        message: 'The requested visitor does not exist'
      });
    }

    if (!visitor.canTakePhoto()) {
      return res.status(403).json({
        error: 'Photo consent required',
        message: 'Visitor has not consented to photo capture'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please provide a photo file'
      });
    }

    // Process and optimize the image
    const processedFilename = `processed-${req.file.filename}`;
    const processedPath = path.join(path.dirname(req.file.path), processedFilename);

    await sharp(req.file.path)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toFile(processedPath);

    // Remove original file
    fs.unlinkSync(req.file.path);

    // Delete old photo if exists
    if (visitor.photo) {
      const oldPhotoPath = path.join(__dirname, '../../uploads/photos', visitor.photo);
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    // Update visitor with new photo
    await visitor.update({
      photo: processedFilename
    });

    await createAuditLog({
      userId: req.user.id,
      visitorId: visitor.id,
      action: 'VISITOR_PHOTO_UPLOADED',
      resource: 'visitor',
      resourceId: visitor.id,
      details: { 
        visitorEmail: visitor.email,
        filename: processedFilename,
        fileSize: req.file.size
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'data_modification',
      severity: 'medium'
    });

    res.json({
      photo: processedFilename,
      message: 'Photo uploaded successfully'
    });

  } catch (error) {
    logger.error('Failed to upload photo:', error);
    res.status(500).json({
      error: 'Failed to upload photo',
      message: 'Internal server error'
    });
  }
});

// POST /api/visitors/:id/blacklist - Blacklist visitor
router.post('/:id/blacklist', requireAdminOrReceptionist, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        error: 'Reason required',
        message: 'Please provide a reason for blacklisting'
      });
    }

    const visitor = await Visitor.findByPk(req.params.id);
    if (!visitor) {
      return res.status(404).json({
        error: 'Visitor not found',
        message: 'The requested visitor does not exist'
      });
    }

    if (visitor.isBlacklisted) {
      return res.status(400).json({
        error: 'Already blacklisted',
        message: 'Visitor is already blacklisted'
      });
    }

    await visitor.update({
      isBlacklisted: true,
      blacklistReason: reason,
      blacklistedBy: req.user.id,
      blacklistedAt: new Date()
    });

    await createAuditLog({
      userId: req.user.id,
      visitorId: visitor.id,
      action: 'VISITOR_BLACKLISTED',
      resource: 'visitor',
      resourceId: visitor.id,
      details: { 
        visitorEmail: visitor.email,
        reason
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'security',
      severity: 'high',
      riskLevel: 'high'
    });

    res.json({
      message: 'Visitor blacklisted successfully'
    });

  } catch (error) {
    logger.error('Failed to blacklist visitor:', error);
    res.status(500).json({
      error: 'Failed to blacklist visitor',
      message: 'Internal server error'
    });
  }
});

// DELETE /api/visitors/:id/blacklist - Remove from blacklist
router.delete('/:id/blacklist', requireAdminOrReceptionist, async (req, res) => {
  try {
    const visitor = await Visitor.findByPk(req.params.id);
    if (!visitor) {
      return res.status(404).json({
        error: 'Visitor not found',
        message: 'The requested visitor does not exist'
      });
    }

    if (!visitor.isBlacklisted) {
      return res.status(400).json({
        error: 'Not blacklisted',
        message: 'Visitor is not blacklisted'
      });
    }

    await visitor.update({
      isBlacklisted: false,
      blacklistReason: null,
      blacklistedBy: null,
      blacklistedAt: null
    });

    await createAuditLog({
      userId: req.user.id,
      visitorId: visitor.id,
      action: 'VISITOR_UNBLACKLISTED',
      resource: 'visitor',
      resourceId: visitor.id,
      details: { visitorEmail: visitor.email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'security',
      severity: 'medium'
    });

    res.json({
      message: 'Visitor removed from blacklist successfully'
    });

  } catch (error) {
    logger.error('Failed to remove visitor from blacklist:', error);
    res.status(500).json({
      error: 'Failed to remove visitor from blacklist',
      message: 'Internal server error'
    });
  }
});

module.exports = router;