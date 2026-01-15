# Frontend Migration Guide: Admin API v1 to v2

## Overview

This guide helps frontend developers migrate from the Admin API v1 to v2. The v2 API introduces role-based access control (RBAC) with granular permissions, comprehensive audit logging, and improved batch operations.

## Why Migrate?

### Benefits of Admin API v2

1. **Granular Permissions**: Fine-grained control over admin actions
2. **Better Security**: Complete audit trails and permission validation
3. **Improved Performance**: Permission caching and batch operations
4. **Standardized Responses**: Consistent response format across all endpoints
5. **Enhanced Features**: New endpoints for analytics and system health

### Backward Compatibility

- **v1 endpoints remain functional** - No breaking changes
- **Gradual migration** - Migrate endpoint by endpoint
- **Coexistence** - v1 and v2 can run simultaneously
- **Feature parity** - All v1 features available in v2

## Migration Strategy

### Phase 1: Preparation (Week 1)

1. **Understand Permission System**
   - Review permission definitions
   - Map user roles to permissions
   - Identify required permissions for each action

2. **Update API Client**
   - Add v2 base URL constant
   - Create helper functions for permission checks
   - Implement standardized error handling

3. **Test Infrastructure**
   - Set up test admin accounts with different roles
   - Create test data for permission scenarios
   - Verify CSRF token handling

### Phase 2: Core Migrations (Week 2-3)

Migrate in this order for minimal risk:

1. **Read-only endpoints** (users list, stats) - Lowest risk
2. **User management** (update, ban/unban) - Medium risk
3. **Content moderation** (reviews, photos) - Medium risk
4. **Batch operations** (new feature) - Low risk
5. **Critical operations** (delete, permissions) - Highest risk

### Phase 3: Testing & Rollout (Week 4)

1. **Integration testing** with real admin workflows
2. **Permission validation** for all user roles
3. **Gradual rollout** with feature flags
4. **Monitor audit logs** for issues
5. **Collect feedback** from admin users

## API Changes

### Base URL Change

```javascript
// v1
const API_BASE = '/api/admin';

// v2
const API_BASE_V2 = '/api/v2/admin';
```

### Response Format Change

#### v1 Response Format

```javascript
// Success
{ items: [...] }

// Error
{ error: "Error message" }
```

#### v2 Response Format

```javascript
// Success
{
  success: true,
  data: [...],
  timestamp: "2024-01-13T19:00:00Z"
}

// Error
{
  success: false,
  error: "Error message",
  code: "ERROR_CODE",
  timestamp: "2024-01-13T19:00:00Z"
}
```

### Permission Checks

#### v1 Approach

```javascript
// Simple role check
if (user.role === 'admin') {
  // Allow action
}
```

#### v2 Approach

```javascript
// Granular permission check
if (user.allPermissions?.includes('admin:users:delete')) {
  // Allow action
}
```

## Code Examples

### 1. API Client Setup

```javascript
// api/adminClient.js

const API_BASE_V1 = '/api/admin';
const API_BASE_V2 = '/api/v2/admin';

class AdminAPIClient {
  constructor(useV2 = false) {
    this.baseURL = useV2 ? API_BASE_V2 : API_BASE_V1;
    this.useV2 = useV2;
  }

  // Helper method to get CSRF token
  async getCsrfToken() {
    const response = await fetch('/api/csrf-token');
    const data = await response.json();
    return data.csrfToken;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add CSRF token for state-changing requests
    if (['POST', 'PUT', 'DELETE'].includes(options.method)) {
      const csrfToken = await this.getCsrfToken();
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies
    });

    const data = await response.json();

    // Handle v2 response format
    if (this.useV2) {
      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }
      return data.data;
    }

    // Handle v1 response format
    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  }

  // User methods
  async getUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/users${queryString ? `?${queryString}` : ''}`;
    return this.request(endpoint);
  }

  async getUserById(id) {
    return this.request(`/users/${id}`);
  }

  async updateUser(id, data) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async banUser(id, reason) {
    return this.request(`/users/${id}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Permission methods (v2 only)
  async getPermissions() {
    if (!this.useV2) {
      throw new Error('Permissions API is only available in v2');
    }
    return this.request('/permissions');
  }

  async getRoles() {
    if (!this.useV2) {
      throw new Error('Roles API is only available in v2');
    }
    return this.request('/roles');
  }

  async grantPermission(userId, permission) {
    if (!this.useV2) {
      throw new Error('Permission management is only available in v2');
    }
    return this.request(`/users/${userId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ permission }),
    });
  }

  // Batch operations (v2 only)
  async batchApprove(type, ids) {
    if (!this.useV2) {
      throw new Error('Batch operations are only available in v2');
    }
    return this.request('/bulk-actions', {
      method: 'POST',
      body: JSON.stringify({
        action: 'approve',
        type,
        ids,
      }),
    });
  }

  // Audit log (v2 only)
  async getAuditLogs(filters = {}) {
    if (!this.useV2) {
      throw new Error('Audit logs are only available in v2');
    }
    const queryString = new URLSearchParams(filters).toString();
    const endpoint = `/audit-log${queryString ? `?${queryString}` : ''}`;
    return this.request(endpoint);
  }

  // Dashboard (v2 only)
  async getDashboardOverview() {
    if (!this.useV2) {
      throw new Error('Dashboard API is only available in v2');
    }
    return this.request('/dashboard/overview');
  }
}

