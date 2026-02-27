/**
 * WebSocket Authentication Utilities
 * Shared helpers for both v1 and v2 WebSocket servers
 */

'use strict';

const jwt = require('jsonwebtoken');
const cookie = require('cookie');

/**
 * Extract and verify the authenticated user ID from an HTTP cookie header.
 * Used by the Socket.IO handshake middleware to pre-authenticate connections
 * using the application's standard HTTP-only JWT `token` cookie.
 *
 * Falls back through multiple claim fields because:
 *   - `id`     — standard field used by this application (see routes/auth.js jwt.sign calls)
 *   - `userId` — legacy field name used in some older tokens
 *   - `sub`    — RFC 7519 standard "subject" claim, for forward compatibility
 *
 * @param {string} cookieHeader - Raw Cookie header from socket.handshake.headers.cookie
 * @returns {string|null} Verified user ID, or null if absent or invalid
 */
function userIdFromCookie(cookieHeader) {
  try {
    if (!cookieHeader) {
      return null;
    }
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return null;
    }
    const cookies = cookie.parse(cookieHeader);
    const token = cookies.token;
    if (!token) {
      return null;
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.id || decoded.userId || decoded.sub || null;
  } catch (_) {
    return null;
  }
}

module.exports = { userIdFromCookie };
