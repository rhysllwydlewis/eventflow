# JadeAssist Widget Enhancement Recommendations

Since EventFlow owns the JadeAssist widget repository, we can make improvements to both the widget and the integration.

## Immediate Improvements (This PR)

### 1. Add SRI (Subresource Integrity) Hash ✅

Since we own the repo, we should add integrity verification for security.

**Current (in index.html):**

```html
<script
  src="https://cdn.jsdelivr.net/gh/rhysllwydlewis/JadeAssist@ca1aecd6c8ce2c230400f1b0aadcc965285a1625/packages/widget/dist/jade-widget.js"
  defer
></script>
```

**Recommended (with SRI):**

```html
<script
  src="https://cdn.jsdelivr.net/gh/rhysllwydlewis/JadeAssist@ca1aecd6c8ce2c230400f1b0aadcc965285a1625/packages/widget/dist/jade-widget.js"
  integrity="sha384-[HASH_VALUE]"
  crossorigin="anonymous"
  defer
></script>
```

**To generate the hash:**

```bash
# Download the widget file
curl -sL "https://cdn.jsdelivr.net/gh/rhysllwydlewis/JadeAssist@ca1aecd6/packages/widget/dist/jade-widget.js" -o jade-widget.js

# Generate SHA-384 hash
cat jade-widget.js | openssl dgst -sha384 -binary | openssl base64 -A

# Or use sha256
cat jade-widget.js | openssl dgst -sha256 -binary | openssl base64 -A
```

**Benefits:**

- Prevents MITM attacks
- Ensures CDN hasn't been compromised
- Browsers will refuse to execute tampered scripts

---

## Future Widget Enhancements

Since we control the JadeAssist widget, we can add features to make positioning more flexible and reduce the need for external CSS overrides.

### 2. Add Position Configuration to Widget API

**Problem:** Currently, positioning is hardcoded in the widget's shadow DOM styles:

```typescript
// In styles.ts
.jade-widget-container {
  position: fixed;
  bottom: 24px;  // ← Hardcoded
  right: 24px;   // ← Hardcoded
  z-index: 999999;
}
```

**Proposed Enhancement:**

Add positioning options to `WidgetConfig`:

```typescript
// packages/widget/src/types.ts
export interface WidgetConfig {
  apiBaseUrl?: string;
  assistantName?: string;
  greetingText?: string;
  avatarUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;

  // NEW: Positioning options
  position?: {
    bottom?: string; // e.g., '160px' or '10rem'
    right?: string; // e.g., '24px' or '1.5rem'
    left?: string; // Alternative to right
    zIndex?: number; // Default 999999
  };
}

export const DEFAULT_CONFIG: Required<WidgetConfig> = {
  apiBaseUrl: '',
  assistantName: 'Jade',
  greetingText: "Hi! 👋 I'm Jade...",
  avatarUrl: '',
  primaryColor: '#0B8073',
  accentColor: '#13B6A2',
  fontFamily: '-apple-system, BlinkMacSystemFont...',

  // NEW: Default positioning
  position: {
    bottom: '24px',
    right: '24px',
    zIndex: 999999,
  },
};
```

**Update styles.ts to use config:**

```typescript
export function getWidgetStyles(
  primaryColor: string,
  accentColor: string,
  fontFamily: string,
  position: WidgetConfig['position'] // NEW parameter
): string {
  const bottom = position?.bottom || '24px';
  const right = position?.right;
  const left = position?.left;
  const zIndex = position?.zIndex || 999999;

  return `
    .jade-widget-container {
      position: fixed;
      bottom: ${bottom};
      ${right ? `right: ${right};` : ''}
      ${left ? `left: ${left};` : ''}
      z-index: ${zIndex};
    }
    // ... rest of styles
  `;
}
```

**EventFlow integration would become:**

```javascript
window.JadeWidget.init({
  primaryColor: '#00B2A9',
  accentColor: '#008C85',
  assistantName: 'Jade',
  greetingText: "Hi! I'm Jade. Ready to plan your event?",
  avatarUrl: '/assets/images/jade-avatar.png',

  // NEW: Custom positioning
  position: {
    bottom: '10rem', // Below back-to-top button
    right: '1.5rem',
    zIndex: 999,
  },
});
```

**Benefits:**

- No external CSS overrides needed
- Cleaner, more maintainable integration
- Widget controls its own positioning
- No !important rules needed
- Works even if shadow DOM structure changes

### 3. Add Mobile-Specific Positioning

Extend the config to handle responsive positioning:

```typescript
export interface WidgetConfig {
  // ... existing fields

  position?: {
    bottom?: string;
    right?: string;
    left?: string;
    zIndex?: number;

    // NEW: Mobile overrides
    mobile?: {
      bottom?: string;
      right?: string;
      left?: string;
    };
  };
}
```

**Usage:**

```javascript
window.JadeWidget.init({
  // ... other config
  position: {
    bottom: '10rem',
    right: '1.5rem',
    mobile: {
      bottom: '11rem', // Above mobile footer
      right: '1rem',
    },
  },
});
```

**Implementation in widget:**

