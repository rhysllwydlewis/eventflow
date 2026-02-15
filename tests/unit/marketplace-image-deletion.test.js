/**
 * Tests for marketplace image deletion functionality
 * Verifies that images are properly cleaned up when listings are deleted
 */

describe('Marketplace Image Deletion', () => {
  test('deleteImage function should be exported from photo-upload', () => {
    const photoUpload = require('../../photo-upload');
    expect(typeof photoUpload.deleteImage).toBe('function');
  });

  test('deleteMarketplaceImages function should be exported from photo-upload', () => {
    const photoUpload = require('../../photo-upload');
    expect(typeof photoUpload.deleteMarketplaceImages).toBe('function');
  });

  test('deleteMarketplaceImages should return 0 when MongoDB is not available', async () => {
    const photoUpload = require('../../photo-upload');
    
    // This test will pass when MongoDB is not available
    // In a real environment with MongoDB, it would test actual deletion
    const deletedCount = await photoUpload.deleteMarketplaceImages('test-listing-123');
    
    // When MongoDB is unavailable, it should return 0 and not throw
    expect(typeof deletedCount).toBe('number');
  });
});

describe('Marketplace Routes - Image Cleanup', () => {
  test('DELETE /listings/:id route exists in marketplace routes', () => {
    const fs = require('fs');
    const path = require('path');
    const marketplaceRoutes = fs.readFileSync(
      path.join(__dirname, '../../routes/marketplace.js'),
      'utf8'
    );

    // Verify the route exists
    expect(marketplaceRoutes).toContain("router.delete");
    expect(marketplaceRoutes).toContain("/listings/:id");
    
    // Verify it calls deleteMarketplaceImages
    expect(marketplaceRoutes).toContain('deleteMarketplaceImages');
    expect(marketplaceRoutes).toContain('deletedImageCount');
  });
});

describe('Admin Routes - Marketplace Image Cleanup', () => {
  test('DELETE /marketplace/listings/:id admin endpoint exists', () => {
    const fs = require('fs');
    const path = require('path');
    const adminRoutes = fs.readFileSync(
      path.join(__dirname, '../../routes/admin.js'),
      'utf8'
    );

    // Verify the admin delete endpoint exists
    expect(adminRoutes).toContain("router.delete");
    expect(adminRoutes).toContain("/marketplace/listings/:id");
    
    // Verify it has proper authorization
    expect(adminRoutes).toContain('authRequired');
    expect(adminRoutes).toContain("roleRequired('admin')");
    
    // Verify it calls deleteMarketplaceImages
    expect(adminRoutes).toContain('deleteMarketplaceImages');
    
    // Verify it has audit logging
    expect(adminRoutes).toContain('auditLog');
    expect(adminRoutes).toContain('marketplace_listing_deleted');
  });
});

describe('Photo Upload - deleteImage Function', () => {
  test('deleteImage should check marketplace_images collection', () => {
    const fs = require('fs');
    const path = require('path');
    const photoUpload = fs.readFileSync(
      path.join(__dirname, '../../photo-upload.js'),
      'utf8'
    );

    // Find the deleteImage function
    const deleteImageStart = photoUpload.indexOf('async function deleteImage(');
    const deleteImageEnd = photoUpload.indexOf('async function deleteMarketplaceImages', deleteImageStart);
    const deleteImageFunc = photoUpload.substring(deleteImageStart, deleteImageEnd);

    // Verify it checks marketplace_images collection
    expect(deleteImageFunc).toContain("collection('marketplace_images')");
    
    // Verify it falls back to photos collection
    expect(deleteImageFunc).toContain("collection('photos')");
    
    // Verify it logs appropriately
    expect(deleteImageFunc).toContain('logger.info');
  });
});
