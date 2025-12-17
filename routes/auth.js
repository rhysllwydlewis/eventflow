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
const {
  authRequired,
  setAuthCookie,
  clearAuthCookie,
  getUserFromCookie,
} = require('../middleware/auth');
const { passwordOk } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimit');
const mailgun = require('../utils/mailgun');

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
 * Helper function to update user's last login timestamp
 * @param {string} userId - User ID
 */
function updateLastLogin(userId) {
  try {
    const allUsers = read('users');
    const idx = allUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      allUsers[idx].lastLoginAt = new Date().toISOString();
      write('users', allUsers);
    }
  } catch (e) {
    console.error('Failed to update lastLoginAt', e);
  }
}

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', authLimiter, (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (!validator.isEmail(String(email))) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (!passwordOk(password)) {
    return res.status(400).json({ error: 'Weak password' });
  }
  const roleFinal = role === 'supplier' || role === 'customer' ? role : 'customer';

  const users = read('users');
  if (users.find(u => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  // Generate verification token with 24-hour expiration
  const verificationToken = uid('verify');
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  const user = {
    id: uid('usr'),
    name: String(name).trim().slice(0, 80),
    email: String(email).toLowerCase(),
    role: roleFinal,
    passwordHash: bcrypt.hashSync(password, 10),
    notify: true, // Deprecated, kept for backward compatibility
    notify_account: true, // Transactional emails enabled by default
    notify_marketing: !!(req.body && req.body.marketingOptIn), // Marketing emails opt-in
    marketingOptIn: !!(req.body && req.body.marketingOptIn), // Deprecated, kept for backward compatibility
    verified: false,
    verificationToken: verificationToken,
    verificationTokenExpiresAt: tokenExpiresAt,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  write('users', users);

  // Send verification email via Mailgun
  (async () => {
    try {
      await mailgun.sendVerificationEmail(user, verificationToken);
    } catch (e) {
      console.error('Failed to send verification email via Mailgun', e);
      // Fallback to legacy sendMail if available
      if (sendMailFn) {
        try {
          const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
          const verifyUrl = `${baseUrl}/verify.html?token=${encodeURIComponent(verificationToken)}`;
          sendMailFn({
            to: user.email,
            subject: 'Confirm your EventFlow account',
            text: `Hi ${user.name || ''},

Please confirm your EventFlow account by visiting:

${verifyUrl}

If you did not create this account, you can ignore this email.`,
          });
        } catch (fallbackErr) {
          console.error('Failed to send verification email via fallback', fallbackErr);
        }
      }
    }
  })();

  // Update last login timestamp (non-blocking)
  updateLastLogin(user.id);

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
  setAuthCookie(res, token);

  res.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const user = read('users').find(
    u => (u.email || '').toLowerCase() === String(email).toLowerCase()
  );
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.verified === false) {
    return res.status(403).json({ error: 'Please verify your email address before signing in.' });
  }

  // Update last login timestamp (non-blocking)
  updateLastLogin(user.id);

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
  setAuthCookie(res, token);

  res.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

/**
 * POST /api/auth/forgot
 * Request password reset token
 */
router.post('/forgot', authLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  // Look up user by email (case-insensitive)
  const users = read('users');
  const idx = users.findIndex(u => (u.email || '').toLowerCase() === String(email).toLowerCase());

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
        await sendMailFn({
          to: user.email,
          subject: 'Reset your EventFlow password',
          text:
            `A password reset was requested for this address. ` +
            `For this demo build, your reset token is: ${token}`,
        });
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
  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  const users = read('users');
  const idx = users.findIndex(u => u.verificationToken === token);

  if (idx === -1) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  const user = users[idx];

  // Check if token has expired
  if (user.verificationTokenExpiresAt) {
    const expiresAt = new Date(user.verificationTokenExpiresAt);
    if (expiresAt < new Date()) {
      return res
        .status(400)
        .json({ error: 'Verification token has expired. Please request a new one.' });
    }
  }

  // Mark user as verified and clear token
  users[idx].verified = true;
  delete users[idx].verificationToken;
  delete users[idx].verificationTokenExpiresAt;
  write('users', users);

  res.json({ ok: true, message: 'Email verified successfully' });
});

/**
 * POST /api/auth/logout
 * Log out current user
 */
router.post('/logout', authLimiter, (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', (req, res) => {
  const p = getUserFromCookie(req);
  if (!p) {
    return res.json({ user: null });
  }
  const u = read('users').find(x => x.id === p.id);
  res.json({
    user: u
      ? {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          notify: u.notify !== false,
          notify_account: u.notify_account !== false,
          notify_marketing: u.notify_marketing === true,
        }
      : null,
  });
});

/**
 * PUT /api/auth/preferences
 * Update user notification preferences
 */
router.put('/preferences', authRequired, (req, res) => {
  const { notify_account, notify_marketing } = req.body || {};

  const users = read('users');
  const idx = users.findIndex(u => u.id === req.user.id);

  if (idx === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update preferences if provided
  if (typeof notify_account === 'boolean') {
    users[idx].notify_account = notify_account;
    users[idx].notify = notify_account; // Update deprecated field for backward compatibility
  }

  if (typeof notify_marketing === 'boolean') {
    users[idx].notify_marketing = notify_marketing;
    users[idx].marketingOptIn = notify_marketing; // Update deprecated field for backward compatibility
  }

  write('users', users);

  res.json({
    ok: true,
    preferences: {
      notify_account: users[idx].notify_account !== false,
      notify_marketing: users[idx].notify_marketing === true,
    },
  });
});

/**
 * GET /api/auth/unsubscribe
 * Unsubscribe user from marketing emails
 * Requires email and secure token for verification
 */
router.get('/unsubscribe', (req, res) => {
  const { email, token } = req.query || {};

  if (!email || !token) {
    return res.status(400).json({ error: 'Missing email or token parameter' });
  }

  // Verify the token matches the email
  try {
    if (!mailgun.verifyUnsubscribeToken(email, token)) {
      return res.status(400).json({ error: 'Invalid unsubscribe token' });
    }
  } catch (err) {
    // Handle token verification errors (e.g., token length mismatch)
    return res.status(400).json({ error: 'Invalid unsubscribe token' });
  }

  const users = read('users');
  const idx = users.findIndex(u => u.email.toLowerCase() === String(email).toLowerCase());

  if (idx === -1) {
    // Don't reveal if email exists - return success anyway
    return res.json({
      ok: true,
      message: 'If this email is registered, marketing emails have been disabled.',
    });
  }

  // Disable marketing emails
  users[idx].notify_marketing = false;
  users[idx].marketingOptIn = false; // Update deprecated field
  write('users', users);

  res.json({
    ok: true,
    message:
      'You have been unsubscribed from marketing emails. You will still receive important account notifications.',
  });
});

module.exports = router;
module.exports.setSendMailFunction = setSendMailFunction;
