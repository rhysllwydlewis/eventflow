/**
 * Category page initialization script
 * Loads category details and packages for a given category slug
 */

// Set page identifier
window.__EF_PAGE__ = 'category';

document.addEventListener('DOMContentLoaded', () => {
  // Get category slug from URL
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');

  if (!slug) {
    document.getElementById('category-title').textContent = 'Category not found';
    document.getElementById('package-list-container').innerHTML =
      '<div class="package-empty-state"><p>Invalid category. <a href="/">Return home</a></p></div>';
    return;
  }

  // Load category and packages
  fetch(`/api/categories/${slug}`)
    .then(res => {
      if (!res.ok) {
        throw new Error('Category not found');
      }
      return res.json();
    })
    .then(data => {
      const { category, packages } = data;

      // Update page title and metadata
      document.title = `${category.name} — EventFlow`;
      document.getElementById('category-title').textContent = category.name;
      document.getElementById('category-description').textContent = category.description || '';
      document.getElementById('breadcrumb-category').textContent = category.name;

      // Helper function to escape HTML
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
      }

      // Helper function to sanitize URLs - only allow http/https
      function sanitizeUrl(url) {
        if (!url) {
          return '';
        }
        const urlStr = String(url).trim();
        // Only allow http and https URLs, reject everything else
        if (!/^https?:\/\//i.test(urlStr)) {
          // If it doesn't start with http/https, check if it's a relative URL
          if (!urlStr.startsWith('/')) {
            return '';
          }
          // Allow relative URLs (start with /)
          return escapeHtml(urlStr);
        }
        return escapeHtml(urlStr);
      }

      // Show hero image if available
      if (category.heroImage) {
        const heroSection = document.getElementById('category-hero-section');
        const heroImage = sanitizeUrl(category.heroImage);
        const categoryName = escapeHtml(category.name);
        const categoryIcon = escapeHtml(category.icon || '');

        heroSection.innerHTML = `
          <div style="position: relative; border-radius: 12px; overflow: hidden; height: 300px;">
            <img src="${heroImage}" alt="${categoryName}" 
                 style="width: 100%; height: 100%; object-fit: cover;">
            <div style="position: absolute; bottom: 0; left: 0; right: 0; 
                        background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); 
                        padding: 32px; color: white;">
              <h1 style="margin: 0; font-size: 2.5rem;">${categoryIcon} ${categoryName}</h1>
            </div>
          </div>
        `;
      }

      // Display packages
      if (typeof PackageList !== 'undefined') {
        const packageList = new PackageList('package-list-container', {
          sortFeaturedFirst: true,
        });
        packageList.setPackages(packages || []);
      } else {
        document.getElementById('package-list-container').innerHTML =
          '<p>Unable to load packages. Please refresh the page.</p>';
      }
    })
    .catch(error => {
      console.error('Error loading category:', error);
      document.getElementById('category-title').textContent = 'Category not found';
      document.getElementById('package-list-container').innerHTML =
        '<div class="package-empty-state"><p>This category could not be found. <a href="/">Return home</a></p></div>';
    });
});
