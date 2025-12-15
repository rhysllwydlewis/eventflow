# Package Detail & Category Filtering Feature - Implementation Plan

## Overview
This document outlines the implementation plan for the package detail view and category filtering features requested for the EventFlow homepage.

## Feature Requirements

### 1. Package Detail View
When a user clicks on a package (from home page or category pages):
- Display full package details in a modal or dedicated page
- Show complete package description
- Include photo gallery/carousel for browsing all package images
- Display supplier information
- Show messaging capability (login-gated)

### 2. Login-Gated Messaging
- **For authenticated users**: Show "Send Message" button that opens messaging interface
- **For unauthenticated users**: Show call-to-action: "Create an account or log in to send a message"

### 3. Category Pages
Clicking on category images (Venues, Catering, Entertainment, Photography) should:
- Navigate to a dedicated category page (e.g., `/category/venues`)
- Display all packages from that category
- Include search/filter functionality
- Show package cards with preview info

## File Structure

### New Files to Create

```
public/
├── package-detail.html          # Package detail page (alternative to modal)
├── category.html                # Category listing page
└── assets/
    ├── js/
    │   ├── package-detail.js    # Package detail logic
    │   └── category-filter.js   # Category filtering and search
    └── css/
        ├── package-detail.css   # Package detail styles
        └── category.css         # Category page styles
```

### Files to Modify

```
public/
├── index.html                   # Add click handlers to category images
└── assets/
    └── js/
        └── app.js              # Add package click handlers
```

## Implementation Steps

### Phase 1: Package Detail View

#### Step 1.1: Create Package Detail Modal Component
**File:** `public/assets/js/components/PackageDetailModal.js`

```javascript
class PackageDetailModal {
  constructor() {
    this.modal = null;
    this.currentPackage = null;
    this.currentImageIndex = 0;
  }

  async show(packageId) {
    // Fetch package details from API
    const response = await fetch(`/api/packages/${packageId}`);
    const packageData = await response.json();
    this.currentPackage = packageData;
    
    // Render modal
    this.render();
  }

  render() {
    // Use existing Modal.js component
    const modal = new Modal({
      title: this.currentPackage.title,
      content: this.generateContent(),
      size: 'large',
      onClose: () => this.cleanup()
    });
    modal.show();
  }

  generateContent() {
    const isLoggedIn = !!localStorage.getItem('user');
    
    return `
      <div class="package-detail">
        <div class="package-gallery">
          ${this.renderGallery()}
        </div>
        <div class="package-info">
          <div class="package-category">${this.currentPackage.category}</div>
          <h2>${this.currentPackage.title}</h2>
          <div class="package-supplier">
            by ${this.currentPackage.supplierName}
          </div>
          <div class="package-price">
            £${this.currentPackage.price}
          </div>
          <div class="package-description">
            ${this.currentPackage.description}
          </div>
          <div class="package-actions">
            ${this.renderActions(isLoggedIn)}
          </div>
        </div>
      </div>
    `;
  }

  renderGallery() {
    if (!this.currentPackage.images || this.currentPackage.images.length === 0) {
      return '<div class="no-images">No images available</div>';
    }

    return `
      <div class="gallery-container">
        <div class="gallery-main">
          <img src="${this.currentPackage.images[this.currentImageIndex]}" 
               alt="${this.currentPackage.title}">
          ${this.currentPackage.images.length > 1 ? `
            <button class="gallery-prev" onclick="packageModal.prevImage()">❮</button>
            <button class="gallery-next" onclick="packageModal.nextImage()">❯</button>
          ` : ''}
        </div>
        <div class="gallery-thumbnails">
          ${this.currentPackage.images.map((img, idx) => `
            <img src="${img}" 
                 alt="Thumbnail ${idx + 1}"
                 class="${idx === this.currentImageIndex ? 'active' : ''}"
                 onclick="packageModal.goToImage(${idx})">
          `).join('')}
        </div>
      </div>
    `;
  }

  renderActions(isLoggedIn) {
    if (isLoggedIn) {
      return `
        <button class="btn btn-primary" onclick="packageModal.openMessaging()">
          Send Message
        </button>
        <button class="btn btn-secondary" onclick="packageModal.addToPlan()">
          Add to Plan
        </button>
      `;
    } else {
      return `
        <div class="login-prompt">
          <p>To send a message or add to your plan:</p>
          <button class="btn btn-primary" onclick="location.href='/auth.html'">
            Create Account or Log In
          </button>
        </div>
      `;
    }
  }

  nextImage() {
    if (this.currentImageIndex < this.currentPackage.images.length - 1) {
      this.currentImageIndex++;
      this.updateGallery();
    }
  }

  prevImage() {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
      this.updateGallery();
    }
  }

  goToImage(index) {
    this.currentImageIndex = index;
    this.updateGallery();
  }

  updateGallery() {
    const mainImg = document.querySelector('.gallery-main img');
    if (mainImg) {
      mainImg.src = this.currentPackage.images[this.currentImageIndex];
    }
    
    // Update active thumbnail
    document.querySelectorAll('.gallery-thumbnails img').forEach((thumb, idx) => {
      thumb.classList.toggle('active', idx === this.currentImageIndex);
    });
  }

  openMessaging() {
    // Open messaging interface
    // Could integrate with existing messaging system
    window.location.href = `/messages?supplier=${this.currentPackage.supplierId}`;
  }

  addToPlan() {
    // Add package to user's plan
    // Use existing plan functionality
  }

  cleanup() {
    this.currentPackage = null;
    this.currentImageIndex = 0;
  }
}

// Global instance
window.packageModal = new PackageDetailModal();
```

