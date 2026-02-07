/**
 * Packages Routes
 * CRUD operations for event packages
 */

'use strict';

const express = require('express');
const router = express.Router();

// Dependencies injected by server.js
let dbUnified;
let authRequired;
let roleRequired;
let csrfProtection;
let featureRequired;
let writeLimiter;
let photoUpload;
let uploadValidation;
let logger;
let uid;
let path;
let fs;
let DATA_DIR;
let supplierIsProActive;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Packages routes: dependencies object is required');
  }

  // Validate required dependencies
  const required = [
    'dbUnified',
    'authRequired',
    'roleRequired',
    'csrfProtection',
    'featureRequired',
    'writeLimiter',
    'photoUpload',
    'uploadValidation',
    'logger',
    'uid',
    'path',
    'fs',
    'DATA_DIR',
    'supplierIsProActive',
  ];

  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Packages routes: missing required dependencies: ${missing.join(', ')}`);
  }

  dbUnified = deps.dbUnified;
  authRequired = deps.authRequired;
  roleRequired = deps.roleRequired;
  csrfProtection = deps.csrfProtection;
  featureRequired = deps.featureRequired;
  writeLimiter = deps.writeLimiter;
  photoUpload = deps.photoUpload;
  uploadValidation = deps.uploadValidation;
  logger = deps.logger;
  uid = deps.uid;
  path = deps.path;
  fs = deps.fs;
  DATA_DIR = deps.DATA_DIR;
  supplierIsProActive = deps.supplierIsProActive;
}

/**
 * Deferred middleware wrappers
 * These are safe to reference in route definitions at require() time
 * because they defer the actual middleware call to request time,
 * when dependencies are guaranteed to be initialized.
 */
function applyAuthRequired(req, res, next) {
  if (!authRequired) {
    return res.status(503).json({ error: 'Auth service not initialized' });
  }
  return authRequired(req, res, next);
}

function applyRoleRequired(role) {
  return (req, res, next) => {
    if (!roleRequired) {
      return res.status(503).json({ error: 'Role service not initialized' });
    }
    return roleRequired(role)(req, res, next);
  };
}

function applyCsrfProtection(req, res, next) {
  if (!csrfProtection) {
    return res.status(503).json({ error: 'CSRF service not initialized' });
  }
  return csrfProtection(req, res, next);
}

function applyFeatureRequired(feature) {
  return (req, res, next) => {
    if (!featureRequired) {
      return res.status(503).json({ error: 'Feature service not initialized' });
    }
    return featureRequired(feature)(req, res, next);
  };
}

function applyWriteLimiter(req, res, next) {
  if (!writeLimiter) {
    return res.status(503).json({ error: 'Rate limiter not initialized' });
  }
  return writeLimiter(req, res, next);
}

function applyPhotoUploadSingle(fieldName) {
  return (req, res, next) => {
    if (!photoUpload) {
      return res.status(503).json({ error: 'Photo upload service not initialized' });
    }
    return photoUpload.upload.single(fieldName)(req, res, next);
  };
}

/**
 * Helper function to save base64 image
 */
function saveImageBase64(base64, ownerType, ownerId) {
  try {
    const match = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return null;
    }
    const ext = match[1].split('/')[1];
    const buffer = Buffer.from(match[2], 'base64');
    const UP_ROOT = path.join(DATA_DIR, 'uploads');
    const folder = path.join(UP_ROOT, ownerType, ownerId);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = path.join(folder, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${ownerType}/${ownerId}/${filename}`;
  } catch (e) {
    return null;
  }
}

/**
 * GET /api/me/packages
 * List supplier's packages
 */
router.get('/me/packages', applyAuthRequired, applyRoleRequired('supplier'), async (req, res) => {
  const mine = (await dbUnified.read('suppliers'))
    .filter(s => s.ownerUserId === req.user.id)
    .map(s => s.id);
  const items = (await dbUnified.read('packages')).filter(p => mine.includes(p.supplierId));
  res.json({ items });
});

/**
 * POST /api/me/packages
 * Create a new package
 */
