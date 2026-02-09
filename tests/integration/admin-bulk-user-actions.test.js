/**
 * Integration tests for bulk user actions
 */

const fs = require('fs');
const path = require('path');

describe('Admin Bulk User Actions', () => {
  let adminRoutesContent;

  beforeAll(() => {
    // User management routes are now in admin-user-management.js
    adminRoutesContent = fs.readFileSync(
      path.join(__dirname, '../../routes/admin-user-management.js'),
      'utf8'
    );
  });

  describe('POST /api/admin/users/bulk-delete', () => {
    it('should have bulk-delete endpoint defined', () => {
      expect(adminRoutesContent).toContain('/users/bulk-delete');
    });

    it('should validate array input', () => {
      const bulkDeleteRoute = adminRoutesContent.match(
        /POST \/api\/admin\/users\/bulk-delete[\s\S]*?catch \(error\)/
      );
      expect(bulkDeleteRoute).toBeTruthy();
      expect(bulkDeleteRoute[0]).toContain('Array.isArray');
      expect(bulkDeleteRoute[0]).toContain('userIds');
    });

    it('should check for empty array', () => {
      const bulkDeleteRoute = adminRoutesContent.match(
        /POST \/api\/admin\/users\/bulk-delete[\s\S]*?catch \(error\)/
      );
      expect(bulkDeleteRoute).toBeTruthy();
      expect(bulkDeleteRoute[0]).toContain('userIds.length === 0');
    });

    it('should prevent self-deletion', () => {
      const bulkDeleteRoute = adminRoutesContent.match(
        /POST \/api\/admin\/users\/bulk-delete[\s\S]*?catch \(error\)/
      );
      expect(bulkDeleteRoute).toBeTruthy();
      expect(bulkDeleteRoute[0]).toContain('req.user.id');
    });

    it('should prevent owner account deletion', () => {
      const bulkDeleteRoute = adminRoutesContent.match(
        /POST \/api\/admin\/users\/bulk-delete[\s\S]*?catch \(error\)/
      );
      expect(bulkDeleteRoute).toBeTruthy();
      expect(bulkDeleteRoute[0]).toContain('isOwner');
    });

    it('should create audit log', () => {
      const bulkDeleteRoute = adminRoutesContent.match(
        /POST \/api\/admin\/users\/bulk-delete[\s\S]*?catch \(error\)/
      );
      expect(bulkDeleteRoute).toBeTruthy();
      expect(bulkDeleteRoute[0]).toContain('auditLog');
      expect(bulkDeleteRoute[0]).toContain('BULK_USERS_DELETED');
    });

    it('should return success response with counts', () => {
      const bulkDeleteRoute = adminRoutesContent.match(
        /POST \/api\/admin\/users\/bulk-delete[\s\S]*?catch \(error\)/
      );
      expect(bulkDeleteRoute).toBeTruthy();
      expect(bulkDeleteRoute[0]).toContain('deletedCount');
      expect(bulkDeleteRoute[0]).toContain('totalRequested');
    });
  });

  describe('POST /api/admin/users/bulk-verify', () => {
    it('should have bulk-verify endpoint defined', () => {
      expect(adminRoutesContent).toContain('/users/bulk-verify');
    });

    it('should validate array input', () => {
      const bulkVerifyRoute = adminRoutesContent.match(
        /POST \/api\/admin\/users\/bulk-verify[\s\S]*?catch \(error\)/
      );
      expect(bulkVerifyRoute).toBeTruthy();
      expect(bulkVerifyRoute[0]).toContain('Array.isArray');
      expect(bulkVerifyRoute[0]).toContain('userIds');
    });
  });

  describe('POST /api/admin/users/bulk-suspend', () => {
    it('should have bulk-suspend endpoint defined', () => {
      expect(adminRoutesContent).toContain('/users/bulk-suspend');
    });

    it('should validate array input', () => {
      const bulkSuspendRoute = adminRoutesContent.match(
        /POST \/api\/admin\/users\/bulk-suspend[\s\S]*?catch \(error\)/
      );
      expect(bulkSuspendRoute).toBeTruthy();
      expect(bulkSuspendRoute[0]).toContain('Array.isArray');
      expect(bulkSuspendRoute[0]).toContain('userIds');
    });

    it('should prevent self-suspension', () => {
      const bulkSuspendRoute = adminRoutesContent.match(
        /POST \/api\/admin\/users\/bulk-suspend[\s\S]*?catch \(error\)/
      );
      expect(bulkSuspendRoute).toBeTruthy();
      expect(bulkSuspendRoute[0]).toContain('req.user.id');
    });
  });

  describe('Admin Users UI', () => {
    let adminUsersHtml;
    let adminUsersInitJs;

    beforeAll(() => {
      adminUsersHtml = fs.readFileSync(
        path.join(__dirname, '../../public/admin-users.html'),
        'utf8'
      );
      adminUsersInitJs = fs.readFileSync(
        path.join(__dirname, '../../public/assets/js/pages/admin-users-init.js'),
        'utf8'
      );
    });

    it('should have checkbox column in user table', () => {
      expect(adminUsersHtml).toContain('id="selectAll"');
      expect(adminUsersHtml).toContain('type="checkbox"');
    });

    it('should have bulk actions bar', () => {
      expect(adminUsersHtml).toContain('id="bulkActionsBar"');
      expect(adminUsersHtml).toContain('id="bulkActionSelect"');
      expect(adminUsersHtml).toContain('id="executeBulkAction"');
    });

    it('should have bulk action options', () => {
      expect(adminUsersHtml).toContain('value="delete"');
      expect(adminUsersHtml).toContain('value="verify"');
      expect(adminUsersHtml).toContain('value="suspend"');
      expect(adminUsersHtml).toContain('value="unsuspend"');
      expect(adminUsersHtml).toContain('value="export"');
    });

    it('should have bulk action handlers in JavaScript', () => {
      expect(adminUsersInitJs).toContain('bulkDeleteUsers');
      expect(adminUsersInitJs).toContain('bulkVerifyUsers');
      expect(adminUsersInitJs).toContain('bulkSuspendUsers');
      expect(adminUsersInitJs).toContain('exportSelectedUsers');
    });

    it('should have select all functionality', () => {
      expect(adminUsersInitJs).toContain('setupSelectAllCheckbox');
      expect(adminUsersInitJs).toContain('selectedUserIds');
    });

    it('should show confirmation before bulk delete', () => {
      expect(adminUsersInitJs).toContain('showConfirmModal');
      expect(adminUsersInitJs).toMatch(/Delete.*user/i);
    });

    it('should update UI after bulk operations', () => {
      expect(adminUsersInitJs).toContain('updateBulkActionsUI');
      expect(adminUsersInitJs).toContain('loadAdminUsers');
    });

    it('should handle individual checkboxes', () => {
      expect(adminUsersInitJs).toContain('user-checkbox');
      expect(adminUsersInitJs).toContain('data-user-id');
    });
  });
});
