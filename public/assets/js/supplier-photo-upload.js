/**
 * Supplier Photo Upload Module for EventFlow
 * Handles uploading supplier gallery photos to Firebase Storage
 */

import {
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from './firebase-config.js';

class SupplierPhotoUpload {
  constructor() {
    this.uploadedPhotos = [];
    this.maxPhotos = 10;
  }

  /**
   * Upload a photo to Firebase Storage
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
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('File too large. Maximum size is 5MB.');
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 9);
      const extension = file.name.split('.').pop() || 'jpg';
      const filename = `${timestamp}_${randomStr}.${extension}`;
      
      // Create storage reference
      const storagePath = `suppliers/${supplierId}/gallery/${filename}`;
      const storageRef = ref(storage, storagePath);

      // Upload file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Return photo metadata
      const photoData = {
        url: downloadURL,
        path: storagePath,
        filename: filename,
        originalName: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString()
      };

      console.log('Photo uploaded successfully:', photoData);
      return photoData;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  }

  /**
   * Upload multiple photos
   * @param {FileList|Array} files - Array of files to upload
   * @param {string} supplierId - The supplier ID
   * @param {Function} onProgress - Progress callback (optional)
   * @returns {Promise<Array>} Array of uploaded photo metadata
   */
  async uploadMultiplePhotos(files, supplierId, onProgress) {
    try {
      const fileArray = Array.from(files);
      const results = [];
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        
        try {
          const photoData = await this.uploadPhoto(file, supplierId);
          results.push({ success: true, photo: photoData });
          
          if (onProgress) {
            onProgress(i + 1, fileArray.length, photoData);
          }
        } catch (error) {
          results.push({ success: false, error: error.message, filename: file.name });
          
          if (onProgress) {
            onProgress(i + 1, fileArray.length, null, error);
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error uploading multiple photos:', error);
      throw error;
    }
  }

  /**
   * Delete a photo from Firebase Storage
   * @param {string} storagePath - The storage path of the photo
   */
  async deletePhoto(storagePath) {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
      console.log('Photo deleted successfully:', storagePath);
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error;
    }
  }

  /**
   * Compress an image file before upload
   * @param {File} file - The image file to compress
   * @returns {Promise<File>} Compressed file
   */
  async compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Set max dimensions
          const maxWidth = 1920;
          const maxHeight = 1920;
          
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw image on canvas
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              
              // Create new file from blob
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              
              resolve(compressedFile);
            },
            'image/jpeg',
            0.85 // Quality
          );
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        img.src = e.target.result;
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }
}

// Create singleton instance
const supplierPhotoUpload = new SupplierPhotoUpload();

export default supplierPhotoUpload;
