# EventFlow CSS Class System Documentation

## Overview

This document describes the CSS class naming conventions and architecture for the EventFlow Supplier Dashboard, introduced in PR "Supplier Dashboard Final Polish: Remove Remaining Inline Styles & Refactor Widgets".

## Purpose

The CSS class system replaces inline styles with reusable, maintainable CSS classes, improving:

- **Maintainability**: Changes in one centralized location
- **Performance**: Better browser caching, smaller HTML payload
- **Consistency**: Uniform styling across components
- **Developer Experience**: Clear, semantic class names
- **Theme-ability**: Easy to extend and customize

---

## File Structure

```
public/assets/css/
├── supplier-dashboard-improvements.css  (Main stylesheet)
├── styles.css                          (Base styles)
├── components.css                      (Reusable components)
└── ...
```

---

## Naming Conventions

### Prefix System

We use a **BEM-inspired** naming convention with component-specific prefixes:

- `supplier-*` - Supplier dashboard specific components
- `lead-quality-*` - Lead quality widget components
- `form-*` - Form elements and states

### Pattern

```
[component]-[element]--[modifier]
```

**Examples:**

- `.supplier-cta-banner` (component)
- `.supplier-cta-banner-title` (element)
- `.lead-quality-fill--hot` (modifier)

---

## CSS Sections (in supplier-dashboard-improvements.css)

### Section 1-20: Pre-existing Components

(Welcome cards, quick actions, checkboxes, etc.)

### Section 21: Profile Customization CTA Banner

**Purpose**: Gradient banner promoting profile customization

**Classes:**

```css
.supplier-cta-section         /* Section wrapper with top border */
.supplier-cta-banner          /* Main banner container */
.supplier-cta-banner-content  /* Content area (flexible) */
.supplier-cta-banner-title    /* Banner heading */
.supplier-cta-banner-badge    /* "New" badge */
.supplier-cta-banner-text     /* Description text */
.supplier-cta-banner-button   /* CTA button with hover effects */
```

**Usage:**

```html
<div class="form-row supplier-cta-section">
  <div class="supplier-cta-banner">
    <div class="supplier-cta-banner-content">
      <h3 class="supplier-cta-banner-title">
        ✨ Profile Customization
        <span class="supplier-cta-banner-badge">New</span>
      </h3>
      <p class="supplier-cta-banner-text">Make your profile stand out</p>
    </div>
    <a href="/customize" class="supplier-cta-banner-button"> Customize → </a>
  </div>
</div>
```

**Responsive:**

- Mobile (< 640px): Stacks vertically, full-width button

---

### Section 22: Lead Quality Breakdown Widget

**Purpose**: Data visualization for lead quality metrics

**Classes:**

```css
.lead-quality-item            /* Individual quality tier container */
.lead-quality-header          /* Header with label and value */
.lead-quality-label           /* Emoji + label text */
.lead-quality-value           /* Count and percentage */
.lead-quality-bar             /* Progress bar container */
.lead-quality-fill            /* Fill bar base */
.lead-quality-fill--hot       /* Hot tier (red, 80+) */
.lead-quality-fill--high      /* High tier (amber, 60-79) */
.lead-quality-fill--good      /* Good tier (green, 40-59) */
.lead-quality-fill--low       /* Low tier (gray, <40) */
.lead-quality-summary         /* Summary card */
.lead-quality-summary-label   /* Summary label */
.lead-quality-summary-value   /* Large score display */
```

**Usage:**

```html
<div class="lead-quality-item">
  <div class="lead-quality-header">
    <span class="lead-quality-label">🔥 Hot (80+)</span>
    <span class="lead-quality-value">5 (25%)</span>
  </div>
  <div class="lead-quality-bar">
    <div class="lead-quality-fill lead-quality-fill--hot" style="width: 25%;"></div>
  </div>
</div>
```

**Note**: Dynamic `width` percentage is set via inline style for data visualization.

---

### Section 23: Form Grid Layouts

**Purpose**: Responsive form layouts

**Classes:**

```css
.supplier-form-grid       /* Auto-fit grid (min 200px) */
.supplier-form-grid-2col  /* 2-column grid */
```

