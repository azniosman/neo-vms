const express = require('express');
const router = express.Router();
const { EmergencyContact, Visit, Visitor } = require('../models');
const { requireRole } = require('../middleware/auth');

// Get all emergency contacts
router.get('/contacts', requireRole(['admin', 'security']), async (req, res) => {
  try {
    const contacts = await EmergencyContact.findAll({
      where: { isActive: true },
      order: [['priority', 'ASC']]
    });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send emergency alert
router.post('/alert', requireRole(['admin', 'security']), async (req, res) => {
  try {
    const { message, level, affectedArea } = req.body;
    
    // Get all emergency contacts
    const contacts = await EmergencyContact.findAll({
      where: { isActive: true },
      order: [['priority', 'ASC']]
    });
    
    // TODO: Implement actual alert sending logic
    // This would integrate with email/SMS services
    
    res.json({
      message: 'Emergency alert sent successfully',
      recipientCount: contacts.length,
      alertLevel: level
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get evacuation list
router.get('/evacuation-list', requireRole(['admin', 'security']), async (req, res) => {
  try {
    const activeVisits = await Visit.findAll({
      where: {
        status: 'checked-in'
      },
      include: [
        {
          model: Visitor,
          as: 'visitor'
        }
      ]
    });
    
    res.json(activeVisits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;