/**
 * Carousel component
 * - Mobile: prevent horizontal page overflow (overflow hidden) and enable touch/trackpad scrolling
 *   via scroll-snap.
 * - Controls: next/prev uses container.scrollTo.
 * - State: sync currentIndex on scroll.
 * - A11y: keyboard arrow navigation when focused.
 * - UX: improved drag handling to prevent accidental text selection.
 */

(function () {
  const carousels = document.querySelectorAll('.carousel');
  if (!carousels.length) return;

  // Inject required CSS once (keeps change self-contained).
  if (!document.getElementById('carousel-component-styles')) {
    const style = document.createElement('style');
    style.id = 'carousel-component-styles';
    style.textContent = `
      /* Prevent horizontal page overflow on small screens */
      @media (max-width: 480px) {
        .carousel-container {
          overflow: hidden; /* was visible; hide overflow to prevent body overflow */
        }
      }

      /* Make carousel container horizontally scrollable with snap */
      .carousel-container {
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        scrollbar-width: none; /* Firefox */
      }
      .carousel-container::-webkit-scrollbar { display: none; }

      /* Ensure items snap nicely */
      .carousel-item {
        scroll-snap-align: start;
      }

      /* Improve drag UX */
      .carousel-container.is-dragging {
        cursor: grabbing;
        user-select: none;
      }
      .carousel-container.is-dragging * {
        user-select: none;
        -webkit-user-drag: none;
      }
    `;
    document.head.appendChild(style);
  }

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  carousels.forEach((carousel) => {
    const container = carousel.querySelector('.carousel-container');
    if (!container) return;

    const items = Array.from(container.querySelectorAll('.carousel-item'));
    if (!items.length) return;

    const prevButton = carousel.querySelector('[data-carousel-prev], .carousel-prev, .prev');
    const nextButton = carousel.querySelector('[data-carousel-next], .carousel-next, .next');

    // Make container focusable for keyboard navigation if not already.
    if (!container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '0');
    }

    // Track index based on scroll position.
    let currentIndex = 0;

    const getItemWidth = () => {
      // Use first item's width (including margin via offsetLeft delta when possible)
      if (items.length > 1) {
        const w = items[1].offsetLeft - items[0].offsetLeft;
        return w || items[0].getBoundingClientRect().width;
      }
      return items[0].getBoundingClientRect().width;
    };

    const scrollToIndex = (index) => {
      const i = clamp(index, 0, items.length - 1);
      const left = items[i].offsetLeft;
      container.scrollTo({ left, behavior: 'smooth' });
      currentIndex = i;
      updateControls();
    };

    const updateControls = () => {
      if (prevButton) prevButton.disabled = currentIndex <= 0;
      if (nextButton) nextButton.disabled = currentIndex >= items.length - 1;
    };

    // Sync index on scroll (touch/trackpad).
    let scrollRaf = null;
    const onScroll = () => {
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(() => {
        // Find closest item to current scrollLeft.
        const scrollLeft = container.scrollLeft;
        let closestIdx = 0;
        let closestDist = Infinity;
        for (let i = 0; i < items.length; i++) {
          const dist = Math.abs(items[i].offsetLeft - scrollLeft);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        }
        if (closestIdx !== currentIndex) {
          currentIndex = closestIdx;
          updateControls();
        }
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });

    // Buttons use scrollTo
    if (prevButton) {
      prevButton.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToIndex(currentIndex - 1);
      });
    }
    if (nextButton) {
      nextButton.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToIndex(currentIndex + 1);
      });
    }

    // Keyboard navigation when focused
    container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollToIndex(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollToIndex(currentIndex + 1);
      }
    });

    // Drag handling: allow grabbing to scroll without selecting text.
    let isPointerDown = false;
    let didDrag = false;
    let startX = 0;
    let startScrollLeft = 0;

    const DRAG_THRESHOLD_PX = 6;

    const onPointerDown = (e) => {
      // Only left click / primary touch
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      isPointerDown = true;
      didDrag = false;
      startX = e.clientX;
      startScrollLeft = container.scrollLeft;

      container.classList.add('is-dragging');
      container.setPointerCapture?.(e.pointerId);

      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
    };

    const onPointerMove = (e) => {
      if (!isPointerDown) return;
      const dx = e.clientX - startX;

      if (!didDrag && Math.abs(dx) > DRAG_THRESHOLD_PX) {
        didDrag = true;
      }

      if (didDrag) {
        // Drag left => scroll right
        container.scrollLeft = startScrollLeft - dx;
      }
    };

    const onPointerUp = (e) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      container.classList.remove('is-dragging');
      container.releasePointerCapture?.(e.pointerId);
      document.body.style.userSelect = '';

      // If we dragged, prevent accidental click on links/buttons inside items.
      if (didDrag) {
        const preventClick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        container.addEventListener('click', preventClick, { capture: true, once: true });
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('pointerleave', onPointerUp);

    // Initialize state
    // Snap to first item (without animation) if we're not aligned.
    const initialLeft = items[0].offsetLeft;
    if (Math.abs(container.scrollLeft - initialLeft) > 1) {
      container.scrollTo({ left: initialLeft, behavior: 'auto' });
    }
    updateControls();

    // Re-sync on resize (item widths can change)
    let resizeRaf = null;
    window.addEventListener('resize', () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        // keep current item in view
        scrollToIndex(currentIndex);
      });
    });
  });
})();
