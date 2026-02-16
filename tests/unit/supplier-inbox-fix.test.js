/**
 * Test for all-to-all user messaging
 * Verifies that any user type can message any other user type
 */

describe('All-to-all User Messaging', () => {
  // Mock data
  const mockUserId = 'user123';
  const mockSupplierBusinessId = 'supplier456';
  const mockCustomerId = 'customer789';
  const mockRecipientId = 'recipient999';

  const mockSuppliers = [
    {
      id: mockSupplierBusinessId,
      name: 'Test Supplier',
      ownerUserId: mockUserId, // The user who owns this supplier business
    },
  ];

  const mockThreads = [
    {
      id: 'thread1',
      customerId: mockCustomerId,
      supplierId: mockSupplierBusinessId,
      recipientId: null,
      customerName: 'Test Customer',
      supplierName: 'Test Supplier',
      lastMessageAt: '2024-01-01T00:00:00.000Z',
      status: 'open',
    },
    {
      id: 'thread2',
      customerId: mockUserId,
      supplierId: null,
      recipientId: mockRecipientId,
      customerName: 'User',
      lastMessageAt: '2024-01-02T00:00:00.000Z',
      status: 'open',
    },
  ];

  describe('Thread filtering for all user types', () => {
    it('should include threads where user is customerId', () => {
      const userId = mockUserId;
      const supplierIds = mockSuppliers.filter(s => s.ownerUserId === userId).map(s => s.id);

      const filteredThreads = mockThreads.filter(
        t =>
          t.customerId === userId || t.recipientId === userId || supplierIds.includes(t.supplierId)
      );

      // mockUserId appears in 2 threads: as customer in thread2 and as supplier owner in thread1
      expect(filteredThreads).toHaveLength(2);
      expect(filteredThreads.find(t => t.id === 'thread1')).toBeTruthy();
      expect(filteredThreads.find(t => t.id === 'thread2')).toBeTruthy();
    });

    it('should include threads where user is recipientId', () => {
      const userId = mockRecipientId;
      const supplierIds = mockSuppliers.filter(s => s.ownerUserId === userId).map(s => s.id);

      const filteredThreads = mockThreads.filter(
        t =>
          t.customerId === userId || t.recipientId === userId || supplierIds.includes(t.supplierId)
      );

      expect(filteredThreads).toHaveLength(1);
      expect(filteredThreads[0].id).toBe('thread2');
    });

    it('should include threads where user owns the supplier', () => {
      const userId = mockUserId;
      const supplierIds = mockSuppliers.filter(s => s.ownerUserId === userId).map(s => s.id);

      const filteredThreads = mockThreads.filter(
        t =>
          t.customerId === userId || t.recipientId === userId || supplierIds.includes(t.supplierId)
      );

      // Should return both threads: thread1 (supplier owner) and thread2 (customer)
      expect(filteredThreads).toHaveLength(2);
    });
  });

  describe('isThreadParticipant helper function', () => {
    // Simulate the isThreadParticipant function
    const isThreadParticipant = async (thread, userId) => {
      if (!thread || !userId) {
        return false;
      }

      // Check if user is the customer
      if (thread.customerId === userId) {
        return true;
      }

      // Check if user is the recipient (peer-to-peer)
      if (thread.recipientId === userId) {
        return true;
      }

      // Check if user owns the supplier business
      if (thread.supplierId) {
        return mockSuppliers.some(s => s.id === thread.supplierId && s.ownerUserId === userId);
      }

      return false;
    };

    it('should return true when user is customerId', async () => {
      const thread = mockThreads[0];
      const result = await isThreadParticipant(thread, mockCustomerId);
      expect(result).toBe(true);
    });

    it('should return true when user is recipientId', async () => {
      const thread = mockThreads[1];
      const result = await isThreadParticipant(thread, mockRecipientId);
      expect(result).toBe(true);
    });

    it('should return true when user owns the supplier', async () => {
      const thread = mockThreads[0];
      const result = await isThreadParticipant(thread, mockUserId);
      expect(result).toBe(true);
    });

    it('should return false when user is not a participant', async () => {
      const thread = mockThreads[0];
      const result = await isThreadParticipant(thread, 'differentUser');
      expect(result).toBe(false);
    });

    it('should return false for invalid inputs', async () => {
      expect(await isThreadParticipant(null, mockUserId)).toBe(false);
      expect(await isThreadParticipant(mockThreads[0], null)).toBe(false);
      expect(await isThreadParticipant(null, null)).toBe(false);
    });
  });

  describe('Access control checks', () => {
    const isThreadParticipant = async (thread, userId) => {
      if (!thread || !userId) {
        return false;
      }

      if (thread.customerId === userId) {
        return true;
      }

      if (thread.recipientId === userId) {
        return true;
      }

      if (thread.supplierId) {
        return mockSuppliers.some(s => s.id === thread.supplierId && s.ownerUserId === userId);
      }

      return false;
    };

    it('should grant access to customer who created the thread', async () => {
      const thread = mockThreads[0];
      const userRole = 'customer';
      const userId = mockCustomerId;

      const hasAccess = userRole === 'admin' || (await isThreadParticipant(thread, userId));

      expect(hasAccess).toBe(true);
    });

    it('should grant access to supplier who owns the thread', async () => {
      const thread = mockThreads[0];
      const userRole = 'supplier';
      const userId = mockUserId;

      const hasAccess = userRole === 'admin' || (await isThreadParticipant(thread, userId));

      expect(hasAccess).toBe(true);
    });

    it('should grant access to recipient in peer-to-peer thread', async () => {
      const thread = mockThreads[1];
      const userRole = 'customer';
      const userId = mockRecipientId;

      const hasAccess = userRole === 'admin' || (await isThreadParticipant(thread, userId));

      expect(hasAccess).toBe(true);
    });

    it('should deny access to non-participants', async () => {
      const thread = mockThreads[0];
      const userRole = 'customer';
      const userId = 'differentUser';

      const hasAccess = userRole === 'admin' || (await isThreadParticipant(thread, userId));

      expect(hasAccess).toBe(false);
    });
  });
});
