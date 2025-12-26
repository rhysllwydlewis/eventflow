/**
 * Photo Upload Middleware and Utilities
 * Handles file uploads, image optimization, and MongoDB storage
 * Photos are stored in MongoDB for persistence across deployments
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
};

// Allowed file types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
 * Process and optimize image
 * @param {Buffer} buffer - Image buffer
 * @param {Object} config - Processing configuration
 * @returns {Promise<Buffer>} Processed image buffer
 */
async function processImage(buffer, config) {
  let processor = sharp(buffer);

  // Resize
  if (config.width || config.height) {
    processor = processor.resize({
      width: config.width,
      height: config.height,
      fit: config.fit || 'inside',
      withoutEnlargement: true,
    });
  }

  // Convert to JPEG and optimize
  processor = processor.jpeg({
    quality: config.quality || 85,
    progressive: true,
    mozjpeg: true,
  });

  return processor.toBuffer();
}

/**
 * Save image to local filesystem
 * @param {Buffer} buffer - Image buffer
 * @param {string} filename - Filename to save
 * @param {string} directory - Directory type (original, thumbnails, optimized)
 * @returns {Promise<string>} Local file path
 */
async function saveToLocal(buffer, filename, directory = 'original') {
  const dir = UPLOAD_DIRS[directory];

  // Defensive check: Ensure directory exists before writing
  // This protects against runtime deletion of directories or misconfiguration
  await fs.mkdir(dir, { recursive: true });

  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, buffer);
  return filepath;
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
    console.error('Error saving to MongoDB:', error);
    throw error;
  }
}

/**
 * Process and save image with multiple sizes
 * @param {Buffer} buffer - Original image buffer
 * @param {string} originalFilename - Original filename
 * @returns {Promise<Object>} URLs/IDs for all image sizes
 */
async function processAndSaveImage(buffer, originalFilename) {
  const filename = generateFilename(originalFilename);
  const baseFilename = filename.replace(path.extname(filename), '');

  const results = {
    original: null,
    thumbnail: null,
    optimized: null,
    large: null,
  };

  try {
    // Process each size
    const [originalProcessed, thumbnail, optimized, large] = await Promise.all([
      buffer, // Keep original as-is for backup
      processImage(buffer, IMAGE_CONFIGS.thumbnail),
      processImage(buffer, IMAGE_CONFIGS.optimized),
      processImage(buffer, IMAGE_CONFIGS.large),
    ]);

    // Check storage type
    if (STORAGE_TYPE === 'mongodb') {
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

    return results;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
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
  IMAGE_CONFIGS,
};
