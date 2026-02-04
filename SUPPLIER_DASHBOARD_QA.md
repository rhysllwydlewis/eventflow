# Supplier Dashboard Fixes - QA & Testing Guide

## Overview
This document provides comprehensive testing steps to verify all fixes implemented for the supplier dashboard issues.

## Test Environment Setup
1. Navigate to the supplier dashboard: `/dashboard-supplier.html`
2. Ensure you're logged in as a supplier user
3. Open browser DevTools (F12) to monitor console and network activity

---

## 1. WebSocket Reconnection & Backoff Testing

### Test Cases

#### TC1.1: Normal WebSocket Connection
**Steps:**
1. Load the supplier dashboard
2. Check browser console

**Expected Results:**
- ✅ No spam of connection messages
- ✅ Single "WebSocket connected" or minimal logging
- ✅ No immediate reconnection attempts if connection is successful

#### TC1.2: WebSocket Failure with Exponential Backoff
**Steps:**
1. Disable WebSocket server or block WSS endpoint
2. Load the supplier dashboard
3. Monitor console for reconnection attempts

**Expected Results:**
- ✅ Reconnection delays increase exponentially (3s, 6s, 12s, 24s, 30s)
- ✅ Jitter added to delays (delays vary slightly)
- ✅ Logging reduced (only every 3rd attempt logged)
- ✅ Maximum 5 reconnection attempts
- ✅ After max attempts, user sees toast notification: "Real-time notifications temporarily unavailable..."

#### TC1.3: WebSocket Fallback Notification
**Steps:**
1. After WebSocket max retries reached (or WebSocket unavailable)
2. Check for user-facing notification

**Expected Results:**
- ✅ Toast notification appears with info icon
- ✅ Message: "Real-time notifications temporarily unavailable. Refresh page to see new enquiries."
- ✅ Notification shown only once (not repeated)

---

## 2. Real-Time Fallback (Polling) Testing

### Test Cases

#### TC2.1: Messaging Polling Notification
**Steps:**
1. Navigate to messages section
2. Monitor for polling notification

**Expected Results:**
- ✅ Single toast notification: "Using polling for updates (refreshes every 5 seconds)"
- ✅ Notification shown only once per session
- ✅ No console.warn spam
- ✅ Messages refresh every 5 seconds

#### TC2.2: Ticketing Polling Notification
**Steps:**
1. Navigate to tickets section
2. Monitor for polling notification

**Expected Results:**
- ✅ Single toast notification: "Using polling for ticket updates (refreshes every 5 seconds)"
- ✅ Notification shown only once per session
- ✅ No console.warn spam

---

## 3. 404 Error Handling Testing

### Test Cases

#### TC3.1: Missing Supplier Avatar
**Steps:**
1. Create/view supplier profile with invalid image URL
2. Or manually break an image src in DevTools

**Expected Results:**
- ✅ Broken image replaced with SVG placeholder (grey background with user icon)
- ✅ Alt text: "Profile placeholder"
- ✅ No broken image icon visible
- ✅ Error handled gracefully without console errors

#### TC3.2: Unread Messages Count Endpoint
**Steps:**
1. Monitor network tab for `/api/messages/unread` requests
2. Check if endpoint returns 404 or succeeds

**Expected Results:**
- ✅ If endpoint fails, count defaults to 0
- ✅ No JavaScript errors in console
- ✅ Badge shows "0" or is hidden (not undefined/NaN)

#### TC3.3: Chart Source Map 404
**Steps:**
1. Open Network tab
2. Look for `chart.umd.js.map` requests

**Expected Results:**
- ✅ 404 for source map is non-blocking (chart still renders)
- ⚠️ Optional: Suppress in production builds
- ✅ Chart functionality works regardless

---

## 4. UI/UX Design Consistency Testing

### Test Cases

#### TC4.1: Quick Actions Arrows (Mobile)
**Steps:**
1. Resize browser to mobile width (< 768px)
2. View Quick Actions section

**Expected Results:**
- ✅ Arrows appear on left and right of carousel
- ✅ Arrows do NOT overlap action tiles
- ✅ Arrows have proper spacing (12px gap)
- ✅ Arrows are ghost buttons (border, transparent bg)
- ✅ Arrows are 44x44px (proper touch target)
- ✅ On hover: slight elevation and background change
- ✅ Focus-visible ring appears on keyboard focus

#### TC4.2: Quick Actions Arrows (Desktop)
**Steps:**
1. Resize browser to desktop width (> 768px)
2. View Quick Actions section

**Expected Results:**
- ✅ Arrows are hidden (display: none)
- ✅ Actions display in grid layout

#### TC4.3: Button Consistency
**Steps:**
1. Inspect all buttons on the page
2. Check padding, radius, colors, hover states

**Expected Results:**
- ✅ All buttons use design tokens for:
  - Padding: 12-14px vertical, 16-24px horizontal
  - Border radius: 10-12px
  - Icon sizes: 18-24px
- ✅ Consistent hover states (slight lift, shadow increase)
- ✅ Focus-visible rings on all interactive elements

#### TC4.4: KPI/Stat Cards
**Steps:**
1. View welcome card stats (Enquiries, Profiles)
2. Check alignment and typography

**Expected Results:**
- ✅ Numbers: 32px, semibold (600), centered
- ✅ Labels: 14px, medium (500), centered
- ✅ Perfect vertical and horizontal centering
- ✅ Consistent gap between number and label (4px)

---

## 5. Layout & Spacing Testing

### Test Cases

