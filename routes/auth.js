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
const { csrfProtection } = require('../middleware/csrf');
const { featureRequired, getFeatureFlags } = require('../middleware/features');
const postmark = require('../utils/postmark');
const tokenUtils = require('../utils/token');
const { validateToken } = require('../middleware/token');

const router = express.Router();

const JWT_SECRET = String(process.env.JWT_SECRET || 'change_me');

// This will be set by the main server.js when mounting these routes (legacy compatibility)
// eslint-disable-next-line no-unused-vars
let _sendMailFn = null;

/**
 * Set the sendMail function (injected from server.js) - legacy compatibility
 * @param {Function} fn - The sendMail function
 */
function setSendMailFunction(fn) {
  _sendMailFn = fn;
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
router.post(
  '/register',
  async (req, res, next) => {
    // Check supplier application feature flag if registering as supplier
    if (req.body.role === 'supplier') {
      const features = await getFeatureFlags();
      if (!features.supplierApplications) {
        return res.status(503).json({
          error: 'Feature temporarily unavailable',
          message: 'Supplier applications are currently disabled. Please try again later.',
          feature: 'supplierApplications',
        });
      }
    }
    // Check registration feature flag for all registrations
    next();
  },
  featureRequired('registration'),
  authLimiter,
  async (req, res) => {
    const {
      firstName,
      lastName,
      name,
      email,
      password,
      role,
      location,
      postcode,
      company,
      jobTitle,
      website,
      socials,
    } = req.body || {};

    // Support both new (firstName/lastName) and legacy (name) formats
    const userFirstName = firstName || '';
    const userLastName = lastName || '';
    const userFullName =
      firstName && lastName ? `${firstName.trim()} ${lastName.trim()}`.trim() : (name || '').trim();

    // Required fields validation
    if (!userFullName || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields (name or firstName/lastName, email, and password required)',
      });
    }
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }
    if (!validator.isEmail(String(email))) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (!passwordOk(password)) {
      return res.status(400).json({ error: 'Weak password' });
    }

    const roleFinal = role === 'supplier' || role === 'customer' ? role : 'customer';

    // Role-specific required field validation
    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }
    if (roleFinal === 'supplier' && !company) {
      return res.status(400).json({ error: 'Company name is required for suppliers' });
    }

    const users = read('users');
    if (users.find(u => u.email.toLowerCase() === String(email).toLowerCase())) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Sanitize and validate optional URLs
    const sanitizeUrl = url => {
      if (!url) {
        return undefined;
      }
      const trimmed = String(url).trim();
      if (!trimmed) {
        return undefined;
      }
      // Basic URL validation
      if (!validator.isURL(trimmed, { require_protocol: false })) {
        return undefined;
      }
      return trimmed;
    };

    // Parse socials object
    const socialsParsed = socials
      ? {
          instagram: sanitizeUrl(socials.instagram),
          facebook: sanitizeUrl(socials.facebook),
          twitter: sanitizeUrl(socials.twitter),
          linkedin: sanitizeUrl(socials.linkedin),
        }
      : {};

    // Determine founder badge eligibility
    const founderLaunchTs = process.env.FOUNDER_LAUNCH_TS || '2026-01-01T00:00:00Z';
    const founderLaunchDate = new Date(founderLaunchTs);
    const founderEndDate = new Date(founderLaunchDate);
    founderEndDate.setMonth(founderEndDate.getMonth() + 6); // 6 months from launch

    const now = new Date();
    const badges = [];
    if (now <= founderEndDate) {
      badges.push('founder');
      console.log(`🏆 Founder badge awarded to ${email} (registered within 6 months of launch)`);
    }

    // Create user object first (needed for JWT token generation)
    const user = {
      id: uid('usr'),
      name: String(userFullName).slice(0, 80),
      firstName: String(userFirstName).trim().slice(0, 40),
      lastName: String(userLastName).trim().slice(0, 40),
      email: String(email).toLowerCase(),
      role: roleFinal,
      passwordHash: bcrypt.hashSync(password, 10),
      location: String(location).trim().slice(0, 100),
      postcode: postcode ? String(postcode).trim().slice(0, 10) : undefined,
      company: company ? String(company).trim().slice(0, 100) : undefined,
      jobTitle: jobTitle ? String(jobTitle).trim().slice(0, 100) : undefined,
      website: sanitizeUrl(website),
      socials: socialsParsed,
      badges,
      notify: true, // Deprecated, kept for backward compatibility
      notify_account: true, // Transactional emails enabled by default
      notify_marketing: !!(req.body && req.body.marketingOptIn), // Marketing emails opt-in
      marketingOptIn: !!(req.body && req.body.marketingOptIn), // Deprecated, kept for backward compatibility
      verified: false,
      createdAt: new Date().toISOString(),
    };

    // Generate JWT verification token
    const verificationToken = tokenUtils.generateVerificationToken(user, {
      expiresInHours: 24,
    });

    // Store token info for legacy compatibility
    user.verificationToken = verificationToken;
    user.verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Send verification email via Postmark BEFORE saving user
    // This ensures we only create accounts when email can be sent
    try {
      console.log(`📧 Attempting to send verification email to ${user.email}`);
      await postmark.sendVerificationEmail(user, verificationToken);
      console.log(`✅ Verification email sent successfully to ${user.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send verification email:', emailError.message);

      // If email sending fails, don't create the user account
      // This prevents orphaned unverified accounts
      return res.status(500).json({
        error: 'Failed to send verification email. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? emailError.message : undefined,
      });
    }

    // Only save user after email is successfully sent
    users.push(user);
    write('users', users);

    // Update last login timestamp (non-blocking)
    updateLastLogin(user.id);

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: '7d',
    });
    // Default to remember=true for registration to provide better UX
    setAuthCookie(res, token, { remember: true });

    res.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  }
);

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/login', authLimiter, (req, res) => {
  const { email, password, remember } = req.body || {};
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

  // Set cookie with remember option: if remember is true, persist for 7 days; otherwise session-only
  setAuthCookie(res, token, { remember: !!remember });

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

  // Send password reset email via Postmark BEFORE saving token
  // This ensures we only generate tokens when email can be sent
  try {
    console.log(`📧 Attempting to send password reset email to ${user.email}`);
    await postmark.sendPasswordResetEmail(user, token);
    console.log(`✅ Password reset email sent successfully to ${user.email}`);
  } catch (emailError) {
    console.error('❌ Failed to send password reset email:', emailError.message);

    // Still return success to prevent email enumeration
    // But log the error for debugging
    return res.json({
      ok: true,
      // Don't expose error to client for security
    });
  }

  // Only save reset token after email is successfully sent
  users[idx].resetToken = token;
  users[idx].resetTokenExpiresAt = expires;
  write('users', users);

  res.json({ ok: true });
});

/**
 * GET /api/auth/verify
 * Verify email address with token (supports both JWT and legacy tokens)
 * This endpoint maintains backward compatibility
 */
router.get('/verify', async (req, res) => {
  const { token } = req.query || {};
  console.log(
    `📧 Verification request received with token: ${token ? `${token.substring(0, 10)}...` : 'NONE'}`
  );

  if (!token) {
    console.error('❌ Verification failed: Missing token');
    return res.status(400).json({ error: 'Missing token' });
  }

  // Check if it's a JWT token
  const isJWT = tokenUtils.isJWTToken(token);
  console.log(`   Token type: ${isJWT ? 'JWT' : 'Legacy'}`);

  if (isJWT) {
    // Validate JWT token
    const validation = tokenUtils.validateVerificationToken(token, {
      allowGracePeriod: true,
      expectedType: tokenUtils.TOKEN_TYPES.EMAIL_VERIFICATION,
    });

    if (!validation.valid) {
      console.error(`❌ JWT validation failed: ${validation.error}`);
      return res.status(400).json({
        error: validation.message,
        code: validation.error,
        canResend: validation.canResend,
      });
    }

    // Find user by email from JWT
    const users = read('users');
    const idx = users.findIndex(u => u.email.toLowerCase() === validation.email.toLowerCase());

    if (idx === -1) {
      console.error(`❌ User not found for email: ${validation.email}`);
      return res.status(400).json({ error: 'Invalid verification token - user not found' });
    }

    const user = users[idx];

    // Check if already verified
    if (user.verified === true) {
      console.log(`ℹ️ User already verified: ${user.email}`);
      return res.json({
        ok: true,
        message: 'Email already verified',
        alreadyVerified: true,
      });
    }

    // Mark user as verified and clear token
    users[idx].verified = true;
    delete users[idx].verificationToken;
    delete users[idx].verificationTokenExpiresAt;
    write('users', users);
    console.log(`✅ User verified successfully via JWT: ${user.email}`);

    // Send welcome email (non-blocking)
    (async () => {
      try {
        console.log(`📧 Sending welcome email to newly verified user: ${user.email}`);
        await postmark.sendWelcomeEmail(user);
        console.log(`✅ Welcome email sent to ${user.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send welcome email:', emailError.message);
      }
    })();

    return res.json({
      ok: true,
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  }

  // Handle legacy tokens
  console.log('⚠️ Processing legacy verification token');
  const users = read('users');
  const idx = users.findIndex(u => u.verificationToken === token);

  if (idx === -1) {
    console.error(`❌ Verification failed: Invalid token - ${token.substring(0, 10)}...`);
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  const user = users[idx];
  console.log(`📧 Found user for verification: ${user.email}`);

  // Check if token has expired
  if (user.verificationTokenExpiresAt) {
    const expiresAt = new Date(user.verificationTokenExpiresAt);
    if (expiresAt < new Date()) {
      console.error(`❌ Verification failed: Token expired for ${user.email}`);
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
  console.log(`✅ User verified successfully: ${user.email}`);

  // Send welcome email after successful verification (non-blocking)
  (async () => {
    try {
      console.log(`📧 Sending welcome email to newly verified user: ${user.email}`);
      await postmark.sendWelcomeEmail(user);
      console.log(`✅ Welcome email sent to ${user.email}`);
    } catch (emailError) {
      // Don't fail verification if welcome email fails - just log it
      console.error('❌ Failed to send welcome email:', emailError.message);
    }
  })();

  res.json({ ok: true, message: 'Email verified successfully' });
});

/**
 * POST /api/auth/verify-email
 * New unified verification endpoint with enhanced error handling
 * Supports both query params and body, with comprehensive logging
 */
router.post('/verify-email', authLimiter, validateToken({ required: true }), async (req, res) => {
  console.log('📧 POST /api/auth/verify-email called');
  console.log(`   Token validation:`, req.tokenValidation);

  const validation = req.tokenValidation;

  // Handle JWT tokens
  if (validation.isJWT && validation.valid) {
    const users = read('users');
    const idx = users.findIndex(u => u.email.toLowerCase() === validation.email.toLowerCase());

    if (idx === -1) {
      console.error(`❌ User not found for email: ${validation.email}`);
      return res.status(400).json({
        ok: false,
        error: 'Invalid verification token - user not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const user = users[idx];

    // Check if already verified
    if (user.verified === true) {
      console.log(`ℹ️ User already verified: ${user.email}`);
      return res.json({
        ok: true,
        message: 'Your email address is already verified',
        alreadyVerified: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    }

    // Mark user as verified
    users[idx].verified = true;
    delete users[idx].verificationToken;
    delete users[idx].verificationTokenExpiresAt;
    write('users', users);

    console.log(`✅ User verified successfully via POST: ${user.email}`);

    // Send welcome email (non-blocking)
    (async () => {
      try {
        await postmark.sendWelcomeEmail(user);
        console.log(`✅ Welcome email sent to ${user.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send welcome email:', emailError.message);
      }
    })();

    return res.json({
      ok: true,
      message: 'Your email has been verified successfully! You can now log in.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      withinGracePeriod: validation.withinGracePeriod,
    });
  }

  // Handle legacy tokens
  if (!validation.isJWT && validation.legacyToken) {
    console.log('⚠️ Processing legacy token via POST endpoint');

    const users = read('users');
    const idx = users.findIndex(u => u.verificationToken === validation.legacyToken);

    if (idx === -1) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN',
        canResend: true,
      });
    }

    const user = users[idx];

    // Check expiration
    if (user.verificationTokenExpiresAt) {
      const expiresAt = new Date(user.verificationTokenExpiresAt);
      if (expiresAt < new Date()) {
        return res.status(400).json({
          ok: false,
          error: 'Verification token has expired. Please request a new one.',
          code: 'TOKEN_EXPIRED',
          canResend: true,
        });
      }
    }

    // Verify user
    users[idx].verified = true;
    delete users[idx].verificationToken;
    delete users[idx].verificationTokenExpiresAt;
    write('users', users);

    console.log(`✅ User verified via legacy token: ${user.email}`);

    // Send welcome email (non-blocking)
    (async () => {
      try {
        await postmark.sendWelcomeEmail(user);
      } catch (err) {
        console.error('Failed to send welcome email:', err.message);
      }
    })();

    return res.json({
      ok: true,
      message: 'Your email has been verified successfully! You can now log in.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  }

  // Should never reach here due to middleware
  return res.status(400).json({
    ok: false,
    error: 'Invalid token validation state',
    code: 'VALIDATION_ERROR',
  });
});

/**
 * POST /api/auth/reset-password
 * Complete password reset with token
 */
router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = req.body || {};

  if (!token || !password) {
    return res.status(400).json({ error: 'Missing token or password' });
  }

  // Validate password strength
  if (!passwordOk(password)) {
    return res
      .status(400)
      .json({ error: 'Password must be at least 8 characters with a letter and number' });
  }

  const users = read('users');
  const idx = users.findIndex(u => u.resetToken === token);

  if (idx === -1) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const user = users[idx];

  // Check if token has expired
  if (user.resetTokenExpiresAt) {
    const expiresAt = new Date(user.resetTokenExpiresAt);
    if (expiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }
  }

  // Update password and clear reset token
  users[idx].passwordHash = bcrypt.hashSync(password, 10);
  users[idx].passwordResetRequired = false;
  delete users[idx].resetToken;
  delete users[idx].resetTokenExpiresAt;
  write('users', users);

  console.log(`✅ Password reset successful for ${user.email}`);

  res.json({ ok: true, message: 'Password reset successful' });
});

/**
 * POST /api/auth/logout
 * Log out current user
 */
router.post('/logout', authLimiter, csrfProtection, (_req, res) => {
  // Set cache control headers to prevent caching of logout response
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');

  clearAuthCookie(res);
  res.json({ ok: true });
});

/**
 * GET /api/auth/logout
 * Log out current user and redirect to home page
 */
router.get('/logout', authLimiter, (_req, res) => {
  // Set cache control headers to prevent caching of logout response
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');

  clearAuthCookie(res);
  res.redirect('/');
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', (req, res) => {
  // Set cache control headers to prevent caching of auth state
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie');

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
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          role: u.role,
          location: u.location,
          postcode: u.postcode,
          company: u.company,
          jobTitle: u.jobTitle,
          website: u.website,
          socials: u.socials || {},
          avatarUrl: u.avatarUrl,
          badges: u.badges || [],
          isPro: u.isPro || false,
          proExpiresAt: u.proExpiresAt || null,
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
    if (!postmark.verifyUnsubscribeToken(email, token)) {
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

/**
 * POST /api/auth/resend-verification
 * Resend verification email to user
 * Can be called by the user themselves or by an admin
 */
router.post('/resend-verification', authLimiter, async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'Missing email address' });
  }

  if (!validator.isEmail(String(email))) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Look up user by email (case-insensitive)
  const users = read('users');
  const idx = users.findIndex(u => (u.email || '').toLowerCase() === String(email).toLowerCase());

  if (idx === -1) {
    // Don't reveal if email exists - return success anyway for security
    return res.json({
      ok: true,
      message:
        'If this email is registered and unverified, a new verification email has been sent.',
    });
  }

  const user = users[idx];

  // Check if user is already verified
  if (user.verified === true) {
    return res.json({
      ok: true,
      message: 'This email address is already verified.',
    });
  }

  // Generate new JWT verification token
  const verificationToken = tokenUtils.generateVerificationToken(user, {
    expiresInHours: 24,
  });

  // Store token info
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  // Send verification email via Postmark BEFORE saving token
  try {
    console.log(`📧 Resending verification email to ${user.email}`);
    await postmark.sendVerificationEmail(user, verificationToken);
    console.log(`✅ Verification email resent successfully to ${user.email}`);
  } catch (emailError) {
    console.error('❌ Failed to resend verification email:', emailError.message);

    // Return generic success to prevent email enumeration
    return res.json({
      ok: true,
      message:
        'If this email is registered and unverified, a new verification email has been sent.',
    });
  }

  // Only update token after email is successfully sent
  users[idx].verificationToken = verificationToken;
  users[idx].verificationTokenExpiresAt = tokenExpiresAt;
  write('users', users);

  res.json({
    ok: true,
    message: 'A new verification email has been sent. Please check your inbox.',
  });
});

/**
 * PUT /api/auth/profile
 * Update current user's profile information
 */
router.put('/profile', authRequired, async (req, res) => {
  const {
    name,
    firstName,
    lastName,
    email,
    phone,
    location,
    postcode,
    company,
    jobTitle,
    website,
  } = req.body;

  const users = read('users');
  const idx = users.findIndex(u => u.id === req.user.id);

  if (idx === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[idx];

  // Check if email is being changed and if it's already taken
  if (email && email !== user.email) {
    const emailExists = users.some(u => u.email === email && u.id !== user.id);
    if (emailExists) {
      return res.status(400).json({ error: 'Email address is already in use' });
    }

    // Email changed - mark as unverified and send new verification email
    user.email = email;
    user.verified = false;
    user.verificationToken = tokenUtils.generateVerificationToken(user, { expiresInHours: 24 });
    user.verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Send verification email asynchronously
    postmark.sendVerificationEmail(user, user.verificationToken).catch(err => {
      console.error('Failed to send verification email:', err);
    });
  }

  // Update allowed fields
  if (name !== undefined) {
    user.name = name;
  }
  if (firstName !== undefined) {
    user.firstName = firstName;
  }
  if (lastName !== undefined) {
    user.lastName = lastName;
  }
  if (phone !== undefined) {
    user.phone = phone;
  }
  if (location !== undefined) {
    user.location = location;
  }
  if (postcode !== undefined) {
    user.postcode = postcode;
  }
  if (company !== undefined) {
    user.company = company;
  }
  if (jobTitle !== undefined) {
    user.jobTitle = jobTitle;
  }
  if (website !== undefined) {
    user.website = website;
  }

  user.updatedAt = new Date().toISOString();

  users[idx] = user;
  write('users', users);

  // Return updated user info
  res.json({
    ok: true,
    message:
      email && email !== req.user.email
        ? 'Profile updated. Please check your new email address to verify it.'
        : 'Profile updated successfully',
    user: {
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      location: user.location,
      postcode: user.postcode,
      company: user.company,
      jobTitle: user.jobTitle,
      website: user.website,
      avatarUrl: user.avatarUrl,
      verified: user.verified,
    },
  });
});

module.exports = router;
module.exports.setSendMailFunction = setSendMailFunction;
