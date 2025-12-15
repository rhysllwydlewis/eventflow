# Admin API Documentation

## Authentication

All admin endpoints require:

- Valid JWT token in HTTP-only cookie
- User role: `admin`

## User Management Endpoints

### List All Users

```http
GET /api/admin/users
```

**Response:**

```json
{
  "items": [
    {
      "id": "usr_123",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer",
      "verified": true,
      "marketingOptIn": false,
      "createdAt": "2024-01-15T10:30:00Z",
      "lastLoginAt": "2024-12-09T14:20:00Z"
    }
  ]
}
```

### Edit User Profile

```http
PUT /api/admin/users/:id
Content-Type: application/json

{
  "name": "John Smith",
  "email": "johnsmith@example.com",
  "role": "supplier",
  "verified": true,
  "marketingOptIn": true
}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "usr_123",
    "name": "John Smith",
    "email": "johnsmith@example.com",
    "role": "supplier",
    "verified": true,
    "updatedAt": "2024-12-09T15:00:00Z",
    "lastEditedBy": "adm_456"
  }
}
```

**Version History:**

- All edits are tracked in `user.versionHistory[]`
- Includes timestamp, editor ID, and previous state

### Delete User

```http
DELETE /api/admin/users/:id
```

**Restrictions:**

- Cannot delete your own account
- Cannot delete owner account (admin@event-flow.co.uk)

**Response:**

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Error Response:**

```json
{
  "error": "You cannot delete your own account"
}
```

### Grant Admin Privileges

```http
POST /api/admin/users/:id/grant-admin
```

**Response:**

```json
{
  "success": true,
  "message": "Admin privileges granted successfully",
  "user": {
    "id": "usr_123",
    "email": "john@example.com",
    "role": "admin"
  }
}
```

**Audit Log:** Action logged as `user_role_changed`

### Revoke Admin Privileges

```http
POST /api/admin/users/:id/revoke-admin
Content-Type: application/json

{
  "newRole": "customer"
}
```

**Parameters:**

- `newRole` (required): "customer" or "supplier"

**Restrictions:**

- Cannot revoke your own admin privileges
- Cannot revoke owner account privileges

**Response:**

```json
{
  "success": true,
  "message": "Admin privileges revoked successfully",
  "user": {
    "id": "usr_123",
    "email": "john@example.com",
    "role": "customer"
  }
}
```

### Suspend User

```http
POST /api/admin/users/:id/suspend
Content-Type: application/json

{
  "suspended": true,
  "reason": "Violation of terms of service",
  "duration": "7d"
}
```

**Parameters:**

- `suspended` (boolean): true to suspend, false to unsuspend
- `reason` (string): Reason for suspension
- `duration` (string, optional): "7d", "30d", etc.

**Response:**

```json
{
  "message": "User suspended successfully",
  "user": {
    "id": "usr_123",
    "email": "john@example.com",
    "suspended": true,
    "suspensionReason": "Violation of terms of service"
  }
}
```

### Ban User

```http
POST /api/admin/users/:id/ban
Content-Type: application/json

{
  "banned": true,
  "reason": "Repeated violations"
}
```

**Response:**

```json
{
  "message": "User banned successfully",
  "user": {
    "id": "usr_123",
    "email": "john@example.com",
    "banned": true,
    "banReason": "Repeated violations"
  }
}
```

### Verify User Email

```http
POST /api/admin/users/:id/verify
```

**Response:**

```json
{
  "message": "User verified successfully",
  "user": {
    "id": "usr_123",
    "email": "john@example.com",
    "verified": true
  }
}
```

## Supplier Management Endpoints

### List All Suppliers

```http
GET /api/admin/suppliers
```

**Response:**

```json
{
  "items": [
    {
      "id": "sup_789",
      "name": "Elite Catering",
      "approved": true,
      "isPro": true,
      "proExpiresAt": "2025-01-15T10:30:00Z",
      "healthScore": 85,
      "tags": ["catering", "premium"]
    }
  ]
}
```

### Edit Supplier Profile

```http
PUT /api/admin/suppliers/:id
Content-Type: application/json

{
  "name": "Elite Catering Services",
  "description": "Premium catering for events",
  "contact": {
    "phone": "+44 1234 567890",
    "email": "contact@elitecatering.com"
  },
  "location": {
    "city": "London",
    "postcode": "SW1A 1AA"
  }
}
```

**Response:**

```json
{
  "success": true,
  "supplier": {
    "id": "sup_789",
    "name": "Elite Catering Services",
    "updatedAt": "2024-12-09T15:30:00Z",
    "lastEditedBy": "adm_456"
  }
}
```

### Delete Supplier

```http
DELETE /api/admin/suppliers/:id
```

**Note:** Also deletes all associated packages

**Response:**

```json
{
  "success": true,
  "message": "Supplier and associated packages deleted successfully"
}
```

### Approve/Reject Supplier

```http
POST /api/admin/suppliers/:id/approve
Content-Type: application/json

{
  "approved": true
}
```

**Response:**

```json
{
  "ok": true,
  "supplier": {
    "id": "sup_789",
    "name": "Elite Catering",
    "approved": true
  }
}
```

### Verify Supplier

```http
POST /api/admin/suppliers/:id/verify
Content-Type: application/json

{
  "verified": true,
  "verificationNotes": "Business license verified"
}
```

**Response:**

```json
{
  "message": "Supplier verified successfully",
  "supplier": {
    "id": "sup_789",
    "name": "Elite Catering",
    "verified": true,
    "verificationStatus": "verified"
  }
}
```

