/**
 * Photos Routes
 * Photo upload, management, approval, and editing endpoints
 */

'use strict';

const express = require('express');
const router = express.Router();

// These will be injected by server.js during route mounting
let dbUnified;
let authRequired;
let roleRequired;
let featureRequired;
let csrfProtection;
let photoUpload;
let logger;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Photos routes: dependencies object is required');
  }

  // Validate required dependencies
  const required = [
    'dbUnified',
    'authRequired',
    'roleRequired',
    'featureRequired',
    'csrfProtection',
    'photoUpload',
    'logger',
  ];

  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Photos routes: missing required dependencies: ${missing.join(', ')}`);
  }

  dbUnified = deps.dbUnified;
  authRequired = deps.authRequired;
  roleRequired = deps.roleRequired;
  featureRequired = deps.featureRequired;
  csrfProtection = deps.csrfProtection;
  photoUpload = deps.photoUpload;
  logger = deps.logger;
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

function applyFeatureRequired(feature) {
  return (req, res, next) => {
    if (!featureRequired) {
      return res.status(503).json({ error: 'Feature service not initialized' });
    }
    return featureRequired(feature)(req, res, next);
  };
}

function applyCsrfProtection(req, res, next) {
  if (!csrfProtection) {
    return res.status(503).json({ error: 'CSRF service not initialized' });
  }
  return csrfProtection(req, res, next);
}

// ---------- Photo Upload Routes ----------

/**
 * Upload photos for supplier, package, or marketplace listing
 * POST /api/photos/upload
 */
router.post(
  '/photos/upload',
  applyFeatureRequired('photoUploads'),
  applyAuthRequired,
  photoUpload.upload.array('files', 5), // Support up to 5 files for marketplace
  applyCsrfProtection,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { type, id } = req.query;
      if (!type || !id) {
        return res.status(400).json({ error: 'Missing type or id parameter' });
      }

      // Handle marketplace type with multiple files
      if (type === 'marketplace') {
        const listings = await dbUnified.read('marketplace_listings');
        const listing = listings.find(l => l.id === id);

        if (!listing) {
          return res.status(404).json({ error: 'Listing not found' });
        }

        // Verify ownership
        if (listing.userId !== req.user.id && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Process and append URLs with error handling
        const uploadedUrls = [];
        const errors = [];
        for (const file of req.files) {
          try {
            const images = await photoUpload.processAndSaveImage(
              file.buffer,
              file.originalname,
              'marketplace'
            );
            uploadedUrls.push(images.optimized);
          } catch (error) {
            errors.push({ filename: file.originalname, error: error.message });
          }
        }

        // Cap at 5 images total
        listing.images = (listing.images || []).concat(uploadedUrls).slice(0, 5);
        listing.updatedAt = new Date().toISOString();

        await dbUnified.write('marketplace_listings', listings);

        logger.info('Marketplace images uploaded', {
          listingId: id,
          userId: req.user.id,
          count: uploadedUrls.length,
        });

        return res.json({
          success: true,
          urls: uploadedUrls,
          errors: errors.length > 0 ? errors : undefined,
          message:
            uploadedUrls.length > 0
              ? `${uploadedUrls.length} image(s) uploaded successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}.`
              : 'No images were uploaded.',
        });
      }

      // Handle single file for supplier/package types
      const file = req.files[0];

      // Process and save image
      const images = await photoUpload.processAndSaveImage(file.buffer, file.originalname, type);

      // Get metadata
      const metadata = await photoUpload.getImageMetadata(file.buffer);

      // Create photo record
      const photoRecord = {
        url: images.optimized,
        thumbnail: images.thumbnail,
        large: images.large,
        original: images.original,
        approved: false, // Requires admin approval
        uploadedAt: Date.now(),
        uploadedBy: req.user.id,
        metadata: metadata,
      };

      // Update supplier or package with new photo
      if (type === 'supplier') {
        const suppliers = await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === id);

        if (!supplier) {
          return res.status(404).json({ error: 'Supplier not found' });
        }

        // Check if user owns this supplier
        if (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Add to gallery
        if (!supplier.photosGallery) {
          supplier.photosGallery = [];
        }
        supplier.photosGallery.push(photoRecord);

        await dbUnified.write('suppliers', suppliers);

        return res.json({
          success: true,
          photo: photoRecord,
          message: 'Photo uploaded successfully. Pending admin approval.',
        });
      } else if (type === 'package') {
        const packages = await dbUnified.read('packages');
        const pkg = packages.find(p => p.id === id);

        if (!pkg) {
          return res.status(404).json({ error: 'Package not found' });
        }

        // Check if user owns this package's supplier
        const suppliers = await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === pkg.supplierId);

        if (!supplier || (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin')) {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Add to gallery
        if (!pkg.gallery) {
          pkg.gallery = [];
        }
        pkg.gallery.push(photoRecord);

        await dbUnified.write('packages', packages);

        return res.json({
          success: true,
          photo: photoRecord,
          message: 'Photo uploaded successfully. Pending admin approval.',
        });
      } else {
        return res
          .status(400)
          .json({ error: 'Invalid type. Must be supplier, package, or marketplace.' });
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({ error: 'Failed to upload photo', details: error.message });
    }
  }
);

/**
 * Upload multiple photos (batch upload)
 * POST /api/photos/upload/batch
 * Body: multipart/form-data with 'photos' field (multiple files)
 * Query: ?type=supplier|package|marketplace&id=<supplierId|packageId|listingId>
 * Note: Accepts up to 10 files for supplier/package, marketplace listings capped at 5 images total
 */
router.post(
  '/photos/upload/batch',
  applyAuthRequired,
  photoUpload.upload.array('photos', 10),
  applyCsrfProtection,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const { type, id } = req.query;
      if (!type || !id) {
        return res.status(400).json({ error: 'Missing type or id parameter' });
      }

      // Process all images
      const uploadedPhotos = [];
      const errors = [];

      for (const file of req.files) {
        try {
          const images = await photoUpload.processAndSaveImage(
            file.buffer,
            file.originalname,
            type
          );
          const metadata = await photoUpload.getImageMetadata(file.buffer);

          const photoRecord = {
            url: images.optimized,
            thumbnail: images.thumbnail,
            large: images.large,
            original: images.original,
            approved: false,
            uploadedAt: Date.now(),
            uploadedBy: req.user.id,
            metadata: metadata,
          };

          uploadedPhotos.push(photoRecord);
        } catch (error) {
          errors.push({ filename: file.originalname, error: error.message });
        }
      }

      // Update supplier, package, or marketplace listing with new photos
      if (type === 'marketplace') {
        const listings = await dbUnified.read('marketplace_listings');
        const listing = listings.find(l => l.id === id);

        if (!listing) {
          return res.status(404).json({ error: 'Listing not found' });
        }

        // Verify ownership
        if (listing.userId !== req.user.id && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Process and append URLs (cap at 5 images total)
        const uploadedUrls = uploadedPhotos.map(p => p.url);
        listing.images = (listing.images || []).concat(uploadedUrls).slice(0, 5);
        listing.updatedAt = new Date().toISOString();

        await dbUnified.write('marketplace_listings', listings);

        logger.info('Marketplace images uploaded (batch)', {
          listingId: id,
          userId: req.user.id,
          count: uploadedUrls.length,
        });

        return res.json({
          success: true,
          uploaded: uploadedUrls.length,
          urls: uploadedUrls,
          errors: errors,
          message: `${uploadedUrls.length} photo(s) uploaded successfully to marketplace listing.`,
        });
      } else if (type === 'supplier') {
        const suppliers = await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === id);

        if (!supplier) {
          return res.status(404).json({ error: 'Supplier not found' });
        }

        if (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Not authorized' });
        }

        if (!supplier.photosGallery) {
          supplier.photosGallery = [];
        }
        supplier.photosGallery.push(...uploadedPhotos);

        await dbUnified.write('suppliers', suppliers);
      } else if (type === 'package') {
        const packages = await dbUnified.read('packages');
        const pkg = packages.find(p => p.id === id);

        if (!pkg) {
          return res.status(404).json({ error: 'Package not found' });
        }

        const suppliers = await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === pkg.supplierId);

        if (!supplier || (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin')) {
          return res.status(403).json({ error: 'Not authorized' });
        }

        if (!pkg.gallery) {
          pkg.gallery = [];
        }
        pkg.gallery.push(...uploadedPhotos);

        await dbUnified.write('packages', packages);
      } else {
        return res.status(400).json({ error: 'Invalid type' });
      }

      res.json({
        success: true,
        uploaded: uploadedPhotos.length,
        photos: uploadedPhotos,
        errors: errors,
        message: `${uploadedPhotos.length} photo(s) uploaded successfully. Pending admin approval.`,
      });
    } catch (error) {
      console.error('Batch upload error:', error);
      res.status(500).json({ error: 'Failed to upload photos', details: error.message });
    }
  }
);

// ---------- Photo Management Routes ----------

/**
 * Delete photo
 * DELETE /api/photos/delete
 * Query: ?type=supplier|package&id=<supplierId|packageId>&photoUrl=<url>
 */
router.delete('/photos/delete', applyAuthRequired, applyCsrfProtection, async (req, res) => {
  try {
    const { type, id, photoUrl } = req.query;

    if (!type || !id || !photoUrl) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const decodedUrl = decodeURIComponent(photoUrl);

    if (type === 'supplier') {
      const suppliers = await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.id === id);

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      if (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (supplier.photosGallery) {
        supplier.photosGallery = supplier.photosGallery.filter(p => p.url !== decodedUrl);
        await dbUnified.write('suppliers', suppliers);

        // Delete physical files
        await photoUpload.deleteImage(decodedUrl);
      }
    } else if (type === 'package') {
      const packages = await dbUnified.read('packages');
      const pkg = packages.find(p => p.id === id);

      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }

      const suppliers = await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.id === pkg.supplierId);

      if (!supplier || (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (pkg.gallery) {
        pkg.gallery = pkg.gallery.filter(p => p.url !== decodedUrl);
        await dbUnified.write('packages', packages);

        // Delete physical files
        await photoUpload.deleteImage(decodedUrl);
      }
    }

    res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo', details: error.message });
  }
});

/**
 * Approve photo (admin only)
 * POST /api/photos/approve
 * Body: { type, id, photoUrl, approved }
 */
router.post(
  '/photos/approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { type, id, photoUrl, approved } = req.body;

      if (!type || !id || !photoUrl || typeof approved !== 'boolean') {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      if (type === 'supplier') {
        const suppliers = await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === id);

        if (!supplier) {
          return res.status(404).json({ error: 'Supplier not found' });
        }

        if (supplier.photosGallery) {
          const photo = supplier.photosGallery.find(p => p.url === photoUrl);
          if (photo) {
            photo.approved = approved;
            photo.approvedAt = Date.now();
            photo.approvedBy = req.user.id;
            await dbUnified.write('suppliers', suppliers);
          }
        }
      } else if (type === 'package') {
        const packages = await dbUnified.read('packages');
        const pkg = packages.find(p => p.id === id);

        if (!pkg) {
          return res.status(404).json({ error: 'Package not found' });
        }

        if (pkg.gallery) {
          const photo = pkg.gallery.find(p => p.url === photoUrl);
          if (photo) {
            photo.approved = approved;
            photo.approvedAt = Date.now();
            photo.approvedBy = req.user.id;
            await dbUnified.write('packages', packages);
          }
        }
      }

      res.json({
        success: true,
        message: approved ? 'Photo approved' : 'Photo rejected',
      });
    } catch (error) {
      console.error('Approve photo error:', error);
      res.status(500).json({ error: 'Failed to approve photo', details: error.message });
    }
  }
);

/**
 * Crop image
 * POST /api/photos/crop
 * Body: { imageUrl, cropData: { x, y, width, height } }
 */
router.post('/photos/crop', applyAuthRequired, applyCsrfProtection, async (req, res) => {
  try {
    const { imageUrl, cropData } = req.body;

    if (!imageUrl || !cropData) {
      return res.status(400).json({ error: 'Missing imageUrl or cropData' });
    }

    // Validate crop data
    if (!cropData.x || !cropData.y || !cropData.width || !cropData.height) {
      return res.status(400).json({ error: 'Invalid crop data' });
    }

    const croppedImages = await photoUpload.cropImage(imageUrl, cropData);

    res.json({
      success: true,
      images: croppedImages,
      message: 'Image cropped successfully',
    });
  } catch (error) {
    console.error('Crop image error:', error);
    res.status(500).json({ error: 'Failed to crop image', details: error.message });
  }
});

/**
 * Get pending photos for moderation (admin only)
 * GET /api/photos/pending
 */
router.get('/photos/pending', applyAuthRequired, applyRoleRequired('admin'), async (req, res) => {
  try {
    const pendingPhotos = [];

    // Get pending supplier photos
    const suppliers = await dbUnified.read('suppliers');
    for (const supplier of suppliers) {
      if (supplier.photosGallery) {
        const pending = supplier.photosGallery
          .filter(p => !p.approved)
          .map(p => ({
            ...p,
            type: 'supplier',
            supplierId: supplier.id,
            supplierName: supplier.name,
          }));
        pendingPhotos.push(...pending);
      }
    }

    // Get pending package photos
    const packages = await dbUnified.read('packages');
    for (const pkg of packages) {
      if (pkg.gallery) {
        const pending = pkg.gallery
          .filter(p => !p.approved)
          .map(p => ({
            ...p,
            type: 'package',
            packageId: pkg.id,
            packageTitle: pkg.title,
            supplierId: pkg.supplierId,
          }));
        pendingPhotos.push(...pending);
      }
    }

    // Sort by upload time (newest first)
    pendingPhotos.sort((a, b) => b.uploadedAt - a.uploadedAt);

    res.json({
      success: true,
      count: pendingPhotos.length,
      photos: pendingPhotos,
    });
  } catch (error) {
    console.error('Get pending photos error:', error);
    res.status(500).json({ error: 'Failed to get pending photos', details: error.message });
  }
});

/**
 * PUT /api/photos/:id
 * Edit photo metadata (caption, alt text, tags)
 */
router.put('/photos/:id', applyAuthRequired, applyCsrfProtection, async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, altText, tags, isFeatured, watermark } = req.body;

    const metadata = await photoUpload.updatePhotoMetadata(id, {
      caption,
      altText,
      tags,
      isFeatured,
      watermark,
    });

    res.json({
      success: true,
      metadata,
      message: 'Photo metadata updated successfully',
    });
  } catch (error) {
    console.error('Update photo metadata error:', error);
    res.status(500).json({ error: 'Failed to update photo metadata', details: error.message });
  }
});

/**
 * POST /api/photos/:id/replace
 * Replace photo while keeping metadata
 */
router.post(
  '/photos/:id/replace',
  authRequired,
  photoUpload.upload.single('photo'),
  csrfProtection,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { metadata } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No photo file provided' });
      }

      const result = await photoUpload.replacePhoto(
        id,
        req.file.buffer,
        JSON.parse(metadata || '{}')
      );

      res.json({
        success: true,
        photo: result,
        message: 'Photo replaced successfully',
      });
    } catch (error) {
      console.error('Replace photo error:', error);
      res.status(500).json({ error: 'Failed to replace photo', details: error.message });
    }
  }
);

/**
 * POST /api/photos/bulk-edit
 * Bulk update multiple photos
 */
router.post('/photos/bulk-edit', applyAuthRequired, applyCsrfProtection, async (req, res) => {
  try {
    const { photos } = req.body;

    if (!Array.isArray(photos)) {
      return res.status(400).json({ error: 'Photos must be an array' });
    }

    const results = await Promise.all(
      photos.map(photo => photoUpload.updatePhotoMetadata(photo.id, photo.metadata))
    );

    res.json({
      success: true,
      updated: results.length,
      photos: results,
      message: `${results.length} photo(s) updated successfully`,
    });
  } catch (error) {
    console.error('Bulk edit photos error:', error);
    res.status(500).json({ error: 'Failed to bulk edit photos', details: error.message });
  }
});

/**
 * POST /api/photos/:id/filters
 * Apply filters to photo (brightness, contrast, saturation)
 */
router.post('/photos/:id/filters', applyAuthRequired, applyCsrfProtection, async (req, res) => {
  try {
    // eslint-disable-next-line no-unused-vars
    const { id: _id } = req.params; // Photo ID from URL (not currently used)
    const { imageUrl, brightness, contrast, saturation } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const result = await photoUpload.applyFilters(imageUrl, {
      brightness: parseFloat(brightness) || 1,
      contrast: parseFloat(contrast) || 1,
      saturation: parseFloat(saturation) || 1,
    });

    res.json({
      success: true,
      image: result,
      message: 'Filters applied successfully',
    });
  } catch (error) {
    console.error('Apply filters error:', error);
    res.status(500).json({ error: 'Failed to apply filters', details: error.message });
  }
});

/**
 * POST /api/photos/reorder
 * Update photo order in gallery
 */
router.post('/photos/reorder', applyAuthRequired, applyCsrfProtection, async (req, res) => {
  try {
    const { photoOrder } = req.body;

    if (!Array.isArray(photoOrder)) {
      return res.status(400).json({ error: 'Photo order must be an array' });
    }

    const result = await photoUpload.updatePhotoOrder(photoOrder);

    res.json({
      success: true,
      order: result,
      message: 'Photo order updated successfully',
    });
  } catch (error) {
    console.error('Reorder photos error:', error);
    res.status(500).json({ error: 'Failed to reorder photos', details: error.message });
  }
});

// ---------- Admin Photo Management Routes ----------

router.get('/admin/photos/pending', applyAuthRequired, applyRoleRequired('admin'), async (req, res) => {
  const photos = await dbUnified.read('photos');
  const pendingPhotos = photos.filter(p => p.status === 'pending');

  // Enrich with supplier information
  const suppliers = await dbUnified.read('suppliers');
  const enrichedPhotos = pendingPhotos.map(photo => {
    const supplier = suppliers.find(s => s.id === photo.supplierId);
    return {
      ...photo,
      supplierName: supplier ? supplier.name : 'Unknown',
      supplierCategory: supplier ? supplier.category : null,
    };
  });

  res.json({ photos: enrichedPhotos });
});

/**
 * GET /api/admin/photos
 * Get photos for a specific supplier (admin view)
 */
router.get('/admin/photos', applyAuthRequired, applyRoleRequired('admin'), async (req, res) => {
  try {
    const { supplierId } = req.query;

    if (!supplierId) {
      return res.status(400).json({ error: 'supplierId query parameter is required' });
    }

    const suppliers = await dbUnified.read('suppliers');
    const supplier = suppliers.find(s => s.id === supplierId);

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get photos from photosGallery (includes approved and unapproved)
    const photos = supplier.photosGallery || [];

    res.json({
      success: true,
      photos: photos.map(p => ({
        ...p,
        id: p.id || `${supplierId}_${p.uploadedAt}`,
        supplierId,
      })),
    });
  } catch (error) {
    console.error('Error fetching supplier photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos', details: error.message });
  }
});

/**
 * POST /api/admin/photos/:id/approve
 * Approve a photo
 */
router.post(
  '/admin/photos/:id/approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const { id } = req.params;
    const photos = await dbUnified.read('photos');
    const photoIndex = photos.findIndex(p => p.id === id);

    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = photos[photoIndex];
    const now = new Date().toISOString();

    // Update photo status
    photo.status = 'approved';
    photo.approvedAt = now;
    photo.approvedBy = req.user.id;

    photos[photoIndex] = photo;
    await dbUnified.write('photos', photos);

    // Add photo to supplier's photos array if not already there
    const suppliers = await dbUnified.read('suppliers');
    const supplierIndex = suppliers.findIndex(s => s.id === photo.supplierId);

    if (supplierIndex !== -1) {
      if (!suppliers[supplierIndex].photos) {
        suppliers[supplierIndex].photos = [];
      }
      if (!suppliers[supplierIndex].photos.includes(photo.url)) {
        suppliers[supplierIndex].photos.push(photo.url);
        await dbUnified.write('suppliers', suppliers);
      }
    }

    res.json({ success: true, message: 'Photo approved successfully', photo });
  }
);

/**
 * POST /api/admin/photos/:id/reject
 * Reject a photo
 */
router.post(
  '/admin/photos/:id/reject',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const photos = await dbUnified.read('photos');
    const photoIndex = photos.findIndex(p => p.id === id);

    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = photos[photoIndex];
    const now = new Date().toISOString();

    // Update photo status
    photo.status = 'rejected';
    photo.rejectedAt = now;
    photo.rejectedBy = req.user.id;
    photo.rejectionReason = reason || 'No reason provided';

    photos[photoIndex] = photo;
    await dbUnified.write('photos', photos);

    res.json({ success: true, message: 'Photo rejected successfully', photo });
  }
);

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
