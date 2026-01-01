/**
 * Profile Routes
 * Handles user profile management and avatar uploads
 */

'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const validator = require('validator');
const sharp = require('sharp');

const dbUnified = require('../db-unified');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Configuration from environment variables
const AVATAR_MAX_MB = parseInt(process.env.AVATAR_MAX_MB || '5', 10);
const AVATAR_MAX_BYTES = AVATAR_MAX_MB * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = (process.env.AVATAR_ALLOWED_TYPES || 'jpeg,jpg,png,webp')
  .split(',')
  .map(t => t.trim().toLowerCase());
const AVATAR_STORAGE_PATH = process.env.AVATAR_STORAGE_PATH || 'uploads/avatars';

// Ensure avatar storage directory exists
const avatarDir = path.join(__dirname, '..', AVATAR_STORAGE_PATH);
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
  console.log(`📁 Created avatar directory: ${avatarDir}`);
}

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, avatarDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with user ID and timestamp
    const userId = req.user.id;
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    cb(null, `${userId}-${timestamp}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: AVATAR_MAX_BYTES,
  },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    const mimeParts = file.mimetype.split('/');
    const mimeSubtype = mimeParts[1] ? mimeParts[1].toLowerCase() : '';

    if (AVATAR_ALLOWED_TYPES.includes(ext) || AVATAR_ALLOWED_TYPES.includes(mimeSubtype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${AVATAR_ALLOWED_TYPES.join(', ')}`));
    }
  },
});

/**
 * GET /api/profile
 * Get current user's profile
 */
router.get('/', authRequired, async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const users = await dbUnified.read('users');
  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Return profile without sensitive data
  res.json({
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    location: user.location,
    postcode: user.postcode,
    company: user.company,
    jobTitle: user.jobTitle,
    website: user.website,
    socials: user.socials || {},
    avatarUrl: user.avatarUrl,
    badges: user.badges || [],
    isPro: user.isPro || false,
    proExpiresAt: user.proExpiresAt || null,
  });
});

/**
 * PUT /api/profile
 * Update current user's profile
 */
router.put('/', authRequired, async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { firstName, lastName, location, postcode, company, jobTitle, website, socials } =
    req.body || {};

  const users = await dbUnified.read('users');
  const idx = users.findIndex(u => u.id === req.user.id);

  if (idx === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[idx];

  // Validate required fields
  if (firstName !== undefined) {
    if (!firstName || !String(firstName).trim()) {
      return res.status(400).json({ error: 'First name is required' });
    }
    user.firstName = String(firstName).trim().slice(0, 40);
  }

  if (lastName !== undefined) {
    if (!lastName || !String(lastName).trim()) {
      return res.status(400).json({ error: 'Last name is required' });
    }
    user.lastName = String(lastName).trim().slice(0, 40);
  }

  // Update full name if first or last name changed
  if (firstName !== undefined || lastName !== undefined) {
    const newFirstName = firstName !== undefined ? user.firstName : user.firstName || '';
    const newLastName = lastName !== undefined ? user.lastName : user.lastName || '';
    user.name = `${newFirstName} ${newLastName}`.trim().slice(0, 80);
  }

  if (location !== undefined) {
    if (!location || !String(location).trim()) {
      return res.status(400).json({ error: 'Location is required' });
    }
    user.location = String(location).trim().slice(0, 100);
  }

  // Role-specific validation
  if (user.role === 'supplier' && company !== undefined) {
    if (!company || !String(company).trim()) {
      return res.status(400).json({ error: 'Company name is required for suppliers' });
    }
    user.company = String(company).trim().slice(0, 100);
  } else if (company !== undefined) {
    user.company = company ? String(company).trim().slice(0, 100) : undefined;
  }

  // Optional fields
  if (postcode !== undefined) {
    user.postcode = postcode ? String(postcode).trim().slice(0, 10) : undefined;
  }

  if (jobTitle !== undefined) {
    user.jobTitle = jobTitle ? String(jobTitle).trim().slice(0, 100) : undefined;
  }

  // Sanitize and validate URLs
  const sanitizeUrl = url => {
    if (!url) {
      return undefined;
    }
    const trimmed = String(url).trim();
    if (!trimmed) {
      return undefined;
    }
    if (!validator.isURL(trimmed, { require_protocol: false })) {
      throw new Error('Invalid URL format');
    }
    return trimmed;
  };

  if (website !== undefined) {
    try {
      user.website = sanitizeUrl(website);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid website URL' });
    }
  }

  if (socials !== undefined) {
    try {
      user.socials = {
        instagram: sanitizeUrl(socials.instagram),
        facebook: sanitizeUrl(socials.facebook),
        twitter: sanitizeUrl(socials.twitter),
        linkedin: sanitizeUrl(socials.linkedin),
      };
    } catch (error) {
      return res.status(400).json({ error: 'Invalid social media URL' });
    }
  }

  user.updatedAt = new Date().toISOString();
  await dbUnified.write('users', users);

  res.json({
    ok: true,
    profile: {
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      location: user.location,
      postcode: user.postcode,
      company: user.company,
      jobTitle: user.jobTitle,
      website: user.website,
      socials: user.socials || {},
      avatarUrl: user.avatarUrl,
      badges: user.badges || [],
    },
  });
});