// Export instances
export const adminAPIv1 = new AdminAPIClient(false);
export const adminAPIv2 = new AdminAPIClient(true);

// Feature flag for gradual rollout
export const adminAPI = process.env.USE_ADMIN_V2 === 'true' ? adminAPIv2 : adminAPIv1;
```

### 2. Permission Helper

```javascript
// utils/permissions.js

/**
 * Check if user has a specific permission
 */
export function hasPermission(user, permission) {
  if (!user) return false;

  // Owner always has all permissions
  if (user.isOwner || user.email === 'admin@event-flow.co.uk') {
    return true;
  }

  // Check if user has the permission
  return user.allPermissions?.includes(permission) || false;
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(user, permissions) {
  if (!user) return false;
  if (user.isOwner) return true;

  return permissions.some(permission => hasPermission(user, permission));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(user, permissions) {
  if (!user) return false;
  if (user.isOwner) return true;

  return permissions.every(permission => hasPermission(user, permission));
}

/**
 * Permission constants
 */
export const PERMISSIONS = {
  USERS_READ: 'admin:users:read',
  USERS_CREATE: 'admin:users:create',
  USERS_UPDATE: 'admin:users:update',
  USERS_DELETE: 'admin:users:delete',
  USERS_BAN: 'admin:users:ban',
  USERS_GRANT_ADMIN: 'admin:users:grant-admin',
  USERS_REVOKE_ADMIN: 'admin:users:revoke-admin',

  SUPPLIERS_READ: 'admin:suppliers:read',
  SUPPLIERS_UPDATE: 'admin:suppliers:update',
  SUPPLIERS_DELETE: 'admin:suppliers:delete',
  SUPPLIERS_VERIFY: 'admin:suppliers:verify',

  PACKAGES_READ: 'admin:packages:read',
  PACKAGES_UPDATE: 'admin:packages:update',
  PACKAGES_DELETE: 'admin:packages:delete',
  PACKAGES_FEATURE: 'admin:packages:feature',

  REVIEWS_READ: 'admin:reviews:read',
  REVIEWS_APPROVE: 'admin:reviews:approve',
  REVIEWS_REJECT: 'admin:reviews:reject',

  PHOTOS_READ: 'admin:photos:read',
  PHOTOS_APPROVE: 'admin:photos:approve',
  PHOTOS_REJECT: 'admin:photos:reject',

  SYSTEM_AUDIT_LOG: 'admin:system:audit-log',
  SYSTEM_HEALTH: 'admin:system:health',
  SYSTEM_METRICS: 'admin:system:metrics',

  AUDIT_READ: 'admin:audit:read',
};
```

### 3. React Component Example

```jsx
// components/AdminUserList.jsx
import React, { useState, useEffect } from 'react';
import { adminAPIv2 } from '../api/adminClient';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

export function AdminUserList({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Check if user can view users
  const canRead = hasPermission(currentUser, PERMISSIONS.USERS_READ);
  const canUpdate = hasPermission(currentUser, PERMISSIONS.USERS_UPDATE);
  const canDelete = hasPermission(currentUser, PERMISSIONS.USERS_DELETE);
  const canBan = hasPermission(currentUser, PERMISSIONS.USERS_BAN);

  useEffect(() => {
    if (!canRead) {
      setError('You do not have permission to view users');
      setLoading(false);
      return;
    }

    loadUsers();
  }, [page]);

  async function loadUsers() {
    try {
      setLoading(true);
      const response = await adminAPIv2.request('/users', {
        params: { page, limit: 50 },
      });

      setUsers(response.data);
      setPagination(response.pagination);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBanUser(userId, reason) {
    if (!canBan) {
      alert('You do not have permission to ban users');
      return;
    }

    try {
      await adminAPIv2.banUser(userId, reason);
      await loadUsers(); // Reload list
      alert('User banned successfully');
    } catch (err) {
      alert(`Failed to ban user: ${err.message}`);
    }
  }

  async function handleDeleteUser(userId) {
    if (!canDelete) {
      alert('You do not have permission to delete users');
      return;
    }

    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await adminAPIv2.deleteUser(userId);
      await loadUsers();
      alert('User deleted successfully');
    } catch (err) {
      alert(`Failed to delete user: ${err.message}`);
    }
  }

  if (!canRead) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (loading) {
    return <div>Loading users...</div>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <div>
      <h2>Users</h2>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Verified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>{user.verified ? 'Yes' : 'No'}</td>
              <td>
                {canUpdate && (
                  <button
                    onClick={() => handleEditUser(user.id)}
                    className="btn btn-sm btn-primary"
                  >
                    Edit
                  </button>
                )}
                {canBan && (
                  <button
                    onClick={() => handleBanUser(user.id, 'Manual ban')}
                    className="btn btn-sm btn-warning"
                  >
                    Ban
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="btn btn-sm btn-danger"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {pagination && (
        <div className="pagination">
          <button disabled={!pagination.hasPrevPage} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button disabled={!pagination.hasNextPage} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

### 4. Batch Operations Example

```javascript
// Migrate from individual approvals to batch operations

// v1 Approach (slow)
async function approvePackagesV1(packageIds) {
  const results = [];

  for (const id of packageIds) {
    try {
      await fetch(`/api/admin/packages/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      results.push({ id, success: true });
    } catch (error) {
      results.push({ id, success: false, error: error.message });
    }
  }

  return results;
}

// v2 Approach (fast - single request)
async function approvePackagesV2(packageIds) {
  try {
    const result = await adminAPIv2.batchApprove('packages', packageIds);
    return {
      success: true,
      approved: result.approved,
      failed: result.failed,
      errors: result.errors,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
```

## Testing Checklist

### Unit Tests

- [ ] Permission helper functions
- [ ] API client methods
- [ ] Error handling

### Integration Tests

- [ ] User list with pagination
- [ ] User CRUD operations
- [ ] Permission-based UI rendering
- [ ] Batch operations
- [ ] Audit log viewing

### Manual Testing

- [ ] Test with owner account
- [ ] Test with admin account
- [ ] Test with moderator account
- [ ] Test with support account
- [ ] Test permission denied scenarios
- [ ] Verify audit logs are created
- [ ] Check performance improvements

## Common Migration Issues

### Issue 1: CSRF Token Errors

**Problem**: Getting 403 CSRF errors on POST/PUT/DELETE requests

**Solution**: Ensure CSRF token is included in headers

```javascript
const csrfToken = await getCsrfToken();
headers['X-CSRF-Token'] = csrfToken;
```

### Issue 2: Permission Denied

**Problem**: Getting permission denied errors after migration

**Solution**:

1. Check user has correct permissions
2. Verify permission constant matches backend
3. Check if user needs to log out/in to refresh permissions

### Issue 3: Response Format Changes

**Problem**: Code expecting v1 format breaks with v2

**Solution**: Update response handling

```javascript
// Before (v1)
const users = response.items;

// After (v2)
const users = response.data;
```

### Issue 4: Pagination Changes

**Problem**: Pagination metadata different in v2

**Solution**: Update pagination logic

```javascript
// v1 used custom pagination
// v2 uses standard pagination object
const { page, limit, total, totalPages, hasNextPage, hasPrevPage } = response.pagination;
```

## Rollback Plan

If issues occur:

1. **Immediate Rollback**

   ```javascript
   // In .env or config
   USE_ADMIN_V2 = false;
   ```

2. **Partial Rollback**
   - Keep working endpoints on v2
   - Revert problematic endpoints to v1
   - Fix issues and re-migrate

3. **Data Consistency**
   - Audit logs continue to work
   - No data loss between versions
   - User permissions persist

## Performance Improvements

### Expected Gains

1. **Permission Checks**: 30%+ faster (caching)
2. **Batch Operations**: 10x+ faster for bulk actions
3. **Dashboard Load**: 20%+ faster (optimized queries)
4. **User List**: Pagination reduces initial load time

### Monitoring

Monitor these metrics before and after migration:

- API response times
- Number of database queries
- Cache hit rates
- Error rates
- User experience scores

## Support & Resources

- **API Documentation**: `/ADMIN_API_V2.md`
- **Permission System**: See `middleware/permissions.js`
- **Example Code**: See `tests/integration/admin-v2-rbac.test.js`
- **Audit Logs**: Available at `/api/v2/admin/audit-log`

## Timeline

| Week | Focus                        | Status |
| ---- | ---------------------------- | ------ |
| 1    | Preparation & planning       | ✅     |
| 2    | Read-only endpoint migration | ⏳     |
| 3    | Write endpoint migration     | ⏳     |
| 4    | Testing & rollout            | ⏳     |

## Conclusion

Migrating to Admin API v2 provides significant benefits in security, performance, and maintainability. Follow this guide step-by-step for a smooth migration with minimal risk.

For questions or issues, please contact the backend team or refer to the API documentation.
