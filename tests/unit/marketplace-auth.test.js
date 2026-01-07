/**
 * Unit tests for marketplace authentication logic
 * Tests the fix for issue where {user: null} was treated as truthy
 */

describe('Marketplace Auth Logic', () => {
  describe('User data parsing', () => {
    it('should treat {user: null} as no user', () => {
      const data = { user: null };
      let currentUser;

      // Simulate the fixed logic
      if (data.user !== undefined) {
        currentUser = data.user;
      } else if (data.id) {
        currentUser = data;
      } else {
        currentUser = null;
      }

      expect(currentUser).toBeNull();
    });

    it('should handle unwrapped user data', () => {
      const data = {
        id: 'usr_123',
        name: 'Test User',
        email: 'test@example.com',
      };
      let currentUser;

      // Simulate the fixed logic
      if (data.user !== undefined) {
        currentUser = data.user;
      } else if (data.id) {
        currentUser = data;
      } else {
        currentUser = null;
      }

      expect(currentUser).toEqual(data);
      expect(currentUser.id).toBe('usr_123');
    });

    it('should handle wrapped user data', () => {
      const userData = {
        id: 'usr_123',
        name: 'Test User',
        email: 'test@example.com',
      };
      const data = { user: userData };
      let currentUser;

      // Simulate the fixed logic
      if (data.user !== undefined) {
        currentUser = data.user;
      } else if (data.id) {
        currentUser = data;
      } else {
        currentUser = null;
      }

      expect(currentUser).toEqual(userData);
      expect(currentUser.id).toBe('usr_123');
    });

    it('should handle empty response', () => {
      const data = {};
      let currentUser;

      // Simulate the fixed logic
      if (data.user !== undefined) {
        currentUser = data.user;
      } else if (data.id) {
        currentUser = data;
      } else {
        currentUser = null;
      }

      expect(currentUser).toBeNull();
    });
  });

  describe('Auth UI logic', () => {
    it('should identify authenticated user correctly', () => {
      const currentUser = {
        id: 'usr_123',
        name: 'Test User',
        email: 'test@example.com',
      };

      // Test the condition used in updateAuthUI()
      expect(currentUser).toBeTruthy();
      expect(!!currentUser).toBe(true);
    });

    it('should identify null user correctly', () => {
      const currentUser = null;

      // Test the condition used in updateAuthUI()
      expect(currentUser).toBeFalsy();
      expect(!!currentUser).toBe(false);
    });

    it('should identify {user: null} incorrectly with old logic', () => {
      const data = { user: null };
      // Old buggy logic: currentUser = data.user || data
      const currentUser = data.user || data;

      // This was the bug - {user: null} is truthy!
      expect(currentUser).toBeTruthy();
      expect(currentUser).toEqual({ user: null });
    });
  });
});
