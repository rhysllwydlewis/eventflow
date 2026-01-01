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
  let heroImages = {};

  const categoryListElement = document.getElementById('categoryList');
  const heroImageListElement = document.getElementById('heroImageList');

  // Category display information for hero collage
  const heroCollageInfo = {
    venues: { name: 'Venues', icon: '🏛️', description: 'Event venues and locations' },
    catering: { name: 'Catering', icon: '🍽️', description: 'Food and beverage services' },
    entertainment: { name: 'Entertainment', icon: '🎵', description: 'Music and entertainment' },
    photography: { name: 'Photography', icon: '📸', description: 'Photography services' },
  };

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
  // HERO COLLAGE SECTION
  // ============================================

  async function loadHeroImages() {
    try {
      const response = await fetch('/api/admin/homepage/hero-images', {
        credentials: 'include',
      });
      if (response.ok) {
        heroImages = await response.json();
        renderHeroImages();
      } else {
        // Show error message with retry button
        heroImageListElement.innerHTML =
          '<div class="card error-card"><p class="error-message-text">❌ Failed to load hero collage images.</p><button onclick="location.reload()" class="btn btn-secondary">Retry</button></div>';
      }
    } catch (err) {
      console.error('Error loading hero images:', err);
      // Show error message with retry button
      heroImageListElement.innerHTML =
        '<div class="card error-card"><p class="error-message-text">❌ Failed to load hero collage images. Please check your connection and try again.</p><button onclick="location.reload()" class="btn btn-secondary">Retry</button></div>';
    }
  }

  function renderHeroImages() {
    const categoryKeys = Object.keys(heroCollageInfo);

    heroImageListElement.innerHTML = categoryKeys
      .map(category => {
        const info = heroCollageInfo[category];
        const imageUrl = heroImages[category] || `/assets/images/collage-${category}.jpg`;
        const isDefault = imageUrl.includes('/assets/images/collage-');

        return `
        <div class="category-card" data-hero-category="${escapeHtml(category)}">
          <div class="category-card-header">
            <h3 class="category-card-title">
              <span>${escapeHtml(info.icon)}</span>
              <span>${escapeHtml(info.name)}</span>
            </h3>
            <p class="small" style="margin: 4px 0 0 0; color: #6c757d;">${escapeHtml(info.description)}</p>
          </div>
          <div class="category-card-body">
            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(info.name)} hero collage image" class="category-preview" id="hero-preview-${escapeHtml(category)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="category-placeholder" id="hero-placeholder-${escapeHtml(category)}" style="display: none;">${escapeHtml(info.icon)} ${escapeHtml(info.name)}<br><span class="small">Image failed to load</span></div>
            <div class="upload-area" id="hero-drop-${escapeHtml(category)}">
              <div>📤 Click to upload or drag & drop</div>
              <div class="small">PNG, JPG, WebP (max 5MB, recommended 800x600px)</div>
            </div>
            <input type="file" id="hero-file-${escapeHtml(category)}" accept="image/*" data-hero-category="${escapeHtml(category)}">
            ${!isDefault ? `<button class="remove-btn" data-hero-category="${escapeHtml(category)}">Reset to Default</button>` : '<p class="small" style="margin: 8px 0; color: #6c757d;">Using default image</p>'}
            <div class="success-message" id="hero-success-${escapeHtml(category)}" style="display: none;">Image updated successfully!</div>
            <div class="error-message" id="hero-error-${escapeHtml(category)}" style="display: none;">Failed to update image.</div>
          </div>
        </div>
      `;
      })
      .join('');

    // Attach event listeners for hero collage
    categoryKeys.forEach(category => {
      const fileInput = document.getElementById(`hero-file-${category}`);
      const dropArea = document.getElementById(`hero-drop-${category}`);
      const removeBtn = document.querySelector(`.remove-btn[data-hero-category="${category}"]`);

      if (fileInput) {
        fileInput.addEventListener('change', e => handleHeroFileSelect(e, category));
      }

      if (dropArea) {
        dropArea.addEventListener('click', () => {
          if (fileInput) {
            fileInput.click();
          }
        });
        dropArea.addEventListener('dragover', handleDragOver);
        dropArea.addEventListener('dragleave', handleDragLeave);
        dropArea.addEventListener('drop', e => handleHeroDrop(e, category));
      }

      if (removeBtn) {
        removeBtn.addEventListener('click', () => removeHeroImage(category));
      }
    });
  }

  function handleHeroDrop(e, category) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadHeroImage(category, files[0]);
    }
  }

  function handleHeroFileSelect(e, category) {
    const files = e.target.files;
    if (files.length > 0) {
      uploadHeroImage(category, files[0]);
    }
  }

  async function uploadHeroImage(category, file) {
    // Validate file
    if (!file.type.startsWith('image/')) {
      showHeroError(category, 'Please select an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showHeroError(category, 'File size must be less than 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrfToken;

      const response = await fetch(`/api/admin/homepage/hero-images/${category}`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        showHeroSuccess(category);
        await loadHeroImages();
      } else {
        const errorData = await response.json();
        showHeroError(category, errorData.error || 'Failed to upload image.');
      }
    } catch (err) {
      console.error('Error uploading hero image:', err);
      showHeroError(category, 'Failed to upload image.');
    }
  }

  async function removeHeroImage(category) {
    if (!confirm('Reset to default image? Your custom image will be removed.')) {
      return;
    }

    try {
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrfToken;

      const response = await fetch(`/api/admin/homepage/hero-images/${category}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      });

      if (response.ok) {
        showHeroSuccess(category);
        await loadHeroImages();
      } else {
        const errorData = await response.json();
        showHeroError(category, errorData.error || 'Failed to reset image.');
      }
    } catch (err) {
      console.error('Error resetting hero image:', err);
      showHeroError(category, 'Failed to reset image.');
    }
  }

  function showHeroSuccess(category) {
    const successEl = document.getElementById(`hero-success-${category}`);
    const errorEl = document.getElementById(`hero-error-${category}`);
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

  function showHeroError(category, message) {
    const successEl = document.getElementById(`hero-success-${category}`);
    const errorEl = document.getElementById(`hero-error-${category}`);
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

  // Load both sections on page load
  await Promise.all([loadHeroImages(), loadCategories()]);

  // Event listeners
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    await Promise.all([loadHeroImages(), loadCategories()]);
  });

  document.getElementById('backToDashboard').addEventListener('click', () => {
    location.href = '/admin.html';
  });
})();