**Usage:**

```html
<div class="form-row supplier-form-grid">
  <div><label>Field 1</label><input /></div>
  <div><label>Field 2</label><input /></div>
  <div><label>Field 3</label><input /></div>
</div>
```

**Responsive:**

- Mobile (< 640px): Single column layout

---

### Section 24: Form Validation States

**Purpose**: Consistent form feedback styling

**Classes:**

```css
.form-required          /* Red asterisk for required fields */
.form-help-text         /* Gray help text */
.form-error-text        /* Red error message (hidden by default) */
.form-error-text.visible /* Visible error state */
```

**Usage:**

```html
<label>Postcode <span class="form-required">*</span></label>
<input id="postcode" />
<p class="form-help-text">Enter UK postcode</p>
<p class="form-error-text" id="postcode-error">Invalid postcode</p>
```

**JavaScript:**

```javascript
// Show error
errorElement.classList.add('visible');

// Hide error
errorElement.classList.remove('visible');
```

---

### Section 25: Section Headers

**Purpose**: Consistent section headings

**Classes:**

```css
.supplier-section-header  /* Consistent section heading style */
```

**Usage:**

```html
<h3 class="supplier-section-header">Create / Edit profile</h3>
```

---

### Section 26: Card Components

**Purpose**: Card action buttons and badges

**Classes:**

```css
.supplier-card-action-btn       /* Compact card button */
.supplier-unread-badge          /* Badge (hidden by default) */
.supplier-unread-badge.visible  /* Visible badge state */
```

**Usage:**

```html
<button class="cta supplier-card-action-btn">Create Ticket</button>
<span class="badge badge-info supplier-unread-badge">0 unread</span>
```

**JavaScript:**

```javascript
badge.classList.add('visible'); // Show badge
```

---

### Section 27: Form Row Helpers

**Purpose**: Utility classes for form rows

**Classes:**

```css
.form-row-hidden  /* Hidden form row state */
```

**Usage:**

```html
<div class="form-row form-row-hidden" id="optional-field">
  <!-- Hidden by default -->
</div>
```

**JavaScript:**

```javascript
// Show
row.classList.remove('form-row-hidden');

// Hide
row.classList.add('form-row-hidden');
```

---

### Section 28: Subscription Card Helpers

**Purpose**: Subscription status and actions

**Classes:**

```css
.subscription-status-active  /* Green status text */
.subscription-action-btn     /* Subscription action buttons */
```

**Usage:**

```html
<p>Status: <span class="subscription-status-active">✓ Active</span></p>
<a href="/upgrade" class="btn subscription-action-btn">Manage</a>
```

---

## Best Practices

### 1. Use Classes, Not Inline Styles

**❌ Don't:**

```html
<div style="margin-top: 1rem; padding: 0.5rem;"></div>
```

**✅ Do:**

```html
<div class="supplier-section"></div>
```

### 2. Use classList API for JavaScript

**❌ Don't:**

```javascript
element.style.display = 'none';
```

**✅ Do:**

```javascript
element.classList.add('form-row-hidden');
```

### 3. Keep Specificity Low

**❌ Don't:**

```css
.card .header .title .text {
}
```

**✅ Do:**

```css
.supplier-cta-banner-title {
}
```

### 4. Mobile-First Responsive Design

```css
/* Base styles (mobile) */
.supplier-cta-banner {
  flex-direction: column;
}

/* Desktop override */
@media (min-width: 641px) {
  .supplier-cta-banner {
    flex-direction: row;
  }
}
```

### 5. Use Semantic Class Names

**❌ Don't:**

```css
.mb-1 {
  margin-bottom: 1rem;
}
.text-red {
  color: red;
}
```

**✅ Do:**

```css
.form-error-text {
  color: #ef4444;
}
.supplier-section-header {
  margin-bottom: 0.75rem;
}
```

---

## Acceptable Inline Styles

Only use inline styles for:

1. **Dynamic Data Visualization**

   ```html
   <div style="width: ${percentage}%;"></div>
   ```

2. **JavaScript-Controlled Visibility** (auth states)
   ```html
   <div id="auth-element" style="display: none;"></div>
   ```

