# EventFlow Wizard - Visual Design Reference

## Liquid Glass Effect

The wizard uses a modern "liquid glass" or "glassmorphism" design pattern with frosted glass backgrounds.

### Core Glass Card

```css
.wizard-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px) saturate(180%);
  -webkit-backdrop-filter: blur(10px) saturate(180%);
  border: 1px solid rgba(11, 128, 115, 0.1);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(11, 128, 115, 0.08);
}
```

**Visual Effect:**

- Semi-transparent white background (95% opacity)
- 10px blur effect on content behind
- Subtle teal-tinted border
- Soft shadow with EventFlow green tint
- 16px rounded corners

## Progress Indicator

### Step Circles

```css
.wizard-step-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wizard-step-circle.completed {
  background: #0b8073;
  border-color: #0b8073;
  color: white;
}

.wizard-step-circle.current {
  background: white;
  border-color: #0b8073;
  border-width: 3px;
  box-shadow: 0 0 0 4px rgba(11, 128, 115, 0.1);
}
```

**Visual Appearance:**

```
○ ─ ● ─ ● ─ ○ ─ ○ ─ ○
   completed current upcoming
```

### Progress Bar with Shimmer

```css
.wizard-progress-bar {
  background: linear-gradient(90deg, #0b8073 0%, #13b6a2 100%);
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.wizard-progress-bar::after {
  content: '';
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmer 2s infinite;
}
```

**Animation:**

- Smooth gradient from dark to light green
- White shimmer effect sliding across
- 600ms smooth width transition

## Event Type Cards

### Selected State with Checkmark

```css
.wizard-option.selected {
  border-color: #0b8073;
  border-width: 3px;
  background: rgba(240, 253, 249, 0.98);
  box-shadow: 0 0 0 4px rgba(11, 128, 115, 0.1);
}

.wizard-option.selected::after {
  content: '✓';
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 28px;
  height: 28px;
  background: #0b8073;
  color: white;
  border-radius: 50%;
}
```

**Visual:**

```
┌─────────────────┐
│        ✓       │
│                 │
│       💒       │
│                 │
│    Wedding      │
└─────────────────┘
  3px green border
  with outer glow
```

### Hover Effect

```css
.wizard-option:hover {
  border-color: #13b6a2;
  background: rgba(240, 253, 249, 0.95);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(11, 128, 115, 0.15);
}

.wizard-option:hover .wizard-option-image {
  transform: scale(1.08);
}
```

**Animation:**

- Lifts up 4px on hover
- Larger, softer shadow
- Image zooms in 8%
- 300ms smooth transition

## Form Validation

### Valid Field

```css
.form-row.valid input {
  border-color: #10b981;
  padding-right: 2.5rem;
}

.form-row.valid::after {
  content: '✓';
  position: absolute;
  right: 1rem;
  top: 2.75rem;
  color: #10b981;
  font-weight: 700;
}
```

**Visual:**

```
┌──────────────────┐
│ Sarah & John's Wed│ ✓
└──────────────────┘
  Green border with checkmark
```

### Error Field

```css
.form-row.error input {
  border-color: #ef4444;
  padding-right: 2.5rem;
}

.form-row.error::after {
  content: '✕';
  position: absolute;
  right: 1rem;
  top: 2.75rem;
  color: #ef4444;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-4px);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(4px);
  }
}

.form-row.error input {
  animation: shake 0.5s;
}
```

**Visual:**

```
┌──────────────────┐
│                  │ ✕
└──────────────────┘
⚠ Please enter a valid date

  Red border, X icon, shake animation
```

## Success Screen

### Confetti Animation

```css
.wizard-confetti {
  position: fixed;
  width: 10px;
  height: 10px;
  background: #0b8073;
  animation: confetti-fall 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

@keyframes confetti-fall {
  to {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0;
  }
}
```

**Animation:**

- 30 particles in EventFlow colors
- Fall and rotate over 3 seconds
- Staggered start times (0-1.5s)
- Random horizontal positions

### Success Card

```css
.wizard-success {
  text-align: center;
  padding: 3rem 2rem;
}

.wizard-success-icon {
  font-size: 4rem;
  animation: celebrate 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s backwards;
}

@keyframes celebrate {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
```

**Visual:**

```
        🎉
     (bounces in)

  Congratulations!

  Your event plan has
  been created...

  ┌─────────────────┐
  │ Browse Suppliers│
  └─────────────────┘
```

## Buttons

### Primary Button (Gradient)

```css
.cta:not(.secondary) {
  background: linear-gradient(135deg, #0b8073 0%, #13b6a2 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(11, 128, 115, 0.2);
  padding: 0.875rem 1.75rem;
  border-radius: 10px;
}

.cta:not(.secondary):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(11, 128, 115, 0.3);
}
```

**Visual:**

```
┌─────────────────┐
│   Continue →    │  (gradient green)
└─────────────────┘
     ↓ hover
┌─────────────────┐
│   Continue →    │  (lifted, larger shadow)
└─────────────────┘
```

### Ripple Effect

```css
.cta::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  transform: translate(-50%, -50%);
}

.cta:active::after {
  width: 200%;
  height: 200%;
  transition: 0s;
}
```

**Animation:**

- White ripple expands from click point
- Smooth circular expansion
- Fades out after click

