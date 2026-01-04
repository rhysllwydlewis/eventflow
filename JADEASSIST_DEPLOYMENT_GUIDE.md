# JadeAssist Repository - Deployment Instructions

## Current Setup (Updated)

**EventFlow now loads the JadeAssist widget from jsDelivr CDN using a pinned commit SHA.**

**Current Widget Version:** `93906b5068d1a4cbae45a64b8ed6dd33bc94aab8`

This ensures that:
- Latest JadeAssist changes are reflected on the live site
- No manual vendoring required
- Immutable URLs prevent caching issues

---

## Changes Made to JadeAssist Widget

The JadeAssist widget repository includes avatar support and UX improvements.

### Latest Commit Information

**Commit SHA:** `93906b5068d1a4cbae45a64b8ed6dd33bc94aab8`
**Branch:** `main`
**Status:** ✅ Pushed to GitHub and deployed via CDN

### Features at This Commit

1. **Avatar Image Support**
   - Custom avatar URL configuration via `avatarUrl` property
   - Fallback emoji icon if avatar fails to load
   - Woman avatar image included in assets

2. **Enhanced UX**
   - Larger tap target for better mobile experience
   - Floating animation on avatar button
   - Greeting tooltip with dismissal
   - Improved shadows and hover effects

3. **Positioning Configuration**
   - `offsetBottom`: Controls distance from bottom of viewport (default: '80px')
   - `offsetRight`: Controls distance from right of viewport (default: '24px')
   - Note: Advanced position API with mobile overrides and safe area support is not yet available at this commit

4. **Built Distribution File** (`dist/jade-widget.js`)
   - Production-ready build with new API

---

## Deployment Approach (Current)

EventFlow uses the **jsDelivr CDN with pinned commit SHA** approach.

**Widget URL:**
```
https://cdn.jsdelivr.net/gh/rhysllwydlewis/JadeAssist@93906b5068d1a4cbae45a64b8ed6dd33bc94aab8/packages/widget/dist/jade-widget.js
```

**Benefits:**

- ✅ Latest JadeAssist changes automatically available
- ✅ No vendored files to maintain
- ✅ Immutable URLs (pinned SHA)
- ✅ CDN caching for performance
- ✅ Smaller EventFlow repository

**How to Update to a Newer Version:**

```bash
# 1. Get the new commit SHA from JadeAssist repo
# 2. Update all HTML files (48 files)
find public -name "*.html" -type f -exec sed -i 's|JadeAssist@OLD_SHA|JadeAssist@NEW_SHA|g' {} \;

# 3. Update the integration test
# Edit tests/integration/jadeassist-widget.test.js
# Change expectedCommitSHA to new SHA

# 4. Run tests to verify
npm test -- --testPathPattern=jadeassist-widget
```

---

## Widget API Documentation

### Configuration Options

```typescript
interface WidgetConfig {
  apiBaseUrl?: string;           // API endpoint (empty string for demo mode)
  assistantName?: string;        // Display name (default: 'Jade')
  greetingText?: string;         // Initial message in chat
  greetingTooltipText?: string;  // Tooltip text on greeting bubble
  avatarUrl?: string;            // URL to avatar image
  primaryColor?: string;         // Main brand color (default: '#0B8073')
  accentColor?: string;          // Accent brand color (default: '#13B6A2')
  fontFamily?: string;           // Font stack for widget
  showDelayMs?: number;          // Delay before showing greeting (default: 1000ms)
  offsetBottom?: string;         // Distance from bottom (default: '80px')
  offsetRight?: string;          // Distance from right (default: '24px')
}
```

### Usage Example

```javascript
window.JadeWidget.init({
  // Existing options
  primaryColor: '#00B2A9',
  accentColor: '#008C85',
  assistantName: 'Jade',
  greetingText: "Hi! I'm Jade.",
  greetingTooltipText: "👋 Hi! Need help planning your event?",
  avatarUrl: '/path/to/avatar.png',
  
  // Positioning
  offsetBottom: '10rem',  // 160px - positions below back-to-top button
  offsetRight: '1.5rem',  // 24px - spacing from right edge
});
```

