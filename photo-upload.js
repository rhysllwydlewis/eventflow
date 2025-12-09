/**
 * Photo Upload Middleware and Utilities
 * Handles file uploads, image optimization, and storage (local + AWS S3)
 */

'use strict';

const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// AWS S3 setup (optional, only if configured)
let s3 = null;
let S3_ENABLED = false;

try {
  const AWS = require('aws-sdk');
  const bucketName = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_S3_REGION;
  
  if (bucketName && region) {
    s3 = new AWS.S3({
      region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    S3_ENABLED = true;
    console.log(`AWS S3 enabled: bucket=${bucketName}, region=${region}`);
  }
} catch (err) {
  console.log('AWS S3 not configured (using local storage)');
}

// Upload directories
const UPLOAD_DIRS = {
  original: path.join(__dirname, 'uploads', 'original'),
  thumbnails: path.join(__dirname, 'uploads', 'thumbnails'),
  optimized: path.join(__dirname, 'uploads', 'optimized'),
  large: path.join(__dirname, 'uploads', 'large'),
  public: path.join(__dirname, 'public', 'uploads'),
};

// Image processing configurations
const IMAGE_CONFIGS = {
  thumbnail: { width: 300, height: 300, fit: 'cover', quality: 80 },
  optimized: { width: 1200, height: 1200, fit: 'inside', quality: 85 },
  large: { width: 2000, height: 2000, fit: 'inside', quality: 90 },
};

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

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
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, buffer);
  return filepath;
}

/**
 * Upload image to AWS S3
 * @param {Buffer} buffer - Image buffer
 * @param {string} filename - Filename to save
 * @param {string} directory - Directory type (original, thumbnails, optimized)
 * @returns {Promise<string>} S3 URL
 */
async function uploadToS3(buffer, filename, directory = 'original') {
  if (!S3_ENABLED) {
    throw new Error('AWS S3 is not configured');
  }
  
  const key = `${directory}/${filename}`;
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
    ACL: 'public-read',
  };
  
  const result = await s3.upload(params).promise();
  return result.Location;
}

/**
 * Process and save image with multiple sizes
 * @param {Buffer} buffer - Original image buffer
 * @param {string} originalFilename - Original filename
 * @returns {Promise<Object>} URLs for all image sizes
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
    
    // Save locally or to S3
    if (S3_ENABLED) {
      // Upload to S3
      const [originalUrl, thumbnailUrl, optimizedUrl, largeUrl] = await Promise.all([
        uploadToS3(originalProcessed, `${baseFilename}.jpg`, 'original'),
        uploadToS3(thumbnail, `${baseFilename}-thumb.jpg`, 'thumbnails'),
        uploadToS3(optimized, `${baseFilename}-opt.jpg`, 'optimized'),
        uploadToS3(large, `${baseFilename}-large.jpg`, 'large'),
      ]);
      
      results.original = originalUrl;
      results.thumbnail = thumbnailUrl;
      results.optimized = optimizedUrl;
      results.large = largeUrl;
    } else {
      // Save to local filesystem
      await Promise.all([
        saveToLocal(originalProcessed, `${baseFilename}.jpg`, 'original'),
        saveToLocal(thumbnail, `${baseFilename}-thumb.jpg`, 'thumbnails'),
        saveToLocal(optimized, `${baseFilename}-opt.jpg`, 'optimized'),
        saveToLocal(large, `${baseFilename}-large.jpg`, 'large'),
      ]);
      
      // Return local URLs
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      results.original = `${baseUrl}/uploads/original/${baseFilename}.jpg`;
      results.thumbnail = `${baseUrl}/uploads/thumbnails/${baseFilename}-thumb.jpg`;
      results.optimized = `${baseUrl}/uploads/optimized/${baseFilename}-opt.jpg`;
      results.large = `${baseUrl}/uploads/large/${baseFilename}-large.jpg`;
    }
    
    // Also save to public folder for serving
    await saveToLocal(optimized, `${baseFilename}-opt.jpg`, 'public');
    
    return results;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

/**
 * Delete image from storage
 * @param {string} url - Image URL to delete
 * @returns {Promise<void>}
 */
async function deleteImage(url) {
  // Validate S3 URL more strictly - must start with https:// and contain amazonaws.com in the domain
  const isS3Url = S3_ENABLED && /^https:\/\/[^\/]*\.amazonaws\.com\//.test(url);
  
  if (isS3Url) {
    // Delete from S3
    const key = url.split('.com/')[1];
    await s3.deleteObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }).promise();
  } else {
    // Delete from local filesystem
    const filename = path.basename(url);
    const dirs = ['original', 'thumbnails', 'optimized', 'public'];
    
    await Promise.allSettled(
      dirs.map(dir => {
        const filepath = path.join(UPLOAD_DIRS[dir], filename);
        return fs.unlink(filepath).catch(() => {});
      })
    );
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
  // Download image (either from S3 or local)
  let buffer;
  
  // Validate S3 URL more strictly - must start with https:// and contain amazonaws.com in the domain
  const isS3Url = S3_ENABLED && /^https:\/\/[^\/]*\.amazonaws\.com\//.test(imageUrl);
  
  if (isS3Url) {
    const key = imageUrl.split('.com/')[1];
    const data = await s3.getObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }).promise();
    buffer = data.Body;
  } else {
    const filename = path.basename(imageUrl);
    const filepath = path.join(UPLOAD_DIRS.original, filename);
    buffer = await fs.readFile(filepath);
  }
  
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
    updatedAt: new Date().toISOString()
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
    metadata: existingMetadata
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
  
  let buffer;
  
  if (S3_ENABLED) {
    const key = imageUrl.replace(/^https?:\/\/[^/]+\//, '');
    const data = await s3.getObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }).promise();
    buffer = data.Body;
  } else {
    const filename = path.basename(imageUrl);
    const filepath = path.join(UPLOAD_DIRS.original, filename);
    buffer = await fs.readFile(filepath);
  }
  
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
    order: index
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
  S3_ENABLED,
  IMAGE_CONFIGS,
};
