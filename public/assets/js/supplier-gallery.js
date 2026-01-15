/**
 * Supplier Dashboard Photo Gallery Management
 * Handles drag-and-drop photo uploads to Firebase Storage
 */

import supplierPhotoUpload from './supplier-photo-upload.js';
import supplierManager from './supplier-manager.js';

class SupplierGalleryManager {
  constructor() {
    this.currentSupplierId = null;
    this.uploadedPhotos = [];
    this.pendingUploads = [];
    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    const dropZone = document.getElementById('sup-photo-drop');
    const previewContainer = document.getElementById('sup-photo-preview');
    const supplierForm = document.getElementById('supplier-form');

    if (!dropZone || !previewContainer) {
      console.log('Photo drop zone not found on this page');
      return;
    }

    console.log('Setting up supplier gallery manager');

    // Set up drag and drop
    this.setupDragAndDrop(dropZone, previewContainer);

    // Intercept supplier form submission to upload photos first
    if (supplierForm) {
      this.setupFormIntercept(supplierForm);
    }

    // Load existing photos if editing a supplier
    this.loadExistingPhotos();
  }

  setupDragAndDrop(dropZone, previewContainer) {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Highlight drop zone when dragging
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('dragover');
      });
    });

    // Handle dropped files
    dropZone.addEventListener('drop', e => {
      const files = e.dataTransfer.files;
      this.handleFiles(files, previewContainer);
    });

    // Handle click to upload
    dropZone.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.addEventListener('change', () => {
        this.handleFiles(input.files, previewContainer);
      });
      input.click();
    });
  }

  async handleFiles(files, previewContainer) {
    if (!files || files.length === 0) {
      return;
    }

    const fileArray = Array.from(files);

    // Validate number of photos
    const currentPhotoCount = this.uploadedPhotos.length + this.pendingUploads.length;
    const maxPhotos = 10;

    if (currentPhotoCount + fileArray.length > maxPhotos) {
      // Use Toast if available, fallback to alert
      if (typeof Toast !== 'undefined') {
        Toast.warning(
          `You can upload a maximum of ${maxPhotos} photos. You currently have ${currentPhotoCount} photos.`
        );
      } else {
        alert(
          `You can upload a maximum of ${maxPhotos} photos. You currently have ${currentPhotoCount} photos.`
        );
      }
      return;
    }

    // Add files to pending uploads and show preview
    for (const file of fileArray) {
      if (!file.type || !file.type.startsWith('image/')) {
        console.warn('Skipping non-image file:', file.name);
        continue;
      }

      // Add to pending uploads
      this.pendingUploads.push(file);

      // Show preview
      this.showPreview(file, previewContainer);
    }

    console.log(`Added ${fileArray.length} photos to upload queue`);
  }

  showPreview(file, previewContainer) {
    const reader = new FileReader();

    reader.addEventListener('load', e => {
      const wrapper = document.createElement('div');
      wrapper.className = 'photo-preview-item';
      wrapper.style.position = 'relative';

      const img = document.createElement('img');
      img.src = e.target.result;
      img.alt = file.name;

      // Add remove button
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.className = 'photo-remove-btn';
      removeBtn.style.position = 'absolute';
      removeBtn.style.top = '4px';
      removeBtn.style.right = '4px';
      removeBtn.style.background = 'rgba(255,255,255,0.9)';
      removeBtn.style.border = '1px solid #ccc';
      removeBtn.style.borderRadius = '50%';
      removeBtn.style.width = '24px';
      removeBtn.style.height = '24px';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.fontSize = '16px';
      removeBtn.style.lineHeight = '1';
      removeBtn.style.padding = '0';

      removeBtn.addEventListener('click', () => {
        // Remove from pending uploads
        const index = this.pendingUploads.indexOf(file);
        if (index > -1) {
          this.pendingUploads.splice(index, 1);
        }
        // Remove preview
        wrapper.remove();
      });

      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);
      previewContainer.appendChild(wrapper);
    });

    reader.readAsDataURL(file);
  }

  setupFormIntercept(form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();

      // Get or determine supplier ID
      const supplierIdField = document.getElementById('sup-id');
      let supplierId = supplierIdField ? supplierIdField.value : null;

      // Prepare form data
      const formData = new FormData(form);
      const payload = {};
      formData.forEach((v, k) => (payload[k] = v));

      const id = (payload.id || '').toString().trim();

      try {
        // If no supplier ID, create the supplier first to get a valid ID from the server
        if (!supplierId || supplierId.trim() === '') {
          // Create new supplier
          const response = await fetch('/api/me/suppliers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            throw new Error('Failed to create supplier profile');
          }

          const data = await response.json();
          supplierId = data.supplier?.id || data.id;

          // Update the form field with the server-generated ID
          if (supplierIdField && supplierId) {
            supplierIdField.value = supplierId;
          }

          console.log('Supplier created with ID:', supplierId);
        }

        // Upload pending photos now that we have a valid supplier ID
        if (this.pendingUploads.length > 0 && supplierId) {
          await this.uploadPendingPhotos(supplierId);

          // Update the photos field in the form with uploaded photo URLs
          const photosField = document.getElementById('sup-photos');
          if (photosField) {
            const allPhotoUrls = this.uploadedPhotos.map(p => p.url);
            photosField.value = allPhotoUrls.join('\n');

            // Update the payload with photo URLs
            payload.photos = allPhotoUrls.join('\n');
          }
        }

        // Now update the supplier with photo URLs if this was a new supplier
        if (!id && supplierId) {
          const updateResponse = await fetch(
            `/api/me/suppliers/${encodeURIComponent(supplierId)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
          );

          if (!updateResponse.ok) {
            throw new Error('Failed to update supplier profile with photos');
          }
        } else if (id) {
          // If editing existing supplier, update it
          const updateResponse = await fetch(`/api/me/suppliers/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!updateResponse.ok) {
            throw new Error('Failed to save supplier profile');
          }
        }

        // Clear pending uploads
        this.pendingUploads = [];

        // Use Toast if available, fallback to alert
        if (typeof Toast !== 'undefined') {
          Toast.success('Supplier profile and photos saved successfully!');
        } else {
          alert('Saved supplier profile with photos!');
        }

        // Reload the page or refresh suppliers list
        if (typeof window.loadSuppliers === 'function') {
          await window.loadSuppliers();
        }
      } catch (error) {
        console.error('Error saving supplier:', error);

        // Use Toast if available, fallback to alert
        if (typeof Toast !== 'undefined') {
          Toast.error(`Error saving supplier profile: ${error.message}`);
        } else {
          alert(`Error saving supplier profile: ${error.message}`);
        }
      }
    });
  }

  async uploadPendingPhotos(supplierId) {
    if (this.pendingUploads.length === 0) {
      return;
    }

    const statusEl = document.getElementById('sup-status');
    if (statusEl) {
      statusEl.textContent = `Uploading ${this.pendingUploads.length} photo(s)...`;
    }

    try {
      const results = await supplierPhotoUpload.uploadMultiplePhotos(
        this.pendingUploads,
        supplierId,
        (current, total, photoData, _error) => {
          if (statusEl) {
            statusEl.textContent = `Uploading photo ${current} of ${total}...`;
          }

          if (photoData) {
            this.uploadedPhotos.push(photoData);
          }
        }
      );

      // Check for errors
      const errors = results.filter(r => !r.success);
      if (errors.length > 0) {
        console.warn('Some photos failed to upload:', errors);
        if (statusEl) {
          statusEl.textContent = `${results.length - errors.length} of ${results.length} photos uploaded successfully`;
        }
      } else {
        if (statusEl) {
          statusEl.textContent = `All ${results.length} photos uploaded successfully!`;
        }
      }

      // Clear pending uploads
      this.pendingUploads = [];

      console.log('Photos uploaded:', this.uploadedPhotos);
    } catch (error) {
      console.error('Error uploading photos:', error);
      if (statusEl) {
        statusEl.textContent = `Error uploading photos: ${error.message}`;
      }
      throw error;
    }
  }

  async loadExistingPhotos() {
    // This would load existing photos from the supplier's profile
    // For now, we'll implement this when we have the supplier ID
    const supplierIdField = document.getElementById('sup-id');
    if (!supplierIdField || !supplierIdField.value) {
      return; // No supplier ID, must be creating a new supplier
    }

    const supplierId = supplierIdField.value;

    try {
      const supplier = await supplierManager.getSupplier(supplierId);
      if (supplier && supplier.photos) {
        // Parse photos (assuming they're stored as newline-separated URLs)
        const photoUrls = supplier.photos.split('\n').filter(url => url.trim());

        // For existing photos, we just need the URLs
        this.uploadedPhotos = photoUrls.map(url => ({ url }));

        console.log('Loaded existing photos:', this.uploadedPhotos);
      }
    } catch (error) {
      console.error('Error loading existing photos:', error);
    }
  }
}

// Initialize when the module loads
const galleryManager = new SupplierGalleryManager();

export default galleryManager;
