/**
 * Tests for messaging dashboard fixes
 * Validates that customer and supplier dashboards can send messages and mark threads as read
 */

const fs = require('fs');
const path = require('path');

describe('Messaging Dashboard Fixes', () => {
  describe('messaging.js client-side fixes', () => {
    const messagingJs = fs.readFileSync(
      path.join(process.cwd(), 'public/assets/js/messaging.js'),
      'utf8'
    );

    it('transforms message field to content field in sendMessageViaAPI', () => {
      const sendMessageFn = messagingJs
        .split('async sendMessageViaAPI(conversationId, messageData)')[1]
        .split('async ')[0];

      // Should transform message to content for v2 API compatibility
      expect(sendMessageFn).toContain('if (payload.message && !payload.content)');
      expect(sendMessageFn).toContain('payload.content = payload.message');
      expect(sendMessageFn).toContain('delete payload.message');
    });

    it('extracts error messages from API responses in sendMessageViaAPI', () => {
      const sendMessageFn = messagingJs
        .split('async sendMessageViaAPI(conversationId, messageData)')[1]
        .split('async ')[0];

      // Should extract error message from response
      expect(sendMessageFn).toContain('await response.json().catch(() => ({}))');
      expect(sendMessageFn).toContain('errorData.message || errorData.error');
    });

    it('uses correct v2 endpoint for markMessagesAsReadViaAPI', () => {
      const markAsReadFn = messagingJs
        .split('async markMessagesAsReadViaAPI(conversationId)')[1]
        .split('async ')[0];

      // Should use /api/v2/messages/threads/:threadId/read endpoint
      expect(markAsReadFn).toContain('/api/v2/messages/threads/${conversationId}/read');
      expect(markAsReadFn).not.toContain('/api/v2/messages/${conversationId}/read');
    });

    it('extracts error messages in markMessagesAsReadViaAPI', () => {
      const markAsReadFn = messagingJs
        .split('async markMessagesAsReadViaAPI(conversationId)')[1]
        .split('async ')[0];

      // Should extract error message from response
      expect(markAsReadFn).toContain('await response.json().catch(() => ({}))');
      expect(markAsReadFn).toContain('errorData.message || errorData.error');
    });

    it('uses correct v2 endpoint in MessagingManager.markMessagesAsRead', () => {
      const markAsReadFn = messagingJs
        .split('async markMessagesAsRead(threadId)')[1]
        .split('async ')[0];

      // Should use /api/v2/messages/threads/:threadId/read endpoint
      expect(markAsReadFn).toContain('/api/v2/messages/threads/${threadId}/read');
      expect(markAsReadFn).not.toContain('/mark-read');
    });

    it('extracts error messages in MessagingManager.markMessagesAsRead', () => {
      const markAsReadFn = messagingJs
        .split('async markMessagesAsRead(threadId)')[1]
        .split('async ')[0];

      // Should extract error message from response
      expect(markAsReadFn).toContain('await response.json().catch(() => ({}))');
      expect(markAsReadFn).toContain('errorData.message || errorData.error');
    });
  });

  describe('messaging-v2.js server-side fixes', () => {
    const messagingV2Js = fs.readFileSync(
      path.join(process.cwd(), 'routes/messaging-v2.js'),
      'utf8'
    );

    it('supports both content and message fields in send message endpoint', () => {
      // Find the route handler code between the comment and the next router call
      const startMarker = '* Send message in thread';
      const startIdx = messagingV2Js.indexOf(startMarker);
      const endIdx = messagingV2Js.indexOf('router.post', startIdx + 100);
      const sendMessageRoute = messagingV2Js.substring(startIdx, endIdx);

      // Should destructure both content and message (as legacyMessage)
      expect(sendMessageRoute).toContain('message: legacyMessage');

      // Should use message as content if content is not provided
      expect(sendMessageRoute).toContain('if (!content && legacyMessage)');
      expect(sendMessageRoute).toContain('content = legacyMessage');
    });

    it('maintains backward compatibility with message field', () => {
      const startMarker = '* Send message in thread';
      const startIdx = messagingV2Js.indexOf(startMarker);
      const endIdx = messagingV2Js.indexOf('router.post', startIdx + 100);
      const sendMessageRoute = messagingV2Js.substring(startIdx, endIdx);

      // Should still validate that content or attachments are required
      expect(sendMessageRoute).toContain(
        'if (!content && (!attachments || attachments.length === 0))'
      );
      expect(sendMessageRoute).toContain("error: 'content or attachments required'");
    });

    it('POST /api/v2/messages/threads/:threadId/read endpoint exists', () => {
      // Endpoint should exist
      expect(messagingV2Js).toContain("'/threads/:threadId/read',");
      expect(messagingV2Js).toContain('Mark all messages in thread as read');
    });
  });

  describe('customer-messages.js usage', () => {
    const customerMessagesJs = fs.readFileSync(
      path.join(process.cwd(), 'public/assets/js/customer-messages.js'),
      'utf8'
    );

    it('sends message with sendMessage method from messaging system', () => {
      // Should use messagingSystem.sendMessage which now handles transformation
      expect(customerMessagesJs).toContain('await messagingSystem.sendMessage(conversationId,');
      expect(customerMessagesJs).toContain('message: messageText');
    });

    it('marks messages as read using markMessagesAsRead', () => {
      // Should use messagingSystem.markMessagesAsRead which now uses correct endpoint
      expect(customerMessagesJs).toContain('messagingSystem.markMessagesAsRead(conversationId');
    });
  });

  describe('supplier-messages.js usage', () => {
    const supplierMessagesJs = fs.readFileSync(
      path.join(process.cwd(), 'public/assets/js/supplier-messages.js'),
      'utf8'
    );

    it('sends message with sendMessage method from messaging system', () => {
      // Should use messagingSystem.sendMessage which now handles transformation
      expect(supplierMessagesJs).toContain('await messagingSystem.sendMessage(conversationId,');
      expect(supplierMessagesJs).toContain('message: messageText');
    });

    it('marks messages as read using markMessagesAsRead', () => {
      // Should use messagingSystem.markMessagesAsRead which now uses correct endpoint
      expect(supplierMessagesJs).toContain('messagingSystem.markMessagesAsRead(conversationId');
    });
  });
});
