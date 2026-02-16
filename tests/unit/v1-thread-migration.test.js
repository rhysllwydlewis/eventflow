/**
 * V1 Thread Migration Tests
 * Tests for the migration of v1 threads to MongoDB with participants array synthesis
 */

'use strict';

describe('V1 Thread Migration', () => {
  /**
   * Simulate the migration logic for synthesizing participants array
   */
  function synthesizeParticipants(thread) {
    const participants = [];
    if (thread.customerId) {
      participants.push(thread.customerId);
    }
    if (thread.recipientId && !participants.includes(thread.recipientId)) {
      participants.push(thread.recipientId);
    }
    // Filter out any null/undefined values
    return participants.filter(Boolean);
  }

  describe('participants array synthesis', () => {
    it('should create participants array from customerId and recipientId', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: 'usr_customer1',
        recipientId: 'usr_recipient1',
        supplierId: 'sup_supplier1',
      };
      const participants = synthesizeParticipants(thread);
      expect(participants).toEqual(['usr_customer1', 'usr_recipient1']);
    });

    it('should handle thread with only customerId', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: 'usr_customer1',
        supplierId: 'sup_supplier1',
      };
      const participants = synthesizeParticipants(thread);
      expect(participants).toEqual(['usr_customer1']);
    });

    it('should handle thread with only recipientId', () => {
      const thread = {
        id: 'thd_abc123',
        recipientId: 'usr_recipient1',
        supplierId: 'sup_supplier1',
      };
      const participants = synthesizeParticipants(thread);
      expect(participants).toEqual(['usr_recipient1']);
    });

    it('should handle thread where customerId equals recipientId (no duplicates)', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: 'usr_customer1',
        recipientId: 'usr_customer1',
      };
      const participants = synthesizeParticipants(thread);
      expect(participants).toEqual(['usr_customer1']);
    });

    it('should handle thread with null/undefined fields', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: null,
        recipientId: undefined,
      };
      const participants = synthesizeParticipants(thread);
      expect(participants).toEqual([]);
    });

    it('should not include supplierId in participants (it is a supplier DB ID, not a user ID)', () => {
      const thread = {
        id: 'thd_abc123',
        customerId: 'usr_customer1',
        supplierId: 'sup_supplier1',
      };
      const participants = synthesizeParticipants(thread);
      expect(participants).not.toContain('sup_supplier1');
      expect(participants).toEqual(['usr_customer1']);
    });
  });

  describe('message transformation to v2 format', () => {
    it('should transform v1 message fields to v2 aliases', () => {
      const v1Message = {
        id: 'msg_abc123',
        threadId: 'thd_xyz789',
        fromUserId: 'usr_sender1',
        text: 'Hello world',
        createdAt: '2025-12-26T19:33:20.243Z',
        status: 'sent',
      };

      const v2Message = {
        ...v1Message,
        senderId: v1Message.senderId || v1Message.fromUserId,
        content: v1Message.content || v1Message.text,
        sentAt: v1Message.sentAt || v1Message.createdAt,
        readBy: v1Message.readBy || [],
        status: v1Message.status || 'sent',
      };

      expect(v2Message.senderId).toBe('usr_sender1');
      expect(v2Message.content).toBe('Hello world');
      expect(v2Message.sentAt).toBe('2025-12-26T19:33:20.243Z');
      expect(v2Message.readBy).toEqual([]);
      expect(v2Message.status).toBe('sent');
    });

    it('should preserve v2 fields if already present', () => {
      const message = {
        id: 'msg_abc123',
        senderId: 'usr_sender2',
        content: 'Hello from v2',
        sentAt: '2025-12-27T10:00:00.000Z',
        readBy: ['usr_reader1'],
        status: 'read',
      };

      const transformed = {
        ...message,
        senderId: message.senderId || message.fromUserId,
        content: message.content || message.text,
        sentAt: message.sentAt || message.createdAt,
        readBy: message.readBy || [],
        status: message.status || 'sent',
      };

      expect(transformed.senderId).toBe('usr_sender2');
      expect(transformed.content).toBe('Hello from v2');
      expect(transformed.sentAt).toBe('2025-12-27T10:00:00.000Z');
      expect(transformed.readBy).toEqual(['usr_reader1']);
      expect(transformed.status).toBe('read');
    });
  });
});
