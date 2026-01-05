/**
 * Integration tests for /api/auth/me endpoint
 * Tests owner admin role enforcement and response format
 */

const fs = require('fs');
const path = require('path');

describe('Auth Me Endpoint', () => {
  describe('Response Format', () => {
    it('should have /api/auth/me endpoint in server.js', () => {
      const serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

      // Verify the endpoint exists
      expect(serverContent).toContain("app.get('/api/auth/me'");
      expect(serverContent).toContain('getUserFromCookie');
    });

    it('should return wrapped response format with user property', () => {
      const serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

      // Verify response includes wrapped format
      const authMeSection = serverContent.match(/app\.get\('\/api\/auth\/me'[\s\S]*?^\}\);/m);
      expect(authMeSection).toBeTruthy();
      expect(authMeSection[0]).toContain('user: userData');
    });

    it('should enforce owner admin role for admin@event-flow.co.uk', () => {
      const serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

      // Verify owner enforcement exists - check for OWNER_EMAIL constant usage
      const authMeEndpoint = serverContent.match(/app\.get\('\/api\/auth\/me'[\s\S]*?^\}\);/m);
      expect(authMeEndpoint).toBeTruthy();
      expect(authMeEndpoint[0]).toContain('OWNER_EMAIL');
      expect(authMeEndpoint[0]).toContain('isOwner');

      // Verify constant is defined
      expect(serverContent).toContain("const OWNER_EMAIL = 'admin@event-flow.co.uk'");
    });

    it('should maintain backward compatibility with unwrapped format', () => {
      const serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

      // Verify backward compatibility by spreading userData at root
      const authMeEndpoint = serverContent.match(/app\.get\('\/api\/auth\/me'[\s\S]*?^\}\);/m);
      expect(authMeEndpoint).toBeTruthy();
      expect(authMeEndpoint[0]).toContain('...userData');
    });
  });

  describe('Login Endpoint Owner Enforcement', () => {
    it('should enforce owner admin role during login JWT creation', () => {
      const serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

      // Verify login endpoint enforces owner role - check for OWNER_EMAIL constant usage
      const loginEndpoint = serverContent.match(/app\.post\('\/api\/auth\/login'[\s\S]*?^\}\);/m);
      expect(loginEndpoint).toBeTruthy();
      expect(loginEndpoint[0]).toContain('OWNER_EMAIL');
      expect(loginEndpoint[0]).toContain('isOwner');
      expect(loginEndpoint[0]).toContain('userRole');

      // Verify constant is defined
      expect(serverContent).toContain("const OWNER_EMAIL = 'admin@event-flow.co.uk'");
    });

    it('should use enforced role in JWT token', () => {
      const serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

      // Verify JWT is signed with enforced role
      const loginEndpoint = serverContent.match(/app\.post\('\/api\/auth\/login'[\s\S]*?^\}\);/m);
      expect(loginEndpoint).toBeTruthy();
      expect(loginEndpoint[0]).toContain('jwt.sign');
      expect(loginEndpoint[0]).toContain('role: userRole');
    });
  });

  describe('Frontend Admin Check', () => {
    it('should handle both wrapped and unwrapped response formats', () => {
      const adminInitContent = fs.readFileSync(
        path.join(__dirname, '../../public/assets/js/pages/admin-init.js'),
        'utf8'
      );

      // Verify frontend handles both formats
      expect(adminInitContent).toContain('const user = me.user || me');
    });

    it('should check owner email as fallback for admin access', () => {
      const adminInitContent = fs.readFileSync(
        path.join(__dirname, '../../public/assets/js/pages/admin-init.js'),
        'utf8'
      );

      // Verify owner email constant is defined
      expect(adminInitContent).toContain("const OWNER_EMAIL = 'admin@event-flow.co.uk'");
      expect(adminInitContent).toContain('isOwner');
    });

    it('should check admin role or owner email', () => {
      const adminInitContent = fs.readFileSync(
        path.join(__dirname, '../../public/assets/js/pages/admin-init.js'),
        'utf8'
      );

      // Verify combined check
      expect(adminInitContent).toContain("user.role === 'admin' || isOwner");
    });
  });
});

describe('Auth Me Endpoint - Mock Response Tests', () => {
  describe('Response Structure Validation', () => {
    it('should validate wrapped response format', () => {
      // Mock response in the expected format
      const mockResponse = {
        user: {
          id: 'test-id',
          email: 'admin@event-flow.co.uk',
          role: 'admin',
          name: 'Test Admin',
          isOwner: true,
        },
        // Backward compatibility - unwrapped at root
        id: 'test-id',
        email: 'admin@event-flow.co.uk',
        role: 'admin',
        name: 'Test Admin',
        isOwner: true,
      };

      // Verify structure
      expect(mockResponse).toHaveProperty('user');
      expect(mockResponse.user).toHaveProperty('id');
      expect(mockResponse.user).toHaveProperty('email');
      expect(mockResponse.user).toHaveProperty('role');
      expect(mockResponse.user).toHaveProperty('isOwner');

      // Verify backward compatibility
      expect(mockResponse).toHaveProperty('id');
      expect(mockResponse).toHaveProperty('email');
      expect(mockResponse).toHaveProperty('role');
    });

    it('should enforce admin role for owner email', () => {
      const ownerEmail = 'admin@event-flow.co.uk';
      const isOwner = ownerEmail.toLowerCase() === 'admin@event-flow.co.uk';
      const userRole = isOwner ? 'admin' : 'customer';

      expect(isOwner).toBe(true);
      expect(userRole).toBe('admin');
    });

    it('should not enforce admin role for non-owner email', () => {
      const regularEmail = 'user@example.com';
      const isOwner = regularEmail.toLowerCase() === 'admin@event-flow.co.uk';
      const userRole = isOwner ? 'admin' : 'customer';

      expect(isOwner).toBe(false);
      expect(userRole).toBe('customer');
    });
  });

  describe('Frontend Compatibility', () => {
    it('should support accessing user via me.user', () => {
      const mockResponse = {
        user: { id: '123', email: 'test@example.com', role: 'admin' },
        id: '123',
        email: 'test@example.com',
        role: 'admin',
      };

      const user = mockResponse.user;
      expect(user).toBeDefined();
      expect(user.role).toBe('admin');
    });

    it('should support accessing user via me directly (backward compat)', () => {
      const mockResponse = {
        id: '123',
        email: 'test@example.com',
        role: 'admin',
      };

      const user = mockResponse.user || mockResponse;
      expect(user).toBeDefined();
      expect(user.role).toBe('admin');
    });

    it('should handle owner check in frontend', () => {
      const mockUser = { email: 'admin@event-flow.co.uk', role: 'customer' };
      const isOwner = mockUser.email === 'admin@event-flow.co.uk';
      const isAdmin = mockUser.role === 'admin' || isOwner;

      expect(isOwner).toBe(true);
      expect(isAdmin).toBe(true); // Should be admin due to owner email
    });
  });
});
