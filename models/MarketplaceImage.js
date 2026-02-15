/**
 * Marketplace Image Schema
 * Dedicated collection for marketplace listing photos
 * Separates marketplace images from generic photos for better organization and scalability
 */

'use strict';

/**
 * Marketplace Image Schema
 * Stores marketplace listing photos with metadata
 */
const marketplaceImageSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'listingId', 'userId', 'imageData', 'size', 'mimeType', 'uploadedAt'],
      properties: {
        _id: {
          bsonType: 'string',
          description: 'Unique photo identifier (e.g., photo_abc123)',
        },
        listingId: {
          bsonType: 'string',
          description: 'Reference to marketplace listing ID',
        },
        userId: {
          bsonType: 'string',
          description: 'User ID of the image owner',
        },
        imageData: {
          bsonType: 'string',
          description: 'Base64-encoded image data',
        },
        size: {
          enum: ['original', 'thumbnail', 'optimized', 'large'],
          description: 'Image size variant',
        },
        mimeType: {
          bsonType: 'string',
          description: 'Image MIME type (e.g., image/jpeg)',
        },
        fileSize: {
          bsonType: 'int',
          description: 'File size in bytes',
        },
        url: {
          bsonType: 'string',
          description: 'Public URL to access the image (e.g., /api/photos/photo_123)',
        },
        order: {
          bsonType: 'int',
          description: 'Display order in gallery (0-4 for max 5 images)',
        },
        filename: {
          bsonType: 'string',
          description: 'Original or generated filename',
        },
        uploadedAt: {
          bsonType: 'string',
          description: 'Upload timestamp (ISO 8601 format)',
        },
        updatedAt: {
          bsonType: 'string',
          description: 'Last update timestamp (ISO 8601 format)',
        },
      },
    },
  },
};

module.exports = {
  marketplaceImageSchema,
};
