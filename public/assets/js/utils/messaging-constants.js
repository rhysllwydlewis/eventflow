/**
 * Messaging System Configuration Constants
 * Centralized configuration for the messaging system to ensure consistency
 * across customer and supplier interfaces.
 */

export const MESSAGING_CONFIG = {
  // File upload limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB per file
  MAX_TOTAL_SIZE: 25 * 1024 * 1024, // 25MB total across all files
  MAX_FILES: 10, // Maximum number of files per message

  // Display settings
  MESSAGE_PREVIEW_MAX_LENGTH: 100, // Maximum length for message preview in list

  // File type restrictions
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],

  // File type labels for user-friendly messages
  ALLOWED_FILE_TYPE_LABELS: 'images, PDFs, and Office documents (Word, Excel)',
};

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

/**
 * Validate file size
 * @param {File} file - File to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateFileSize(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: `File "${file.name}" is empty (0 bytes)`,
    };
  }

  if (file.size > MESSAGING_CONFIG.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds maximum size of ${formatFileSize(MESSAGING_CONFIG.MAX_FILE_SIZE)}`,
    };
  }

  return { valid: true };
}

/**
 * Validate total size of multiple files
 * @param {File[]} files - Array of files to validate
 * @returns {{valid: boolean, error?: string, totalSize: number}} Validation result
 */
export function validateTotalSize(files) {
  if (!files || files.length === 0) {
    return { valid: true, totalSize: 0 };
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  if (totalSize > MESSAGING_CONFIG.MAX_TOTAL_SIZE) {
    return {
      valid: false,
      error: `Total file size (${formatFileSize(totalSize)}) exceeds maximum of ${formatFileSize(MESSAGING_CONFIG.MAX_TOTAL_SIZE)}`,
      totalSize,
    };
  }

  return { valid: true, totalSize };
}
