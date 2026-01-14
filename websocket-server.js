/**
 * EventFlow WebSocket Server
 * Real-time notifications and messaging system
 */

'use strict';

const { Server } = require('socket.io');

// Use Symbol for private flag to avoid naming conflicts
const WS_SERVER_INITIALIZED = Symbol('wsServerInitialized');

class WebSocketServer {
  constructor(httpServer) {
    // Guard against multiple instantiations on the same server
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

    // Mark server as having WebSocket initialized
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
}

module.exports = WebSocketServer;
