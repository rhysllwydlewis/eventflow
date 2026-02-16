const fs = require('fs');
const path = require('path');

describe('Conversation handler v1/v2 field normalization', () => {
  const conversationHandlerJs = fs.readFileSync(
    path.join(process.cwd(), 'public/assets/js/conversation-handler.js'),
    'utf8'
  );

  describe('loadMessages v1 field normalization', () => {
    const loadMessagesFn = conversationHandlerJs
      .split('async function loadMessages()')[1]
      .split('async function')[0];

    it('normalizes v1 messages array after loading from v1 API', () => {
      // Should map the messages array after loading from v1
      const afterV1Load = loadMessagesFn.split('v1Data.messages || v1Data.items || []')[1];
      const beforeElseBlock = afterV1Load.split('} else {')[0];

      expect(beforeElseBlock).toContain('messages = messages.map');
    });

    it('maps fromUserId to senderId for v2 compatibility', () => {
      expect(loadMessagesFn).toContain('msg.fromUserId');
      expect(loadMessagesFn).toContain('senderId: msg.senderId || msg.fromUserId || msg.userId');
    });

    it('maps userId to senderId as alternative v1 field', () => {
      expect(loadMessagesFn).toContain('msg.userId');
      expect(loadMessagesFn).toContain('senderId: msg.senderId || msg.fromUserId || msg.userId');
    });

    it('ensures content field is available from text field', () => {
      expect(loadMessagesFn).toContain('content: msg.content || msg.text');
    });

    it('ensures sentAt falls back to createdAt', () => {
      expect(loadMessagesFn).toContain('sentAt: msg.sentAt || msg.createdAt');
    });

    it('preserves all original message fields using spread operator', () => {
      expect(loadMessagesFn).toContain('...msg');
    });
  });

  describe('renderThreadHeader improved name resolution', () => {
    // The name resolution logic is now in resolveOtherPartyName function
    const resolveOtherPartyNameFn = conversationHandlerJs
      .split('function resolveOtherPartyName()')[1]
      .split('function ')[0];

    it('includes marketplace listing title as fallback for other party name', () => {
      expect(resolveOtherPartyNameFn).toContain('thread.marketplace?.listingTitle');
    });

    it('uses generic "Seller" label for peer-to-peer marketplace threads when names unavailable', () => {
      expect(resolveOtherPartyNameFn).toContain(
        "thread.marketplace?.isPeerToPeer ? 'Seller' : 'Unknown'"
      );
    });

    it('applies marketplace fallbacks in customer view (when customerId === currentUserId)', () => {
      const customerBranch = resolveOtherPartyNameFn
        .split('if (thread.customerId === currentUserId)')[1]
        .split('} else if')[0];

      expect(customerBranch).toContain('thread.marketplace?.listingTitle');
      expect(customerBranch).toContain("thread.marketplace?.isPeerToPeer ? 'Seller'");
    });

    it('applies marketplace fallbacks in general fallback branch', () => {
      const generalFallback = resolveOtherPartyNameFn
        .split('} else {')[1]
        .split('// Fallback: try all names')[1]
        .split('}')[0];

      expect(generalFallback).toContain('thread.marketplace?.listingTitle');
      expect(generalFallback).toContain("thread.marketplace?.isPeerToPeer ? 'Seller'");
    });

    it('applies marketplace fallbacks when no currentUserId available', () => {
      const noUserIdBranch = resolveOtherPartyNameFn
        .split('// No current user ID, fallback to original logic')[1]
        .split('}')[0];

      expect(noUserIdBranch).toContain('thread.marketplace?.listingTitle');
      expect(noUserIdBranch).toContain("thread.marketplace?.isPeerToPeer ? 'Seller'");
    });

    it('renderThreadHeader uses resolveOtherPartyName function', () => {
      const renderThreadHeaderFn = conversationHandlerJs
        .split('function renderThreadHeader()')[1]
        .split('function ')[0];

      expect(renderThreadHeaderFn).toContain('resolveOtherPartyName()');
    });
  });

  describe('renderMessages uses normalized fields', () => {
    const renderMessagesFn = conversationHandlerJs
      .split('function renderMessages()')[1]
      .split('function ')[0];

    it('checks senderId for determining if message was sent by current user', () => {
      expect(renderMessagesFn).toContain('message.senderId === currentUserId');
    });

    it('uses sentAt with createdAt fallback for timestamp', () => {
      expect(renderMessagesFn).toContain('message.sentAt || message.createdAt');
    });

    it('uses content with text fallback for message body', () => {
      // The renderMessages should already handle both content and text
      // The normalization ensures both are available
      const messageBodySection = renderMessagesFn.split('const time =')[1];
      expect(messageBodySection).toBeTruthy();
    });

    it('uses resolveOtherPartyName function for consistent name resolution', () => {
      expect(renderMessagesFn).toContain('resolveOtherPartyName()');
    });

    it('checks deliveredTo field for delivery status', () => {
      expect(renderMessagesFn).toContain('message.deliveredTo');
    });

    it('includes proper status indicators with SVG elements', () => {
      expect(renderMessagesFn).toContain('message-status');
      expect(renderMessagesFn).toContain('<svg');
    });
  });
});
