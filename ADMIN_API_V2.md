# Admin API v2 - RBAC System Documentation

## Overview

The Admin API v2 provides a comprehensive role-based access control (RBAC) system with granular permissions, complete audit logging, and unified admin operations. This API is designed to coexist with the existing admin API (v1) to ensure zero breaking changes.

## Base URL

```
/api/v2/admin
```

## Authentication

All endpoints require authentication via JWT cookie. The user must be authenticated and have the appropriate permissions.

### Headers

```http
Cookie: token=<jwt_token>
X-CSRF-Token: <csrf_token>  # Required for POST, PUT, DELETE requests
```

## Permission System

### Permissions

The system defines granular permissions organized by resource type:

#### User Permissions
- `admin:users:read` - View user details
- `admin:users:create` - Create new users
- `admin:users:update` - Update user information
- `admin:users:delete` - Delete users
- `admin:users:ban` - Ban/unban users
- `admin:users:grant-admin` - Grant admin privileges
- `admin:users:revoke-admin` - Revoke admin privileges

#### Supplier Permissions
- `admin:suppliers:read` - View supplier details
- `admin:suppliers:update` - Update supplier information
- `admin:suppliers:delete` - Delete suppliers
- `admin:suppliers:verify` - Manually verify suppliers

#### Package Permissions
- `admin:packages:read` - View package details
- `admin:packages:update` - Update package information
- `admin:packages:delete` - Delete packages
- `admin:packages:feature` - Feature/unfeature packages

#### Review Permissions
- `admin:reviews:read` - View reviews
- `admin:reviews:approve` - Approve reviews
- `admin:reviews:reject` - Reject reviews

#### Photo Permissions
- `admin:photos:read` - View photos
- `admin:photos:approve` - Approve photos
- `admin:photos:reject` - Reject photos

#### System Permissions
- `admin:system:audit-log` - View system audit logs
- `admin:system:health` - View system health
- `admin:system:metrics` - View system metrics

#### Audit Permissions
- `admin:audit:read` - View audit logs

### Roles

The system defines four roles with predefined permission sets:

#### Owner
- **Description**: Platform owner with all permissions
- **Permissions**: All permissions
- **Can Be Revoked**: No
- **Identification**: User with email `admin@event-flow.co.uk` or `isOwner: true`

#### Admin
- **Description**: Full operational access to all features
- **Permissions**: All permissions
- **Can Be Revoked**: Yes

#### Moderator
- **Description**: Content moderation and review management
- **Permissions**:
  - `admin:reviews:read`
  - `admin:reviews:approve`
  - `admin:reviews:reject`
  - `admin:photos:read`
  - `admin:photos:approve`
  - `admin:photos:reject`
  - `admin:suppliers:read`
  - `admin:packages:read`
- **Can Be Revoked**: Yes

#### Support
- **Description**: User support and read-only access
- **Permissions**:
  - `admin:users:read`
  - `admin:audit:read`
- **Can Be Revoked**: Yes

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-13T19:00:00Z"
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

## API Endpoints

### Permission Management

#### GET /api/v2/admin/permissions

Get all available permissions.

**Required Permission**: `admin` role

