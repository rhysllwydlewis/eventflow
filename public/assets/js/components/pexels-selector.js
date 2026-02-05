/**
 * PexelsSelector Component
 * Supplier-facing Pexels photo browser for profile customization
 */

class PexelsSelector {
  constructor() {
    this.activeOverlay = null;
    this.photosCache = [];
    this.currentPageNum = 1;
    this.searchTerm = '';
    this.loadMoreBtn = null;
    this.hasMoreContent = false;
    this.selectionCallback = null;
  }

  /**
   * Open the selector dialog
   * @param {Function} onSelectCallback - Called with selected image URL
   */
  open(onSelectCallback) {
    this.selectionCallback = onSelectCallback;
    this.currentPageNum = 1;
    this.photosCache = [];
    this.searchTerm = '';
    
    this.buildOverlay();
    this.attachEventHandlers();
    this.fetchCuratedContent();
  }

  buildOverlay() {
    const wrapper = document.createElement('div');
    wrapper.className = 'pexels-modal-wrapper';
    wrapper.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
    
    const dialog = document.createElement('div');
    dialog.className = 'pexels-dialog';
    dialog.style.cssText = 'background:#fff;border-radius:12px;width:90%;max-width:900px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
    
    // Header section
    const headerBar = document.createElement('div');
    headerBar.style.cssText = 'padding:20px 24px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;';
    headerBar.innerHTML = `
      <h3 style="margin:0;font-size:1.25rem;color:#111827;">Select Stock Photo</h3>
      <button class="close-selector" style="background:none;border:none;font-size:28px;cursor:pointer;color:#6b7280;padding:0;width:32px;height:32px;" aria-label="Close">&times;</button>
    `;
    
    // Search section
    const searchBar = document.createElement('div');
    searchBar.style.cssText = 'padding:16px 24px;border-bottom:1px solid #e5e7eb;';
    searchBar.innerHTML = `
      <div style="display:flex;gap:8px;">
        <input type="text" class="search-field" placeholder="Search photos (wedding, venue, catering...)" style="flex:1;padding:10px 14px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;">
        <button class="search-trigger" style="padding:10px 20px;background:#0B8073;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Search</button>
        <button class="curated-trigger" style="padding:10px 20px;background:#f3f4f6;color:#374151;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Browse</button>
      </div>
    `;
    
    // Content area
    const contentArea = document.createElement('div');
    contentArea.className = 'content-scroll';
    contentArea.style.cssText = 'flex:1;overflow-y:auto;padding:24px;';
    
    const statusMsg = document.createElement('div');
    statusMsg.className = 'status-message';
    statusMsg.style.cssText = 'text-align:center;padding:40px;color:#9ca3af;';
    statusMsg.textContent = 'Loading...';
    contentArea.appendChild(statusMsg);
    
    const resultsGrid = document.createElement('div');
    resultsGrid.className = 'results-grid';
    resultsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;display:none;';
    contentArea.appendChild(resultsGrid);
    
    // Load more section
    const loadMoreSection = document.createElement('div');
    loadMoreSection.style.cssText = 'padding:16px 24px;border-top:1px solid #e5e7eb;text-align:center;display:none;';
    this.loadMoreBtn = document.createElement('button');
    this.loadMoreBtn.className = 'load-more-btn';
    this.loadMoreBtn.textContent = 'Load More Photos';
    this.loadMoreBtn.style.cssText = 'padding:10px 24px;background:#f3f4f6;color:#374151;border:none;border-radius:6px;font-weight:600;cursor:pointer;';
    loadMoreSection.appendChild(this.loadMoreBtn);
    
    dialog.appendChild(headerBar);
    dialog.appendChild(searchBar);
    dialog.appendChild(contentArea);
    dialog.appendChild(loadMoreSection);
    wrapper.appendChild(dialog);
    document.body.appendChild(wrapper);
    
    this.activeOverlay = wrapper;
  }

  attachEventHandlers() {
    const closeBtn = this.activeOverlay.querySelector('.close-selector');
    closeBtn.addEventListener('click', () => this.close());
    
    this.activeOverlay.addEventListener('click', (evt) => {
      if (evt.target === this.activeOverlay) this.close();
    });
    
    const searchField = this.activeOverlay.querySelector('.search-field');
    const searchBtn = this.activeOverlay.querySelector('.search-trigger');
    searchBtn.addEventListener('click', () => {
      const term = searchField.value.trim();
      if (term) this.performSearch(term);
    });
    
    searchField.addEventListener('keypress', (evt) => {
      if (evt.key === 'Enter') {
        const term = searchField.value.trim();
        if (term) this.performSearch(term);
      }
    });
    
    const curatedBtn = this.activeOverlay.querySelector('.curated-trigger');
    curatedBtn.addEventListener('click', () => {
      searchField.value = '';
      this.fetchCuratedContent();
    });
    
    this.loadMoreBtn.addEventListener('click', () => {
      this.loadNextPage();
    });
  }

