(async function () {
  // Check admin authentication
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });
    const data = await response.json();
    const user = data.user;
    if (!user || user.role !== 'admin') {
      window.location.href = '/auth.html';
      return;
    }
  } catch (err) {
    window.location.href = '/auth.html';
    return;
  }

  // State for both sections
  let categories = [];
  let collageWidget = null;
  let collageMedia = [];

  const categoryListElement = document.getElementById('categoryList');

  // HTML sanitization helper
  function escapeHtml(unsafe) {
    if (!unsafe) {
      return '';
    }
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================
  // COLLAGE WIDGET SECTION
  // ============================================

  async function loadCollageWidget() {
    try {
      const response = await fetch('/api/admin/homepage/collage-widget', {
        credentials: 'include',
      });
      if (response.ok) {
        collageWidget = await response.json();
        renderCollageWidget();
      } else {
        showCollageWidgetError('Failed to load collage widget configuration');
      }
    } catch (err) {
      console.error('Error loading collage widget:', err);
      showCollageWidgetError('Failed to load collage widget configuration');
    }
  }

  function renderCollageWidget() {
    // Set enabled checkbox
    document.getElementById('collageWidgetEnabled').checked = collageWidget.enabled || false;

    // Set source radio buttons
    const source = collageWidget.source || 'pexels';
    document.getElementById('sourcePexels').checked = source === 'pexels';
    document.getElementById('sourceUploads').checked = source === 'uploads';

    // Set media type checkboxes
    const mediaTypes = collageWidget.mediaTypes || { photos: true, videos: true };
    document.getElementById('mediaTypePhotos').checked = mediaTypes.photos !== false;
    document.getElementById('mediaTypeVideos').checked = mediaTypes.videos !== false;

    // Set interval
    document.getElementById('intervalSeconds').value = collageWidget.intervalSeconds || 2.5;

    // Hero Video Controls
    const heroVideo = collageWidget.heroVideo || {};
    document.getElementById('heroVideoEnabled').checked = heroVideo.enabled ?? true;
    document.getElementById('heroVideoAutoplay').checked = heroVideo.autoplay ?? false;
    document.getElementById('heroVideoMuted').checked = heroVideo.muted ?? true;
    document.getElementById('heroVideoLoop').checked = heroVideo.loop ?? true;
    document.getElementById('heroVideoQuality').value = heroVideo.quality || 'hd';

    // Video Quality Settings
    const videoQuality = collageWidget.videoQuality || {};
    document.getElementById('videoQualityPreference').value = videoQuality.preference || 'hd';
    document.getElementById('videoQualityAdaptive').checked = videoQuality.adaptive ?? true;
    document.getElementById('videoQualityMobileOptimized').checked =
      videoQuality.mobileOptimized ?? true;

    // Transition Effects
    const transition = collageWidget.transition || {};
    document.getElementById('transitionEffect').value = transition.effect || 'fade';
    document.getElementById('transitionDuration').value = transition.duration || 1000;

    // Preloading
    const preloading = collageWidget.preloading || {};
    document.getElementById('preloadingEnabled').checked = preloading.enabled ?? true;
    document.getElementById('preloadingCount').value =
      preloading.count !== undefined ? preloading.count : 3;

    // Mobile Optimizations
    const mobileOpt = collageWidget.mobileOptimizations || {};
    document.getElementById('mobileSlowerTransitions').checked =
      mobileOpt.slowerTransitions ?? true;
    document.getElementById('mobileDisableVideos').checked = mobileOpt.disableVideos ?? false;
    document.getElementById('mobileTouchControls').checked = mobileOpt.touchControls ?? true;

    // Content Filtering
    const filtering = collageWidget.contentFiltering || {};
    document.getElementById('filterAspectRatio').value = filtering.aspectRatio || 'any';
    document.getElementById('filterOrientation').value = filtering.orientation || 'any';
    document.getElementById('filterMinResolution').value = filtering.minResolution || 'SD';

    // Playback Controls
    const playback = collageWidget.playbackControls || {};
    document.getElementById('playbackShowControls').checked = playback.showControls ?? false;
    document.getElementById('playbackPauseOnHover').checked = playback.pauseOnHover ?? true;
    document.getElementById('playbackFullscreen').checked = playback.fullscreen ?? false;

    // Set Pexels photo queries
    const pexelsQueries = collageWidget.pexelsQueries || {};
    document.getElementById('pexelsQueryVenues').value = pexelsQueries.venues || '';
    document.getElementById('pexelsQueryCatering').value = pexelsQueries.catering || '';
    document.getElementById('pexelsQueryEntertainment').value = pexelsQueries.entertainment || '';
    document.getElementById('pexelsQueryPhotography').value = pexelsQueries.photography || '';

    // Set Pexels video queries
    const pexelsVideoQueries = collageWidget.pexelsVideoQueries || {};
    document.getElementById('pexelsVideoQueryVenues').value = pexelsVideoQueries.venues || '';
    document.getElementById('pexelsVideoQueryCatering').value = pexelsVideoQueries.catering || '';
    document.getElementById('pexelsVideoQueryEntertainment').value =
      pexelsVideoQueries.entertainment || '';
    document.getElementById('pexelsVideoQueryPhotography').value =
      pexelsVideoQueries.photography || '';

    // Set fallback checkbox
    document.getElementById('fallbackToPexels').checked = collageWidget.fallbackToPexels !== false;

    // Show/hide panels based on source
    updateSourcePanels();

    // Enable/disable settings based on enabled state
    updateWidgetEnabledState();

    // Load collage media if source is uploads
    if (source === 'uploads') {
      loadCollageMedia();
    }
  }

  function updateSourcePanels() {
    const source = document.querySelector('input[name="collageSource"]:checked')?.value || 'pexels';
    const videosEnabled = document.getElementById('mediaTypeVideos').checked;

    const pexelsPanel = document.getElementById('pexelsSettingsPanel');
    const pexelsVideoPanel = document.getElementById('pexelsVideoQueriesPanel');
    const uploadsPanel = document.getElementById('uploadsGalleryPanel');

    if (source === 'pexels') {
      pexelsPanel.style.display = 'block';
      // Show video queries panel only if videos checkbox is checked
      pexelsVideoPanel.style.display = videosEnabled ? 'block' : 'none';
      uploadsPanel.style.display = 'none';
    } else {
      pexelsPanel.style.display = 'none';
      pexelsVideoPanel.style.display = 'none';
      uploadsPanel.style.display = 'block';
    }
  }

  function updateWidgetEnabledState() {
    const enabled = document.getElementById('collageWidgetEnabled').checked;
    const settingsDiv = document.getElementById('collageWidgetSettings');
    const statusBanner = document.getElementById('widgetStatusBanner');

    if (enabled) {
      settingsDiv.classList.remove('disabled');
      if (statusBanner) {
        statusBanner.style.display = 'none';
      }
    } else {
      settingsDiv.classList.add('disabled');
      if (statusBanner) {
        statusBanner.style.display = 'block';
      }
    }
  }

  async function saveCollageWidget() {
    try {
      // Get CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();

      // Collect form data
      const enabled = document.getElementById('collageWidgetEnabled').checked;
      const source =
        document.querySelector('input[name="collageSource"]:checked')?.value || 'pexels';
      const mediaTypes = {
        photos: document.getElementById('mediaTypePhotos').checked,
        videos: document.getElementById('mediaTypeVideos').checked,
      };
      const intervalSeconds = parseFloat(document.getElementById('intervalSeconds').value);

      // Hero Video Controls
      const heroVideo = {
        enabled: document.getElementById('heroVideoEnabled').checked,
        autoplay: document.getElementById('heroVideoAutoplay').checked,
        muted: document.getElementById('heroVideoMuted').checked,
        loop: document.getElementById('heroVideoLoop').checked,
        quality: document.getElementById('heroVideoQuality').value,
      };

      // Video Quality Settings
      const videoQuality = {
        preference: document.getElementById('videoQualityPreference').value,
        adaptive: document.getElementById('videoQualityAdaptive').checked,
        mobileOptimized: document.getElementById('videoQualityMobileOptimized').checked,
      };

      // Transition Effects
      const transition = {
        effect: document.getElementById('transitionEffect').value,
        duration: parseInt(document.getElementById('transitionDuration').value, 10),
      };

      // Preloading
      const preloading = {
        enabled: document.getElementById('preloadingEnabled').checked,
        count: parseInt(document.getElementById('preloadingCount').value, 10),
      };

      // Mobile Optimizations
      const mobileOptimizations = {
        slowerTransitions: document.getElementById('mobileSlowerTransitions').checked,
        disableVideos: document.getElementById('mobileDisableVideos').checked,
        touchControls: document.getElementById('mobileTouchControls').checked,
      };

      // Content Filtering
      const contentFiltering = {
        aspectRatio: document.getElementById('filterAspectRatio').value,
        orientation: document.getElementById('filterOrientation').value,
        minResolution: document.getElementById('filterMinResolution').value,
      };

      // Playback Controls
      const playbackControls = {
        showControls: document.getElementById('playbackShowControls').checked,
        pauseOnHover: document.getElementById('playbackPauseOnHover').checked,
        fullscreen: document.getElementById('playbackFullscreen').checked,
      };

      const pexelsQueries = {
        venues: document.getElementById('pexelsQueryVenues').value,
        catering: document.getElementById('pexelsQueryCatering').value,
        entertainment: document.getElementById('pexelsQueryEntertainment').value,
        photography: document.getElementById('pexelsQueryPhotography').value,
      };
      const pexelsVideoQueries = {
        venues: document.getElementById('pexelsVideoQueryVenues').value,
        catering: document.getElementById('pexelsVideoQueryCatering').value,
        entertainment: document.getElementById('pexelsVideoQueryEntertainment').value,
        photography: document.getElementById('pexelsVideoQueryPhotography').value,
      };
      const fallbackToPexels = document.getElementById('fallbackToPexels').checked;

      // Build uploadGallery from current media
      const uploadGallery = collageMedia.map(m => m.url);

      // Debug logging (admin-only, always enabled for troubleshooting)
      console.log('[Admin] Saving collage widget configuration:', {
        enabled,
        source,
        mediaTypes,
        intervalSeconds,
        uploadGalleryCount: uploadGallery.length,
        uploadGalleryUrls: uploadGallery,
        fallbackToPexels,
        heroVideo,
        videoQuality,
        transition,
        preloading,
        mobileOptimizations,
        contentFiltering,
        playbackControls,
      });

      // Validation
      if (!mediaTypes.photos && !mediaTypes.videos) {
        showCollageWidgetError('Please select at least one media type');
        return;
      }

      if (isNaN(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 60) {
        showCollageWidgetError('Interval must be between 1 and 60 seconds');
        return;
      }

      // Save configuration
      const response = await fetch('/api/admin/homepage/collage-widget', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          enabled,
          source,
          mediaTypes,
          intervalSeconds,
          pexelsQueries,
          pexelsVideoQueries,
          uploadGallery,
          fallbackToPexels,
          heroVideo,
          videoQuality,
          transition,
          preloading,
          mobileOptimizations,
          contentFiltering,
          playbackControls,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Admin-only success log for troubleshooting
        console.log('[Admin] Configuration saved successfully:', result.collageWidget);
        showCollageWidgetSuccess('Configuration saved successfully!');
        await loadCollageWidget(); // Reload to get updated data
      } else {
        const error = await response.json();
        // Always log errors for admin troubleshooting
        console.error('[Admin] Failed to save configuration:', error);
        showCollageWidgetError(error.error || 'Failed to save configuration');
      }
    } catch (err) {
      console.error('Error saving collage widget:', err);
      showCollageWidgetError('Failed to save configuration');
    }
  }

  function showCollageWidgetSuccess(message) {
    const successEl = document.getElementById('collageWidgetSuccess');
    const errorEl = document.getElementById('collageWidgetError');
    errorEl.style.display = 'none';
    successEl.textContent = `✅ ${message}`;
    successEl.style.display = 'block';
    setTimeout(() => {
      successEl.style.display = 'none';
    }, 3000);
  }

  function showCollageWidgetError(message) {
    const successEl = document.getElementById('collageWidgetSuccess');
    const errorEl = document.getElementById('collageWidgetError');
    successEl.style.display = 'none';
    errorEl.textContent = `❌ ${message}`;
    errorEl.style.display = 'block';
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 5000);
  }

  async function loadCollageMedia() {
    try {
      const response = await fetch('/api/admin/homepage/collage-media', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        collageMedia = data.media || [];
        renderCollageMedia();
      } else {
        renderCollageMedia([]);
      }
    } catch (err) {
      console.error('Error loading collage media:', err);
      renderCollageMedia([]);
    }
  }

  function renderCollageMedia() {
    const container = document.getElementById('uploadGalleryList');
    if (!collageMedia || collageMedia.length === 0) {
      container.innerHTML = `
        <div class="card" style="padding: 20px; text-align: center; color: #9ca3af;">
          <p>No media uploaded yet</p>
        </div>
      `;
      return;
    }

    container.innerHTML = collageMedia
      .map(
        item => `
        <div class="gallery-item" data-filename="${escapeHtml(item.filename)}">
          ${
            item.type === 'video'
              ? `<video src="${escapeHtml(item.url)}" muted loop playsinline></video>`
              : `<img src="${escapeHtml(item.url)}" alt="Collage media">`
          }
          <div class="gallery-item-info">
            <span class="gallery-item-type ${escapeHtml(item.type)}">${escapeHtml(item.type)}</span>
            <p class="small" style="margin: 0; color: #6b7280;">${formatFileSize(item.size)}</p>
          </div>
          <button class="gallery-item-delete" data-filename="${escapeHtml(item.filename)}">🗑️ Delete</button>
        </div>
      `
      )
      .join('');

    // Attach delete handlers
    container.querySelectorAll('.gallery-item-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filename = btn.dataset.filename;
        if (confirm('Delete this media file?')) {
          await deleteCollageMedia(filename);
        }
      });
    });
  }

  async function uploadCollageMedia(files) {
    if (!files || files.length === 0) {
      return;
    }

    // Validate file count
    if (files.length > 10) {
      showCollageWidgetError(
        'Maximum 10 files can be uploaded at once. Please select fewer files.'
      );
      return;
    }

    // Validate file sizes and types
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validTypes = /^(image\/(jpeg|jpg|png|webp|gif)|video\/(mp4|webm|quicktime))$/i;

    for (const file of files) {
      if (file.size > maxSize) {
        showCollageWidgetError(
          `File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`
        );
        return;
      }
      if (!validTypes.test(file.type)) {
        showCollageWidgetError(
          `File "${file.name}" has unsupported format. Please use JPG, PNG, WebP, MP4, or WebM.`
        );
        return;
      }
    }

    try {
      // Get CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();

      // Create form data
      const formData = new FormData();
      for (const file of files) {
        formData.append('media', file);
      }

      // Show progress
      showUploadProgress(files.length);

      const response = await fetch('/api/admin/homepage/collage-media', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfData.csrfToken,
        },
        credentials: 'include',
        body: formData,
      });

      hideUploadProgress();

      if (response.ok) {
        showCollageWidgetSuccess(`✅ Uploaded ${files.length} file(s) successfully!`);
        await loadCollageMedia();
      } else {
        const error = await response.json();
        showCollageWidgetError(error.error || 'Upload failed. Please check file types and sizes.');
      }
    } catch (err) {
      hideUploadProgress();
      console.error('Error uploading collage media:', err);
      showCollageWidgetError(
        'Network error during upload. Please check your connection and try again.'
      );
    }
  }

  async function deleteCollageMedia(filename) {
    try {
      // Get CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();

      const response = await fetch(
        `/api/admin/homepage/collage-media/${encodeURIComponent(filename)}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfData.csrfToken,
          },
          credentials: 'include',
        }
      );

      if (response.ok) {
        showCollageWidgetSuccess('Media deleted successfully!');
        await loadCollageMedia();
      } else {
        const error = await response.json();
        showCollageWidgetError(error.error || 'Failed to delete media');
      }
    } catch (err) {
      console.error('Error deleting collage media:', err);
      showCollageWidgetError('Failed to delete media');
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  }

  function showUploadProgress(fileCount) {
    const progressDiv = document.createElement('div');
    progressDiv.id = 'uploadProgressIndicator';
    progressDiv.className = 'upload-progress';
    progressDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <svg width="20" height="20" style="animation: spin 1s linear infinite;">
          <circle cx="10" cy="10" r="8" stroke="#0B8073" stroke-width="2" fill="none" stroke-dasharray="25 25" />
        </svg>
        <span style="font-weight: 600;">Uploading ${fileCount} file${fileCount > 1 ? 's' : ''}...</span>
      </div>
      <div class="upload-progress-bar">
        <div class="upload-progress-fill" style="width: 75%; animation: pulse 1.5s ease-in-out infinite;"></div>
      </div>
      <p class="small" style="margin-top: 6px; color: #6b7280;">Please wait, this may take a moment...</p>
    `;
    document.body.appendChild(progressDiv);
  }

  function hideUploadProgress() {
    const progressDiv = document.getElementById('uploadProgressIndicator');
    if (progressDiv) {
      // Fade out animation before removal
      progressDiv.style.opacity = '0';
      progressDiv.style.transition = 'opacity 0.3s';
      setTimeout(() => progressDiv.remove(), 300);
    }
  }

  // ============================================
  // CATEGORY HERO IMAGES SECTION (Original)
  // ============================================

  async function loadCategories() {
    try {
      const response = await fetch('/api/categories', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        categories = data.items || [];
        renderCategories();
      } else {
        categoryListElement.innerHTML =
          '<div class="card"><p class="small">Failed to load categories. Please try again.</p></div>';
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      categoryListElement.innerHTML =
        '<div class="card"><p class="small">Failed to load categories. Please try again.</p></div>';
    }
  }

  function renderCategories() {
    if (categories.length === 0) {
      categoryListElement.innerHTML =
        '<div class="card"><p class="small">No categories found.</p></div>';
      return;
    }

    categoryListElement.innerHTML = categories
      .map(category => {
        const hasImage = category.heroImage && category.heroImage.trim() !== '';
        return `
        <div class="category-card" data-category-id="${escapeHtml(category.id)}">
          <div class="category-card-header">
            <h3 class="category-card-title">
              <span>${escapeHtml(category.icon || '📁')}</span>
              <span>${escapeHtml(category.name)}</span>
            </h3>
          </div>
          <div class="category-card-body">
            ${
              hasImage
                ? `<img src="${escapeHtml(category.heroImage)}" alt="${escapeHtml(category.name)}" class="category-preview" id="preview-${escapeHtml(category.id)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="category-placeholder" id="placeholder-${escapeHtml(category.id)}" style="display: none;">${escapeHtml(category.icon || '📷')} ${escapeHtml(category.name)}<br><span class="small">Image failed to load</span></div>`
                : `<div class="category-placeholder" id="preview-${escapeHtml(category.id)}">${escapeHtml(category.icon || '📷')} ${escapeHtml(category.name)}<br><span class="small">No image set</span></div>`
            }
            <div class="upload-area" id="drop-${escapeHtml(category.id)}">
              <div>📤 Click to upload or drag & drop</div>
              <div class="small">PNG, JPG, WebP (max 5MB)</div>
            </div>
            <input type="file" id="file-${escapeHtml(category.id)}" accept="image/*" data-category-id="${escapeHtml(category.id)}">
            ${hasImage ? `<button class="remove-btn" data-category-id="${escapeHtml(category.id)}">Remove Image</button>` : ''}
            <div class="success-message" id="success-${escapeHtml(category.id)}" style="display: none;">Image updated successfully!</div>
            <div class="error-message" id="error-${escapeHtml(category.id)}" style="display: none;">Failed to update image.</div>
          </div>
        </div>
      `;
      })
      .join('');

    // Attach event listeners after rendering
    categories.forEach(category => {
      const fileInput = document.getElementById(`file-${category.id}`);
      const dropArea = document.getElementById(`drop-${category.id}`);
      const removeBtn = document.querySelector(`.remove-btn[data-category-id="${category.id}"]`);

      if (fileInput) {
        fileInput.addEventListener('change', e => handleFileSelect(e, category.id));
      }

      if (dropArea) {
        dropArea.addEventListener('click', () => {
          if (fileInput) {
            fileInput.click();
          }
        });
        dropArea.addEventListener('dragover', handleDragOver);
        dropArea.addEventListener('dragleave', handleDragLeave);
        dropArea.addEventListener('drop', e => handleDrop(e, category.id));
      }

      if (removeBtn) {
        removeBtn.addEventListener('click', () => removeImage(category.id));
      }
    });
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
  }

  function handleDrop(e, categoryId) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadImage(categoryId, files[0]);
    }
  }

  function handleFileSelect(e, categoryId) {
    const files = e.target.files;
    if (files.length > 0) {
      uploadImage(categoryId, files[0]);
    }
  }

  async function uploadImage(categoryId, file) {
    // Validate file
    if (!file.type.startsWith('image/')) {
      showError(categoryId, 'Please select an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError(categoryId, 'File size must be less than 5MB.');
      return;
    }

    // Create FormData
    const formData = new FormData();
    formData.append('image', file);

    try {
      // Get CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrfToken;

      const response = await fetch(`/api/admin/categories/${categoryId}/hero-image`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        showSuccess(categoryId);
        await loadCategories();
      } else {
        const errorData = await response.json();
        showError(categoryId, errorData.error || 'Failed to upload image.');
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      showError(categoryId, 'Failed to upload image.');
    }
  }

  async function removeImage(categoryId) {
    if (!confirm('Are you sure you want to remove this image?')) {
      return;
    }

    try {
      // Get CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrfToken;

      const response = await fetch(`/api/admin/categories/${categoryId}/hero-image`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      });

      if (response.ok) {
        showSuccess(categoryId);
        await loadCategories();
      } else {
        const errorData = await response.json();
        showError(categoryId, errorData.error || 'Failed to remove image.');
      }
    } catch (err) {
      console.error('Error removing image:', err);
      showError(categoryId, 'Failed to remove image.');
    }
  }

  function showSuccess(categoryId) {
    const successEl = document.getElementById(`success-${categoryId}`);
    const errorEl = document.getElementById(`error-${categoryId}`);
    if (errorEl) {
      errorEl.style.display = 'none';
    }
    if (successEl) {
      successEl.style.display = 'block';
      setTimeout(() => {
        successEl.style.display = 'none';
      }, 3000);
    }
  }

  function showError(categoryId, message) {
    const successEl = document.getElementById(`success-${categoryId}`);
    const errorEl = document.getElementById(`error-${categoryId}`);
    if (successEl) {
      successEl.style.display = 'none';
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      setTimeout(() => {
        errorEl.style.display = 'none';
      }, 5000);
    }
  }

  // Load all sections on page load
  await Promise.all([loadCollageWidget(), loadCategories()]);

  // ============================================
  // COLLAGE WIDGET EVENT LISTENERS
  // ============================================

  // Enable/disable toggle
  document
    .getElementById('collageWidgetEnabled')
    .addEventListener('change', updateWidgetEnabledState);

  // Source selection
  document.querySelectorAll('input[name="collageSource"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateSourcePanels();
      const source = radio.value;
      if (source === 'uploads') {
        loadCollageMedia();
      }
    });
  });

  // Media type toggles - show/hide video queries panel
  document.getElementById('mediaTypeVideos').addEventListener('change', updateSourcePanels);

  // Save button
  document.getElementById('saveCollageWidget').addEventListener('click', saveCollageWidget);

  // Reset button
  document.getElementById('resetCollageWidget').addEventListener('click', async () => {
    if (confirm('Reset collage widget to default settings?')) {
      await loadCollageWidget();
      showCollageWidgetSuccess('Configuration reset to defaults');
    }
  });

  // Upload media button
  document.getElementById('uploadMediaBtn').addEventListener('click', () => {
    document.getElementById('mediaFileInput').click();
  });

  // File input change
  document.getElementById('mediaFileInput').addEventListener('change', e => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      uploadCollageMedia(files);
    }
    // Reset file input
    e.target.value = '';
  });

  // Event listeners
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    await Promise.all([loadCollageWidget(), loadCategories()]);
  });

  document.getElementById('backToDashboard').addEventListener('click', () => {
    location.href = '/admin.html';
  });
})();
