# EventFlow Admin Guide

## Overview

This guide covers all administrative operations available in the EventFlow admin dashboard.

## Accessing the Admin Dashboard

### Requirements

- Admin role privileges
- Valid authentication cookie
- Access to `/admin.html`

### Owner Account

The owner account (`admin@event-flow.co.uk`) has special protections:

- Cannot be deleted
- Cannot have admin privileges revoked
- Always maintains admin status

## Admin Dashboard Features

### 1. User Management

#### Viewing Users

- Navigate to the **Users** section on the admin dashboard
- All users are displayed with:
  - Name
  - Email
  - Role (customer, supplier, admin)
  - Verification status
  - Join date
  - Last login date

#### User Actions

**Edit User**

- Click "Edit" button next to any user
- Update name and email address
- Changes are logged in audit trail

**Delete User**

- Click "Delete" button next to any user
- Confirmation required
- Cannot delete:
  - Your own account
  - Owner account (admin@event-flow.co.uk)
- Deletes user permanently from the system

**Grant Admin Privileges**

- Click "Grant Admin" button next to non-admin users
- User gains full admin access
- Action is logged in audit trail

**Revoke Admin Privileges**

- Click "Revoke Admin" button next to admin users
- Select new role (customer or supplier)
- Cannot revoke from:
  - Your own account
  - Owner account
- Action is logged in audit trail

**Resend Verification Email**

- Available for unverified users only
- Click "Resend Verification" button in the Actions column
- Confirmation dialog appears before sending
- Generates new verification token (24-hour expiry)
- Previous token is invalidated
- User receives email with new verification link
- Action is logged in audit trail
- Toast notification shows success/failure

**When to Use:**

