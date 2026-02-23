# Production Monitoring Guide: Supplier Dashboard CSS Refactoring

## Overview

This guide provides recommendations for monitoring the Supplier Dashboard after deploying the CSS refactoring changes (PR: Remove Remaining Inline Styles & Refactor Widgets).

---

## 🎯 What to Monitor

### 1. JavaScript Errors

**Critical Areas:**

- Form validation (venue postcode)
- Error message display/hide
- Badge visibility toggles
- Dynamic content generation

**How to Monitor:**

```javascript
// Add to dashboard page (temporary monitoring)
window.addEventListener('error', event => {
  console.error('Dashboard Error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    timestamp: new Date().toISOString(),
  });

  // Send to monitoring service if available
  if (window.Sentry) {
    Sentry.captureException(event.error);
  }
});
```

**Key Indicators:**

- No errors related to `classList.add/remove`
- No errors related to missing elements
- No "Cannot read property 'classList' of null"

---

### 2. CSS Loading

**Check:**

- `supplier-dashboard-improvements.css` loads successfully
- No 404 errors for CSS files
- No CORS issues
- File size is reasonable (~30KB)

**Browser DevTools:**

```
Network Tab → Filter: CSS → Check:
✓ supplier-dashboard-improvements.css (200 OK)
✓ Size: ~30KB
✓ Load time: <100ms
```

**Key Indicators:**

- CSS file loads on first visit
- CSS cached on subsequent visits (304 Not Modified)
- No broken styles on page

---

### 3. Visual Regression

**Components to Check:**

#### Profile Customization CTA Banner

- ✓ Gradient background displays correctly
- ✓ Button aligns properly
- ✓ "New" badge visible
- ✓ Responsive layout works on mobile

#### Lead Quality Breakdown Widget

- ✓ Progress bars render correctly
- ✓ Colors match design (red/amber/green/gray)
- ✓ Percentages display correctly
- ✓ Average score visible

#### Form Grids

- ✓ Fields align in grid layout
- ✓ Responsive on mobile (single column)
- ✓ Spacing consistent

#### Validation States

- ✓ Required asterisks show in red
- ✓ Help text displays in gray
- ✓ Error messages appear/disappear correctly

**Screenshot Comparison:**

Take screenshots at these viewports:

- Desktop: 1920×1080
- Tablet: 1024×768
- Mobile: 414×896

Compare with baseline screenshots (if available).

---

### 4. Form Functionality

**Test Cases:**

#### Venue Postcode Field

```javascript
// Test 1: Category change to "Venues"
1. Select "Venues" category
2. Verify postcode field appears
3. Check aria-required="true" is set

// Test 2: Category change from "Venues"
1. Select "Catering" category
2. Verify postcode field hides
3. Check value is cleared
4. Check aria-required="false" is set
```

#### Error Display

```javascript
// Test 1: Show error
1. Enter invalid postcode
2. Blur field
3. Verify error message appears with class "visible"

// Test 2: Hide error
1. Enter valid postcode
2. Verify error message hides (no "visible" class)
```

**Key Indicators:**

- Form validation works as before
- No JavaScript errors in console
- Smooth transitions when showing/hiding fields

---

### 5. Performance

**Metrics to Track:**

#### Page Load

- **Time to First Byte (TTFB)**: <200ms
- **First Contentful Paint (FCP)**: <1.5s
- **Largest Contentful Paint (LCP)**: <2.5s
- **Cumulative Layout Shift (CLS)**: <0.1

#### Resource Loading

```
CSS Files:
- supplier-dashboard-improvements.css: ~30KB
- Load time: <100ms
- Cached: Yes (after first load)

Total CSS:
- Before: Various inline styles in HTML
- After: Centralized CSS file (cached)
- Net benefit: Better caching, smaller HTML
```

**How to Check:**

Using Chrome DevTools:

```
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Run performance audit
4. Check metrics above
```

Using Network Tab:

