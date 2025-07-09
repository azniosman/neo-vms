const express = require('express');
const { body, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const { Visit, Visitor, User } = require('../models');
const { requireAdminOrReceptionistOrSecurity, requireAdminOrReceptionist } = require('../middleware/auth');
const { createAuditLog } = require('../services/auditService');
const { sendVisitorArrivalNotification, sendVisitorDepartureNotification } = require('../services/notificationService');
const { sendNotificationToUser, sendNotificationToRole } = require('../services/socketService');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const visitValidation = [
  body('visitorId').isUUID(),
  body('hostId').isUUID(),
  body('purpose').isLength({ min: 1, max: 500 }).trim(),
  body('expectedDuration').optional().isInt({ min: 15, max: 1440 }),
  body('scheduledArrival').optional().isISO8601(),
  body('location').optional().isLength({ max: 100 }),
  body('floor').optional().isLength({ max: 10 }),
  body('room').optional().isLength({ max: 50 })
];

// GET /api/visits - Get all visits with filtering and pagination
router.get('/', requireAdminOrReceptionistOrSecurity, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = '',
      hostId = '',
      visitorId = '',
      startDate = '',
      endDate = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const whereClause = {};
    
    // Filters
    if (status) whereClause.status = status;
    if (hostId) whereClause.hostId = hostId;
    if (visitorId) whereClause.visitorId = visitorId;
    
    // Date range filter
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Visit.sequelize.Sequelize.Op.gte] = new Date(startDate);
      if (endDate) whereClause.createdAt[Visit.sequelize.Sequelize.Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Visit.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset,
      include: [
        {
          model: Visitor,
          as: 'visitor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'company', 'phone', 'photo']
        },
        {
          model: User,
          as: 'host',
          attributes: ['id', 'firstName', 'lastName', 'email', 'department']
        },
        {
          model: User,
          as: 'checkedInByUser',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          required: false
        },
        {
          model: User,
          as: 'checkedOutByUser',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          required: false
        }
      ]
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'VISITS_VIEWED',
      resource: 'visits',
      details: { page, limit, status, hostId, visitorId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'data_access'
    });

    res.json({
      visits: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    logger.error('Failed to get visits:', error);
    res.status(500).json({
      error: 'Failed to retrieve visits',
      message: 'Internal server error'
    });
  }
});

// GET /api/visits/active - Get active visits
router.get('/active', requireAdminOrReceptionistOrSecurity, async (req, res) => {
  try {
    const activeVisits = await Visit.findActive({
      include: [
        {
          model: Visitor,
          as: 'visitor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'company', 'phone', 'photo']
        },
        {
          model: User,
          as: 'host',
          attributes: ['id', 'firstName', 'lastName', 'email', 'department']
        }
      ]
    });

    res.json({
      visits: activeVisits,
      count: activeVisits.length
    });

  } catch (error) {
    logger.error('Failed to get active visits:', error);
    res.status(500).json({
      error: 'Failed to retrieve active visits',
      message: 'Internal server error'
    });
  }
});