/**
 * POST /api/profile/avatar
 * Upload or replace user avatar
 */
router.post('/avatar', authRequired, (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  upload.single('avatar')(req, res, async err => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res
            .status(400)
            .json({ error: `File too large. Maximum size is ${AVATAR_MAX_MB}MB` });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      // Process image with sharp (resize, optimize)
      const processedFilename = `${req.user.id}-${Date.now()}-processed.jpg`;
      const processedPath = path.join(avatarDir, processedFilename);

      await sharp(req.file.path)
        .resize(400, 400, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 90 })
        .toFile(processedPath);

      // Delete original uploaded file
      fs.unlinkSync(req.file.path);

      // Update user avatar URL
      const users = await dbUnified.read('users');
      const idx = users.findIndex(u => u.id === req.user.id);

      if (idx === -1) {
        // Clean up uploaded file
        fs.unlinkSync(processedPath);
        return res.status(404).json({ error: 'User not found' });
      }

      // Delete old avatar if exists
      if (users[idx].avatarUrl) {
        const oldAvatarPath = path.join(__dirname, '..', users[idx].avatarUrl.replace(/^\//, ''));
        if (fs.existsSync(oldAvatarPath)) {
          try {
            fs.unlinkSync(oldAvatarPath);
          } catch (unlinkErr) {
            console.error('Failed to delete old avatar:', unlinkErr);
          }
        }
      }

      // Store relative URL path
      users[idx].avatarUrl = `/${AVATAR_STORAGE_PATH}/${processedFilename}`;
      users[idx].updatedAt = new Date().toISOString();
      await dbUnified.write('users', users);

      res.json({
        ok: true,
        avatarUrl: users[idx].avatarUrl,
      });
    } catch (processError) {
      console.error('Avatar processing error:', processError);
      // Clean up uploaded file if processing failed
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Failed to process avatar image' });
    }
  });
});

/**
 * DELETE /api/profile/avatar
 * Delete user avatar
 */
router.delete('/avatar', authRequired, async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const users = await dbUnified.read('users');
  const idx = users.findIndex(u => u.id === req.user.id);

  if (idx === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!users[idx].avatarUrl) {
    return res.status(404).json({ error: 'No avatar to delete' });
  }

  // Delete avatar file
  const avatarPath = path.join(__dirname, '..', users[idx].avatarUrl.replace(/^\//, ''));
  if (fs.existsSync(avatarPath)) {
    try {
      fs.unlinkSync(avatarPath);
    } catch (unlinkErr) {
      console.error('Failed to delete avatar file:', unlinkErr);
    }
  }

  // Remove avatar URL from user
  delete users[idx].avatarUrl;
  users[idx].updatedAt = new Date().toISOString();
  await dbUnified.write('users', users);

  res.json({ ok: true });
});

module.exports = router;