```
1. Open DevTools (F12)
2. Go to Network tab
3. Filter: CSS
4. Check load times and sizes
```

---

### 6. Browser Compatibility

**Test Matrix:**

| Browser       | Version     | Status |
| ------------- | ----------- | ------ |
| Chrome        | Latest      | ✓      |
| Firefox       | Latest      | ✓      |
| Safari        | Latest      | ✓      |
| Edge          | Latest      | ✓      |
| Mobile Safari | iOS 14+     | ✓      |
| Chrome Mobile | Android 10+ | ✓      |

**Features to Verify:**

- CSS Grid support
- Flexbox support
- classList API
- CSS transitions
- Media queries

---

### 7. Accessibility

**Test with:**

#### Screen Readers

- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (Mac/iOS)

**Check:**

- Form labels announced correctly
- Error messages announced with aria-live
- Required fields announced
- Button labels clear

#### Keyboard Navigation

- Tab through form fields
- Space/Enter activates buttons
- Focus visible on all interactive elements

#### Color Contrast

- Required asterisks: Red (#ef4444) - Check contrast
- Error messages: Red (#ef4444) - Check contrast
- Help text: Gray (#667085) - Check contrast

**Tools:**

- Chrome DevTools → Lighthouse → Accessibility
- WAVE browser extension
- axe DevTools extension

---

### 8. Mobile Experience

**Test Scenarios:**

#### Portrait Orientation (375×812)

- ✓ Form grids stack to single column
- ✓ CTA banner stacks vertically
- ✓ Buttons full width
- ✓ No horizontal scroll
- ✓ Touch targets ≥44×44px

#### Landscape Orientation (812×375)

- ✓ Layout remains usable
- ✓ No content cut off
- ✓ Navigation accessible

**Touch Interactions:**

- Form inputs easy to tap
- Buttons large enough
- No accidental clicks

---

## 📊 Monitoring Tools

### 1. Browser DevTools

**Console:**

```javascript
// Check for errors
console.error(); // Should be empty

// Check CSS classes applied
document.querySelector('.supplier-cta-banner'); // Should exist
```

**Network:**

```
- Check CSS loading
- Check response codes
- Check file sizes
- Check load times
```

**Elements:**

```
- Inspect CSS classes
- Check computed styles
- Verify responsive layout
```

### 2. Sentry (if available)

**Error Tracking:**

```javascript
// Configure Sentry to catch CSS-related errors
Sentry.init({
  dsn: 'YOUR_DSN',
  beforeSend(event) {
    // Filter for dashboard-related errors
    if (event.request?.url?.includes('/dashboard-supplier')) {
      return event;
    }
    return event;
  },
});
```

### 3. Google Analytics (if available)

**Custom Events:**

```javascript
// Track form interactions
gtag('event', 'form_interaction', {
  event_category: 'supplier_dashboard',
  event_label: 'venue_postcode_toggle',
});

// Track errors
gtag('event', 'error', {
  event_category: 'supplier_dashboard',
  event_label: 'validation_error',
});
```

### 4. Real User Monitoring (RUM)

**Key Metrics:**

- Page load time
- Time to interactive
- Error rate
- User engagement

---

## 🚨 Alert Thresholds

### Critical Alerts

**JavaScript Errors:**

- **Threshold**: >1% error rate
- **Action**: Investigate immediately
- **Rollback**: If >5% error rate

**CSS Loading Failures:**

- **Threshold**: >0.1% failure rate
- **Action**: Check CDN/server
- **Rollback**: If consistent failures

**Form Submission Failures:**

- **Threshold**: >2% failure rate
- **Action**: Check validation logic
- **Rollback**: If >10% failure rate

### Warning Alerts

**Performance Degradation:**

- **Threshold**: >20% increase in load time
- **Action**: Investigate bottlenecks
- **Rollback**: Consider if >50% increase

**Visual Issues:**

- **Threshold**: >3 user reports
- **Action**: Reproduce and investigate
- **Rollback**: If critical visual regression

---

## 📋 Monitoring Checklist (First 48 Hours)

### Hour 0-2 (Critical)

- [ ] Check server logs for errors
- [ ] Monitor error tracking dashboard
- [ ] Test form validation personally
- [ ] Check CSS loading in Network tab
- [ ] Verify responsive layout on mobile

### Hour 2-24 (Important)

- [ ] Review error reports (if any)
- [ ] Check user feedback/support tickets
- [ ] Monitor page load metrics
- [ ] Test on different browsers
- [ ] Check accessibility with screen reader

### Hour 24-48 (Standard)

- [ ] Review analytics data
- [ ] Check performance trends
- [ ] Analyze user behavior
- [ ] Collect team feedback
- [ ] Document any issues

---

## 🔧 Troubleshooting

### Issue: Styles Not Applying

**Symptoms:**

- Elements look unstyled
- Layout broken
- Colors incorrect

**Debug Steps:**

1. Check Network tab for CSS file (200 OK?)
2. Check browser cache (hard refresh: Ctrl+Shift+R)
3. Verify CSS file path correct
4. Check for CSS syntax errors
5. Inspect element for applied classes

**Solution:**

```bash
# Clear browser cache
# Verify file deployment
# Check CDN cache if applicable
```

### Issue: JavaScript Errors

**Symptoms:**

- classList errors in console
- Form validation not working
- Elements not showing/hiding

**Debug Steps:**

1. Check console for exact error
2. Verify element IDs are correct
3. Check timing (DOMContentLoaded?)
4. Verify classList API supported
5. Check for typos in class names

**Solution:**

```javascript
// Add null checks
const element = document.getElementById('my-element');
if (element) {
  element.classList.add('my-class');
}
```

### Issue: Visual Regression

**Symptoms:**

- Layout looks different
- Colors incorrect
- Spacing off
- Responsive issues

**Debug Steps:**

1. Compare with baseline screenshots
2. Check computed styles in DevTools
3. Verify CSS classes applied
4. Check for conflicting styles
5. Test at different viewports

**Solution:**

```css
/* Check for specificity issues */
/* Verify media queries */
/* Check inheritance */
```

---

## 📞 Escalation

### When to Escalate

**Immediately:**

- Critical functionality broken
- Security vulnerability discovered
- Data loss or corruption
- Site completely down

**Within 1 Hour:**

- Major visual regression affecting UX
- Form validation completely broken
- Accessibility severely impacted
- > 5% error rate

**Within 24 Hours:**

- Minor visual issues
- Performance degradation
- Browser compatibility issues
- User complaints

### Escalation Contacts

1. **Frontend Team Lead**
2. **DevOps/Infrastructure**
3. **Product Owner**
4. **CTO/Tech Lead**

---

## 📝 Reporting

### Daily Report Template

```markdown
## Dashboard Monitoring Report - [Date]

### Metrics

- Page Views: [number]
- Error Rate: [percentage]
- Avg Load Time: [ms]
- User Complaints: [number]

### Issues

- [None / List issues]

### Actions Taken

- [None / List actions]

### Status

- [✅ Green / ⚠️ Yellow / 🚨 Red]
```

---

## ✅ Success Criteria

After 48 hours, consider deployment successful if:

- ✅ Error rate <1%
- ✅ No critical functionality broken
- ✅ No visual regressions reported
- ✅ Performance metrics stable or improved
- ✅ No accessibility issues
- ✅ User feedback positive
- ✅ Team confident in changes

---

## 🎉 Conclusion

Successful monitoring ensures:

1. Quick identification of issues
2. Rapid response to problems
3. Minimal user impact
4. Continuous improvement
5. Team confidence

**Remember**: Most issues are caught in first 24-48 hours. Stay vigilant!

---

**Last Updated**: 2026-02-03  
**Version**: 1.0.0  
**Owner**: Frontend Team
