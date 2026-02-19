/**
 * Unit Tests for Messenger v4 Service
 */

'use strict';

const MessengerV4Service = require('../../services/messenger-v4.service');
const { MongoClient, ObjectId } = require('mongodb');

describe('MessengerV4Service', () => {
  let connection;
  let db;
  let service;

  beforeAll(async () => {
    // Use in-memory MongoDB for testing
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventflow_test';
    connection = await MongoClient.connect(uri);
    db = connection.db();
  });

  afterAll(async () => {
    if (connection) {
      await connection.close();
    }
  });

  beforeEach(async () => {
    // Clean up collections before each test
    await db.collection('conversations_v4').deleteMany({});
    await db.collection('chat_messages_v4').deleteMany({});
    await db.collection('users').deleteMany({});

    // Create service instance
    service = new MessengerV4Service(db, console);

    // Create test users
    await db.collection('users').insertMany([
      {
        _id: 'user1',
        displayName: 'Alice Johnson',
        email: 'alice@example.com',
        role: 'customer',
        subscriptionTier: 'premium',
      },
      {
        _id: 'user2',
        displayName: 'Bob Smith',
        email: 'bob@example.com',
        role: 'supplier',
        subscriptionTier: 'free',
      },
      {
        _id: 'user3',
        displayName: 'Charlie Brown',
        email: 'charlie@example.com',
        role: 'customer',
        subscriptionTier: 'pro',
      },
    ]);
  });

  describe('createConversation', () => {
    it('should create a new direct conversation', async () => {
      const data = {
        type: 'direct',
        participants: [
          { userId: 'user1', displayName: 'Alice Johnson', role: 'customer' },
          { userId: 'user2', displayName: 'Bob Smith', role: 'supplier' },
        ],
      };

      const conversation = await service.createConversation(data);

      expect(conversation).toBeDefined();
      expect(conversation._id).toBeDefined();
      expect(conversation.type).toBe('direct');
      expect(conversation.participants).toHaveLength(2);
      expect(conversation.status).toBe('active');
      expect(conversation.messageCount).toBe(0);
    });

    it('should deduplicate direct conversations', async () => {
      const data = {
        type: 'direct',
        participants: [
          { userId: 'user1', displayName: 'Alice', role: 'customer' },
          { userId: 'user2', displayName: 'Bob', role: 'supplier' },
        ],
      };

      const conv1 = await service.createConversation(data);
      const conv2 = await service.createConversation(data);

      expect(conv1._id.toString()).toBe(conv2._id.toString());
    });

    it('should create conversation with context', async () => {
      const data = {
        type: 'enquiry',
        participants: [
          { userId: 'user1', displayName: 'Alice', role: 'customer' },
          { userId: 'user2', displayName: 'Bob', role: 'supplier' },
        ],
        context: {
          type: 'package',
          referenceId: 'pkg123',
          referenceTitle: 'Wedding Photography Package',
        },
      };

      const conversation = await service.createConversation(data);

      expect(conversation.type).toBe('enquiry');
      expect(conversation.context).toBeDefined();
      expect(conversation.context.type).toBe('package');
      expect(conversation.context.referenceId).toBe('pkg123');
    });

    it('should reject invalid conversation type', async () => {
      const data = {
        type: 'invalid_type',
        participants: [{ userId: 'user1', displayName: 'Alice', role: 'customer' }],
      };

      await expect(service.createConversation(data)).rejects.toThrow('Validation failed');
    });

    it('should reject empty participants', async () => {
      const data = {
        type: 'direct',
        participants: [],
      };

      await expect(service.createConversation(data)).rejects.toThrow('Validation failed');
    });
  });

  describe('getConversations', () => {
    beforeEach(async () => {
      // Create test conversations
      await db.collection('conversations_v4').insertMany([
        {
          type: 'direct',
          participants: [
            {
              userId: 'user1',
              displayName: 'Alice',
              role: 'customer',
              isPinned: false,
              isMuted: false,
              isArchived: false,
              unreadCount: 5,
              lastReadAt: null,
            },
            {
              userId: 'user2',
              displayName: 'Bob',
              role: 'supplier',
              isPinned: false,
              isMuted: false,
              isArchived: false,
              unreadCount: 0,
              lastReadAt: new Date(),
            },
          ],
          status: 'active',
          messageCount: 5,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15'),
        },
        {
          type: 'direct',
          participants: [
            {
              userId: 'user1',
              displayName: 'Alice',
              role: 'customer',
              isPinned: true,
              isMuted: false,
              isArchived: false,
              unreadCount: 0,
              lastReadAt: new Date(),
            },
            {
              userId: 'user3',
              displayName: 'Charlie',
              role: 'customer',
              isPinned: false,
              isMuted: false,
              isArchived: false,
              unreadCount: 2,
              lastReadAt: null,
            },
          ],
          status: 'active',
          messageCount: 10,
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-20'),
        },
        {
          type: 'direct',
          participants: [
            {
              userId: 'user1',
              displayName: 'Alice',
              role: 'customer',
              isPinned: false,
              isMuted: false,
              isArchived: true,
              unreadCount: 0,
              lastReadAt: new Date(),
            },
            {
              userId: 'user2',
              displayName: 'Bob',
              role: 'supplier',
              isPinned: false,
              isMuted: false,
              isArchived: false,
              unreadCount: 0,
              lastReadAt: new Date(),
            },
          ],
          status: 'active',
          messageCount: 2,
          createdAt: new Date('2024-01-05'),
          updatedAt: new Date('2024-01-10'),
        },
      ]);
    });

    it('should get all active conversations for a user', async () => {
      const conversations = await service.getConversations('user1');

      // Should exclude archived by default
      expect(conversations).toHaveLength(2);
    });

    it('should filter by unread', async () => {
      const conversations = await service.getConversations('user1', { unread: true });

      expect(conversations).toHaveLength(1);
      expect(conversations[0].participants.find((p) => p.userId === 'user1').unreadCount).toBe(5);
    });

    it('should filter by pinned', async () => {
      const conversations = await service.getConversations('user1', { pinned: true });

      expect(conversations).toHaveLength(1);
      expect(conversations[0].participants.find((p) => p.userId === 'user1').isPinned).toBe(true);
    });

    it('should include archived when explicitly requested', async () => {
      const conversations = await service.getConversations('user1', { archived: true });

      expect(conversations).toHaveLength(1);
      expect(conversations[0].participants.find((p) => p.userId === 'user1').isArchived).toBe(
        true
      );
    });

    it('should sort by updatedAt descending', async () => {
      const conversations = await service.getConversations('user1');

      expect(conversations[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
        conversations[1].updatedAt.getTime()
      );
    });
  });

  describe('sendMessage', () => {
    let conversation;

    beforeEach(async () => {
      // Create a test conversation
      conversation = await service.createConversation({
        type: 'direct',
        participants: [
          { userId: 'user1', displayName: 'Alice', role: 'customer' },
          { userId: 'user2', displayName: 'Bob', role: 'supplier' },
        ],
      });
    });

    it('should send a message successfully', async () => {
      const messageData = {
        senderId: 'user1',
        senderName: 'Alice',
        content: 'Hello Bob!',
      };

      const message = await service.sendMessage(conversation._id.toString(), messageData);

      expect(message).toBeDefined();
      expect(message._id).toBeDefined();
      expect(message.content).toBe('Hello Bob!');
      expect(message.senderId).toBe('user1');
      expect(message.type).toBe('text');
    });

    it('should update conversation lastMessage', async () => {
      const messageData = {
        senderId: 'user1',
        senderName: 'Alice',
        content: 'Test message',
      };

      await service.sendMessage(conversation._id.toString(), messageData);

      const updatedConv = await service.getConversation(conversation._id.toString(), 'user1');

      expect(updatedConv.lastMessage).toBeDefined();
      expect(updatedConv.lastMessage.content).toBe('Test message');
      expect(updatedConv.lastMessage.senderId).toBe('user1');
    });

    it('should increment message count', async () => {
      const messageData = {
        senderId: 'user1',
        senderName: 'Alice',
        content: 'Message 1',
      };

      await service.sendMessage(conversation._id.toString(), messageData);

      const updatedConv = await service.getConversation(conversation._id.toString(), 'user1');

      expect(updatedConv.messageCount).toBe(1);
    });

    it('should increment unread count for recipients', async () => {
      const messageData = {
        senderId: 'user1',
        senderName: 'Alice',
        content: 'New message',
      };

      await service.sendMessage(conversation._id.toString(), messageData);

      const updatedConv = await service.getConversation(conversation._id.toString(), 'user2');
      const user2Participant = updatedConv.participants.find((p) => p.userId === 'user2');

      expect(user2Participant.unreadCount).toBe(1);
    });

    it('should sanitize message content', async () => {
      const messageData = {
        senderId: 'user1',
        senderName: 'Alice',
        content: '<script>alert("xss")</script>Hello',
      };

      const message = await service.sendMessage(conversation._id.toString(), messageData);

      expect(message.content).not.toContain('<script>');
    });

    it('should reject empty message content', async () => {
      const messageData = {
        senderId: 'user1',
        senderName: 'Alice',
        content: '   ',
      };

      await expect(
        service.sendMessage(conversation._id.toString(), messageData)
      ).rejects.toThrow('validation failed');
    });

    it('should reject message from non-participant', async () => {
      const messageData = {
        senderId: 'user3',
        senderName: 'Charlie',
        content: 'Hello',
      };

      await expect(
        service.sendMessage(conversation._id.toString(), messageData)
      ).rejects.toThrow('not a participant');
    });
  });

  describe('updateConversation', () => {
    let conversation;

    beforeEach(async () => {
      conversation = await service.createConversation({
        type: 'direct',
        participants: [
          { userId: 'user1', displayName: 'Alice', role: 'customer' },
          { userId: 'user2', displayName: 'Bob', role: 'supplier' },
        ],
      });
    });

    it('should pin a conversation', async () => {
      const updated = await service.updateConversation(conversation._id.toString(), 'user1', {
        isPinned: true,
      });

      const participant = updated.participants.find((p) => p.userId === 'user1');
      expect(participant.isPinned).toBe(true);
    });

    it('should mute a conversation', async () => {
      const updated = await service.updateConversation(conversation._id.toString(), 'user1', {
        isMuted: true,
      });

      const participant = updated.participants.find((p) => p.userId === 'user1');
      expect(participant.isMuted).toBe(true);
    });

    it('should archive a conversation', async () => {
      const updated = await service.updateConversation(conversation._id.toString(), 'user1', {
        isArchived: true,
      });

      const participant = updated.participants.find((p) => p.userId === 'user1');
      expect(participant.isArchived).toBe(true);
    });
  });

  describe('markAsRead', () => {
    let conversation;

    beforeEach(async () => {
      conversation = await service.createConversation({
        type: 'direct',
        participants: [
          { userId: 'user1', displayName: 'Alice', role: 'customer' },
          { userId: 'user2', displayName: 'Bob', role: 'supplier' },
        ],
      });

      // Send some messages
      await service.sendMessage(conversation._id.toString(), {
        senderId: 'user2',
        senderName: 'Bob',
        content: 'Message 1',
      });
      await service.sendMessage(conversation._id.toString(), {
        senderId: 'user2',
        senderName: 'Bob',
        content: 'Message 2',
      });
    });

    it('should mark conversation as read', async () => {
      await service.markAsRead(conversation._id.toString(), 'user1');

      const updated = await service.getConversation(conversation._id.toString(), 'user1');
      const participant = updated.participants.find((p) => p.userId === 'user1');

      expect(participant.unreadCount).toBe(0);
      expect(participant.lastReadAt).toBeDefined();
    });
  });

  describe('getUnreadCount', () => {
    it('should return total unread count', async () => {
      // Create conversations with unread messages
      const conv1 = await service.createConversation({
        type: 'direct',
        participants: [
          { userId: 'user1', displayName: 'Alice', role: 'customer' },
          { userId: 'user2', displayName: 'Bob', role: 'supplier' },
        ],
      });

      const conv2 = await service.createConversation({
        type: 'direct',
        participants: [
          { userId: 'user1', displayName: 'Alice', role: 'customer' },
          { userId: 'user3', displayName: 'Charlie', role: 'customer' },
        ],
      });

      // Send messages from other users
      await service.sendMessage(conv1._id.toString(), {
        senderId: 'user2',
        senderName: 'Bob',
        content: 'Message 1',
      });
      await service.sendMessage(conv1._id.toString(), {
        senderId: 'user2',
        senderName: 'Bob',
        content: 'Message 2',
      });
      await service.sendMessage(conv2._id.toString(), {
        senderId: 'user3',
        senderName: 'Charlie',
        content: 'Message 3',
      });

      const unreadCount = await service.getUnreadCount('user1');

      expect(unreadCount).toBe(3); // 2 from conv1 + 1 from conv2
    });

    it('should exclude muted conversations from unread count', async () => {
      const conv = await service.createConversation({
        type: 'direct',
        participants: [
          { userId: 'user1', displayName: 'Alice', role: 'customer' },
          { userId: 'user2', displayName: 'Bob', role: 'supplier' },
        ],
      });

      await service.sendMessage(conv._id.toString(), {
        senderId: 'user2',
        senderName: 'Bob',
        content: 'Message',
      });

      // Mute the conversation
      await service.updateConversation(conv._id.toString(), 'user1', { isMuted: true });

      const unreadCount = await service.getUnreadCount('user1');

      expect(unreadCount).toBe(0);
    });
  });

  describe('searchContacts', () => {
    it('should find users by name', async () => {
      const contacts = await service.searchContacts('user1', 'Bob');

      expect(contacts).toHaveLength(1);
      expect(contacts[0].displayName).toBe('Bob Smith');
    });

    it('should exclude current user from results', async () => {
      const contacts = await service.searchContacts('user1', 'Alice');

      expect(contacts).toHaveLength(0);
    });

    it('should filter by role', async () => {
      const contacts = await service.searchContacts('user1', '', { role: 'supplier' });

      expect(contacts).toHaveLength(1);
      expect(contacts[0].role).toBe('supplier');
    });
  });

  describe('editMessage', () => {
    let conversation;
    let message;

    beforeEach(async () => {
      conversation = await service.createConversation({
        type: 'direct',
        participants: [
          { userId: 'user1', displayName: 'Alice', role: 'customer' },
          { userId: 'user2', displayName: 'Bob', role: 'supplier' },
        ],
      });

      message = await service.sendMessage(conversation._id.toString(), {
        senderId: 'user1',
        senderName: 'Alice',
        content: 'Original message',
      });
    });

    it('should edit a message within time window', async () => {
      const edited = await service.editMessage(message._id.toString(), 'user1', 'Edited message');

      expect(edited.content).toBe('Edited message');
      expect(edited.editedAt).toBeDefined();
    });

    it('should reject edit from non-sender', async () => {
      await expect(
        service.editMessage(message._id.toString(), 'user2', 'Hacked message')
      ).rejects.toThrow('not found or access denied');
    });
  });

  describe('toggleReaction', () => {
    let conversation;
    let message;

    beforeEach(async () => {
      conversation = await service.createConversation({
        type: 'direct',
        participants: [
          { userId: 'user1', displayName: 'Alice', role: 'customer' },
          { userId: 'user2', displayName: 'Bob', role: 'supplier' },
        ],
      });

      message = await service.sendMessage(conversation._id.toString(), {
        senderId: 'user1',
        senderName: 'Alice',
        content: 'Test message',
      });
    });

    it('should add a reaction', async () => {
      const updated = await service.toggleReaction(
        message._id.toString(),
        'user2',
        'Bob',
        '👍'
      );

      expect(updated.reactions).toHaveLength(1);
      expect(updated.reactions[0].emoji).toBe('👍');
      expect(updated.reactions[0].userId).toBe('user2');
    });

    it('should remove a reaction when toggled again', async () => {
      await service.toggleReaction(message._id.toString(), 'user2', 'Bob', '👍');
      const updated = await service.toggleReaction(
        message._id.toString(),
        'user2',
        'Bob',
        '👍'
      );

      expect(updated.reactions).toHaveLength(0);
    });
  });
});
