/**
 * EventFlow Mood Board Component
 * Pinterest-style mood board with Unsplash integration
 */

class MoodBoard {
  constructor(options = {}) {
    this.options = {
      container: options.container || '#mood-board',
      editable: options.editable !== false,
      unsplashAccessKey: options.unsplashAccessKey || 'YOUR_UNSPLASH_ACCESS_KEY',
      columns: options.columns || 4,
      onImageAdd: options.onImageAdd || null,
      onImageRemove: options.onImageRemove || null,
      onBoardSave: options.onBoardSave || null
    };

    this.container = null;
    this.images = options.images || [];
    this.masonry = null;
    
    this.init();
  }

  init() {
    const containerEl = typeof this.options.container === 'string'
      ? document.querySelector(this.options.container)
      : this.options.container;

    if (!containerEl) {
      console.error('Mood board container not found');
      return;
    }

    this.container = containerEl;
    this.render();
    this.injectStyles();
  }

  render() {
    this.container.innerHTML = `
      <div class="mood-board">
        <div class="mood-board-header">
          <h2>Mood Board</h2>
          <div class="mood-board-actions">
            ${this.options.editable ? `
              <button class="btn btn-secondary" id="search-images-btn">
                🔍 Search Images
              </button>
              <button class="btn btn-secondary" id="upload-image-btn">
                📤 Upload
              </button>
              <button class="btn btn-primary" id="save-board-btn">
                💾 Save Board
              </button>
            ` : ''}
          </div>
        </div>
        
        <div class="mood-board-grid" id="mood-board-grid">
          ${this.renderImages()}
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.initMasonry();
  }

  renderImages() {
    if (this.images.length === 0) {
      return `
        <div class="mood-board-empty">
          <p>Your mood board is empty. Start by searching for inspiration or uploading your own images!</p>
        </div>
      `;
    }

    return this.images.map((image, index) => `
      <div class="mood-board-item" data-index="${index}">
        <img src="${image.url || image.urls?.small || image.urls?.regular}" 
             alt="${image.alt || image.description || 'Mood board image'}"
             loading="lazy">
        ${this.options.editable ? `
          <div class="mood-board-item-overlay">
            <button class="btn-icon-white" data-action="remove" data-index="${index}" title="Remove">
              🗑️
            </button>
            ${image.user ? `
              <div class="image-credit">
                Photo by ${this.escapeHtml(image.user.name)} on Unsplash
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  initMasonry() {
    const grid = this.container.querySelector('#mood-board-grid');
    if (!grid) return;

    // Simple CSS Grid masonry layout
    const itemCount = this.images.length;
    if (itemCount > 0) {
      grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(250px, 1fr))`;
    }
  }

  attachEventListeners() {
    // Search images button
    const searchBtn = this.container.querySelector('#search-images-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.showSearchModal());
    }

    // Upload button
    const uploadBtn = this.container.querySelector('#upload-image-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => this.showUploadModal());
    }

    // Save board button
    const saveBtn = this.container.querySelector('#save-board-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveBoard());
    }

    // Remove image buttons
    this.container.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-action="remove"]');
      if (removeBtn) {
        const index = parseInt(removeBtn.dataset.index);
        this.removeImage(index);
      }
    });
  }

  showSearchModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>Search Unsplash</h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="search-bar">
            <input type="text" id="unsplash-search" placeholder="Search for wedding, flowers, venues..." class="search-input">
            <button class="btn btn-primary" id="search-submit">Search</button>
          </div>
          <div id="search-results" class="unsplash-results"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const searchInput = modal.querySelector('#unsplash-search');
    const searchBtn = modal.querySelector('#search-submit');
    const resultsContainer = modal.querySelector('#search-results');

    const performSearch = () => {
      const query = searchInput.value.trim();
      if (query) {
        this.searchUnsplash(query, resultsContainer);
      }
    };

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  async searchUnsplash(query, resultsContainer) {
    resultsContainer.innerHTML = '<div class="loading">Searching Unsplash...</div>';

    try {
      // Note: In production, this should be done through your backend to keep the API key secure
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&client_id=${this.options.unsplashAccessKey}`);
      
      if (!response.ok) {
        throw new Error('Failed to search Unsplash');
      }

      const data = await response.json();
      
      if (data.results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No images found. Try a different search term.</div>';
        return;
      }

      resultsContainer.innerHTML = `
        <div class="unsplash-grid">
          ${data.results.map(photo => `
            <div class="unsplash-item" data-photo-id="${photo.id}">
              <img src="${photo.urls.small}" alt="${photo.alt_description || 'Unsplash photo'}" loading="lazy">
              <div class="unsplash-item-overlay">
                <button class="btn btn-primary btn-sm" data-action="add-unsplash" data-photo='${JSON.stringify({
                  id: photo.id,
                  url: photo.urls.regular,
                  urls: photo.urls,
                  alt: photo.alt_description,
                  description: photo.description,
                  user: {
                    name: photo.user.name,
                    link: photo.user.links.html
                  }
                })}'>
                  Add to Board
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Add event listeners for add buttons
      resultsContainer.addEventListener('click', (e) => {
        const addBtn = e.target.closest('[data-action="add-unsplash"]');
        if (addBtn) {
          const photo = JSON.parse(addBtn.dataset.photo);
          this.addImage(photo);
          
          // Show confirmation
          if (typeof showToast === 'function') {
            showToast('Image added to mood board!', 'success');
          }
        }
      });

    } catch (error) {
      console.error('Error searching Unsplash:', error);
      resultsContainer.innerHTML = `
        <div class="error-message">
          <p>Unable to search Unsplash. Please try again later.</p>
          <p class="small">Tip: You can still upload your own images!</p>
        </div>
      `;
    }
  }

  showUploadModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Upload Image</h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="upload-area" id="upload-area">
            <input type="file" id="image-upload" accept="image/*" multiple hidden>
            <label for="image-upload" class="upload-label">
              <div class="upload-icon">📤</div>
              <p>Click to select images or drag and drop</p>
              <p class="small">Supports JPG, PNG, GIF</p>
            </label>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const uploadArea = modal.querySelector('#upload-area');
    const fileInput = modal.querySelector('#image-upload');

    // Handle file selection
    fileInput.addEventListener('change', (e) => {
      this.handleFileUpload(e.target.files);
      modal.remove();
    });

    // Handle drag and drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      this.handleFileUpload(e.dataTransfer.files);
      modal.remove();
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  handleFileUpload(files) {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.addImage({
            url: e.target.result,
            alt: file.name,
            uploaded: true
          });
        };
        reader.readAsDataURL(file);
      }
    });
  }

  addImage(image) {
    this.images.push(image);
    this.render();

    if (this.options.onImageAdd) {
      this.options.onImageAdd(image);
    }
  }

  removeImage(index) {
    if (confirm('Remove this image from your mood board?')) {
      const removed = this.images.splice(index, 1)[0];
      this.render();

      if (this.options.onImageRemove) {
        this.options.onImageRemove(removed);
      }
    }
  }

  saveBoard() {
    if (this.options.onBoardSave) {
      this.options.onBoardSave(this.images);
    }

    if (typeof showToast === 'function') {
      showToast('Mood board saved!', 'success');
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  injectStyles() {
    if (document.getElementById('mood-board-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'mood-board-styles';
    styles.textContent = `
      .mood-board {
        max-width: 1400px;
        margin: 0 auto;
        padding: 20px;
      }

      .mood-board-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        flex-wrap: wrap;
        gap: 16px;
      }

      .mood-board-header h2 {
        margin: 0;
      }

      .mood-board-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .mood-board-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 16px;
        grid-auto-flow: dense;
      }

      .mood-board-item {
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        background: #F1F5F9;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        cursor: pointer;
      }

      .mood-board-item:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
      }

      .mood-board-item img {
        width: 100%;
        height: auto;
        display: block;
        object-fit: cover;
      }

      .mood-board-item-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent 30%, transparent 70%, rgba(0, 0, 0, 0.6));
        opacity: 0;
        transition: opacity 0.3s ease;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 12px;
      }

      .mood-board-item:hover .mood-board-item-overlay {
        opacity: 1;
      }

      .btn-icon-white {
        background: white;
        border: none;
        padding: 8px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 1rem;
        align-self: flex-end;
        transition: background 0.2s;
      }

      .btn-icon-white:hover {
        background: #F1F5F9;
      }

      .image-credit {
        font-size: 0.75rem;
        color: white;
        text-align: right;
      }

      .mood-board-empty {
        grid-column: 1 / -1;
        text-align: center;
        padding: 80px 20px;
        color: #64748B;
      }

      .search-bar {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
      }

      .search-input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid #CBD5E1;
        border-radius: 8px;
        font-size: 1rem;
      }

      .unsplash-results {
        min-height: 300px;
      }

      .unsplash-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }

      .unsplash-item {
        position: relative;
        border-radius: 8px;
        overflow: hidden;
        background: #F1F5F9;
        cursor: pointer;
      }

      .unsplash-item img {
        width: 100%;
        height: auto;
        display: block;
      }

      .unsplash-item-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .unsplash-item:hover .unsplash-item-overlay {
        opacity: 1;
      }

      .upload-area {
        border: 2px dashed #CBD5E1;
        border-radius: 12px;
        padding: 60px 20px;
        text-align: center;
        transition: all 0.3s ease;
      }

      .upload-area.drag-over {
        border-color: var(--ink, #0B8073);
        background: rgba(11, 128, 115, 0.05);
      }

      .upload-label {
        cursor: pointer;
        display: block;
      }

      .upload-icon {
        font-size: 3rem;
        margin-bottom: 16px;
      }

      .loading {
        text-align: center;
        padding: 60px 20px;
        color: #64748B;
      }

      .no-results {
        text-align: center;
        padding: 60px 20px;
        color: #64748B;
      }

      .error-message {
        text-align: center;
        padding: 60px 20px;
        color: #EF4444;
      }

      .modal-large {
        max-width: 900px;
        max-height: 90vh;
        overflow-y: auto;
      }

      @media (max-width: 768px) {
        .mood-board-grid {
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }

        .mood-board-header {
          flex-direction: column;
          align-items: flex-start;
        }

        .mood-board-actions {
          width: 100%;
        }

        .mood-board-actions button {
          flex: 1;
        }

        .unsplash-grid {
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        }
      }
    `;
    document.head.appendChild(styles);
  }

  getImages() {
    return this.images;
  }

  setImages(images) {
    this.images = images;
    this.render();
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MoodBoard;
}
