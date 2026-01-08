/**
 * Profile Routes
 * Handles user profile management and avatar uploads
 */

'use strict';

const express = require('express');
const validator = require('validator');

const dbUnified = require('../db-unified');
const { authRequired } = require('../middleware/auth');
const photoUpload = require('../photo-upload');

const router = express.Router();

// Use shared photo upload configuration for avatars (memory storage)
// This ensures consistent validation and security across all uploads
const avatarUpload = photoUpload.upload;

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
 * Uses hardened upload pipeline with magic-byte validation and metadata stripping
 */
router.post('/avatar', authRequired, (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  avatarUpload.single('avatar')(req, res, async err => {
    // Handle multer errors with consistent JSON responses
    if (err) {
      if (err instanceof require('multer').MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const maxSizeMB = Math.floor(photoUpload.MAX_FILE_SIZE_AVATAR / 1024 / 1024);
          return res
            .status(413)
            .json({ error: `File too large. Maximum size is ${maxSizeMB}MB` });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      // Process avatar using hardened upload pipeline
      // This includes: magic-byte validation, pixel limits, metadata stripping
      // Use square cover crop (400x400) for avatars
      const images = await photoUpload.processAndSaveImage(
        req.file.buffer,
        `avatar-${req.user.id}.jpg`,
        'avatar' // Use avatar-specific size limits
      );

      // Update user avatar URL (use optimized version which is square 400x400)
      const users = await dbUnified.read('users');
      const idx = users.findIndex(u => u.id === req.user.id);

      if (idx === -1) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Store avatar URL
      users[idx].avatarUrl = images.optimized;
      users[idx].updatedAt = new Date().toISOString();
      await dbUnified.write('users', users);

      res.json({
        ok: true,
        avatarUrl: users[idx].avatarUrl,
      });
    } catch (processError) {
      console.error('Avatar processing error:', processError);
      
      // Handle validation errors with appropriate status codes
      if (processError.name === 'ValidationError') {
        return res.status(400).json({
          error: processError.message,
          details: processError.details,
        });
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

  // Delete avatar using centralized photo deletion
  try {
    await photoUpload.deleteImage(users[idx].avatarUrl);
  } catch (deleteErr) {
    console.error('Failed to delete avatar file:', deleteErr);
    // Continue anyway to clean up database record
  }

  // Remove avatar URL from user
  delete users[idx].avatarUrl;
  users[idx].updatedAt = new Date().toISOString();
  await dbUnified.write('users', users);

  res.json({ ok: true });
});

module.exports = router;
