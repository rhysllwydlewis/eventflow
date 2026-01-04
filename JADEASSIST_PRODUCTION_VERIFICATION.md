# JadeAssist Widget Production Verification Guide

This guide helps you verify that the JadeAssist widget is working correctly in production at https://www.event-flow.co.uk

## Quick Verification Checklist

Use this checklist to quickly verify the widget in production:

- [ ] Widget launcher appears on the left side of the screen
- [ ] Avatar shows the custom PNG image (not a teal circle)
- [ ] Widget is positioned at the correct height (aligned with back-to-top button)
- [ ] Chat is closed by default on page load
- [ ] Teaser bubble appears after ~500ms (if not previously dismissed)
- [ ] Console diagnostics show successful initialization

## Detailed Verification Steps

### 1. Verify Correct Init Script is Loaded

**Purpose**: Ensure production pages load the correct initialization script (`jadeassist-init.v2.js`).

**Steps**:
1. Open production site: https://www.event-flow.co.uk
2. Open Browser DevTools (F12)
3. Go to Network tab
4. Filter by "JS" or search for "jadeassist"
5. Refresh the page (Ctrl+R or Cmd+R)

**Expected Result**:
- Should see request for `/assets/js/jadeassist-init.v2.js`
- Status should be `200 OK` (green)
- Should NOT see request for old `jadeassist-init.js` (without .v2)

**What if it fails?**:
- If you see 404: The file is missing from production deployment
- If you see old script: HTML files need to be updated to reference v2 script
- Check all HTML files reference the correct script: `<script src="/assets/js/jadeassist-init.v2.js" defer></script>`

---

### 2. Verify Avatar Image is Served Correctly

**Purpose**: Confirm the custom avatar PNG is accessible and returns 200 OK.

**Method A: Direct URL Test**
1. Navigate to: https://www.event-flow.co.uk/assets/images/jade-avatar.png
2. The image should load directly in your browser
3. Should show a professional avatar image

**Expected Result**:
- Image displays successfully
- No 404 error page

**Method B: Network Tab**
1. Open production site: https://www.event-flow.co.uk
2. Open Browser DevTools (F12)
3. Go to Network tab
4. Filter by "Img" or search for "jade-avatar"
5. Refresh the page

**Expected Result**:
- Should see request for `jade-avatar.png`
- Status should be `200 OK` (green)
- Size should be ~1.5 MB (1513011 bytes)
- Type should be `png`

**Method C: Console Check**
1. Open Browser DevTools (F12)
2. Go to Console tab
3. Look for these messages:
   ```
   JadeAssist avatar URL: /assets/images/jade-avatar.png
   ✅ JadeAssist avatar loaded successfully
   ```

**What if it fails?**:
- If you see `⚠️ JadeAssist avatar failed to load`: The URL is incorrect or file is missing
- If you see 404 in Network tab: File wasn't deployed to production
- Check that `public/assets/images/jade-avatar.png` exists in the repository
- Verify the deployment process includes the `public/assets/images/` directory

---

### 3. Verify Widget Positioning

**Purpose**: Confirm the widget launcher is positioned at the correct coordinates on desktop and mobile.

**Desktop Verification (viewport > 768px)**:
1. Open production site on desktop: https://www.event-flow.co.uk
2. Open Browser DevTools (F12)
3. Go to Console tab
4. Look for the diagnostics output:
   ```
   📊 JadeAssist Widget Diagnostics:
      Root element: { position: "fixed", bottom: "80px", left: "24px", right: "auto" }
      Shadow container: { position: "fixed", bottom: "80px", left: "24px", right: "auto" }
   ```

**Expected Values (Desktop)**:
- `bottom`: `80px` (5rem = 80px)
- `left`: `24px` (1.5rem = 24px)
- `right`: `auto` (should not be positioned from right)
- `position`: `fixed`