  async performSearch(term) {
    this.searchTerm = term;
    this.currentPageNum = 1;
    this.photosCache = [];
    
    this.showStatusMessage('Searching...');
    
    try {
      const apiUrl = `/api/pexels/search?q=${encodeURIComponent(term)}&page=1&perPage=15`;
      const resp = await fetch(apiUrl, { credentials: 'include' });
      
      if (!resp.ok) {
        throw new Error('Search failed');
      }
      
      const data = await resp.json();
      this.photosCache = data.photos || [];
      this.hasMoreContent = !!data.nextPage;
      this.renderPhotos();
    } catch (err) {
      this.showStatusMessage('Failed to search. Please try again.');
      console.error('Pexels search error:', err);
    }
  }

  async fetchCuratedContent() {
    this.searchTerm = '';
    this.currentPageNum = 1;
    this.photosCache = [];
    
    this.showStatusMessage('Loading curated photos...');
    
    try {
      const apiUrl = `/api/pexels/curated?page=1&perPage=15`;
      const resp = await fetch(apiUrl, { credentials: 'include' });
      
      if (!resp.ok) {
        throw new Error('Failed to load');
      }
      
      const data = await resp.json();
      this.photosCache = data.photos || [];
      this.hasMoreContent = !!data.nextPage;
      this.renderPhotos();
    } catch (err) {
      this.showStatusMessage('Unable to load photos. Please try again.');
      console.error('Pexels curated error:', err);
    }
  }

  async loadNextPage() {
    this.currentPageNum += 1;
    this.loadMoreBtn.disabled = true;
    this.loadMoreBtn.textContent = 'Loading...';
    
    try {
      const apiUrl = this.searchTerm 
        ? `/api/pexels/search?q=${encodeURIComponent(this.searchTerm)}&page=${this.currentPageNum}&perPage=15`
        : `/api/pexels/curated?page=${this.currentPageNum}&perPage=15`;
      
      const resp = await fetch(apiUrl, { credentials: 'include' });
      
      if (!resp.ok) {
        throw new Error('Failed to load more');
      }
      
      const data = await resp.json();
      this.photosCache.push(...(data.photos || []));
      this.hasMoreContent = !!data.nextPage;
      this.renderPhotos();
    } catch (err) {
      console.error('Load more error:', err);
      this.currentPageNum -= 1;
    } finally {
      this.loadMoreBtn.disabled = false;
      this.loadMoreBtn.textContent = 'Load More Photos';
    }
  }

  renderPhotos() {
    const statusDiv = this.activeOverlay.querySelector('.status-message');
    const gridDiv = this.activeOverlay.querySelector('.results-grid');
    const loadMoreSection = this.loadMoreBtn.parentElement;
    
    if (this.photosCache.length === 0) {
      statusDiv.textContent = 'No photos found. Try a different search.';
      statusDiv.style.display = 'block';
      gridDiv.style.display = 'none';
      loadMoreSection.style.display = 'none';
      return;
    }
    
    statusDiv.style.display = 'none';
    gridDiv.style.display = 'grid';
    
    gridDiv.innerHTML = this.photosCache.map(photo => {
      const safeAlt = this.escapeText(photo.alt || 'Photo');
      const safePhotographer = this.escapeText(photo.photographer);
      return `
        <div class="photo-item" data-url="${this.escapeText(photo.src.large)}" style="background:#fff;border-radius:8px;overflow:hidden;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <img src="${this.escapeText(photo.src.medium)}" alt="${safeAlt}" style="width:100%;height:180px;object-fit:cover;display:block;">
          <div style="padding:12px;">
            <p style="margin:0 0 10px 0;font-size:13px;color:#6b7280;">📸 ${safePhotographer}</p>
            <button class="select-photo-btn" style="width:100%;padding:8px;background:#0B8073;color:#fff;border:none;border-radius:4px;font-weight:600;cursor:pointer;font-size:13px;">Select Photo</button>
          </div>
        </div>
      `;
    }).join('');
    
    // Attach selection handlers
    gridDiv.querySelectorAll('.photo-item').forEach(item => {
      const selectBtn = item.querySelector('.select-photo-btn');
      selectBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        const imageUrl = item.dataset.url;
        this.handleSelection(imageUrl);
      });
      
      // Also allow clicking the whole card
      item.addEventListener('click', () => {
        const imageUrl = item.dataset.url;
        this.handleSelection(imageUrl);
      });
      
      // Hover effect
      item.addEventListener('mouseenter', () => {
        item.style.transform = 'translateY(-4px)';
        item.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.transform = '';
        item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      });
    });
    
    // Show/hide load more button
    loadMoreSection.style.display = this.hasMoreContent ? 'block' : 'none';
  }

  handleSelection(imageUrl) {
    if (this.selectionCallback && typeof this.selectionCallback === 'function') {
      this.selectionCallback(imageUrl);
    }
    this.close();
  }

  showStatusMessage(msg) {
    const statusDiv = this.activeOverlay.querySelector('.status-message');
    const gridDiv = this.activeOverlay.querySelector('.results-grid');
    const loadMoreSection = this.loadMoreBtn.parentElement;
    
    statusDiv.textContent = msg;
    statusDiv.style.display = 'block';
    gridDiv.style.display = 'none';
    loadMoreSection.style.display = 'none';
  }

  close() {
    if (this.activeOverlay && this.activeOverlay.parentElement) {
      this.activeOverlay.parentElement.removeChild(this.activeOverlay);
    }
    this.activeOverlay = null;
    this.photosCache = [];
    this.selectionCallback = null;
  }

  escapeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PexelsSelector = PexelsSelector;
}
