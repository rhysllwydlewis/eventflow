/**
 * PackageGallery Component
 * Image gallery carousel for package detail pages
 */

class PackageGallery {
  constructor(containerId, images = []) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`PackageGallery: Container ${containerId} not found`);
      return;
    }
    this.images = images;
    this.currentIndex = 0;
    this.injectStyles();
    this.render();
  }

  injectStyles() {
    if (document.getElementById('package-gallery-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'package-gallery-styles';
    style.textContent = `
      .package-gallery {
        position: relative;
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
      }

      .package-gallery-main {
        position: relative;
        width: 100%;
        height: 500px;
        border-radius: 12px;
        overflow: hidden;
        background-color: #000;
      }

      .package-gallery-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: none;
        animation: fadeIn 0.3s ease-in;
      }

      .package-gallery-image.active {
        display: block;
      }

      .package-gallery-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        padding: 16px;
        cursor: pointer;
        font-size: 20px;
        border-radius: 50%;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s ease;
        z-index: 2;
      }

      .package-gallery-nav:hover {
        background-color: rgba(0, 0, 0, 0.7);
      }

      .package-gallery-nav.prev {
        left: 16px;
      }

      .package-gallery-nav.next {
        right: 16px;
      }

      .package-gallery-counter {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.9rem;
        z-index: 2;
      }

      .package-gallery-thumbnails {
        display: flex;
        gap: 12px;
        margin-top: 16px;
        overflow-x: auto;
        padding: 8px 0;
      }

      .package-gallery-thumbnail {
        width: 100px;
        height: 80px;
        object-fit: cover;
        border-radius: 8px;
        cursor: pointer;
        border: 2px solid transparent;
        transition: border-color 0.2s ease, opacity 0.2s ease;
        flex-shrink: 0;
      }

      .package-gallery-thumbnail:hover {
        opacity: 0.8;
      }

      .package-gallery-thumbnail.active {
        border-color: var(--accent, #13B6A2);
      }

      .package-gallery-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 500px;
        background-color: var(--color-bg-secondary, #f8f9fa);
        border-radius: 12px;
        color: var(--color-text-secondary, #6c757d);
        font-size: 1.1rem;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @media (max-width: 768px) {
        .package-gallery-main {
          height: 300px;
        }

        .package-gallery-nav {
          width: 40px;
          height: 40px;
          padding: 12px;
          font-size: 16px;
        }

        .package-gallery-thumbnail {
          width: 80px;
          height: 60px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  render() {
    if (!this.images || this.images.length === 0) {
      this.container.innerHTML = `
        <div class="package-gallery-empty">
          No images available
        </div>
      `;
      return;
    }

    const gallery = document.createElement('div');
    gallery.className = 'package-gallery';

    // Main image container
    const mainContainer = document.createElement('div');
    mainContainer.className = 'package-gallery-main';

    // Add all images
    this.images.forEach((img, index) => {
      const image = document.createElement('img');
      image.className = 'package-gallery-image';
      if (index === 0) {
        image.classList.add('active');
      }
      image.src = img.url || img;
      image.alt = `Gallery image ${index + 1}`;
      mainContainer.appendChild(image);
    });

    // Add navigation buttons if multiple images
    if (this.images.length > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'package-gallery-nav prev';
      prevBtn.innerHTML = '‹';
      prevBtn.onclick = () => this.navigate(-1);

      const nextBtn = document.createElement('button');
      nextBtn.className = 'package-gallery-nav next';
      nextBtn.innerHTML = '›';
      nextBtn.onclick = () => this.navigate(1);

      const counter = document.createElement('div');
      counter.className = 'package-gallery-counter';
      counter.id = 'gallery-counter';
      counter.textContent = `1 / ${this.images.length}`;

      mainContainer.appendChild(prevBtn);
      mainContainer.appendChild(nextBtn);
      mainContainer.appendChild(counter);
    }

    gallery.appendChild(mainContainer);

    // Add thumbnails if multiple images
    if (this.images.length > 1) {
      const thumbnails = document.createElement('div');
      thumbnails.className = 'package-gallery-thumbnails';

      this.images.forEach((img, index) => {
        const thumb = document.createElement('img');
        thumb.className = 'package-gallery-thumbnail';
        if (index === 0) {
          thumb.classList.add('active');
        }
        thumb.src = img.url || img;
        thumb.alt = `Thumbnail ${index + 1}`;
        thumb.onclick = () => this.goToImage(index);
        thumbnails.appendChild(thumb);
      });

      gallery.appendChild(thumbnails);
    }

    this.container.innerHTML = '';
    this.container.appendChild(gallery);

    // Store references for navigation
    this.galleryElement = gallery;
  }

  navigate(direction) {
    const images = this.container.querySelectorAll('.package-gallery-image');
    const thumbnails = this.container.querySelectorAll('.package-gallery-thumbnail');

    images[this.currentIndex].classList.remove('active');
    if (thumbnails.length > 0) {
      thumbnails[this.currentIndex].classList.remove('active');
    }

    this.currentIndex = (this.currentIndex + direction + this.images.length) % this.images.length;

    images[this.currentIndex].classList.add('active');
    if (thumbnails.length > 0) {
      thumbnails[this.currentIndex].classList.add('active');
    }

    const counter = document.getElementById('gallery-counter');
    if (counter) {
      counter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
    }
  }

  goToImage(index) {
    const images = this.container.querySelectorAll('.package-gallery-image');
    const thumbnails = this.container.querySelectorAll('.package-gallery-thumbnail');

    images[this.currentIndex].classList.remove('active');
    thumbnails[this.currentIndex].classList.remove('active');

    this.currentIndex = index;

    images[this.currentIndex].classList.add('active');
    thumbnails[this.currentIndex].classList.add('active');

    const counter = document.getElementById('gallery-counter');
    if (counter) {
      counter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
    }
  }
}

// Export to window
if (typeof window !== 'undefined') {
  window.PackageGallery = PackageGallery;
}
