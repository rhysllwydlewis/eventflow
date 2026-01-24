/**
 * Suppliers V2 Routes
 * Enhanced supplier management with photo gallery endpoints
 */

'use strict';

const express = require('express');
const router = express.Router();
const dbUnified = require('../db-unified');
const { authRequired } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

/**
 * GET /api/me/suppliers/:id/photos
 * List all photos for a supplier
 */
router.get('/:id/photos', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const suppliers = await dbUnified.read('suppliers');
    const supplier = suppliers.find(s => s.id === id);

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Check ownership or admin
    if (supplier.ownerUserId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const photos = supplier.photosGallery || [];

    res.json({
      success: true,
      count: photos.length,
      photos: photos.map((p, index) => ({
        id: p.id || `photo_${index}`,
        url: p.url,
        thumbnail: p.thumbnail || p.url,
        approved: p.approved !== false,
        uploadedAt: p.uploadedAt || supplier.createdAt,
      })),
    });
  } catch (error) {
    console.error('List photos error:', error);
    res.status(500).json({ error: 'Failed to list photos', details: error.message });
  }
});

/**
 * DELETE /api/me/suppliers/:id/photos/:photoId
 * Delete a specific photo from supplier gallery
 */
router.delete(
  '/:id/photos/:photoId',
  authRequired,
  csrfProtection,
  async (req, res) => {
    try {
      const { id, photoId } = req.params;
      const userId = req.user.id;

      // Get supplier and verify ownership
      const suppliers = await dbUnified.read('suppliers');
      const supplierIndex = suppliers.findIndex(s => s.id === id);

      if (supplierIndex === -1) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      const supplier = suppliers[supplierIndex];

      // Check ownership
      if (supplier.ownerUserId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Find and remove photo from gallery
      if (!supplier.photosGallery || !Array.isArray(supplier.photosGallery)) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      const photoIndex = supplier.photosGallery.findIndex(
        p => p.id === photoId || p.url === photoId
      );

      if (photoIndex === -1) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      // Remove photo
      const removedPhoto = supplier.photosGallery.splice(photoIndex, 1)[0];
      supplier.updatedAt = new Date().toISOString();

      suppliers[supplierIndex] = supplier;
      await dbUnified.write('suppliers', suppliers);

      // Optionally delete file from filesystem
      if (removedPhoto.url && removedPhoto.url.startsWith('/uploads/')) {
        const fs = require('fs').promises;
        const path = require('path');
        const filePath = path.join(__dirname, '..', 'public', removedPhoto.url);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          // File may not exist, log but don't fail
          console.warn('Could not delete photo file:', err.message);
        }
      }

      res.json({
        success: true,
        message: 'Photo deleted successfully',
        remainingPhotos: supplier.photosGallery.length,
      });
    } catch (error) {
      console.error('Delete photo error:', error);
      res.status(500).json({ error: 'Failed to delete photo', details: error.message });
    }
  }
);

module.exports = router;