router.post(
  '/me/packages',
  applyWriteLimiter,
  applyAuthRequired,
  applyRoleRequired('supplier'),
  applyCsrfProtection,
  async (req, res) => {
    const { supplierId, title, description, price, image, primaryCategoryKey, eventTypes } =
      req.body || {};
    if (!supplierId || !title) {
      return res.status(400).json({ error: 'Missing required fields: supplierId and title' });
    }

    // Validate new required fields for wizard compatibility
    if (!primaryCategoryKey) {
      return res.status(400).json({ error: 'Primary category is required' });
    }

    if (!eventTypes || !Array.isArray(eventTypes) || eventTypes.length === 0) {
      return res
        .status(400)
        .json({ error: 'At least one event type is required (wedding or other)' });
    }

    // Validate event types
    const validEventTypes = eventTypes.filter(t => t === 'wedding' || t === 'other');
    if (validEventTypes.length === 0) {
      return res.status(400).json({ error: 'Event types must be "wedding" or "other"' });
    }

    const own = (await dbUnified.read('suppliers')).find(
      s => s.id === supplierId && s.ownerUserId === req.user.id
    );
    if (!own) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const ownIsPro = supplierIsProActive(own);

    // Enforce a simple Free vs Pro package limit:
    // - Free suppliers can create up to FREE_PACKAGE_LIMIT packages (default 3)
    // - Pro suppliers have no limit
    const allPkgs = await dbUnified.read('packages');
    const existingForSupplier = allPkgs.filter(p => p.supplierId === supplierId);
    const freeLimit = Number(process.env.FREE_PACKAGE_LIMIT || 3);
    if (!ownIsPro && existingForSupplier.length >= freeLimit) {
      return res.status(403).json({
        error: `Free suppliers can create up to ${freeLimit} packages. Upgrade to Pro to add more.`,
      });
    }

    const pkg = {
      id: uid('pkg'),
      supplierId,
      title: String(title).slice(0, 120),
      description: String(description || '').slice(0, 1500),
      price: String(price || '').slice(0, 60),
      image: image || '',
      primaryCategoryKey: String(primaryCategoryKey),
      eventTypes: validEventTypes,
      approved: false,
      featured: false,
      createdAt: new Date().toISOString(),
    };
    const all = allPkgs;
    all.push(pkg);
    await dbUnified.write('packages', all);
    res.json({ ok: true, package: pkg });
  }
);

/**
 * POST /api/me/packages/:id/photos
 * Upload package photo (base64)
 */
router.post(
  '/me/packages/:id/photos',
  applyFeatureRequired('photoUploads'),
  applyAuthRequired,
  applyCsrfProtection,
  async (req, res) => {
    const { image } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: 'Missing image' });
    }
    const pkgs = await dbUnified.read('packages');
    const p = pkgs.find(x => x.id === req.params.id);
    if (!p) {
      return res.status(404).json({ error: 'Not found' });
    }
    const suppliers = await dbUnified.read('suppliers');
    const own = suppliers.find(x => x.id === p.supplierId && x.ownerUserId === req.userId);
    if (!own) {
      return res.status(403).json({ error: 'Not owner' });
    }
    const url = saveImageBase64(image, 'packages', req.params.id);
    if (!url) {
      return res.status(400).json({ error: 'Invalid image' });
    }
    if (!p.gallery) {
      p.gallery = [];
    }
    p.gallery.push({ url, approved: false, uploadedAt: Date.now() });
    await dbUnified.write('packages', pkgs);
    res.json({ ok: true, url });
  }
);

/**
 * GET /api/admin/packages
 * List all packages (admin only)
 */
router.get('/admin/packages', applyAuthRequired, applyRoleRequired('admin'), async (_req, res) => {
  res.json({ items: await dbUnified.read('packages') });
});

/**
 * POST /api/admin/packages/:id/approve
 * Approve or unapprove a package
 */
