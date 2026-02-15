/**
 * Photo Upload Middleware and Utilities
 * Handles file uploads, image optimization, and MongoDB storage
 * Photos are stored in MongoDB for persistence across deployments
 *
 * Security features:
 * - Magic-byte detection for true file type validation
 * - Pixel count limits to prevent decompression bombs
 * - Automatic metadata stripping (EXIF/GPS)
 * - Configurable file size limits per context
 */

'use strict';

const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');

// MongoDB for photo storage
const mongoDb = require('./db');
const { uid } = require('./store');

// Import validation utilities
const uploadValidation = require('./utils/uploadValidation');

// Import logger for consistent logging
const logger = require('./utils/logger');

// Storage type based on MongoDB availability
let STORAGE_TYPE = 'local'; // 'mongodb' or 'local'

// Check if MongoDB is available
async function checkMongoDBAvailability() {
  try {
    const isAvailable = await mongoDb.isMongoAvailable();
    if (isAvailable) {
      STORAGE_TYPE = 'mongodb';
      console.log('✓ Photos will be stored in MongoDB (persistent across deployments)');
    } else {
      console.log('⚠ MongoDB not available - using local storage (photos may not persist)');
    }
  } catch (error) {
    console.log('⚠ Could not check MongoDB - using local storage:', error.message);
  }
}

// Check on module load
checkMongoDBAvailability();

// Upload directories
const UPLOAD_DIRS = {
  original: path.join(__dirname, 'uploads', 'original'),
  thumbnails: path.join(__dirname, 'uploads', 'thumbnails'),
  optimized: path.join(__dirname, 'uploads', 'optimized'),
  large: path.join(__dirname, 'uploads', 'large'),
  public: path.join(__dirname, 'public', 'uploads'),
};

/**
 * Ensure all upload directories exist on module load
 * Note: Uses synchronous operations intentionally to block until directories exist,
 * preventing race conditions when the module is immediately used after require().
 */
function ensureDirectoriesExist() {
  const dirs = Object.values(UPLOAD_DIRS);
  for (const dir of dirs) {
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }
  }
}

// Call immediately when module loads to ensure directories exist
ensureDirectoriesExist();

// Image processing configurations
const IMAGE_CONFIGS = {
  thumbnail: { width: 300, height: 300, fit: 'cover', quality: 80 },
  optimized: { width: 1200, height: 1200, fit: 'inside', quality: 85 },
  large: { width: 2000, height: 2000, fit: 'inside', quality: 90 },
  avatar: { width: 400, height: 400, fit: 'cover', quality: 90 }, // Square avatar
};

// Allowed file types (now validated via magic bytes, not just MIME type)
const ALLOWED_MIME_TYPES = uploadValidation.ALLOWED_IMAGE_TYPES;

// Maximum file sizes (configurable via environment)
const MAX_FILE_SIZE = uploadValidation.MAX_FILE_SIZE_SUPPLIER;
const MAX_FILE_SIZE_AVATAR = uploadValidation.MAX_FILE_SIZE_AVATAR;
const MAX_FILE_SIZE_MARKETPLACE = uploadValidation.MAX_FILE_SIZE_MARKETPLACE;

/**
 * Generate unique filename
 */
