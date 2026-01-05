# Avatar Widget Positioning Investigation

## Executive Summary

Investigated the JadeAssist avatar widget positioning implementation to identify and resolve any positioning issues.

## Current Implementation Status

### Widget Positioning (Correct ✅)

The widget is currently configured to be positioned on the **LEFT side** of the screen, vertically aligned with the back-to-top button:

**Desktop (> 768px):**
- Widget: `bottom: 5rem (80px), left: 1.5rem (24px)`
- Back-to-top: `bottom: 5rem (80px), right: 1.5rem (24px)`

**Mobile (≤ 768px):**
- Widget: `bottom: 4.5rem (72px), left: 1rem (16px)`
- Back-to-top: `bottom: 4.5rem (72px), right: 1rem (16px)`

**Teaser Bubble:**
- Desktop: `bottom: 8rem` (3rem above widget)
- Mobile: `bottom: 7.5rem` (3rem above widget)

### Implementation Approach

The positioning is achieved through two mechanisms:

1. **Shadow DOM Manipulation** (Primary method)
   - Directly sets styles on the container element inside the widget's shadow DOM
   - File: `public/assets/js/jadeassist-init.v2.js` (lines 138-168)
   - Provides the most reliable positioning control

2. **CSS Fallback** (Backup method)
   - Injects CSS rules targeting `.jade-widget-root` in the light DOM
   - File: `public/assets/js/jadeassist-init.v2.js` (lines 206-334)
   - Ensures positioning even if shadow DOM manipulation fails

### Code Verification

✅ **Consistent Values**: Both methods use the same positioning values
✅ **Responsive Design**: Different values for mobile and desktop
✅ **Safe Area Support**: iOS notch/safe area handling included
✅ **Z-index Hierarchy**: Properly layered (widget: 999, teaser: 998, back-to-top: 900)

## Files Checked

1. **`public/assets/js/jadeassist-init.v2.js`** (Current, 527 lines)
   - Lines 138-168: Shadow DOM positioning logic
   - Lines 206-334: CSS fallback styles
   - Lines 147-148: Desktop (5rem) and mobile (4.5rem) values

2. **`public/assets/js/jadeassist-init.js`** (Identical to v2)
   - Kept in sync for backwards compatibility

3. **`public/assets/css/components.css`**
   - Lines 638-730: Back-to-top button styles
   - Confirms back-to-top at `bottom: 5rem` (desktop) and `4.5rem` (mobile)

4. **`docs/jadeassist-widget.md`**
   - Documentation consistent with implementation
   - Describes left-side positioning, aligned with back-to-top

5. **Avatar Assets**
   - `public/assets/images/jade-avatar.png` (1.5MB) ✅ Exists
   - `public/assets/images/jade-avatar.svg` (4KB) ✅ Exists

## Test Page Created

Created `public/test-avatar-positioning.html` with:
- Live widget integration
- Real-time diagnostics
- Visual alignment guides
- Console output capture
- Testing tools (clear dismissal, scroll to bottom, etc.)

## Potential Issues Identified

### None Found in Code ✅

After thorough review:
- ✅ Positioning values are consistent across all files
- ✅ Shadow DOM manipulation is correctly implemented
- ✅ CSS fallback is properly configured
- ✅ Responsive breakpoints match between widget and back-to-top
- ✅ Avatar images exist and are referenced correctly
- ✅ Teaser positioning accounts for widget position

## Possible Live Site Issues

If positioning issues exist on the live site (not in code), they could be caused by:

### 1. Browser Caching
- **Symptom**: Old CSS/JS files are cached
- **Solution**: Hard refresh (Ctrl+Shift+R) or clear cache
- **Detection**: Check Network tab for 304 (cached) vs 200 (fresh)

### 2. CDN Caching
- **Symptom**: jsDelivr CDN returns old version of widget library
- **Solution**: Wait for CDN cache to expire, or update commit SHA
- **Detection**: Check widget library version in Network tab

### 3. CSS Specificity Conflict
- **Symptom**: Another stylesheet overrides widget positioning
- **Solution**: Increase specificity or add more `!important` flags
- **Detection**: Inspect `.jade-widget-root` and check for crossed-out styles

### 4. Inline Styles from Widget Library
- **Symptom**: Widget library applies inline styles that override our CSS
- **Solution**: Shadow DOM manipulation should handle this (already implemented)
- **Detection**: Inspect element and check for `style=""` attribute

### 5. JavaScript Timing Issue
- **Symptom**: Positioning applied before widget fully renders
- **Solution**: Increase timeout delays (currently 500ms)
- **Detection**: Watch console logs for timing of positioning application

## Recommended Next Steps

### For Testing

1. **Open test page**: Navigate to `/test-avatar-positioning.html`
2. **Run diagnostics**: Click "Run Diagnostics" button
3. **Check console**: Look for positioning confirmation messages
4. **Verify visually**: Both buttons should align horizontally
5. **Test mobile**: Resize browser to < 768px and re-check

### For Live Site Verification

1. **Open production site**: https://event-flow.co.uk/
2. **Open DevTools Console**: Press F12
3. **Look for logs**:
   ```
   ✅ Applied shadow DOM positioning: {bottom: "5rem", left: "1.5rem"}
   JadeAssist widget initialized successfully
   ```
4. **Inspect widget element**:
   ```javascript
   const widget = document.querySelector('.jade-widget-root');
   console.log('Position:', getComputedStyle(widget).bottom);
   // Should output: "80px" (5rem) on desktop
   ```
5. **Visual check**: Widget on left, back-to-top on right, same height

### If Issues Persist

If positioning still doesn't work after code verification:

1. **Capture screenshots**: Desktop and mobile views
2. **Export console logs**: Copy all console output
3. **Check computed styles**: Use DevTools to inspect actual applied values
4. **Test different browsers**: Chrome, Firefox, Safari to rule out browser-specific issues
5. **Verify deployment**: Ensure latest code is actually deployed to production

## Configuration Reference

### Key Constants

```javascript
MOBILE_BREAKPOINT = 768px
INIT_DELAY = 1000ms (widget initialization delay)
TEASER_DELAY = 500ms (teaser show delay after init)
RESIZE_DEBOUNCE_MS = 250ms (debounce for resize events)
```

### Positioning Values

```javascript
// Desktop
widget: { bottom: '5rem', left: '1.5rem' }
backToTop: { bottom: '5rem', right: '1.5rem' }
teaser: { bottom: '8rem', left: '1.5rem' }

// Mobile (≤768px)
widget: { bottom: '4.5rem', left: '1rem' }
backToTop: { bottom: '4.5rem', right: '1rem' }
teaser: { bottom: '7.5rem', left: '1rem' }
```

## Conclusion

**Code Review Result**: ✅ **No positioning issues found in code**

The implementation is correct and consistent across all files. Widget positioning logic is sound, with both shadow DOM manipulation and CSS fallback mechanisms in place. Responsive behavior is properly configured to match the back-to-top button positioning.

If positioning issues are observed on the live site, they are likely due to:
1. Browser/CDN caching
2. Deployment issues (old files served)
3. External CSS conflicts (unlikely given `!important` usage)

The test page (`test-avatar-positioning.html`) can be used to diagnose live site issues and verify positioning behavior in real-time.

## Files Modified in This Investigation

1. **Created**: `public/test-avatar-positioning.html` - Comprehensive diagnostic test page

No code changes were necessary as the existing implementation is correct.