**Mobile Verification (viewport ≤ 768px)**:
1. Open production site: https://www.event-flow.co.uk
2. Open Browser DevTools (F12)
3. Enable responsive design mode (Ctrl+Shift+M or Cmd+Shift+M)
4. Set viewport to 375px width (iPhone SE/8 size)
5. Check Console for diagnostics

**Expected Values (Mobile)**:
- `bottom`: `72px` (4.5rem = 72px)
- `left`: `16px` (1rem = 16px)
- `right`: `auto`
- `position`: `fixed`

**Visual Check**:
- Widget launcher should be on the LEFT side of screen
- Back-to-top button should be on the RIGHT side of screen
- Both should be at the SAME HEIGHT (vertically aligned)

**Method B: Elements Tab**
1. Open Elements tab in DevTools
2. Find the `.jade-widget-root` element
3. Check computed styles:
   - Click on the element
   - Go to "Computed" tab
   - Look for `position`, `bottom`, `left`, `right`

**What if it fails?**:
- If widget is on the right side: Shadow DOM positioning didn't apply, check console for warnings
- If `⚠️ Widget root not found`: Widget failed to initialize
- If wrong values: Responsive CSS may not be applying correctly
- Try resizing browser window - positioning should update on resize

---

### 4. Verify Avatar Shows Correctly on Launcher

**Purpose**: Confirm the launcher button shows the custom PNG avatar (not default teal circle).

**Steps**:
1. Open production site: https://www.event-flow.co.uk
2. Look at the widget launcher button (bottom-left corner)
3. Should see the custom avatar image
4. Open Console tab and look for:
   ```
   ✅ Found avatar element with selector: [selector name]
   ✅ Applied custom avatar: /assets/images/jade-avatar.png
   ```

**Expected Result**:
- Launcher button shows the custom avatar PNG
- Not a solid teal/turquoise circle
- Image should be clear and not broken

**What if it fails?**:
- If you see a teal circle: Avatar didn't apply via shadow DOM
- Look for warnings in console:
  ```
  ⚠️ Widget root or shadow DOM not found, cannot apply avatar
  ⚠️ Could not find avatar image element in shadow DOM
  ```
- If you see these warnings: The widget library's shadow DOM structure may have changed
- Check if the avatar URL is correct in console logs
- Verify the image loads in Network tab

