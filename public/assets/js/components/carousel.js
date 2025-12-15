/**
 * Carousel Component
 * Lightweight horizontal carousel for featured packages
 * No dependencies - pure vanilla JavaScript
 */

class Carousel {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`Carousel: Container ${containerId} not found`);
      return;
    }
    this.options = {
      itemsPerView: 3,
      itemsPerViewTablet: 2,
      itemsPerViewMobile: 1,
      autoScroll: true,
      autoScrollInterval: 5000,
      pauseOnHover: true,
      ...options,
    };
    this.items = [];
    this.currentIndex = 0;
    this.autoScrollTimer = null;
    this.touchStartX = null;
    this.touchDeltaX = 0;
    this.injectStyles();
  }

  injectStyles() {
    if (document.getElementById('carousel-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'carousel-styles';
    style.textContent = `
      .carousel-wrapper {
        position: relative;
        margin-top: 24px;
      }

      .carousel-container {
        overflow: hidden;
        border-radius: 12px;
      }

      .carousel-track {
        display: flex;
        gap: 20px;
        transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .carousel-item {
        flex: 0 0 calc((100% - 40px) / 3);
        background: var(--bg, #fff);
        border: 1px solid var(--border, #E7EAF0);
        border-radius: 12px;
        overflow: hidden;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        min-width: 0;
      }

      .carousel-item:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 40px rgba(15, 23, 42, 0.15);
      }

      .carousel-item-image {
        width: 100%;
        height: 180px;
        object-fit: cover;
        display: block;
      }

      .carousel-item-placeholder {
        width: 100%;
        height: 180px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%);
        color: var(--muted, #667085);
        font-size: 0.875rem;
        border-bottom: 1px solid var(--border, #E7EAF0);
      }

      .carousel-item-placeholder::before {
        content: '📦';
        font-size: 3rem;
        opacity: 0.3;
        display: block;
      }

      .carousel-item-content {
        padding: 14px;
      }

      .carousel-item-title {
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: var(--text, #0B1220);
      }

      .carousel-item-price {
        font-size: 1rem;
        font-weight: 600;
        color: var(--ink, #0B8073);
        margin: 8px 0;
      }

      .carousel-item-inclusions {
        font-size: 0.85rem;
        color: var(--muted, #667085);
        margin: 8px 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .carousel-item-cta {
        display: inline-block;
        margin-top: 12px;
        padding: 8px 16px;
        background: var(--ink, #0B8073);
        color: white;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        text-decoration: none;
        transition: background 0.2s ease;
      }

      .carousel-item-cta:hover {
        background: var(--accent, #13B6A2);
        text-decoration: none;
      }

      .carousel-controls {
        position: absolute;
        top: 40%;
        left: 0;
        right: 0;
        transform: translateY(-50%);
        display: flex;
        justify-content: space-between;
        pointer-events: none;
        padding: 0 -10px;
      }

      .carousel-control {
        pointer-events: auto;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid var(--border, #E7EAF0);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 20px;
        color: var(--text, #0B1220);
      }

      .carousel-control:hover {
        background: white;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        transform: scale(1.05);
      }

      .carousel-control:active {
        transform: scale(0.95);
      }

      .carousel-control-prev {
        margin-left: 10px;
      }

      .carousel-control-next {
        margin-right: 10px;
      }

      .carousel-dots {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-top: 16px;
      }

      .carousel-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--border, #E7EAF0);
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .carousel-dot.active {
        background: var(--ink, #0B8073);
        width: 24px;
        border-radius: 4px;
      }

      @media (max-width: 1024px) {
        .carousel-item {
          flex: 0 0 calc((100% - 20px) / 2);
        }
      }

      @media (max-width: 640px) {
        .carousel-item {
          flex: 0 0 100%;
        }

        .carousel-track {
          gap: 0;
        }

        .carousel-control {
          width: 36px;
          height: 36px;
          font-size: 18px;
        }
      }

      @media (max-width: 480px) {
        .carousel-wrapper {
          margin-left: -4px;
          margin-right: -4px;
        }

        .carousel-container {
          overflow: hidden;
          width: 100%;
        }

        .carousel-item {
          min-width: 0;
          max-width: 100%;
          width: 100%;
        }

        .carousel-item-content {
          padding: 12px;
          min-width: 0;
          box-sizing: border-box;
        }

        .carousel-item-title {
          font-size: 1rem;
          overflow-wrap: break-word;
          word-break: break-word;
          hyphens: auto;
          max-width: 100%;
        }

        .carousel-item-price {
          font-size: 0.9rem;
          overflow-wrap: break-word;
          word-break: break-word;
        }

        .carousel-item-inclusions {
          font-size: 0.8rem;
          overflow-wrap: break-word;
          word-break: break-word;
        }

        .carousel-item-cta {
          font-size: 0.85rem;
          padding: 7px 14px;
          white-space: normal;
          text-align: center;
          max-width: 100%;
        }

        .carousel-control {
          width: 32px;
          height: 32px;
          font-size: 16px;
        }

        .carousel-control-prev {
          margin-left: 4px;
        }

        .carousel-control-next {
          margin-right: 4px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  setItems(items) {
    this.items = items;
    this.render();
  }

  render() {
    if (this.items.length === 0) {
      this.container.innerHTML = '<p class="small">No items available.</p>';
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'carousel-wrapper';

    const container = document.createElement('div');
    container.className = 'carousel-container';

    const track = document.createElement('div');
    track.className = 'carousel-track';

    this.items.forEach(item => {
      const element = this.createItem(item);
      track.appendChild(element);
    });

    container.appendChild(track);
    wrapper.appendChild(container);

    // Add controls
    const controls = this.createControls();
    wrapper.appendChild(controls);

    // Add dots
    if (this.items.length > this.getItemsPerView()) {
      const dots = this.createDots();
      wrapper.appendChild(dots);
    }

    this.container.innerHTML = '';
    this.container.appendChild(wrapper);

    this.track = track;
    this.updatePosition();

    this.setupTouch(wrapper);

    // Setup auto-scroll
    if (this.options.autoScroll) {
      this.startAutoScroll();

      if (this.options.pauseOnHover) {
        wrapper.addEventListener('mouseenter', () => this.stopAutoScroll());
        wrapper.addEventListener('mouseleave', () => this.startAutoScroll());
      }
    }

    // Handle window resize
    window.addEventListener('resize', () => this.updatePosition());
  }

  createItem(item) {
    const element = document.createElement('div');
    element.className = 'carousel-item';

    const imageUrl = item.image;
    const price = item.price || 'Contact for price';
    const inclusions = item.description || item.inclusions || '';

    element.innerHTML = `
      <div class="carousel-item-content">
        <h3 class="carousel-item-title">${item.title}</h3>
        <div class="carousel-item-price">${price}</div>
        ${inclusions ? `<div class="carousel-item-inclusions">${inclusions}</div>` : ''}
        <a href="/package.html?slug=${item.slug}" class="carousel-item-cta">View Details</a>
      </div>
    `;

    // Handle image loading with proper error handling
    if (imageUrl) {
      const img = document.createElement('img');
      img.className = 'carousel-item-image';
      img.src = imageUrl;
      img.alt = item.title;
      img.loading = 'lazy';

      img.addEventListener('error', () => {
        // Replace failed image with placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'carousel-item-placeholder';
        img.replaceWith(placeholder);
      });

      element.insertBefore(img, element.firstChild);
    } else {
      // No image provided, use placeholder
      const placeholder = document.createElement('div');
      placeholder.className = 'carousel-item-placeholder';
      element.insertBefore(placeholder, element.firstChild);
    }

    return element;
  }

  createControls() {
    const controls = document.createElement('div');
    controls.className = 'carousel-controls';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'carousel-control carousel-control-prev';
    prevBtn.innerHTML = '‹';
    prevBtn.setAttribute('aria-label', 'Previous');
    prevBtn.addEventListener('click', () => this.prev());

    const nextBtn = document.createElement('button');
    nextBtn.className = 'carousel-control carousel-control-next';
    nextBtn.innerHTML = '›';
    nextBtn.setAttribute('aria-label', 'Next');
    nextBtn.addEventListener('click', () => this.next());

    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);

    return controls;
  }

  createDots() {
    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'carousel-dots';

    const totalPages = Math.ceil(this.items.length / this.getItemsPerView());

    for (let i = 0; i < totalPages; i++) {
      const dot = document.createElement('button');
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', `Go to page ${i + 1}`);
      if (i === 0) {
        dot.classList.add('active');
      }
      dot.addEventListener('click', () => this.goToPage(i));
      dotsContainer.appendChild(dot);
    }

    this.dotsContainer = dotsContainer;
    return dotsContainer;
  }

  getItemsPerView() {
    const width = window.innerWidth;
    if (width < 640) {
      return this.options.itemsPerViewMobile;
    }
    if (width < 1024) {
      return this.options.itemsPerViewTablet;
    }
    return this.options.itemsPerView;
  }

  updatePosition() {
    if (!this.track) {
      return;
    }

    const itemsPerView = this.getItemsPerView();
    const maxIndex = Math.max(0, this.items.length - itemsPerView);
    this.currentIndex = Math.min(this.currentIndex, maxIndex);

    const itemWidth = this.track.children[0]?.offsetWidth || 0;
    const gap = 20;
    const offset = -(this.currentIndex * (itemWidth + gap));

    this.track.style.transform = `translateX(${offset}px)`;

    // Update dots
    if (this.dotsContainer) {
      const currentPage = Math.floor(this.currentIndex / itemsPerView);
      const dots = this.dotsContainer.querySelectorAll('.carousel-dot');
      dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentPage);
      });
    }
  }

  setupTouch(wrapper) {
    const onStart = event => {
      this.touchStartX = event.touches ? event.touches[0].clientX : event.clientX;
      this.touchDeltaX = 0;
      if (this.options.autoScroll) {
        this.stopAutoScroll();
      }
    };

    const onMove = event => {
      if (this.touchStartX === null) {
        return;
      }
      const currentX = event.touches ? event.touches[0].clientX : event.clientX;
      this.touchDeltaX = currentX - this.touchStartX;
    };

    const onEnd = () => {
      if (this.touchStartX === null) {
        return;
      }
      if (Math.abs(this.touchDeltaX) > 40) {
        if (this.touchDeltaX < 0) {
          this.next();
        } else {
          this.prev();
        }
      }
      this.touchStartX = null;
      this.touchDeltaX = 0;
      if (this.options.autoScroll) {
        this.startAutoScroll();
      }
    };

    wrapper.addEventListener('touchstart', onStart, { passive: true });
    wrapper.addEventListener('touchmove', onMove, { passive: true });
    wrapper.addEventListener('touchend', onEnd, { passive: true });
    wrapper.addEventListener('mousedown', onStart);
    wrapper.addEventListener('mousemove', onMove);
    wrapper.addEventListener('mouseup', onEnd);
    wrapper.addEventListener('mouseleave', onEnd);
  }

  next() {
    const itemsPerView = this.getItemsPerView();
    const maxIndex = Math.max(0, this.items.length - itemsPerView);
    this.currentIndex = Math.min(this.currentIndex + 1, maxIndex);
    this.updatePosition();
  }

  prev() {
    this.currentIndex = Math.max(0, this.currentIndex - 1);
    this.updatePosition();
  }

  goToPage(pageIndex) {
    const itemsPerView = this.getItemsPerView();
    this.currentIndex = pageIndex * itemsPerView;
    this.updatePosition();
  }

  startAutoScroll() {
    this.stopAutoScroll();
    this.autoScrollTimer = setInterval(() => {
      const itemsPerView = this.getItemsPerView();
      const maxIndex = Math.max(0, this.items.length - itemsPerView);
      if (this.currentIndex >= maxIndex) {
        this.currentIndex = 0;
      } else {
        this.currentIndex++;
      }
      this.updatePosition();
    }, this.options.autoScrollInterval);
  }

  stopAutoScroll() {
    if (this.autoScrollTimer) {
      clearInterval(this.autoScrollTimer);
      this.autoScrollTimer = null;
    }
  }
}

// Export to window
if (typeof window !== 'undefined') {
  window.Carousel = Carousel;
}