---

## Color Palette

### Brand Colors

- **Primary Teal**: `#0B8073`
- **Dark Teal**: `#0a6b5f`

### Status Colors

- **Success/Green**: `#10b981`
- **Warning/Amber**: `#f59e0b`
- **Error/Red**: `#ef4444`
- **Info/Gray**: `#6b7280`

### Neutral Colors

- **Dark Text**: `#111827`, `#374151`
- **Mid Gray**: `#667085`
- **Light Gray**: `#e5e7eb`, `#f9fafb`

---

## Responsive Breakpoints

```css
/* Mobile: Default (< 640px) */
/* Tablet: 640px - 768px */
@media (max-width: 768px) {
}

/* Desktop: > 768px */
@media (min-width: 769px) {
}

/* Mobile specific */
@media (max-width: 640px) {
}
```

---

## Migration Guide

### Converting Inline Styles to Classes

1. **Identify the component/pattern**
2. **Create semantic class name**
3. **Add to appropriate CSS section**
4. **Update HTML to use class**
5. **Update JavaScript if needed**

**Example:**

Before:

```html
<div style="display: flex; gap: 1rem; padding: 1rem;">
  <span style="font-weight: 600;">Label</span>
</div>
```

After:

```css
.supplier-card-header {
  display: flex;
  gap: 1rem;
  padding: 1rem;
}

.supplier-card-header-label {
  font-weight: 600;
}
```

```html
<div class="supplier-card-header">
  <span class="supplier-card-header-label">Label</span>
</div>
```

---

## Maintenance

### Adding New Classes

1. Choose appropriate section or create new one
2. Follow naming conventions
3. Add documentation comment
4. Test responsive behavior
5. Update this documentation

### Modifying Existing Classes

1. Check usage across codebase
2. Consider backwards compatibility
3. Update documentation
4. Test all affected pages

---

## Tools & Linting

### CSS Linting (Optional)

Install stylelint for CSS linting:

```bash
npm install --save-dev stylelint stylelint-config-standard
```

Add to `package.json`:

```json
"scripts": {
  "lint:css": "stylelint 'public/assets/css/**/*.css'"
}
```

### Pre-commit Hooks

CSS files can be added to lint-staged in `package.json`:

```json
"lint-staged": {
  "*.css": [
    "stylelint --fix",
    "prettier --write"
  ]
}
```

---

## Performance Considerations

### CSS File Size

- Current: 870 lines (~30KB unminified)
- Minified: ~20KB (estimated)
- Gzipped: ~5KB (estimated)

### Optimization Recommendations

1. **CSS Minification**: Add to build process

   ```bash
   npm install --save-dev cssnano postcss-cli
   ```

2. **Unused CSS Removal**: Use PurgeCSS for production
3. **Critical CSS**: Inline critical styles for above-the-fold content
4. **HTTP/2**: Leverage multiplexing for parallel CSS loading

---

## Troubleshooting

### Common Issues

**1. Styles not applying**

- Check class name spelling
- Verify CSS file is loaded
- Check browser cache (hard refresh)
- Inspect element for conflicting styles

**2. JavaScript classList not working**

- Verify element exists in DOM
- Check timing (DOM ready?)
- Ensure class name is correct

**3. Responsive issues**

- Test at actual breakpoints
- Check media query syntax
- Verify viewport meta tag

---

## References

- [BEM Methodology](http://getbem.com/)
- [MDN CSS Reference](https://developer.mozilla.org/en-US/docs/Web/CSS)
- [CSS Guidelines](https://cssguidelin.es/)
- [Stylelint](https://stylelint.io/)

---

## Changelog

### Version 1.0.0 (2026-02-03)

- Initial CSS class system documentation
- 8 sections documented (21-28)
- 243 lines of new CSS classes
- ~30 inline styles removed
- Complete migration guide added

---

## Contact

For questions or suggestions about the CSS class system, please:

1. Review this documentation
2. Check existing issues in GitHub
3. Create new issue with label `css-architecture`
4. Contact the frontend team

---

**Last Updated**: 2026-02-03  
**Version**: 1.0.0  
**Maintainer**: EventFlow Frontend Team
