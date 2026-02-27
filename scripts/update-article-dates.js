#!/usr/bin/env node
/**
 * Update article dates to the current month and year.
 *
 * Run manually:  node scripts/update-article-dates.js
 * Automated:     GitHub Actions workflow runs this on the 1st of every month.
 *
 * What this script updates:
 *   - public/articles/*.html
 *       • "Published: Month Year"  →  "Updated: <current month> <current year>"
 *       • "dateModified" in JSON-LD  →  today's ISO date
 *       • Stale year numbers (2024/2025) in titles, headings, meta tags,
 *         description fields and body prose — but NOT inside URL slugs or
 *         ISO date strings (protected by the regex lookaround).
 *   - public/assets/data/guides.json
 *       • Every "published" date  →  first day of the current month (YYYY-MM-01)
 *   - public/blog.html
 *       • Stale year numbers in the inline article-title strings
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Date helpers ──────────────────────────────────────────────────────────────

const now = new Date();
const currentYear = String(now.getFullYear());
const currentMonth = now.toLocaleString('en-GB', { month: 'long' }); // e.g. "February"
const currentISODate = now.toISOString().slice(0, 10); // e.g. "2026-02-27"
const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');
const currentYearMonthFirst = `${currentYear}-${currentMonthNum}-01`;

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = path.join(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'public', 'articles');
const GUIDES_JSON = path.join(ROOT, 'public', 'assets', 'data', 'guides.json');
const BLOG_HTML = path.join(ROOT, 'public', 'blog.html');

// ─── Year replacement ─────────────────────────────────────────────────────────

/**
 * Replace stale years (2024, 2025) with the current year, but only when the
 * year is NOT part of a URL slug or ISO date:
 *   - Protected: "trends-2024"  "2024-12-31"  "/articles/guide-2025"
 *   - Replaced:  "Guide 2024"   "trends 2025"  "2024 couples"
 */
function replaceStaleYears(str) {
  // Negative lookbehind: not preceded by - / or a digit
  // Negative lookahead:  not followed by  - / or a digit
  return str.replace(/(?<![/\-\d])202[45](?![/\-\d])/g, currentYear);
}

// ─── Article HTML updater ─────────────────────────────────────────────────────

function updateArticleFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let updated = original;

  // 1. "Published: Month Year" → "Updated: currentMonth currentYear"
  updated = updated.replace(
    /(?:Published|Updated):\s+[A-Za-z]+\s+20\d{2}/g,
    `Updated: ${currentMonth} ${currentYear}`
  );

  // 2. "dateModified" in JSON-LD → today's ISO date
  updated = updated.replace(/"dateModified":\s*"[0-9-]+"/g, `"dateModified": "${currentISODate}"`);

  // 3. Stale years in all other text / attribute values
  updated = replaceStaleYears(updated);

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`  Updated: ${path.relative(ROOT, filePath)}`);
    return true;
  }
  return false;
}

// ─── guides.json updater ──────────────────────────────────────────────────────

function updateGuidesJson() {
  const original = fs.readFileSync(GUIDES_JSON, 'utf8');
  const guides = JSON.parse(original);
  let changed = false;

  guides.forEach(guide => {
    if (guide.published && guide.published !== currentYearMonthFirst) {
      guide.published = currentYearMonthFirst;
      changed = true;
    }
  });

  if (changed) {
    const updated = `${JSON.stringify(guides, null, 2)}\n`;
    fs.writeFileSync(GUIDES_JSON, updated, 'utf8');
    console.log(`  Updated: ${path.relative(ROOT, GUIDES_JSON)}`);
  }
  return changed;
}

// ─── blog.html updater ────────────────────────────────────────────────────────

function updateBlogHtml() {
  const original = fs.readFileSync(BLOG_HTML, 'utf8');
  const updated = replaceStaleYears(original);

  if (updated !== original) {
    fs.writeFileSync(BLOG_HTML, updated, 'utf8');
    console.log(`  Updated: ${path.relative(ROOT, BLOG_HTML)}`);
    return true;
  }
  return false;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`Updating article dates → ${currentMonth} ${currentYear} (${currentISODate})`);

let changes = 0;

const articleFiles = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.html'));
for (const file of articleFiles) {
  if (updateArticleFile(path.join(ARTICLES_DIR, file))) {
    changes++;
  }
}

if (updateGuidesJson()) {
  changes++;
}
if (updateBlogHtml()) {
  changes++;
}

if (changes === 0) {
  console.log('  No files needed updating.');
} else {
  console.log(`Done — ${changes} file(s) updated.`);
}
