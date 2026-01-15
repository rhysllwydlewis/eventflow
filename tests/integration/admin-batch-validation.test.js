/**
 * Integration tests for batch operations validation
 */

const fs = require('fs');
const path = require('path');

function escapeForRegExp(str) {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

const escapeForRegExp = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('Admin Batch Operations - Validation', () => {
  let adminRoutesContent;
  let adminV2RoutesContent;

  beforeAll(() => {
    adminRoutesContent = fs.readFileSync(path.join(__dirname, '../../routes/admin.js'), 'utf8');
    adminV2RoutesContent = fs.readFileSync(
      path.join(__dirname, '../../routes/admin-v2.js'),
      'utf8'
    );
  });

  describe('Admin Routes v1 - Batch Size Validation', () => {
    it('should define MAX_BATCH_SIZE constant or inline limit', () => {
      // Check for batch size validation in bulk operations
      expect(adminRoutesContent).toContain('MAX_BATCH_SIZE');
      expect(adminRoutesContent).toContain('100');
    });

    describe('POST /api/admin/packages/bulk-approve', () => {
      it('should validate array input', () => {
        const bulkApproveRoute = adminRoutesContent.match(
          /POST \/api\/admin\/packages\/bulk-approve[\s\S]*?catch \(error\)/
        );
        expect(bulkApproveRoute).toBeTruthy();
        expect(bulkApproveRoute[0]).toContain('Array.isArray');
        expect(bulkApproveRoute[0]).toContain('packageIds');
      });

      it('should enforce batch size limit', () => {
        const bulkApproveRoute = adminRoutesContent.match(
          /POST \/api\/admin\/packages\/bulk-approve[\s\S]*?catch \(error\)/
        );
        expect(bulkApproveRoute).toBeTruthy();
        expect(bulkApproveRoute[0]).toContain('MAX_BATCH_SIZE');
        expect(bulkApproveRoute[0]).toContain('packageIds.length >');
      });

      it('should return 400 error when batch size exceeded', () => {
        const bulkApproveRoute = adminRoutesContent.match(
          /POST \/api\/admin\/packages\/bulk-approve[\s\S]*?catch \(error\)/
        );
        expect(bulkApproveRoute).toBeTruthy();
        expect(bulkApproveRoute[0]).toContain('Batch size cannot exceed');
        expect(bulkApproveRoute[0]).toContain('status(400)');
      });
    });

    describe('POST /api/admin/packages/bulk-delete', () => {
      it('should validate array input', () => {
        const bulkDeleteRoute = adminRoutesContent.match(
          /POST \/api\/admin\/packages\/bulk-delete[\s\S]*?catch \(error\)/
        );
        expect(bulkDeleteRoute).toBeTruthy();
        expect(bulkDeleteRoute[0]).toContain('Array.isArray');
        expect(bulkDeleteRoute[0]).toContain('packageIds');
      });

      it('should enforce batch size limit', () => {
        const bulkDeleteRoute = adminRoutesContent.match(
          /POST \/api\/admin\/packages\/bulk-delete[\s\S]*?catch \(error\)/
        );
        expect(bulkDeleteRoute).toBeTruthy();
        expect(bulkDeleteRoute[0]).toContain('MAX_BATCH_SIZE');
        expect(bulkDeleteRoute[0]).toContain('packageIds.length >');
      });
    });

    describe('POST /api/admin/suppliers/bulk-approve', () => {
      it('should validate array input', () => {
        const bulkApproveRoute = adminRoutesContent.match(
          /POST \/api\/admin\/suppliers\/bulk-approve[\s\S]*?catch \(error\)/
        );
        expect(bulkApproveRoute).toBeTruthy();
        expect(bulkApproveRoute[0]).toContain('Array.isArray');
        expect(bulkApproveRoute[0]).toContain('supplierIds');
      });

      it('should enforce batch size limit', () => {
        const bulkApproveRoute = adminRoutesContent.match(
          /POST \/api\/admin\/suppliers\/bulk-approve[\s\S]*?catch \(error\)/
        );
        expect(bulkApproveRoute).toBeTruthy();
        expect(bulkApproveRoute[0]).toContain('MAX_BATCH_SIZE');
        expect(bulkApproveRoute[0]).toContain('supplierIds.length >');
      });
    });

    describe('POST /api/admin/suppliers/bulk-reject', () => {
      it('should validate array input', () => {
        const bulkRejectRoute = adminRoutesContent.match(
          /POST \/api\/admin\/suppliers\/bulk-reject[\s\S]*?catch \(error\)/
        );
        expect(bulkRejectRoute).toBeTruthy();
        expect(bulkRejectRoute[0]).toContain('Array.isArray');
        expect(bulkRejectRoute[0]).toContain('supplierIds');
      });

      it('should enforce batch size limit', () => {
        const bulkRejectRoute = adminRoutesContent.match(
          /POST \/api\/admin\/suppliers\/bulk-reject[\s\S]*?catch \(error\)/
        );
        expect(bulkRejectRoute).toBeTruthy();
        expect(bulkRejectRoute[0]).toContain('MAX_BATCH_SIZE');
        expect(bulkRejectRoute[0]).toContain('supplierIds.length >');
      });
    });

    describe('POST /api/admin/suppliers/bulk-delete', () => {
      it('should validate array input', () => {
        const bulkDeleteRoute = adminRoutesContent.match(
          /POST \/api\/admin\/suppliers\/bulk-delete[\s\S]*?catch \(error\)/
        );
        expect(bulkDeleteRoute).toBeTruthy();
        expect(bulkDeleteRoute[0]).toContain('Array.isArray');
        expect(bulkDeleteRoute[0]).toContain('supplierIds');
      });

      it('should enforce batch size limit', () => {
        const bulkDeleteRoute = adminRoutesContent.match(
          /POST \/api\/admin\/suppliers\/bulk-delete[\s\S]*?catch \(error\)/
        );
        expect(bulkDeleteRoute).toBeTruthy();
        expect(bulkDeleteRoute[0]).toContain('MAX_BATCH_SIZE');
        expect(bulkDeleteRoute[0]).toContain('supplierIds.length >');
      });
    });
  });

  describe('Admin Routes v2 - Batch Size Validation', () => {
    it('should define MAX_BATCH_SIZE constant or inline limit', () => {
      expect(adminV2RoutesContent).toContain('MAX_BATCH_SIZE');
      expect(adminV2RoutesContent).toContain('100');
    });

    describe('POST /api/v2/admin/packages/batch-approve', () => {
      it('should validate array input', () => {
        const batchApproveRoute = adminV2RoutesContent.match(
          /POST \/api\/v2\/admin\/packages\/batch-approve[\s\S]*?catch \(error\)/
        );
        expect(batchApproveRoute).toBeTruthy();
        expect(batchApproveRoute[0]).toContain('Array.isArray');
        expect(batchApproveRoute[0]).toContain('ids');
      });

      it('should enforce batch size limit', () => {
        const batchApproveRoute = adminV2RoutesContent.match(
          /POST \/api\/v2\/admin\/packages\/batch-approve[\s\S]*?catch \(error\)/
        );
        expect(batchApproveRoute).toBeTruthy();
        expect(batchApproveRoute[0]).toContain('MAX_BATCH_SIZE');
        expect(batchApproveRoute[0]).toContain('ids.length >');
      });

      it('should return structured error response', () => {
        const batchApproveRoute = adminV2RoutesContent.match(
          /POST \/api\/v2\/admin\/packages\/batch-approve[\s\S]*?catch \(error\)/
        );
        expect(batchApproveRoute).toBeTruthy();
        expect(batchApproveRoute[0]).toContain('BATCH_SIZE_EXCEEDED');
        expect(batchApproveRoute[0]).toContain('success: false');
      });
    });

    describe('POST /api/v2/admin/photos/batch-action', () => {
      it('should validate array input', () => {
        const batchActionRoute = adminV2RoutesContent.match(
          /POST \/api\/v2\/admin\/photos\/batch-action[\s\S]*?catch \(error\)/
        );
        expect(batchActionRoute).toBeTruthy();
        expect(batchActionRoute[0]).toContain('Array.isArray');
        expect(batchActionRoute[0]).toContain('photos');
      });

      it('should enforce batch size limit', () => {
        const batchActionRoute = adminV2RoutesContent.match(
          /POST \/api\/v2\/admin\/photos\/batch-action[\s\S]*?catch \(error\)/
        );
        expect(batchActionRoute).toBeTruthy();
        expect(batchActionRoute[0]).toContain('MAX_BATCH_SIZE');
        expect(batchActionRoute[0]).toContain('photos.length >');
      });

      it('should validate action type', () => {
        const batchActionRoute = adminV2RoutesContent.match(
          /POST \/api\/v2\/admin\/photos\/batch-action[\s\S]*?catch \(error\)/
        );
        expect(batchActionRoute).toBeTruthy();
        expect(batchActionRoute[0]).toContain('approve');
        expect(batchActionRoute[0]).toContain('reject');
      });
    });

    describe('POST /api/v2/admin/bulk-actions', () => {
      it('should validate action, type, and ids', () => {
        const bulkActionsRoute = adminV2RoutesContent.match(
          /POST \/api\/v2\/admin\/bulk-actions[\s\S]*?catch \(error\)/
        );
        expect(bulkActionsRoute).toBeTruthy();
        expect(bulkActionsRoute[0]).toContain('action');
        expect(bulkActionsRoute[0]).toContain('type');
        expect(bulkActionsRoute[0]).toContain('Array.isArray(ids)');
      });

      it('should enforce batch size limit', () => {
        const bulkActionsRoute = adminV2RoutesContent.match(
          /POST \/api\/v2\/admin\/bulk-actions[\s\S]*?catch \(error\)/
        );
        expect(bulkActionsRoute).toBeTruthy();
        expect(bulkActionsRoute[0]).toContain('MAX_BATCH_SIZE');
        expect(bulkActionsRoute[0]).toContain('ids.length >');
      });

      it('should validate type against whitelist', () => {
        const bulkActionsRoute = adminV2RoutesContent.match(
          /POST \/api\/v2\/admin\/bulk-actions[\s\S]*?catch \(error\)/
        );
        expect(bulkActionsRoute).toBeTruthy();
        expect(bulkActionsRoute[0]).toContain('validTypes');
        expect(bulkActionsRoute[0]).toContain('packages');
        expect(bulkActionsRoute[0]).toContain('suppliers');
      });

      it('should return structured error for invalid type', () => {
        const bulkActionsRoute = adminV2RoutesContent.match(
          /POST \/api\/v2\/admin\/bulk-actions[\s\S]*?catch \(error\)/
        );
        expect(bulkActionsRoute).toBeTruthy();
        expect(bulkActionsRoute[0]).toContain('INVALID_TYPE');
        expect(bulkActionsRoute[0]).toContain('success: false');
      });
    });
  });

  describe('CSRF Protection on Batch Operations', () => {
    it('v1 bulk operations should have csrfProtection', () => {
      const bulkOperations = [
        '/packages/bulk-approve',
        '/packages/bulk-delete',
        '/suppliers/bulk-approve',
        '/suppliers/bulk-reject',
        '/suppliers/bulk-delete',
      ];

          `router\\.post\\([^)]*${escapeForRegExp(operation)}[\\s\\S]*?\\);`
        const escapedOperation = escapeForRegExp(operation);
        const operationRegex = new RegExp(
          `router\\.post\\([^)]*${escapedOperation}[\\s\\S]*?\\);`
        );
        const match = adminRoutesContent.match(operationRegex);
        expect(match).toBeTruthy();
        expect(match[0]).toContain('csrfProtection');
      });
    });

    it('v2 batch operations should have csrfProtection', () => {
      const batchOperations = ['/packages/batch-approve', '/photos/batch-action', '/bulk-actions'];
          `router\\.post\\([^)]*${escapeForRegExp(operation)}[\\s\\S]*?\\);`
        const escapedOperation = escapeForRegExp(operation);
      batchOperations.forEach(operation => {
        const operationRegex = new RegExp(
          `router\\.post\\([^)]*${escapedOperation}[\\s\\S]*?\\);`
        );
        const match = adminV2RoutesContent.match(operationRegex);
        expect(match).toBeTruthy();
        expect(match[0]).toContain('csrfProtection');
      });
    });
  });
});
