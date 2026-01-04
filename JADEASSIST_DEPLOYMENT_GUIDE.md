# JadeAssist Repository - Deployment Instructions

## Changes Made to JadeAssist Widget

The JadeAssist widget repository (`/tmp/JadeAssist`) has been updated with a positioning configuration API. These changes have been committed locally but **need to be pushed to GitHub**.

### Commit Information

**Commit SHA:** `4459deb`
**Branch:** `main`
**Commit Message:** "Add positioning configuration API to widget"

### Files Changed

```
packages/widget/src/types.ts         - Added WidgetPosition interface
packages/widget/src/styles.ts        - Dynamic positioning with config
packages/widget/src/widget.ts        - Pass position to styles
packages/widget/dist/jade-widget.js  - Built widget (23KB)
```

### Changes Summary

1. **Added WidgetPosition Interface** (`types.ts`)
   - `bottom`, `right`, `left` positioning options
   - `zIndex` configuration
   - `mobile` object for mobile-specific overrides
   - `respectSafeArea` flag for iOS safe area handling

2. **Updated Widget Styles** (`styles.ts`)
   - Dynamic CSS generation based on position config
   - Mobile media query with config overrides
   - iOS safe area inset support

3. **Updated Widget Class** (`widget.ts`)
   - Pass position config to `getWidgetStyles()`

4. **Built Distribution File** (`dist/jade-widget.js`)
   - Production-ready build with new API

---

## Deployment Options

### Option 1: Push to GitHub (Recommended for Long-term)

If you want to use the widget from CDN in the future:

```bash
# Navigate to JadeAssist repo
cd /path/to/JadeAssist

# Verify changes
git log -1 --stat

# Push to GitHub
git push origin main

# Tag new version
git tag v1.1.0 -m "Add positioning configuration API"
git push origin v1.1.0

# Update EventFlow HTML files to use new version
# Change: /assets/js/vendor/jade-widget.js
# To: https://cdn.jsdelivr.net/gh/rhysllwydlewis/JadeAssist@v1.1.0/packages/widget/dist/jade-widget.js
```

### Option 2: Use Local Widget (Current Setup)

EventFlow is currently configured to use the local widget file.
No additional JadeAssist deployment needed - it's already included in EventFlow.

**Pros:**

- ✅ No CDN dependency
- ✅ Full control over widget version
- ✅ Faster load times (no external request)
- ✅ Works immediately

**Cons:**

- ❌ Need to rebuild widget for updates
- ❌ Larger EventFlow repository size (+23KB)

---

## JadeAssist Repository Location

The modified JadeAssist repository is located at:

```
/tmp/JadeAssist
```

### To Access and Push Changes

```bash
# Navigate to repo
cd /tmp/JadeAssist

# Check status
git status

# View commit
git log -1 --stat

# View remote
git remote -v

# Push (requires GitHub credentials)
git push origin main

# Tag and push tag
git tag v1.1.0 -m "Add positioning configuration API"
git push origin v1.1.0
```

---

## Widget API Documentation

### New Configuration Options

```typescript
interface WidgetPosition {
  bottom?: string; // e.g., '10rem', '160px'
  right?: string; // e.g., '1.5rem', '24px'
  left?: string; // Alternative to right
  zIndex?: number; // Default: 999999
  mobile?: {
    bottom?: string; // Mobile-specific bottom
    right?: string; // Mobile-specific right
    left?: string; // Mobile-specific left
  };
  respectSafeArea?: boolean; // Handle iOS safe areas (default: true)
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
  avatarUrl: '/path/to/avatar.png',

  // NEW: Position configuration
  position: {
    bottom: '10rem',
    right: '1.5rem',
    zIndex: 999,
    mobile: {
      bottom: '11rem',
      right: '1rem',
    },
    respectSafeArea: true,
  },
});
```

---

## Testing the Widget

### Verify Build Works

```bash
cd /tmp/JadeAssist/packages/widget

# Install dependencies
npm install

# Run build
npm run build

# Check output
ls -lh dist/jade-widget.js
```

### Test in Browser

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

## Rollback Instructions

If you need to rollback the JadeAssist changes:

```bash
cd /tmp/JadeAssist

# View commits
git log --oneline -5

# Reset to previous commit (before 4459deb)
git reset --hard HEAD~1

# Rebuild widget
cd packages/widget
npm run build

# Copy to EventFlow
cp dist/jade-widget.js /home/runner/work/eventflow/eventflow/public/assets/js/vendor/
```

---

## Integration with EventFlow

EventFlow has been updated to use the new positioning API:

**File:** `public/assets/js/jadeassist-init.js`

```javascript
window.JadeWidget.init({
  primaryColor: '#00B2A9',
  accentColor: '#008C85',
  assistantName: 'Jade',
  greetingText: "Hi! I'm Jade. Ready to plan your event?",
  avatarUrl: '/assets/images/jade-avatar.png',
  position: {
    bottom: '10rem',
    right: '1.5rem',
    zIndex: 999,
    mobile: {
      bottom: '11rem',
      right: '1rem',
    },
    respectSafeArea: true,
  },
});
```

This configuration:

- Positions widget at `bottom: 10rem` (160px) on desktop
- Positions widget at `bottom: 11rem` (176px) on mobile
- Automatically handles iOS safe areas
- Sets `zIndex: 999` to appear below modals but above content

---

## Files in EventFlow Using the Widget

All HTML files have been updated to use the local widget:

```html
<!-- Before (CDN) -->
<script
  src="https://cdn.jsdelivr.net/gh/rhysllwydlewis/JadeAssist@ca1aecd6.../jade-widget.js"
  defer
></script>

<!-- After (Local) -->
<script src="/assets/js/vendor/jade-widget.js" defer></script>
```

**Files updated:** 46 HTML files across the public directory

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
   - `/assets/js/vendor/jade-widget.js` exists
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
✅ Local widget file included in EventFlow
✅ All HTML files updated
✅ Tested and verified working
⏳ JadeAssist changes committed but not pushed to GitHub

**Next Action:** Optionally push JadeAssist commit `4459deb` to GitHub and tag as `v1.1.0`
