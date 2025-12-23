(function () {
  'use strict';

  let allPackages = [];
  let allSuppliers = [];
  let currentImageFile = null;
  let currentImageUrl = null;

  // Fetch CSRF token on page load
  fetch('/api/csrf-token', {
    credentials: 'include',
  })
    .then(r => r.json())
    .then(data => {
      if (data && data.csrfToken) {
        window.__CSRF_TOKEN__ = data.csrfToken;
      }
    })
    .catch(err => console.warn('Could not fetch CSRF token:', err));

  function api(url, method, body) {
    const opts = {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };

    // Add CSRF token for state-changing requests
    if (method && ['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
      if (window.__CSRF_TOKEN__) {
        opts.headers['X-CSRF-Token'] = window.__CSRF_TOKEN__;
      }
    }

    if (body) {
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(r => {
      const contentType = r.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      if (isJson) {
        return r.json().then(data => {
          if (!r.ok) {
            const err = data && data.error ? data.error : `Request failed with ${r.status}`;
            throw new Error(err);
          }
          return data;
        });
      } else {
        return r.text().then(text => {
          if (!r.ok) {
            throw new Error(text || `Request failed with ${r.status}`);
          }
          try {
            return JSON.parse(text);
          } catch (e) {
            return { message: text };
          }
        });
      }
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  async function loadPackages() {
    try {
      // Load from MongoDB API
      const data = await api('/api/admin/packages');
      allPackages = data.items || [];
      renderPackages(allPackages);
    } catch (err) {
      console.error('Failed to load packages:', err);
      if (typeof Toast !== 'undefined') {
        Toast.error(`Failed to load packages: ${err.message}`);
      }
    }
  }

  async function loadSuppliers() {
    try {
      // Load from MongoDB API
      const data = await api('/api/admin/suppliers');
      allSuppliers = data.items || [];
      populateSupplierSelect();
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    }
  }

  function populateSupplierSelect() {
    const select = document.getElementById('packageSupplierId');
    if (!select) {
      return;
    }

    select.innerHTML = '<option value="">Select a supplier...</option>';
    allSuppliers.forEach(supplier => {
      const option = document.createElement('option');
      option.value = supplier.id;
      option.textContent = supplier.name || 'Unnamed Supplier';
      select.appendChild(option);
    });
  }

  function renderPackages(packages) {
    const container = document.getElementById('packagesContainer');
    if (!container) {
      return;
    }

    if (!packages.length) {
      container.innerHTML = '<p class="small">No packages found.</p>';
      return;
    }

    let html = '<table class="table"><thead><tr>';
    html += '<th>Image</th><th>Title</th><th>Price</th><th>Status</th><th>Actions</th>';
    html += '</tr></thead><tbody>';

    packages.forEach(pkg => {
      html += '<tr>';
      html += `<td><img src="${escapeHtml(
        pkg.image || ''
      )}" class="package-image" alt="Package image"></td>`;
      html += `<td><strong>${escapeHtml(
        pkg.title || ''
      )}</strong><br><span class="small">${escapeHtml((pkg.description || '').substring(0, 100))}${
        pkg.description && pkg.description.length > 100 ? '...' : ''
      }</span></td>`;
      html += `<td>${escapeHtml(pkg.price_display || '')}</td>`;
      html += '<td>';
      html += `<span class="badge ${pkg.approved ? 'badge-yes' : 'badge-no'}">${
        pkg.approved ? 'Approved' : 'Pending'
      }</span> `;
      if (pkg.featured) {
        html += '<span class="badge badge-yes">Featured</span>';
      }
      html += '</td>';
      html += '<td>';
      html += `<button class="btn btn-primary btn-small" data-action="editPackage" data-id="${
        pkg.id
      }">Edit</button> `;
      html += `<button class="btn btn-small ${
        pkg.approved ? 'btn-secondary' : 'btn-primary'
      }" data-action="toggleApproval" data-id="${pkg.id}" data-param="${!pkg.approved}">${
        pkg.approved ? 'Unapprove' : 'Approve'
      }</button> `;
      html += `<button class="btn btn-small ${
        pkg.featured ? 'btn-secondary' : 'btn-primary'
      }" data-action="toggleFeatured" data-id="${pkg.id}" data-param="${!pkg.featured}">${
        pkg.featured ? 'Unfeature' : 'Feature'
      }</button> `;
      html += `<button class="btn btn-danger btn-small" data-action="deletePackage" data-id="${
        pkg.id
      }">Delete</button>`;
      html += '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // Image Upload Functionality
  function setupImageUpload() {
    const uploadZone = document.getElementById('imageUploadZone');
    const fileInput = document.getElementById('imageFileInput');
    const changeBtn = document.getElementById('changeImageBtn');

    // Click to upload
    uploadZone.addEventListener('click', e => {
      if (e.target !== changeBtn && !changeBtn.contains(e.target)) {
        fileInput.click();
      }
    });

    // File input change
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        handleImageFile(file);
      }
    });

    // Drag and drop
    uploadZone.addEventListener('dragover', e => {
      e.preventDefault();
      uploadZone.style.borderColor = '#3b82f6';
      uploadZone.style.background = '#eff6ff';
    });

    uploadZone.addEventListener('dragleave', e => {
      e.preventDefault();
      uploadZone.style.borderColor = '#d4d4d8';
      uploadZone.style.background = '#fafafa';
    });

    uploadZone.addEventListener('drop', e => {
      e.preventDefault();
      uploadZone.style.borderColor = '#d4d4d8';
      uploadZone.style.background = '#fafafa';

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        handleImageFile(file);
      } else {
        if (typeof Toast !== 'undefined') {
          Toast.error('Please drop an image file');
        }
      }
    });

    // Change image button
    changeBtn.addEventListener('click', e => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  function handleImageFile(file) {
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      if (typeof Toast !== 'undefined') {
        Toast.error('Image size must be less than 5MB');
      }
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      if (typeof Toast !== 'undefined') {
        Toast.error('Please select an image file');
      }
      return;
    }

    currentImageFile = file;

    // Show preview
    const reader = new FileReader();
    reader.addEventListener('load', e => {
      const placeholder = document.getElementById('uploadPlaceholder');
      const preview = document.getElementById('imagePreview');
      const previewImage = document.getElementById('previewImage');

      previewImage.src = e.target.result;
      // Store the preview URL for use when upload is disabled
      currentImageUrl = e.target.result;
      placeholder.style.display = 'none';
      preview.style.display = 'block';
    });
    reader.readAsDataURL(file);
  }

  window.editPackage = async function (id) {
    const pkg = allPackages.find(p => p.id === id);
    if (!pkg) {
      if (typeof Toast !== 'undefined') {
        Toast.error('Package not found');
      }
      return;
    }

    document.getElementById('formTitle').textContent = 'Edit Package';
    document.getElementById('packageId').value = pkg.id;
    document.getElementById('packageSupplierId').value = pkg.supplierId || '';
    document.getElementById('packageTitle').value = pkg.title || '';
    document.getElementById('packageDescription').value = pkg.description || '';
    document.getElementById('packagePrice').value = pkg.price_display || '';
    document.getElementById('packageImage').value = pkg.image || '';
    document.getElementById('packageApproved').checked = !!pkg.approved;
    document.getElementById('packageFeatured').checked = !!pkg.featured;

    // Show image preview if exists
    if (pkg.image) {
      const placeholder = document.getElementById('uploadPlaceholder');
      const preview = document.getElementById('imagePreview');
      const previewImage = document.getElementById('previewImage');

      previewImage.src = pkg.image;
      placeholder.style.display = 'none';
      preview.style.display = 'block';
      currentImageUrl = pkg.image;
    }

    document.getElementById('packageFormSection').style.display = 'block';
    document.getElementById('packageFormSection').scrollIntoView({ behavior: 'smooth' });
  };

  window.toggleApproval = async function (id, approved) {
    try {
      await api(`/api/admin/packages/${id}/approve`, 'POST', { approved: approved });
      if (typeof Toast !== 'undefined') {
        Toast.success(approved ? 'Package approved' : 'Package unapproved');
      }
      await loadPackages();
    } catch (err) {
      if (typeof Toast !== 'undefined') {
        Toast.error(`Failed to update package: ${err.message}`);
      }
    }
  };

  window.toggleFeatured = async function (id, featured) {
    try {
      await api(`/api/admin/packages/${id}/feature`, 'POST', { featured: featured });
      if (typeof Toast !== 'undefined') {
        Toast.success(featured ? 'Package featured' : 'Package unfeatured');
      }
      await loadPackages();
    } catch (err) {
      if (typeof Toast !== 'undefined') {
        Toast.error(`Failed to update package: ${err.message}`);
      }
    }
  };

  window.deletePackage = function (id) {
    if (typeof Modal !== 'undefined') {
      const modal = new Modal({
        title: 'Delete Package',
        content:
          '<p>Are you sure you want to delete this package? This action cannot be undone.</p>',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm: async function () {
          try {
            await api(`/api/admin/packages/${id}`, 'DELETE');
            if (typeof Toast !== 'undefined') {
              Toast.success('Package deleted successfully');
            }
            await loadPackages();
          } catch (err) {
            if (typeof Toast !== 'undefined') {
              Toast.error(`Failed to delete package: ${err.message}`);
            }
          }
        },
      });
      modal.show();
    } else {
      if (!confirm('Are you sure you want to delete this package? This action cannot be undone.')) {
        return;
      }
      api(`/api/admin/packages/${id}`, 'DELETE')
        .then(() => {
          alert('Package deleted successfully');
          return loadPackages();
        })
        .catch(err => {
          alert(`Failed to delete package: ${err.message}`);
        });
    }
  };

  // Add Package Button
  document.getElementById('addPackageBtn').addEventListener('click', () => {
    document.getElementById('formTitle').textContent = 'Add Package';
    document.getElementById('packageForm').reset();
    document.getElementById('packageId').value = '';
    currentImageFile = null;
    currentImageUrl = null;

    // Reset image preview
    const placeholder = document.getElementById('uploadPlaceholder');
    const preview = document.getElementById('imagePreview');
    placeholder.style.display = 'block';
    preview.style.display = 'none';

    document.getElementById('packageFormSection').style.display = 'block';
    document.getElementById('packageFormSection').scrollIntoView({ behavior: 'smooth' });
  });

  // Cancel Form Button
  document.getElementById('cancelFormBtn').addEventListener('click', () => {
    document.getElementById('packageFormSection').style.display = 'none';
    document.getElementById('packageForm').reset();
    currentImageFile = null;
    currentImageUrl = null;
  });

  // Package Form Submit
  document.getElementById('packageForm').addEventListener('submit', async e => {
    e.preventDefault();

    const id = document.getElementById('packageId').value;
    const supplierId = document.getElementById('packageSupplierId').value;

    if (!supplierId) {
      if (typeof Toast !== 'undefined') {
        Toast.error('Please select a supplier');
      }
      return;
    }

    const packageData = {
      supplierId: supplierId,
      title: document.getElementById('packageTitle').value,
      description: document.getElementById('packageDescription').value,
      price_display: document.getElementById('packagePrice').value,
      approved: document.getElementById('packageApproved').checked,
      featured: document.getElementById('packageFeatured').checked,
    };

    try {
      const saveBtn = document.getElementById('savePackageBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      // Handle image - simplified logic
      let imageUrl = document.getElementById('packageImage').value;

      if (currentImageFile) {
        // If user selected a new file, use the preview URL (already stored as base64 from handleImageFile)
        imageUrl = currentImageUrl;

        if (typeof Toast !== 'undefined') {
          Toast.info('Image will be embedded in base64 format. For production, implement proper image upload.');
        }
      } else if (currentImageUrl) {
        imageUrl = currentImageUrl;
      }

      if (!imageUrl) {
        throw new Error('Please select an image URL or upload an image file');
      }

      packageData.image = imageUrl;

      // Save to MongoDB via API
      packageData.createdAt = id ? undefined : new Date().toISOString();
      packageData.updatedAt = new Date().toISOString();

      if (id) {
        await api(`/api/admin/packages/${id}`, 'PUT', packageData);
      } else {
        await api('/api/admin/packages', 'POST', packageData);
      }

      if (typeof Toast !== 'undefined') {
        Toast.success(id ? 'Package updated successfully' : 'Package created successfully');
      }

      document.getElementById('packageFormSection').style.display = 'none';
      document.getElementById('packageForm').reset();
      currentImageFile = null;
      currentImageUrl = null;
      await loadPackages();
    } catch (err) {
      if (typeof Toast !== 'undefined') {
        Toast.error(`Failed to save package: ${err.message}`);
      } else {
        alert(`Failed to save package: ${err.message}`);
      }
    } finally {
      const saveBtn = document.getElementById('savePackageBtn');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Package';
    }
  });

  // Search functionality
  document.getElementById('searchInput').addEventListener('input', e => {
    const query = e.target.value.toLowerCase();
    if (!query) {
      renderPackages(allPackages);
      return;
    }

    const filtered = allPackages.filter(pkg => {
      return (
        (pkg.title || '').toLowerCase().includes(query) ||
        (pkg.description || '').toLowerCase().includes(query) ||
        (pkg.price_display || '').toLowerCase().includes(query)
      );
    });
    renderPackages(filtered);
  });

  // Initialize
  setupImageUpload();
  loadPackages();
  loadSuppliers();

  // Event delegation for dynamically created buttons
  document.body.addEventListener('click', e => {
    const target = e.target;
    if (target.tagName !== 'BUTTON') {
      return;
    }

    const action = target.getAttribute('data-action');
    if (!action) {
      return;
    }

    const id = target.getAttribute('data-id');
    const param = target.getAttribute('data-param');

    switch (action) {
      case 'editPackage':
        if (id) {
          editPackage(id);
        }
        break;
      case 'toggleApproval':
        if (id && param !== null) {
          toggleApproval(id, param === 'true');
        }
        break;
      case 'toggleFeatured':
        if (id && param !== null) {
          toggleFeatured(id, param === 'true');
        }
        break;
      case 'deletePackage':
        if (id) {
          deletePackage(id);
        }
        break;
    }
  });

  // Back to dashboard button
  document.getElementById('backToDashboard').addEventListener('click', () => {
    location.href = '/admin.html';
  });
})();
