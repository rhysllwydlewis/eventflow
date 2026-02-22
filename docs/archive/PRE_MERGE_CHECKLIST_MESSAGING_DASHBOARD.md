# Pre-Merge Checklist: Messaging Dashboard Fixes

**Branch:** `copilot/fix-dashboard-messaging-errors`  
**Date:** 2026-02-17  
**Status:** 🔄 IN PROGRESS

---

## Original Requirements Verification

From the original problem statement, the following issues needed to be fixed:

### ✅ Core Issues to Fix

- [ ] **Issue 1:** Customer/supplier dashboard message send flow posts correct payload for v2 API
  - Use `content` and `attachments` fields (not `message`)
  - Maintain backward compatibility for callers still sending `message`
- [ ] **Issue 2:** Fix mark-read requests to use v2 endpoint shape
  - Use `/api/v2/messages/threads/:threadId/read` (not `/api/v2/messages/:threadId/read`)
  - Update client-side helper methods accordingly
- [ ] **Issue 3:** Prefer centralized API version config
  - Use `public/assets/js/config/api-version.js` where feasible
- [ ] **Issue 4:** Improve client-side error handling
  - 400/500 responses should surface clear error messages
  - Not generic "Something went wrong"
- [ ] **Issue 5:** Confirm supplier inbox/unread badge handling
  - Should still work after changes

---

## Code Changes Verification

### Client-Side Changes (`public/assets/js/messaging.js`)

- [ ] `sendMessageViaAPI` transforms `message` → `content`
- [ ] `markMessagesAsReadViaAPI` uses correct endpoint path
- [ ] `MessagingManager.markMessagesAsRead` uses correct endpoint path
- [ ] Error extraction from API responses implemented
- [ ] Error messages surface specific details

### Server-Side Changes (`routes/messaging-v2.js`)

- [ ] POST `:threadId` accepts both `content` and `message` fields
- [ ] Backward compatibility maintained
- [ ] No breaking changes introduced

### Test Coverage

- [ ] New test file created: `tests/unit/messaging-dashboard-fixes.test.js`
- [ ] Tests validate payload transformation
- [ ] Tests validate endpoint paths
- [ ] Tests validate error handling
- [ ] Tests validate backward compatibility

---

## Testing Verification

### Unit Tests

- [ ] `messaging-dashboard-fixes.test.js` - All 13 tests passing
- [ ] `marketplace-messaging-flow-fixes.test.js` - All tests passing
- [ ] `marketplace-peer-to-peer-messaging.test.js` - All tests passing
- [ ] `verification-messaging.test.js` - All tests passing

### Integration Tests

- [ ] Smoke tests passing (110+ tests)
- [ ] No regressions in existing functionality

### Security Tests

- [ ] CodeQL security scan - 0 alerts
- [ ] No new vulnerabilities introduced

---

## Documentation Verification

- [ ] `MESSAGING_DASHBOARD_FIXES_SUMMARY.md` - Technical documentation
- [ ] `COMPLETION_REPORT.md` - Deployment readiness
- [ ] `IMPLEMENTATION_COMPLETE.md` - Visual summary
- [ ] `scripts/verify-messaging-fixes.sh` - Verification script
- [ ] PR description includes concise report

---

## Backward Compatibility Verification

- [ ] Client auto-transforms old `message` field
- [ ] Server accepts both `message` and `content` fields
- [ ] No breaking changes to public APIs
- [ ] Existing code continues to work

---

## Error Handling Verification

- [ ] Specific error messages extracted from 400 responses
- [ ] Specific error messages extracted from 500 responses
- [ ] Error messages displayed to users (not generic)
- [ ] Console logging improved for debugging

---

## Functional Verification

### Customer Dashboard

- [ ] Can send messages to suppliers without 400 errors
- [ ] Messages appear in conversation correctly
- [ ] Can mark messages as read without 404/500 errors
- [ ] Unread badge clears when marking as read
- [ ] Error messages are specific when failures occur

### Supplier Dashboard

- [ ] Can send messages to customers without 400 errors
- [ ] Messages appear in conversation correctly
- [ ] Can mark messages as read without 404/500 errors
- [ ] Unread badge clears when marking as read
- [ ] Unread badge updates correctly on new messages
- [ ] Error messages are specific when failures occur

---

## Performance Verification

- [ ] No significant performance degradation
- [ ] Payload transformation is negligible overhead
- [ ] No additional API calls added
- [ ] Response times unchanged

---

## Code Quality Verification

- [ ] Code follows existing patterns
- [ ] No linting errors
- [ ] Code review feedback addressed
- [ ] Comments and documentation clear
- [ ] No unused code or variables

---

## Final Checks

- [ ] All commits have descriptive messages
- [ ] No temporary files in commit
- [ ] No build artifacts committed
- [ ] No sensitive data in commits
- [ ] Branch is up to date with origin

---

## Sign-Off

### Pre-Merge Approval

- [ ] All tests passing ✅
- [ ] All documentation complete ✅
- [ ] All requirements met ✅
- [ ] Ready for production deployment ✅

**Reviewer:** **\*\*\*\***\_\_\_**\*\*\*\***  
**Date:** **\*\*\*\***\_\_\_**\*\*\*\***  
**Approved:** [ ] YES [ ] NO

---

## Notes

_Add any additional notes or observations here_
