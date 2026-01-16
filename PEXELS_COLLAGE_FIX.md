# Pexels Collage Overlay Fix

## Issue Description

When the Pexels collage feature was enabled via admin settings, the homepage hero collage showed:

1. **Default collage images remained visible underneath**
2. **Pink loading spinner overlaid on top** of the default images
3. **Pexels images didn't properly replace** the defaults when loaded

This created a confusing user experience where both default and Pexels imagery were visible simultaneously.

## Root Cause

The `initPexelsCollage()` function in `public/assets/js/pages/home-init.js` was:

1. Adding a `loading-pexels` CSS class that showed a spinner overlay
2. BUT the default images (loaded in HTML) remained visible underneath
3. When `imgElement.src` was set to a Pexels URL, the browser would load the new image while the old one was still visible

## Solution

### 1. Hide Default Images Immediately

When Pexels mode activates, immediately hide all default images:

```javascript
// Add loading states to frames and clear default images
collageFrames.forEach(frame => {
  frame.classList.add('loading-pexels');
  // Hide default images immediately when switching to Pexels mode
  const imgElement = frame.querySelector('img');
  if (imgElement) {
    // Store original src for fallback
    if (!imgElement.dataset.originalSrc) {
      imgElement.dataset.originalSrc = imgElement.src;
    }
    // Clear the image to prevent default from showing under loading state
    imgElement.style.opacity = '0';
  }
});
```

**Key Points:**

- Set `opacity: 0` to hide the image
- Store the original src in `dataset.originalSrc` for fallback
- Loading spinner is now visible without underlying image

### 2. Restore Opacity When Pexels Loads

Once a Pexels image successfully loads, restore visibility:

```javascript
if (imgElement && imageCache[category][0]) {
  imgElement.src = imageCache[category][0].url;
  imgElement.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - Photo by ${imageCache[category][0].photographer}`;

  // Restore opacity once Pexels image is set
  imgElement.style.opacity = '1';

  // Remove loading state
  frame.classList.remove('loading-pexels');

  // Add photographer attribution
  addPhotographerCredit(frame, imageCache[category][0]);
}
```

### 3. Comprehensive Fallback Handling

Three different fallback scenarios are handled:

#### A. Individual Frame Fallback

If some categories load but others don't:

```javascript
// Remove loading states from all frames
collageFrames.forEach(frame => {
  frame.classList.remove('loading-pexels');
  // Restore opacity for frames that didn't get Pexels images
  const imgElement = frame.querySelector('img');
  if (imgElement && imgElement.style.opacity === '0') {
    // Restore default image if Pexels didn't load
    if (imgElement.dataset.originalSrc) {
      imgElement.src = imgElement.dataset.originalSrc;
    }
    imgElement.style.opacity = '1';
  }
});
```

#### B. No Pexels Images Loaded

If no categories successfully load:

```javascript
} else {
  // Restore default images for all frames
  collageFrames.forEach(frame => {
    const imgElement = frame.querySelector('img');
    if (imgElement) {
      if (imgElement.dataset.originalSrc) {
        imgElement.src = imgElement.dataset.originalSrc;
      }
      imgElement.style.opacity = '1';
    }
  });
  // Fall back to loading static hero images
  await loadHeroCollageImages();
}
```

#### C. Complete Error

If an exception occurs during initialization:

```javascript
} catch (error) {
  // Remove loading states from all frames on error
  collageFrames.forEach(frame => {
    frame.classList.remove('loading-pexels');
    // Restore default images on error
    const imgElement = frame.querySelector('img');
    if (imgElement) {
      if (imgElement.dataset.originalSrc) {
        imgElement.src = imgElement.dataset.originalSrc;
      }
      imgElement.style.opacity = '1';
    }
  });
  // ... error logging and fallback
  await loadHeroCollageImages();
}
```

## User Experience Flow

### With Pexels Enabled ✅

1. Page loads with default images in HTML
2. JavaScript detects Pexels is enabled
3. Default images fade to opacity 0 immediately
4. Loading spinner shows on transparent background
5. Pexels images load in the background
6. Each image fades in (opacity 1) as it loads
7. Photographer credits appear

### With Pexels Disabled ✅

1. Page loads with default images
2. JavaScript checks settings
3. No Pexels initialization occurs
4. Default images remain visible
5. Normal static image loading continues

### If Pexels Fails ✅

1. Images hidden, loading spinner shows
2. API calls fail or timeout
3. Original images restored from `dataset.originalSrc`
4. Opacity restored to 1
5. Loading spinner removed
6. Fallback to static hero images
7. User sees default images (graceful degradation)

## Testing

### Manual Testing Steps

1. **Test with Pexels Enabled:**
   - Navigate to `/admin-settings.html`
   - Enable "Pexels Collage"
   - Navigate to homepage
   - Verify: No default images visible during loading
   - Verify: Loading spinner on clean background
   - Verify: Pexels images fade in smoothly

2. **Test with Pexels Disabled:**
   - Navigate to `/admin-settings.html`
   - Disable "Pexels Collage"
   - Navigate to homepage
   - Verify: Default images load normally
   - Verify: No loading spinner appears

3. **Test Pexels Failure:**
   - Enable Pexels but don't configure API key
   - Navigate to homepage
   - Verify: Loading spinner appears briefly
   - Verify: Default images restored after failure
   - Check console: Should see fallback messages (in dev mode)

### Automated Testing

Existing tests in `e2e/hero-collage-images.spec.js` verify:

- ✅ Images have src attributes
- ✅ All 4 frames present
- ✅ No console errors
- ✅ Onerror handlers present
- ✅ No 404 errors

## Browser Compatibility

The fix uses standard DOM APIs:

- `element.style.opacity` - Widely supported
- `element.dataset.originalSrc` - HTML5 data attributes (all modern browsers)
- No browser-specific code

## Performance Impact

**Minimal to None:**

- One additional property set per image (opacity)
- One dataset attribute per image (originalSrc)
- No additional network requests
- No additional event listeners
- Cleanup happens automatically when images load or fail

## Files Modified

- `public/assets/js/pages/home-init.js`
  - Lines 633-646: Hide and store original images
  - Lines 738-750: Restore opacity on success
  - Lines 760-772: Per-frame fallback
  - Lines 791-808: No-images fallback
  - Lines 809-829: Error fallback

## Related Documentation

- [PEXELS_INTEGRATION.md](./PEXELS_INTEGRATION.md) - Pexels API integration guide
- [PEXELS_ADVANCED_FEATURES.md](./PEXELS_ADVANCED_FEATURES.md) - Advanced Pexels features
- [HOME_PAGE_IMPROVEMENTS_SUMMARY.md](./HOME_PAGE_IMPROVEMENTS_SUMMARY.md) - Homepage enhancements

## Future Enhancements

Possible improvements for future iterations:

1. **Smooth Transitions:** Add CSS transitions for opacity changes
2. **Progressive Loading:** Show images one-by-one as they load
3. **Preloading:** Preload first Pexels image before hiding defaults
4. **Loading State UI:** Replace spinner with skeleton placeholders
5. **Error UI:** Show user-friendly error message if all images fail

## Conclusion

This fix ensures that when Pexels collage is enabled:

- ✅ Only one set of images is visible at a time (no overlay confusion)
- ✅ Loading state is clean and professional
- ✅ Fallback is reliable and automatic
- ✅ UX is smooth regardless of Pexels API status