#### Step 1.2: Update Homepage Package Cards
**File:** `public/index.html` (or relevant JS file)

Add click handlers to package cards:

```javascript
document.addEventListener('DOMContentLoaded', () => {
  // Make package cards clickable
  document.getElementById('featured-packages').addEventListener('click', (e) => {
    const card = e.target.closest('.card[data-package-id]');
    if (card) {
      const packageId = card.dataset.packageId;
      window.packageModal.show(packageId);
    }
  });
});
```

### Phase 2: Category Filtering

#### Step 2.1: Create Category Page
**File:** `public/category.html`

```html
<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Category - EventFlow</title>
  <link rel="stylesheet" href="/assets/css/styles.css">
  <link rel="stylesheet" href="/assets/css/category.css">
</head>
<body>
  <!-- Include standard header -->
  
  <main class="category-page">
    <div class="container">
      <div class="category-header">
        <h1 id="category-title">Loading...</h1>
        <p id="category-description"></p>
      </div>

      <div class="category-filters">
        <div class="search-box">
          <input type="search" 
                 id="category-search" 
                 placeholder="Search packages...">
        </div>
        <div class="filter-options">
          <select id="sort-by">
            <option value="popular">Most Popular</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>
      </div>

      <div id="category-packages" class="cards">
        <div class="card"><p>Loading packages...</p></div>
      </div>

      <div id="load-more" class="text-center" style="display:none">
        <button class="btn">Load More</button>
      </div>
    </div>
  </main>

  <script src="/assets/js/category-filter.js"></script>
</body>
</html>
```

#### Step 2.2: Create Category Filter Logic
**File:** `public/assets/js/category-filter.js`

