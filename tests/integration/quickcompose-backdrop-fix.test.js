/**
 * Integration test: QuickComposeV4 backdrop pointer-events fix
 *
 * The qcv4-backdrop element is appended to document.body on the first call to
 * open() and is NEVER removed — only its CSS class toggles.  If it lacks
 * pointer-events:none when not visible it sits at z-index 9998 (above the
 * listing detail overlay at z-index 2000) and intercepts every click, making
 * the listing detail "×" close button unreachable.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const QCV4_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'public',
  'messenger',
  'js',
  'QuickComposeV4.js'
);

const MARKETPLACE_CSS_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'public',
  'assets',
  'css',
  'marketplace.css'
);

describe('QuickComposeV4 — backdrop pointer-events', () => {
  let src;
  let marketplaceCss;

  beforeAll(() => {
    src = fs.readFileSync(QCV4_PATH, 'utf8');
    marketplaceCss = fs.readFileSync(MARKETPLACE_CSS_PATH, 'utf8');
  });

  it('qcv4-backdrop has pointer-events:none by default so invisible backdrop cannot intercept clicks', () => {
    const backdropBlock = src.match(/\.qcv4-backdrop\s*\{([^}]+)\}/);
    expect(backdropBlock).not.toBeNull();
    expect(backdropBlock[1]).toContain('pointer-events: none');
  });

  it('qcv4-backdrop--visible restores pointer-events:auto so the backdrop is clickable when shown', () => {
    const visibleRule = src.match(/\.qcv4-backdrop--visible\s*\{([^}]+)\}/);
    expect(visibleRule).not.toBeNull();
    expect(visibleRule[1]).toContain('pointer-events: auto');
  });

  it('_ensurePanel guard prevents creating duplicate backdrops', () => {
    expect(src).toContain('if (_panel) {');
    expect(src).toContain('return;');
  });

  it('_close() removes --visible class from backdrop when QuickCompose closes', () => {
    expect(src).toContain("_backdrop.classList.remove('qcv4-backdrop--visible')");
  });

  it('backdrop is at z-index 9998 (above the listing detail overlay)', () => {
    expect(src).toContain('z-index: 9998');
  });

  it('listing-detail-overlay z-index is lower than the backdrop z-index', () => {
    const overlayZMatch = marketplaceCss.match(
      /\.listing-detail-overlay\s*\{[^}]*z-index:\s*(\d+)/
    );
    expect(overlayZMatch).not.toBeNull();
    expect(parseInt(overlayZMatch[1], 10)).toBeLessThan(9998);
  });
});
