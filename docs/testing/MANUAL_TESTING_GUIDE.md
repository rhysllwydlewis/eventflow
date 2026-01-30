# Manual Testing Guide for Admin Packages Fixes

This guide helps verify the fixes for JPEG upload errors and supplier dropdown issues.

## Prerequisites

1. Start the server with a configured MongoDB connection
2. Log in as an admin user
3. Navigate to `/admin-packages.html`

## Test 1: JPEG Upload with Extension Fallback

### Purpose

Verify that JPEG files can be uploaded successfully, even when magic byte detection fails.

### Steps

1. Click "Add Package" button
2. Fill in required fields (select a supplier, add title, description, price)
3. Upload a JPEG image using the file selector or drag-and-drop
   - Try both `.jpg` and `.jpeg` extensions
   - Test with various JPEG files (different sizes, quality levels)
4. Click "Save Package"

### Expected Results

- ✅ Image uploads successfully without errors
- ✅ Package is created with the uploaded image
- ✅ No "Invalid file type" or `indexOf` errors in console
- ✅ If magic byte detection fails, extension-based fallback should work silently

### Edge Cases to Test

- Large JPEG files (near the size limit)
- JPEG files with unusual metadata
- JPEG files with different quality settings
- Progressive vs. baseline JPEGs

## Test 2: Supplier Field Read-Only When Editing

### Purpose

Verify that the supplier field is read-only when editing an existing package.

### Part A: Editing an Existing Package

1. From the packages list, click "Edit" on any package
2. Observe the supplier field in the form

**Expected Results:**

- ✅ The supplier dropdown is **hidden**
- ✅ A read-only text display shows the supplier name
- ✅ The supplier name is displayed clearly (e.g., "XYZ Events Ltd")
- ✅ You cannot change the supplier

3. Make other changes (title, description, etc.)
4. Click "Save Package"

**Expected Results:**

- ✅ Changes are saved successfully
- ✅ The supplier ID remains unchanged
- ✅ Package still belongs to the same supplier

### Part B: Creating a New Package

1. Click "Add Package" button
2. Observe the supplier field

**Expected Results:**

- ✅ The supplier dropdown **is visible**
- ✅ The read-only display is hidden
- ✅ You can select a supplier from the dropdown

3. Select a supplier and fill in other fields
4. Upload an image
5. Click "Save Package"

**Expected Results:**

- ✅ Package is created with the selected supplier
- ✅ Package appears in the list with correct supplier

### Part C: Switching Between Create and Edit

1. Click "Add Package" → verify dropdown is shown
2. Click "Cancel"
3. Click "Edit" on a package → verify read-only display is shown
4. Click "Cancel"
5. Click "Add Package" again → verify dropdown is shown again

**Expected Results:**

- ✅ The form correctly switches between dropdown and read-only display
- ✅ No leftover state from previous operations

## Test 3: Error Handling

### Test Better Error Messages

1. Try uploading a non-image file (e.g., .txt, .pdf)
2. Try uploading a corrupted image file
3. Try uploading a file with wrong extension

**Expected Results:**

- ✅ Clear error messages are displayed
- ✅ Error messages include detected type and allowed formats
- ✅ No JavaScript errors in console
- ✅ No `indexOf` errors

## Browser Console Checks

Throughout testing, monitor the browser console for:

- ❌ No `TypeError: Cannot read properties of undefined (reading 'indexOf')` errors
- ❌ No unhandled promise rejections
- ✅ Helpful logging messages (if debug mode is enabled)

## Verification Checklist

After completing all tests:

- [ ] JPEG images upload successfully
- [ ] Extension fallback works when magic byte detection fails
- [ ] Supplier field is read-only when editing packages
- [ ] Supplier dropdown appears when creating new packages
- [ ] Form correctly switches between modes
- [ ] Supplier ID is preserved when editing
- [ ] Error messages are clear and helpful
- [ ] No console errors during any operation
- [ ] All automated tests pass (18/18)
- [ ] Security scan shows no issues

## Known Limitations

1. **Extension-based fallback is a safety net**: The primary validation is still magic byte detection for security. Extension fallback only activates when magic bytes fail.

2. **Supplier cannot be changed after creation**: This is by design. If a package needs to be moved to a different supplier, it should be deleted and recreated.

## Troubleshooting

### Issue: Upload still fails

- Check browser console for detailed error messages
- Verify file size is within limits (< 10MB)
- Check server logs for validation details
- Ensure MongoDB is connected

### Issue: Supplier field shows incorrectly

- Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)
- Check browser console for JavaScript errors
- Verify suppliers are loaded (check Network tab)

### Issue: Images not appearing

- Check that image URLs are correct in database
- Verify MongoDB/file storage is working
- Check for CORS issues in console

## Additional Notes

- Screenshots are automatically captured during Playwright E2E tests
- Manual testing helps verify the UX improvements
- The code changes are minimal and focused on the specific issues
