/**
 * Supplier Photo Upload Module for EventFlow
 * Handles uploading supplier gallery photos to Cloudinary via MongoDB API
 *
 * NOTE: This module has been migrated from Firebase Storage to Cloudinary.
 * All operations now use the EventFlow REST API backed by Cloudinary.
 */

class SupplierPhotoUpload {
  constructor() {
    this.uploadedPhotos = [];
    this.maxPhotos = 10;
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.compressionQuality = 0.85; // 85% quality
    this.maxImageWidth = 1920;
    this.maxImageHeight = 1920;
    this.apiBase = '/api';
  }

  /**
   * Upload a photo to Cloudinary via MongoDB API
   * @param {File} file - The image file to upload
   * @param {string} supplierId - The supplier ID
   * @returns {Promise<Object>} Photo metadata with download URL
   */
  async uploadPhoto(file, supplierId) {
    try {
      // Validate file
      if (!file || !file.type || !file.type.startsWith('image/')) {
        throw new Error('Invalid file type. Please upload an image.');
      }

      // Check file size (max 5MB)
      if (file.size > this.maxFileSize) {
        throw new Error(`File too large. Maximum size is ${this.maxFileSize / (1024 * 1024)}MB.`);
      }

      // Compress image if needed
      const compressedFile = await this.compressImage(file);

      // Create FormData
      const formData = new FormData();
      formData.append('photo', compressedFile);
      formData.append('supplierId', supplierId);

      // Upload via API
      const response = await fetch(`${this.apiBase}/suppliers/${supplierId}/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload photo');
      }

      const data = await response.json();
      const photoMetadata = {
        id: data.photoId,
        url: data.url,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
      };

      this.uploadedPhotos.push(photoMetadata);
      console.log('Photo uploaded successfully:', photoMetadata);
      return photoMetadata;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  }

  /**
   * Delete a photo from Cloudinary via MongoDB API
   * @param {string} photoId - Photo ID
   * @param {string} supplierId - Supplier ID
   * @returns {Promise<void>}
   */
  async deletePhoto(photoId, supplierId) {
    try {
      const response = await fetch(`${this.apiBase}/suppliers/${supplierId}/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }

      this.uploadedPhotos = this.uploadedPhotos.filter(p => p.id !== photoId);
      console.log('Photo deleted successfully:', photoId);
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error;
    }
  }

  /**
   * Get all photos for a supplier via MongoDB API
   * @param {string} supplierId - Supplier ID
   * @returns {Promise<Array>} Array of photo metadata
   */
  async getSupplierPhotos(supplierId) {
    try {
      const response = await fetch(`${this.apiBase}/suppliers/${supplierId}/photos`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      const photos = await response.json();
      this.uploadedPhotos = photos;
      return photos;
    } catch (error) {
      console.error('Error fetching photos:', error);
      throw error;
    }
  }

  /**
   * Compress an image file before upload
   * @param {File} file - Image file
   * @returns {Promise<Blob>} Compressed image blob
   */
  async compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = e => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > this.maxImageWidth || height > this.maxImageHeight) {
            if (width > height) {
              height = (height / width) * this.maxImageWidth;
              width = this.maxImageWidth;
            } else {
              width = (width / height) * this.maxImageHeight;
              height = this.maxImageHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            blob => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              resolve(blob);
            },
            'image/jpeg',
            this.compressionQuality
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Validate image dimensions
   * @param {File} file - Image file
   * @returns {Promise<{width: number, height: number}>}
   */
  async getImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Batch upload multiple photos
   * @param {File[]} files - Array of image files
   * @param {string} supplierId - Supplier ID
   * @param {Function} progressCallback - Progress callback (optional)
   * @returns {Promise<Array>} Array of uploaded photo metadata
   */
  async batchUpload(files, supplierId, progressCallback) {
    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const photo = await this.uploadPhoto(files[i], supplierId);
        results.push(photo);

        if (progressCallback) {
          progressCallback({
            current: i + 1,
            total: files.length,
            success: results.length,
            errors: errors.length,
          });
        }
      } catch (error) {
        errors.push({ file: files[i].name, error: error.message });
        console.error(`Failed to upload ${files[i].name}:`, error);
      }
    }

    return { results, errors };
  }

  /**
   * Upload multiple photos with per-photo callback
   * This method provides compatibility with supplier-gallery.js callback signature
   * @param {File[]} files - Array of image files
   * @param {string} supplierId - Supplier ID
   * @param {Function} progressCallback - Callback with signature (current, total, photoData, error)
   * @returns {Promise<Array>} Array of upload results
   */
  async uploadMultiplePhotos(files, supplierId, progressCallback) {
    const results = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const photoData = await this.uploadPhoto(files[i], supplierId);
        results.push({ success: true, photo: photoData });

        if (progressCallback) {
          progressCallback(i + 1, files.length, photoData, null);
        }
      } catch (error) {
        results.push({ success: false, error: error.message, file: files[i].name });
        console.error(`Failed to upload ${files[i].name}:`, error);

        if (progressCallback) {
          progressCallback(i + 1, files.length, null, error);
        }
      }
    }

    return results;
  }

  /**
   * Clear uploaded photos cache
   */
  clearCache() {
    this.uploadedPhotos = [];
  }
}

// Create singleton instance
const supplierPhotoUpload = new SupplierPhotoUpload();

export default supplierPhotoUpload;
