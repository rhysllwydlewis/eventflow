/**
 * EventFlow WebSocket Server
 * Real-time notifications and messaging system
 */

'use strict';

const { Server } = require('socket.io');

class WebSocketServer {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.BASE_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.userSockets = new Map(); // userId -> Set of socket IDs
    this.init();
  }

  init() {
    this.io.on('connection', (socket) => {
      console.log(`WebSocket connected: ${socket.id}`);

      // Handle user authentication
      socket.on('auth', (data) => {
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
      socket.on('join', (room) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
      });

      // Handle leaving rooms
      socket.on('leave', (room) => {
        socket.leave(room);
        console.log(`Socket ${socket.id} left room: ${room}`);
      });

      // Handle real-time messaging
      socket.on('message:send', (data) => {
        const { threadId, recipientId, message } = data;
        
        // Emit to recipient
        this.io.to(`user:${recipientId}`).emit('message:received', {
          threadId,
          message,
          timestamp: new Date().toISOString()
        });
      });

      // Handle typing indicators
      socket.on('typing:start', (data) => {
        const { threadId, recipientId } = data;
        this.io.to(`user:${recipientId}`).emit('typing:started', {
          threadId,
          userId: socket.userId
        });
      });

      socket.on('typing:stop', (data) => {
        const { threadId, recipientId } = data;
        this.io.to(`user:${recipientId}`).emit('typing:stopped', {
          threadId,
          userId: socket.userId
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