```javascript
class CategoryFilter {
  constructor() {
    this.category = this.getCategoryFromURL();
    this.packages = [];
    this.filteredPackages = [];
    this.page = 1;
    this.perPage = 12;
    
    this.init();
  }

  getCategoryFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('category') || 'all';
  }

  async init() {
    await this.loadPackages();
    this.setupEventListeners();
    this.updateUI();
  }

  async loadPackages() {
    try {
      const response = await fetch(`/api/packages?category=${this.category}`);
      const data = await response.json();
      this.packages = data.packages || [];
      this.filteredPackages = [...this.packages];
    } catch (error) {
      console.error('Failed to load packages:', error);
      this.showError('Failed to load packages. Please try again.');
    }
  }

  setupEventListeners() {
    // Search
    document.getElementById('category-search').addEventListener('input', (e) => {
      this.filterBySearch(e.target.value);
    });

    // Sort
    document.getElementById('sort-by').addEventListener('change', (e) => {
      this.sortPackages(e.target.value);
    });

    // Package clicks
    document.getElementById('category-packages').addEventListener('click', (e) => {
      const card = e.target.closest('.card[data-package-id]');
      if (card) {
        window.packageModal.show(card.dataset.packageId);
      }
    });
  }

  filterBySearch(query) {
    const searchTerm = query.toLowerCase();
    this.filteredPackages = this.packages.filter(pkg => 
      pkg.title.toLowerCase().includes(searchTerm) ||
      pkg.description.toLowerCase().includes(searchTerm) ||
      pkg.supplierName.toLowerCase().includes(searchTerm)
    );
    this.page = 1;
    this.renderPackages();
  }

  sortPackages(sortBy) {
    switch(sortBy) {
      case 'price-low':
        this.filteredPackages.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        this.filteredPackages.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        this.filteredPackages.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'popular':
      default:
        this.filteredPackages.sort((a, b) => (b.views || 0) - (a.views || 0));
    }
    this.renderPackages();
  }

  updateUI() {
    // Update title and description based on category
    const titles = {
      venues: 'Venues',
      catering: 'Catering',
      entertainment: 'Entertainment',
      photography: 'Photography & Videography'
    };
    
    document.getElementById('category-title').textContent = 
      titles[this.category] || 'All Packages';
    
    this.renderPackages();
  }

  renderPackages() {
    const container = document.getElementById('category-packages');
    
    if (this.filteredPackages.length === 0) {
      container.innerHTML = '<p class="no-results">No packages found</p>';
      return;
    }

    const packagesToShow = this.filteredPackages.slice(0, this.page * this.perPage);
    
    container.innerHTML = packagesToShow.map(pkg => `
      <div class="card card-hover" data-package-id="${pkg.id}">
        <div class="card-image">
          <img src="${pkg.thumbnail}" alt="${pkg.title}">
        </div>
        <div class="card-content">
          <div class="card-category">${pkg.category}</div>
          <h3>${pkg.title}</h3>
          <p class="card-supplier">by ${pkg.supplierName}</p>
          <div class="card-footer">
            <span class="card-price">£${pkg.price}</span>
            <span class="card-rating">★ ${pkg.rating || 'N/A'}</span>
          </div>
        </div>
      </div>
    `).join('');

    // Show/hide load more button
    const loadMoreBtn = document.getElementById('load-more');
    if (packagesToShow.length < this.filteredPackages.length) {
      loadMoreBtn.style.display = 'block';
      loadMoreBtn.querySelector('button').onclick = () => {
        this.page++;
        this.renderPackages();
      };
    } else {
      loadMoreBtn.style.display = 'none';
    }
  }

  showError(message) {
    const container = document.getElementById('category-packages');
    container.innerHTML = `<p class="error">${message}</p>`;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new CategoryFilter();
});
```

#### Step 2.3: Update Homepage Category Images
**File:** `public/index.html`

Add click handlers to category images:

```javascript
// Make category images clickable
document.querySelectorAll('.collage .frame').forEach(frame => {
  const tag = frame.querySelector('.tag').textContent.toLowerCase();
  frame.style.cursor = 'pointer';
  frame.addEventListener('click', () => {
    window.location.href = `/category.html?category=${tag}`;
  });
});
```

### Phase 3: API Endpoints (Backend)

#### Required API Endpoints

**File:** `routes/packages.js` (or add to existing routes)

```javascript
// GET /api/packages - List packages with optional filtering
router.get('/api/packages', async (req, res) => {
  const { category, search, sort, page = 1, limit = 12 } = req.query;
  
  try {
    let query = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const packages = await Package.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(getSortOption(sort));
    
    const count = await Package.countDocuments(query);
    
    res.json({
      packages,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// GET /api/packages/:id - Get package details
router.get('/api/packages/:id', async (req, res) => {
  try {
    const package = await Package.findById(req.params.id)
      .populate('supplier', 'name email profileImage');
    
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    // Increment view count
    package.views = (package.views || 0) + 1;
    await package.save();
    
    res.json(package);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch package details' });
  }
});

function getSortOption(sort) {
  switch(sort) {
    case 'price-low': return { price: 1 };
    case 'price-high': return { price: -1 };
    case 'rating': return { rating: -1 };
    case 'popular':
    default: return { views: -1 };
  }
}
```