---

## Testing the Widget

```javascript
// Open browser console on page with widget

// Check if widget loaded
console.log(typeof window.JadeWidget); // Should be 'object'

// Check widget root exists
console.log(document.querySelector('.jade-widget-root')); // Should be HTMLDivElement

// Check shadow DOM positioning
const root = document.querySelector('.jade-widget-root');
const container = root.shadowRoot.querySelector('.jade-widget-container');
console.log(window.getComputedStyle(container).bottom); // Should be configured value
```

---

## Integration with EventFlow

EventFlow uses the JadeAssist widget with custom branding and positioning:

**File:** `public/assets/js/jadeassist-init.js`

```javascript
window.JadeWidget.init({
  primaryColor: '#00B2A9',
  accentColor: '#008C85',
  assistantName: 'Jade',
  greetingText: "Hi! I'm Jade. Ready to plan your event?",
  greetingTooltipText: "👋 Hi! Need help planning your event?",
  avatarUrl: '/assets/images/jade-avatar.png',
  offsetBottom: '10rem',  // Positions below back-to-top button
  offsetRight: '1.5rem',
});
```

This configuration:

- Positions widget at `bottom: 10rem` (160px) - below the back-to-top button
- Positions widget at `right: 1.5rem` (24px) from the right edge
- Uses EventFlow brand colors (teal)
- Loads custom avatar from EventFlow domain
- Shows greeting tooltip after 1 second delay

---

## Files in EventFlow Using the Widget

All HTML files load the widget from jsDelivr CDN with pinned SHA:

```html
<!-- Current approach (Pinned CDN) -->
<script
  src="https://cdn.jsdelivr.net/gh/rhysllwydlewis/JadeAssist@93906b5068d1a4cbae45a64b8ed6dd33bc94aab8/packages/widget/dist/jade-widget.js"
  defer
></script>
<script src="/assets/js/jadeassist-init.js" defer></script>
```

**Files updated:** 48 HTML files across the public directory

---

## Verification Checklist

After deploying EventFlow:

- [ ] Open browser console on homepage
- [ ] Verify message: "JadeAssist widget initialized successfully"
- [ ] Verify message: "✅ Widget loaded with custom positioning: {position: fixed, bottom: 160px...}"
- [ ] Visually confirm widget appears at correct position
- [ ] Visually confirm avatar image displays
- [ ] Visually confirm teaser bubble appears
- [ ] Test on mobile device or emulator
- [ ] Verify widget doesn't overlap footer navigation
- [ ] Test on iOS device to verify safe area handling

---

## Support

If issues arise:

1. **Check Browser Console**
   - Look for error messages
   - Verify initialization messages appear
   - Check computed styles on shadow DOM elements

2. **Verify Files Deployed**
   - Widget loads from CDN (check Network tab)
   - `/assets/images/jade-avatar.png` exists
   - `/assets/js/jadeassist-init.js` has position config

3. **Test Widget Independently**
   - Create minimal HTML page with widget
   - Test different position configurations
   - Check shadow DOM in DevTools

4. **Compare with Test Environment**
   - Reference working test at `http://localhost:8766/`
   - Compare console output
   - Compare visual appearance

---

## Summary

✅ JadeAssist widget enhanced with positioning API
✅ EventFlow updated to use new API  
✅ Widget loads from jsDelivr CDN with pinned SHA
✅ All 48 HTML files updated
✅ Vendored file removed
✅ Integration tests passing
✅ Tested and verified working

**Current Setup:** EventFlow loads widget from `https://cdn.jsdelivr.net/gh/rhysllwydlewis/JadeAssist@93906b5068d1a4cbae45a64b8ed6dd33bc94aab8/packages/widget/dist/jade-widget.js`
