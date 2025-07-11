const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Visit, Visitor, User } = require('../models');
const { requireRole } = require('../middleware/auth');

// Get visitor report
router.get('/visitors', requireRole(['admin', 'receptionist']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const visitors = await Visitor.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate || new Date()]
        }
      },
      include: [
        {
          model: Visit,
          as: 'visits'
        }
      ]
    });
    
    res.json(visitors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get visits report
router.get('/visits', requireRole(['admin', 'receptionist']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const visits = await Visit.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate || new Date()]
        }
      },
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
    
    res.json(visits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get security report
router.get('/security', requireRole(['admin', 'security']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const securityEvents = await Visit.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), endDate || new Date()]
        },
        status: ['flagged', 'denied']
      },
      include: [
        {
          model: Visitor,
          as: 'visitor'
        }
      ]
    });
    
    res.json(securityEvents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;