**Advanced Debug**:
1. Open Elements tab
2. Find `.jade-widget-root` element
3. Expand its shadow root (#shadow-root)
4. Look for `<img>` tag inside
5. Check if `src` attribute points to the correct avatar URL

---

### 5. Verify Chat is Closed on Initial Load

**Purpose**: Ensure the chat widget starts closed and doesn't auto-open.

**Steps**:
1. Open production site in an incognito/private window: https://www.event-flow.co.uk
2. Observe the widget when page loads
3. Should see only the launcher button (bottom-left)
4. Should NOT see the chat panel open
5. Check console for:
   ```
   JadeAssist chat ensured closed on load
   ```

**Expected Result**:
- Only the launcher button (avatar) is visible
- Chat panel is not visible
- Teaser bubble may appear after ~500ms (separate from chat)

**What if it fails?**:
- If chat opens automatically: The defensive close isn't working
- Check console for errors in the initialization
- Verify `JadeWidget.close()` is being called after init

---

### 6. Verify Console Diagnostics

**Purpose**: Review all diagnostic messages to ensure proper initialization.

**Steps**:
1. Open production site: https://www.event-flow.co.uk
2. Open Console tab (F12 → Console)
3. Clear console (trash icon)
4. Refresh page

**Expected Console Output** (in order):
```
JadeAssist avatar URL: /assets/images/jade-avatar.png
✅ JadeAssist avatar loaded successfully
JadeAssist widget initialized successfully
JadeAssist chat ensured closed on load
✅ Applied shadow DOM positioning: { bottom: "5rem", left: "1.5rem" }
✅ Found avatar element with selector: [selector]
✅ Applied custom avatar: /assets/images/jade-avatar.png
📊 JadeAssist Widget Diagnostics:
   Root element: { position: "fixed", bottom: "80px", left: "24px", right: "auto" }
   Shadow container: { position: "fixed", bottom: "80px", left: "24px", right: "auto" }
```

**Warnings You Might See** (non-critical):
```
⚠️ Could not apply shadow DOM positioning, relying on CSS fallback
```
This is OK if the positioning still looks correct - means CSS fallback is working.

**Errors to Watch For**:
```
❌ Failed to apply custom avatar after retry
⚠️ JadeAssist avatar failed to load. Check that the image exists at: [url]
⚠️ Widget root element (.jade-widget-root) not found in DOM
```
If you see these, something is wrong with initialization.

---

## Common Issues and Solutions

### Issue: Widget Not Appearing

**Symptoms**: No launcher button visible on page

**Diagnosis**:
1. Check Network tab for widget script: `jade-widget.js`
2. Should see request to `cdn.jsdelivr.net/gh/rhysllwydlewis/JadeAssist@...`
3. Status should be 200 OK

**Solutions**:
- If 404 or failed to load: CDN may be blocked or down
- If no request at all: Check HTML includes widget script tag
- Check console for: `JadeWidget not yet available, will retry...`
- If retry message persists: Widget library failed to load from CDN

---

### Issue: Default Teal Circle Shows Instead of Custom Avatar

**Symptoms**: Launcher shows solid teal/turquoise circle instead of PNG avatar

**Diagnosis**:
1. Check console for avatar application messages
2. Look for: `✅ Applied custom avatar` or warnings
3. Check Network tab for `jade-avatar.png` request

**Solutions**:
- If avatar fails to load (404): File not deployed to production
- If `⚠️ Could not find avatar image element`: Shadow DOM structure changed
- Try clearing browser cache and hard refresh (Ctrl+Shift+R)
- Verify init script version is .v2.js (has shadow DOM avatar support)

**Workaround**:
If avatar still doesn't apply, you may need to update the shadow DOM selectors in the init script to match the actual widget structure.

---

### Issue: Wrong Positioning

**Symptoms**: Widget appears in wrong position (e.g., bottom-right instead of bottom-left)

**Diagnosis**:
1. Check console diagnostics for position values
2. Look for: `📊 JadeAssist Widget Diagnostics`
3. Compare expected vs actual values

**Solutions**:
- If `right` is not "auto": Shadow DOM positioning didn't apply
- Check for warning: `⚠️ Widget root not found, cannot apply positioning`
- Verify `.jade-widget-root` exists in DOM (Elements tab)
- Try resizing browser window to trigger responsive positioning

**Workaround**:
If shadow DOM positioning fails, the CSS fallback should still apply. Check that `jade-custom-styles` exists in `<head>`.

---

### Issue: Widget Opens Automatically on Page Load

**Symptoms**: Chat panel is open when page loads (instead of just launcher)

**Diagnosis**:
1. Check console for: `JadeAssist chat ensured closed on load`
2. If missing, defensive close isn't working

**Solutions**:
- Check that `JadeWidget.close()` is called after init
- Verify no conflicting code calls `JadeWidget.open()` automatically
- Check for localStorage entries that might force open state

---

## Testing Different Pages

The widget should work consistently across all pages. Test these key pages:

1. **Homepage**: https://www.event-flow.co.uk/
2. **Category page**: https://www.event-flow.co.uk/category.html
3. **Search results**: https://www.event-flow.co.uk/search.html
4. **Supplier profile**: https://www.event-flow.co.uk/supplier.html
5. **Contact page**: https://www.event-flow.co.uk/contact.html

For each page, verify:
- [ ] Init script loads (Network tab)
- [ ] Widget appears
- [ ] Avatar is correct
- [ ] Positioning is correct
- [ ] Console diagnostics show success

---

## Browser Testing

Test in these browsers to ensure compatibility:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest) - especially on macOS/iOS
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

