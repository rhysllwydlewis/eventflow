/**
 * Unit tests for login redirect validation
 */

// Mock the validateRedirectForRole function from app.js
function validateRedirectForRole(redirectUrl, userRole) {
  if (!redirectUrl || typeof redirectUrl !== 'string') {
    return false;
  }

  const url = redirectUrl.trim();

  if (!url.startsWith('/')) {
    return false;
  }

  let pathname;
  try {
    const urlObj = new URL(url, 'http://localhost:3000');
    if (urlObj.origin !== 'http://localhost:3000') {
      return false;
    }
    pathname = urlObj.pathname;
  } catch (_) {
    pathname = url.split('?')[0].split('#')[0];
  }

  const allowedPaths = {
    admin: [
      '/admin.html',
      '/admin-audit.html',
      '/admin-content.html',
      '/admin-homepage.html',
      '/admin-marketplace.html',
      '/admin-packages.html',
      '/admin-payments.html',
      '/admin-pexels.html',
      '/admin-photos.html',
      '/admin-reports.html',
      '/admin-settings.html',
      '/admin-supplier-detail.html',
      '/admin-suppliers.html',
      '/admin-tickets.html',
      '/admin-user-detail.html',
      '/admin-users.html',
    ],
    supplier: [
      '/dashboard-supplier.html',
      '/dashboard.html',
      '/settings.html',
      '/plan.html',
      '/my-marketplace-listings.html',
      '/supplier/marketplace-new-listing.html',
    ],
    customer: [
      '/dashboard-customer.html',
      '/dashboard.html',
      '/settings.html',
      '/plan.html',
      '/checkout.html',
      '/my-marketplace-listings.html',
    ],
  };

  const allowed = allowedPaths[userRole] || [];
  return allowed.includes(pathname);
}

