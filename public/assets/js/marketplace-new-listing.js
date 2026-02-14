/**
 * Marketplace New Listing Form
 * Handles creating and editing marketplace listings
 */

(function () {
  'use strict';

  let selectedImages = [];
  let isEditMode = false;
  let editingListingId = null;
  let currentUser = null;

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    // Check if user is authenticated
    const authOk = await checkAuth();
    if (!authOk) {
      return; // User will be redirected
    }

    // Check if we're in edit mode
    const urlParams = new URLSearchParams(window.location.search);
    editingListingId = urlParams.get('edit');
    if (editingListingId) {
      isEditMode = true;
      await loadListingForEdit(editingListingId);
    }

    initImageUpload();
    initCharacterCount();
    initFormSubmission();
  }

  /**
   * Check authentication status
   */
  async function checkAuth() {
    try {
      const res = await fetch('/api/v1/auth/me', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      if (res.status === 401) {
        // Not logged in - redirect to auth
        window.location.href = '/auth.html?redirect=/supplier/marketplace-new-listing.html';
        return false;
      }

      if (!res.ok) {
        showToast('Unable to verify authentication', 'error');
        setTimeout(() => {
          window.location.href = '/auth.html';
        }, 2000);
        return false;
      }

      const data = await res.json();

      // Handle both wrapped ({user: ...}) and unwrapped response formats
      if (data.user !== undefined) {
        currentUser = data.user;
      } else if (data.id) {
        currentUser = data;
      } else {
        currentUser = null;
      }

      if (!currentUser) {
        window.location.href = '/auth.html?redirect=/supplier/marketplace-new-listing.html';
        return false;
      }

      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      showToast('Connection error. Please check your internet.', 'error');
      return false;
    }
  }

  /**
   * Load existing listing for editing
   */
  async function loadListingForEdit(listingId) {
    try {
      const res = await fetch(`/api/v1/marketplace/my-listings/${listingId}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to load listing');
      }

      const data = await res.json();
      const listing = data.listing || data;

      // Populate form fields
      document.getElementById('listing-title').value = listing.title || '';
      document.getElementById('listing-description').value = listing.description || '';
      document.getElementById('listing-price').value = listing.price || '';
      document.getElementById('listing-location').value = listing.location || '';
      document.getElementById('listing-category').value = listing.category || '';
      document.getElementById('listing-condition').value = listing.condition || '';

      // Load images
      if (listing.images && listing.images.length > 0) {
        selectedImages = listing.images
          .map(image => {
            const imageUrl = typeof image === 'string' ? image : image?.url;
            return imageUrl ? { url: imageUrl, existing: true } : null;
          })
          .filter(Boolean);
        renderImagePreviews();
      }

      // Update page title
      document.querySelector('.form-header h1').textContent = 'Edit Listing';
      document.querySelector('button[type="submit"]').textContent = 'Save Changes';
    } catch (error) {
      console.error('Error loading listing:', error);
      showToast('Failed to load listing for editing', 'error');
      setTimeout(() => {
        window.location.href = '/my-marketplace-listings.html';
      }, 2000);
    }
  }

  /**
   * Initialize image upload functionality
   */
  function initImageUpload() {
    const zone = document.getElementById('image-upload-zone');
    const input = document.getElementById('listing-images');

    // Click to upload
    zone.addEventListener('click', () => {
      input.click();
    });

    // File input change
    input.addEventListener('change', handleFileSelect);

    // Drag and drop
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');

      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    });
  }

  /**
   * Handle file selection
   */
  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    handleFiles(files);
  }

  /**
   * Process selected files
   */
  async function handleFiles(files) {
    // Limit to 5 images total
    const remaining = 5 - selectedImages.length;
    if (remaining <= 0) {
      showToast('Maximum 5 images allowed', 'error');
      return;
    }

    const filesToProcess = files.slice(0, remaining);

    for (const file of filesToProcess) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast(`${file.name} is not an image`, 'error');
        continue;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        showToast(`${file.name} is too large (max 5MB)`, 'error');
        continue;
      }

      // Create preview (read as base64 for preview only)
      try {
        const reader = new FileReader();
        reader.onload = e => {
          selectedImages.push({
            file: file, // Store actual File object
            preview: e.target.result, // Base64 preview only
            new: true,
          });
          renderImagePreviews();
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error processing image:', error);
        showToast(`Failed to process ${file.name}`, 'error');
      }
    }
  }

  /**
   * Render image previews
   */
  function renderImagePreviews() {
    const grid = document.getElementById('image-preview-grid');

    if (selectedImages.length === 0) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = selectedImages
      .map(
        (img, index) => `
      <div class="image-preview-item">
        <img src="${img.preview || img.url}" alt="Preview ${index + 1}">
        <button 
          type="button" 
          class="image-preview-remove" 
          onclick="window.NewListing.removeImage(${index})"
          aria-label="Remove image"
        >×</button>
      </div>
    `
      )
      .join('');
  }

  /**
   * Remove an image
   */
  function removeImage(index) {
    selectedImages.splice(index, 1);
    renderImagePreviews();
  }

  /**
   * Initialize character count for description
   */
  function initCharacterCount() {
    const textarea = document.getElementById('listing-description');
    const counter = document.getElementById('char-count');

    textarea.addEventListener('input', () => {
      const length = textarea.value.length;
      counter.textContent = length;

      if (length > 900) {
        counter.style.color = '#dc2626';
      } else {
        counter.style.color = '#6b7280';
      }
    });
  }

  async function uploadMarketplaceImages(newImages, listingId, csrfToken) {
    try {
      const formData = new FormData();
      newImages.forEach(img => formData.append('photos', img.file));

      const batchRes = await fetch(`/api/v1/photos/upload/batch?type=marketplace&id=${listingId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
        body: formData,
      });

      const batchData = await batchRes.json().catch(() => ({}));
      if (batchRes.ok) {
        return Array.isArray(batchData.errors) ? batchData.errors.length : 0;
      }

      console.warn(
        'Batch image upload failed, retrying individually:',
        batchData.error || batchRes.status
      );
    } catch (error) {
      console.warn('Batch image upload failed, retrying individually:', error);
    }

    let failedImageCount = 0;
    for (const image of newImages) {
      const singleFormData = new FormData();
      singleFormData.append('files', image.file);

      try {
        const singleRes = await fetch(`/api/v1/photos/upload?type=marketplace&id=${listingId}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': csrfToken },
          body: singleFormData,
        });

        if (!singleRes.ok) {
          failedImageCount += 1;
        }
      } catch (error) {
        console.warn('Individual image upload failed:', error);
        failedImageCount += 1;
      }
    }

    return failedImageCount;
  }

  /**
   * Initialize form submission
   */
  function initFormSubmission() {
    const form = document.getElementById('new-listing-form');

    form.addEventListener('submit', async e => {
      e.preventDefault();

      // Disable submit button to prevent double submission
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = isEditMode ? 'Saving...' : 'Creating...';

      try {
        // Get CSRF token
        const csrfToken = window.__CSRF_TOKEN__ || '';

        // Prepare listing data WITHOUT images
        const listingData = {
          title: document.getElementById('listing-title').value.trim(),
          description: document.getElementById('listing-description').value.trim(),
          price: parseFloat(document.getElementById('listing-price').value),
          location: document.getElementById('listing-location').value.trim(),
          category: document.getElementById('listing-category').value,
          condition: document.getElementById('listing-condition').value,
          images: selectedImages.filter(img => !img.new).map(img => img.url),
        };

        // Validate required fields
        if (
          !listingData.title ||
          !listingData.description ||
          listingData.price === undefined ||
          listingData.price === null ||
          listingData.price === '' ||
          !listingData.category ||
          !listingData.condition
        ) {
          throw new Error('Please fill in all required fields');
        }

        if (listingData.price < 0) {
          throw new Error('Price must be 0 or greater');
        }

        // Submit to API
        const url = isEditMode
          ? `/api/marketplace/listings/${editingListingId}`
          : '/api/marketplace/listings';

        const method = isEditMode ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify(listingData),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} listing`
          );
        }

        const responseData = await res.json();
        const listingId = responseData.listing?.id || editingListingId;

        // Upload new images in one batch request to avoid race conditions
        const newImages = selectedImages.filter(img => img.new && img.file);
        let failedImageCount = 0;

        if (newImages.length > 0) {
          failedImageCount = await uploadMarketplaceImages(newImages, listingId, csrfToken);
        }

        // Show appropriate success message
        if (failedImageCount > 0) {
          showToast(
            `Listing ${isEditMode ? 'updated' : 'created'}, but ${failedImageCount} image(s) failed to upload. You can try uploading them again by editing the listing.`,
            'warning'
          );
        } else {
          showToast(
            isEditMode
              ? 'Listing updated successfully!'
              : 'Listing created successfully! It will appear after admin approval.',
            'success'
          );
        }

        // Redirect to my listings page after a short delay
        setTimeout(() => {
          window.location.href = '/my-marketplace-listings.html';
        }, 1500);
      } catch (error) {
        console.error('Error submitting listing:', error);
        showToast(error.message || 'Failed to submit listing', 'error');

        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#16a34a'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      max-width: 90%;
      text-align: center;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // Expose functions that need to be called from HTML onclick handlers
  window.NewListing = {
    removeImage,
  };
})();
