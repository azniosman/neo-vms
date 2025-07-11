const express = require('express');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs').promises;
const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Upload visitor photo
router.post('/visitor-photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = `visitor-${Date.now()}.jpg`;
    const filepath = path.join(__dirname, '../../uploads', filename);

    // Process image with sharp
    await sharp(req.file.buffer)
      .resize(300, 300)
      .jpeg({ quality: 80 })
      .toFile(filepath);

    res.json({
      filename: filename,
      path: `/uploads/${filename}`,
      size: req.file.size
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload document
router.post('/document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = `document-${Date.now()}-${req.file.originalname}`;
    const filepath = path.join(__dirname, '../../uploads', filename);

    await fs.writeFile(filepath, req.file.buffer);

    res.json({
      filename: filename,
      path: `/uploads/${filename}`,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;