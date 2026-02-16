/**
 * Thread Participant Access Tests
 * Tests for isThreadParticipant() helper handling both v1 and v2 threads
 */

'use strict';

const { ObjectId } = require('mongodb');

describe('Thread Participant Access', () => {
  /**
   * Mock isThreadParticipant function (extracted from messaging-v2.js)
   */
  function isThreadParticipant(thread, userId) {
    if (!thread || !userId) {
      return false;
    }

    // v2 threads have a participants array
    if (thread.participants && Array.isArray(thread.participants)) {
      return thread.participants.includes(userId);
    }

    // v1 threads use customerId/supplierId/recipientId fields
    if (thread.customerId === userId) {
      return true;
    }
    if (thread.recipientId === userId) {
      return true;
    }
    if (thread.supplierId === userId) {
      return true;
    }

    return false;
  }

  describe('v2 thread with participants array', () => {
    it('should allow access for user in participants array', () => {
      const thread = {
        _id: new ObjectId(),
        participants: ['user123', 'user456'],
        status: 'active',
      };
      expect(isThreadParticipant(thread, 'user123')).toBe(true);
      expect(isThreadParticipant(thread, 'user456')).toBe(true);
    });

    it('should deny access for user not in participants array', () => {
      const thread = {
        _id: new ObjectId(),
        participants: ['user123', 'user456'],
        status: 'active',
      };
      expect(isThreadParticipant(thread, 'user789')).toBe(false);
    });

    it('should handle empty participants array', () => {
      const thread = {
        _id: new ObjectId(),
        participants: [],
        status: 'active',
      };
      expect(isThreadParticipant(thread, 'user123')).toBe(false);
    });
  });

  describe('v1 thread with customerId/supplierId/recipientId', () => {
    it('should allow access for customerId', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: 'customer123',
        supplierId: 'supplier456',
        recipientId: 'user789',
      };
      expect(isThreadParticipant(thread, 'customer123')).toBe(true);
    });

    it('should allow access for supplierId', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: 'customer123',
        supplierId: 'supplier456',
        recipientId: 'user789',
      };
      expect(isThreadParticipant(thread, 'supplier456')).toBe(true);
    });

    it('should allow access for recipientId', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: 'customer123',
        supplierId: 'supplier456',
        recipientId: 'user789',
      };
      expect(isThreadParticipant(thread, 'user789')).toBe(true);
    });

    it('should deny access for user not in any v1 field', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: 'customer123',
        supplierId: 'supplier456',
        recipientId: 'user789',
      };
      expect(isThreadParticipant(thread, 'unauthorized999')).toBe(false);
    });

    it('should handle v1 thread with null recipientId', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: 'customer123',
        supplierId: 'supplier456',
        recipientId: null,
      };
      expect(isThreadParticipant(thread, 'customer123')).toBe(true);
      expect(isThreadParticipant(thread, 'supplier456')).toBe(true);
      expect(isThreadParticipant(thread, null)).toBe(false);
    });

    it('should handle marketplace peer-to-peer thread', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: 'buyer123',
        supplierId: null,
        recipientId: 'seller456',
        marketplace: { listingId: 'listing789' },
      };
      expect(isThreadParticipant(thread, 'buyer123')).toBe(true);
      expect(isThreadParticipant(thread, 'seller456')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle null thread', () => {
      expect(isThreadParticipant(null, 'user123')).toBe(false);
    });

    it('should handle undefined thread', () => {
      expect(isThreadParticipant(undefined, 'user123')).toBe(false);
    });

    it('should handle null userId', () => {
      const thread = {
        _id: new ObjectId(),
        participants: ['user123'],
      };
      expect(isThreadParticipant(thread, null)).toBe(false);
    });

    it('should handle undefined userId', () => {
      const thread = {
        _id: new ObjectId(),
        participants: ['user123'],
      };
      expect(isThreadParticipant(thread, undefined)).toBe(false);
    });

    it('should handle thread with neither participants nor v1 fields', () => {
      const thread = {
        _id: new ObjectId(),
        status: 'active',
      };
      expect(isThreadParticipant(thread, 'user123')).toBe(false);
    });

    it('should handle empty string userId', () => {
      const thread = {
        _id: new ObjectId(),
        participants: ['user123'],
      };
      expect(isThreadParticipant(thread, '')).toBe(false);
    });
  });

  describe('recipientIds computation', () => {
    it('should compute recipientIds for v2 thread', () => {
      const thread = {
        _id: new ObjectId(),
        participants: ['user123', 'user456', 'user789'],
      };
      const currentUserId = 'user123';

      let recipientIds;
      if (thread.participants && Array.isArray(thread.participants)) {
        recipientIds = thread.participants.filter(p => p !== currentUserId);
      } else {
        recipientIds = [thread.customerId, thread.recipientId, thread.supplierId].filter(
          id => id && id !== currentUserId
        );
      }

      expect(recipientIds).toEqual(['user456', 'user789']);
    });

    it('should compute recipientIds for v1 thread', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: 'customer123',
        supplierId: 'supplier456',
        recipientId: 'user789',
      };
      const currentUserId = 'customer123';

      let recipientIds;
      if (thread.participants && Array.isArray(thread.participants)) {
        recipientIds = thread.participants.filter(p => p !== currentUserId);
      } else {
        recipientIds = [thread.customerId, thread.recipientId, thread.supplierId].filter(
          id => id && id !== currentUserId
        );
      }

      expect(recipientIds).toContain('user789');
      expect(recipientIds).toContain('supplier456');
      expect(recipientIds).not.toContain('customer123');
    });

    it('should handle v1 thread with null supplierId', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: 'customer123',
        supplierId: null,
        recipientId: 'user789',
      };
      const currentUserId = 'customer123';

      let recipientIds;
      if (thread.participants && Array.isArray(thread.participants)) {
        recipientIds = thread.participants.filter(p => p !== currentUserId);
      } else {
        recipientIds = [thread.customerId, thread.recipientId, thread.supplierId].filter(
          id => id && id !== currentUserId
        );
      }

      expect(recipientIds).toEqual(['user789']);
      expect(recipientIds).not.toContain(null);
    });
  });
});
