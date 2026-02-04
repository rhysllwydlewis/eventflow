/**
 * EventFlow Homepage JavaScript
 * Testimonials carousel functionality and other homepage-specific interactions
 */

(function() {
  'use strict';

  // ========================================
  // HERO VIDEO FALLBACK
  // Hide video container if no source is provided
  // ========================================
  
  function initHeroVideo() {
    const videoElement = document.getElementById('hero-pexels-video');
    const videoSource = document.getElementById('hero-video-source');
    const videoContainer = videoElement?.closest('.hero-video-card');
    
    if (videoElement && videoSource && videoContainer) {
      // Check if video has a valid source
      const src = videoSource.getAttribute('src');
      if (!src || src.trim() === '') {
        // No source provided, hide the video container
        videoContainer.style.display = 'none';
        console.info('Hero video hidden: No source provided');
      } else {
        // Valid source exists, ensure video is visible
        videoContainer.style.display = 'block';
      }
    }
  }

  // ========================================
  // TESTIMONIALS CAROUSEL
  // ========================================
  
  let currentTestimonial = 0;
  let carouselInterval = null;
  const testimonials = document.querySelectorAll('.ef-testimonial');
  const dots = document.querySelectorAll('.ef-testimonial-dot');
  
  function showTestimonial(index) {
    // Hide all testimonials
    testimonials.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-hidden', 'true');
    });
    
    // Update dots
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
      dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
    
    // Show selected testimonial
    testimonials[index].classList.add('active');
    testimonials[index].setAttribute('aria-hidden', 'false');
    currentTestimonial = index;
  }
  
  // Dot click handlers
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      showTestimonial(index);
      // Reset interval on manual interaction
      if (carouselInterval) {
        clearInterval(carouselInterval);
      }
      startAutoRotation();
    });
  });
  
  // Auto-rotate testimonials every 5 seconds
  function startAutoRotation() {
    carouselInterval = setInterval(() => {
      currentTestimonial = (currentTestimonial + 1) % testimonials.length;
      showTestimonial(currentTestimonial);
    }, 5000);
  }
  
  // Start auto-rotation on load
  if (testimonials.length > 0 && dots.length > 0) {
    startAutoRotation();
  }
  
  // Pause rotation when section is not visible (Intersection Observer)
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting && carouselInterval) {
          clearInterval(carouselInterval);
          carouselInterval = null;
        } else if (entry.isIntersecting && !carouselInterval) {
          startAutoRotation();
        }
      });
    }, { threshold: 0.5 });
    
    const section = document.querySelector('.ef-testimonials-section');
    if (section) {
      observer.observe(section);
    }
  }

  // ========================================
  // INITIALIZE ON DOM READY
  // ========================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroVideo);
  } else {
    initHeroVideo();
  }

})();
