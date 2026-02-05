# Notification System - Visual Design Specification

## Glassmorphism / Liquid Glass Theme

### Color Palette

#### Success Notification (Green)

```
Background: rgba(255, 255, 255, 0.75) + blur(12px)
Border: 1px solid rgba(255, 255, 255, 0.3)
Glow: 0 8px 32px rgba(16, 185, 129, 0.25)
Icon Bubble: rgba(16, 185, 129, 0.15)
Icon Color: #10b981 (Emerald)
```

#### Error Notification (Red)

```
Background: rgba(255, 255, 255, 0.75) + blur(12px)
Border: 1px solid rgba(255, 255, 255, 0.3)
Glow: 0 8px 32px rgba(239, 68, 68, 0.25)
Icon Bubble: rgba(239, 68, 68, 0.15)
Icon Color: #ef4444 (Red)
Special: Shake animation on appear
```

#### Warning Notification (Amber)

```
Background: rgba(255, 255, 255, 0.75) + blur(12px)
Border: 1px solid rgba(255, 255, 255, 0.3)
Glow: 0 8px 32px rgba(245, 158, 11, 0.25)
Icon Bubble: rgba(245, 158, 11, 0.15)
Icon Color: #f59e0b (Amber)
```

#### Info Notification (Blue)

```
Background: rgba(255, 255, 255, 0.75) + blur(12px)
Border: 1px solid rgba(255, 255, 255, 0.3)
Glow: 0 8px 32px rgba(59, 130, 246, 0.25)
Icon Bubble: rgba(59, 130, 246, 0.15)
Icon Color: #3b82f6 (Blue)
```

### Dark Mode

All notifications automatically adjust in dark mode:

```
Background: rgba(30, 41, 59, 0.75) + blur(12px)
Border: 1px solid rgba(255, 255, 255, 0.2)
Text Color: rgba(255, 255, 255, 0.95)
```

### Layout Structure

```
┌─────────────────────────────────────────────┐
│  ╭──╮  This is a notification message       ×│
│  │✓ │  with glassmorphism styling          │
│  ╰──╯                                        │
└─────────────────────────────────────────────┘
  Icon    Message Content              Close
 Bubble                                Button
```

### Dimensions

**Desktop:**

- Max Width: 420px
- Padding: 16px 18px
- Border Radius: 16px
- Gap between elements: 14px
- Icon Bubble: 36px × 36px
- Close Button: 28px × 28px

**Mobile (< 640px):**

- Width: calc(100vw - 20px)
- Padding: 14px 16px
- Border Radius: 16px
- Icon Bubble: 32px × 32px
- Font Size: 13px

### Positioning

```
Fixed Position: top: 20px, right: 20px
Z-index: 10000
Flex Direction: column
Gap: 12px

Mobile:
  top: 10px, right: 10px, left: 10px
```

### Animations

#### 1. Slide In (300ms cubic-bezier)

```
From: transform: translateX(450px), opacity: 0
To:   transform: translateX(0), opacity: 1
```

#### 2. Slide Out (300ms cubic-bezier)

```
From: transform: translateX(0), opacity: 1
To:   transform: translateX(450px), opacity: 0
```

#### 3. Shake (Error only, 500ms)

```
Keyframes:
  0%, 100%: translateX(0)
  10%, 30%, 50%, 70%, 90%: translateX(-4px)
  20%, 40%, 60%, 80%: translateX(4px)
```

### Typography

```
Font Family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif
Font Size: 14px (desktop), 13px (mobile)
Line Height: 1.5
Font Weight: 500 (medium)
Color: #1f2937 (light mode), rgba(255,255,255,0.95) (dark mode)
```

### Icon Design

Icons are inline SVG with:

- Width: 20px
- Height: 20px
- Stroke Width: 2.5px
- Stroke Linecap: round
- Stroke Linejoin: round

Icons used:

- ✓ Success: Check circle
- ✗ Error: X circle
- ⚠ Warning: Alert triangle
- ℹ Info: Info circle

### Visual Examples (ASCII Art)

#### Success Notification

```
╔═══════════════════════════════════════════════╗
║  ╭──────╮                                      ║
║  │  ✓   │  Operation completed successfully!  ×║
║  ╰──────╯                                      ║
╚═══════════════════════════════════════════════╝
   Green glow around entire card
```

#### Error Notification (with shake)

```
╔═══════════════════════════════════════════════╗
║  ╭──────╮                                      ║
║  │  ✗   │  An error occurred. Try again.     ×║
║  ╰──────╯                                      ║
╚═══════════════════════════════════════════════╝
   Red glow + gentle shake on appear
```

#### Multiple Notifications Stack

```
╔═══════════════════════════════════════════════╗
║  ╭──╮  Info message here                     ×║
╚═══════════════════════════════════════════════╝
        ↓ 12px gap
╔═══════════════════════════════════════════════╗
║  ╭──╮  Success message here                  ×║
╚═══════════════════════════════════════════════╝
        ↓ 12px gap
╔═══════════════════════════════════════════════╗
║  ╭──╮  Warning message here                  ×║
╚═══════════════════════════════════════════════╝

Maximum 5 notifications visible
Oldest auto-dismissed when limit reached
```

### Backdrop Filter Effect

The glassmorphism effect is achieved through CSS backdrop-filter:

```css
.ef-notification {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

**Result:** Content behind the notification is blurred, creating a frosted glass effect.

**Browser Support:**

- Chrome/Edge: Full support
- Firefox: Full support (91+)
- Safari: Full support (with -webkit- prefix)
- Fallback: Solid background for unsupported browsers

### Accessibility

#### ARIA Attributes

```html
<div role="region" aria-label="Notifications" aria-live="polite">
  <div role="alert" aria-atomic="true">
    <!-- Notification content -->
  </div>
</div>
```

#### Keyboard Navigation

- Tab: Focus close button
- Enter/Space: Close notification
- Escape: Close notification (when focused)

#### Screen Reader

- Announces notification when it appears
- Reads full message content
- Indicates notification type

### Performance

**CSS Optimizations:**

- GPU acceleration via `transform`
- Hardware acceleration via `backdrop-filter`
- Minimal reflows/repaints
- Efficient CSS transitions

**JavaScript Optimizations:**

- Lazy container creation
- Efficient DOM operations
- Proper event listener cleanup
- Notification limit prevents DOM bloat

### Testing the Design

To see the glassmorphism effect in action:

1. Navigate to `/test-notifications.html`
2. Place some content behind the notification area (colorful background)
3. Trigger notifications
4. Observe the blur effect through the notification

---

**Design Version:** 2.0.0  
**Theme:** Liquid Glass / Glassmorphism  
**Design System:** EventFlow Design Language  
**Created:** February 5, 2026
