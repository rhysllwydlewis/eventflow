/**
 * Upload Validation Utilities
 * Provides robust server-side validation for file uploads with:
 * - Magic-byte detection for true file type validation
 * - Pixel count limits to mitigate decompression bombs
 * - Metadata stripping (EXIF/GPS)
 * - Configurable file size limits
 */

'use strict';

const { fileTypeFromBuffer } = require('file-type');
const sharp = require('sharp');
const logger = require('./logger');

// Configurable limits from environment variables with safe defaults
const MAX_FILE_SIZE_MARKETPLACE =
  parseInt(process.env.MAX_FILE_SIZE_MARKETPLACE_MB || '10', 10) * 1024 * 1024;
const MAX_FILE_SIZE_SUPPLIER =
  parseInt(process.env.MAX_FILE_SIZE_SUPPLIER_MB || '10', 10) * 1024 * 1024;
const MAX_FILE_SIZE_AVATAR = parseInt(process.env.MAX_FILE_SIZE_AVATAR_MB || '5', 10) * 1024 * 1024;

// Maximum pixel count to prevent decompression bombs (25 megapixels)
const MAX_PIXEL_COUNT = parseInt(process.env.MAX_PIXEL_COUNT || '25000000', 10);

// Allowed image types (magic bytes)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Validate file type using magic-byte detection
 * Prevents file type spoofing by checking actual file content
 * @param {Buffer} buffer - File buffer
 * @returns {Promise<Object>} - { valid: boolean, detectedType: string, error?: string }
 */
async function validateFileType(buffer) {
  try {
    // Ensure buffer is valid
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return {
        valid: false,
        detectedType: 'invalid',
        error: 'Invalid or empty file buffer.',
      };
    }

    const fileType = await fileTypeFromBuffer(buffer);

    if (!fileType) {
      return {
        valid: false,
        detectedType: 'unknown',
        error: 'Unable to detect file type. File may be corrupted or unsupported.',
      };
    }

    const isAllowed = ALLOWED_IMAGE_TYPES.includes(fileType.mime);

    if (!isAllowed) {
      return {
        valid: false,
        detectedType: fileType.mime,
        error: `File type ${fileType.mime} is not allowed. Only JPEG, PNG, WebP, and GIF images are supported.`,
      };
    }

    return {
      valid: true,
      detectedType: fileType.mime,
    };
  } catch (error) {
    logger.error('File type validation error:', error);
    return {
      valid: false,
      detectedType: 'error',
      error: 'Failed to validate file type.',
    };
  }
}

/**
 * Validate image dimensions and pixel count
 * Prevents decompression bombs by limiting total pixel count
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} - { valid: boolean, width: number, height: number, pixelCount: number, error?: string }
 */
async function validateImageDimensions(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    const pixelCount = (metadata.width || 0) * (metadata.height || 0);

    if (pixelCount > MAX_PIXEL_COUNT) {
      return {
        valid: false,
        width: metadata.width,
        height: metadata.height,
        pixelCount,
        error: `Image exceeds maximum pixel count. Maximum: ${MAX_PIXEL_COUNT} pixels (${Math.floor(MAX_PIXEL_COUNT / 1000000)}MP), actual: ${pixelCount} pixels (${Math.floor(pixelCount / 1000000)}MP).`,
      };
    }

    return {
      valid: true,
      width: metadata.width,
      height: metadata.height,
      pixelCount,
    };
  } catch (error) {
    logger.error('Image dimension validation error:', error);
    return {
      valid: false,
      width: 0,
      height: 0,
      pixelCount: 0,
      error: 'Failed to read image dimensions. File may be corrupted.',
    };
  }
}

/**
 * Validate file size based on context
 * @param {number} size - File size in bytes
 * @param {string} context - Upload context ('marketplace', 'supplier', 'avatar')
 * @returns {Object} - { valid: boolean, maxSize: number, error?: string }
 */
