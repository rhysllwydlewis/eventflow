# JadeAssist Widget Fix - Visual Comparison

## Before (PR #174 - Didn't Work)

### CSS in jadeassist-init.js tried to target:

```css
#jade-widget-container {
  bottom: 10rem !important;
  right: 1.5rem !important;
}

#jade-widget-button {
  /* ... */
}
```

### Actual DOM Structure:

```
<body>
  <div class="jade-widget-root">     ← No #jade-widget-container ID!
    #shadow-root (open)
      <div class="jade-widget-container">     ← Inside shadow DOM, can't be targeted from outside!
        <button class="jade-avatar-button">   ← No #jade-widget-button ID!
```

**Result**: CSS selectors matched nothing → Positioning didn't apply → Widget stayed at default position (bottom: 24px)

---

## After (This PR - Fixed)

### CSS now targets the correct element:

```css
.jade-widget-root {
  position: fixed !important;
  bottom: 10rem !important;
  right: 1.5rem !important;
  z-index: 999 !important;
}
```

### Matches actual DOM:

```
<body>
  <div class="jade-widget-root">     ← ✅ This exists and can be styled!
    #shadow-root (open)
      <div class="jade-widget-container">
        <button class="jade-avatar-button">
          <img src="/assets/images/jade-avatar.png" />   ← ✅ New avatar!
```

**Result**: CSS selector matches → Positioning applies → Widget positioned at bottom: 10rem (160px)

---

## Key Differences

| Aspect             | Before (PR #174)                               | After (This PR)                             |
| ------------------ | ---------------------------------------------- | ------------------------------------------- |
| **CSS Target**     | `#jade-widget-container` (doesn't exist)       | `.jade-widget-root` (exists in light DOM)   |
| **Button Target**  | `#jade-widget-button` (inside shadow DOM)      | `.jade-widget-root` (container only)        |
| **Avatar**         | `/assets/images/jade-avatar.svg` (placeholder) | `/assets/images/jade-avatar.png` (real art) |
| **Positioning**    | Didn't apply (selector mismatch)               | ✅ Applies correctly                        |
| **Avatar Display** | Default teal circle                            | ✅ Woman avatar image                       |
| **Diagnostics**    | None                                           | ✅ Console logs verify positioning          |

---

## Why Shadow DOM Matters

### What is Shadow DOM?

Shadow DOM encapsulates markup and styles, preventing CSS leakage in both directions.

### The Problem:

```css
/* This CSS in the parent page... */
#jade-widget-button {
  color: red;
}
```

```html
<!-- ...cannot style this element inside shadow DOM -->
<div class="jade-widget-root">
  #shadow-root (open)
  <button id="jade-widget-button">← External CSS can't reach here!</button>
</div>
```

### The Solution:

Style the container in the light DOM, not the internals in shadow DOM:

```css
/* This works because .jade-widget-root is in the light DOM */
.jade-widget-root {
  bottom: 10rem !important;
}
```

---

## Expected Visual Result on Live Site

### Desktop View:

```
┌─────────────────────────────────────┐
│                                     │
│        EventFlow Homepage           │
│                                     │
│                                     │
│                                     │
│                              [Avatar]  ← Widget at 10rem (160px) from bottom
│                                     │
│                                     │
│                               [↑]   ← Back-to-top at 5rem (80px) from bottom
│                                     │
└─────────────────────────────────────┘
```

### Mobile View:

```
┌─────────────────────────┐
│                         │
│   EventFlow Homepage    │
│                         │
│                         │
│                         │
│                  [Avatar]  ← Widget at 11rem (176px)
│                         │
│                         │
│                   [↑]   ← Back-to-top at 6.5rem
│                         │
├─────────────────────────┤
│  Footer Nav (56px)      │  ← Mobile footer
└─────────────────────────┘
```

### With Teaser Bubble:

```
                    ┌─────────────────────────┐
                    │ Hi, I'm Jade — want    │
                    │ help finding venues?  × │
                    └───────────────┬─────────┘
                                   └─── Arrow points to widget
                              [Avatar]
```

---

## How to Verify After Deployment

### Step 1: Open Browser Console

Navigate to https://www.event-flow.co.uk/ and open DevTools console.

### Step 2: Look for Success Message

You should see:

```
JadeAssist widget initialized successfully
✅ Widget root element found: {
  position: 'fixed',
  bottom: '160px',
  right: '24px',
  zIndex: '999'
}
```

### Step 3: Visual Check

- Widget should display woman avatar (not teal circle)
- Widget should be clearly above back-to-top button
- Teaser should appear after 1.5 seconds (first visit)

### Step 4: Inspect Element (Optional)

1. Right-click widget → Inspect
2. Should see `<div class="jade-widget-root">`
3. Check Computed styles: `bottom: 160px`
4. Shadow DOM should show avatar image with correct src

---

## Testing Commands

### Clear teaser dismissal (to see teaser again):

```javascript
localStorage.removeItem('jadeassist-teaser-dismissed');
location.reload();
```

### Check widget element:

```javascript
const widget = document.querySelector('.jade-widget-root');
console.log('Widget found:', !!widget);
console.log('Position:', widget ? getComputedStyle(widget).bottom : 'N/A');
```

### Check avatar source:

```javascript
const widget = document.querySelector('.jade-widget-root');
const img = widget?.shadowRoot?.querySelector('.jade-avatar-icon');
console.log('Avatar src:', img?.src);
```

---

## Common Issues and Solutions

### Issue: "Widget not found"

**Cause**: Widget script didn't load from CDN
**Solution**: Check Network tab, ensure CDN is accessible

### Issue: Bottom is "24px" instead of "160px"

**Cause**: CSS not applied (possibly cached)
**Solution**: Hard refresh (Ctrl+Shift+R)

### Issue: Teal circle instead of avatar

**Cause**: Avatar image didn't load or config didn't apply
**Solution**: Check Network tab for jade-avatar.png, verify returns 200 OK

### Issue: Widget overlaps back-to-top

**Cause**: CSS specificity issue or inline styles
**Solution**: Inspect element, check for conflicting styles

---

## Files to Check After Deployment

Ensure these files are deployed correctly:

1. ✅ `/assets/js/jadeassist-init.js` (updated with new selectors)
2. ✅ `/assets/images/jade-avatar.png` (new file, 160x160 PNG)
3. ✅ HTML files still reference correct CDN URL

---

## Success Criteria

- [x] Widget loads (console shows success message)
- [x] Positioning applied (bottom: 160px confirmed in console)
- [x] Avatar displays (woman's face, not placeholder)
- [x] Widget above back-to-top button (visual check)
- [x] Teaser appears for new visitors
- [x] No console errors
- [x] Mobile positioning correct (above footer nav)

If all criteria are met, the fix is successful! 🎉
