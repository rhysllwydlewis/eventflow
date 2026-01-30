# Visual Verification Checklist - Homepage Optimization

## Purpose

This document provides a checklist for manually verifying that all buttons, text fields, cards, and other UI elements are properly aligned and positioned across all screen sizes (320px - 1440px).

## Testing Instructions

### 1. Setup

- Open the homepage in a browser with DevTools
- Use Responsive Design Mode to test different viewport sizes
- Test in both Chrome and Firefox for consistency

### 2. Viewport Sizes to Test

- **Mobile Small**: 320px × 568px (iPhone SE)
- **Mobile Standard**: 375px × 667px (iPhone 6/7/8)
- **Mobile Large**: 414px × 896px (iPhone 11 Pro Max)
- **Tablet**: 768px × 1024px (iPad)
- **Desktop Small**: 1024px × 768px
- **Desktop Standard**: 1280px × 800px
- **Desktop Large**: 1440px × 900px

---

## Element Alignment Checklist

### Header/Navigation Bar

- [ ] **Logo** properly aligned to the left
- [ ] **Navigation links** horizontally aligned in center
- [ ] **Auth button** aligned to the right
- [ ] **Mobile menu toggle** properly positioned (right side, 44px×44px minimum)
- [ ] Header maintains sticky position without jumping
- [ ] No horizontal overflow at any viewport

### Hero Section

#### Search Card

- [ ] **Category dropdown** aligned properly (left side)
- [ ] **Search input** fills remaining space correctly
- [ ] **Search icon** positioned inside input (left side, vertically centered)
- [ ] **Search button** positioned inside input (right side, 50px×50px)
- [ ] **Quick tags** (768px+): horizontally aligned, wrap properly
- [ ] No overlap between input and button at any size
- [ ] Mobile (< 640px): Elements stack vertically without misalignment

#### CTA Buttons

- [ ] **Primary CTA** ("Start planning"): proper padding (14px 28px)
- [ ] **Secondary CTA** ("Browse suppliers"): aligned with primary
- [ ] **CTA note text**: properly positioned below buttons
- [ ] Mobile: Buttons stack vertically and take full width
- [ ] Desktop (≥ 640px): Buttons display horizontally with proper spacing

#### Hero Collage

- [ ] **Video card**: spans full width (2 columns)
- [ ] **Category cards**: 2 columns on desktop, 2 columns on mobile
- [ ] Cards maintain aspect ratio without stretching
- [ ] Images don't overflow their containers
- [ ] Gap spacing consistent (14px desktop, 12px mobile)
- [ ] Labels positioned consistently (top-left of cards)
- [ ] No layout shift when images load

### Content Sections

#### Featured Packages

- [ ] Section title properly aligned
- [ ] Cards display in grid (responsive)
- [ ] Card spacing is consistent
- [ ] Images within cards maintain aspect ratio
- [ ] Text content properly aligned within cards
- [ ] Hover effects don't break layout

#### Spotlight Packages

- [ ] Same checks as Featured Packages
- [ ] Section spacing matches Featured

#### Footer

- [ ] Links properly spaced
- [ ] No text overflow on mobile
- [ ] Version number positioned correctly

---

## Specific Alignment Tests

### Text Field Alignment

- [ ] All input fields have consistent height
- [ ] Placeholder text vertically centered
- [ ] Labels aligned above their inputs
- [ ] Form groups have proper spacing

### Button Alignment

- [ ] All buttons meet 44px minimum tap target
- [ ] Button text vertically and horizontally centered
- [ ] Icon buttons maintain square aspect ratio
- [ ] Focus outline doesn't break layout

### Card Alignment

- [ ] All cards in a grid row have equal height (or proper min-height)
- [ ] Card content padding is consistent
- [ ] Card shadows don't create visual misalignment
- [ ] Hover transforms don't cause layout shift

### Responsive Breakpoints

- [ ] **320px**: No horizontal scroll, all content readable
- [ ] **375px**: Elements properly sized, no cramping
- [ ] **640px**: Search row switches to horizontal layout
- [ ] **768px**: Hero tags become visible, properly aligned
- [ ] **1024px**: Desktop nav visible, proper spacing
- [ ] **1440px**: Content doesn't look sparse, max-width respected

---

## CSS Validation

### Flexbox/Grid Alignment

```css
/* Check these properties are set correctly: */
align-items: center | start | end
justify-content: center | space-between | flex-start
gap: consistent spacing values
```

### Common Issues to Check

- [ ] No negative margins creating misalignment
- [ ] No absolute positioning breaking layout flow
- [ ] No fixed widths causing overflow on small screens
- [ ] No floats interfering with flexbox/grid

---

## Accessibility Checks

### Keyboard Navigation

- [ ] Tab order is logical and follows visual layout
- [ ] Focus indicators are visible and properly positioned
- [ ] Skip link functions correctly

### Touch Targets (Mobile)

- [ ] All interactive elements ≥ 44px × 44px
- [ ] Adequate spacing between tap targets (8px minimum)
- [ ] No overlapping interactive elements

---

## Browser Testing

### Chrome

- [ ] All alignments correct
- [ ] No console warnings about layout issues
- [ ] Performance metrics acceptable

### Firefox

- [ ] Same checks as Chrome
- [ ] Check for any Firefox-specific rendering issues

### Safari (if possible)

- [ ] Backdrop-filter works or has fallback
- [ ] Flexbox/grid behaves consistently

---

## Performance Verification

### Layout Stability

- [ ] No CLS (Cumulative Layout Shift) during page load
- [ ] Hero section doesn't jump when images load
- [ ] Collage frames reserve space properly

### Visual Regression

- [ ] Compare screenshots before/after changes
- [ ] No unexpected visual differences
- [ ] All intentional changes are improvements

---

## Known Good States

### Desktop (1440px)

- Hero grid: 1.1fr (content) + 0.9fr (collage)
- Search row: Category (180px) + Input (flex: 1) + Button (50px)
- CTAs: Side-by-side with 16px gap

### Tablet (768px)

- Hero collage: 480px height, 2 columns
- Tags visible: flex-wrap with 10px gap
- Navigation: Full desktop nav visible

### Mobile (375px)

- Hero collage: auto height, 2 columns, 12px gap
- Search: Vertical stack with 12px gap
- CTAs: Vertical stack, full width
- Tags: Hidden for cleaner mobile experience

---

## Sign-off

After completing all checks:

- [ ] All elements properly aligned across all viewports
- [ ] No layout issues found
- [ ] Accessibility requirements met
- [ ] Performance targets achieved
- [ ] Screenshots captured for documentation

**Verified by:** **\*\***\_**\*\***  
**Date:** **\*\***\_**\*\***  
**Notes:** **\*\***\_**\*\***