Shadow DOM and custom elements should work in all modern browsers.

---

## Responsive Testing

Test at these viewport sizes:

**Desktop**:
- [ ] 1920px width (large desktop)
- [ ] 1366px width (laptop)
- [ ] 1024px width (tablet landscape)

**Mobile**:
- [ ] 768px width (tablet portrait) - should switch to mobile positioning
- [ ] 375px width (iPhone SE/8)
- [ ] 390px width (iPhone 12/13)
- [ ] 360px width (Android)

At each size:
- [ ] Widget visible and accessible
- [ ] Positioning correct (check diagnostics)
- [ ] Avatar loads
- [ ] Doesn't overlap with other UI elements

---

## Performance Checks

**Widget Load Time**:
1. Open Network tab
2. Refresh page
3. Find `jade-widget.js` request
4. Check "Time" column

**Expected**: Should load in < 1 second on decent connection

**Avatar Load Time**:
1. Check `jade-avatar.png` in Network tab
2. Should be ~1.5 MB

**Expected**: Should load in < 2 seconds on decent connection

**Optimization Note**: If avatar loads slowly, consider:
- Optimizing PNG (reducing size while maintaining quality)
- Using WebP format with PNG fallback
- Adding CDN for assets

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Test locally with production-like setup
- [ ] Verify all HTML files reference `jadeassist-init.v2.js`
- [ ] Confirm `jade-avatar.png` exists in `public/assets/images/`
- [ ] Run integration tests: `npm run test:integration`
- [ ] Test in multiple browsers locally
- [ ] Deploy to staging first (if available)
- [ ] Verify on staging with this checklist
- [ ] Deploy to production
- [ ] Verify on production with this checklist
- [ ] Monitor console errors in production (use error tracking tool if available)

---

## Rollback Plan

If the widget breaks in production:

1. **Quick fix**: Revert to previous version
   ```bash
   git revert [commit-sha]
   git push origin main
   ```

2. **Temporary disable**: Comment out widget script tags in HTML
   ```html
   <!-- Temporarily disabled
   <script src="https://cdn.jsdelivr.net/..."></script>
   <script src="/assets/js/jadeassist-init.v2.js"></script>
   -->
   ```

3. **Investigate**: Use this checklist to diagnose the issue
4. **Fix and redeploy**: Once fixed, test thoroughly and redeploy

---

## Contact and Support

If you encounter issues not covered in this guide:

1. Check console output for error messages
2. Review the main documentation: `docs/jadeassist-widget.md`
3. Check widget library repository: https://github.com/rhysllwydlewis/JadeAssist
4. Review recent commits to init scripts: `git log --follow public/assets/js/jadeassist-init.v2.js`

---

## Appendix: Understanding the Widget Architecture

### Shadow DOM

The widget uses Shadow DOM (web component) which creates an isolated DOM tree. This means:
- Widget styles don't leak to page
- Page styles don't affect widget
- Need special methods to access/modify widget internals

### Init Script Architecture

The init scripts (`jadeassist-init.v2.js` and `jadeassist-init.js`) do:

1. **Wait for widget to load** (retry logic)
2. **Initialize with config** (colors, avatar URL, positioning)
3. **Apply shadow DOM fixes**:
   - Set positioning directly on shadow container
   - Set avatar image source
4. **Add fallback CSS** (in case shadow DOM manipulation fails)
5. **Defensive close** (ensure chat starts closed)
6. **Add diagnostics** (console logging for debugging)
7. **Show teaser** (if not recently dismissed)

### Why Two Scripts?

- `jadeassist-init.v2.js`: Current version, used by all pages
- `jadeassist-init.js`: Legacy version, kept for backwards compatibility

Both are kept in sync. Future updates should modify both files.

---

**Last Updated**: January 2026
**Version**: 2.0 (Shadow DOM support)
