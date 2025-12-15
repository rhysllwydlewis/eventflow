(async function() {
  // Check admin authentication
  try {
    const response = await fetch('/api/auth/me');
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

  let categories = [];
  const categoryListElement = document.getElementById('categoryList');

  // HTML sanitization helper
  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function loadCategories() {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        categories = data.items || [];
        renderCategories();
      } else {
        categoryListElement.innerHTML = '<div class="card"><p class="small">Failed to load categories. Please try again.</p></div>';
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      categoryListElement.innerHTML = '<div class="card"><p class="small">Failed to load categories. Please try again.</p></div>';
    }
  }

  function renderCategories() {
    if (categories.length === 0) {
      categoryListElement.innerHTML = '<div class="card"><p class="small">No categories found.</p></div>';
      return;
    }

    categoryListElement.innerHTML = categories.map(category => {
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
            ${hasImage 
              ? `<img src="${escapeHtml(category.heroImage)}" alt="${escapeHtml(category.name)}" class="category-preview" id="preview-${escapeHtml(category.id)}">`
              : `<div class="category-placeholder" id="preview-${escapeHtml(category.id)}">No image set</div>`
            }
            <div class="upload-area" id="drop-${escapeHtml(category.id)}">
              <div>📤 Click to upload or drag & drop</div>
              <div class="small">PNG, JPG, WebP (max 5MB)</div>
            </div>
            <input type="file" id="file-${escapeHtml(category.id)}" accept="image/*" data-category-id="${escapeHtml(category.id)}">
            ${hasImage ? `<button class="remove-btn" data-category-id="${escapeHtml(category.id)}">Remove Image</button>` : ''}
            <div class="success-message" id="success-${escapeHtml(category.id)}">Image updated successfully!</div>
            <div class="error-message" id="error-${escapeHtml(category.id)}">Failed to update image.</div>
          </div>
        </div>
      `;
    }).join('');

    // Attach event listeners after rendering
    categories.forEach(category => {
      const fileInput = document.getElementById(`file-${category.id}`);
      const dropArea = document.getElementById(`drop-${category.id}`);
      const removeBtn = document.querySelector(`.remove-btn[data-category-id="${category.id}"]`);

      if (fileInput) {
        fileInput.addEventListener('change', (e) => handleFileSelect(e, category.id));
      }

      if (dropArea) {
        dropArea.addEventListener('click', () => {
          if (fileInput) {
            fileInput.click();
          }
        });
        dropArea.addEventListener('dragover', handleDragOver);
        dropArea.addEventListener('dragleave', handleDragLeave);
        dropArea.addEventListener('drop', (e) => handleDrop(e, category.id));
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
      const csrfResponse = await fetch('/api/csrf-token');
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrfToken;

      const response = await fetch(`/api/admin/categories/${categoryId}/hero-image`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        body: formData
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
      const csrfResponse = await fetch('/api/csrf-token');
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrfToken;

      const response = await fetch(`/api/admin/categories/${categoryId}/hero-image`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        }
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
    if (errorEl) errorEl.style.display = 'none';
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
    if (successEl) successEl.style.display = 'none';
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      setTimeout(() => {
        errorEl.style.display = 'none';
      }, 5000);
    }
  }

  // Load categories on page load
  await loadCategories();

  // Event listeners
  document.getElementById('refreshBtn').addEventListener('click', loadCategories);
  
  document.getElementById('backToDashboard').addEventListener('click', function() {
    location.href = '/admin.html';
  });
})();