## Mobile Optimizations

### Touch-Friendly Targets

```css
@media (hover: none) and (pointer: coarse) {
  .wizard-option,
  .wizard-package-card,
  .wizard-actions button {
    min-height: 44px;
  }

  .wizard-option:hover {
    transform: none;
  }

  .wizard-option.selected {
    border-width: 3px;
    box-shadow: 0 0 0 4px rgba(11, 128, 115, 0.15);
  }
}
```

**Adjustments:**

- Minimum 44px touch targets
- Remove hover animations on touch devices
- Stronger selected state (thicker border)
- Better visual feedback for selection

### Single Column Layout

```css
@media (max-width: 768px) {
  .wizard-options {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .wizard-actions {
    flex-direction: column-reverse;
    gap: 0.75rem;
  }

  .wizard-actions button {
    width: 100%;
    min-height: 48px;
  }
}
```

**Mobile Layout:**

```
┌─────────────────┐
│     💒          │
│   Wedding       │
└─────────────────┘
┌─────────────────┐
│     💼          │
│  Corporate      │
└─────────────────┘
┌─────────────────┐
│     🎂          │
│   Birthday      │
└─────────────────┘
┌─────────────────┐
│   Continue →    │  (primary on top)
└─────────────────┘
┌─────────────────┐
│      Back       │  (secondary below)
└─────────────────┘
```

## Color Palette

### Primary Colors

```css
--primary-dark: #0b8073; /* EventFlow Green Dark */
--primary-light: #13b6a2; /* EventFlow Green Light */
--primary-gradient: linear-gradient(135deg, #0b8073 0%, #13b6a2 100%);
```

### Semantic Colors

```css
--success: #10b981; /* Green */
--error: #ef4444; /* Red */
--warning: #f59e0b; /* Amber */
--info: #3b82f6; /* Blue */
```

### Neutrals

```css
--text-primary: #0b1220; /* Near black */
--text-secondary: #374151; /* Dark gray */
--text-muted: #667085; /* Medium gray */
--border: #e5e7eb; /* Light gray */
--background: #f9fafb; /* Off white */
```

### Glass Effects

```css
--glass-bg: rgba(255, 255, 255, 0.95);
--glass-border: rgba(11, 128, 115, 0.1);
--glass-shadow: 0 8px 32px rgba(11, 128, 115, 0.08);
```

## Typography Scale

```css
/* Headlines */
h1: 2.5rem (40px) - Welcome screen
h2: 1.75rem (28px) - Step titles
h3: 1.125rem (18px) - Section headers

/* Body */
Body: 1rem (16px) - Main text
Small: 0.875rem (14px) - Helper text
Tiny: 0.8125rem (13px) - Metadata

/* Weights */
Regular: 400
Medium: 500
Semibold: 600
Bold: 700
```

## Spacing System

```css
/* Padding/Margin Scale */
xs:   0.25rem (4px)
sm:   0.5rem (8px)
md:   0.75rem (12px)
base: 1rem (16px)
lg:   1.5rem (24px)
xl:   2rem (32px)
2xl:  3rem (48px)

/* Common Uses */
Card padding: 2rem (32px) desktop, 1.5rem (24px) mobile
Button padding: 0.875rem 1.75rem (14px 28px)
Input padding: 0.75rem 1rem (12px 16px)
Gap between elements: 1rem-1.5rem (16px-24px)
```

## Border Radius

```css
/* Radius Scale */
sm:   4px - Small elements, badges
md:   8px - Input fields
lg:   10px - Buttons
xl:   12px - Small cards
2xl:  16px - Large cards
full: 9999px - Pills, circles
```

## Shadows

```css
/* Shadow Scale */
sm: 0 1px 2px rgba(0, 0, 0, 0.05);
base: 0 2px 8px rgba(11, 128, 115, 0.1);
md: 0 4px 16px rgba(11, 128, 115, 0.15);
lg: 0 8px 24px rgba(11, 128, 115, 0.2);
xl: 0 12px 32px rgba(11, 128, 115, 0.25);
```

## Animation Timing

```css
/* Duration */
fast: 150ms - Micro-interactions
base: 300ms - Standard transitions
slow: 400ms - Step changes

/* Easing */
ease-out: cubic-bezier(0, 0, 0.2, 1)
ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
spring: cubic-bezier(0.68, -0.55, 0.265, 1.55)
```

## Accessibility Features

### Focus Indicators

```css
*:focus-visible {
  outline: 3px solid #0b8073;
  outline-offset: 2px;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### High Contrast

```css
@media (prefers-contrast: high) {
  .wizard-card,
  .wizard-option {
    backdrop-filter: none;
    background: white;
    border: 2px solid currentColor;
  }
}
```

---

## Implementation Notes

1. **Backdrop Filter Support**: Falls back to solid backgrounds in unsupported browsers
2. **GPU Acceleration**: Use `transform: translateZ(0)` and `will-change: transform`
3. **Touch Detection**: Use `(hover: none) and (pointer: coarse)` media query
4. **Color Contrast**: All text meets WCAG AA (4.5:1 ratio minimum)
5. **Animation Performance**: Use transforms and opacity for 60fps animations

---

This visual reference demonstrates the key design patterns used throughout the EventFlow wizard redesign.
