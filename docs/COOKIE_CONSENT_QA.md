# Cookie Consent Manual QA Checklist

This document covers manual verification steps for the EventFlow cookie consent system
(v2.0.0, UK GDPR/PECR compliant).

---

## Prerequisites

```bash
JWT_SECRET="test-secret-min-32-chars-for-qa" npm start
```

Open a private/incognito browser window to simulate a first-time visitor.
Open DevTools → Application → Cookies and localStorage to inspect state.

---

## 1. First visit — banner appears

1. Navigate to `http://localhost:3000/`
2. **Expected:** The cookie consent banner appears at the bottom of the page.
3. Verify the banner has three buttons: **Accept All**, **Reject**, and **Manage Preferences**.
4. Verify links in the banner have `rel="noopener noreferrer"`.

---

## 2. Accept All — optional preferences persist

1. Click **Accept All** on the banner.
2. **Expected:** Banner disappears with a slide-out animation.
3. Check Cookies: `eventflow_cookie_consent` should be a JSON-encoded string like:
   `{"v":1,"essential":true,"functional":true,"analytics":false}`
4. Toggle dark mode — verify `theme` key appears in localStorage.
5. Reload the page — banner should NOT reappear.

---

## 3. Reject — optional storage not set and cleared

1. Open a fresh private window, navigate to `/`.
2. First set a theme preference if one exists (to verify it is cleared).
3. Click **Reject** on the banner.
4. **Expected:** Banner disappears.
5. Check Cookies: `eventflow_cookie_consent` should be:
   `{"v":1,"essential":true,"functional":false,"analytics":false}`
6. Check localStorage: `theme`, `ef_expanded_folders`, `marketplaceLocation` and other
   functional keys should be **absent**.
7. Toggle dark mode — the theme changes visually but `theme` key should **not** be saved
   to localStorage.

---

## 4. Manage Preferences — per-category control

1. Open a fresh private window, navigate to `/`.
2. Click **Manage Preferences**.
3. **Expected:** Banner closes; a modal dialog titled "Cookie Preferences" opens.
4. Verify **Essential Cookies** shows "Always on" (no toggle).
5. Verify **Functional Cookies** and **Analytics Cookies** have toggles.
6. Toggle Functional on, Analytics off; click **Save Preferences**.
7. Check Cookies: `functional` is `true`, `analytics` is `false`.
8. Confirm the dialog closes and no banner reappears.

---

## 5. Manage Preferences from Legal Hub — works after prior decision

1. Navigate to `http://localhost:3000/legal#cookies` (logged-in or not).
2. Scroll to the "Managing Your Cookie Preferences" section.
3. Click the **🍪 Manage cookie preferences** button.
4. **Expected:** The preferences dialog opens immediately, even if a prior decision exists.
5. Change a preference and save.
6. Verify the cookie reflects the updated value.

---

## 6. Cookie preferences link in footer

1. Scroll to the footer on any page (e.g., `/`, `/legal`, `/privacy`).
2. Click **Cookie preferences**.
3. **Expected:** The preferences dialog opens.

---

## 7. Revoke / reset consent

1. Open the preferences dialog (from footer or Legal Hub).
2. In the browser console, run: `CookieConsent.revokeConsent()`
3. **Expected:**
   - `eventflow_cookie_consent` cookie is deleted.
   - Functional localStorage keys are cleared.
   - The initial consent banner reappears.

---

## 8. Migration from old cookie values

1. In DevTools, manually set the cookie:
   `eventflow_cookie_consent=accepted; path=/`
2. Reload the page.
3. **Expected:** No banner appears; the cookie is silently migrated to
   `{"v":1,"essential":true,"functional":true,"analytics":false}`.
4. Repeat with value `rejected` — expect `functional: false`.

---

## 9. Accessibility checks

| Check                                          | Expected                                                |
| ---------------------------------------------- | ------------------------------------------------------- |
| Tab into banner                                | Focus moves to **Accept All** first                     |
| Tab through banner                             | Cycles through Accept All → Reject → Manage Preferences |
| Open preferences dialog, Tab                   | Focus is trapped within the dialog                      |
| Press **Escape** in dialog                     | Dialog closes                                           |
| Shift+Tab in dialog on first focusable element | Focus wraps to last element                             |
| Screen reader: banner                          | Announced as a dialog with label "Cookie consent"       |
| Screen reader: preferences                     | Announced as a dialog with label "Cookie Preferences"   |
| Toggle switches                                | Keyboard-operable with Space; state announced           |

---

## 10. Secure attribute on HTTPS

1. Deploy to a staging environment with HTTPS.
2. Check the `eventflow_cookie_consent` cookie attributes in DevTools.
3. **Expected:** `Secure` attribute present; `SameSite=Lax`.

---

## 11. `window.CookieConsent` public API

Verify all methods work in the browser console:

```js
CookieConsent.getConsent(); // → {essential:true, functional:bool, analytics:bool}
CookieConsent.hasConsent(); // → true/false
CookieConsent.openPreferences(); // → opens preferences dialog
CookieConsent.revokeConsent(); // → clears consent, shows banner
CookieConsent.reset(); // → same as revokeConsent()
CookieConsent.show(); // → shows banner only if no consent recorded
```

---

## 12. No regression on existing pages

1. Visit several pages (dashboard, marketplace, settings, auth, legal) after consent
   has been accepted.
2. **Expected:** No banner reappears; pages load and function normally.
3. Check browser console for errors related to `CookieConsent`.
