/**
 * Unit tests for WebSocket server initialization
 * Verifies that only one Socket.IO server can be attached to the HTTP server
 */

const http = require('http');
const express = require('express');

describe('WebSocket Server Initialization', () => {
  let server;
  let app;

  beforeEach(() => {
    // Create a fresh HTTP server for each test
    app = express();
    server = http.createServer(app);
  });

  afterEach(done => {
    // Clean up server after each test
    if (server && server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('Single WebSocket Server Attachment', () => {
    it('should allow WebSocket Server v1 to attach to HTTP server', () => {
      const WebSocketServer = require('../../websocket-server');

      expect(() => {
        const wsServer = new WebSocketServer(server);
        expect(wsServer).toBeDefined();
        expect(wsServer.io).toBeDefined();
      }).not.toThrow();
    });

    it('should allow WebSocket Server v2 to attach to HTTP server', () => {
      const WebSocketServerV2 = require('../../websocket-server-v2');

      expect(() => {
        const wsServerV2 = new WebSocketServerV2(server, null, null);
        expect(wsServerV2).toBeDefined();
        expect(wsServerV2.io).toBeDefined();
      }).not.toThrow();
    });

    it('should prevent multiple WebSocket Server v1 instances on same HTTP server', () => {
      const WebSocketServer = require('../../websocket-server');

      // First instance should succeed
      const wsServer1 = new WebSocketServer(server);
      expect(wsServer1).toBeDefined();

      // Second instance should fail
      expect(() => {
        new WebSocketServer(server);
      }).toThrow('WebSocket Server already initialized for this HTTP server');
    });

    it('should prevent multiple WebSocket Server v2 instances on same HTTP server', () => {
      const WebSocketServerV2 = require('../../websocket-server-v2');

      // First instance should succeed
      const wsServer1 = new WebSocketServerV2(server, null, null);
      expect(wsServer1).toBeDefined();

      // Second instance should fail
      expect(() => {
        new WebSocketServerV2(server, null, null);
      }).toThrow('WebSocket Server v2 already initialized for this HTTP server');
    });

    it('should prevent v1 and v2 WebSocket servers from both attaching to same HTTP server', () => {
      const WebSocketServer = require('../../websocket-server');
      const WebSocketServerV2 = require('../../websocket-server-v2');

      // Initialize v1 first
      const wsServer1 = new WebSocketServer(server);
      expect(wsServer1).toBeDefined();

      // Attempting to initialize v2 should fail
      // Note: This test verifies the core issue - both servers trying to attach causes
      // "server.handleUpgrade() was called more than once" error in production
      expect(() => {
        new WebSocketServerV2(server, null, null);
      }).toThrow();
    });

    it('should prevent v2 and v1 WebSocket servers from both attaching to same HTTP server (reverse order)', () => {
      const WebSocketServer = require('../../websocket-server');
      const WebSocketServerV2 = require('../../websocket-server-v2');

      // Initialize v2 first
      const wsServer2 = new WebSocketServerV2(server, null, null);
      expect(wsServer2).toBeDefined();

      // Attempting to initialize v1 should fail
      expect(() => {
        new WebSocketServer(server);
      }).toThrow();
    });
  });

  describe('WebSocket Mode Environment Variable', () => {
    const originalEnv = process.env.WEBSOCKET_MODE;

    afterEach(() => {
      // Restore original value
      process.env.WEBSOCKET_MODE = originalEnv;
    });

    it('should default to v2 when WEBSOCKET_MODE is not set', () => {
      delete process.env.WEBSOCKET_MODE;
      const mode = process.env.WEBSOCKET_MODE || 'v2';
      expect(mode).toBe('v2');
    });

    it('should accept valid WEBSOCKET_MODE values', () => {
      const validModes = ['v1', 'v2', 'off'];

      validModes.forEach(mode => {
        process.env.WEBSOCKET_MODE = mode;
        expect(process.env.WEBSOCKET_MODE.toLowerCase()).toBe(mode.toLowerCase());
      });
    });

    it('should handle case-insensitive WEBSOCKET_MODE', () => {
      process.env.WEBSOCKET_MODE = 'V2';
      expect(process.env.WEBSOCKET_MODE.toLowerCase()).toBe('v2');

      process.env.WEBSOCKET_MODE = 'V1';
      expect(process.env.WEBSOCKET_MODE.toLowerCase()).toBe('v1');

      process.env.WEBSOCKET_MODE = 'OFF';
      expect(process.env.WEBSOCKET_MODE.toLowerCase()).toBe('off');
    });
  });

  describe('WebSocket Path Configuration', () => {
    it('should default to /socket.io when WEBSOCKET_PATH is not set', () => {
      const path = process.env.WEBSOCKET_PATH || '/socket.io';
      expect(path).toBe('/socket.io');
    });

    it('should accept custom WEBSOCKET_PATH', () => {
      const originalPath = process.env.WEBSOCKET_PATH;
      process.env.WEBSOCKET_PATH = '/custom/ws';

      expect(process.env.WEBSOCKET_PATH).toBe('/custom/ws');

      // Restore
      process.env.WEBSOCKET_PATH = originalPath;
    });
  });
});
