# Content Update Guide

## Overview

This guide explains how to manage content on the EventFlow website using the centralized content configuration system. This system enables easy updates to dates, company information, and other content without manually editing multiple HTML files.

## Table of Contents

1. [Content Configuration System](#content-configuration-system)
2. [Updating Legal Document Dates](#updating-legal-document-dates)
3. [Using Placeholders](#using-placeholders)
4. [Admin Panel Content Management](#admin-panel-content-management)
5. [Annual Year-End Checklist](#annual-year-end-checklist)
6. [Quick Reference](#quick-reference)

## Content Configuration System

The content configuration system consists of three main components:

1. **`/config/content-config.js`** - Central configuration file storing all dynamic content values
2. **`/utils/template-renderer.js`** - Middleware that replaces placeholders with actual values
3. **HTML files** - Use `{{PLACEHOLDER}}` syntax for dynamic content

### How It Works

1. HTML files contain placeholders like `{{CURRENT_YEAR}}` or `{{LEGAL_LAST_UPDATED}}`
2. When a user requests an HTML page, the template renderer middleware intercepts the request
3. The middleware reads the file and replaces all placeholders with values from content-config.js
4. The processed HTML is sent to the user's browser
5. In production, rendered pages are cached for performance

## Updating Legal Document Dates

### When to Update

Update legal document dates when you:

- Revise terms of use or privacy policy
- Add new features that require legal documentation
- Make substantive changes to legal policies
- Respond to new legal requirements or regulations

### Method 1: Direct Configuration File Edit (Recommended for Developers)

1. Edit `/config/content-config.js`
2. Update the dates in the configuration object:

```javascript
dates: {
  currentYear: getCurrentYear(), // Auto-updates
  copyrightYear: getCurrentYear(), // Auto-updates
  // Update these when legal docs change:
  legalLastUpdated: 'February 2026',
  legalEffectiveDate: 'February 2026',
  sitemapLastMod: new Date().toISOString().split('T')[0],
},
```

3. Commit and deploy the changes
4. The changes will be reflected immediately on all pages using these placeholders

### Method 2: Admin Panel - Content Date Management

The admin panel provides a user-friendly interface for non-technical staff to update content dates:

1. Log into EventFlow admin dashboard
2. Navigate to **Content Dates** in the admin navigation
3. View current legal document dates and git-detected changes
4. Update legal dates manually if needed using the form
5. Click "Update Dates" to save changes
6. Changes take effect immediately

**Admin Panel URL:** `/admin-content-dates.html`

## Automated Date Management System

### Overview

EventFlow now includes an **automated date management system** that tracks changes to legal documents using git history and automatically updates dates when content changes are detected.

### How It Works

1. **Git-based Tracking:** The system monitors git commit history for legal document files:
   - `public/terms.html`
   - `public/privacy.html`
   - `public/legal.html`
   - `public/cookies.html`
   - `public/acceptable-use.html`

2. **Monthly Automated Checks:** On the 1st of each month at 2:00 AM, the system:
   - Checks if any legal documents have been modified since the last date update
   - Compares git commit dates against current config dates
   - If changes are detected, automatically updates the dates in `config/content-config.js`
   - Sends notifications to all admin users

3. **Manual Override:** Admins can:
   - Manually update dates at any time via the admin panel
   - Trigger an immediate check without waiting for the scheduled time
   - Enable or disable automated updates
   - View all article/guide dates tracked from git history

### Using the Admin Panel

#### Viewing Current Status

The Content Date Management panel (`/admin-content-dates.html`) displays:

- **Automation Status:** Whether automated updates are enabled
- **Content Status:** Whether legal documents have changed since last update
- **Current Dates:** Legal last updated and effective dates
- **Git Detected Date:** Most recent commit date for legal files
- **Next Scheduled Check:** When the next automated check will run

#### Manually Updating Dates

1. Navigate to the "Manual Update" section
2. Enter dates in format: "Month YYYY" (e.g., "February 2026")
3. Fill in either or both fields:
   - **Last Updated Date:** When the document was last revised
   - **Effective Date:** When changes take effect
4. Click "Update Dates"
5. System will:
   - Update `config/content-config.js` automatically
   - Create an audit log entry
   - Notify other admins of the change

#### Checking for Updates Immediately

Instead of waiting for the monthly scheduled check:

1. Click "Check for Updates Now" button
2. System will:
   - Check git history for changes
   - Update dates if content has changed
   - Display result message
   - Send notifications if updates were made

#### Enabling/Disabling Automation

Use the toggle switch in the "Automation Settings" section:

- **Enabled:** Monthly checks will run automatically on the 1st at 2:00 AM
- **Disabled:** No automated checks will run (manual updates still work)

Changes are saved immediately and an audit log entry is created.

#### Viewing Article/Guide Dates

The panel automatically displays all guides and articles with their last modification dates from git history. This helps track content freshness across the site.

### Configuration Options

In `/config/content-config.js`:

```javascript
dates: {
  currentYear: getCurrentYear(),
  copyrightYear: getCurrentYear(),
  legalLastUpdated: 'January 2026',
  legalEffectiveDate: 'January 2026',
  sitemapLastMod: new Date().toISOString().split('T')[0],
  
  // Automation settings
  autoUpdateEnabled: true,        // Enable/disable monthly checks
  lastAutoCheck: null,            // Last automated check timestamp
  lastManualUpdate: null,         // Last manual update timestamp
}
```

### Benefits

✅ **Zero Manual Work:** Dates update automatically when you commit legal document changes
✅ **Audit Trail:** Git history provides complete change tracking
✅ **Admin Notifications:** All admins are notified of date changes
✅ **Manual Override:** Complete control when automation isn't suitable
✅ **No Forgotten Updates:** System reminds you when content has changed

### When Manual Updates Are Still Needed

You should manually update dates when:

- Legal review occurs without file changes
- Consulting with legal counsel results in a "no changes needed" decision
- Substantive legal interpretation changes without text modifications
- You want to update the effective date to a future date

For all other cases, the automation handles updates seamlessly.

## Using Placeholders

### Available Placeholders

#### Date Placeholders

- `{{CURRENT_YEAR}}` - Current year (e.g., "2026")
- `{{COPYRIGHT_YEAR}}` - Copyright year (same as current year)
- `{{LEGAL_LAST_UPDATED}}` - Last update date for legal documents (e.g., "January 2026")
- `{{LEGAL_EFFECTIVE_DATE}}` - Effective date for legal documents (e.g., "January 2026")
- `{{SITEMAP_LAST_MOD}}` - Sitemap last modification date (YYYY-MM-DD format)

#### Company Information

- `{{COMPANY_NAME}}` - EventFlow Limited
- `{{COMPANY_NAME_LEGAL}}` - EventFlow Limited (legal name)
- `{{COMPANY_LEGAL_NAME}}` - EventFlow Limited (legal name)
- `{{TRADING_NAME}}` - EventFlow
- `{{COMPANY_REGISTRATION}}` - Company registration number
- `{{COMPANY_NUMBER}}` - [Pending Registration - To be added upon Companies House registration]
- `{{REGISTERED_OFFICE}}` - [To be added upon company registration]
- `{{VAT_NUMBER}}` - [Not currently VAT registered]
- `{{PLACE_OF_REGISTRATION}}` - England and Wales

#### Contact Information

- `{{SUPPORT_EMAIL}}` - support@event-flow.co.uk
- `{{ADMIN_EMAIL}}` - admin@event-flow.co.uk
- `{{ABUSE_EMAIL}}` - abuse@event-flow.co.uk
- `{{SALES_EMAIL}}` - sales@event-flow.co.uk
- `{{PRIVACY_EMAIL}}` - privacy@event-flow.co.uk

#### Address Components

- `{{COMPANY_ADDRESS_LINE1}}` - Address line 1
- `{{COMPANY_ADDRESS_LINE2}}` - Address line 2
- `{{COMPANY_ADDRESS_CITY}}` - City
- `{{COMPANY_ADDRESS_POSTCODE}}` - Postcode
- `{{COMPANY_ADDRESS_COUNTRY}}` - Country

#### URLs

- `{{DOMAIN}}` - event-flow.co.uk
- `{{WEBSITE_URL}}` - https://event-flow.co.uk
- `{{LEGAL_HUB_URL}}` - https://event-flow.co.uk/legal.html
- `{{TERMS_URL}}` - https://event-flow.co.uk/terms.html
- `{{PRIVACY_URL}}` - https://event-flow.co.uk/privacy.html

### How to Add Placeholders to HTML Files

Replace hardcoded values with placeholder syntax:

**Before:**

```html
<p>Last updated: December 2024</p>
<p>&copy; 2024 EventFlow Limited</p>
<p>Contact: admin@event-flow.co.uk</p>
```

**After:**

```html
<p>Last updated: {{LEGAL_LAST_UPDATED}}</p>
<p>&copy; {{COPYRIGHT_YEAR}} {{COMPANY_NAME}}</p>
<p>Contact: {{ADMIN_EMAIL}}</p>
```

### Files Currently Using Placeholders

The following files have been updated to use the template system:

- `public/legal.html` - Legal hub with marketplace terms
- `public/terms.html` - Terms of use
- `public/privacy.html` - Privacy notice
- `public/data-rights.html` - GDPR data rights
- `public/articles/marketplace-guide.html` - Marketplace user guide

## Admin Panel Content Management

### Accessing Content Management

1. Log into EventFlow as an admin user
2. Navigate to **Admin Dashboard** > **Settings**
3. Scroll to **Content Management** section

### Content Management Features

- **Legal Document Dates**: Update last updated and effective dates
- **Email Addresses**: Update support, admin, abuse, and other contact emails
- **Company Information**: Update company name, address, and registration details
- **Preview Changes**: See how changes will appear before saving
- **Change History**: View audit log of content updates

### Best Practices

1. **Coordinate Updates**: Notify the team before making changes to legal dates
2. **Document Changes**: Keep notes on what changed and why
3. **Test After Update**: Verify changes appear correctly on all affected pages
4. **Backup Configuration**: Keep a backup of content-config.js before major changes

## Annual Year-End Checklist

At the end of each year, follow this checklist to ensure content stays current:

### December Review (Before New Year)

- [ ] Review all legal documents for necessary updates
- [ ] Verify copyright year will auto-update (CURRENT_YEAR placeholder in use)
- [ ] Check if legal effective dates need updating
- [ ] Review contact information for accuracy
- [ ] Update any year-specific content in blog articles
- [ ] Verify sitemap generation includes all current pages

### January Actions (After New Year)

- [ ] Verify copyright year updated to new year automatically
- [ ] Check all pages display correct copyright year
- [ ] Update legal document dates if policies changed
- [ ] Review and update blog article dates/content
- [ ] Update any "2025" references to "2026" in non-templated content

### Quarterly Reviews

- [ ] Q1 (January-March): Review legal compliance requirements
- [ ] Q2 (April-June): Update privacy policy if features changed
- [ ] Q3 (July-September): Review marketplace policies
- [ ] Q4 (October-December): Prepare year-end updates

## Quick Reference

### Common Tasks

#### Update Legal Document Date

```javascript
// In /config/content-config.js
legalLastUpdated: 'February 2026',
legalEffectiveDate: 'February 2026',
```

#### Add New Placeholder

```javascript
// 1. Add to content-config.js
const contentConfig = {
  // ... existing config
  newField: 'New Value',
};

// 2. Add to getPlaceholders() function
function getPlaceholders() {
  return {
    // ... existing placeholders
    NEW_FIELD: contentConfig.newField,
  };
}

// 3. Use in HTML
<p>{{ NEW_FIELD }}</p>;
```

#### Test Placeholder Rendering

```javascript
// Run this in Node.js REPL or script
const { replacePlaceholders } = require('./utils/template-renderer');
const html = '<p>{{LEGAL_LAST_UPDATED}}</p>';
console.log(replacePlaceholders(html));
// Output: <p>January 2026</p>
```

#### Clear Template Cache (if needed)

```javascript
const { clearCache } = require('./utils/template-renderer');
clearCache();
```

### Files That Use Templates

| File                     | Placeholders Used                                                                 | Purpose                     |
| ------------------------ | --------------------------------------------------------------------------------- | --------------------------- |
| `legal.html`             | LEGAL_LAST_UPDATED, LEGAL_EFFECTIVE_DATE, ADMIN_EMAIL, ABUSE_EMAIL, SUPPORT_EMAIL | Legal hub with all policies |
| `terms.html`             | LEGAL_LAST_UPDATED, LEGAL_EFFECTIVE_DATE, SUPPORT_EMAIL, ABUSE_EMAIL              | Terms of use                |
| `privacy.html`           | LEGAL_LAST_UPDATED, LEGAL_EFFECTIVE_DATE, ADMIN_EMAIL                             | Privacy notice              |
| `data-rights.html`       | LEGAL_LAST_UPDATED, ADMIN_EMAIL                                                   | GDPR data rights            |
| `marketplace-guide.html` | LEGAL_LAST_UPDATED, SUPPORT_EMAIL, ABUSE_EMAIL, COPYRIGHT_YEAR                    | Marketplace user guide      |
| All pages with footers   | COPYRIGHT_YEAR, COMPANY_NAME                                                      | Copyright notice            |

### Template Syntax Rules

1. ✅ **DO**: Use exact placeholder names: `{{CURRENT_YEAR}}`
2. ✅ **DO**: Use uppercase for placeholder names
3. ✅ **DO**: Use underscores for multi-word placeholders
4. ❌ **DON'T**: Use spaces inside braces: `{{ CURRENT_YEAR }}`
5. ❌ **DON'T**: Use different case: `{{current_year}}`
6. ❌ **DON'T**: Misspell placeholder names

### Troubleshooting

**Placeholder not replaced (shows "{{PLACEHOLDER}}" in browser):**

1. Check placeholder name spelling in HTML file
2. Verify placeholder exists in content-config.js
3. Verify placeholder is added to getPlaceholders() function
4. Check template-renderer middleware is loaded in server.js
5. Clear browser cache and reload page

**Changes not appearing after update:**

1. Verify changes saved in content-config.js
2. Restart Node.js server to reload configuration
3. Clear template cache in production (if caching enabled)
4. Check browser cache (hard refresh: Ctrl+Shift+R)

**Template rendering breaks page:**

1. Check for syntax errors in HTML (unclosed tags)
2. Verify placeholder braces are balanced: `{{` and `}}`
3. Check server.js for template middleware errors
4. Review server logs for template rendering errors

## Support

For questions or issues with the content management system:

- **Technical Issues**: Contact development team
- **Content Updates**: Use admin panel or contact {{ADMIN_EMAIL}}
- **Legal Document Questions**: Contact legal team before making changes

## Version History

- **v1.0.0** (January 2026) - Initial content management system
  - Centralized configuration
  - Template rendering middleware
  - Admin panel integration (planned)
  - Comprehensive placeholder system