**Response**:
```json
{
  "success": true,
  "data": [
    "admin:users:read",
    "admin:users:create",
    ...
  ],
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### GET /api/v2/admin/roles

Get all roles with their permissions.

**Required Permission**: `admin` role

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "admin",
      "name": "Administrator",
      "description": "Full operational access to all features",
      "permissions": [...],
      "canBeRevoked": true
    },
    ...
  ],
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### GET /api/v2/admin/roles/:role/permissions

Get permissions for a specific role.

**Required Permission**: `admin` role

**Parameters**:
- `role` (path) - Role ID (owner, admin, moderator, support)

**Response**:
```json
{
  "success": true,
  "data": {
    "role": "moderator",
    "name": "Moderator",
    "permissions": [
      "admin:reviews:read",
      "admin:reviews:approve",
      ...
    ]
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### POST /api/v2/admin/users/:id/permissions

Grant a specific permission to a user.

**Required Permission**: `admin:users:grant-admin`

**Parameters**:
- `id` (path) - User ID

**Request Body**:
```json
{
  "permission": "admin:reviews:read"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "usr_123",
    "email": "user@example.com",
    "customPermissions": [
      "admin:reviews:read"
    ]
  },
  "message": "Permission granted successfully",
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### DELETE /api/v2/admin/users/:id/permissions/:permission

Revoke a permission from a user.

**Required Permission**: `admin:users:revoke-admin`

**Parameters**:
- `id` (path) - User ID
- `permission` (path) - Permission to revoke

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "usr_123",
    "email": "user@example.com",
    "customPermissions": []
  },
  "message": "Permission revoked successfully",
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

### User Management

#### GET /api/v2/admin/users

List users with filters and pagination.

**Required Permission**: `admin:users:read`

**Query Parameters**:
- `role` (optional) - Filter by role (customer, supplier, admin)
- `verified` (optional) - Filter by verification status (true, false)
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Results per page (default: 50, max: 100)
- `sortBy` (optional) - Sort field (default: createdAt)
- `sortOrder` (optional) - Sort order (asc, desc) (default: desc)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "usr_123",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer",
      "verified": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "lastLoginAt": "2024-01-13T10:00:00Z",
      "customPermissions": []
    },
    ...
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### GET /api/v2/admin/users/:id

Get user details including all permissions.

**Required Permission**: `admin:users:read`

**Parameters**:
- `id` (path) - User ID

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "usr_123",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "moderator",
    "verified": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-01-13T10:00:00Z",
    "customPermissions": ["admin:packages:read"],
    "allPermissions": [
      "admin:reviews:read",
      "admin:reviews:approve",
      "admin:packages:read",
      ...
    ]
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### PUT /api/v2/admin/users/:id

Update user information.

**Required Permission**: `admin:users:update`

**Parameters**:
- `id` (path) - User ID

**Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "admin"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "usr_123",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "admin"
  },
  "message": "User updated successfully",
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### DELETE /api/v2/admin/users/:id

Delete a user. Cannot delete own account.

**Required Permission**: `admin:users:delete`

**Parameters**:
- `id` (path) - User ID

**Response**:
```json
{
  "success": true,
  "message": "User deleted successfully",
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### POST /api/v2/admin/users/:id/ban

Ban a user from the platform.

**Required Permission**: `admin:users:ban`

**Parameters**:
- `id` (path) - User ID

**Request Body**:
```json
{
  "reason": "Violation of terms of service"
}
```

**Response**:
```json
{
  "success": true,
  "message": "User banned successfully",
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### POST /api/v2/admin/users/:id/unban

Unban a user.

**Required Permission**: `admin:users:ban`

**Parameters**:
- `id` (path) - User ID

**Response**:
```json
{
  "success": true,
  "message": "User unbanned successfully",
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

### Supplier Management

#### GET /api/v2/admin/suppliers

List suppliers with filters and pagination.

**Required Permission**: `admin:suppliers:read`

**Query Parameters**:
- `approved` (optional) - Filter by approval status (true, false)
- `category` (optional) - Filter by category
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Results per page (default: 50)

**Response**: Similar to users list with supplier-specific fields

---

#### PUT /api/v2/admin/suppliers/:id

Update supplier information.

**Required Permission**: `admin:suppliers:update`

**Parameters**:
- `id` (path) - Supplier ID

**Request Body**: Supplier fields to update

---

#### DELETE /api/v2/admin/suppliers/:id

Delete a supplier.

**Required Permission**: `admin:suppliers:delete`

---

#### POST /api/v2/admin/suppliers/:id/verify

Manually verify a supplier.

**Required Permission**: `admin:suppliers:verify`

---

### Package Management

#### GET /api/v2/admin/packages

List packages with filters and pagination.

**Required Permission**: `admin:packages:read`

**Query Parameters**:
- `approved` (optional) - Filter by approval status
- `featured` (optional) - Filter by featured status
- `supplierId` (optional) - Filter by supplier ID
- `page` (optional) - Page number
- `limit` (optional) - Results per page

---

#### PUT /api/v2/admin/packages/:id

Update package information.

**Required Permission**: `admin:packages:update`

---

#### DELETE /api/v2/admin/packages/:id

Delete a package.

**Required Permission**: `admin:packages:delete`

---

#### POST /api/v2/admin/packages/batch-approve

Approve multiple packages at once.

**Required Permission**: `admin:packages:update`

**Request Body**:
```json
{
  "ids": ["pkg_123", "pkg_456", "pkg_789"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "approved": 3,
    "failed": 0,
    "errors": []
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

### Review Moderation

#### GET /api/v2/admin/reviews/pending

Get all pending or flagged reviews.

**Required Permission**: `admin:reviews:read`

**Response**:
```json
{
  "success": true,
  "data": [...],
  "count": 5,
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### POST /api/v2/admin/reviews/:id/approve

Approve a review.

**Required Permission**: `admin:reviews:approve`

---

#### POST /api/v2/admin/reviews/:id/reject

Reject a review.

**Required Permission**: `admin:reviews:reject`

**Request Body**:
```json
{
  "reason": "Review does not meet quality standards"
}
```

---

### Photo Moderation

#### GET /api/v2/admin/photos/pending

Get all pending photos awaiting approval.

**Required Permission**: `admin:photos:read`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "url": "/uploads/photo.jpg",
      "type": "supplier",
      "supplierId": "sup_123",
      "supplierName": "Example Supplier",
      "uploadedAt": 1234567890,
      "uploadedBy": "usr_456",
      "approved": false
    },
    ...
  ],
  "count": 10,
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### POST /api/v2/admin/photos/batch-action

Bulk approve or reject photos.

**Required Permission**: `admin:photos:approve`

**Request Body**:
```json
{
  "action": "approve",  // or "reject"
  "photos": [
    {
      "type": "supplier",
      "supplierId": "sup_123",
      "url": "/uploads/photo1.jpg"
    },
    ...
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "processed": 5,
    "failed": 0,
    "errors": []
  },
  "message": "5 photo(s) approved successfully",
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

### Dashboard & Analytics

#### GET /api/v2/admin/dashboard/overview

Get dashboard overview with key metrics.

**Required Permission**: `admin:system:metrics`

**Response**:
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1500,
      "active": 450,
      "newLast7Days": 25,
      "newLast30Days": 120,
      "verified": 1200,
      "admins": 5
    },
    "suppliers": {
      "total": 150,
      "approved": 120,
      "pending": 30,
      "pro": 45
    },
    "packages": {
      "total": 500,
      "approved": 450,
      "pending": 50,
      "featured": 20
    },
    "reviews": {
      "total": 800,
      "approved": 750,
      "pending": 50
    },
    "activity": {
      "recentActions": [...],
      "totalActionsLast7Days": 150
    }
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### GET /api/v2/admin/dashboard/metrics

Get detailed metrics for analytics.

**Required Permission**: `admin:system:metrics`

**Response**:
```json
{
  "success": true,
  "data": {
    "users": {
      "byRole": {
        "customer": 1200,
        "supplier": 150,
        "admin": 5
      },
      "signupsByMonth": {
        "2024-01": 50,
        "2024-02": 75,
        ...
      },
      "verificationRate": 85.5
    },
    "suppliers": {
      "byCategory": {
        "Venues": 50,
        "Catering": 30,
        ...
      },
      "approvalRate": 80.0
    },
    "packages": {
      "avgPerSupplier": "3.33",
      "total": 500
    },
    "reviews": {
      "avgPerSupplier": "5.33",
      "byRating": {
        "5": 400,
        "4": 250,
        ...
      },
      "total": 800
    }
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### GET /api/v2/admin/system-health

Get system health diagnostics.

**Required Permission**: `admin:system:health`

**Response**:
```json
{
  "success": true,
  "data": {
    "database": {
      "type": "mongodb",
      "state": "connected",
      "initialized": true
    },
    "collections": {
      "users": 1500,
      "suppliers": 150,
      "packages": 500
    },
    "server": {
      "uptime": 86400,
      "memory": {
        "rss": 125000000,
        "heapTotal": 75000000,
        "heapUsed": 50000000
      },
      "nodeVersion": "v20.10.0"
    }
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

### Audit & Logging

#### GET /api/v2/admin/audit-log

Query audit logs with filters and pagination.

**Required Permission**: `admin:audit:read`

**Query Parameters**:
- `actorId` (optional) - Filter by actor ID
- `actorEmail` (optional) - Filter by actor email
- `action` (optional) - Filter by action type
- `resourceType` (optional) - Filter by resource type
- `resourceId` (optional) - Filter by resource ID
- `startDate` (optional) - Start date (ISO string)
- `endDate` (optional) - End date (ISO string)
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Results per page (default: 50)
- `sortBy` (optional) - Sort field (default: timestamp)
- `sortOrder` (optional) - Sort order (default: desc)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "audit_123",
      "actor": {
        "id": "usr_admin",
        "email": "admin@example.com",
        "role": "admin"
      },
      "action": "USER_UPDATED",
      "resource": {
        "type": "user",
        "id": "usr_123"
      },
      "changes": {
        "role": {
          "before": "customer",
          "after": "admin"
        }
      },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2024-01-13T19:00:00Z"
    },
    ...
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### GET /api/v2/admin/audit-log/:id

Get a specific audit log entry by ID.

**Required Permission**: `admin:audit:read`

---

#### GET /api/v2/admin/audit-log/user/:userId

Get all audit logs for a specific user.

**Required Permission**: `admin:audit:read`

**Query Parameters**:
- `page` (optional) - Page number
- `limit` (optional) - Results per page

---

#### GET /api/v2/admin/audit-log/statistics

Get audit log statistics.

**Required Permission**: `admin:audit:read`

**Query Parameters**:
- `startDate` (optional) - Start date for statistics
- `endDate` (optional) - End date for statistics

**Response**:
```json
{
  "success": true,
  "data": {
    "totalLogs": 1500,
    "actionCounts": {
      "USER_UPDATED": 150,
      "SUPPLIER_APPROVED": 100,
      ...
    },
    "resourceTypeCounts": {
      "user": 500,
      "supplier": 300,
      ...
    },
    "topActors": [
      {
        "actorId": "usr_admin",
        "actorEmail": "admin@example.com",
        "count": 250
      },
      ...
    ],
    "dateRange": {
      "earliest": "2024-01-01T00:00:00Z",
      "latest": "2024-01-13T19:00:00Z"
    }
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

### Batch Operations

#### POST /api/v2/admin/bulk-actions

Perform batch operations on multiple items.

**Required Permission**: `admin` role

**Request Body**:
```json
{
  "action": "approve",  // or "reject", "delete"
  "type": "packages",   // or "suppliers", "reviews", "users"
  "ids": ["pkg_123", "pkg_456", "pkg_789"],
  "reason": "Optional reason for reject action"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "approved": 3,
    "failed": 0,
    "errors": []
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

### Cache Management

#### GET /api/v2/admin/permission-cache/stats

Get permission cache statistics (for debugging).

**Required Permission**: `admin` role

**Response**:
```json
{
  "success": true,
  "data": {
    "size": 15,
    "ttl": 300000
  },
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

#### POST /api/v2/admin/permission-cache/clear

Clear permission cache (all or specific user).

**Required Permission**: `admin` role

**Request Body**:
```json
{
  "userId": "usr_123"  // Optional: clear specific user's cache
}
```

**Response**:
```json
{
  "success": true,
  "message": "Cache cleared for user usr_123",
  "timestamp": "2024-01-13T19:00:00Z"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `AUTHENTICATION_REQUIRED` | User is not authenticated |
| `PERMISSION_DENIED` | User lacks required permission |
| `USER_NOT_FOUND` | User ID not found |
| `SUPPLIER_NOT_FOUND` | Supplier ID not found |
| `PACKAGE_NOT_FOUND` | Package ID not found |
| `REVIEW_NOT_FOUND` | Review ID not found |
| `ROLE_NOT_FOUND` | Role not found |
| `INVALID_INPUT` | Invalid request parameters |
| `INVALID_ACTION` | Invalid batch action |
| `CANNOT_DELETE_SELF` | Cannot delete own account |
| `GRANT_PERMISSION_FAILED` | Failed to grant permission |
| `REVOKE_PERMISSION_FAILED` | Failed to revoke permission |
| `LIST_USERS_FAILED` | Failed to list users |
| `GET_USER_FAILED` | Failed to get user details |
| `UPDATE_USER_FAILED` | Failed to update user |
| `DELETE_USER_FAILED` | Failed to delete user |
| `BAN_USER_FAILED` | Failed to ban user |
| `UNBAN_USER_FAILED` | Failed to unban user |

## Migration Guide

### From Admin API v1 to v2

The Admin API v2 is designed to coexist with v1. No immediate migration is required.

**Key Differences:**

1. **Permission System**: v2 uses granular permissions instead of role-only checks
2. **Audit Logging**: v2 provides comprehensive audit trails
3. **Batch Operations**: v2 supports batch operations for efficiency
4. **Response Format**: v2 uses standardized response format with `success` flag

**Migration Steps:**

1. Update frontend to use v2 endpoints gradually
2. Leverage new batch operations for improved performance
3. Utilize audit logs for compliance and monitoring
4. Test permission system with different user roles
5. Once confident, deprecate v1 endpoints

## Performance Considerations

1. **Permission Caching**: User permissions are cached for 5 minutes to reduce database queries
2. **Pagination**: All list endpoints support pagination to handle large datasets
3. **Batch Operations**: Use batch endpoints instead of individual requests for better performance
4. **Audit Logs**: Audit log creation is asynchronous to avoid blocking requests

## Security Best Practices

1. **Always validate CSRF tokens** on state-changing operations
2. **Use HTTPS** in production to protect JWT cookies
3. **Regularly review audit logs** for suspicious activity
4. **Implement rate limiting** on API endpoints
5. **Clear permission cache** when granting/revoking permissions manually
6. **Never expose JWT secret** or other sensitive configuration

## Support

For issues or questions, please refer to:
- [GitHub Issues](https://github.com/rhysllwydlewis/eventflow/issues)
- [API Documentation](https://event-flow.co.uk/api-docs)