### Manage Pro Plan

```http
POST /api/admin/suppliers/:id/pro
Content-Type: application/json

{
  "mode": "duration",
  "duration": "1m"
}
```

**Parameters:**

- `mode`: "duration" to set Pro, "cancel" to remove
- `duration`: "1d", "7d", "1m", "1y"

**Response:**

```json
{
  "ok": true,
  "supplier": {
    "id": "sup_789",
    "isPro": true,
    "proExpiresAt": "2025-01-09T15:00:00Z"
  }
}
```

### Get Pending Supplier Verifications

```http
GET /api/admin/suppliers/pending-verification
```

**Response:**

```json
{
  "suppliers": [
    {
      "id": "sup_790",
      "name": "New Venue",
      "category": "venues",
      "location": "Manchester",
      "createdAt": "2024-12-08T10:00:00Z"
    }
  ],
  "count": 1
}
```

## Package Management Endpoints

### List All Packages

```http
GET /api/admin/packages
```

**Response:**

```json
{
  "items": [
    {
      "id": "pkg_456",
      "title": "Wedding Package Premium",
      "approved": true,
      "featured": false,
      "supplierId": "sup_789"
    }
  ]
}
```

### Edit Package

```http
PUT /api/admin/packages/:id
Content-Type: application/json

{
  "title": "Premium Wedding Package",
  "description": "Complete wedding catering service",
  "price": 5000,
  "features": ["Appetizers", "Main Course", "Desserts"],
  "availability": "year-round"
}
```

**Response:**

```json
{
  "success": true,
  "package": {
    "id": "pkg_456",
    "title": "Premium Wedding Package",
    "updatedAt": "2024-12-09T16:00:00Z",
    "lastEditedBy": "adm_456"
  }
}
```

### Delete Package

```http
DELETE /api/admin/packages/:id
```

**Response:**

```json
{
  "success": true,
  "message": "Package deleted successfully"
}
```

### Approve Package

```http
POST /api/admin/packages/:id/approve
Content-Type: application/json

{
  "approved": true
}
```

**Response:**

```json
{
  "ok": true,
  "package": {
    "id": "pkg_456",
    "approved": true
  }
}
```

### Feature Package

```http
POST /api/admin/packages/:id/feature
Content-Type: application/json

{
  "featured": true
}
```

**Response:**

```json
{
  "ok": true,
  "package": {
    "id": "pkg_456",
    "featured": true
  }
}
```

## Data Export Endpoints

### Export Users (CSV)

```http
GET /api/admin/users-export
```

**Response:** CSV file download

```csv
id,name,email,role,verified,marketingOptIn,createdAt,lastLoginAt
usr_123,John Doe,john@example.com,customer,yes,no,2024-01-15T10:30:00Z,2024-12-09T14:20:00Z
```

### Export Marketing List (CSV)

```http
GET /api/admin/marketing-export
```

**Response:** CSV file with marketing opt-in users only

### Export All Data (JSON)

```http
GET /api/admin/export/all
```

**Response:** JSON file download

```json
{
  "exportedAt": "2024-12-09T16:30:00Z",
  "users": [...],
  "suppliers": [...],
  "packages": [...],
  "plans": [...],
  "notes": [...],
  "events": [...],
  "threads": [...],
  "messages": [...]
}
```

## Metrics Endpoints

### Get Dashboard Metrics

```http
GET /api/admin/metrics
```

**Response:**

```json
{
  "counts": {
    "usersTotal": 150,
    "usersByRole": {
      "admin": 3,
      "supplier": 25,
      "customer": 122
    },
    "suppliersTotal": 25,
    "packagesTotal": 78,
    "plansTotal": 45,
    "messagesTotal": 320,
    "threadsTotal": 95
  }
}
```

### Get Timeseries Data

```http
GET /api/admin/metrics/timeseries
```

**Response:**

```json
{
  "series": [
    {
      "date": "2024-12-01",
      "visitors": 25,
      "signups": 5,
      "plans": 2
    },
    ...
  ]
}
```

## System Administration Endpoints

### Reset Demo Data

```http
POST /api/admin/reset-demo
```

**⚠️ WARNING:** Deletes all data and reseeds demo data

**Response:**

```json
{
  "ok": true
}
```

### Smart Tag Suppliers (Beta)

```http
POST /api/admin/suppliers/smart-tags
```

**Response:**

```json
{
  "ok": true
}
```

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Unauthenticated"
}
```

### 403 Forbidden

```json
{
  "error": "Forbidden"
}
```

### 404 Not Found

```json
{
  "error": "User not found"
}
```

### 400 Bad Request

```json
{
  "error": "Invalid role. Must be customer or supplier"
}
```

## Rate Limiting

Admin endpoints use standard rate limiting:

- Most endpoints: 100 requests per 15 minutes per IP
- Authentication endpoints: 5 requests per 15 minutes per IP

## Audit Logging

All admin actions are automatically logged with:

- Admin ID and email
- Action type
- Target resource
- Timestamp
- Additional details
- IP address and user agent

View audit logs at `/admin-audit.html` or via:

```http
GET /api/admin/audit-logs
```

## Best Practices

1. **Always verify data before deletion**
   - Deletions are permanent
   - Check affected relationships

2. **Use version history**
   - Review edit history before making changes
   - Track who made what changes

3. **Monitor audit logs**
   - Regular reviews for security
   - Track admin privilege changes

4. **Protect sensitive exports**
   - Delete after use
   - Never share via unencrypted channels

5. **Respect user privacy**
   - Only access data when necessary
   - Follow GDPR guidelines