// GET /api/visits/occupancy - Get current occupancy
router.get('/occupancy', requireAdminOrReceptionistOrSecurity, async (req, res) => {
  try {
    const currentOccupancy = await Visit.findCurrentOccupancy();
    const maxOccupancy = parseInt(process.env.MAX_OCCUPANCY) || 100;
    
    res.json({
      currentOccupancy,
      maxOccupancy,
      occupancyRate: currentOccupancy / maxOccupancy,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Failed to get occupancy:', error);
    res.status(500).json({
      error: 'Failed to retrieve occupancy',
      message: 'Internal server error'
    });
  }
});

// GET /api/visits/overdue - Get overdue visits
router.get('/overdue', requireAdminOrReceptionistOrSecurity, async (req, res) => {
  try {
    const overdueVisits = await Visit.findOverdue({
      include: [
        {
          model: Visitor,
          as: 'visitor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'company', 'phone']
        },
        {
          model: User,
          as: 'host',
          attributes: ['id', 'firstName', 'lastName', 'email', 'department']
        }
      ]
    });

    res.json({
      visits: overdueVisits,
      count: overdueVisits.length
    });

  } catch (error) {
    logger.error('Failed to get overdue visits:', error);
    res.status(500).json({
      error: 'Failed to retrieve overdue visits',
      message: 'Internal server error'
    });
  }
});

// GET /api/visits/:id - Get visit by ID
router.get('/:id', requireAdminOrReceptionistOrSecurity, async (req, res) => {
  try {
    const visit = await Visit.findByPk(req.params.id, {
      include: [
        {
          model: Visitor,
          as: 'visitor'
        },
        {
          model: User,
          as: 'host',
          attributes: ['id', 'firstName', 'lastName', 'email', 'department']
        },
        {
          model: User,
          as: 'checkedInByUser',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          required: false
        },
        {
          model: User,
          as: 'checkedOutByUser',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          required: false
        }
      ]
    });

    if (!visit) {
      return res.status(404).json({
        error: 'Visit not found',
        message: 'The requested visit does not exist'
      });
    }

    await createAuditLog({
      userId: req.user.id,
      visitId: visit.id,
      action: 'VISIT_VIEWED',
      resource: 'visit',
      resourceId: visit.id,
      details: { purpose: visit.purpose },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'data_access'
    });

    res.json({ visit });

  } catch (error) {
    logger.error('Failed to get visit:', error);
    res.status(500).json({
      error: 'Failed to retrieve visit',
      message: 'Internal server error'
    });
  }
});

// POST /api/visits - Create new visit
router.post('/', requireAdminOrReceptionist, visitValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0].msg
      });
    }

    const {
      visitorId,
      hostId,
      purpose,
      expectedDuration,
      scheduledArrival,
      location,
      floor,
      room,
      vehicleNumber,
      parkingSlot,
      items,
      customFields,
      notes
    } = req.body;

    // Verify visitor exists
    const visitor = await Visitor.findByPk(visitorId);
    if (!visitor) {
      return res.status(404).json({
        error: 'Visitor not found',
        message: 'The specified visitor does not exist'
      });
    }

    // Verify host exists
    const host = await User.findByPk(hostId);
    if (!host) {
      return res.status(404).json({
        error: 'Host not found',
        message: 'The specified host does not exist'
      });
    }

    // Check if visitor is blacklisted
    if (visitor.isBlacklisted) {
      return res.status(403).json({
        error: 'Visitor blacklisted',
        message: 'This visitor is blacklisted and cannot visit'
      });
    }

    // Generate QR code
    const qrCodeData = {
      visitId: uuidv4(),
      visitorId,
      hostId,
      purpose,
      timestamp: new Date().toISOString()
    };
    
    const qrCodeString = JSON.stringify(qrCodeData);
    const qrCode = await QRCode.toDataURL(qrCodeString);

    // Create visit
    const visit = await Visit.create({
      id: qrCodeData.visitId,
      visitorId,
      hostId,
      purpose,
      expectedDuration,
      scheduledArrival,
      location,
      floor,
      room,
      vehicleNumber,
      parkingSlot,
      items,
      customFields,
      notes,
      qrCode: qrCodeString,
      qrCodeExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      preRegisteredAt: new Date(),
      status: 'pre_registered'
    });

    // Update visitor stats
    await visitor.updateVisitStats();

    await createAuditLog({
      userId: req.user.id,
      visitId: visit.id,
      visitorId,
      action: 'VISIT_CREATED',
      resource: 'visit',
      resourceId: visit.id,
      details: { purpose, hostId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'data_modification',
      severity: 'medium'
    });

    // Send notification to host
    sendNotificationToUser(hostId, 'visit_scheduled', {
      visitId: visit.id,
      visitorName: visitor.getFullName(),
      company: visitor.company,
      purpose,
      scheduledArrival
    });

    res.status(201).json({
      visit,
      qrCode,
      message: 'Visit created successfully'
    });

  } catch (error) {
    logger.error('Failed to create visit:', error);
    res.status(500).json({
      error: 'Failed to create visit',
      message: 'Internal server error'
    });
  }
});