```typescript
export function getWidgetStyles(...) {
  return `
    .jade-widget-container {
      position: fixed;
      bottom: ${position?.bottom || '24px'};
      right: ${position?.right || '24px'};
      z-index: ${position?.zIndex || 999999};
    }

    @media (max-width: 768px) {
      .jade-widget-container {
        ${position?.mobile?.bottom ? `bottom: ${position.mobile.bottom};` : ''}
        ${position?.mobile?.right ? `right: ${position.mobile.right};` : ''}
      }
    }
  `;
}
```

### 4. Add Safe Area Inset Support

Handle iOS notches/home indicators automatically:

```typescript
export interface WidgetConfig {
  position?: {
    // ... existing fields
    respectSafeArea?: boolean; // Default true
  };
}
```

**Implementation:**

```typescript
export function getWidgetStyles(...) {
  const safeArea = position?.respectSafeArea !== false;

  return `
    .jade-widget-container {
      position: fixed;
      bottom: ${position?.bottom || '24px'};
      right: ${position?.right || '24px'};
      z-index: ${position?.zIndex || 999999};
    }

    ${safeArea ? `
      @supports (padding: env(safe-area-inset-bottom)) {
        .jade-widget-container {
          bottom: calc(${position?.bottom || '24px'} + env(safe-area-inset-bottom));
        }
      }
    ` : ''}
  `;
}
```

### 5. Add CSS Custom Properties Support

Allow even more flexibility by exposing CSS variables:

```typescript
export function getWidgetStyles(...) {
  return `
    :host {
      --jade-position-bottom: ${position?.bottom || '24px'};
      --jade-position-right: ${position?.right || '24px'};
      --jade-position-z-index: ${position?.zIndex || 999999};
    }

    .jade-widget-container {
      position: fixed;
      bottom: var(--jade-position-bottom);
      right: var(--jade-position-right);
      z-index: var(--jade-position-z-index);
    }
  `;
}
```

This allows external CSS to override if needed:

```css
.jade-widget-root {
  --jade-position-bottom: 10rem !important;
}
```

---

## Recommended Implementation Plan

### Phase 1: Security (Immediate - This PR)

- [x] Fix CSS selectors in EventFlow to target `.jade-widget-root`
- [x] Add diagnostic logging
- [ ] Add SRI hash to script tag (once we can access the file)

### Phase 2: Widget Enhancement (Next Sprint)

- [ ] Add `position` config option to JadeAssist widget
- [ ] Add mobile-specific positioning support
- [ ] Add safe area inset support
- [ ] Release new version of JadeAssist widget
- [ ] Update EventFlow to use new positioning config

### Phase 3: Advanced Features (Future)

- [ ] Add CSS custom properties for maximum flexibility
- [ ] Add animation config (entrance, hover effects)
- [ ] Add accessibility config (high contrast, reduced motion)
- [ ] Add theming presets (light/dark mode)

---

## Current Workaround vs Future State

### Current (This PR - Workaround)

```javascript
// External CSS override (works but not ideal)
.jade-widget-root {
  position: fixed !important;
  bottom: 10rem !important;
  right: 1.5rem !important;
}
```

### Future (Widget Enhancement - Clean)

```javascript
// Widget API configuration (clean, maintainable)
window.JadeWidget.init({
  position: {
    bottom: '10rem',
    right: '1.5rem',
    mobile: { bottom: '11rem', right: '1rem' },
  },
});
```

---

## Benefits of Widget Enhancement

1. **No CSS Overrides**: Widget handles its own positioning
2. **Maintainable**: Changes in one place (config)
3. **Responsive**: Built-in mobile support
4. **Flexible**: Each integration can customize
5. **Encapsulated**: Respects shadow DOM architecture
6. **Future-Proof**: Widget updates won't break positioning

---

## Files to Modify in JadeAssist Repo

### In `packages/widget/src/types.ts`:

- Add `position` interface to `WidgetConfig`
- Update `DEFAULT_CONFIG` with default positioning

### In `packages/widget/src/styles.ts`:

- Add `position` parameter to `getWidgetStyles()`
- Use config values instead of hardcoded positioning
- Add responsive media queries if mobile config present
- Add safe area inset support

### In `packages/widget/src/widget.ts`:

- Pass position config to `getWidgetStyles()`
- Update constructor to accept position config

### In `packages/widget/README.md`:

- Document new positioning options
- Add examples for common use cases
- Migration guide from external CSS to config

---

## Migration Path for EventFlow

Once widget enhancements are released:

1. Update widget CDN URL to new version
2. Add position config to `jadeassist-init.js`
3. Remove external CSS overrides from `applyCustomStyles()`
4. Test on desktop and mobile
5. Update documentation

**Estimated effort:**

- Widget enhancements: 4-6 hours
- EventFlow migration: 1-2 hours
- Testing: 2-3 hours
- **Total: 1-2 days**

---

## Conclusion

Since EventFlow owns the JadeAssist widget:

**Short-term (This PR):**

- ✅ Fix CSS selectors to work with current widget
- ✅ Add avatar image
- ✅ Add diagnostics
- ⏳ Add SRI hash for security

**Long-term (Next Sprint):**

- Enhance JadeAssist widget with positioning config
- Remove CSS workarounds from EventFlow
- Cleaner, more maintainable solution

This approach gives us:

1. **Immediate fix** that works now
2. **Proper solution** for the future
3. **Better widget** for all users (not just EventFlow)
