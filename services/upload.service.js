/**
 * Upload Service
 * Handles file uploads with multer and image processing with sharp
 */

'use strict';

const storageConfig = require('../config/storage');
const logger = require('../utils/logger');

/**
 * Get upload middleware
 * @returns {Object} Multer upload middleware
 */
function getUploadMiddleware() {
  return storageConfig.getUploadMiddleware();
}

/**
 * Process and store photo
 * @param {Buffer} buffer - Image buffer
 * @param {string} filename - Original filename
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Photo metadata with URLs
 */
async function processAndStorePhoto(buffer, filename, userId) {
  try {
    const photoUtils = storageConfig.getPhotoUploadUtils();
    const result = await photoUtils.processAndStorePhoto(buffer, filename, userId);
    logger.info('Photo processed and stored', {
      filename,
      userId,
    });
    return result;
  } catch (error) {
    logger.error('Photo processing failed', {
      filename,
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get photo URL
 * @param {string} photoId - Photo ID
 * @param {string} size - Size (thumbnail, optimized, large, original)
 * @returns {Promise<string>} Photo URL
 */
async function getPhotoUrl(photoId, size = 'optimized') {
  try {
    const photoUtils = storageConfig.getPhotoUploadUtils();
    return await photoUtils.getPhotoUrl(photoId, size);
  } catch (error) {
    logger.error('Failed to get photo URL', {
      photoId,
      size,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Delete photo
 * @param {string} photoId - Photo ID
 * @returns {Promise<boolean>} Success status
 */
async function deletePhoto(photoId) {
  try {
    const photoUtils = storageConfig.getPhotoUploadUtils();
    const result = await photoUtils.deletePhoto(photoId);
    logger.info('Photo deleted', { photoId });
    return result;
  } catch (error) {
    logger.error('Photo deletion failed', {
      photoId,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  getUploadMiddleware,
  processAndStorePhoto,
  getPhotoUrl,
  deletePhoto,
};