// POST /api/visits/:id/checkin - Check in visitor
router.post('/:id/checkin', requireAdminOrReceptionist, async (req, res) => {
  try {
    const visit = await Visit.findByPk(req.params.id, {
      include: [
        {
          model: Visitor,
          as: 'visitor'
        },
        {
          model: User,
          as: 'host'
        }
      ]
    });

    if (!visit) {
      return res.status(404).json({
        error: 'Visit not found',
        message: 'The requested visit does not exist'
      });
    }

    if (visit.status === 'checked_in') {
      return res.status(400).json({
        error: 'Already checked in',
        message: 'Visitor is already checked in'
      });
    }

    if (visit.status === 'checked_out') {
      return res.status(400).json({
        error: 'Visit completed',
        message: 'This visit has already been completed'
      });
    }

    // Check if visitor is blacklisted
    if (visit.visitor.isBlacklisted) {
      return res.status(403).json({
        error: 'Visitor blacklisted',
        message: 'This visitor is blacklisted and cannot check in'
      });
    }

    // Check QR code expiry
    if (visit.isExpired()) {
      return res.status(400).json({
        error: 'QR code expired',
        message: 'The QR code for this visit has expired'
      });
    }

    // Check in visitor
    await visit.checkIn(req.user.id);

    await createAuditLog({
      userId: req.user.id,
      visitId: visit.id,
      visitorId: visit.visitorId,
      action: 'VISITOR_CHECKED_IN',
      resource: 'visit',
      resourceId: visit.id,
      details: { 
        visitorName: visit.visitor.getFullName(),
        purpose: visit.purpose 
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'system_access',
      severity: 'medium'
    });

    // Send notifications
    await sendVisitorArrivalNotification(visit);
    
    // Send real-time notification
    sendNotificationToUser(visit.hostId, 'visitor_checked_in', {
      visitId: visit.id,
      visitorName: visit.visitor.getFullName(),
      company: visit.visitor.company,
      checkedInAt: visit.checkedInAt
    });

    // Notify front desk
    sendNotificationToRole('receptionist', 'visitor_checked_in', {
      visitId: visit.id,
      visitorName: visit.visitor.getFullName(),
      hostName: visit.host.getFullName()
    });

    res.json({
      visit,
      message: 'Visitor checked in successfully'
    });

  } catch (error) {
    logger.error('Failed to check in visitor:', error);
    res.status(500).json({
      error: 'Failed to check in visitor',
      message: 'Internal server error'
    });
  }
});

// POST /api/visits/:id/checkout - Check out visitor
router.post('/:id/checkout', requireAdminOrReceptionist, async (req, res) => {
  try {
    const { rating, feedback } = req.body;

    const visit = await Visit.findByPk(req.params.id, {
      include: [
        {
          model: Visitor,
          as: 'visitor'
        },
        {
          model: User,
          as: 'host'
        }
      ]
    });

    if (!visit) {
      return res.status(404).json({
        error: 'Visit not found',
        message: 'The requested visit does not exist'
      });
    }

    if (visit.status !== 'checked_in') {
      return res.status(400).json({
        error: 'Not checked in',
        message: 'Visitor is not currently checked in'
      });
    }

    // Check out visitor
    await visit.checkOut(req.user.id);

    // Add rating and feedback if provided
    if (rating || feedback) {
      await visit.update({
        ratingGiven: rating,
        feedbackGiven: feedback,
        feedbackGivenAt: new Date()
      });
    }

    await createAuditLog({
      userId: req.user.id,
      visitId: visit.id,
      visitorId: visit.visitorId,
      action: 'VISITOR_CHECKED_OUT',
      resource: 'visit',
      resourceId: visit.id,
      details: { 
        visitorName: visit.visitor.getFullName(),
        duration: visit.actualDuration,
        rating,
        feedback: feedback ? 'Provided' : 'Not provided'
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'system_access',
      severity: 'medium'
    });

    // Send notifications
    await sendVisitorDepartureNotification(visit);
    
    // Send real-time notification
    sendNotificationToUser(visit.hostId, 'visitor_checked_out', {
      visitId: visit.id,
      visitorName: visit.visitor.getFullName(),
      duration: visit.actualDuration,
      checkedOutAt: visit.checkedOutAt
    });

    res.json({
      visit,
      message: 'Visitor checked out successfully'
    });

  } catch (error) {
    logger.error('Failed to check out visitor:', error);
    res.status(500).json({
      error: 'Failed to check out visitor',
      message: 'Internal server error'
    });
  }
});

// PUT /api/visits/:id - Update visit
router.put('/:id', requireAdminOrReceptionist, async (req, res) => {
  try {
    const visit = await Visit.findByPk(req.params.id);
    if (!visit) {
      return res.status(404).json({
        error: 'Visit not found',
        message: 'The requested visit does not exist'
      });
    }

    if (visit.status === 'checked_out') {
      return res.status(400).json({
        error: 'Visit completed',
        message: 'Cannot update a completed visit'
      });
    }

    const oldValues = visit.toJSON();
    const {
      purpose,
      expectedDuration,
      scheduledArrival,
      location,
      floor,
      room,
      vehicleNumber,
      parkingSlot,
      items,
      customFields,
      notes
    } = req.body;

    await visit.update({
      purpose,
      expectedDuration,
      scheduledArrival,
      location,
      floor,
      room,
      vehicleNumber,
      parkingSlot,
      items,
      customFields,
      notes
    });

    await createAuditLog({
      userId: req.user.id,
      visitId: visit.id,
      action: 'VISIT_UPDATED',
      resource: 'visit',
      resourceId: visit.id,
      oldValues,
      newValues: visit.toJSON(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'data_modification',
      severity: 'medium'
    });

    res.json({
      visit,
      message: 'Visit updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update visit:', error);
    res.status(500).json({
      error: 'Failed to update visit',
      message: 'Internal server error'
    });
  }
});

// DELETE /api/visits/:id - Cancel visit
router.delete('/:id', requireAdminOrReceptionist, async (req, res) => {
  try {
    const { reason } = req.body;

    const visit = await Visit.findByPk(req.params.id, {
      include: [
        {
          model: Visitor,
          as: 'visitor'
        },
        {
          model: User,
          as: 'host'
        }
      ]
    });

    if (!visit) {
      return res.status(404).json({
        error: 'Visit not found',
        message: 'The requested visit does not exist'
      });
    }

    if (visit.status === 'checked_out') {
      return res.status(400).json({
        error: 'Visit completed',
        message: 'Cannot cancel a completed visit'
      });
    }

    if (visit.status === 'checked_in') {
      return res.status(400).json({
        error: 'Visit active',
        message: 'Cannot cancel an active visit. Please check out the visitor first.'
      });
    }

    await visit.update({
      status: 'cancelled',
      notes: visit.notes ? `${visit.notes}\n\nCancelled: ${reason}` : `Cancelled: ${reason}`
    });

    await createAuditLog({
      userId: req.user.id,
      visitId: visit.id,
      visitorId: visit.visitorId,
      action: 'VISIT_CANCELLED',
      resource: 'visit',
      resourceId: visit.id,
      details: { reason },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      category: 'data_modification',
      severity: 'medium'
    });

    // Notify host
    sendNotificationToUser(visit.hostId, 'visit_cancelled', {
      visitId: visit.id,
      visitorName: visit.visitor.getFullName(),
      reason
    });

    res.json({
      message: 'Visit cancelled successfully'
    });

  } catch (error) {
    logger.error('Failed to cancel visit:', error);
    res.status(500).json({
      error: 'Failed to cancel visit',
      message: 'Internal server error'
    });
  }
});

module.exports = router;