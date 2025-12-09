/**
 * Authentication Routes
 * Handles user registration, login, logout, password reset, and verification
 */

'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');

const { read, write, uid } = require('../store');
const { authRequired, roleRequired, setAuthCookie, clearAuthCookie, getUserFromCookie } = require('../middleware/auth');
const { passwordOk } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const JWT_SECRET = String(process.env.JWT_SECRET || 'change_me');
const PORT = Number(process.env.PORT || 3000);

// This will be set by the main server.js when mounting these routes
let sendMailFn = null;

/**
 * Set the sendMail function (injected from server.js)
 * @param {Function} fn - The sendMail function
 */
function setSendMailFunction(fn) {
  sendMailFn = fn;
}

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', authLimiter, (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (!validator.isEmail(String(email))) return res.status(400).json({ error: 'Invalid email' });
  if (!passwordOk(password)) return res.status(400).json({ error: 'Weak password' });
  const roleFinal = (role === 'supplier' || role === 'customer') ? role : 'customer';

  const users = read('users');
  if (users.find(u => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const user = {
    id: uid('usr'),
    name: String(name).trim().slice(0, 80),
    email: String(email).toLowerCase(),
    role: roleFinal,
    passwordHash: bcrypt.hashSync(password, 10),
    notify: true,
    marketingOptIn: !!(req.body && req.body.marketingOptIn),
    verified: false,
    verificationToken: uid('verify'),
    createdAt: new Date().toISOString()
  };
  users.push(user);
  write('users', users);

  // Send verification email (dev mode writes .eml files to /outbox)
  try {
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const verifyUrl = `${baseUrl}/verify.html?token=${encodeURIComponent(user.verificationToken)}`;
    if (sendMailFn) {
      sendMailFn({
        to: user.email,
        subject: 'Confirm your EventFlow account',
        text: `Hi ${user.name || ''},

Please confirm your EventFlow account by visiting:

${verifyUrl}

If you did not create this account, you can ignore this email.`,
      });
    }
  } catch (e) {
    console.error('Failed to send verification email', e);
  }

  // Update last login timestamp (non-blocking)
  try {
    const allUsers = read('users');
    const idx = allUsers.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      allUsers[idx].lastLoginAt = new Date().toISOString();
      write('users', allUsers);
    }
  } catch (e) {
    console.error('Failed to update lastLoginAt', e);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  setAuthCookie(res, token);

  res.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const user = read('users').find(
    u => (u.email || '').toLowerCase() === String(email).toLowerCase()
  );
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.verified === false) {
    return res.status(403).json({ error: 'Please verify your email address before signing in.' });
  }

  // Update last login timestamp (non-blocking)
  try {
    const allUsers = read('users');
    const idx = allUsers.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      allUsers[idx].lastLoginAt = new Date().toISOString();
      write('users', allUsers);
    }
  } catch (e) {
    console.error('Failed to update lastLoginAt', e);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  setAuthCookie(res, token);

  res.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

/**
 * POST /api/auth/forgot
 * Request password reset token
 */
router.post('/forgot', authLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Missing email' });

  // Look up user by email (case-insensitive)
  const users = read('users');
  const idx = users.findIndex(
    u => (u.email || '').toLowerCase() === String(email).toLowerCase()
  );

  if (idx === -1) {
    // Always respond success so we don't leak which emails exist
    return res.json({ ok: true });
  }

  const user = users[idx];
  const token = uid('reset');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  user.resetToken = token;
  user.resetTokenExpiresAt = expires;
  write('users', users);

  // Fire-and-forget email (demo only — in dev this usually logs to console)
  (async () => {
    try {
      if (user.email && sendMailFn) {
        await sendMailFn(
          user.email,
          'Reset your EventFlow password',
          'A password reset was requested for this address. ' +
          'For this demo build, your reset token is: ' + token
        );
      }
    } catch (err) {
      console.error('Failed to send reset email', err);
    }
  })();

  res.json({ ok: true });
});

/**
 * GET /api/auth/verify
 * Verify email address with token
 */
router.get('/verify', (req, res) => {
  const { token } = req.query || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });
  const users = read('users');
  const idx = users.findIndex(u => u.verificationToken === token);
  if (idx === -1) return res.status(400).json({ error: 'Invalid or expired token' });
  users[idx].verified = true;
  delete users[idx].verificationToken;
  write('users', users);
  res.json({ ok: true });
});

/**
 * POST /api/auth/logout
 * Log out current user
 */
router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', (req, res) => {
  const p = getUserFromCookie(req);
  if (!p) return res.json({ user: null });
  const u = read('users').find(x => x.id === p.id);
  res.json({
    user: u
      ? { id: u.id, name: u.name, email: u.email, role: u.role, notify: u.notify !== false }
      : null
  });
});

module.exports = router;
module.exports.setSendMailFunction = setSendMailFunction;
