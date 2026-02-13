/**
 * Lightweight local confetti fallback.
 * Replaces external CDN dependency to avoid tracking-prevention/storage warnings.
 */

(function () {
  'use strict';

  if (typeof window.confetti === 'function') {
    return;
  }

  function createParticle(container, x, y, color) {
    const particle = document.createElement('span');
    particle.style.position = 'fixed';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.width = '8px';
    particle.style.height = '8px';
    particle.style.borderRadius = '2px';
    particle.style.background = color;
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '9999';
    particle.style.willChange = 'transform, opacity';
    container.appendChild(particle);

    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 90;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 30;

    particle.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(360deg)`, opacity: 0 },
      ],
      {
        duration: 650 + Math.random() * 450,
        easing: 'cubic-bezier(.17,.67,.24,.99)',
        fill: 'forwards',
      }
    ).onfinish = () => particle.remove();
  }

  window.confetti = function confetti(options = {}) {
    const particleCount = Number(options.particleCount) || 80;
    const origin = options.origin || { x: 0.5, y: 0.6 };
    const colors = options.colors || ['#13B6A2', '#0B8073', '#FFD700', '#FF6B6B'];

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const x = Math.round(window.innerWidth * (origin.x || 0.5));
    const y = Math.round(window.innerHeight * (origin.y || 0.6));

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999';
    document.body.appendChild(container);

    for (let i = 0; i < particleCount; i += 1) {
      createParticle(container, x, y, colors[i % colors.length]);
    }

    setTimeout(() => container.remove(), 1800);
  };
})();
