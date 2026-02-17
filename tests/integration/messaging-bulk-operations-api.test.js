/**
 * Integration Tests for Messaging API v2 Bulk Operations (Phase 1)
 * Tests the new bulk operation endpoints
 */

'use strict';

const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient, ObjectId } = require('mongodb');
const express = require('express');

describe('Messaging API v2 - Bulk Operations Integration', () => {
  let mongoServer;
  let mongoClient;
  let db;
  let app;
  let testUser;
  let testThread;
  let testMessages;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    mongoClient = await MongoClient.connect(mongoUri);
    db = mongoClient.db('testdb');

    // Setup Express app
    app = express();
    app.use(express.json());

    // Mock middleware
    app.use((req, res, next) => {
      req.user = { id: 'test-user-123', email: 'test@example.com' };
      next();
    });

    // Initialize routes (simplified for testing)
    const messagingRoutes = require('../../routes/messaging-v2');
    await messagingRoutes.initializeRouter({
      authRequired: (req, res, next) => next(),
      roleRequired: () => (req, res, next) => next(),
      csrfProtection: (req, res, next) => next(),
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
      mongoDb: { db },
    });

    app.use('/api/v2/messages', messagingRoutes);
  }, 60000);

  afterAll(async () => {
    await mongoClient?.close();
    await mongoServer?.stop();
  });

  beforeEach(async () => {
    // Create test user
    testUser = {
      _id: new ObjectId(),
      userId: 'test-user-123',
      email: 'test@example.com',
    };

    // Create test thread
    testThread = {
      _id: new ObjectId(),
      participants: ['test-user-123', 'other-user-456'],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('threads').insertOne(testThread);

    // Create test messages
    testMessages = [
      {
        _id: new ObjectId(),
        threadId: testThread._id.toString(),
        senderId: 'other-user-456',
        recipientIds: ['test-user-123'],
        content: 'Test message 1',
        status: 'sent',
        readBy: [],
        isStarred: false,
        isArchived: false,
        messageStatus: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        _id: new ObjectId(),
        threadId: testThread._id.toString(),
        senderId: 'other-user-456',
        recipientIds: ['test-user-123'],
        content: 'Test message 2',
        status: 'sent',
        readBy: [],
        isStarred: false,
        isArchived: false,
        messageStatus: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        _id: new ObjectId(),
        threadId: testThread._id.toString(),
        senderId: 'test-user-123',
        recipientIds: ['other-user-456'],
        content: 'Test message 3',
        status: 'sent',
        readBy: [],
        isStarred: true,
        isArchived: false,
        messageStatus: 'waiting_response',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ];

    await db.collection('messages').insertMany(testMessages);
  });

  afterEach(async () => {
    await db.collection('threads').deleteMany({});
    await db.collection('messages').deleteMany({});
    await db.collection('messageOperations').deleteMany({});
  });

  describe('POST /api/v2/messages/bulk-delete', () => {
    it('should bulk delete messages with valid input', async () => {
      const messageIds = [testMessages[0]._id.toString(), testMessages[1]._id.toString()];

      const response = await request(app)
        .post('/api/v2/messages/bulk-delete')
        .send({
          messageIds,
          threadId: testThread._id.toString(),
          reason: 'Test deletion',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deletedCount).toBe(2);
      expect(response.body.operationId).toBeDefined();
      expect(response.body.undoToken).toBeDefined();

      // Verify messages are soft deleted
      const deletedMessages = await db
        .collection('messages')
        .find({ _id: { $in: messageIds.map(id => new ObjectId(id)) } })
        .toArray();

      deletedMessages.forEach(msg => {
        expect(msg.deletedAt).toBeDefined();
        expect(msg.deletedAt).toBeInstanceOf(Date);
      });

      // Verify operation record created
      const operation = await db.collection('messageOperations').findOne({
        operationId: response.body.operationId,
      });

      expect(operation).toBeDefined();
      expect(operation.operationType).toBe('delete');
      expect(operation.messageIds).toHaveLength(2);
    });

    it('should reject bulk delete with empty message IDs', async () => {
      const response = await request(app)
        .post('/api/v2/messages/bulk-delete')
        .send({
          messageIds: [],
          threadId: testThread._id.toString(),
        })
        .expect(400);

      expect(response.body.error).toBe('messageIds array is required');
    });

    it('should reject bulk delete with more than 100 messages', async () => {
      const messageIds = Array.from({ length: 101 }, () => new ObjectId().toString());

      const response = await request(app)
        .post('/api/v2/messages/bulk-delete')
        .send({
          messageIds,
          threadId: testThread._id.toString(),
        })
        .expect(400);

      expect(response.body.error).toBe('Cannot delete more than 100 messages at once');
    });

    it('should reject bulk delete without threadId', async () => {
      const response = await request(app)
        .post('/api/v2/messages/bulk-delete')
        .send({
          messageIds: [testMessages[0]._id.toString()],
        })
        .expect(400);

      expect(response.body.error).toBe('threadId is required');
    });
  });

  describe('POST /api/v2/messages/bulk-mark-read', () => {
    it('should bulk mark messages as read', async () => {
      const messageIds = [testMessages[0]._id.toString(), testMessages[1]._id.toString()];

      const response = await request(app)
        .post('/api/v2/messages/bulk-mark-read')
        .send({
          messageIds,
          isRead: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.updatedCount).toBe(2);

      // Verify messages are marked as read
      const readMessages = await db
        .collection('messages')
        .find({ _id: { $in: messageIds.map(id => new ObjectId(id)) } })
        .toArray();

      readMessages.forEach(msg => {
        expect(msg.status).toBe('read');
        expect(msg.readBy).toContainEqual(
          expect.objectContaining({
            userId: 'test-user-123',
          })
        );
      });
    });

    it('should bulk mark messages as unread', async () => {
      // First mark as read
      const messageIds = [testMessages[0]._id.toString()];
      await db.collection('messages').updateOne(
        { _id: new ObjectId(messageIds[0]) },
        {
          $set: { status: 'read' },
          $push: { readBy: { userId: 'test-user-123', readAt: new Date() } },
        }
      );

      // Then mark as unread
      const response = await request(app)
        .post('/api/v2/messages/bulk-mark-read')
        .send({
          messageIds,
          isRead: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify message is marked as unread
      const unreadMessage = await db
        .collection('messages')
        .findOne({ _id: new ObjectId(messageIds[0]) });
      expect(unreadMessage.status).toBe('delivered');
    });

    it('should reject without message IDs', async () => {
      const response = await request(app)
        .post('/api/v2/messages/bulk-mark-read')
        .send({
          isRead: true,
        })
        .expect(400);

      expect(response.body.error).toBe('messageIds array is required');
    });

    it('should reject without isRead parameter', async () => {
      const response = await request(app)
        .post('/api/v2/messages/bulk-mark-read')
        .send({
          messageIds: [testMessages[0]._id.toString()],
        })
        .expect(400);

      expect(response.body.error).toBe('isRead must be a boolean');
    });
  });

  describe('POST /api/v2/messages/:id/flag', () => {
    it('should flag a message', async () => {
      const messageId = testMessages[0]._id.toString();

      const response = await request(app)
        .post(`/api/v2/messages/${messageId}/flag`)
        .send({
          isFlagged: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify message is flagged
      const flaggedMessage = await db
        .collection('messages')
        .findOne({ _id: new ObjectId(messageId) });
      expect(flaggedMessage.isStarred).toBe(true);
    });

    it('should unflag a message', async () => {
      const messageId = testMessages[2]._id.toString(); // This one is already starred

      const response = await request(app)
        .post(`/api/v2/messages/${messageId}/flag`)
        .send({
          isFlagged: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify message is unflagged
      const unflaggedMessage = await db
        .collection('messages')
        .findOne({ _id: new ObjectId(messageId) });
      expect(unflaggedMessage.isStarred).toBe(false);
    });

    it('should reject without isFlagged parameter', async () => {
      const messageId = testMessages[0]._id.toString();

      const response = await request(app)
        .post(`/api/v2/messages/${messageId}/flag`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('isFlagged must be a boolean');
    });
  });

  describe('POST /api/v2/messages/:id/archive', () => {
    it('should archive a message', async () => {
      const messageId = testMessages[0]._id.toString();

      const response = await request(app)
        .post(`/api/v2/messages/${messageId}/archive`)
        .send({
          action: 'archive',
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify message is archived
      const archivedMessage = await db
        .collection('messages')
        .findOne({ _id: new ObjectId(messageId) });
      expect(archivedMessage.isArchived).toBe(true);
      expect(archivedMessage.archivedAt).toBeDefined();
      expect(archivedMessage.archivedAt).toBeInstanceOf(Date);
    });

    it('should restore an archived message', async () => {
      const messageId = testMessages[0]._id.toString();

      // First archive it
      await db
        .collection('messages')
        .updateOne(
          { _id: new ObjectId(messageId) },
          { $set: { isArchived: true, archivedAt: new Date() } }
        );

      // Then restore it
      const response = await request(app)
        .post(`/api/v2/messages/${messageId}/archive`)
        .send({
          action: 'restore',
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify message is restored
      const restoredMessage = await db
        .collection('messages')
        .findOne({ _id: new ObjectId(messageId) });
      expect(restoredMessage.isArchived).toBe(false);
      expect(restoredMessage.archivedAt).toBeNull();
    });

    it('should reject with invalid action', async () => {
      const messageId = testMessages[0]._id.toString();

      const response = await request(app)
        .post(`/api/v2/messages/${messageId}/archive`)
        .send({
          action: 'invalid',
        })
        .expect(400);

      expect(response.body.error).toBe('action must be "archive" or "restore"');
    });
  });

  describe('POST /api/v2/messages/operations/:operationId/undo', () => {
    it('should undo a bulk delete operation', async () => {
      // First perform a bulk delete
      const messageIds = [testMessages[0]._id.toString(), testMessages[1]._id.toString()];
      const deleteResponse = await request(app).post('/api/v2/messages/bulk-delete').send({
        messageIds,
        threadId: testThread._id.toString(),
      });

      const { operationId, undoToken } = deleteResponse.body;

      // Then undo it
      const undoResponse = await request(app)
        .post(`/api/v2/messages/operations/${operationId}/undo`)
        .send({
          undoToken,
        })
        .expect(200);

      expect(undoResponse.body.success).toBe(true);
      expect(undoResponse.body.restoredCount).toBe(2);

      // Verify messages are restored
      const restoredMessages = await db
        .collection('messages')
        .find({ _id: { $in: messageIds.map(id => new ObjectId(id)) } })
        .toArray();

      restoredMessages.forEach(msg => {
        expect(msg.deletedAt).toBeNull();
      });

      // Verify operation is marked as undone
      const operation = await db.collection('messageOperations').findOne({ operationId });
      expect(operation.isUndone).toBe(true);
      expect(operation.undoneAt).toBeDefined();
    });

    it('should reject undo without token', async () => {
      const response = await request(app)
        .post('/api/v2/messages/operations/op123/undo')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('undoToken is required');
    });

    it('should reject undo with invalid operation ID', async () => {
      const response = await request(app)
        .post('/api/v2/messages/operations/invalid-op/undo')
        .send({
          undoToken: 'some-token',
        })
        .expect(400);

      expect(response.body.error).toContain('Operation not found');
    });
  });

  describe('GET /api/v2/messages/:threadId with filters', () => {
    it('should fetch messages with date sorting', async () => {
      const response = await request(app)
        .get(`/api/v2/messages/${testThread._id.toString()}`)
        .query({ sortBy: 'date-asc' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.messages).toBeDefined();
      expect(Array.isArray(response.body.messages)).toBe(true);
    });

    it('should filter unread messages', async () => {
      const response = await request(app)
        .get(`/api/v2/messages/${testThread._id.toString()}`)
        .query({ filterBy: 'unread' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.messages).toBeDefined();

      // All returned messages should be unread
      response.body.messages.forEach(msg => {
        expect(msg.readBy || []).toHaveLength(0);
      });
    });

    it('should filter flagged messages', async () => {
      const response = await request(app)
        .get(`/api/v2/messages/${testThread._id.toString()}`)
        .query({ filterBy: 'flagged' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Only flagged message should be returned
      expect(response.body.messages).toHaveLength(1);
      expect(response.body.messages[0].isStarred).toBe(true);
    });

    it('should filter by message status', async () => {
      const response = await request(app)
        .get(`/api/v2/messages/${testThread._id.toString()}`)
        .query({ status: 'waiting_response' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Only message with waiting_response status should be returned
      response.body.messages.forEach(msg => {
        expect(msg.messageStatus).toBe('waiting_response');
      });
    });
  });
});