router.post(
  '/admin/packages/:id/approve',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  async (req, res) => {
    const all = await dbUnified.read('packages');
    const i = all.findIndex(p => p.id === req.params.id);
    if (i < 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    all[i].approved = !!(req.body && req.body.approved);
    await dbUnified.write('packages', all);
    res.json({ ok: true, package: all[i] });
  }
);

/**
 * POST /api/admin/packages/:id/feature
 * Feature or unfeature a package
 */
router.post(
  '/admin/packages/:id/feature',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  async (req, res) => {
    const all = await dbUnified.read('packages');
    const i = all.findIndex(p => p.id === req.params.id);
    if (i < 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    all[i].featured = !!(req.body && req.body.featured);
    await dbUnified.write('packages', all);
    res.json({ ok: true, package: all[i] });
  }
);

/**
 * PUT /api/admin/packages/:id
 * Update package details
 */
router.put(
  '/admin/packages/:id',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  async (req, res) => {
    const { id } = req.params;
    const packages = await dbUnified.read('packages');
    const pkgIndex = packages.findIndex(p => p.id === id);

    if (pkgIndex === -1) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const pkg = packages[pkgIndex];
    const now = new Date().toISOString();

    // Update allowed fields
    if (req.body.title) {
      pkg.title = req.body.title;
    }
    if (req.body.description) {
      pkg.description = req.body.description;
    }
    if (req.body.price_display) {
      pkg.price_display = req.body.price_display;
    }
    if (req.body.image) {
      pkg.image = req.body.image;
    }
    if (typeof req.body.approved === 'boolean') {
      pkg.approved = req.body.approved;
    }
    if (typeof req.body.featured === 'boolean') {
      pkg.featured = req.body.featured;
    }
    pkg.updatedAt = now;

    packages[pkgIndex] = pkg;
    await dbUnified.write('packages', packages);

    res.json({ ok: true, package: pkg });
  }
);

/**
 * DELETE /api/admin/packages/:id
 * Delete a package
 */
router.delete(
  '/admin/packages/:id',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  async (req, res) => {
    const { id } = req.params;
    const packages = await dbUnified.read('packages');
    const filtered = packages.filter(p => p.id !== id);

    if (filtered.length === packages.length) {
      return res.status(404).json({ error: 'Package not found' });
    }

    await dbUnified.write('packages', filtered);
    res.json({ ok: true, message: 'Package deleted successfully' });
  }
);

/**
 * POST /api/admin/packages/:id/image
 * Admin: Upload package image
 */
router.post(
  '/admin/packages/:id/image',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  applyPhotoUploadSingle('image'),
  async (req, res) => {
    try {
      const packageId = req.params.id;
      const packages = await dbUnified.read('packages');
      const packageIndex = packages.findIndex(p => p.id === packageId);

      if (packageIndex === -1) {
        return res.status(404).json({ error: 'Package not found' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      logger.info(`Processing package image upload for package ${packageId}`, {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });

      // Process and save the image
      const imageData = await photoUpload.processAndSaveImage(
        req.file.buffer,
        req.file.originalname,
        'supplier'
      );

      // Update package with new image URL
      packages[packageIndex].image = imageData.optimized || imageData.large;
      packages[packageIndex].updatedAt = new Date().toISOString();

      await dbUnified.write('packages', packages);

      logger.info(`Package image uploaded successfully for package ${packageId}`);

      res.json({
        ok: true,
        package: packages[packageIndex],
        imageUrl: packages[packageIndex].image,
      });
    } catch (error) {
      logger.error('Error uploading package image:', {
        error: error.message,
        name: error.name,
        details: error.details,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
      });

      // Handle validation errors with appropriate status codes and detailed feedback
      if (error.name === 'ValidationError') {
        const errorResponse = uploadValidation.formatValidationErrorResponse(error);

        // Guard against null response (should not happen but defensive coding)
        if (!errorResponse) {
          return res.status(400).json({
            error: error.message,
            details: error.details || {},
          });
        }

        // Log debug info for troubleshooting
        if (errorResponse.magicBytes) {
          logger.warn('File type validation failed - magic bytes:', {
            magicBytes: errorResponse.magicBytes,
            detectedType: errorResponse.details.detectedType,
          });
        }

        return res.status(400).json({
          error: errorResponse.error,
          details: errorResponse.details,
        });
      }

      // Handle Sharp processing errors
      if (error.name === 'SharpProcessingError') {
        return res.status(500).json({
          error: 'Failed to process image',
          details: 'Image processing library error. Please try a different image format or file.',
        });
      }

      // Handle MongoDB/storage errors
      if (error.name === 'MongoDBStorageError' || error.name === 'FilesystemError') {
        return res.status(500).json({
          error: 'Failed to save image',
          details: 'Storage system error. Please try again later.',
        });
      }

      // Generic error fallback
      res.status(500).json({
        error: 'Failed to upload image',
        details: error.message || 'An unexpected error occurred',
      });
    }
  }
);

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