- User reports not receiving verification email
- Verification link has expired
- User accidentally deleted verification email
- Email was sent to wrong address (must first edit user's email)

### 2. Supplier Management

#### Viewing Suppliers

- All suppliers displayed with:
  - Name
  - Approval status
  - Pro plan status
  - Health score
  - Tags

#### Supplier Actions

**Edit Supplier**

- Click "Edit" button (currently prompts for future implementation)
- Full edit modal coming in future update

**Approve/Reject Supplier**

- Click "Approve" or "Reject" buttons
- Controls supplier visibility on platform

**Delete Supplier**

- Click "Delete" button
- Removes supplier and all associated packages
- Confirmation required
- Action cannot be undone

**Manage Pro Plan**

- Select duration from dropdown (1 day, 7 days, 1 month, 1 year)
- Click "Set" to activate Pro trial
- Click "Cancel" to remove Pro status
- Changes are logged

### 3. Package Management

#### Package Actions

**Edit Package**

- Click "Edit" button (currently prompts for future implementation)
- Full edit modal coming in future update

**Approve/Unapprove Package**

- Click "Approve" or "Unapprove" buttons
- Controls package visibility

**Feature/Unfeature Package**

- Click "Feature" or "Unfeature" buttons
- Featured packages appear prominently on platform

**Delete Package**

- Click "Delete" button
- Removes package permanently
- Confirmation required

### 4. Photo Moderation

**Access:** Click "Review Photos" from admin dashboard or navigate to `/admin-photos.html`

**Features:**

- View all pending photos in grid layout
- Approve or reject individual photos
- Batch operations for multiple photos
- Filter by status (pending, approved, rejected)
- Search by supplier name

### 5. Review Moderation

**Access:** Click "Review Reviews" from admin dashboard

**Features:**

- View all pending reviews
- See rating and comment
- Approve or reject reviews
- Modal interface for review moderation

### 6. Reports Queue

**Access:** Click "Review Reports" or navigate to `/admin-reports.html`

**Features:**

- View reported content
- Resolve or dismiss reports
- Track report status

### 7. Audit Log

**Access:** Click "Audit Log" or navigate to `/admin-audit.html`

**Tracked Actions:**

- User deletions
- Admin privilege grants/revocations
- Supplier deletions
- Package deletions
- User suspensions/bans
- Supplier verifications
- All moderation actions

Each log entry includes:

- Admin who performed action
- Timestamp
- Action type
- Target resource
- Additional details

## Data Export

### User Export (CSV)

- Click "Download users CSV"
- Contains all user data except passwords
- Includes: name, email, role, verified status, marketing opt-in

### Marketing Export (CSV)

- Click "Download marketing CSV"
- Contains only users who opted into marketing
- Useful for email campaigns

### Full Export (JSON)

- Click "Download full export (JSON)"
- Complete database export
- Includes: users, suppliers, packages, plans, notes, events, messages

## Search and Filtering

### User Search

- Search by name or email
- Filter by join date (last 7 days, last 30 days, all time)
- Results update in real-time

### Photo Filtering

- Filter by status (pending, approved, rejected)
- Search by supplier name
- Batch selection for bulk operations

## System Administration

### Demo Reset

- Click "Reset demo data"
- Clears all collections
- Re-seeds with fresh demo data
- **WARNING:** Destroys all existing data

### Smart Tagging (Beta)

- Click "Run smart tagging (beta)"
- Automatically tags suppliers based on their profiles
- Experimental feature

## Security Best Practices

1. **Regular Audits**
   - Review audit logs weekly
   - Monitor for suspicious activity
   - Track admin privilege changes

2. **Data Protection**
   - Only export data when necessary
   - Securely store exported files
   - Delete exports after use

3. **User Privacy**
   - Respect GDPR requirements
   - Only access user data when required
   - Document reasons for account modifications

4. **Admin Privileges**
   - Grant admin access sparingly
   - Regularly review admin users
   - Revoke access when no longer needed

## API Endpoints

All admin endpoints require authentication and admin role.

### User Management

- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/:id` - Edit user profile
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/users/:id/grant-admin` - Grant admin privileges
- `POST /api/admin/users/:id/revoke-admin` - Revoke admin privileges
- `POST /api/admin/users/:id/suspend` - Suspend user
- `POST /api/admin/users/:id/ban` - Ban user
- `POST /api/admin/users/:id/verify` - Verify user email
- `POST /api/admin/users/:userId/resend-verification` - Resend verification email

### Supplier Management

- `GET /api/admin/suppliers` - List all suppliers
- `PUT /api/admin/suppliers/:id` - Edit supplier profile
- `DELETE /api/admin/suppliers/:id` - Delete supplier
- `POST /api/admin/suppliers/:id/approve` - Approve/reject supplier
- `POST /api/admin/suppliers/:id/verify` - Verify supplier
- `POST /api/admin/suppliers/:id/pro` - Manage Pro plan
- `GET /api/admin/suppliers/pending-verification` - Get pending suppliers

### Package Management

- `GET /api/admin/packages` - List all packages
- `PUT /api/admin/packages/:id` - Edit package
- `DELETE /api/admin/packages/:id` - Delete package
- `POST /api/admin/packages/:id/approve` - Approve package
- `POST /api/admin/packages/:id/feature` - Feature package

### Data Export

- `GET /api/admin/users-export` - Export users as CSV
- `GET /api/admin/marketing-export` - Export marketing list as CSV
- `GET /api/admin/export/all` - Export all data as JSON

### Metrics

- `GET /api/admin/metrics` - Get dashboard metrics
- `GET /api/admin/metrics/timeseries` - Get time-series data

## Troubleshooting

### "Review Photos" Link Not Working

- Ensure you're logged in as admin
- Clear browser cache
- Check browser console for errors
- Verify admin role in user profile

### Cannot Delete User

- Cannot delete your own account
- Cannot delete owner account
- Ensure proper admin privileges

### Exports Not Downloading

- Check popup blocker settings
- Verify admin authentication
- Try different browser

## Support

For additional help or to report issues:

- Check audit logs for action history
- Review browser console for errors
- Contact system administrator