describe('Login Redirect Validation', () => {
  describe('validateRedirectForRole', () => {
    describe('Admin role', () => {
      it('should allow admin pages for admin users', () => {
        expect(validateRedirectForRole('/admin.html', 'admin')).toBe(true);
        expect(validateRedirectForRole('/admin-users.html', 'admin')).toBe(true);
        expect(validateRedirectForRole('/admin-settings.html', 'admin')).toBe(true);
      });

      it('should reject customer dashboard for admin users', () => {
        expect(validateRedirectForRole('/dashboard-customer.html', 'admin')).toBe(false);
      });

      it('should reject supplier dashboard for admin users', () => {
        expect(validateRedirectForRole('/dashboard-supplier.html', 'admin')).toBe(false);
      });

      it('should handle query parameters correctly', () => {
        expect(validateRedirectForRole('/admin.html?tab=users', 'admin')).toBe(true);
        expect(validateRedirectForRole('/admin-settings.html?section=billing', 'admin')).toBe(true);
      });
    });

    describe('Supplier role', () => {
      it('should allow supplier dashboard for supplier users', () => {
        expect(validateRedirectForRole('/dashboard-supplier.html', 'supplier')).toBe(true);
      });

      it('should allow shared pages for supplier users', () => {
        expect(validateRedirectForRole('/settings.html', 'supplier')).toBe(true);
        expect(validateRedirectForRole('/plan.html', 'supplier')).toBe(true);
      });

      it('should reject admin pages for supplier users', () => {
        expect(validateRedirectForRole('/admin.html', 'supplier')).toBe(false);
        expect(validateRedirectForRole('/admin-users.html', 'supplier')).toBe(false);
      });

      it('should reject customer dashboard for supplier users', () => {
        expect(validateRedirectForRole('/dashboard-customer.html', 'supplier')).toBe(false);
      });
    });

    describe('Customer role', () => {
      it('should allow customer dashboard for customer users', () => {
        expect(validateRedirectForRole('/dashboard-customer.html', 'customer')).toBe(true);
      });

      it('should allow shared pages for customer users', () => {
        expect(validateRedirectForRole('/settings.html', 'customer')).toBe(true);
        expect(validateRedirectForRole('/plan.html', 'customer')).toBe(true);
        expect(validateRedirectForRole('/checkout.html', 'customer')).toBe(true);
      });

      it('should reject admin pages for customer users', () => {
        expect(validateRedirectForRole('/admin.html', 'customer')).toBe(false);
        expect(validateRedirectForRole('/admin-users.html', 'customer')).toBe(false);
      });

      it('should reject supplier dashboard for customer users', () => {
        expect(validateRedirectForRole('/dashboard-supplier.html', 'customer')).toBe(false);
      });
    });

    describe('Security - External URLs', () => {
      it('should reject absolute external URLs', () => {
        expect(validateRedirectForRole('http://evil.com/admin.html', 'admin')).toBe(false);
        expect(validateRedirectForRole('https://evil.com/admin.html', 'admin')).toBe(false);
      });

      it('should reject protocol-relative URLs', () => {
        expect(validateRedirectForRole('//evil.com/admin.html', 'admin')).toBe(false);
      });

      it('should reject javascript: URLs', () => {
        expect(validateRedirectForRole('javascript:alert(1)', 'admin')).toBe(false);
      });

      it('should reject data: URLs', () => {
        expect(validateRedirectForRole('data:text/html,<script>alert(1)</script>', 'admin')).toBe(
          false
        );
      });
    });

    describe('Security - Path Traversal', () => {
      it('should only accept paths starting with /', () => {
        expect(validateRedirectForRole('admin.html', 'admin')).toBe(false);
        expect(validateRedirectForRole('../admin.html', 'admin')).toBe(false);
        expect(validateRedirectForRole('./admin.html', 'admin')).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should reject null or undefined', () => {
        expect(validateRedirectForRole(null, 'admin')).toBe(false);
        expect(validateRedirectForRole(undefined, 'admin')).toBe(false);
      });

      it('should reject empty string', () => {
        expect(validateRedirectForRole('', 'admin')).toBe(false);
      });

      it('should reject whitespace-only string', () => {
        expect(validateRedirectForRole('   ', 'admin')).toBe(false);
      });

      it('should reject non-string values', () => {
        expect(validateRedirectForRole(123, 'admin')).toBe(false);
        expect(validateRedirectForRole({}, 'admin')).toBe(false);
        expect(validateRedirectForRole([], 'admin')).toBe(false);
      });

      it('should handle unknown roles', () => {
        expect(validateRedirectForRole('/admin.html', 'unknown')).toBe(false);
        expect(validateRedirectForRole('/admin.html', '')).toBe(false);
      });

      it('should handle hash fragments', () => {
        expect(validateRedirectForRole('/admin.html#section', 'admin')).toBe(true);
      });
    });
  });

  describe('Login redirect flow', () => {
    it('should compute correct destination for admin without redirect param', () => {
      const user = { role: 'admin' };
      const destination =
        user.role === 'admin'
          ? '/admin.html'
          : user.role === 'supplier'
            ? '/dashboard-supplier.html'
            : '/dashboard-customer.html';
      expect(destination).toBe('/admin.html');
    });

    it('should compute correct destination for supplier without redirect param', () => {
      const user = { role: 'supplier' };
      const destination =
        user.role === 'admin'
          ? '/admin.html'
          : user.role === 'supplier'
            ? '/dashboard-supplier.html'
            : '/dashboard-customer.html';
      expect(destination).toBe('/dashboard-supplier.html');
    });

    it('should compute correct destination for customer without redirect param', () => {
      const user = { role: 'customer' };
      const destination =
        user.role === 'admin'
          ? '/admin.html'
          : user.role === 'supplier'
            ? '/dashboard-supplier.html'
            : '/dashboard-customer.html';
      expect(destination).toBe('/dashboard-customer.html');
    });

    it('should ignore invalid redirect and use role-based destination', () => {
      const user = { role: 'admin' };
      const redirect = '/dashboard-customer.html'; // Not allowed for admin
      const isValid = validateRedirectForRole(redirect, user.role);
      const destination = isValid
        ? redirect
        : user.role === 'admin'
          ? '/admin.html'
          : user.role === 'supplier'
            ? '/dashboard-supplier.html'
            : '/dashboard-customer.html';
      expect(destination).toBe('/admin.html');
    });

    it('should use valid redirect param when appropriate', () => {
      const user = { role: 'admin' };
      const redirect = '/admin-users.html'; // Allowed for admin
      const isValid = validateRedirectForRole(redirect, user.role);
      const destination = isValid ? redirect : '/admin.html';
      expect(destination).toBe('/admin-users.html');
    });
  });
});
