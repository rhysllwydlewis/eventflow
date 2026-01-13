/**
 * WebSocket Server v2
 * Production-ready WebSocket messaging server with clustering support
 */

'use strict';

const { Server } = require('socket.io');
// eslint-disable-next-line node/no-unpublished-require, node/no-missing-require
const logger = require('../utils/logger');
// eslint-disable-next-line node/no-unpublished-require, node/no-missing-require
const { PresenceService } = require('../services/presenceService');

// Try to load Redis adapter for clustering (optional)
let RedisAdapter;
let redisClient;
try {
  // eslint-disable-next-line node/no-missing-require
  const { createAdapter } = require('@socket.io/redis-adapter');
  const Redis = require('ioredis');
  RedisAdapter = createAdapter;
  
  // Initialize Redis if REDIS_URL is set
  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL);
    logger.info('Redis client initialized for WebSocket clustering');
  }
} catch (error) {
  logger.warn('Redis adapter not available - WebSocket clustering disabled', {
    error: error.message,
  });
}

class WebSocketServerV2 {
  constructor(httpServer, messagingService = null, notificationService = null) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.BASE_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
    });

    this.messagingService = messagingService;
    this.notificationService = notificationService;
    
    // Initialize presence service with Redis if available
    this.presenceService = new PresenceService(redisClient);

    // Tracking maps
    this.userSockets = new Map(); // userId -> Set of socket IDs
    this.socketUsers = new Map(); // socketId -> userId
    
    // Typing indicators tracking
    this.typingUsers = new Map(); // threadId -> Set of userIds

    // Setup Redis adapter if available
    if (RedisAdapter && redisClient) {
      try {
        const pubClient = redisClient;
        const subClient = pubClient.duplicate();
        this.io.adapter(RedisAdapter(pubClient, subClient));
        logger.info('Socket.IO Redis adapter enabled for clustering');
      } catch (error) {
        logger.error('Failed to setup Redis adapter', { error: error.message });
      }
    }

    this.init();
  }

  init() {
    this.io.on('connection', socket => {
      logger.debug('WebSocket connected', { socketId: socket.id });

      // Authentication handler
      socket.on('auth', async data => {
        await this.handleAuth(socket, data);
      });

      // Message handlers
      socket.on('message:send', async data => {
        await this.handleMessageSend(socket, data);
      });

      // Typing indicators
      socket.on('typing:start', data => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing:stop', data => {
        this.handleTypingStop(socket, data);
      });

      // Read receipts
      socket.on('message:read', async data => {
        await this.handleMessageRead(socket, data);
      });

      socket.on('thread:read', async data => {
        await this.handleThreadRead(socket, data);
      });

      // Reactions
      socket.on('reaction:send', async data => {
        await this.handleReactionSend(socket, data);
      });

      // Presence
      socket.on('presence:update', async data => {
        await this.handlePresenceUpdate(socket, data);
      });

      socket.on('presence:sync', async data => {
        await this.handlePresenceSync(socket, data);
      });

      // Join/leave rooms
      socket.on('join', room => {
        socket.join(room);
        logger.debug('Socket joined room', { socketId: socket.id, room });
      });

      socket.on('leave', room => {
        socket.leave(room);
        logger.debug('Socket left room', { socketId: socket.id, room });
      });

      // Disconnection
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });

      // Error handling
      socket.on('error', error => {
        logger.error('Socket error', {
          socketId: socket.id,
          error: error.message,
        });
      });
    });

    // Periodic cleanup
    setInterval(() => {
      this.cleanup();
    }, 300000); // Every 5 minutes

    logger.info('WebSocket Server v2 initialized');
  }

  /**
   * Handle user authentication
   */
  async handleAuth(socket, data) {
    try {
      if (!data || !data.userId) {
        socket.emit('auth:error', { error: 'Missing userId' });
        return;
      }

      const { userId } = data;

      // Store user-socket mapping
      socket.userId = userId;
      this.socketUsers.set(socket.id, userId);

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId).add(socket.id);

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Set user as online
      await this.presenceService.setOnline(userId, socket.id);

      // Emit presence update to contacts
      this.broadcastPresenceUpdate(userId, 'online');

      socket.emit('auth:success', { userId });

      logger.info('User authenticated', { userId, socketId: socket.id });
    } catch (error) {
      logger.error('Auth error', { error: error.message });
      socket.emit('auth:error', { error: error.message });
    }
  }

  /**
   * Handle message send
   */
  async handleMessageSend(socket, data) {
    try {
      if (!socket.userId) {
        socket.emit('message:error', { error: 'Not authenticated' });
        return;
      }

      if (!this.messagingService) {
        socket.emit('message:error', { error: 'Messaging service not available' });
        return;
      }

      const { threadId, content, attachments } = data;

      // Validate data
      if (!threadId || (!content && !attachments)) {
        socket.emit('message:error', { error: 'Missing required fields' });
        return;
      }

      // Get thread to find recipients
      const thread = await this.messagingService.getThread(threadId);
      if (!thread) {
        socket.emit('message:error', { error: 'Thread not found' });
        return;
      }

      const recipientIds = thread.participants.filter(p => p !== socket.userId);

      // Send message via messaging service
      const message = await this.messagingService.sendMessage({
        threadId,
        senderId: socket.userId,
        recipientIds,
        content,
        attachments: attachments || [],
      });

      // Emit to sender (confirmation)
      socket.emit('message:sent', {
        messageId: message._id.toString(),
        threadId,
        message,
      });

      // Broadcast to recipients
      for (const recipientId of recipientIds) {
        this.io.to(`user:${recipientId}`).emit('message:received', {
          threadId,
          message,
        });
      }

      // Send notifications to offline recipients
      if (this.notificationService) {
        for (const recipientId of recipientIds) {
          const isOnline = await this.presenceService.isOnline(recipientId);
          if (!isOnline) {
            await this.notificationService.sendNotification(recipientId, {
              type: 'message',
              title: 'New Message',
              message: content?.substring(0, 100) || 'You have a new message',
              data: {
                threadId,
                messageId: message._id.toString(),
                url: `/messages.html?thread=${threadId}`,
              },
            });
          }
        }
      }

      logger.debug('Message sent', {
        messageId: message._id,
        threadId,
        senderId: socket.userId,
      });
    } catch (error) {
      logger.error('Message send error', { error: error.message });
      socket.emit('message:error', { error: error.message });
    }
  }

  /**
   * Handle typing start
   */
  handleTypingStart(socket, data) {
    try {
      if (!socket.userId) return;

      const { threadId, recipientId } = data;
      if (!threadId) return;

      // Track typing user
      if (!this.typingUsers.has(threadId)) {
        this.typingUsers.set(threadId, new Set());
      }
      this.typingUsers.get(threadId).add(socket.userId);

      // Broadcast to recipient(s)
      if (recipientId) {
        this.io.to(`user:${recipientId}`).emit('typing:started', {
          threadId,
          userId: socket.userId,
        });
      } else {
        // Broadcast to thread room
        socket.to(`thread:${threadId}`).emit('typing:started', {
          threadId,
          userId: socket.userId,
        });
      }

      logger.debug('Typing started', { threadId, userId: socket.userId });
    } catch (error) {
      logger.error('Typing start error', { error: error.message });
    }
  }

  /**
   * Handle typing stop
   */
  handleTypingStop(socket, data) {
    try {
      if (!socket.userId) return;

      const { threadId, recipientId } = data;
      if (!threadId) return;

      // Remove from typing users
      if (this.typingUsers.has(threadId)) {
        this.typingUsers.get(threadId).delete(socket.userId);
        if (this.typingUsers.get(threadId).size === 0) {
          this.typingUsers.delete(threadId);
        }
      }

      // Broadcast to recipient(s)
      if (recipientId) {
        this.io.to(`user:${recipientId}`).emit('typing:stopped', {
          threadId,
          userId: socket.userId,
        });
      } else {
        // Broadcast to thread room
        socket.to(`thread:${threadId}`).emit('typing:stopped', {
          threadId,
          userId: socket.userId,
        });
      }

      logger.debug('Typing stopped', { threadId, userId: socket.userId });
    } catch (error) {
      logger.error('Typing stop error', { error: error.message });
    }
  }

  /**
   * Handle message read
   */
  async handleMessageRead(socket, data) {
    try {
      if (!socket.userId || !this.messagingService) return;

      const { messageId } = data;
      if (!messageId) return;

      await this.messagingService.markMessageAsRead(messageId, socket.userId);

      // Notify sender about read receipt
      const message = await this.messagingService.getThreadMessages(messageId);
      if (message && message.senderId) {
        this.io.to(`user:${message.senderId}`).emit('message:read', {
          messageId,
          userId: socket.userId,
          readAt: new Date(),
        });
      }

      logger.debug('Message marked as read', { messageId, userId: socket.userId });
    } catch (error) {
      logger.error('Message read error', { error: error.message });
    }
  }

  /**
   * Handle thread read
   */
  async handleThreadRead(socket, data) {
    try {
      if (!socket.userId || !this.messagingService) return;

      const { threadId } = data;
      if (!threadId) return;

      await this.messagingService.markThreadAsRead(threadId, socket.userId);

      logger.debug('Thread marked as read', { threadId, userId: socket.userId });
    } catch (error) {
      logger.error('Thread read error', { error: error.message });
    }
  }

  /**
   * Handle reaction send
   */
  async handleReactionSend(socket, data) {
    try {
      if (!socket.userId || !this.messagingService) return;

      const { messageId, emoji } = data;
      if (!messageId || !emoji) return;

      const message = await this.messagingService.addReaction(messageId, socket.userId, emoji);

      // Broadcast reaction update
      socket.to(`thread:${message.threadId}`).emit('reaction:received', {
        messageId,
        reactions: message.reactions,
      });

      logger.debug('Reaction added', { messageId, userId: socket.userId, emoji });
    } catch (error) {
      logger.error('Reaction send error', { error: error.message });
    }
  }

  /**
   * Handle presence update (heartbeat)
   */
  async handlePresenceUpdate(socket, data) {
    try {
      if (!socket.userId) return;

      await this.presenceService.heartbeat(socket.userId);

      logger.debug('Presence heartbeat', { userId: socket.userId });
    } catch (error) {
      logger.error('Presence update error', { error: error.message });
    }
  }

  /**
   * Handle presence sync request
   */
  async handlePresenceSync(socket, data) {
    try {
      if (!socket.userId) return;

      const { userIds } = data;
      if (!userIds || !Array.isArray(userIds)) return;

      const presence = await this.presenceService.getBulkPresence(userIds);

      socket.emit('presence:synced', { presence });

      logger.debug('Presence synced', { userId: socket.userId, count: userIds.length });
    } catch (error) {
      logger.error('Presence sync error', { error: error.message });
    }
  }

  /**
   * Handle disconnection
   */
  async handleDisconnect(socket) {
    try {
      const userId = socket.userId || this.socketUsers.get(socket.id);

      if (userId) {
        // Remove socket mapping
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
          userSocketSet.delete(socket.id);
          if (userSocketSet.size === 0) {
            this.userSockets.delete(userId);
          }
        }
        this.socketUsers.delete(socket.id);

        // Update presence
        await this.presenceService.setOffline(userId, socket.id);

        // Check if user is still online (other sockets)
        const isStillOnline = this.userSockets.has(userId);
        if (!isStillOnline) {
          this.broadcastPresenceUpdate(userId, 'offline');
        }

        logger.info('User disconnected', { userId, socketId: socket.id });
      } else {
        logger.debug('Socket disconnected', { socketId: socket.id });
      }
    } catch (error) {
      logger.error('Disconnect error', { error: error.message });
    }
  }

  /**
   * Broadcast presence update
   */
  broadcastPresenceUpdate(userId, state) {
    try {
      this.io.emit('presence:changed', {
        userId,
        state,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Broadcast presence error', { error: error.message });
    }
  }

  /**
   * Send notification to specific user
   */
  sendNotification(userId, notification) {
    try {
      this.io.to(`user:${userId}`).emit('notification:received', notification);
      logger.debug('Notification sent via WebSocket', { userId });
    } catch (error) {
      logger.error('Send notification error', { userId, error: error.message });
    }
  }

  /**
   * Send notification to room
   */
  sendRoomNotification(room, notification) {
    try {
      this.io.to(room).emit('notification:received', notification);
    } catch (error) {
      logger.error('Send room notification error', { room, error: error.message });
    }
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event, data) {
    try {
      this.io.emit(event, data);
    } catch (error) {
      logger.error('Broadcast error', { event, error: error.message });
    }
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId) {
    return this.userSockets.has(userId);
  }

  /**
   * Get online users count
   */
  getOnlineUsersCount() {
    return this.userSockets.size;
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      connectedClients: this.io.engine.clientsCount,
      onlineUsers: this.userSockets.size,
      typingUsers: this.typingUsers.size,
      rooms: this.io.sockets.adapter.rooms.size,
    };
  }

  /**
   * Cleanup stale data
   */
  cleanup() {
    try {
      // Clean up typing indicators
      const now = Date.now();
      for (const [threadId, users] of this.typingUsers.entries()) {
        if (users.size === 0) {
          this.typingUsers.delete(threadId);
        }
      }

      logger.debug('WebSocket cleanup completed');
    } catch (error) {
      logger.error('Cleanup error', { error: error.message });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      logger.info('Shutting down WebSocket server...');
      
      // Disconnect all clients
      this.io.disconnectSockets();
      
      // Cleanup presence service
      this.presenceService.destroy();
      
      // Close server
      this.io.close();
      
      logger.info('WebSocket server shut down successfully');
    } catch (error) {
      logger.error('Shutdown error', { error: error.message });
    }
  }
}

module.exports = WebSocketServerV2;
