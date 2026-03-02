/**
 * Auth Page Slideshow — Live Pexels Integration
 *
 * Fetches event-themed photos through our public backend proxy and populates
 * the left-panel crossfading slideshow on desktop.
 *
 * Behaviour:
 * - Only activates on screens ≥ 768 px wide (the left panel is hidden on mobile).
 * - Calls GET /api/public/auth-photos which returns up to 6 Pexels photos or
 *   curated fallback URLs when the Pexels API key is not configured.
 * - Preloads each image before swapping the CSS background-image so there is
 *   no flash of empty/broken content.
 * - Shows a Pexels attribution credit in #auth-panel-credit as required by the
 *   Pexels licence.
 * - If anything fails the static CSS background-images remain in place.
 */

(function () {
  'use strict';

  // Left panel is hidden on mobile — skip unnecessary work.
  if (!window.matchMedia('(min-width: 768px)').matches) {
    return;
  }

  const API_URL = '/api/public/auth-photos';

  const photoSlots = [
    document.querySelector('.auth-panel-photo--1'),
    document.querySelector('.auth-panel-photo--2'),
    document.querySelector('.auth-panel-photo--3'),
    document.querySelector('.auth-panel-photo--4'),
  ].filter(Boolean);

  if (photoSlots.length === 0) {
    return;
  }

  const creditEl = document.getElementById('auth-panel-credit');

  const preloadImage = url =>
    new Promise(resolve => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve; // resolve even on error so Promise.all never rejects
      img.src = url;
    });

  const setCredit = photo => {
    if (!creditEl || !photo) {
      return;
    }
    const photographer = photo.photographer || 'Pexels';
    const pUrl = photo.photographerUrl || 'https://www.pexels.com';

    // Build DOM nodes (no innerHTML) to stay XSS-safe.
    creditEl.textContent = '';

    const prefix = document.createTextNode('Photo by ');
    const photographerLink = document.createElement('a');
    photographerLink.href = pUrl;
    photographerLink.target = '_blank';
    photographerLink.rel = 'noopener noreferrer';
    photographerLink.textContent = photographer;

    const separator = document.createTextNode(' on ');

    const pexelsLink = document.createElement('a');
    pexelsLink.href = 'https://www.pexels.com';
    pexelsLink.target = '_blank';
    pexelsLink.rel = 'noopener noreferrer';
    pexelsLink.textContent = 'Pexels';

    creditEl.appendChild(prefix);
    creditEl.appendChild(photographerLink);
    creditEl.appendChild(separator);
    creditEl.appendChild(pexelsLink);
  };

  const applyPhotos = photos => {
    const slots = photos.slice(0, photoSlots.length);

    // Preload all images in parallel, then swap.
    Promise.all(slots.map(p => preloadImage(p.url))).then(() => {
      slots.forEach((photo, i) => {
        // Encode the URL and escape any remaining quotes/parens so the CSS value is safe.
        const safeUrl = encodeURI(photo.url).replace(/'/g, '%27').replace(/\)/g, '%29');
        photoSlots[i].style.backgroundImage = `url('${safeUrl}')`;
      });
      setCredit(photos[0]);
    });
  };

  const loadSlideshow = () => {
    fetch(API_URL)
      .then(res => {
        if (!res.ok) {
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (!data || !data.photos || data.photos.length === 0) {
          return;
        }
        applyPhotos(data.photos);
      })
      .catch(() => {
        // Silently fall back — the static CSS background-images remain in place.
      });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSlideshow);
  } else {
    loadSlideshow();
  }
})();
