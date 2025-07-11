const express = require('express');
const router = express.Router();
const { SystemSetting } = require('../models');
const { requireRole } = require('../middleware/auth');

// Get all settings
router.get('/', async (req, res) => {
  try {
    const settings = await SystemSetting.findAll();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get setting by key
router.get('/:key', async (req, res) => {
  try {
    const setting = await SystemSetting.findOne({
      where: { key: req.params.key }
    });
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update setting (admin only)
router.put('/:key', requireRole(['admin']), async (req, res) => {
  try {
    const [setting, created] = await SystemSetting.findOrCreate({
      where: { key: req.params.key },
      defaults: {
        key: req.params.key,
        value: req.body.value,
        description: req.body.description
      }
    });
    
    if (!created) {
      await setting.update({
        value: req.body.value,
        description: req.body.description
      });
    }
    
    res.json(setting);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete setting (admin only)
router.delete('/:key', requireRole(['admin']), async (req, res) => {
  try {
    const setting = await SystemSetting.findOne({
      where: { key: req.params.key }
    });
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    await setting.destroy();
    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;