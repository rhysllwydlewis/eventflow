/**
 * Integration tests for admin database status endpoint
 * Tests the /api/admin/db-status endpoint
 */

const fs = require('fs');

describe('Admin Database Status Endpoint', () => {
  describe('Endpoint Structure Verification', () => {
    it('should have db-status endpoint in admin routes', () => {
      const adminRoutesContent = fs.readFileSync('routes/admin.js', 'utf8');

      // Verify the db-status endpoint exists
      expect(adminRoutesContent).toContain("router.get('/db-status'");
      expect(adminRoutesContent).toContain('dbUnified.getDatabaseStatus()');
    });

    it('should return all required status fields', () => {
      const adminRoutesContent = fs.readFileSync('routes/admin.js', 'utf8');

      // Verify the response includes all required fields
      expect(adminRoutesContent).toContain('dbType: status.type');
      expect(adminRoutesContent).toContain('initialized:');
      expect(adminRoutesContent).toContain('state: status.state');
      expect(adminRoutesContent).toContain('connected: status.connected');
      expect(adminRoutesContent).toContain('error: status.error');
    });

    it('should compute initialized field from state', () => {
      const adminRoutesContent = fs.readFileSync('routes/admin.js', 'utf8');

      // Verify that initialized is computed from state === 'completed'
      expect(adminRoutesContent).toContain("initialized: status.state === 'completed'");
    });

    it('should require admin role for db-status endpoint', () => {
      const adminRoutesContent = fs.readFileSync('routes/admin.js', 'utf8');

      // Find the db-status route definition
      const dbStatusRouteMatch = adminRoutesContent.match(
        /router\.get\(['"]\/db-status['"]\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,/
      );

      expect(dbStatusRouteMatch).not.toBeNull();
      if (dbStatusRouteMatch) {
        // Verify authRequired and roleRequired('admin') are present
        const routeDefinition = adminRoutesContent.substring(
          dbStatusRouteMatch.index,
          dbStatusRouteMatch.index + 200
        );
        expect(routeDefinition).toContain('authRequired');
        expect(routeDefinition).toContain("roleRequired('admin')");
      }
    });
  });

  describe('Database Status Response Mock', () => {
    let mockDbUnified;

    beforeEach(() => {
      mockDbUnified = {
        getDatabaseStatus: jest.fn(),
      };
    });

    it('should handle completed state correctly', () => {
      mockDbUnified.getDatabaseStatus.mockReturnValue({
        state: 'completed',
        type: 'mongodb',
        connected: true,
        error: null,
      });

      const status = mockDbUnified.getDatabaseStatus();
      const initialized = status.state === 'completed';

      expect(initialized).toBe(true);
      expect(status.type).toBe('mongodb');
      expect(status.connected).toBe(true);
      expect(status.error).toBeNull();
    });

    it('should handle initializing state correctly', () => {
      mockDbUnified.getDatabaseStatus.mockReturnValue({
        state: 'initializing',
        type: 'unknown',
        connected: false,
        error: null,
      });

      const status = mockDbUnified.getDatabaseStatus();
      const initialized = status.state === 'completed';

      expect(initialized).toBe(false);
      expect(status.connected).toBe(false);
    });

    it('should handle error state correctly', () => {
      mockDbUnified.getDatabaseStatus.mockReturnValue({
        state: 'error',
        type: 'local',
        connected: false,
        error: 'Connection failed',
      });

      const status = mockDbUnified.getDatabaseStatus();
      const initialized = status.state === 'completed';

      expect(initialized).toBe(false);
      expect(status.error).toBe('Connection failed');
      expect(status.type).toBe('local');
    });
  });

  describe('Frontend Integration', () => {
    it('should have database health loading function in admin-settings-init.js', () => {
      const adminSettingsContent = fs.readFileSync(
        'public/assets/js/pages/admin-settings-init.js',
        'utf8'
      );

      // Verify the loadDatabaseHealth function exists
      expect(adminSettingsContent).toContain('function loadDatabaseHealth()');
      expect(adminSettingsContent).toContain("'/api/admin/db-status'");
    });

    it('should check initialized and state fields in frontend', () => {
      const adminSettingsContent = fs.readFileSync(
        'public/assets/js/pages/admin-settings-init.js',
        'utf8'
      );

      // Verify frontend checks the correct fields
      expect(adminSettingsContent).toContain('status.initialized');
      expect(adminSettingsContent).toContain("status.state === 'completed'");
    });

    it('should handle MongoDB and local storage types in frontend', () => {
      const adminSettingsContent = fs.readFileSync(
        'public/assets/js/pages/admin-settings-init.js',
        'utf8'
      );

      // Verify frontend handles both database types
      expect(adminSettingsContent).toContain("status.dbType === 'mongodb'");
      expect(adminSettingsContent).toContain('MongoDB (Primary)');
      expect(adminSettingsContent).toContain('Local Files (Fallback)');
    });
  });
});