### Phase 4: Styling

#### Package Detail Styles
**File:** `public/assets/css/package-detail.css`

```css
.package-detail {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  max-width: 1200px;
}

.package-gallery {
  position: sticky;
  top: 20px;
}

.gallery-container {
  border-radius: 8px;
  overflow: hidden;
}

.gallery-main {
  position: relative;
  aspect-ratio: 4/3;
  background: #f0f0f0;
}

.gallery-main img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-prev,
.gallery-next {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0,0,0,0.5);
  color: white;
  border: none;
  padding: 1rem;
  cursor: pointer;
  font-size: 1.5rem;
}

.gallery-prev { left: 10px; }
.gallery-next { right: 10px; }

.gallery-thumbnails {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
}

.gallery-thumbnails img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 4px;
}

.gallery-thumbnails img.active {
  border-color: var(--accent);
}

.package-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.package-category {
  text-transform: uppercase;
  font-size: 0.875rem;
  color: var(--accent);
  font-weight: 600;
}

.package-supplier {
  color: #666;
}

.package-price {
  font-size: 2rem;
  font-weight: bold;
  color: var(--ink);
}

.package-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.login-prompt {
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  text-align: center;
}

@media (max-width: 768px) {
  .package-detail {
    grid-template-columns: 1fr;
  }
  
  .package-gallery {
    position: static;
  }
}
```

#### Category Page Styles
**File:** `public/assets/css/category.css`

```css
.category-page {
  padding: 2rem 0;
}

.category-header {
  text-align: center;
  margin-bottom: 3rem;
}

.category-filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
}

.search-box {
  flex: 1;
  max-width: 400px;
}

.search-box input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.filter-options select {
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.card-category {
  text-transform: uppercase;
  font-size: 0.75rem;
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.card-supplier {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 1rem;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.card-price {
  font-weight: bold;
  color: var(--ink);
}

.card-rating {
  color: #ffa500;
}

@media (max-width: 768px) {
  .category-filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-box {
    max-width: none;
  }
}
```

## Testing Checklist

- [ ] Package detail modal opens when clicking on a package
- [ ] Photo gallery navigation works (prev/next/thumbnails)
- [ ] Messaging button shows for logged-in users
- [ ] Login prompt shows for anonymous users
- [ ] Category pages load correct packages
- [ ] Search functionality works
- [ ] Sort options work correctly
- [ ] Load more pagination works
- [ ] Mobile responsive design
- [ ] Keyboard navigation support
- [ ] Screen reader compatibility

## Database Schema

### Package Model
```javascript
const packageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['venues', 'catering', 'entertainment', 'photography'],
    required: true 
  },
  price: { type: Number, required: true },
  images: [{ type: String }], // Array of image URLs
  thumbnail: { type: String }, // Main thumbnail
  supplier: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Supplier',
    required: true 
  },
  views: { type: Number, default: 0 },
  rating: { type: Number, min: 0, max: 5 },
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
```

## Future Enhancements

1. **Advanced Filtering**: Location, price range, availability dates
2. **Package Comparison**: Compare multiple packages side-by-side
3. **Reviews & Ratings**: Customer reviews on package detail page
4. **Similar Packages**: Recommendations based on current package
5. **Share Functionality**: Share package via social media or email
6. **Favorites**: Save packages to favorites list
7. **Virtual Tours**: 360° views or video tours
8. **Instant Booking**: Book packages directly online

## Notes

- All API endpoints should include proper authentication checks
- Image uploads should be handled through existing photo-upload.js
- Messaging integration should use existing messaging infrastructure
- Consider implementing lazy loading for images
- Add loading skeletons using the LoadingSkeleton component
- Use Toast component for success/error notifications
- Implement analytics tracking for package views