function generateFilename(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  const hash = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}-${hash}${ext}`;
}

/**
 * Multer storage configuration (memory storage for processing)
 */
const storage = multer.memoryStorage();

/**
 * File filter for multer
 */
function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'), false);
  }
}

/**
 * Multer upload middleware
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Max 10 files per upload
  },
});

/**
 * Extract EXIF metadata from image buffer before stripping
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} EXIF metadata
 */
async function extractExifData(buffer) {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    const exifData = {
      camera: metadata.exif
        ? {
            make: metadata.exif.Make || null,
            model: metadata.exif.Model || null,
          }
        : null,
      dateTaken:
        (metadata.exif && (metadata.exif.DateTimeOriginal || metadata.exif.DateTime)) || null,
      location:
        metadata.exif && metadata.exif.GPSLatitude && metadata.exif.GPSLongitude
          ? {
              latitude: metadata.exif.GPSLatitude,
              longitude: metadata.exif.GPSLongitude,
            }
          : null,
      dimensions: {
        width: metadata.width,
        height: metadata.height,
      },
      format: metadata.format,
      space: metadata.space,
      orientation: metadata.orientation,
    };

    return exifData;
  } catch (error) {
    logger.warn('Failed to extract EXIF data', { error: error.message });
    return null;
  }
}

/**
 * Process image with metadata stripping
 * Automatically strips metadata (EXIF/GPS) for privacy
 * @param {Buffer} buffer - Image buffer
 * @param {Object} config - Processing configuration
 * @returns {Promise<Buffer>} Processed image buffer
 */
async function processImage(buffer, config) {
  try {
    return await uploadValidation.processWithMetadataStripping(buffer, {
      width: config.width,
      height: config.height,
      fit: config.fit || 'inside',
      quality: config.quality || 85,
    });
  } catch (error) {
    // Add context to Sharp errors
    const enhancedError = new Error(`Image processing failed: ${error.message}`);
    enhancedError.name = 'SharpProcessingError';
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

/**
 * Save image to local filesystem
 * @param {Buffer} buffer - Image buffer
 * @param {string} filename - Filename to save
 * @param {string} directory - Directory type (original, thumbnails, optimized)
 * @returns {Promise<string>} Local file path
 */
async function saveToLocal(buffer, filename, directory = 'original') {
  try {
    const dir = UPLOAD_DIRS[directory];

    // Defensive check: Ensure directory exists before writing
    // This protects against runtime deletion of directories or misconfiguration
    await fs.mkdir(dir, { recursive: true });

    const filepath = path.join(dir, filename);
    await fs.writeFile(filepath, buffer);
    return filepath;
  } catch (error) {
    // Add context to filesystem errors
    const enhancedError = new Error(
      `Failed to save image to local filesystem (${directory}): ${error.message}`
    );
    enhancedError.name = 'FilesystemError';
    enhancedError.directory = directory;
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

/**
 * Save image to MongoDB
 * @param {Buffer} buffer - Image buffer
 * @param {string} filename - Filename
 * @param {string} type - Image type (original, thumbnail, optimized, large)
 * @returns {Promise<string>} Database ID
 */
async function saveToMongoDB(buffer, filename, type = 'optimized') {
  try {
    // Check if MongoDB is available before attempting save
    const isAvailable = await mongoDb.isMongoAvailable();
    if (!isAvailable) {
      const error = new Error('MongoDB is not available for photo storage');
      error.name = 'MongoDBUnavailableError';
      throw error;
    }

    const db = await mongoDb.getDb();
    const collection = db.collection('photos');

    const photoDoc = {
      _id: uid('photo'),
      filename,
      type,
      data: buffer.toString('base64'),
      mimeType: 'image/jpeg',
      size: buffer.length,
      createdAt: new Date().toISOString(),
    };

    await collection.insertOne(photoDoc);
    return photoDoc._id;
  } catch (error) {
    // Add context to MongoDB errors with connection state
    const enhancedError = new Error(`Failed to save image to MongoDB: ${error.message}`);
    enhancedError.name = error.name || 'MongoDBStorageError';
    enhancedError.originalError = error;
    enhancedError.context = {
      filename,
      type,
      bufferSize: buffer?.length || 0,
      storageType: STORAGE_TYPE,
    };
    
    logger.error('MongoDB photo save failed', {
      error: error.message,
      stack: error.stack,
      filename,
      type,
      bufferSize: buffer?.length || 0,
    });
    
    throw enhancedError;
  }
}

/**
 * Process and save image with multiple sizes
 * Performs comprehensive validation before processing
 * @param {Buffer} buffer - Original image buffer
 * @param {string} originalFilename - Original filename
 * @param {string} context - Upload context ('marketplace', 'supplier', 'avatar')
 * @returns {Promise<Object>} URLs/IDs for all image sizes
 */
async function processAndSaveImage(buffer, originalFilename, context = 'supplier') {
  // Validate buffer early
  if (!buffer || !Buffer.isBuffer(buffer)) {
    const error = new Error(`Invalid file buffer - expected Buffer, received ${typeof buffer}`);
    error.name = 'ValidationError';
    throw error;
  }

  if (buffer.length === 0) {
    const error = new Error('Empty file buffer');
    error.name = 'ValidationError';
    throw error;
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (buffer.length > maxSize) {
    const error = new Error(
      `File too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (max 5MB)`
    );
    error.name = 'ValidationError';
    throw error;
  }

  // Log start of processing
  logger.info('Starting image processing', {
    filename: originalFilename,
    context,
    size: buffer.length,
  });

  // Implement retry logic with exponential backoff
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Validate upload (type, size, dimensions) - pass filename for fallback detection
      const validation = await uploadValidation.validateUpload(buffer, context, originalFilename);

      if (!validation.valid) {
        logger.error('Image validation failed', {
          errors: validation.errors,
          details: validation.details,
        });
        const error = new Error(validation.errors.join('; '));
        error.name = 'ValidationError';
        error.details = validation.details;
        throw error;
      }

      logger.debug('Image validation passed');

      const filename = generateFilename(originalFilename);
      const baseFilename = filename.replace(path.extname(filename), '');

      // Extract EXIF data before processing (which strips metadata)
      const exifData = await extractExifData(buffer);

      const results = {
        original: null,
        thumbnail: null,
        optimized: null,
        large: null,
        exif: exifData,
      };

      // For avatars, only generate one optimized square size
      if (context === 'avatar') {
        logger.debug('Processing avatar image');
        const avatarProcessed = await processImage(buffer, IMAGE_CONFIGS.avatar);

        if (STORAGE_TYPE === 'mongodb') {
          logger.debug('Saving avatar to MongoDB');
          const avatarId = await saveToMongoDB(avatarProcessed, `${baseFilename}.jpg`, 'avatar');
          results.optimized = `/api/photos/${avatarId}`;
        } else {
          logger.debug('Saving avatar to local filesystem');
          await saveToLocal(avatarProcessed, `${baseFilename}.jpg`, 'optimized');
          results.optimized = `/uploads/optimized/${baseFilename}.jpg`;
          await saveToLocal(avatarProcessed, `${baseFilename}.jpg`, 'public');
        }

        logger.info('Avatar image processed successfully');
        return results;
      }

      // Process each size (with automatic metadata stripping)
      logger.debug('Processing image in multiple sizes');
      const [originalProcessed, thumbnail, optimized, large] = await Promise.all([
        buffer, // Keep original as-is for backup
        processImage(buffer, IMAGE_CONFIGS.thumbnail),
        processImage(buffer, IMAGE_CONFIGS.optimized),
        processImage(buffer, IMAGE_CONFIGS.large),
      ]);

      logger.debug('Image processing complete, saving to storage');

      // Check storage type
      if (STORAGE_TYPE === 'mongodb') {
        logger.debug('Saving images to MongoDB');
        // Save to MongoDB
        const [originalId, thumbnailId, optimizedId, largeId] = await Promise.all([
          saveToMongoDB(originalProcessed, `${baseFilename}.jpg`, 'original'),
          saveToMongoDB(thumbnail, `${baseFilename}-thumb.jpg`, 'thumbnail'),
          saveToMongoDB(optimized, `${baseFilename}-opt.jpg`, 'optimized'),
          saveToMongoDB(large, `${baseFilename}-large.jpg`, 'large'),
        ]);

        // Return photo IDs that will be served via API endpoint
        results.original = `/api/photos/${originalId}`;
        results.thumbnail = `/api/photos/${thumbnailId}`;
        results.optimized = `/api/photos/${optimizedId}`;
        results.large = `/api/photos/${largeId}`;
      } else {
        logger.debug('Saving images to local filesystem');
        // Save to local filesystem (fallback)
        await Promise.all([
          saveToLocal(originalProcessed, `${baseFilename}.jpg`, 'original'),
          saveToLocal(thumbnail, `${baseFilename}-thumb.jpg`, 'thumbnails'),
          saveToLocal(optimized, `${baseFilename}-opt.jpg`, 'optimized'),
          saveToLocal(large, `${baseFilename}-large.jpg`, 'large'),
        ]);

        // Return relative URLs (works in any environment without hardcoded BASE_URL)
        // These are served by express.static('/uploads') middleware
        results.original = `/uploads/original/${baseFilename}.jpg`;
        results.thumbnail = `/uploads/thumbnails/${baseFilename}-thumb.jpg`;
        results.optimized = `/uploads/optimized/${baseFilename}-opt.jpg`;
        results.large = `/uploads/large/${baseFilename}-large.jpg`;

        // Also save to public folder for serving
        await saveToLocal(optimized, `${baseFilename}-opt.jpg`, 'public');
      }

      logger.info('Image saved successfully', { results });
      return results;
    } catch (error) {
      lastError = error;

      // Don't retry validation errors
      if (error.name === 'ValidationError') {
        throw error;
      }

      logger.warn(`Image upload attempt ${attempt} failed`, {
        error: error.message,
        filename: originalFilename,
        attempt: attempt,
      });

      if (attempt < 3) {
        // Wait before retry with exponential backoff
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s...
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts failed
  logger.error('Image processing failed after 3 attempts', {
    message: lastError.message,
    name: lastError.name,
    ...(process.env.NODE_ENV !== 'production' && { stack: lastError.stack }),
  });

  // Throw the last error with additional context
  const finalError = new Error(`Image upload failed after 3 attempts: ${lastError.message}`);
  finalError.name = 'ImageProcessingError';
  finalError.originalError = lastError;
  throw finalError;
}

/**
 * Delete image from storage (MongoDB or local)
 * @param {string} url - Image URL/ID to delete
 * @returns {Promise<void>}
 */
async function deleteImage(url) {
  try {
    // Check if it's a MongoDB photo (starts with /api/photos/)
    if (url && url.startsWith('/api/photos/')) {
      const photoId = url.split('/').pop();
      const db = await mongoDb.getDb();
      const collection = db.collection('photos');
      await collection.deleteOne({ _id: photoId });
      return;
    }

    // Otherwise, delete from local filesystem
    const filename = path.basename(url);
    const dirs = ['original', 'thumbnails', 'optimized', 'large', 'public'];

    await Promise.allSettled(
      dirs.map(dir => {
        const filepath = path.join(UPLOAD_DIRS[dir], filename);
        return fs.unlink(filepath).catch(() => {});
      })
    );
  } catch (error) {
    console.error('Error deleting image:', error);
    // Don't throw - deletion failures shouldn't break the app
  }
}

/**
 * Get image metadata
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} Image metadata
 */
async function getImageMetadata(buffer) {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: buffer.length,
    hasAlpha: metadata.hasAlpha,
  };
}

/**
 * Crop image
 * @param {string} imageUrl - URL of image to crop
 * @param {Object} cropData - Crop dimensions {x, y, width, height}
 * @returns {Promise<Object>} New cropped image URLs
 */
async function cropImage(imageUrl, cropData) {
  // Download image from local storage
  const filename = path.basename(imageUrl);
  const filepath = path.join(UPLOAD_DIRS.original, filename);
  const buffer = await fs.readFile(filepath);

  // Perform crop
  const cropped = await sharp(buffer)
    .extract({
      left: Math.round(cropData.x),
      top: Math.round(cropData.y),
      width: Math.round(cropData.width),
      height: Math.round(cropData.height),
    })
    .toBuffer();

  // Process and save cropped image
  return processAndSaveImage(cropped, 'cropped.jpg');
}

/**
 * Update photo metadata (caption, alt text, tags)
 * @param {string} photoId - Photo identifier
 * @param {Object} metadata - New metadata { caption, altText, tags, isFeatured, watermark }
 * @returns {Promise<Object>} Updated metadata
 */
async function updatePhotoMetadata(photoId, metadata) {
  const { caption, altText, tags, isFeatured, watermark } = metadata;

  return {
    photoId,
    caption: caption || '',
    altText: altText || '',
    tags: Array.isArray(tags) ? tags : [],
    isFeatured: !!isFeatured,
    watermark: !!watermark,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Replace photo while keeping metadata
 * @param {string} photoId - Photo identifier
 * @param {Buffer} newImageBuffer - New image data
 * @param {Object} existingMetadata - Existing metadata to preserve
 * @returns {Promise<Object>} New image URLs with preserved metadata
 */
async function replacePhoto(photoId, newImageBuffer, existingMetadata) {
  // Process and save new image
  const newImageData = await processAndSaveImage(newImageBuffer, `replaced_${photoId}.jpg`);

  // Merge with existing metadata
  return {
    ...newImageData,
    metadata: existingMetadata,
  };
}

/**
 * Apply filters to image (brightness, contrast, saturation)
 * @param {string} imageUrl - Image URL
 * @param {Object} filters - Filter values { brightness, contrast, saturation }
 * @returns {Promise<Object>} Processed image data
 */
async function applyFilters(imageUrl, filters) {
  const { brightness = 1, contrast = 1, saturation = 1 } = filters;

  // Load image from local storage
  const filename = path.basename(imageUrl);
  const filepath = path.join(UPLOAD_DIRS.original, filename);
  const buffer = await fs.readFile(filepath);

  // Apply filters using Sharp
  let image = sharp(buffer);

  // Brightness adjustment (0.5 = darker, 1.5 = brighter)
  if (brightness !== 1) {
    image = image.modulate({ brightness });
  }

  // Saturation adjustment (0 = grayscale, 2 = very saturated)
  if (saturation !== 1) {
    image = image.modulate({ saturation });
  }

  // Contrast is handled via linear transform
  if (contrast !== 1) {
    const alpha = contrast;
    const beta = 128 * (1 - contrast);
    image = image.linear(alpha, beta);
  }

  const processed = await image.toBuffer();

  // Save processed image
  return processAndSaveImage(processed, 'filtered.jpg');
}

/**
 * Bulk update photo order
 * @param {Array} photoOrder - Array of {photoId, order} objects
 * @returns {Promise<Array>} Updated order
 */
async function updatePhotoOrder(photoOrder) {
  return photoOrder.map((item, index) => ({
    photoId: item.photoId,
    order: index,
  }));
}

module.exports = {
  upload,
  processAndSaveImage,
  deleteImage,
  getImageMetadata,
  cropImage,
  updatePhotoMetadata,
  replacePhoto,
  applyFilters,
  updatePhotoOrder,
  extractExifData,
  IMAGE_CONFIGS,
  // Export file size constants for use in routes
  MAX_FILE_SIZE_SUPPLIER: MAX_FILE_SIZE,
  MAX_FILE_SIZE_AVATAR,
  MAX_FILE_SIZE_MARKETPLACE,
};