#### TC5.1: Hero/Welcome Card Spacing
**Steps:**
1. View the welcome card at top of dashboard
2. Measure spacing between elements

**Expected Results:**
- ✅ Consistent padding: 32px
- ✅ Content sections have proper gaps (24px, 16px)
- ✅ Features list properly indented
- ✅ Stats flex-aligned with 32px gap

#### TC5.2: CTA Banner Spacing
**Steps:**
1. Locate the "Customize Your Profile" banner
2. Check margins around it

**Expected Results:**
- ✅ Top margin: 24px
- ✅ Bottom margin: 24px
- ✅ Border radius: 12px
- ✅ Shadow applied for elevation
- ✅ Responsive on mobile (stacks vertically)

#### TC5.3: Pro Tip Alignment
**Steps:**
1. View the pro tip in welcome card
2. Check alignment with stats

**Expected Results:**
- ✅ Inline-flex display aligns with stats
- ✅ 8px gap between icon and text
- ✅ Backdrop blur applied
- ✅ Pulse animation smooth

---

## 6. Accessibility Testing

### Test Cases

#### TC6.1: Keyboard Navigation
**Steps:**
1. Use Tab key to navigate through page
2. Press Enter/Space on interactive elements

**Expected Results:**
- ✅ Focus-visible rings appear on all interactive elements
- ✅ Quick action arrows keyboard accessible
- ✅ Mobile nav pills have arrow key navigation
- ✅ Proper ARIA labels on all buttons

#### TC6.2: Screen Reader Compatibility
**Steps:**
1. Enable screen reader (NVDA/JAWS/VoiceOver)
2. Navigate through dashboard

**Expected Results:**
- ✅ All buttons have descriptive labels
- ✅ Announcements for navigation changes
- ✅ Hidden decorative elements (aria-hidden)

---

## 7. Mobile Responsiveness Testing

### Test Cases

#### TC7.1: Mobile Layout (< 768px)
**Steps:**
1. Set viewport to 375px width (iPhone)
2. Scroll through entire dashboard

**Expected Results:**
- ✅ Quick actions carousel scrolls horizontally
- ✅ Arrows visible and functional
- ✅ CTA banner stacks vertically
- ✅ Stats cards wrap properly
- ✅ Padding reduced appropriately

#### TC7.2: Tablet Layout (768px - 1024px)
**Steps:**
1. Set viewport to 768px width (iPad)
2. Check layout

**Expected Results:**
- ✅ Arrows hidden (desktop grid layout)
- ✅ All elements properly sized
- ✅ No horizontal overflow

---

## 8. Performance Testing

### Test Cases

#### TC8.1: Page Load Performance
**Steps:**
1. Hard refresh page (Ctrl+Shift+R)
2. Check Performance tab in DevTools

**Expected Results:**
- ✅ Design tokens CSS loads first
- ✅ No layout shifts (CLS < 0.1)
- ✅ Smooth animations (60fps)

#### TC8.2: WebSocket Reconnection Performance
**Steps:**
1. Monitor reconnection attempts
2. Check CPU/memory usage

**Expected Results:**
- ✅ No infinite loops
- ✅ Memory stable
- ✅ CPU usage reasonable

---

## 9. Console Error Testing

### Test Cases

#### TC9.1: Clean Console
**Steps:**
1. Open DevTools Console
2. Load dashboard
3. Interact with all features

**Expected Results:**
- ✅ No red errors
- ✅ No yellow warnings (except expected 404s)
- ✅ Clean, minimal logging
- ✅ No "indexOf on undefined" errors
- ✅ No "Real-time updates not available" console.warn spam

---

## 10. Cross-Browser Testing

### Test Cases

#### TC10.1: Chrome/Edge (Chromium)
- ✅ All features work
- ✅ Backdrop-filter supported
- ✅ CSS Grid/Flexbox work

#### TC10.2: Firefox
- ✅ All features work
- ✅ Backdrop-filter supported
- ✅ Animations smooth

#### TC10.3: Safari
- ✅ All features work
- ✅ -webkit-backdrop-filter works
- ✅ Scroll snap works

---

## Summary Checklist

### Critical Issues Fixed
- [x] WebSocket infinite retry loop fixed
- [x] Exponential backoff with jitter implemented
- [x] User-facing fallback notifications added
- [x] Console spam eliminated
- [x] Missing avatar placeholder implemented
- [x] Quick Actions arrows repositioned
- [x] Design tokens system created
- [x] Button consistency improved
- [x] KPI cards aligned and styled
- [x] Layout spacing improved

### Non-Critical/Optional
- [ ] Chart styling enhancements (requires Chart.js config)
- [ ] Chart source map suppression (non-blocking)
- [ ] Additional hero CTA (not in original spec)

---

## Known Limitations

1. **Chart Source Map 404**: CDN-served Chart.js includes source map reference. This is a non-blocking 404 and doesn't affect functionality. Could be suppressed with custom build.

2. **indexOf TypeError**: Extensive search found no instances of indexOf being called on undefined. May have been a transient issue or already fixed in previous updates.

3. **ESLint**: Not installed in current environment. JavaScript syntax validated with Node.js parser.

---

## Reporting Issues

If you encounter any issues during testing:

1. **Note the Test Case ID** (e.g., TC1.2)
2. **Capture Screenshots/Video**
3. **Copy Console Logs**
4. **Note Browser/OS Version**
5. **Describe Steps to Reproduce**

---

## Contact

For questions about this testing guide or to report results:
- Create a GitHub issue with test results
- Tag with `qa`, `supplier-dashboard`, `testing`
