/**
 * EventFlow WebSocket Server (v1)
 * Real-time notifications and messaging system
 *
 * @deprecated WebSocket Server v1 is deprecated.
 * Use WebSocket Server v2 (websocket-server-v2.js) instead.
 *
 * v1 is maintained for backwards compatibility only.
 * Set WEBSOCKET_MODE=v2 (default) for enhanced features:
 * - Real-time messaging with typing indicators
 * - Read receipts and presence tracking
 * - Emoji reactions
 * - Redis adapter support for clustering
 *
 * v1 will be removed in a future major version.
 * @see websocket-server-v2.js
 * @see REALTIME_MESSAGING.md
 */

'use strict';

const { Server } = require('socket.io');

// Shared symbol for preventing duplicate Socket.IO servers across v1 and v2
// This prevents the "server.handleUpgrade() was called more than once" error
const WS_SERVER_INITIALIZED = Symbol.for('eventflow.wsServerInitialized');

class WebSocketServer {
  constructor(httpServer) {
    // Show deprecation warning
    console.warn('⚠️  DEPRECATION WARNING: WebSocket Server v1 is deprecated');
    console.warn('   Please migrate to v2 by setting WEBSOCKET_MODE=v2');
    console.warn('   v1 will be removed in a future major version');
    console.warn('   See REALTIME_MESSAGING.md for migration guide');

    // Guard against multiple instantiations on the same server (v1 or v2)
    if (httpServer[WS_SERVER_INITIALIZED]) {
      console.warn('⚠️  WebSocket Server already initialized for this HTTP server');
      throw new Error('WebSocket Server already initialized for this HTTP server');
    }

    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.BASE_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      // Explicitly configure allowed transports
      transports: ['websocket', 'polling'],
    });

    // Mark server as having WebSocket initialized (shared guard with v2)
    httpServer[WS_SERVER_INITIALIZED] = true;

    // NOTE: In-memory Map for tracking user sockets
    // This will be cleared on server restart. For production environments
    // with multiple server instances, consider using Redis or another
    // persistent storage solution with Socket.IO Redis adapter
    this.userSockets = new Map(); // userId -> Set of socket IDs
    this.init();
  }

  init() {
    this.io.on('connection', socket => {
      console.log(`WebSocket connected: ${socket.id}`);

      // Handle connection errors
      socket.on('error', error => {
        console.error(`WebSocket error on socket ${socket.id}:`, error.message);
      });

      // Handle user authentication
      socket.on('auth', data => {
        if (data && data.userId) {
          socket.userId = data.userId;

          if (!this.userSockets.has(data.userId)) {
            this.userSockets.set(data.userId, new Set());
          }
          this.userSockets.get(data.userId).add(socket.id);

          socket.join(`user:${data.userId}`);
          socket.emit('auth:success', { userId: data.userId });

          console.log(`User ${data.userId} authenticated on socket ${socket.id}`);
        }
      });

      // Handle joining rooms (for suppliers, events, etc.)
      socket.on('join', room => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
      });

      // Handle leaving rooms
      socket.on('leave', room => {
        socket.leave(room);
        console.log(`Socket ${socket.id} left room: ${room}`);
      });

      // Handle real-time messaging
      socket.on('message:send', data => {
        const { threadId, recipientId, message } = data;

        // Emit to recipient
        this.io.to(`user:${recipientId}`).emit('message:received', {
          threadId,
          message,
          timestamp: new Date().toISOString(),
        });
      });

      // Handle typing indicators
      socket.on('typing:start', data => {
        const { threadId, recipientId } = data;
        this.io.to(`user:${recipientId}`).emit('typing:started', {
          threadId,
          userId: socket.userId,
        });
      });

      socket.on('typing:stop', data => {
        const { threadId, recipientId } = data;
        this.io.to(`user:${recipientId}`).emit('typing:stopped', {
          threadId,
          userId: socket.userId,
        });
      });

      // Handle reaction updates
      socket.on('reaction:updated', data => {
        const { threadId, messageId, reactions } = data;
        // Broadcast to thread room
        socket.to(`thread:${threadId}`).emit('reaction:received', {
          messageId,
          reactions,
        });
      });

      // ===== V3 Messenger Events =====
      
      // Join messenger conversation room
      socket.on('messenger:join', ({ conversationId }) => {
        if (conversationId) {
          socket.join(`messenger:${conversationId}`);
          console.log(`Socket ${socket.id} joined messenger conversation: ${conversationId}`);
        }
      });

      // Leave messenger conversation room
      socket.on('messenger:leave', ({ conversationId }) => {
        if (conversationId) {
          socket.leave(`messenger:${conversationId}`);
          console.log(`Socket ${socket.id} left messenger conversation: ${conversationId}`);
        }
      });

      // Messenger typing indicator
      socket.on('messenger:typing', ({ conversationId, isTyping }) => {
        if (conversationId && socket.userId) {
          socket.to(`messenger:${conversationId}`).emit('messenger:typing', {
            conversationId,
            userId: socket.userId,
            isTyping,
          });
        }
      });

      // Messenger message sent (broadcast to conversation room)
      socket.on('messenger:message', ({ conversationId }) => {
        if (conversationId) {
          socket.to(`messenger:${conversationId}`).emit('messenger:new-message', {
            conversationId,
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        if (socket.userId) {
          const sockets = this.userSockets.get(socket.userId);
          if (sockets) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.userSockets.delete(socket.userId);
            }
          }
        }
        console.log(`WebSocket disconnected: ${socket.id}`);
      });
    });
  }

  // Send notification to specific user
  sendNotification(userId, notification) {
    this.io.to(`user:${userId}`).emit('notification', notification);
  }

  // Send notification to all users in a room
  sendRoomNotification(room, notification) {
    this.io.to(room).emit('notification', notification);
  }

  // Broadcast to all connected clients
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.userSockets.has(userId);
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.userSockets.size;
  }

  /**
   * Emit event to a specific user (all their sockets)
   * @param {string} userId - Target user ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emitToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit event to a room
   * @param {string} room - Room name
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emitToRoom(room, event, data) {
    this.io.to(room).emit(event, data);
  }
}

module.exports = WebSocketServer;
