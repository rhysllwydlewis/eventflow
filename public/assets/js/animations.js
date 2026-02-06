/**
 * EventFlow Animations - Animation utilities and effects
 * Provides scroll animations, intersection observers, and animation helpers
 */

// Scroll reveal animation with Intersection Observer
class ScrollReveal {
  constructor(options = {}) {
    this.options = {
      threshold: options.threshold || 0.15,
      rootMargin: options.rootMargin || '0px 0px -50px 0px',
      animationClass: options.animationClass || 'animate-slideInUp',
      once: options.once !== false,
    };

    this.observer = null;
    this.init();
  }

  init() {
    if (!('IntersectionObserver' in window)) {
      // Fallback for browsers without IntersectionObserver
      this.fallback();
      return;
    }

    this.observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add(this.options.animationClass);

            if (this.options.once) {
              this.observer.unobserve(entry.target);
            }
          } else if (!this.options.once) {
            entry.target.classList.remove(this.options.animationClass);
          }
        });
      },
      {
        threshold: this.options.threshold,
        rootMargin: this.options.rootMargin,
      }
    );

    this.observe();
  }

  observe() {
    const elements = document.querySelectorAll('[data-reveal]');
    elements.forEach(el => {
      el.style.opacity = '0';
      this.observer.observe(el);
    });
  }

  fallback() {
    const elements = document.querySelectorAll('[data-reveal]');
    elements.forEach(el => {
      el.classList.add(this.options.animationClass);
    });
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Stagger animation for child elements
function staggerAnimation(parent, options = {}) {
  const { delay = 100, animationClass = 'animate-slideInUp', selector = '*' } = options;

  const children = parent.querySelectorAll(selector);
  children.forEach((child, index) => {
    child.style.animationDelay = `${index * delay}ms`;
    child.classList.add(animationClass);
  });
}

// Typewriter effect
class Typewriter {
  constructor(element, options = {}) {
    this.element = element;
    this.text = options.text || element.textContent;
    this.speed = options.speed || 50;
    this.delay = options.delay || 0;
    this.cursor = options.cursor !== false;
    this.onComplete = options.onComplete || null;
    this.index = 0;

    element.textContent = '';
    if (this.cursor) {
      element.style.borderRight = '2px solid';
      element.style.paddingRight = '5px';
    }
  }

  start() {
    setTimeout(() => {
      this.type();
    }, this.delay);
  }

  type() {
    if (this.index < this.text.length) {
      this.element.textContent += this.text.charAt(this.index);
      this.index++;
      setTimeout(() => this.type(), this.speed);
    } else {
      if (this.cursor) {
        this.element.style.borderRight = 'none';
      }
      if (this.onComplete) {
        this.onComplete();
      }
    }
  }
}

// Counter animation
class Counter {
  constructor(element, options = {}) {
    this.element = element;
    this.target = options.target || parseInt(element.textContent) || 0;
    this.duration = options.duration || 2000;
    this.start = options.start || 0;
    this.decimals = options.decimals || 0;
    this.prefix = options.prefix || '';
    this.suffix = options.suffix || '';
    this.separator = options.separator || ',';
    this.onComplete = options.onComplete || null;
  }

  animate() {
    // Easing function for smoother animation
    function easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.duration, 1);

      // Inside the counter interval:
      const easeProgress = easeOutQuart(progress);
      const current = this.start + (this.target - this.start) * easeProgress;

      this.element.textContent = this.format(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        this.element.textContent = this.format(this.target);
        if (this.onComplete) {
          this.onComplete();
        }
      }
    };

    requestAnimationFrame(step);
  }

  format(value) {
    let formatted = value.toFixed(this.decimals);

    // Add thousand separators
    if (this.separator) {
      const parts = formatted.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, this.separator);
      formatted = parts.join('.');
    }

    return this.prefix + formatted + this.suffix;
  }
}

// Smooth scroll to element
function smoothScroll(target, options = {}) {
  const { duration = 800, offset = 0, callback = null } = options;

  const targetElement = typeof target === 'string' ? document.querySelector(target) : target;
  if (!targetElement) {
    return;
  }

  const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime = null;

  function animation(currentTime) {
    if (startTime === null) {
      startTime = currentTime;
    }
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-in-out)
    const easeProgress =
      progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    window.scrollTo(0, startPosition + distance * easeProgress);

    if (progress < 1) {
      requestAnimationFrame(animation);
    } else if (callback) {
      callback();
    }
  }

  requestAnimationFrame(animation);
}

// Parallax effect
function parallax() {
  const elements = document.querySelectorAll('[data-parallax]');

  function updateParallax() {
    const scrolled = window.pageYOffset;

    elements.forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.5;
      const yPos = -(scrolled * speed);
      el.style.transform = `translateY(${yPos}px)`;
    });
  }

  // Throttle scroll events
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateParallax();
        ticking = false;
      });
      ticking = true;
    }
  });

  updateParallax();
}

// Confetti animation
function confetti(options = {}) {
  const {
    particleCount = 100,
    spread = 70,
    origin = { x: 0.5, y: 0.5 },
    colors = ['#0B8073', '#13B6A2', '#5EEAD4', '#9be7d9'],
  } = options;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const centerX = canvas.width * origin.x;
  const centerY = canvas.height * origin.y;

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.random() * spread - spread / 2) * (Math.PI / 180);
    const velocity = 3 + Math.random() * 5;

    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - 5,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 10 - 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 4,
      gravity: 0.3,
      friction: 0.99,
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let stillAnimating = false;

    particles.forEach(p => {
      p.vy += p.gravity;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      if (p.y < canvas.height) {
        stillAnimating = true;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (stillAnimating) {
      requestAnimationFrame(animate);
    } else {
      document.body.removeChild(canvas);
    }
  }

  animate();
}

// Floating particles background
class ParticlesBackground {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      particleCount: options.particleCount || 50,
      particleColor: options.particleColor || 'rgba(11, 128, 115, 0.3)',
      particleSize: options.particleSize || 2,
      speed: options.speed || 0.5,
    };

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.animationId = null;

    this.init();
  }

  init() {
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '0';

    this.container.style.position = 'relative';
    this.container.appendChild(this.canvas);

    this.resize();
    this.createParticles();
    this.animate();

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = this.container.offsetWidth;
    this.canvas.height = this.container.offsetHeight;
  }

  createParticles() {
    for (let i = 0; i < this.options.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * this.options.speed,
        vy: (Math.random() - 0.5) * this.options.speed,
        size: Math.random() * this.options.particleSize + 1,
      });
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges
      if (p.x < 0) {
        p.x = this.canvas.width;
      }
      if (p.x > this.canvas.width) {
        p.x = 0;
      }
      if (p.y < 0) {
        p.y = this.canvas.height;
      }
      if (p.y > this.canvas.height) {
        p.y = 0;
      }

      // Draw particle
      this.ctx.fillStyle = this.options.particleColor;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

// Initialize animations on DOM load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Initialize scroll reveal
    new ScrollReveal();

    // Initialize parallax
    if (document.querySelectorAll('[data-parallax]').length > 0) {
      parallax();
    }
  });
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ScrollReveal,
    Typewriter,
    Counter,
    smoothScroll,
    parallax,
    confetti,
    ParticlesBackground,
    staggerAnimation,
  };
}