function validateFileSize(size, context = 'supplier') {
  let maxSize;

  switch (context) {
    case 'marketplace':
      maxSize = MAX_FILE_SIZE_MARKETPLACE;
      break;
    case 'avatar':
      maxSize = MAX_FILE_SIZE_AVATAR;
      break;
    case 'supplier':
    default:
      maxSize = MAX_FILE_SIZE_SUPPLIER;
      break;
  }

  if (size > maxSize) {
    return {
      valid: false,
      maxSize,
      error: `File size exceeds limit. Maximum: ${Math.floor(maxSize / 1024 / 1024)}MB, actual: ${Math.floor(size / 1024 / 1024)}MB.`,
    };
  }

  return {
    valid: true,
    maxSize,
  };
}

/**
 * Comprehensive file validation
 * Performs all validation checks: type, size, dimensions
 * @param {Buffer} buffer - File buffer
 * @param {string} context - Upload context ('marketplace', 'supplier', 'avatar')
 * @returns {Promise<Object>} - { valid: boolean, errors: string[], details: Object }
 */
async function validateUpload(buffer, context = 'supplier') {
  const errors = [];
  const details = {};

  // 1. Validate file size
  const sizeValidation = validateFileSize(buffer.length, context);
  details.size = sizeValidation;
  if (!sizeValidation.valid) {
    errors.push(sizeValidation.error);
  }

  // 2. Validate file type (magic bytes)
  const typeValidation = await validateFileType(buffer);
  details.type = typeValidation;
  if (!typeValidation.valid) {
    errors.push(typeValidation.error);
  }

  // 3. Validate dimensions (decompression bomb protection)
  // Only if type validation passed (to avoid processing invalid images)
  if (typeValidation.valid) {
    const dimensionValidation = await validateImageDimensions(buffer);
    details.dimensions = dimensionValidation;
    if (!dimensionValidation.valid) {
      errors.push(dimensionValidation.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    details,
  };
}

/**
 * Process image with metadata stripping
 * Removes EXIF data including GPS location for privacy
 * @param {Buffer} buffer - Original image buffer
 * @param {Object} options - Processing options (width, height, fit, quality)
 * @returns {Promise<Buffer>} - Processed image buffer with metadata stripped
 */
async function processWithMetadataStripping(buffer, options = {}) {
  try {
    const { width, height, fit = 'inside', quality = 85 } = options;

    let processor = sharp(buffer);

    // Resize if dimensions provided
    if (width || height) {
      processor = processor.resize({
        width,
        height,
        fit,
        withoutEnlargement: true,
      });
    }

    // Convert to JPEG with quality settings
    // Sharp automatically strips metadata when converting formats
    processor = processor.jpeg({
      quality,
      progressive: true,
      mozjpeg: true,
    });

    return processor.toBuffer();
  } catch (error) {
    logger.error('Sharp processing error:', {
      error: error.message,
      stack: error.stack,
    });

    // Provide more context for Sharp errors
    const enhancedError = new Error(`Failed to process image with Sharp: ${error.message}`);
    enhancedError.name = 'SharpProcessingError';
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

/**
 * Get configurable limits for display
 * @returns {Object} - Current upload limits
 */
function getUploadLimits() {
  return {
    maxFileSizes: {
      marketplace: MAX_FILE_SIZE_MARKETPLACE,
      supplier: MAX_FILE_SIZE_SUPPLIER,
      avatar: MAX_FILE_SIZE_AVATAR,
    },
    maxPixelCount: MAX_PIXEL_COUNT,
    allowedTypes: ALLOWED_IMAGE_TYPES,
  };
}

module.exports = {
  validateFileType,
  validateImageDimensions,
  validateFileSize,
  validateUpload,
  processWithMetadataStripping,
  getUploadLimits,
  // Export constants for testing
  MAX_FILE_SIZE_MARKETPLACE,
  MAX_FILE_SIZE_SUPPLIER,
  MAX_FILE_SIZE_AVATAR,
  MAX_PIXEL_COUNT,
  ALLOWED_IMAGE_TYPES,
};
