# Frontend Script Loading Strategy

## Principles

1. All scripts use `defer` attribute (not `async`)
2. Scripts load in dependency order
3. Page-specific scripts load last
4. No inline scripts that depend on deferred scripts

## Loading Phases

### Phase 1: Utilities

Core utilities with no dependencies:

- `utils/logger.js` - Logging service
- `utils/api-client.js` - API wrapper

### Phase 2: Error Handling

Must load before components:

- `utils/global-error-handler.js` - Global error boundary

### Phase 3: Components

Reusable UI components:

- `components/LoadingSpinner.js`
- `components/ErrorBoundary.js`
- `components.js` - Component library

### Phase 4: Features

Feature modules (can load in parallel):

- `animations.js`
- `notifications.js`
- `websocket-client.js`

### Phase 5: Page Initialization

Page-specific initialization:

- `pages/index-init.js`
- `pages/dashboard-init.js`
- etc.

## Migration Checklist

- [ ] Remove `async` attributes
- [ ] Add `defer` to all scripts
- [ ] Order scripts by dependency
- [ ] Move inline scripts to separate files
- [ ] Test page load order

## Example

```html
<!-- Good -->
<script src="/assets/js/utils/api-client.js" defer></script>
<script src="/assets/js/components.js" defer></script>
<script src="/assets/js/pages/dashboard-init.js" defer></script>

<!-- Bad -->
<script src="/assets/js/pages/dashboard-init.js" async></script>
<script src="/assets/js/components.js" async></script>
<script src="/assets/js/utils/api-client.js" async></script>
```

## Why defer over async?

### `defer` (Recommended)

- Scripts execute in order after DOM is parsed
- Preserves dependency chain
- Predictable execution order
- Best for scripts with dependencies

### `async` (Not Recommended)

- Scripts execute as soon as downloaded
- Order is unpredictable
- Can cause race conditions
- Only use for truly independent scripts (e.g., analytics)

## Standard Script Loading Pattern

Apply this pattern to all HTML pages:

```html
<!-- PHASE 1: Critical utilities (load first, no dependencies) -->
<script src="/assets/js/utils/logger.js" defer></script>
<script src="/assets/js/utils/api-client.js" defer></script>

<!-- PHASE 2: Error boundary (must load before other components) -->
<script src="/assets/js/utils/global-error-handler.js" defer></script>

<!-- PHASE 3: Core components (depend on utilities) -->
<script src="/assets/js/components/LoadingSpinner.js" defer></script>
<script src="/assets/js/components/ErrorBoundary.js" defer></script>
<script src="/assets/js/components.js" defer></script>

<!-- PHASE 4: Feature-specific (can load in parallel) -->
<script src="/assets/js/animations.js" defer></script>
<script src="/assets/js/notifications.js" defer></script>
<script src="/assets/js/websocket-client.js" defer></script>

<!-- PHASE 5: Page-specific initialization (loads last) -->
<script src="/assets/js/pages/[page-name]-init.js" defer></script>
```

## Common Patterns by Page Type

### Homepage/Public Pages

```html
<script src="/assets/js/utils/api-client.js" defer></script>
<script src="/assets/js/utils/global-error-handler.js" defer></script>
<script src="/assets/js/components/LoadingSpinner.js" defer></script>
<script src="/assets/js/animations.js" defer></script>
```

### Dashboard Pages

```html
<script src="/assets/js/utils/api-client.js" defer></script>
<script src="/assets/js/utils/global-error-handler.js" defer></script>
<script src="/assets/js/components/LoadingSpinner.js" defer></script>
<script src="/assets/js/components.js" defer></script>
<script src="/assets/js/notifications.js" defer></script>
<script src="/assets/js/websocket-client.js" defer></script>
<script src="/assets/js/dashboard-widgets.js" defer></script>
```

### Admin Pages

```html
<script src="/assets/js/utils/api-client.js" defer></script>
<script src="/assets/js/utils/global-error-handler.js" defer></script>
<script src="/assets/js/components/LoadingSpinner.js" defer></script>
<script src="/assets/js/components.js" defer></script>
<script src="/assets/js/admin-shared.js" defer></script>
<script src="/assets/js/admin-navbar.js" defer></script>
```

## Troubleshooting

### "X is not defined" errors

- Check that the script defining X loads before the script using X
- Verify all scripts have `defer` attribute
- Check browser console for load order

### Scripts not executing

- Verify file paths are correct
- Check that scripts are properly closed with `</script>`
- Look for syntax errors in browser console

### Race conditions

- Replace `async` with `defer`
- Ensure dependent scripts load in correct order
- Use DOMContentLoaded event if needed

## Performance Considerations

- **defer** doesn't block HTML parsing (good for performance)
- Scripts still download in parallel (fast)
- Execution happens in order after DOM ready (predictable)
- No need for complex dependency management

## Testing Script Load Order

Add to any page temporarily to verify load order:

```html
<script defer>
  document.addEventListener('DOMContentLoaded', () => {
    console.log('All deferred scripts loaded, DOM ready');
  });
</script>
```

## Notes

- This strategy was implemented in Phase 2 of Production Readiness
- All pages should follow this pattern for consistency
- New pages should use this pattern from the start
- Report any issues or inconsistencies to the development team
