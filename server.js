/* EventFlow v3.3.1 — Refactored server.js (modular architecture)
 * Features: Auth (JWT cookie), Suppliers, Packages, Plans/Notes, Threads/Messages,
 * Admin approvals + metrics, Settings, Featured packages, Sitemap.
 * Email: safe dev mode by default (writes .eml files to /outbox).
 *
 * REFACTORED ARCHITECTURE:
 * - Configuration extracted to config/ folder
 * - Middleware extracted to middleware/ folder
 * - Services extracted to services/ folder
 * - Utilities extracted to utils/ folder
 * - Winston logger for structured logging
 * - Maintains 100% backward compatibility
 */

'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const PDFDocument = require('pdfkit');

const APP_VERSION = 'v17.0.0';

require('dotenv').config();

// Configuration modules
const logger = require('./utils/logger');
const databaseConfig = require('./config/database');
const emailConfig = require('./config/email');
const stripeConfig = require('./config/stripe');
const storageConfig = require('./config/storage');

// Middleware modules
const security = require('./middleware/security');
// Error handlers will be used at the end of the middleware chain
// eslint-disable-next-line no-unused-vars
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const {
  authRequired,
  roleRequired,
  getUserFromCookie,
  clearAuthCookie,
} = require('./middleware/auth');
const { featureRequired } = require('./middleware/features');

// Utility modules
const validators = require('./utils/validators');
const helpers = require('./utils/helpers');

// Data access layer - MongoDB-first with local storage fallback
const dbUnified = databaseConfig.dbUnified;
const mongoDb = databaseConfig.mongoDb;
const { uid, DATA_DIR } = require('./store');

// Postmark email utility (for backward compatibility)
const postmark = require('./utils/postmark');

// Photo upload utilities
const photoUpload = storageConfig.photoUpload;

// Reviews and ratings system
const reviewsSystem = require('./reviews');

// Search and discovery system
const searchSystem = require('./search');

// Lead scoring utilities
const { calculateLeadScore } = require('./utils/leadScoring');

// Geocoding utilities
const geocoding = require('./utils/geocoding');

// Initialize Stripe
const STRIPE_ENABLED = stripeConfig.initializeStripe();

// Initialize OpenAI (optional)
let openaiClient = null;
let AI_ENABLED = false;
try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey.trim() !== '') {
    // eslint-disable-next-line global-require, node/no-missing-require
    const OpenAI = require('openai');
    openaiClient = new OpenAI({ apiKey });
    AI_ENABLED = true;
    logger.info('✅ OpenAI service configured');
  } else {
    logger.info('ℹ️  OpenAI not configured (optional) - AI features will be disabled');
  }
} catch (err) {
  logger.warn('⚠️  OpenAI configuration failed - AI features will be disabled', {
    error: err.message,
  });
  logger.info('   To enable AI features, install openai package and set OPENAI_API_KEY');
}

// HTTP client for external API calls

/**
 * Verify hCaptcha token
 * @param {string} token - hCaptcha token
 * @returns {Promise<{success: boolean, error?: string, errors?: string[]}>}
 */
async function verifyHCaptcha(token) {
  if (!token) {
    return { success: false, error: 'No captcha token provided' };
  }

  if (!process.env.HCAPTCHA_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      return { success: false, error: 'CAPTCHA verification not configured' };
    }
    console.warn(
      'hCaptcha verification skipped - HCAPTCHA_SECRET not configured (development only)'
    );
    return { success: true, warning: 'Captcha verification disabled in development' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const verifyResponse = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: process.env.HCAPTCHA_SECRET,
        response: token,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await verifyResponse.json();

    if (data.success) {
      return { success: true };
    } else {
      return {
        success: false,
        error: 'Captcha verification failed',
        errors: data['error-codes'],
      };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('hCaptcha verification timeout');
      return { success: false, error: 'Captcha verification timeout' };
    }
    console.error('Error verifying captcha:', error);
    return { success: false, error: 'Captcha verification error' };
  }
}

// CSRF protection middleware
// getToken is used by routes/system.js for csrf-token endpoint
const { csrfProtection, getToken } = require('./middleware/csrf');

// Swagger API documentation
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// Sentry integration for error tracking
const sentry = require('./utils/sentry');

// Cache management
const cache = require('./cache');

// Sitemap generator
const { generateSitemap, generateRobotsTxt } = require('./sitemap');

// Constants for user management
const VALID_USER_ROLES = ['customer', 'supplier', 'admin'];
const MAX_NAME_LENGTH = 80;
const OWNER_EMAIL = 'admin@event-flow.co.uk'; // Owner account always has admin role

// Helper functions (re-export from utils for backward compatibility)
const { supplierIsProActive } = helpers;
const { passwordOk } = validators;

const { seed } = require('./seed');

// ---------- Initialisation ----------
const isProduction = process.env.NODE_ENV === 'production';
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = String(process.env.JWT_SECRET || 'change_me');

// Validate email configuration
emailConfig.validateEmailConfig();

// Initialize Sentry for error tracking and performance monitoring
sentry.initSentry(app);

// Validate JWT_SECRET for security
const knownPlaceholders = [
  'change_me',
  'your_super_long_random_secret',
  'your-secret-key-min-32-chars',
  'your-secret-key',
  'your_secret',
];

const hasPlaceholder = knownPlaceholders.some(placeholder =>
  JWT_SECRET.toLowerCase().includes(placeholder.toLowerCase())
);

if (!JWT_SECRET || hasPlaceholder || JWT_SECRET.length < 32) {
  logger.error('❌ SECURITY ERROR: Invalid JWT_SECRET');
  if (!JWT_SECRET) {
    logger.error('   JWT_SECRET is not set in your environment.');
  } else if (hasPlaceholder) {
    logger.error('   JWT_SECRET contains placeholder values that must be replaced.');
  } else if (JWT_SECRET.length < 32) {
    logger.error(`   JWT_SECRET is too short (${JWT_SECRET.length} characters).`);
    logger.error('   A secure JWT_SECRET must be at least 32 characters long.');
  }
  logger.error('🔧 To generate a secure JWT_SECRET, run:');
  logger.error('   openssl rand -base64 32');
  process.exit(1);
}

// Configure trust proxy for Railway and other reverse proxies
const trustProxyEnv = process.env.TRUST_PROXY?.toLowerCase();
const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
const shouldTrustProxy = trustProxyEnv === 'true' || (isRailway && trustProxyEnv !== 'false');

if (shouldTrustProxy) {
  app.set('trust proxy', 1);
  logger.info('🔧 Trust proxy: enabled (running behind proxy/load balancer)');
} else {
  logger.info('🔧 Trust proxy: disabled (local development mode)');
}

app.disable('x-powered-by');

// Apply security middleware
app.use(security.configureHTTPSRedirect(isProduction));
app.use(security.configureHelmet(isProduction));
app.use(security.configurePermissionsPolicy());
app.use(require('cors')(security.configureCORS(isProduction)));

// Sentry request and tracing handlers
app.use(sentry.getRequestHandler());
app.use(sentry.getTracingHandler());

// API versioning middleware
const { apiVersionMiddleware } = require('./middleware/api-versioning');
app.use(apiVersionMiddleware);

// Pagination middleware for all API routes
const { paginationMiddleware, validatePagination } = require('./middleware/pagination');
app.use('/api', validatePagination);
app.use('/api', paginationMiddleware);

// Compression middleware
const configureCompression = require('./middleware/compression');
app.use(configureCompression());

// Logging middleware
const { configureLogging, requestDurationMiddleware } = require('./middleware/logging');
app.use(configureLogging({ environment: isProduction ? 'production' : 'development' }));
app.use(requestDurationMiddleware);

// Sanitization middleware
const { configureSanitization, inputValidationMiddleware } = require('./middleware/sanitize');
app.use(configureSanitization());
app.use(inputValidationMiddleware);

//Body parsing and cookies
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Create rate limiters
// authLimiter and healthCheckLimiter are used by routes/system.js
const rateLimiters = security.createRateLimiters();
const { authLimiter, strictAuthLimiter, passwordResetLimiter, writeLimiter, healthCheckLimiter } =
  rateLimiters;

// Email configuration and wrapper
const EMAIL_ENABLED = emailConfig.EMAIL_ENABLED;

// Validate production environment
if (process.env.NODE_ENV === 'production') {
  const required = {
    BASE_URL: process.env.BASE_URL,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    logger.error(`Production error: Missing required environment variables: ${missing.join(', ')}`);
    logger.error('Please set these in your .env file before deploying.');
    process.exit(1);
  }
}

// Email sending wrapper (for backward compatibility with inline routes)
async function sendMail(toOrOpts, subject, text) {
  return emailConfig.sendMail(toOrOpts, subject, text);
}

// User extraction middleware
app.use((req, res, next) => {
  const u = getUserFromCookie(req);
  if (u) {
    req.user = u;
    req.userId = u.id;
  }
  next();
});

// Maintenance mode check - blocks non-admin users if enabled
// Must come after user extraction so it can check user role
const maintenanceMode = require('./middleware/maintenance');
app.use(maintenanceMode);

// ---------- API Cache Control Middleware ----------
// SECURITY: Prevent service worker and intermediaries from caching sensitive API responses
// This middleware sets Cache-Control headers for API endpoints to prevent stale security risks
app.use('/api', (req, res, next) => {
  // Allowlist of safe cacheable API endpoints (public, non-sensitive data)
  // NOTE: Only endpoints returning truly public data should be here
  // Health/ready/performance endpoints expose internal config and should NOT be cached
  const SAFE_CACHEABLE_ENDPOINTS = [
    '/api/config', // Public config (Google Maps key, version)
    '/api/meta', // App metadata (version, node version, env)
  ];

  // Check if this is a safe cacheable endpoint
  const isSafeCacheable = SAFE_CACHEABLE_ENDPOINTS.includes(req.path);

  // For safe endpoints, allow downstream handlers to set their own cache headers
  // For all other API endpoints, set no-store to prevent caching
  if (!isSafeCacheable) {
    // Set default no-store header for sensitive endpoints
    // This prevents caching by browsers, service workers, and intermediaries
    res.setHeader('Cache-Control', 'no-store, private');
  }

  next();
});

// ---------- Static File Serving ----------
// Serve static files early in the middleware chain (before API routes)
// This ensures files like verify.html are served before any route handlers

// ---------- SEO: Noindex Middleware for Non-Public Pages ----------
// Add X-Robots-Tag header to prevent indexing of authenticated/private pages
// This MUST come before express.static() so it intercepts HTML file requests
app.use((req, res, next) => {
  // List of non-public pages that should not be indexed
  const noindexPaths = [
    '/auth.html',
    '/reset-password.html',
    '/dashboard.html',
    '/dashboard-customer.html',
    '/dashboard-supplier.html',
    '/messages.html',
    '/guests.html',
    '/checkout.html',
    '/my-marketplace-listings.html',
  ];

  // Check if path matches a noindex page (exact match)
  if (noindexPaths.includes(req.path)) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    logger.info(`X-Robots-Tag noindex applied to ${req.path}`);
  }

  // Also apply to admin pages (already blocked by middleware, but extra defense)
  if (req.path.startsWith('/admin') && req.path.endsWith('.html')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }

  next();
});

// Static assets with caching strategy (fixes poor cache headers)
app.use((req, res, next) => {
  // Short-term caching for HTML pages (5 minutes)
  if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    return next();
  }

  // Cache versioned assets (with hash in filename) for 1 year
  // Matches common hash patterns: 8, 12, or 16 hex characters (webpack, vite, etc.)
  // Separate patterns allow for precise matching without overly permissive patterns
  if (
    req.path.match(/\.[0-9a-f]{8}\.(css|js|jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot)$/i) ||
    req.path.match(/\.[0-9a-f]{12}\.(css|js|jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot)$/i) ||
    req.path.match(/\.[0-9a-f]{16}\.(css|js|jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot)$/i)
  ) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return next();
  }

  // Cache static assets (images, fonts, CSS, JS) for 1 week
  if (req.path.match(/\.(css|js|jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot|ico)$/i)) {
    res.setHeader('Cache-Control', 'public, max-age=604800, must-revalidate');
    return next();
  }

  // Default: no special caching
  next();
});

// Dynamic verification route - CRITICAL: Must be before express.static()
// This ensures /verify is handled by the backend route, not static file serving
// Fixes 404 errors in production where static files may not deploy correctly
// Each user receives a unique verification token in their email (e.g., verify_abc123)
// Rate limiting applied to prevent abuse
app.get('/verify', authLimiter, (req, res) => {
  // Serve the verification HTML page
  // The page will extract the token from the query string and call /api/auth/verify
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

// Sitemap.xml - Dynamic sitemap generation
app.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const sitemap = await generateSitemap(baseUrl);
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    sentry.captureException(error);
    res.status(500).send('Error generating sitemap');
  }
});

// Robots.txt - Dynamic robots.txt generation
app.get('/robots.txt', (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const robotsTxt = generateRobotsTxt(baseUrl);
    res.header('Content-Type', 'text/plain');
    res.send(robotsTxt);
  } catch (error) {
    console.error('Error generating robots.txt:', error);
    sentry.captureException(error);
    res.status(500).send('Error generating robots.txt');
  }
});

// Redirect non-canonical index URL to canonical
app.get('/index.html', (req, res) => {
  res.redirect(301, '/');
});

// Serve marketplace page
app.get('/marketplace', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'marketplace.html'));
});

// Redirect non-canonical marketplace URL to canonical
app.get('/marketplace.html', (req, res) => {
  res.redirect(301, '/marketplace');
});

// Block test/dev pages in production
if (process.env.NODE_ENV === 'production') {
  const testPages = [
    '/navbar-test.html',
    '/navbar-test-visual.html',
    '/modal-test.html',
    '/test-avatar-positioning.html',
    '/test-burger-menu.html',
    '/test-footer-nav.html',
    '/test-hero-search.html',
    '/test-jadeassist.html',
    '/test-jadeassist-real.html',
    '/test-responsive.html',
    '/test-ui-fixes.html',
    '/test-widget-positioning.html',
  ];

  testPages.forEach(page => {
    app.get(page, (req, res) => {
      res.status(404).send('Page not found');
    });
  });
}

// ---------- Admin HTML Page Protection ----------
// CRITICAL: This middleware MUST come before express.static()
// Protects all admin HTML pages from unauthorized access at the server level
// Client-side dashboard-guard.js remains as a fallback, but server is primary enforcement

// Allowlist of valid admin pages (for security - no regex matching)
const ADMIN_PAGES = [
  '/admin.html',
  '/admin-audit.html',
  '/admin-content.html',
  '/admin-homepage.html',
  '/admin-marketplace.html',
  '/admin-packages.html',
  '/admin-payments.html',
  '/admin-pexels.html',
  '/admin-photos.html',
  '/admin-reports.html',
  '/admin-settings.html',
  '/admin-supplier-detail.html',
  '/admin-suppliers.html',
  '/admin-tickets.html',
  '/admin-user-detail.html',
  '/admin-users.html',
];

app.use((req, res, next) => {
  // Check if requesting an admin HTML page (using allowlist for security)
  if (ADMIN_PAGES.includes(req.path)) {
    const user = getUserFromCookie(req);

    // Not authenticated - redirect to login with sanitized return path
    if (!user) {
      logger.info(`Admin page access denied (not authenticated): ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      // Redirect path is already validated by allowlist check above
      return res.redirect(`/auth.html?redirect=${encodeURIComponent(req.path)}`);
    }

    // Authenticated but not admin - redirect to dashboard with message
    if (user.role !== 'admin') {
      logger.warn(`Admin page access denied (insufficient role): ${req.path}`, {
        userId: user.id,
        userRole: user.role,
        ip: req.ip,
      });
      return res.redirect('/dashboard.html?msg=admin_required');
    }

    // Admin user - allow access
    logger.info(`Admin page access granted: ${req.path}`, {
      userId: user.id,
      userRole: user.role,
    });
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
// Far-future caching for user uploads (they have unique filenames)
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    next();
  },
  express.static(path.join(__dirname, 'uploads'))
);

// ---------- AUTH ----------
app.post('/api/auth/register', strictAuthLimiter, csrfProtection, async (req, res) => {
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

  const users = await dbUnified.read('users');
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

  const user = {
    id: uid('usr'),
    name: String(userFullName).slice(0, MAX_NAME_LENGTH),
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
    notify: true,
    marketingOptIn: !!(req.body && req.body.marketingOptIn),
    verified: false,
    verificationToken: uid('verify'),
    verificationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await dbUnified.write('users', users);

  // Send verification email (dev mode writes .eml files to /outbox)
  try {
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const verificationLink = `${baseUrl}/verify.html?token=${encodeURIComponent(user.verificationToken)}`;
    console.log(`📧 Generating verification link: ${verificationLink}`);
    await sendMail({
      to: user.email,
      subject: 'Confirm your EventFlow account',
      template: 'verification',
      templateData: {
        name: user.name || 'there',
        verificationLink: verificationLink,
        email: user.email,
      },
    });
    console.log(`✅ Verification email sent successfully to ${user.email}`);
  } catch (e) {
    console.error('❌ Failed to send verification email', e);

    // Rollback user creation
    const allUsers = await dbUnified.read('users');
    const filteredUsers = allUsers.filter(u => u.id !== user.id);
    await dbUnified.write('users', filteredUsers);

    return res.status(500).json({
      error: 'Failed to send verification email. Please try again or contact support.',
    });
  }

  res.json({
    ok: true,
    message: 'Account created successfully. Please check your email to verify your account.',
    email: user.email,
  });
});

app.post('/api/auth/login', authLimiter, csrfProtection, async (req, res) => {
  const { email, password, remember } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const user = (await dbUnified.read('users')).find(
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
  try {
    const allUsers = await dbUnified.read('users');
    const idx = allUsers.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      allUsers[idx].lastLoginAt = new Date().toISOString();
      await dbUnified.write('users', allUsers);
    }
  } catch (e) {
    console.error('Failed to update lastLoginAt', e);
  }

  // Enforce owner account always has admin role
  const isOwner = (user.email || '').toLowerCase() === OWNER_EMAIL.toLowerCase();
  const userRole = isOwner ? 'admin' : user.role;

  // Set JWT expiry based on "remember me" checkbox
  // Remember me: 30 days, otherwise: 7 days
  const expiresIn = remember ? '30d' : '7d';
  const token = jwt.sign({ id: user.id, email: user.email, role: userRole }, JWT_SECRET, {
    expiresIn,
  });

  // Set cookie with appropriate max age
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = remember
    ? 1000 * 60 * 60 * 24 * 30 // 30 days
    : 1000 * 60 * 60 * 24 * 7; // 7 days

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: isProd ? 'lax' : 'lax',
    secure: isProd,
    maxAge: maxAge,
  });

  res.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: userRole },
  });
});

app.post('/api/auth/forgot', passwordResetLimiter, csrfProtection, async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  // Look up user by email (case-insensitive)
  const users = await dbUnified.read('users');
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
  await dbUnified.write('users', users);

  // Fire-and-forget email (demo only — in dev this usually logs to console)
  (async () => {
    try {
      if (user.email) {
        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
        const resetLink = `${baseUrl}/reset-password.html?token=${token}`;
        await sendMail({
          to: user.email,
          subject: 'Reset your EventFlow password',
          template: 'password-reset',
          templateData: {
            name: user.name || 'there',
            resetToken: token,
            resetLink: resetLink,
            expiresIn: '1 hour',
          },
        });
      }
    } catch (err) {
      console.error('Failed to send reset email', err);
    }
  })();

  res.json({ ok: true });
});

app.get('/api/auth/verify', async (req, res) => {
  const { token } = req.query || {};
  console.log(
    `📧 Verification request received with token: ${token ? `${token.substring(0, 10)}...` : 'NONE'}`
  );

  if (!token) {
    console.error('❌ Verification failed: Missing token');
    return res.status(400).json({ error: 'Missing token' });
  }

  const users = await dbUnified.read('users');
  const idx = users.findIndex(u => u.verificationToken === token);

  if (idx === -1) {
    console.error(`❌ Verification failed: Invalid token - ${token.substring(0, 10)}...`);
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  // Check if token has expired
  if (
    users[idx].verificationTokenExpiresAt &&
    new Date(users[idx].verificationTokenExpiresAt) < new Date()
  ) {
    const user = users[idx];
    console.error(`❌ Verification failed: Token expired for ${user.email}`);
    return res.status(400).json({
      error: 'Verification link has expired. Please request a new one.',
      expired: true,
    });
  }

  const user = users[idx];
  console.log(`📧 Found user for verification: ${user.email}`);

  // Mark user as verified
  users[idx].verified = true;
  delete users[idx].verificationToken;
  delete users[idx].verificationTokenExpiresAt;
  await dbUnified.write('users', users);
  console.log(`✅ User verified successfully: ${user.email}`);

  // Send welcome email after successful verification (non-blocking)
  sendMail({
    to: user.email,
    subject: 'Welcome to EventFlow!',
    template: 'welcome',
    templateData: {
      name: user.name || 'there',
      email: user.email,
      role: user.role,
    },
  }).catch(e => {
    console.error('❌ Failed to send welcome email', e);
  });

  res.json({ ok: true, message: 'Email verified successfully' });
});

app.post('/api/auth/resend-verification', authLimiter, csrfProtection, async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  const users = await dbUnified.read('users');
  const idx = users.findIndex(u => u.email.toLowerCase() === String(email).toLowerCase());

  if (idx === -1) {
    return res.json({ ok: true }); // Don't leak which emails exist
  }

  const user = users[idx];

  if (user.verified) {
    return res.status(400).json({ error: 'Email already verified' });
  }

  // Generate new token
  const newToken = uid('verify');
  users[idx].verificationToken = newToken;
  users[idx].verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await dbUnified.write('users', users);

  try {
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const verificationLink = `${baseUrl}/verify.html?token=${encodeURIComponent(newToken)}`;
    console.log(`📧 Resending verification link: ${verificationLink}`);

    await sendMail({
      to: user.email,
      subject: 'Confirm your EventFlow account',
      template: 'verification',
      templateData: {
        name: user.name || 'there',
        verificationLink: verificationLink,
        email: user.email,
      },
    });

    console.log(`✅ Verification email resent successfully to ${user.email}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ Failed to resend verification email', e);
    return res.status(500).json({
      error: 'Failed to send verification email. Please try again later.',
    });
  }
});

// System routes (health, config, meta, etc.) are now in routes/system.js

// Admin: list users (without password hashes)
app.get('/api/admin/users', authRequired, roleRequired('admin'), async (req, res) => {
  const users = (await dbUnified.read('users')).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    verified: !!u.verified,
    marketingOptIn: !!u.marketingOptIn,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || null,
  }));
  // Sort newest first by createdAt
  users.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) {
      return 0;
    }
    if (!a.createdAt) {
      return 1;
    }
    if (!b.createdAt) {
      return -1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  res.json({ items: users });
});

// Admin: export only marketing-opt-in users as CSV
app.get('/api/admin/marketing-export', authRequired, roleRequired('admin'), async (req, res) => {
  const users = (await dbUnified.read('users')).filter(u => u.marketingOptIn);
  const header = 'name,email,role\n';
  const rows = users
    .map(u => {
      const name = (u.name || '').replace(/"/g, '""');
      const email = (u.email || '').replace(/"/g, '""');
      const role = (u.role || '').replace(/"/g, '""');
      return `"${name}","${email}","${role}"`;
    })
    .join('\n');
  const csv = header + rows + (rows ? '\n' : '');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="eventflow-marketing.csv"');
  res.send(csv);
});

// Admin: export all users as CSV
app.get('/api/admin/users-export', authRequired, roleRequired('admin'), async (req, res) => {
  const users = await dbUnified.read('users');
  const header = 'id,name,email,role,verified,marketingOptIn,createdAt,lastLoginAt\n';
  const rows = users
    .map(u => {
      const esc = v => String(v ?? '').replace(/"/g, '""');
      const verified = u.verified ? 'yes' : 'no';
      const marketing = u.marketingOptIn ? 'yes' : 'no';
      return `"${esc(u.id)}","${esc(u.name)}","${esc(u.email)}","${esc(u.role)}","${verified}","${marketing}","${esc(u.createdAt)}","${esc(u.lastLoginAt || '')}"`;
    })
    .join('\n');
  const csv = header + rows + (rows ? '\n' : '');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="eventflow-users.csv"');
  res.send(csv);
});

/**
 * POST /api/admin/users
 * Create a new user (admin only)
 */
app.post(
  '/api/admin/users',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const { name, email, password, role = 'customer' } = req.body || {};

    // Validate required fields
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Missing required fields: name, email, and password are required' });
    }

    // Validate email format
    if (!validator.isEmail(String(email))) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (!passwordOk(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, and number',
      });
    }

    // Validate role
    const roleFinal = VALID_USER_ROLES.includes(role) ? role : 'customer';

    // Check if user already exists
    const users = await dbUnified.read('users');
    if (users.find(u => u.email.toLowerCase() === String(email).toLowerCase())) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    // Create new user
    const user = {
      id: uid('usr'),
      name: String(name).trim().slice(0, MAX_NAME_LENGTH),
      email: String(email).toLowerCase(),
      role: roleFinal,
      passwordHash: bcrypt.hashSync(password, 10),
      notify: true,
      marketingOptIn: false,
      verified: true, // Admin-created users are pre-verified
      createdAt: new Date().toISOString(),
      createdBy: req.user.id, // Track who created the user
    };

    users.push(user);
    await dbUnified.write('users', users);

    // Create audit log
    auditLog({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: AUDIT_ACTIONS.USER_CREATED,
      targetType: 'user',
      targetId: user.id,
      details: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        verified: user.verified,
      },
    });
  }
);

/**
 * POST /api/admin/users/:id/grant-admin
 * Grant admin privileges to a user
 */
app.post(
  '/api/admin/users/:id/grant-admin',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const { id } = req.params;
    const users = await dbUnified.read('users');
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[userIndex];
    const now = new Date().toISOString();

    // Check if user already has admin role
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'User already has admin privileges' });
    }

    // Store previous role
    user.previousRole = user.role;
    user.role = 'admin';
    user.adminGrantedAt = now;
    user.adminGrantedBy = req.user.id;
    user.updatedAt = now;

    users[userIndex] = user;
    await dbUnified.write('users', users);

    // Create audit log
    auditLog({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
      targetType: 'user',
      targetId: user.id,
      details: {
        email: user.email,
        previousRole: user.previousRole,
        newRole: 'admin',
      },
    });

    res.json({
      success: true,
      message: 'Admin privileges granted successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  }
);

/**
 * POST /api/admin/users/:id/revoke-admin
 * Revoke admin privileges from a user
 */
app.post(
  '/api/admin/users/:id/revoke-admin',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const { id } = req.params;
    const { newRole = 'customer' } = req.body;
    const users = await dbUnified.read('users');
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[userIndex];
    const now = new Date().toISOString();

    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(400).json({ error: 'User does not have admin privileges' });
    }

    // Prevent revoking own admin privileges
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot revoke your own admin privileges' });
    }

    // Prevent revoking owner's admin privileges
    if (user.email === 'admin@event-flow.co.uk' || user.isOwner) {
      return res
        .status(403)
        .json({ error: 'Cannot revoke admin privileges from the owner account' });
    }

    // Validate newRole
    if (!['customer', 'supplier'].includes(newRole)) {
      return res.status(400).json({ error: 'Invalid role. Must be customer or supplier' });
    }

    // Store previous role
    user.previousRole = user.role;
    user.role = newRole;
    user.adminRevokedAt = now;
    user.adminRevokedBy = req.user.id;
    user.updatedAt = now;

    users[userIndex] = user;
    await dbUnified.write('users', users);

    // Create audit log
    auditLog({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
      targetType: 'user',
      targetId: user.id,
      details: {
        email: user.email,
        previousRole: 'admin',
        newRole: newRole,
      },
    });

    res.json({
      success: true,
      message: 'Admin privileges revoked successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  }
);

// Admin: export all core collections as JSON
app.get('/api/admin/export/all', authRequired, roleRequired('admin'), async (_req, res) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    users: await dbUnified.read('users'),
    suppliers: await dbUnified.read('suppliers'),
    packages: await dbUnified.read('packages'),
    plans: await dbUnified.read('plans'),
    notes: await dbUnified.read('notes'),
    events: await dbUnified.read('events'),
    threads: await dbUnified.read('threads'),
    messages: await dbUnified.read('messages'),
  };
  const json = JSON.stringify(payload, null, 2);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="eventflow-export.json"');
  res.send(json);
});

app.post('/api/auth/logout', csrfProtection, async (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  const p = getUserFromCookie(req);
  if (!p) {
    return res.status(200).json({ user: null });
  }
  const u = (await dbUnified.read('users')).find(x => x.id === p.id);
  if (!u) {
    return res.status(200).json({ user: null });
  }

  // Enforce owner account always has admin role
  const isOwner = (u.email || '').toLowerCase() === OWNER_EMAIL.toLowerCase();
  const userRole = isOwner ? 'admin' : u.role;

  const userData = {
    id: u.id,
    name: u.name,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: userRole,
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
    isOwner: isOwner,
  };

  // Return wrapped format for consistency with frontend expectations
  // Also include unwrapped properties for backward compatibility
  res.json({
    user: userData,
    // Backward compatibility: include all user properties at root level
    ...userData,
  });
});

// Backward-compatible alias for /api/auth/me
app.get('/api/user', async (req, res) => {
  res.set('Deprecation', 'true');
  res.set('Link', '</api/auth/me>; rel="canonical"');
  const p = getUserFromCookie(req);
  if (!p) {
    return res.status(200).json({ user: null });
  }
  const u = (await dbUnified.read('users')).find(x => x.id === p.id);
  if (!u) {
    return res.status(200).json({ user: null });
  }

  // Enforce owner account always has admin role (consistent with /api/auth/me)
  const isOwner = (u.email || '').toLowerCase() === OWNER_EMAIL.toLowerCase();
  const userRole = isOwner ? 'admin' : u.role;

  res.json({
    id: u.id,
    name: u.name,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: userRole,
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
  });
});

// ---------- Suppliers (public) ----------
app.get('/api/suppliers', async (req, res) => {
  const { category, q, price } = req.query;
  let items = (await dbUnified.read('suppliers')).filter(s => s.approved);
  if (category) {
    items = items.filter(s => s.category === category);
  }
  if (price) {
    items = items.filter(s => (s.price_display || '').includes(price));
  }
  if (q) {
    const qq = String(q).toLowerCase();
    items = items.filter(
      s =>
        (s.name || '').toLowerCase().includes(qq) ||
        (s.description_short || '').toLowerCase().includes(qq) ||
        (s.location || '').toLowerCase().includes(qq)
    );
  }

  // Mark suppliers that have at least one featured package and compute active Pro flag
  const pkgs = await dbUnified.read('packages');
  items = items.map(s => {
    const featuredSupplier = pkgs.some(p => p.supplierId === s.id && p.featured);
    const isProActive = supplierIsProActive(s);
    return {
      ...s,
      featuredSupplier,
      isPro: isProActive,
      proExpiresAt: s.proExpiresAt || null,
    };
  });

  // If smart scores are available, sort by them while giving Pro suppliers a gentle boost.
  items = items
    .map((s, index) => ({ ...s, _idx: index }))
    .sort((a, b) => {
      const sa = typeof a.aiScore === 'number' ? a.aiScore : 0;
      const sb = typeof b.aiScore === 'number' ? b.aiScore : 0;
      const aProBoost = a.isPro ? 10 : 0;
      const bProBoost = b.isPro ? 10 : 0;
      const ea = sa + aProBoost;
      const eb = sb + bProBoost;
      if (ea === eb) {
        return a._idx - b._idx;
      }
      return eb - ea;
    })
    .map(s => {
      const copy = { ...s };
      delete copy._idx;
      return copy;
    });

  res.json({ items });
});

/**
 * Get venues near a location
 * GET /api/venues/near?location=Cardiff&radiusMiles=10
 */
app.get('/api/venues/near', async (req, res) => {
  try {
    const { location, radiusMiles = 10 } = req.query;

    // Get all approved Venues category suppliers
    let venues = (await dbUnified.read('suppliers')).filter(
      s => s.approved && s.category === 'Venues'
    );

    // If no location provided, return all venues
    if (!location || location.trim() === '') {
      // Add distance as null for all venues
      venues = venues.map(v => ({ ...v, distance: null }));

      return res.json({
        venues,
        total: venues.length,
        filtered: false,
        message: 'Showing all venues (no location filter)',
      });
    }

    // Try to geocode the location
    const coords = await geocoding.geocodeLocation(location);

    if (!coords) {
      // Could not geocode - return all venues with a warning
      venues = venues.map(v => ({ ...v, distance: null }));

      return res.json({
        venues,
        total: venues.length,
        filtered: false,
        radiusMiles: parseFloat(radiusMiles) || 10,
        warning: `Could not find location "${location}". Showing all venues.`,
      });
    }

    // Filter venues by proximity
    const radius = parseFloat(radiusMiles) || 10;

    // Calculate distance for each venue that has coordinates
    const venuesWithDistance = venues
      .map(venue => {
        if (
          venue.latitude !== null &&
          venue.latitude !== undefined &&
          venue.longitude !== null &&
          venue.longitude !== undefined
        ) {
          const distance = geocoding.calculateDistance(
            coords.latitude,
            coords.longitude,
            venue.latitude,
            venue.longitude
          );
          return { ...venue, distance };
        }
        // Venue without coordinates - exclude from proximity filter
        return null;
      })
      .filter(v => v !== null);

    // Filter by radius
    const nearbyVenues = venuesWithDistance.filter(v => v.distance <= radius);

    // Sort by distance
    nearbyVenues.sort((a, b) => a.distance - b.distance);

    res.json({
      venues: nearbyVenues,
      total: nearbyVenues.length,
      filtered: true,
      location: location,
      coordinates: coords,
      radiusMiles: radius,
      message: `Found ${nearbyVenues.length} venues within ${radius} miles of ${location}`,
    });
  } catch (error) {
    console.error('Venue proximity search error:', error);
    res.status(500).json({
      error: 'Failed to search venues',
      details: error.message,
    });
  }
});

// AI event planning assistant
app.post('/api/ai/plan', express.json(), csrfProtection, async (req, res) => {
  const body = req.body || {};
  const promptText = String(body.prompt || '').trim();
  const plan = body.plan || {};
  const hasOpenAI = AI_ENABLED && !!openaiClient;

  const summaryBits = [];
  if (plan && typeof plan === 'object') {
    if (Array.isArray(plan.guests) && plan.guests.length) {
      summaryBits.push(`${plan.guests.length} guests in the list`);
    }
    if (Array.isArray(plan.tasks) && plan.tasks.length) {
      summaryBits.push(`${plan.tasks.length} planning tasks`);
    }
    if (Array.isArray(plan.timeline) && plan.timeline.length) {
      summaryBits.push(`${plan.timeline.length} timeline items`);
    }
  }

  const basePrompt = [
    'You are an experienced UK wedding and event planner.',
    'Return a short, structured JSON object with suggestions only – no explanation text.',
    '',
    'User description:',
    promptText || '(User did not provide extra description.)',
    '',
    'Current plan summary:',
    summaryBits.length ? `- ${summaryBits.join('\n- ')}` : 'No existing plan data.',
    '',
    'Your JSON must use this structure:',
    '{',
    '  "checklist": [ "string task 1", "string task 2" ],',
    '  "timeline": [ { "time": "14:00", "item": "Thing", "owner": "Who" } ],',
    '  "suppliers": [ { "category": "Venues", "suggestion": "Tip or type of supplier" } ],',
    '  "budget": [ { "item": "Venue", "estimate": "£2000" } ],',
    '  "styleIdeas": [ "One-sentence styling idea" ],',
    '  "messages": [ "Friendly message the user could send to a supplier" ]',
    '}',
  ].join('\n');

  if (!hasOpenAI) {
    // Fallback: simple deterministic suggestions so the feature still works without OpenAI configured.
    const fallback = {
      checklist: [
        'Lock in your venue date',
        'Confirm catering numbers and dietary requirements',
        'Book photographer / videographer',
        'Create a draft day-of timeline',
      ],
      timeline: [
        { time: '13:00', item: 'Guests arrive', owner: 'Venue' },
        { time: '14:00', item: 'Ceremony', owner: 'Registrar / celebrant' },
        { time: '15:00', item: 'Drinks reception & photos', owner: 'Venue / photographer' },
        { time: '17:30', item: 'Wedding breakfast', owner: 'Catering' },
        { time: '20:00', item: 'First dance & evening guests', owner: 'Band / DJ' },
      ],
      suppliers: [
        {
          category: 'Venues',
          suggestion: 'Shortlist 2–3 venues within 30 minutes of where most guests live.',
        },
        {
          category: 'Catering',
          suggestion: 'Ask for sample menus that cover vegan and gluten-free options.',
        },
        {
          category: 'Photography',
          suggestion: 'Look for photographers who have shot at your chosen venue before.',
        },
      ],
      budget: [
        { item: 'Venue & hire', estimate: '≈ 40% of your total budget' },
        { item: 'Food & drink', estimate: '≈ 25% of your total budget' },
        { item: 'Photography / video', estimate: '≈ 10–15% of your total budget' },
      ],
      styleIdeas: [
        'Soft green and white palette with lots of candlelight.',
        'Personal touches like table names based on places you have travelled together.',
      ],
      messages: [
        'Hi! We are planning a wedding around [DATE] for around [GUESTS] guests near [LOCATION]. Are you available, and could you share a sample package or pricing?',
        'Hi! We love your work and are planning an event in [MONTH/YEAR]. Could you let us know your availability and typical pricing for this kind of day?',
      ],
    };
    return res.json({ from: 'fallback', data: fallback });
  }

  try {
    const completion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a concise, practical wedding and event planning assistant.',
        },
        { role: 'user', content: basePrompt },
      ],
      temperature: 0.6,
    });

    const raw =
      (completion &&
        completion.choices &&
        completion.choices[0] &&
        completion.choices[0].message &&
        completion.choices[0].message.content) ||
      '';
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_e) {
      // If the model returns text instead of JSON, fall back to a safe minimal object.
      parsed = {
        checklist: [],
        timeline: [],
        suppliers: [],
        budget: [],
        styleIdeas: [],
        messages: [],
      };
    }
    return res.json({ from: 'openai', data: parsed });
  } catch (err) {
    console.error('OpenAI planning error', err);
    return res.status(500).json({ error: 'AI planning request failed.' });
  }
});

// Admin-only: auto-categorisation & scoring for suppliers
app.post(
  '/api/admin/suppliers/smart-tags',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const all = await dbUnified.read('suppliers');
    const now = new Date().toISOString();
    const updated = [];

    all.forEach(s => {
      const tags = [];
      if (s.category) {
        tags.push(s.category);
      }
      if (Array.isArray(s.amenities)) {
        s.amenities.slice(0, 3).forEach(a => tags.push(a));
      }
      if (s.location) {
        tags.push(s.location.split(',')[0].trim());
      }

      let score = 40;
      if (Array.isArray(s.photos) && s.photos.length) {
        score += 20;
      }
      if ((s.description_short || '').length > 40) {
        score += 15;
      }
      if ((s.description_long || '').length > 80) {
        score += 15;
      }
      if (Array.isArray(s.amenities) && s.amenities.length >= 3) {
        score += 10;
      }
      if (score > 100) {
        score = 100;
      }

      s.aiTags = tags;
      s.aiScore = score;
      s.aiUpdatedAt = now;
      updated.push({ id: s.id, aiTags: tags, aiScore: score });
    });

    await dbUnified.write('suppliers', all);
    res.json({ ok: true, items: updated, aiEnabled: AI_ENABLED });
  }
);

// ---------- Badge Management ----------

/**
 * GET /api/admin/badges
 * Get all badges
 */
app.get('/api/admin/badges', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const badges = await dbUnified.read('badges');
    res.json({ badges });
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

/**
 * POST /api/admin/badges
 * Create a new badge
 */
app.post(
  '/api/admin/badges',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { name, type, description, icon, color, autoAssign, autoAssignCriteria } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: 'Name and type are required' });
      }

      const now = new Date().toISOString();
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const newBadge = {
        id: uid('bdg'),
        name,
        slug,
        type,
        description: description || '',
        icon: icon || '🏅',
        color: color || '#13B6A2',
        autoAssign: autoAssign || false,
        autoAssignCriteria: autoAssignCriteria || null,
        displayOrder: 100,
        active: true,
        createdAt: now,
        updatedAt: now,
      };

      const badges = await dbUnified.read('badges');
      badges.push(newBadge);
      await dbUnified.write('badges', badges);

      res.status(201).json({ badge: newBadge });
    } catch (error) {
      console.error('Error creating badge:', error);
      res.status(500).json({ error: 'Failed to create badge' });
    }
  }
);

/**
 * PUT /api/admin/badges/:id
 * Update a badge
 */
app.put(
  '/api/admin/badges/:id',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        type,
        description,
        icon,
        color,
        autoAssign,
        autoAssignCriteria,
        displayOrder,
        active,
      } = req.body;

      // Validate allowed fields
      const allowedUpdates = {
        name,
        type,
        description,
        icon,
        color,
        autoAssign,
        autoAssignCriteria,
        displayOrder,
        active,
      };
      const updates = {};

      // Only include defined fields
      Object.keys(allowedUpdates).forEach(key => {
        if (allowedUpdates[key] !== undefined) {
          updates[key] = allowedUpdates[key];
        }
      });

      // Validate required fields if provided
      if (updates.name !== undefined && (!updates.name || typeof updates.name !== 'string')) {
        return res.status(400).json({ error: 'Invalid name field' });
      }

      if (updates.type !== undefined) {
        const validTypes = ['founder', 'pro', 'pro-plus', 'verified', 'featured', 'custom'];
        if (!validTypes.includes(updates.type)) {
          return res.status(400).json({ error: 'Invalid badge type' });
        }
      }

      const badges = await dbUnified.read('badges');
      const badgeIndex = badges.findIndex(b => b.id === id);

      if (badgeIndex === -1) {
        return res.status(404).json({ error: 'Badge not found' });
      }

      badges[badgeIndex] = {
        ...badges[badgeIndex],
        ...updates,
        id, // Preserve ID
        updatedAt: new Date().toISOString(),
      };

      await dbUnified.write('badges', badges);
      res.json({ badge: badges[badgeIndex] });
    } catch (error) {
      console.error('Error updating badge:', error);
      res.status(500).json({ error: 'Failed to update badge' });
    }
  }
);

/**
 * DELETE /api/admin/badges/:id
 * Delete a badge
 */
app.delete(
  '/api/admin/badges/:id',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { id } = req.params;

      const badges = await dbUnified.read('badges');
      const filtered = badges.filter(b => b.id !== id);

      if (filtered.length === badges.length) {
        return res.status(404).json({ error: 'Badge not found' });
      }

      await dbUnified.write('badges', filtered);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting badge:', error);
      res.status(500).json({ error: 'Failed to delete badge' });
    }
  }
);

/**
 * POST /api/admin/suppliers/:supplierId/badges/:badgeId
 * Award a badge to a supplier
 */
app.post(
  '/api/admin/suppliers/:supplierId/badges/:badgeId',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { supplierId, badgeId } = req.params;

      const suppliers = await dbUnified.read('suppliers');
      const supplierIndex = suppliers.findIndex(s => s.id === supplierId);

      if (supplierIndex === -1) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      if (!suppliers[supplierIndex].badges) {
        suppliers[supplierIndex].badges = [];
      }

      if (!suppliers[supplierIndex].badges.includes(badgeId)) {
        suppliers[supplierIndex].badges.push(badgeId);
        await dbUnified.write('suppliers', suppliers);
      }

      res.json({ success: true, supplier: suppliers[supplierIndex] });
    } catch (error) {
      console.error('Error awarding badge:', error);
      res.status(500).json({ error: 'Failed to award badge' });
    }
  }
);

/**
 * DELETE /api/admin/suppliers/:supplierId/badges/:badgeId
 * Remove a badge from a supplier
 */
app.delete(
  '/api/admin/suppliers/:supplierId/badges/:badgeId',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { supplierId, badgeId } = req.params;

      const suppliers = await dbUnified.read('suppliers');
      const supplierIndex = suppliers.findIndex(s => s.id === supplierId);

      if (supplierIndex === -1) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      if (suppliers[supplierIndex].badges) {
        suppliers[supplierIndex].badges = suppliers[supplierIndex].badges.filter(
          b => b !== badgeId
        );
        await dbUnified.write('suppliers', suppliers);
      }

      res.json({ success: true, supplier: suppliers[supplierIndex] });
    } catch (error) {
      console.error('Error removing badge:', error);
      res.status(500).json({ error: 'Failed to remove badge' });
    }
  }
);

/**
 * POST /api/admin/users/:userId/badges/:badgeId
 * Award a badge to a user
 */
app.post(
  '/api/admin/users/:userId/badges/:badgeId',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { userId, badgeId } = req.params;

      const users = await dbUnified.read('users');
      const userIndex = users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!users[userIndex].badges) {
        users[userIndex].badges = [];
      }

      if (!users[userIndex].badges.includes(badgeId)) {
        users[userIndex].badges.push(badgeId);
        await dbUnified.write('users', users);
      }

      res.json({ success: true, user: users[userIndex] });
    } catch (error) {
      console.error('Error awarding badge:', error);
      res.status(500).json({ error: 'Failed to award badge' });
    }
  }
);

/**
 * DELETE /api/admin/users/:userId/badges/:badgeId
 * Remove a badge from a user
 */
app.delete(
  '/api/admin/users/:userId/badges/:badgeId',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { userId, badgeId } = req.params;

      const users = await dbUnified.read('users');
      const userIndex = users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (users[userIndex].badges) {
        users[userIndex].badges = users[userIndex].badges.filter(b => b !== badgeId);
        await dbUnified.write('users', users);
      }

      res.json({ success: true, user: users[userIndex] });
    } catch (error) {
      console.error('Error removing badge:', error);
      res.status(500).json({ error: 'Failed to remove badge' });
    }
  }
);

// ---------- Photo Moderation ----------

/**
 * GET /api/admin/photos/pending
 * Get all photos pending approval
 */
app.get('/api/admin/photos/pending', authRequired, roleRequired('admin'), async (req, res) => {
  const photos = await dbUnified.read('photos');
  const pendingPhotos = photos.filter(p => p.status === 'pending');

  // Enrich with supplier information
  const suppliers = await dbUnified.read('suppliers');
  const enrichedPhotos = pendingPhotos.map(photo => {
    const supplier = suppliers.find(s => s.id === photo.supplierId);
    return {
      ...photo,
      supplierName: supplier ? supplier.name : 'Unknown',
      supplierCategory: supplier ? supplier.category : null,
    };
  });

  res.json({ photos: enrichedPhotos });
});

/**
 * GET /api/admin/photos
 * Get photos for a specific supplier (admin view)
 */
app.get('/api/admin/photos', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const { supplierId } = req.query;

    if (!supplierId) {
      return res.status(400).json({ error: 'supplierId query parameter is required' });
    }

    const suppliers = await dbUnified.read('suppliers');
    const supplier = suppliers.find(s => s.id === supplierId);

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get photos from photosGallery (includes approved and unapproved)
    const photos = supplier.photosGallery || [];

    res.json({
      success: true,
      photos: photos.map(p => ({
        ...p,
        id: p.id || `${supplierId}_${p.uploadedAt}`,
        supplierId,
      })),
    });
  } catch (error) {
    console.error('Error fetching supplier photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos', details: error.message });
  }
});

/**
 * POST /api/admin/photos/:id/approve
 * Approve a photo
 */
app.post(
  '/api/admin/photos/:id/approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const { id } = req.params;
    const photos = await dbUnified.read('photos');
    const photoIndex = photos.findIndex(p => p.id === id);

    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = photos[photoIndex];
    const now = new Date().toISOString();

    // Update photo status
    photo.status = 'approved';
    photo.approvedAt = now;
    photo.approvedBy = req.user.id;

    photos[photoIndex] = photo;
    await dbUnified.write('photos', photos);

    // Add photo to supplier's photos array if not already there
    const suppliers = await dbUnified.read('suppliers');
    const supplierIndex = suppliers.findIndex(s => s.id === photo.supplierId);

    if (supplierIndex !== -1) {
      if (!suppliers[supplierIndex].photos) {
        suppliers[supplierIndex].photos = [];
      }
      if (!suppliers[supplierIndex].photos.includes(photo.url)) {
        suppliers[supplierIndex].photos.push(photo.url);
        await dbUnified.write('suppliers', suppliers);
      }
    }

    res.json({ success: true, message: 'Photo approved successfully', photo });
  }
);

/**
 * POST /api/admin/photos/:id/reject
 * Reject a photo
 */
app.post(
  '/api/admin/photos/:id/reject',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const photos = await dbUnified.read('photos');
    const photoIndex = photos.findIndex(p => p.id === id);

    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = photos[photoIndex];
    const now = new Date().toISOString();

    // Update photo status
    photo.status = 'rejected';
    photo.rejectedAt = now;
    photo.rejectedBy = req.user.id;
    photo.rejectionReason = reason || 'No reason provided';

    photos[photoIndex] = photo;
    await dbUnified.write('photos', photos);

    res.json({ success: true, message: 'Photo rejected successfully', photo });
  }
);

app.get('/api/suppliers/:id', async (req, res) => {
  const sRaw = (await dbUnified.read('suppliers')).find(x => x.id === req.params.id && x.approved);
  if (!sRaw) {
    return res.status(404).json({ error: 'Not found' });
  }

  const pkgs = await dbUnified.read('packages');
  const featuredSupplier = pkgs.some(p => p.supplierId === sRaw.id && p.featured);
  const isProActive = supplierIsProActive(sRaw);
  const s = {
    ...sRaw,
    featuredSupplier,
    isPro: isProActive,
    proExpiresAt: sRaw.proExpiresAt || null,
  };

  // Track profile view (unless preview mode)
  const isPreview = req.query.preview === 'true';
  const supplierAnalytics = require('./utils/supplierAnalytics');
  const userId = req.user ? req.user.id : null;
  const sessionId = req.session ? req.session.id : null;

  supplierAnalytics
    .trackProfileView(req.params.id, userId, sessionId, isPreview)
    .catch(err => console.error('Failed to track profile view:', err));

  res.json(s);
});

app.get('/api/suppliers/:id/packages', async (req, res) => {
  const supplier = (await dbUnified.read('suppliers')).find(
    x => x.id === req.params.id && x.approved
  );
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found' });
  }
  const pkgs = (await dbUnified.read('packages')).filter(
    p => p.supplierId === supplier.id && p.approved
  );
  res.json({ items: pkgs });
});

// Helper function to check if package is featured
function isFeaturedPackage(pkg) {
  return pkg.featured === true || pkg.isFeatured === true;
}

app.get('/api/packages/featured', async (_req, res) => {
  const packages = await dbUnified.read('packages');
  const suppliers = await dbUnified.read('suppliers');

  // Create a suppliers lookup map for O(1) access
  const suppliersMap = new Map(suppliers.map(s => [s.id, s]));

  const items = packages
    .filter(p => p.approved && isFeaturedPackage(p))
    .slice(0, 6)
    .map(pkg => {
      const supplier = suppliersMap.get(pkg.supplierId);
      return {
        ...pkg,
        supplier_name: supplier ? supplier.name : null,
      };
    });

  res.json({ items });
});

// Spotlight packages - randomly selected packages that rotate hourly
app.get('/api/packages/spotlight', async (_req, res) => {
  const packages = await dbUnified.read('packages');
  const suppliers = await dbUnified.read('suppliers');

  // Create a suppliers lookup map for O(1) access
  const suppliersMap = new Map(suppliers.map(s => [s.id, s]));

  // Get all approved packages
  const approvedPackages = packages.filter(p => p.approved);

  // Use current hour as seed for consistent selection within the hour
  const now = new Date();
  const hourSeed =
    now.getUTCFullYear() * 10000 +
    (now.getUTCMonth() + 1) * 100 +
    now.getUTCDate() * 24 +
    now.getUTCHours();

  // Shuffle packages using the hour seed for deterministic randomness
  // Using a Linear Congruential Generator (LCG) for seeded random number generation
  // Constants from Numerical Recipes (widely used and tested LCG parameters)
  const LCG_MULTIPLIER = 9301;
  const LCG_INCREMENT = 49297;
  const LCG_MODULUS = 233280;

  const shuffled = [...approvedPackages];
  let seed = hourSeed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Generate next pseudo-random number using LCG formula
    seed = (seed * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    const j = Math.floor((seed / LCG_MODULUS) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Select up to 6 spotlight packages
  const items = shuffled.slice(0, 6).map(pkg => {
    const supplier = suppliersMap.get(pkg.supplierId);
    return {
      ...pkg,
      supplier_name: supplier ? supplier.name : null,
    };
  });

  res.json({ items });
});

app.get('/api/packages/search', async (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const category = String(req.query.category || '').toLowerCase();
  const eventType = String(req.query.eventType || '').toLowerCase();
  const approved = req.query.approved === 'true';

  let items = await dbUnified.read('packages');

  // Apply filters
  items = items.filter(p => {
    // Approval filter
    if (approved && !p.approved) {
      return false;
    }

    // Text search
    if (
      q &&
      !(
        (p.title || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
      )
    ) {
      return false;
    }

    // Category filter
    if (category && p.primaryCategoryKey !== category) {
      return false;
    }

    // Event type filter
    if (eventType && p.eventTypes && !p.eventTypes.includes(eventType)) {
      return false;
    }

    return true;
  });

  res.json({ items });
});

// ---------- Category browsing endpoints ----------
app.get('/api/categories', async (_req, res) => {
  const categories = await dbUnified.read('categories');
  const sorted = categories.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ items: sorted });
});

/**
 * GET /api/public/stats
 * Public endpoint for homepage statistics
 * Returns real counts with 5-minute cache
 */
app.get('/api/public/stats', async (_req, res) => {
  try {
    // Set cache headers (5 minutes)
    res.set('Cache-Control', 'public, max-age=300');

    // Get suppliers count (approved/verified)
    const suppliers = await dbUnified.read('suppliers');
    const suppliersVerified = suppliers.filter(s => s.approved || s.verified).length;

    // Get packages count (approved)
    const packages = await dbUnified.read('packages');
    const packagesApproved = packages.filter(p => p.approved === true).length;

    // Get marketplace listings count (approved and active)
    const listings = await dbUnified.read('marketplace_listings');
    const marketplaceListingsActive = listings.filter(
      l => l.approved === true && l.status === 'active'
    ).length;

    // Get reviews count (approved)
    const reviews = await dbUnified.read('reviews');
    const reviewsApproved = reviews.filter(r => r.approved === true).length;

    res.json({
      suppliersVerified,
      packagesApproved,
      marketplaceListingsActive,
      reviewsApproved,
    });
  } catch (error) {
    logger.error('Error fetching public stats:', error);
    sentry.captureException(error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      suppliersVerified: 0,
      packagesApproved: 0,
      marketplaceListingsActive: 0,
      reviewsApproved: 0,
    });
  }
});

// Admin: Update category hero image
app.post(
  '/api/admin/categories/:id/hero-image',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  photoUpload.upload.single('image'),
  async (req, res) => {
    try {
      const categoryId = req.params.id;
      const categories = await dbUnified.read('categories');
      const categoryIndex = categories.findIndex(c => c.id === categoryId);

      if (categoryIndex === -1) {
        return res.status(404).json({ error: 'Category not found' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      logger.info(`Processing category hero image upload for category ${categoryId}`, {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });

      // Process and save the image
      const imageData = await photoUpload.processAndSaveImage(
        req.file.buffer,
        req.file.originalname,
        'supplier'
      );

      // Update category with new hero image URL
      categories[categoryIndex].heroImage = imageData.optimized || imageData.large;

      await dbUnified.write('categories', categories);

      logger.info(`Category hero image uploaded successfully for category ${categoryId}`);

      res.json({
        ok: true,
        category: categories[categoryIndex],
        imageUrl: categories[categoryIndex].heroImage,
      });
    } catch (error) {
      logger.error('Error uploading category hero image:', {
        error: error.message,
        name: error.name,
        details: error.details,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
      });

      // Handle validation errors with appropriate status codes and detailed feedback
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: error.message,
          details: error.details,
        });
      }

      // Handle Sharp processing errors
      if (error.name === 'SharpProcessingError') {
        return res.status(500).json({
          error: 'Failed to process image',
          details: 'Image processing library error. Please try a different image format or file.',
        });
      }

      // Handle MongoDB/storage errors
      if (error.name === 'MongoDBStorageError' || error.name === 'FilesystemError') {
        return res.status(500).json({
          error: 'Failed to save image',
          details: 'Storage system error. Please try again later.',
        });
      }

      // Generic error fallback
      res.status(500).json({
        error: 'Failed to upload image',
        details: error.message || 'An unexpected error occurred',
      });
    }
  }
);

// Admin: Remove category hero image
app.delete(
  '/api/admin/categories/:id/hero-image',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const categoryId = req.params.id;
      const categories = await dbUnified.read('categories');
      const categoryIndex = categories.findIndex(c => c.id === categoryId);

      if (categoryIndex === -1) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const oldImageUrl = categories[categoryIndex].heroImage;

      // Remove the hero image URL
      delete categories[categoryIndex].heroImage;

      await dbUnified.write('categories', categories);

      // Optionally delete the old image file if it exists
      if (oldImageUrl && typeof oldImageUrl === 'string' && oldImageUrl.trim() !== '') {
        try {
          await photoUpload.deleteImage(oldImageUrl);
        } catch (deleteErr) {
          // Ignore delete errors - the URL is already removed from the category
          console.warn('Failed to delete old image file:', deleteErr);
        }
      }

      res.json({
        ok: true,
        category: categories[categoryIndex],
      });
    } catch (error) {
      console.error('Error removing category hero image:', error);
      res.status(500).json({ error: 'Failed to remove image', details: error.message });
    }
  }
);

// Admin: Upload package image
app.post(
  '/api/admin/packages/:id/image',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  photoUpload.upload.single('image'),
  async (req, res) => {
    try {
      const packageId = req.params.id;
      const packages = await dbUnified.read('packages');
      const packageIndex = packages.findIndex(p => p.id === packageId);

      if (packageIndex === -1) {
        return res.status(404).json({ error: 'Package not found' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      logger.info(`Processing package image upload for package ${packageId}`, {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });

      // Process and save the image
      const imageData = await photoUpload.processAndSaveImage(
        req.file.buffer,
        req.file.originalname,
        'supplier'
      );

      // Update package with new image URL
      packages[packageIndex].image = imageData.optimized || imageData.large;
      packages[packageIndex].updatedAt = new Date().toISOString();

      await dbUnified.write('packages', packages);

      logger.info(`Package image uploaded successfully for package ${packageId}`);

      res.json({
        ok: true,
        package: packages[packageIndex],
        imageUrl: packages[packageIndex].image,
      });
    } catch (error) {
      logger.error('Error uploading package image:', {
        error: error.message,
        name: error.name,
        details: error.details,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
      });

      // Handle validation errors with appropriate status codes and detailed feedback
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: error.message,
          details: error.details,
        });
      }

      // Handle Sharp processing errors
      if (error.name === 'SharpProcessingError') {
        return res.status(500).json({
          error: 'Failed to process image',
          details: 'Image processing library error. Please try a different image format or file.',
        });
      }

      // Handle MongoDB/storage errors
      if (error.name === 'MongoDBStorageError' || error.name === 'FilesystemError') {
        return res.status(500).json({
          error: 'Failed to save image',
          details: 'Storage system error. Please try again later.',
        });
      }

      // Generic error fallback
      res.status(500).json({
        error: 'Failed to upload image',
        details: error.message || 'An unexpected error occurred',
      });
    }
  }
);

app.get('/api/categories/:slug', async (req, res) => {
  const categories = await dbUnified.read('categories');
  const category = categories.find(c => c.slug === req.params.slug);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  // Get all approved packages in this category
  const allPackages = await dbUnified.read('packages');
  const categoryPackages = allPackages.filter(p => {
    if (!p.approved) {
      return false;
    }
    if (!p.categories || !Array.isArray(p.categories)) {
      return false;
    }
    return p.categories.includes(req.params.slug);
  });

  // Sort: featured packages first
  const sorted = categoryPackages.sort((a, b) => {
    const aFeatured = isFeaturedPackage(a);
    const bFeatured = isFeaturedPackage(b);
    if (aFeatured && !bFeatured) {
      return -1;
    }
    if (!aFeatured && bFeatured) {
      return 1;
    }
    return 0;
  });

  res.json({ category, packages: sorted });
});

app.get('/api/packages/:slug', async (req, res) => {
  const packages = await dbUnified.read('packages');
  const pkg = packages.find(p => p.slug === req.params.slug && p.approved);

  if (!pkg) {
    return res.status(404).json({ error: 'Package not found' });
  }

  // Get supplier details
  const suppliers = await dbUnified.read('suppliers');
  const supplier = suppliers.find(s => s.id === pkg.supplierId && s.approved);

  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  // Get category details
  const categories = await dbUnified.read('categories');
  const packageCategories = (pkg.categories || [])
    .map(slug => categories.find(c => c.slug === slug))
    .filter(Boolean);

  res.json({
    package: pkg,
    supplier,
    categories: packageCategories,
  });
});

// ---------- Supplier dashboard ----------
app.get('/api/me/suppliers', authRequired, roleRequired('supplier'), async (req, res) => {
  const listRaw = (await dbUnified.read('suppliers')).filter(s => s.ownerUserId === req.user.id);
  const list = listRaw.map(s => ({
    ...s,
    isPro: supplierIsProActive(s),
    proExpiresAt: s.proExpiresAt || null,
  }));
  res.json({ items: list });
});

/**
 * GET /api/me/suppliers/:id/analytics
 * Get analytics data for a supplier using real event tracking
 */
app.get(
  '/api/me/suppliers/:id/analytics',
  authRequired,
  roleRequired('supplier'),
  async (req, res) => {
    try {
      const supplierId = req.params.id;
      const period = parseInt(req.query.period) || 7; // Default 7 days

      // Verify ownership
      const suppliers = await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.id === supplierId && s.ownerUserId === req.user.id);
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      // Get analytics from the supplier analytics utility
      const supplierAnalytics = require('./utils/supplierAnalytics');
      const analytics = await supplierAnalytics.getSupplierAnalytics(supplierId, period);

      // Format response to match expected structure
      const labels = analytics.dailyData.map(d => d.label);
      const views = analytics.dailyData.map(d => d.views);
      const enquiries = analytics.dailyData.map(d => d.enquiries);

      res.json({
        period: analytics.period,
        labels,
        views,
        enquiries,
        totalViews: analytics.totalViews,
        totalEnquiries: analytics.totalEnquiries,
        responseRate: analytics.responseRate,
        avgResponseTime: analytics.avgResponseTime,
      });
    } catch (error) {
      console.error('Error fetching supplier analytics:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  }
);

/**
 * POST /api/admin/badges/evaluate
 * Evaluate and award badges to all suppliers
 */
app.post(
  '/api/admin/badges/evaluate',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const badgeManagement = require('./utils/badgeManagement');
      const results = await badgeManagement.evaluateAllSupplierBadges();
      res.json({
        success: true,
        message: 'Badge evaluation completed',
        results,
      });
    } catch (error) {
      console.error('Error evaluating badges:', error);
      res.status(500).json({ error: 'Failed to evaluate badges' });
    }
  }
);

/**
 * POST /api/admin/badges/init
 * Initialize default badges in the database
 */
app.post(
  '/api/admin/badges/init',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const badgeManagement = require('./utils/badgeManagement');
      await badgeManagement.initializeDefaultBadges();
      res.json({
        success: true,
        message: 'Default badges initialized',
      });
    } catch (error) {
      console.error('Error initializing badges:', error);
      res.status(500).json({ error: 'Failed to initialize badges' });
    }
  }
);

/**
 * POST /api/me/suppliers/:id/badges/evaluate
 * Evaluate and award badges to a specific supplier
 */
app.post(
  '/api/me/suppliers/:id/badges/evaluate',
  authRequired,
  roleRequired('supplier'),
  async (req, res) => {
    try {
      const supplierId = req.params.id;

      // Verify ownership
      const suppliers = await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.id === supplierId && s.ownerUserId === req.user.id);
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      const badgeManagement = require('./utils/badgeManagement');
      const results = await badgeManagement.evaluateSupplierBadges(supplierId);

      res.json({
        success: true,
        message: 'Badge evaluation completed',
        results,
      });
    } catch (error) {
      console.error('Error evaluating supplier badges:', error);
      res.status(500).json({ error: 'Failed to evaluate badges' });
    }
  }
);

// Mark all suppliers owned by the current user as Pro
app.post(
  '/api/me/subscription/upgrade',
  authRequired,
  roleRequired('supplier'),
  csrfProtection,
  async (req, res) => {
    const suppliers = await dbUnified.read('suppliers');
    let changed = 0;
    suppliers.forEach(s => {
      if (s.ownerUserId === req.user.id) {
        if (!s.isPro) {
          s.isPro = true;
          changed += 1;
        }
      }
    });
    await dbUnified.write('suppliers', suppliers);

    // Optionally also mirror this onto the user record if present
    try {
      const users = await dbUnified.read('users');
      const u = users.find(u => u.id === req.user.id);
      if (u) {
        u.isPro = true;
        await dbUnified.write('users', users);
      }
    } catch (_e) {
      // ignore if users store is not present
    }

    res.json({ ok: true, updatedSuppliers: changed });
  }
);

app.post(
  '/api/me/suppliers',
  writeLimiter,
  authRequired,
  roleRequired('supplier'),
  csrfProtection,
  async (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.category) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // For Venues category, validate and require venuePostcode
    if (b.category === 'Venues') {
      if (!b.venuePostcode) {
        return res.status(400).json({
          error: 'Venue postcode is required for suppliers in the Venues category',
        });
      }
      if (!geocoding.isValidUKPostcode(b.venuePostcode)) {
        return res.status(400).json({
          error: 'Invalid UK postcode format',
        });
      }
    }

    const photos = (
      b.photos ? (Array.isArray(b.photos) ? b.photos : String(b.photos).split(/\r?\n/)) : []
    )
      .map(x => String(x).trim())
      .filter(Boolean);

    const amenities = (b.amenities ? String(b.amenities).split(',') : [])
      .map(x => x.trim())
      .filter(Boolean);

    const s = {
      id: uid('sup'),
      ownerUserId: req.user.id,
      name: String(b.name).slice(0, 120),
      category: b.category,
      location: String(b.location || '').slice(0, 120),
      price_display: String(b.price_display || '').slice(0, 60),
      website: String(b.website || '').slice(0, 200),
      license: String(b.license || '').slice(0, 120),
      amenities,
      maxGuests: parseInt(b.maxGuests || 0, 10),
      description_short: String(b.description_short || '').slice(0, 220),
      description_long: String(b.description_long || '').slice(0, 2000),
      photos: photos.length ? photos : [],
      email: ((await dbUnified.read('users')).find(u => u.id === req.user.id) || {}).email || '',
      approved: false,
    };

    // Add venue-specific fields if category is Venues
    if (b.category === 'Venues' && b.venuePostcode) {
      s.venuePostcode = String(b.venuePostcode).trim().toUpperCase();

      // Geocode the postcode to get coordinates
      try {
        const coords = await geocoding.geocodePostcode(s.venuePostcode);
        if (coords) {
          s.latitude = coords.latitude;
          s.longitude = coords.longitude;
          s.venuePostcode = coords.postcode; // Use normalized postcode from API
          console.log(`✅ Geocoded venue ${s.name}: ${coords.latitude}, ${coords.longitude}`);
        } else {
          console.warn(`⚠️ Could not geocode postcode ${s.venuePostcode} for venue ${s.name}`);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        // Continue without coordinates - validation already passed
      }
    }

    const all = await dbUnified.read('suppliers');
    all.push(s);
    await dbUnified.write('suppliers', all);
    res.json({ ok: true, supplier: s });
  }
);

app.patch(
  '/api/me/suppliers/:id',
  writeLimiter,
  authRequired,
  roleRequired('supplier'),
  csrfProtection,
  async (req, res) => {
    const all = await dbUnified.read('suppliers');
    const i = all.findIndex(s => s.id === req.params.id && s.ownerUserId === req.user.id);
    if (i < 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    const b = req.body || {};

    // If updating a Venues category supplier with venuePostcode
    if (b.venuePostcode && all[i].category === 'Venues') {
      if (!geocoding.isValidUKPostcode(b.venuePostcode)) {
        return res.status(400).json({
          error: 'Invalid UK postcode format',
        });
      }

      // Update postcode and geocode
      all[i].venuePostcode = String(b.venuePostcode).trim().toUpperCase();

      try {
        const coords = await geocoding.geocodePostcode(all[i].venuePostcode);
        if (coords) {
          all[i].latitude = coords.latitude;
          all[i].longitude = coords.longitude;
          all[i].venuePostcode = coords.postcode;
          console.log(`✅ Geocoded venue ${all[i].name}: ${coords.latitude}, ${coords.longitude}`);
        } else {
          console.warn(`⚠️ Could not geocode postcode ${all[i].venuePostcode}`);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    }

    const fields = [
      'name',
      'category',
      'location',
      'price_display',
      'website',
      'license',
      'description_short',
      'description_long',
      'bannerUrl',
      'tagline',
    ];
    for (const k of fields) {
      if (typeof b[k] === 'string') {
        all[i][k] = b[k];
      }
    }

    // Validate and set theme color (must be valid hex color)
    if (b.themeColor && typeof b.themeColor === 'string') {
      const hexColorRegex = /^#[0-9A-F]{6}$/i;
      if (hexColorRegex.test(b.themeColor.trim())) {
        all[i].themeColor = b.themeColor.trim();
      }
    }

    // Handle array fields
    if (b.amenities) {
      all[i].amenities = String(b.amenities)
        .split(',')
        .map(x => x.trim())
        .filter(Boolean);
    }

    if (b.highlights && Array.isArray(b.highlights)) {
      all[i].highlights = b.highlights
        .map(x => String(x).trim())
        .filter(Boolean)
        .slice(0, 5); // Limit to 5 highlights
    }

    if (b.featuredServices && Array.isArray(b.featuredServices)) {
      all[i].featuredServices = b.featuredServices
        .map(x => String(x).trim())
        .filter(Boolean)
        .slice(0, 10); // Limit to 10 services
    }

    // Handle social links with validation
    if (b.socialLinks && typeof b.socialLinks === 'object') {
      all[i].socialLinks = {};
      const allowedPlatforms = [
        'facebook',
        'instagram',
        'twitter',
        'linkedin',
        'youtube',
        'tiktok',
      ];
      for (const platform of allowedPlatforms) {
        if (b.socialLinks[platform] && typeof b.socialLinks[platform] === 'string') {
          const url = b.socialLinks[platform].trim();
          // Robust URL validation using URL constructor
          try {
            const parsedUrl = new URL(url);
            // Only allow http and https protocols
            if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
              // Use the parsed URL to prevent XSS
              all[i].socialLinks[platform] = parsedUrl.href;
            }
          } catch (err) {
            // Invalid URL, skip it
            console.warn(`Invalid social link URL for ${platform}: ${url}`);
          }
        }
      }
    }

    // eslint-disable-next-line eqeqeq
    if (b.maxGuests != null) {
      all[i].maxGuests = parseInt(b.maxGuests, 10) || 0;
    }
    if (b.photos) {
      const photos = (Array.isArray(b.photos) ? b.photos : String(b.photos).split(/\r?\n/))
        .map(x => String(x).trim())
        .filter(Boolean);
      if (photos.length) {
        all[i].photos = photos;
      }
    }
    all[i].approved = false;
    await dbUnified.write('suppliers', all);
    res.json({ ok: true, supplier: all[i] });
  }
);

app.get('/api/me/packages', authRequired, roleRequired('supplier'), async (req, res) => {
  const mine = (await dbUnified.read('suppliers'))
    .filter(s => s.ownerUserId === req.user.id)
    .map(s => s.id);
  const items = (await dbUnified.read('packages')).filter(p => mine.includes(p.supplierId));
  res.json({ items });
});

app.post(
  '/api/me/packages',
  writeLimiter,
  authRequired,
  roleRequired('supplier'),
  csrfProtection,
  async (req, res) => {
    const { supplierId, title, description, price, image, primaryCategoryKey, eventTypes } =
      req.body || {};
    if (!supplierId || !title) {
      return res.status(400).json({ error: 'Missing required fields: supplierId and title' });
    }

    // Validate new required fields for wizard compatibility
    if (!primaryCategoryKey) {
      return res.status(400).json({ error: 'Primary category is required' });
    }

    if (!eventTypes || !Array.isArray(eventTypes) || eventTypes.length === 0) {
      return res
        .status(400)
        .json({ error: 'At least one event type is required (wedding or other)' });
    }

    // Validate event types
    const validEventTypes = eventTypes.filter(t => t === 'wedding' || t === 'other');
    if (validEventTypes.length === 0) {
      return res.status(400).json({ error: 'Event types must be "wedding" or "other"' });
    }

    const own = (await dbUnified.read('suppliers')).find(
      s => s.id === supplierId && s.ownerUserId === req.user.id
    );
    if (!own) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const ownIsPro = supplierIsProActive(own);

    // Enforce a simple Free vs Pro package limit:
    // - Free suppliers can create up to FREE_PACKAGE_LIMIT packages (default 3)
    // - Pro suppliers have no limit
    const allPkgs = await dbUnified.read('packages');
    const existingForSupplier = allPkgs.filter(p => p.supplierId === supplierId);
    const freeLimit = Number(process.env.FREE_PACKAGE_LIMIT || 3);
    if (!ownIsPro && existingForSupplier.length >= freeLimit) {
      return res.status(403).json({
        error: `Free suppliers can create up to ${freeLimit} packages. Upgrade to Pro to add more.`,
      });
    }

    const pkg = {
      id: uid('pkg'),
      supplierId,
      title: String(title).slice(0, 120),
      description: String(description || '').slice(0, 1500),
      price: String(price || '').slice(0, 60),
      image: image || '',
      primaryCategoryKey: String(primaryCategoryKey),
      eventTypes: validEventTypes,
      approved: false,
      featured: false,
      createdAt: new Date().toISOString(),
    };
    const all = allPkgs;
    all.push(pkg);
    await dbUnified.write('packages', all);
    res.json({ ok: true, package: pkg });
  }
);
// ---------- CAPTCHA Verification ----------
app.post('/api/verify-captcha', writeLimiter, async (req, res) => {
  const { token } = req.body || {};
  const result = await verifyHCaptcha(token);

  if (result.success) {
    return res.json(result);
  } else {
    const statusCode = result.error === 'CAPTCHA verification not configured' ? 500 : 400;
    return res.status(statusCode).json(result);
  }
});

// ---------- Threads & Messages ----------
app.post('/api/threads/start', writeLimiter, authRequired, csrfProtection, async (req, res) => {
  const {
    supplierId,
    packageId,
    message,
    eventType,
    eventDate,
    location,
    guests,
    budget,
    postcode,
    phone,
    timeOnPage,
    referrer,
    deviceType,
    captchaToken,
  } = req.body || {};
  if (!supplierId) {
    return res.status(400).json({ error: 'Missing supplierId' });
  }
  const supplier = (await dbUnified.read('suppliers')).find(s => s.id === supplierId && s.approved);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  // Verify CAPTCHA if token provided (optional in development)
  let captchaPassed = true;
  if (captchaToken) {
    const result = await verifyHCaptcha(captchaToken);
    captchaPassed = result.success;
    if (!captchaPassed) {
      // Don't block on CAPTCHA error in development
      if (
        process.env.NODE_ENV === 'production' ||
        result.error !== 'CAPTCHA verification not configured'
      ) {
        return res.status(400).json({ error: result.error || 'CAPTCHA verification failed' });
      }
      // In development without CAPTCHA configured, allow through
      captchaPassed = true;
    }
  }

  // Calculate lead score
  const leadScoreResult = calculateLeadScore({
    eventDate,
    email: req.user.email,
    phone,
    budget,
    guestCount: guests,
    postcode,
    message,
    timeOnPage,
    referrer,
    deviceType,
    captchaPassed,
  });

  const threads = await dbUnified.read('threads');
  let thread = threads.find(t => t.supplierId === supplierId && t.customerId === req.user.id);
  if (!thread) {
    thread = {
      id: uid('thd'),
      supplierId,
      supplierName: supplier.name,
      customerId: req.user.id,
      packageId: packageId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventType: eventType || null,
      eventDate: eventDate || null,
      eventLocation: location || null,
      guests: guests || null,
      budget: budget || null,
      postcode: postcode || null,
      // Lead scoring fields
      leadScore: leadScoreResult.rating,
      leadScoreRaw: leadScoreResult.score,
      leadScoreFlags: leadScoreResult.flags,
      validationFlags: {
        captchaPassed: true,
        emailVerified: req.user.verified || false,
        phoneFormat: leadScoreResult.breakdown.contactScore > 0,
        suspiciousActivity: leadScoreResult.flags.includes('repeat-enquirer'),
      },
      metadata: {
        timeOnPage: timeOnPage || null,
        referrer: referrer || null,
        deviceType: deviceType || null,
      },
    };
    threads.push(thread);
    await dbUnified.write('threads', threads);
  }

  // If an initial message was included, create it immediately
  if (message && String(message).trim()) {
    const msgs = await dbUnified.read('messages');
    const entry = {
      id: uid('msg'),
      threadId: thread.id,
      fromUserId: req.user.id,
      text: String(message).slice(0, 4000),
      packageId: packageId || null,
      supplierId: supplierId || null,
      status: 'sent',
      createdAt: new Date().toISOString(),
    };
    msgs.push(entry);
    await dbUnified.write('messages', msgs);

    // Update thread timestamp
    const allThreads = await dbUnified.read('threads');
    const idx = allThreads.findIndex(t => t.id === thread.id);
    if (idx >= 0) {
      allThreads[idx].updatedAt = entry.createdAt;
      await dbUnified.write('threads', allThreads);
    }
  }

  // Email notify supplier (safe IIFE)
  (async () => {
    try {
      const customer = (await dbUnified.read('users')).find(u => u.id === req.user.id);
      if (supplier.email && customer && customer.notify !== false) {
        await sendMail(
          supplier.email,
          'New enquiry on EventFlow',
          `A customer started a conversation about ${supplier.name}.`
        );
      }
    } catch (e) {
      // dev-safe
    }
  })();

  res.json({ ok: true, thread });
});

app.get('/api/threads/my', authRequired, async (req, res) => {
  const ts = await dbUnified.read('threads');
  let items = [];
  if (req.user.role === 'customer') {
    items = ts.filter(t => t.customerId === req.user.id);
  } else if (req.user.role === 'supplier') {
    const mine = (await dbUnified.read('suppliers'))
      .filter(s => s.ownerUserId === req.user.id)
      .map(s => s.id);
    items = ts.filter(t => mine.includes(t.supplierId));
  } else if (req.user.role === 'admin') {
    items = ts;
  }
  const msgs = await dbUnified.read('messages');
  items = items.map(t => ({
    ...t,
    last:
      msgs
        .filter(m => m.threadId === t.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null,
  }));
  res.json({ items });
});

app.get('/api/threads/:id/messages', authRequired, async (req, res) => {
  const t = (await dbUnified.read('threads')).find(x => x.id === req.params.id);
  if (!t) {
    return res.status(404).json({ error: 'Thread not found' });
  }
  if (req.user.role !== 'admin' && t.customerId !== req.user.id) {
    const own = (await dbUnified.read('suppliers')).find(
      s => s.id === t.supplierId && s.ownerUserId === req.user.id
    );
    if (!own) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const msgs = (await dbUnified.read('messages'))
    .filter(m => m.threadId === t.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json({ items: msgs });
});

app.post(
  '/api/threads/:id/messages',
  writeLimiter,
  authRequired,
  csrfProtection,
  async (req, res) => {
    const { text, packageId } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }
    const t = (await dbUnified.read('threads')).find(x => x.id === req.params.id);
    if (!t) {
      return res.status(404).json({ error: 'Thread not found' });
    }
    if (req.user.role !== 'admin' && t.customerId !== req.user.id) {
      const own = (await dbUnified.read('suppliers')).find(
        s => s.id === t.supplierId && s.ownerUserId === req.user.id
      );
      if (!own) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const msgs = await dbUnified.read('messages');
    const entry = {
      id: uid('msg'),
      threadId: t.id,
      fromUserId: req.user.id,
      fromRole: req.user.role,
      text: String(text).slice(0, 4000),
      packageId: packageId || t.packageId || null,
      supplierId: t.supplierId || null,
      status: 'sent',
      createdAt: new Date().toISOString(),
    };
    msgs.push(entry);
    await dbUnified.write('messages', msgs);

    // Update thread timestamp
    const th = await dbUnified.read('threads');
    const i = th.findIndex(x => x.id === t.id);
    if (i >= 0) {
      th[i].updatedAt = entry.createdAt;
      await dbUnified.write('threads', th);
    }

    // Email notify other party (safe IIFE)
    (async () => {
      try {
        const otherEmail =
          req.user.role === 'customer'
            ? ((await dbUnified.read('suppliers')).find(s => s.id === t.supplierId) || {}).email ||
              null
            : ((await dbUnified.read('users')).find(u => u.id === t.customerId) || {}).email ||
              null;
        const me = (await dbUnified.read('users')).find(u => u.id === req.user.id);
        if (otherEmail && me && me.notify !== false) {
          await sendMail(
            otherEmail,
            'New message on EventFlow',
            `You have a new message in a conversation.\n\n${entry.text.slice(0, 500)}`
          );
        }
      } catch (e) {
        // dev-safe
      }
    })();

    res.json({ ok: true, message: entry });
  }
);

// ---------- Marketplace Listings ----------
// Get all marketplace listings (public)
app.get('/api/marketplace/listings', async (req, res) => {
  try {
    const { category, condition, minPrice, maxPrice, search, sort, limit } = req.query;
    let listings = await dbUnified.read('marketplace_listings');

    // Filter by approved and active status
    listings = listings.filter(l => l.approved && l.status === 'active');

    // Apply filters
    if (category) {
      listings = listings.filter(l => l.category === category);
    }
    if (condition) {
      listings = listings.filter(l => l.condition === condition);
    }
    if (minPrice) {
      listings = listings.filter(l => l.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      listings = listings.filter(l => l.price <= parseFloat(maxPrice));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      listings = listings.filter(
        l =>
          l.title.toLowerCase().includes(searchLower) ||
          l.description.toLowerCase().includes(searchLower)
      );
    }

    // Sort listings
    if (sort === 'price-low') {
      listings.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-high') {
      listings.sort((a, b) => b.price - a.price);
    } else {
      // Default: most recent
      listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Apply limit parameter (default 12, cap at 24)
    let resultLimit = 12; // default
    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        resultLimit = Math.min(parsedLimit, 24); // cap at 24
      }
    }
    listings = listings.slice(0, resultLimit);

    logger.info('Marketplace listings fetched', {
      count: listings.length,
      filters: { category, condition, minPrice, maxPrice, search, sort, limit: resultLimit },
    });

    res.json({ listings });
  } catch (error) {
    logger.error('Error fetching marketplace listings:', error);
    sentry.captureException(error);
    res.status(500).json({
      error: 'Failed to fetch marketplace listings',
      message: 'Unable to load listings at this time. Please try again later.',
    });
  }
});

// Get single marketplace listing (public)
app.get('/api/marketplace/listings/:id', async (req, res) => {
  try {
    const listings = await dbUnified.read('marketplace_listings');
    const listing = listings.find(l => l.id === req.params.id);

    if (!listing) {
      logger.warn('Marketplace listing not found', { listingId: req.params.id });
      return res.status(404).json({
        error: 'Listing not found',
        message: 'This listing does not exist or has been removed.',
      });
    }

    if (!listing.approved || listing.status !== 'active') {
      logger.warn('Marketplace listing not available', {
        listingId: req.params.id,
        approved: listing.approved,
        status: listing.status,
      });
      return res.status(404).json({
        error: 'Listing not available',
        message: 'This listing is not currently available for viewing.',
      });
    }

    logger.info('Marketplace listing fetched', { listingId: req.params.id });
    res.json({ listing });
  } catch (error) {
    logger.error('Error fetching marketplace listing:', error);
    sentry.captureException(error);
    res.status(500).json({
      error: 'Failed to fetch listing',
      message: 'Unable to load this listing. Please try again later.',
    });
  }
});

/**
 * GET /api/marketplace/my-listings/:id
 * Get a single listing owned by the authenticated user (including pending/unapproved)
 */
app.get('/api/marketplace/my-listings/:id', authRequired, async (req, res) => {
  try {
    const listings = await dbUnified.read('marketplace_listings');
    const listing = listings.find(l => l.id === req.params.id);

    if (!listing) {
      logger.warn('Marketplace listing not found', { listingId: req.params.id });
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Must be owner or admin
    if (listing.userId !== req.user.id && req.user.role !== 'admin') {
      logger.warn('Unauthorized access to listing', {
        listingId: req.params.id,
        userId: req.user.id,
        ownerId: listing.userId,
      });
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Return regardless of approval/status
    logger.info('Marketplace listing fetched for edit', {
      listingId: req.params.id,
      userId: req.user.id,
    });
    res.json({ listing });
  } catch (error) {
    logger.error('Error fetching user listing:', error);
    sentry.captureException(error);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// Create marketplace listing (auth required)
app.post(
  '/api/marketplace/listings',
  writeLimiter,
  authRequired,
  csrfProtection,
  async (req, res) => {
    try {
      const { title, description, price, category, condition, location, images } = req.body || {};

      // Validation with detailed messages - check for undefined, null, or empty string (allow 0)
      if (
        !title ||
        !description ||
        price === undefined ||
        price === null ||
        price === '' ||
        !category ||
        !condition
      ) {
        logger.warn('Marketplace listing creation failed - missing fields', {
          userId: req.user.id,
          provided: {
            title: !!title,
            description: !!description,
            price: price !== undefined && price !== null && price !== '',
            category: !!category,
            condition: !!condition,
          },
        });
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Please provide title, description, price, category, and condition.',
        });
      }

      if (title.length > 100) {
        return res.status(400).json({
          error: 'Title too long',
          message: 'Title must be 100 characters or less.',
        });
      }

      if (description.length > 1000) {
        return res.status(400).json({
          error: 'Description too long',
          message: 'Description must be 1000 characters or less.',
        });
      }

      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({
          error: 'Invalid price',
          message: 'Please enter a valid price (must be a positive number).',
        });
      }

      const validCategories = [
        'attire',
        'decor',
        'av-equipment',
        'photography',
        'party-supplies',
        'florals',
      ];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: 'Invalid category',
          message: 'Please select a valid category from the list.',
        });
      }

      const validConditions = ['new', 'like-new', 'good', 'fair'];
      if (!validConditions.includes(condition)) {
        return res.status(400).json({
          error: 'Invalid condition',
          message: 'Please select a valid condition from the list.',
        });
      }

      const listing = {
        id: uid('mkt'),
        userId: req.user.id,
        title: String(title).slice(0, 100),
        description: String(description).slice(0, 1000),
        price: priceNum,
        category,
        condition,
        location: location ? String(location).slice(0, 100) : '',
        images: Array.isArray(images) ? images.slice(0, 5) : [],
        approved: false, // Requires admin approval
        status: 'pending', // pending, active, sold, removed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const listings = await dbUnified.read('marketplace_listings');
      listings.push(listing);
      await dbUnified.write('marketplace_listings', listings);

      logger.info('Marketplace listing created', {
        listingId: listing.id,
        userId: req.user.id,
        category: listing.category,
      });

      res.json({
        ok: true,
        listing,
        message: 'Listing submitted successfully! It will be reviewed by our team.',
      });
    } catch (error) {
      logger.error('Error creating marketplace listing:', error);
      sentry.captureException(error);
      res.status(500).json({
        error: 'Failed to create listing',
        message: 'Unable to create your listing at this time. Please try again later.',
      });
    }
  }
);

// Get user's own marketplace listings
app.get('/api/marketplace/my-listings', authRequired, async (req, res) => {
  try {
    logger.info('Fetching marketplace listings', {
      userId: req.user.id,
      userRole: req.user.role,
      endpoint: '/api/marketplace/my-listings',
    });

    const listings = await dbUnified.read('marketplace_listings');
    const myListings = listings.filter(l => l.userId === req.user.id);

    logger.info('Marketplace listings retrieved', {
      userId: req.user.id,
      count: myListings.length,
    });

    res.json({ listings: myListings });
  } catch (error) {
    logger.error('Error fetching user listings', {
      userId: req.user ? req.user.id : 'unknown',
      error: error.message,
      stack: error.stack,
    });
    sentry.captureException(error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// Update marketplace listing (owner only)
app.put(
  '/api/marketplace/listings/:id',
  writeLimiter,
  authRequired,
  csrfProtection,
  async (req, res) => {
    try {
      const listings = await dbUnified.read('marketplace_listings');
      const listing = listings.find(l => l.id === req.params.id);

      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      if (listing.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const { title, description, price, condition, location, status } = req.body || {};

      if (title) {
        listing.title = String(title).slice(0, 100);
      }
      if (description) {
        listing.description = String(description).slice(0, 1000);
      }
      if (price !== undefined) {
        const priceNum = parseFloat(price);
        if (!isNaN(priceNum) && priceNum >= 0) {
          listing.price = priceNum;
        }
      }
      if (condition) {
        listing.condition = condition;
      }
      if (location) {
        listing.location = String(location).slice(0, 100);
      }
      if (status && ['active', 'sold', 'removed'].includes(status)) {
        listing.status = status;
      }

      listing.updatedAt = new Date().toISOString();

      await dbUnified.write('marketplace_listings', listings);
      res.json({ ok: true, listing });
    } catch (error) {
      console.error('Error updating marketplace listing:', error);
      sentry.captureException(error);
      res.status(500).json({ error: 'Failed to update listing' });
    }
  }
);

// Delete marketplace listing (owner only)
app.delete(
  '/api/marketplace/listings/:id',
  writeLimiter,
  authRequired,
  csrfProtection,
  async (req, res) => {
    try {
      let listings = await dbUnified.read('marketplace_listings');
      const listing = listings.find(l => l.id === req.params.id);

      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      if (listing.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized' });
      }

      listings = listings.filter(l => l.id !== req.params.id);
      await dbUnified.write('marketplace_listings', listings);

      res.json({ ok: true });
    } catch (error) {
      console.error('Error deleting marketplace listing:', error);
      sentry.captureException(error);
      res.status(500).json({ error: 'Failed to delete listing' });
    }
  }
);

// ---------- Plan & Notes (customer) ----------
app.get('/api/plan', authRequired, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const plans = (await dbUnified.read('plans')).filter(p => p.userId === req.user.id);
  const suppliers = (await dbUnified.read('suppliers')).filter(s => s.approved);
  const items = plans.map(p => suppliers.find(s => s.id === p.supplierId)).filter(Boolean);
  res.json({ items });
});

app.post('/api/plan', authRequired, csrfProtection, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const { supplierId } = req.body || {};
  if (!supplierId) {
    return res.status(400).json({ error: 'Missing supplierId' });
  }
  const s = (await dbUnified.read('suppliers')).find(x => x.id === supplierId && x.approved);
  if (!s) {
    return res.status(404).json({ error: 'Supplier not found' });
  }
  const all = await dbUnified.read('plans');
  if (!all.find(p => p.userId === req.user.id && p.supplierId === supplierId)) {
    all.push({
      id: uid('pln'),
      userId: req.user.id,
      supplierId,
      createdAt: new Date().toISOString(),
    });
  }
  await dbUnified.write('plans', all);
  res.json({ ok: true });
});

app.delete('/api/plan/:supplierId', authRequired, csrfProtection, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const all = (await dbUnified.read('plans')).filter(
    p => !(p.userId === req.user.id && p.supplierId === req.params.supplierId)
  );
  await dbUnified.write('plans', all);
  res.json({ ok: true });
});

app.get('/api/notes', authRequired, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const n = (await dbUnified.read('notes')).find(x => x.userId === req.user.id);
  res.json({ text: (n && n.text) || '' });
});

app.post('/api/notes', authRequired, csrfProtection, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const all = await dbUnified.read('notes');
  const i = all.findIndex(x => x.userId === req.user.id);
  if (i >= 0) {
    all[i].text = String((req.body && req.body.text) || '');
    all[i].updatedAt = new Date().toISOString();
  } else {
    all.push({
      id: uid('nte'),
      userId: req.user.id,
      text: String((req.body && req.body.text) || ''),
      createdAt: new Date().toISOString(),
    });
  }
  await dbUnified.write('notes', all);
  res.json({ ok: true });
});

// ---------- Settings ----------
app.get('/api/me/settings', authRequired, async (req, res) => {
  const users = await dbUnified.read('users');
  const i = users.findIndex(u => u.id === req.user.id);
  if (i < 0) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ notify: users[i].notify !== false });
});

app.post('/api/me/settings', authRequired, csrfProtection, async (req, res) => {
  const users = await dbUnified.read('users');
  const i = users.findIndex(u => u.id === req.user.id);
  if (i < 0) {
    return res.status(404).json({ error: 'Not found' });
  }
  users[i].notify = !!(req.body && req.body.notify);
  await dbUnified.write('users', users);
  res.json({ ok: true, notify: users[i].notify });
});

// ---------- Meta & status ----------
// Meta endpoint moved to routes/system.js

// Lightweight metrics endpoints (no-op by default)
app.post('/api/metrics/track', csrfProtection, async (req, res) => {
  // In a real deployment you could log req.body here.
  res.json({ ok: true });
});

// Simple synthetic timeseries for admin charts
app.get('/api/admin/metrics/timeseries', authRequired, roleRequired('admin'), async (_req, res) => {
  const today = new Date();
  const days = 14;
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    series.push({
      date: iso,
      visitors: 20 + ((i * 7) % 15),
      signups: 3 + (i % 4),
      plans: 1 + (i % 3),
    });
  }
  res.json({ series });
});

// ---------- Admin ----------
app.get('/api/admin/metrics', authRequired, roleRequired('admin'), async (_req, res) => {
  const users = await dbUnified.read('users');
  const suppliers = await dbUnified.read('suppliers');
  const plans = await dbUnified.read('plans');
  const msgs = await dbUnified.read('messages');
  const pkgs = await dbUnified.read('packages');
  const threads = await dbUnified.read('threads');
  res.json({
    counts: {
      usersTotal: users.length,
      usersByRole: users.reduce((a, u) => {
        a[u.role] = (a[u.role] || 0) + 1;
        return a;
      }, {}),
      suppliersTotal: suppliers.length,
      packagesTotal: pkgs.length,
      plansTotal: plans.length,
      messagesTotal: msgs.length,
      threadsTotal: threads.length,
    },
  });
});

app.post(
  '/api/admin/reset-demo',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      // Clear key collections and rerun seeding
      const collections = [
        'users',
        'suppliers',
        'packages',
        'plans',
        'notes',
        'messages',
        'threads',
        'events',
      ];
      for (const name of collections) {
        await dbUnified.write(name, []);
      }
      await seed();
      res.json({ ok: true });
    } catch (err) {
      console.error('Reset demo failed', err);
      res.status(500).json({ error: 'Reset demo failed' });
    }
  }
);

app.get('/api/admin/suppliers', authRequired, roleRequired('admin'), async (_req, res) => {
  const raw = await dbUnified.read('suppliers');
  const items = raw.map(s => ({
    ...s,
    isPro: supplierIsProActive(s),
    proExpiresAt: s.proExpiresAt || null,
  }));
  res.json({ items });
});

/**
 * GET /api/admin/suppliers/pending-verification
 * Get suppliers awaiting verification
 */
app.get(
  '/api/admin/suppliers/pending-verification',
  authRequired,
  roleRequired('admin'),
  async (_req, res) => {
    try {
      const suppliers = (await dbUnified.read('suppliers')) || [];
      const pending = suppliers.filter(
        s => !s.verified && (!s.verificationStatus || s.verificationStatus === 'pending')
      );

      res.json({
        suppliers: pending.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          location: s.location,
          ownerUserId: s.ownerUserId,
          createdAt: s.createdAt,
        })),
        count: pending.length,
      });
    } catch (error) {
      console.error('Error fetching pending verification suppliers:', error);
      res.status(500).json({ suppliers: [], count: 0, error: 'Failed to fetch pending suppliers' });
    }
  }
);

app.post(
  '/api/admin/suppliers/:id/approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const all = await dbUnified.read('suppliers');
    const i = all.findIndex(s => s.id === req.params.id);
    if (i < 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    all[i].approved = !!(req.body && req.body.approved);
    await dbUnified.write('suppliers', all);
    res.json({ ok: true, supplier: all[i] });
  }
);

app.post(
  '/api/admin/suppliers/:id/pro',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const { mode, duration } = req.body || {};
    const all = await dbUnified.read('suppliers');
    const i = all.findIndex(s => s.id === req.params.id);
    if (i < 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const s = all[i];
    const now = Date.now();

    if (mode === 'cancel') {
      s.isPro = false;
      s.proExpiresAt = null;
    } else if (mode === 'duration') {
      let ms = 0;
      switch (duration) {
        case '1d':
          ms = 1 * 24 * 60 * 60 * 1000;
          break;
        case '7d':
          ms = 7 * 24 * 60 * 60 * 1000;
          break;
        case '1m':
          ms = 30 * 24 * 60 * 60 * 1000;
          break;
        case '1y':
          ms = 365 * 24 * 60 * 60 * 1000;
          break;
        default:
          return res.status(400).json({ error: 'Invalid duration' });
      }
      s.isPro = true;
      s.proExpiresAt = new Date(now + ms).toISOString();
    } else {
      return res.status(400).json({ error: 'Invalid mode' });
    }

    // Optionally mirror Pro flag to the owning user, if present.
    try {
      if (s.ownerUserId) {
        const users = await dbUnified.read('users');
        const u = users.find(u => u.id === s.ownerUserId);
        if (u) {
          u.isPro = !!s.isPro;
          await dbUnified.write('users', users);
        }
      }
    } catch (_e) {
      // ignore errors from user store
    }

    all[i] = s;
    await dbUnified.write('suppliers', all);

    const active = supplierIsProActive(s);
    res.json({
      ok: true,
      supplier: {
        ...s,
        isPro: active,
        proExpiresAt: s.proExpiresAt || null,
      },
    });
  }
);

/**
 * PUT /api/admin/suppliers/:id
 * Update supplier details (admin only)
 */
app.put(
  '/api/admin/suppliers/:id',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const { id } = req.params;
    const suppliers = await dbUnified.read('suppliers');
    const supplierIndex = suppliers.findIndex(s => s.id === id);

    if (supplierIndex === -1) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const supplier = suppliers[supplierIndex];
    const now = new Date().toISOString();

    // Update allowed fields
    if (req.body.name !== undefined) {
      supplier.name = req.body.name;
    }
    if (req.body.category !== undefined) {
      supplier.category = req.body.category;
    }
    if (req.body.location !== undefined) {
      supplier.location = req.body.location;
    }
    if (req.body.price_display !== undefined) {
      supplier.price_display = req.body.price_display;
    }
    if (req.body.website !== undefined) {
      supplier.website = req.body.website;
    }
    if (req.body.email !== undefined) {
      supplier.email = req.body.email;
    }
    if (req.body.phone !== undefined) {
      supplier.phone = req.body.phone;
    }
    if (req.body.maxGuests !== undefined) {
      supplier.maxGuests = req.body.maxGuests;
    }
    if (req.body.description_short !== undefined) {
      supplier.description_short = req.body.description_short;
    }
    if (req.body.description_long !== undefined) {
      supplier.description_long = req.body.description_long;
    }
    if (req.body.blurb !== undefined) {
      supplier.blurb = req.body.blurb;
    }
    if (req.body.amenities !== undefined) {
      supplier.amenities = req.body.amenities;
    }
    if (typeof req.body.approved === 'boolean') {
      supplier.approved = req.body.approved;
    }
    if (typeof req.body.verified === 'boolean') {
      supplier.verified = req.body.verified;
    }
    if (req.body.tags !== undefined) {
      supplier.tags = req.body.tags;
    }

    supplier.updatedAt = now;

    suppliers[supplierIndex] = supplier;
    await dbUnified.write('suppliers', suppliers);

    res.json({ ok: true, supplier });
  }
);

app.get('/api/admin/packages', authRequired, roleRequired('admin'), async (_req, res) => {
  res.json({ items: await dbUnified.read('packages') });
});

app.post(
  '/api/admin/packages/:id/approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const all = await dbUnified.read('packages');
    const i = all.findIndex(p => p.id === req.params.id);
    if (i < 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    all[i].approved = !!(req.body && req.body.approved);
    await dbUnified.write('packages', all);
    res.json({ ok: true, package: all[i] });
  }
);

app.post(
  '/api/admin/packages/:id/feature',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const all = await dbUnified.read('packages');
    const i = all.findIndex(p => p.id === req.params.id);
    if (i < 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    all[i].featured = !!(req.body && req.body.featured);
    await dbUnified.write('packages', all);
    res.json({ ok: true, package: all[i] });
  }
);

/**
 * PUT /api/admin/packages/:id
 * Update package details
 */
app.put(
  '/api/admin/packages/:id',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const { id } = req.params;
    const packages = await dbUnified.read('packages');
    const pkgIndex = packages.findIndex(p => p.id === id);

    if (pkgIndex === -1) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const pkg = packages[pkgIndex];
    const now = new Date().toISOString();

    // Update allowed fields
    if (req.body.title) {
      pkg.title = req.body.title;
    }
    if (req.body.description) {
      pkg.description = req.body.description;
    }
    if (req.body.price_display) {
      pkg.price_display = req.body.price_display;
    }
    if (req.body.image) {
      pkg.image = req.body.image;
    }
    if (typeof req.body.approved === 'boolean') {
      pkg.approved = req.body.approved;
    }
    if (typeof req.body.featured === 'boolean') {
      pkg.featured = req.body.featured;
    }
    pkg.updatedAt = now;

    packages[pkgIndex] = pkg;
    await dbUnified.write('packages', packages);

    res.json({ ok: true, package: pkg });
  }
);

/**
 * DELETE /api/admin/packages/:id
 * Delete a package
 */
app.delete(
  '/api/admin/packages/:id',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const { id } = req.params;
    const packages = await dbUnified.read('packages');
    const filtered = packages.filter(p => p.id !== id);

    if (filtered.length === packages.length) {
      return res.status(404).json({ error: 'Package not found' });
    }

    await dbUnified.write('packages', filtered);
    res.json({ ok: true, message: 'Package deleted successfully' });
  }
);

// ---------- Protected HTML routes ----------
const sendHTML = (res, file) => res.sendFile(path.join(__dirname, 'public', file));

app.get('/dashboard/customer', authRequired, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.redirect('/auth.html');
  }
  sendHTML(res, 'dashboard-customer.html');
});

app.get('/dashboard/supplier', authRequired, async (req, res) => {
  if (req.user.role !== 'supplier') {
    return res.redirect('/auth.html');
  }
  sendHTML(res, 'dashboard-supplier.html');
});

app.get('/admin', authRequired, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/auth.html');
  }
  sendHTML(res, 'admin.html');
});

// ---------- Healthcheck & plan save system ----------

// --- PLAN SAVE SYSTEM ---
function planOwnerOnly(req, res, next) {
  if (!req.userId) {
    return res.status(403).json({ error: 'Not logged in' });
  }
  next();
}

app.post('/api/me/plan/save', authRequired, planOwnerOnly, csrfProtection, async (req, res) => {
  const { plan } = req.body || {};
  if (!plan) {
    return res.status(400).json({ error: 'Missing plan' });
  }
  const plans = await dbUnified.read('plans');
  let p = plans.find(x => x.userId === req.userId);
  if (!p) {
    p = { id: uid('pln'), userId: req.userId, plan };
    plans.push(p);
  } else {
    p.plan = plan;
  }
  await dbUnified.write('plans', plans);
  res.json({ ok: true, plan: p });
});

app.get('/api/me/plan', authRequired, planOwnerOnly, async (req, res) => {
  const plans = await dbUnified.read('plans');
  const p = plans.find(x => x.userId === req.userId);
  if (!p) {
    return res.json({ ok: true, plan: null });
  }
  res.json({ ok: true, plan: p.plan });
});

// --- GUEST PLAN CREATION (No Auth Required) ---

/**
 * Create a guest plan (no authentication required)
 * POST /api/plans/guest
 * Returns: { ok: true, plan: {...}, token: 'secret-token' }
 */
app.post('/api/plans/guest', csrfProtection, async (req, res) => {
  try {
    const { eventType, eventName, location, date, guests, budget, packages } = req.body || {};

    if (!eventType) {
      return res.status(400).json({ error: 'Event type is required' });
    }

    const plans = await dbUnified.read('plans');

    // Generate a secure token for guest plan claiming
    const token = uid('gst'); // guest token

    const newPlan = {
      id: uid('pln'),
      userId: null, // No user yet
      guestToken: token,
      eventType,
      eventName: eventName || '',
      location: location || '',
      date: date || '',
      guests: guests || null,
      budget: budget || '',
      packages: packages || [],
      isGuestPlan: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    plans.push(newPlan);
    await dbUnified.write('plans', plans);

    res.json({
      ok: true,
      plan: newPlan,
      token, // Frontend stores this to claim later
    });
  } catch (error) {
    console.error('Error creating guest plan:', error);
    res.status(500).json({ error: 'Failed to create guest plan' });
  }
});

/**
 * Claim a guest plan and attach to authenticated user
 * POST /api/me/plans/claim
 * Body: { token: 'guest-token' }
 */
app.post(
  '/api/me/plans/claim',
  authRequired,
  roleRequired('customer'),
  csrfProtection,
  async (req, res) => {
    try {
      const { token } = req.body || {};

      if (!token) {
        return res.status(400).json({ error: 'Guest plan token is required' });
      }

      const plans = await dbUnified.read('plans');
      const planIndex = plans.findIndex(p => p.guestToken === token && p.isGuestPlan === true);

      if (planIndex === -1) {
        return res.status(404).json({ error: 'Guest plan not found or already claimed' });
      }

      // Check if user already has a plan
      const existingUserPlan = plans.find(p => p.userId === req.user.id);
      if (existingUserPlan) {
        return res.status(400).json({
          error: 'You already have a plan. Guest plan cannot be claimed.',
          existingPlanId: existingUserPlan.id,
        });
      }

      // Attach plan to user
      plans[planIndex].userId = req.user.id;
      plans[planIndex].isGuestPlan = false;
      plans[planIndex].claimedAt = new Date().toISOString();
      // Keep guestToken for audit trail but plan is now claimed

      await dbUnified.write('plans', plans);

      res.json({
        ok: true,
        plan: plans[planIndex],
        message: 'Plan successfully claimed!',
      });
    } catch (error) {
      console.error('Error claiming guest plan:', error);
      res.status(500).json({ error: 'Failed to claim guest plan' });
    }
  }
);

// Create a new plan from wizard
app.post(
  '/api/me/plans',
  authRequired,
  roleRequired('customer'),
  csrfProtection,
  async (req, res) => {
    const { eventType, eventName, location, date, guests, budget, packages } = req.body || {};

    if (!eventType) {
      return res.status(400).json({ error: 'Event type is required' });
    }

    const plans = await dbUnified.read('plans');
    const newPlan = {
      id: uid('pln'),
      userId: req.user.id,
      eventType,
      eventName: eventName || '',
      location: location || '',
      date: date || '',
      guests: guests || null,
      budget: budget || '',
      packages: packages || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    plans.push(newPlan);
    await dbUnified.write('plans', plans);

    res.json({ ok: true, plan: newPlan });
  }
);

// Get all plans for current user
app.get('/api/me/plans', authRequired, roleRequired('customer'), async (req, res) => {
  const plans = await dbUnified.read('plans');
  const userPlans = plans.filter(p => p.userId === req.user.id);
  res.json({ ok: true, plans: userPlans });
});

// --- PDF EXPORT ---
app.get('/api/plan/export/pdf', authRequired, planOwnerOnly, async (req, res) => {
  const plans = await dbUnified.read('plans');
  const p = plans.find(x => x.userId === req.userId);
  if (!p) {
    return res.status(400).json({ error: 'No plan saved' });
  }

  const suppliers = await dbUnified.read('suppliers');
  // eslint-disable-next-line no-unused-vars
  const _packages = await dbUnified.read('packages'); // currently unused, but kept for future detail

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=event_plan.pdf');

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(22).text('EventFlow — Event Plan', { align: 'center' });
  doc.moveDown();
  doc.fontSize(14).text(`Generated: ${new Date().toLocaleString()}`);
  doc.moveDown();

  doc.fontSize(16).text('Event Summary', { underline: true });
  doc.fontSize(12).text(JSON.stringify(p.plan.summary || {}, null, 2));
  doc.moveDown();

  doc.fontSize(16).text('Timeline', { underline: true });
  doc.fontSize(12).text(JSON.stringify(p.plan.timeline || [], null, 2));
  doc.moveDown();

  doc.fontSize(16).text('Suppliers', { underline: true });
  const supIds = (p.plan.suppliers || []).map(s => s.id);
  suppliers
    .filter(s => supIds.includes(s.id))
    .forEach(s => {
      doc.fontSize(14).text(s.name);
      doc.fontSize(12).text(s.category);
      doc.moveDown();
    });

  doc.fontSize(16).text('Notes', { underline: true });
  doc.fontSize(12).text(p.plan.notes || 'None');
  doc.moveDown();

  doc.end();
});

// --- IMAGE STORAGE (V9.3) ---
// fs and path are already required at the top of this file
const UP_ROOT = path.join(DATA_DIR, 'uploads');

function ensureDirs() {
  const dirs = [UP_ROOT, path.join(UP_ROOT, 'suppliers'), path.join(UP_ROOT, 'packages')];
  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }
}
ensureDirs();

function saveImageBase64(base64, ownerType, ownerId) {
  try {
    const match = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return null;
    }
    const ext = match[1].split('/')[1];
    const buffer = Buffer.from(match[2], 'base64');
    const folder = path.join(UP_ROOT, ownerType, ownerId);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = path.join(folder, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${ownerType}/${ownerId}/${filename}`;
  } catch (e) {
    return null;
  }
}

// Supplier image upload
app.post(
  '/api/me/suppliers/:id/photos',
  featureRequired('photoUploads'),
  authRequired,
  csrfProtection,
  async (req, res) => {
    const { image } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: 'Missing image' });
    }
    const suppliers = await dbUnified.read('suppliers');
    const s = suppliers.find(x => x.id === req.params.id && x.ownerUserId === req.userId);
    if (!s) {
      return res.status(403).json({ error: 'Not owner' });
    }
    const url = saveImageBase64(image, 'suppliers', req.params.id);
    if (!url) {
      return res.status(400).json({ error: 'Invalid image' });
    }
    if (!s.photosGallery) {
      s.photosGallery = [];
    }
    s.photosGallery.push({ url, approved: false, uploadedAt: Date.now() });
    await dbUnified.write('suppliers', suppliers);
    res.json({ ok: true, url });
  }
);

// Package image upload
app.post(
  '/api/me/packages/:id/photos',
  featureRequired('photoUploads'),
  authRequired,
  csrfProtection,
  async (req, res) => {
    const { image } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: 'Missing image' });
    }
    const pkgs = await dbUnified.read('packages');
    const p = pkgs.find(x => x.id === req.params.id);
    if (!p) {
      return res.status(404).json({ error: 'Not found' });
    }
    const suppliers = await dbUnified.read('suppliers');
    const own = suppliers.find(x => x.id === p.supplierId && x.ownerUserId === req.userId);
    if (!own) {
      return res.status(403).json({ error: 'Not owner' });
    }
    const url = saveImageBase64(image, 'packages', req.params.id);
    if (!url) {
      return res.status(400).json({ error: 'Invalid image' });
    }
    if (!p.gallery) {
      p.gallery = [];
    }
    p.gallery.push({ url, approved: false, uploadedAt: Date.now() });
    await dbUnified.write('packages', pkgs);
    res.json({ ok: true, url });
  }
);

// ---------- Advanced Search & Discovery ----------

/**
 * Search suppliers with advanced filters
 * GET /api/search/suppliers
 * Query params: q, category, location, minPrice, maxPrice, minRating, amenities,
 *               minGuests, proOnly, verifiedOnly, sortBy, page, perPage
 */
app.get('/api/search/suppliers', async (req, res) => {
  try {
    const results = await searchSystem.searchSuppliers(req.query);

    // Save to search history if user is authenticated
    if (req.user && req.query.q) {
      await searchSystem.saveSearchHistory(req.user.id, req.query);
    }

    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

/**
 * Get trending suppliers
 * GET /api/discovery/trending
 */
app.get('/api/discovery/trending', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const trending = await searchSystem.getTrendingSuppliers(limit);

    res.json({
      success: true,
      count: trending.length,
      suppliers: trending,
    });
  } catch (error) {
    console.error('Get trending error:', error);
    res.status(500).json({ error: 'Failed to get trending suppliers', details: error.message });
  }
});

/**
 * Get new arrivals
 * GET /api/discovery/new
 */
app.get('/api/discovery/new', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const newSuppliers = await searchSystem.getNewArrivals(limit);

    res.json({
      success: true,
      count: newSuppliers.length,
      suppliers: newSuppliers,
    });
  } catch (error) {
    console.error('Get new arrivals error:', error);
    res.status(500).json({ error: 'Failed to get new suppliers', details: error.message });
  }
});

/**
 * Get popular packages
 * GET /api/discovery/popular-packages
 */
app.get('/api/discovery/popular-packages', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const packages = await searchSystem.getPopularPackages(limit);

    res.json({
      success: true,
      count: packages.length,
      packages,
    });
  } catch (error) {
    console.error('Get popular packages error:', error);
    res.status(500).json({ error: 'Failed to get popular packages', details: error.message });
  }
});

/**
 * Get personalized recommendations
 * GET /api/discovery/recommendations
 */
app.get('/api/discovery/recommendations', authRequired, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const recommendations = await searchSystem.getRecommendations(req.user.id, limit);

    res.json({
      success: true,
      count: recommendations.length,
      suppliers: recommendations,
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations', details: error.message });
  }
});

/**
 * Get user's search history
 * GET /api/search/history
 */
app.get('/api/search/history', authRequired, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const history = await searchSystem.getUserSearchHistory(req.user.id, limit);

    res.json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    console.error('Get search history error:', error);
    res.status(500).json({ error: 'Failed to get search history', details: error.message });
  }
});

/**
 * Get all categories
 * GET /api/search/categories
 */
app.get('/api/search/categories', async (req, res) => {
  try {
    const categories = await searchSystem.getCategories();

    res.json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories', details: error.message });
  }
});

/**
 * Get all amenities
 * GET /api/search/amenities
 */
app.get('/api/search/amenities', async (req, res) => {
  try {
    const amenities = await searchSystem.getAmenities();

    res.json({
      success: true,
      count: amenities.length,
      amenities,
    });
  } catch (error) {
    console.error('Get amenities error:', error);
    res.status(500).json({ error: 'Failed to get amenities', details: error.message });
  }
});

// ---------- Reviews and Ratings System ----------

/**
 * Submit a review for a supplier
 * POST /api/suppliers/:supplierId/reviews
 * Body: { rating, title, comment, recommend, eventType, eventDate, photos }
 */
app.post(
  '/api/suppliers/:supplierId/reviews',
  featureRequired('reviews'),
  authRequired,
  csrfProtection,
  async (req, res) => {
    try {
      const { supplierId } = req.params;
      const { rating, title, comment, recommend, eventType, eventDate, photos } = req.body;

      // Check if supplier exists
      const suppliers = await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.id === supplierId);
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      // Get user info
      const users = await dbUnified.read('users');
      const user = users.find(u => u.id === req.user.id);

      // Create review with full validation and anti-abuse checks
      const review = await reviewsSystem.createReview(
        {
          supplierId,
          userId: req.user.id,
          userName: user?.name || user?.firstName || 'Anonymous',
          rating: Number(rating),
          title: title || '',
          comment: comment || '',
          recommend: recommend === true || recommend === 'true',
          eventType: eventType || '',
          eventDate: eventDate || '',
          photos: photos || [],
        },
        {
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('user-agent'),
        }
      );

      // Determine message based on review status
      let message = 'Review submitted successfully!';
      if (review.flagged) {
        message = 'Review submitted and is pending moderation.';
      } else if (!review.verified) {
        message =
          'Review submitted successfully! Note: Verified badge requires message history with supplier.';
      }

      res.json({
        success: true,
        review,
        message,
      });
    } catch (error) {
      console.error('Create review error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Create a review for a supplier (Legacy endpoint)
 * POST /api/reviews
 * Body: { supplierId, rating, comment, eventType, eventDate }
 */
app.post(
  '/api/reviews',
  featureRequired('reviews'),
  authRequired,
  csrfProtection,
  async (req, res) => {
    try {
      const { supplierId, rating, comment, eventType, eventDate } = req.body;

      // Validate input
      if (!supplierId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Invalid input. Rating must be between 1 and 5.' });
      }

      // Check if supplier exists
      const suppliers = await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.id === supplierId);
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      // Get user info
      const users = await dbUnified.read('users');
      const user = users.find(u => u.id === req.user.id);

      // Create review using enhanced system
      const review = await reviewsSystem.createReview(
        {
          supplierId,
          userId: req.user.id,
          userName: user?.name || user?.firstName || 'Anonymous',
          rating: Number(rating),
          comment: comment || '',
          eventType: eventType || '',
          eventDate: eventDate || '',
        },
        {
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('user-agent'),
        }
      );

      res.json({
        success: true,
        review,
        message: review.flagged
          ? 'Review submitted and is pending moderation.'
          : 'Review submitted successfully.',
      });
    } catch (error) {
      console.error('Create review error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Get reviews for a supplier with pagination and filtering
 * GET /api/suppliers/:supplierId/reviews
 * Query: ?page=1&perPage=10&minRating=4&sortBy=date|rating|helpful&verifiedOnly=false
 */
app.get('/api/suppliers/:supplierId/reviews', async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { page, perPage, minRating, sortBy, verifiedOnly } = req.query;

    const result = await reviewsSystem.getSupplierReviews(supplierId, {
      page: page ? parseInt(page, 10) : 1,
      perPage: perPage ? parseInt(perPage, 10) : 10,
      minRating: minRating ? parseInt(minRating, 10) : undefined,
      sortBy: sortBy || 'date',
      approvedOnly: true,
      verifiedOnly: verifiedOnly === 'true',
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews', details: error.message });
  }
});

/**
 * Get reviews for a supplier (Legacy endpoint)
 * GET /api/reviews/supplier/:supplierId
 */
app.get('/api/reviews/supplier/:supplierId', async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { minRating, sortBy } = req.query;

    const result = await reviewsSystem.getSupplierReviews(supplierId, {
      approvedOnly: true,
      minRating: minRating ? Number(minRating) : undefined,
      sortBy: sortBy || 'date',
    });

    res.json({
      success: true,
      count: result.reviews.length,
      reviews: result.reviews,
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews', details: error.message });
  }
});

/**
 * Get rating distribution for a supplier
 * GET /api/reviews/supplier/:supplierId/distribution
 */
app.get('/api/reviews/supplier/:supplierId/distribution', async (req, res) => {
  try {
    const { supplierId } = req.params;
    const distribution = await reviewsSystem.getRatingDistribution(supplierId);

    res.json({
      success: true,
      ...distribution,
    });
  } catch (error) {
    console.error('Get rating distribution error:', error);
    res.status(500).json({ error: 'Failed to get rating distribution', details: error.message });
  }
});

/**
 * Vote on a review (helpful/unhelpful)
 * POST /api/reviews/:reviewId/vote
 * Body: { voteType: 'helpful' | 'unhelpful' }
 */
app.post('/api/reviews/:reviewId/vote', csrfProtection, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { voteType } = req.body;
    const userId = req.user?.id || null; // Optional: allow anonymous voting

    if (!['helpful', 'unhelpful'].includes(voteType)) {
      return res.status(400).json({ error: 'voteType must be "helpful" or "unhelpful"' });
    }

    const review = await reviewsSystem.voteOnReview(
      reviewId,
      voteType,
      userId,
      req.ip || req.connection?.remoteAddress
    );

    res.json({
      success: true,
      review,
      message: `Marked as ${voteType}. Thank you for your feedback!`,
    });
  } catch (error) {
    console.error('Vote on review error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Mark review as helpful (Legacy endpoint)
 * POST /api/reviews/:reviewId/helpful
 */
app.post('/api/reviews/:reviewId/helpful', csrfProtection, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?.id || null;

    const review = await reviewsSystem.voteOnReview(
      reviewId,
      'helpful',
      userId,
      req.ip || req.connection?.remoteAddress
    );

    res.json({
      success: true,
      review,
      message: 'Thank you for your feedback!',
    });
  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Supplier responds to a review
 * POST /api/reviews/:reviewId/respond
 * Body: { response: string }
 */
app.post(
  '/api/reviews/:reviewId/respond',
  authRequired,
  roleRequired('supplier'),
  csrfProtection,
  async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { response } = req.body;

      if (!response || response.trim().length === 0) {
        return res.status(400).json({ error: 'Response text is required' });
      }

      // Get supplier ID from user's supplier profile
      const suppliers = await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.ownerUserId === req.user.id);

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier profile not found' });
      }

      const review = await reviewsSystem.addSupplierResponse(
        reviewId,
        supplier.id,
        response.trim(),
        req.user.id
      );

      res.json({
        success: true,
        review,
        message: 'Response posted successfully',
      });
    } catch (error) {
      console.error('Add supplier response error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Get reviews for supplier dashboard
 * GET /api/supplier/dashboard/reviews
 */
app.get(
  '/api/supplier/dashboard/reviews',
  authRequired,
  roleRequired('supplier'),
  async (req, res) => {
    try {
      // Get supplier ID from user's supplier profile
      const suppliers = await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.ownerUserId === req.user.id);

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier profile not found' });
      }

      const dashboard = await reviewsSystem.getSupplierDashboardReviews(supplier.id);

      res.json({
        success: true,
        ...dashboard,
      });
    } catch (error) {
      console.error('Get supplier dashboard reviews error:', error);
      res.status(500).json({ error: 'Failed to get dashboard data', details: error.message });
    }
  }
);

/**
 * Get reviews for a specific supplier (admin view - includes all statuses)
 * GET /api/admin/reviews
 */
app.get('/api/admin/reviews', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const { supplierId } = req.query;

    if (!supplierId) {
      return res.status(400).json({ error: 'supplierId query parameter is required' });
    }

    // Get all reviews for the supplier (not just approved ones)
    const result = await reviewsSystem.getSupplierReviews(supplierId, {
      approvedOnly: false, // Admin sees all reviews
    });

    res.json({
      success: true,
      count: result.reviews.length,
      reviews: result.reviews,
    });
  } catch (error) {
    console.error('Get admin reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews', details: error.message });
  }
});

/**
 * Get flagged reviews for moderation (admin only)
 * GET /api/admin/reviews/flagged
 */
app.get('/api/admin/reviews/flagged', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const flagged = await reviewsSystem.getFlaggedReviews();

    res.json({
      success: true,
      count: flagged.length,
      reviews: flagged,
    });
  } catch (error) {
    console.error('Get flagged reviews error:', error);
    res.status(500).json({ error: 'Failed to get flagged reviews', details: error.message });
  }
});

/**
 * Get pending reviews (admin only) - deprecated, use /flagged
 * GET /api/admin/reviews/pending
 */
app.get('/api/admin/reviews/pending', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const flagged = await reviewsSystem.getFlaggedReviews();

    res.json({
      success: true,
      count: flagged.length,
      reviews: flagged,
    });
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({ error: 'Failed to get pending reviews', details: error.message });
  }
});

/**
 * Moderate a review (admin only) - approve or reject
 * POST /api/admin/reviews/:reviewId/moderate
 * Body: { action: 'approve' | 'reject', reason?: string }
 */
app.post(
  '/api/admin/reviews/:reviewId/moderate',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { action, reason } = req.body;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
      }

      const review = await reviewsSystem.moderateReview(
        reviewId,
        action,
        req.user.id,
        reason || ''
      );

      res.json({
        success: true,
        review,
        message: action === 'approve' ? 'Review approved' : 'Review rejected',
      });
    } catch (error) {
      console.error('Moderate review error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Approve or reject a review (admin only) - Legacy endpoint
 * POST /api/admin/reviews/:reviewId/approve
 * Body: { approved: boolean }
 */
app.post(
  '/api/admin/reviews/:reviewId/approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { approved } = req.body;

      if (typeof approved !== 'boolean') {
        return res.status(400).json({ error: 'Invalid input' });
      }

      const action = approved ? 'approve' : 'reject';
      const review = await reviewsSystem.moderateReview(reviewId, action, req.user.id, '');

      res.json({
        success: true,
        review,
        message: approved ? 'Review approved' : 'Review rejected',
      });
    } catch (error) {
      console.error('Approve review error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Delete a review
 * DELETE /api/reviews/:reviewId
 */
app.delete('/api/reviews/:reviewId', authRequired, csrfProtection, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const isAdmin = req.user.role === 'admin';

    await reviewsSystem.deleteReview(reviewId, req.user.id, isAdmin);

    res.json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- Photo Upload & Management ----------

/**
 * Upload photos for supplier, package, or marketplace listing
 * POST /api/photos/upload
 * Body: multipart/form-data with 'files' field (array)
 * Query: ?type=supplier|package|marketplace&id=<supplierId|packageId|listingId>
 * Note: Accepts up to 5 files per request. Marketplace listings capped at 5 images total.
 */
app.post(
  '/api/photos/upload',
  featureRequired('photoUploads'),
  authRequired,
  photoUpload.upload.array('files', 5), // Support up to 5 files for marketplace
  csrfProtection,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { type, id } = req.query;
      if (!type || !id) {
        return res.status(400).json({ error: 'Missing type or id parameter' });
      }

      // Handle marketplace type with multiple files
      if (type === 'marketplace') {
        const listings = await dbUnified.read('marketplace_listings');
        const listing = listings.find(l => l.id === id);

        if (!listing) {
          return res.status(404).json({ error: 'Listing not found' });
        }

        // Verify ownership
        if (listing.userId !== req.user.id && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Process and append URLs with error handling
        const uploadedUrls = [];
        const errors = [];
        for (const file of req.files) {
          try {
            const images = await photoUpload.processAndSaveImage(
              file.buffer,
              file.originalname,
              'marketplace'
            );
            uploadedUrls.push(images.optimized);
          } catch (error) {
            errors.push({ filename: file.originalname, error: error.message });
          }
        }

        // Cap at 5 images total
        listing.images = (listing.images || []).concat(uploadedUrls).slice(0, 5);
        listing.updatedAt = new Date().toISOString();

        await dbUnified.write('marketplace_listings', listings);

        logger.info('Marketplace images uploaded', {
          listingId: id,
          userId: req.user.id,
          count: uploadedUrls.length,
        });

        return res.json({
          success: true,
          urls: uploadedUrls,
          errors: errors.length > 0 ? errors : undefined,
          message:
            uploadedUrls.length > 0
              ? `${uploadedUrls.length} image(s) uploaded successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}.`
              : 'No images were uploaded.',
        });
      }

      // Handle single file for supplier/package types
      const file = req.files[0];

      // Process and save image
      const images = await photoUpload.processAndSaveImage(file.buffer, file.originalname, type);

      // Get metadata
      const metadata = await photoUpload.getImageMetadata(file.buffer);

      // Create photo record
      const photoRecord = {
        url: images.optimized,
        thumbnail: images.thumbnail,
        large: images.large,
        original: images.original,
        approved: false, // Requires admin approval
        uploadedAt: Date.now(),
        uploadedBy: req.user.id,
        metadata: metadata,
      };

      // Update supplier or package with new photo
      if (type === 'supplier') {
        const suppliers = await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === id);

        if (!supplier) {
          return res.status(404).json({ error: 'Supplier not found' });
        }

        // Check if user owns this supplier
        if (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Add to gallery
        if (!supplier.photosGallery) {
          supplier.photosGallery = [];
        }
        supplier.photosGallery.push(photoRecord);

        await dbUnified.write('suppliers', suppliers);

        return res.json({
          success: true,
          photo: photoRecord,
          message: 'Photo uploaded successfully. Pending admin approval.',
        });
      } else if (type === 'package') {
        const packages = await dbUnified.read('packages');
        const pkg = packages.find(p => p.id === id);

        if (!pkg) {
          return res.status(404).json({ error: 'Package not found' });
        }

        // Check if user owns this package's supplier
        const suppliers = await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === pkg.supplierId);

        if (!supplier || (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin')) {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Add to gallery
        if (!pkg.gallery) {
          pkg.gallery = [];
        }
        pkg.gallery.push(photoRecord);

        await dbUnified.write('packages', packages);

        return res.json({
          success: true,
          photo: photoRecord,
          message: 'Photo uploaded successfully. Pending admin approval.',
        });
      } else {
        return res
          .status(400)
          .json({ error: 'Invalid type. Must be supplier, package, or marketplace.' });
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({ error: 'Failed to upload photo', details: error.message });
    }
  }
);

/**
 * Upload multiple photos (batch upload)
 * POST /api/photos/upload/batch
 * Body: multipart/form-data with 'photos' field (multiple files)
 * Query: ?type=supplier|package|marketplace&id=<supplierId|packageId|listingId>
 * Note: Accepts up to 10 files for supplier/package, marketplace listings capped at 5 images total
 */
app.post(
  '/api/photos/upload/batch',
  authRequired,
  photoUpload.upload.array('photos', 10),
  csrfProtection,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const { type, id } = req.query;
      if (!type || !id) {
        return res.status(400).json({ error: 'Missing type or id parameter' });
      }

      // Process all images
      const uploadedPhotos = [];
      const errors = [];

      for (const file of req.files) {
        try {
          const images = await photoUpload.processAndSaveImage(
            file.buffer,
            file.originalname,
            type
          );
          const metadata = await photoUpload.getImageMetadata(file.buffer);

          const photoRecord = {
            url: images.optimized,
            thumbnail: images.thumbnail,
            large: images.large,
            original: images.original,
            approved: false,
            uploadedAt: Date.now(),
            uploadedBy: req.user.id,
            metadata: metadata,
          };

          uploadedPhotos.push(photoRecord);
        } catch (error) {
          errors.push({ filename: file.originalname, error: error.message });
        }
      }

      // Update supplier, package, or marketplace listing with new photos
      if (type === 'marketplace') {
        const listings = await dbUnified.read('marketplace_listings');
        const listing = listings.find(l => l.id === id);

        if (!listing) {
          return res.status(404).json({ error: 'Listing not found' });
        }

        // Verify ownership
        if (listing.userId !== req.user.id && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Process and append URLs (cap at 5 images total)
        const uploadedUrls = uploadedPhotos.map(p => p.url);
        listing.images = (listing.images || []).concat(uploadedUrls).slice(0, 5);
        listing.updatedAt = new Date().toISOString();

        await dbUnified.write('marketplace_listings', listings);

        logger.info('Marketplace images uploaded (batch)', {
          listingId: id,
          userId: req.user.id,
          count: uploadedUrls.length,
        });

        return res.json({
          success: true,
          uploaded: uploadedUrls.length,
          urls: uploadedUrls,
          errors: errors,
          message: `${uploadedUrls.length} photo(s) uploaded successfully to marketplace listing.`,
        });
      } else if (type === 'supplier') {
        const suppliers = await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === id);

        if (!supplier) {
          return res.status(404).json({ error: 'Supplier not found' });
        }

        if (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Not authorized' });
        }

        if (!supplier.photosGallery) {
          supplier.photosGallery = [];
        }
        supplier.photosGallery.push(...uploadedPhotos);

        await dbUnified.write('suppliers', suppliers);
      } else if (type === 'package') {
        const packages = await dbUnified.read('packages');
        const pkg = packages.find(p => p.id === id);

        if (!pkg) {
          return res.status(404).json({ error: 'Package not found' });
        }

        const suppliers = await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === pkg.supplierId);

        if (!supplier || (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin')) {
          return res.status(403).json({ error: 'Not authorized' });
        }

        if (!pkg.gallery) {
          pkg.gallery = [];
        }
        pkg.gallery.push(...uploadedPhotos);

        await dbUnified.write('packages', packages);
      } else {
        return res.status(400).json({ error: 'Invalid type' });
      }

      res.json({
        success: true,
        uploaded: uploadedPhotos.length,
        photos: uploadedPhotos,
        errors: errors,
        message: `${uploadedPhotos.length} photo(s) uploaded successfully. Pending admin approval.`,
      });
    } catch (error) {
      console.error('Batch upload error:', error);
      res.status(500).json({ error: 'Failed to upload photos', details: error.message });
    }
  }
);

/**
 * Delete photo
 * DELETE /api/photos/:photoUrl
 * Query: ?type=supplier|package&id=<supplierId|packageId>
 */
app.delete('/api/photos/delete', authRequired, csrfProtection, async (req, res) => {
  try {
    const { type, id, photoUrl } = req.query;

    if (!type || !id || !photoUrl) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const decodedUrl = decodeURIComponent(photoUrl);

    if (type === 'supplier') {
      const suppliers = await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.id === id);

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      if (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (supplier.photosGallery) {
        supplier.photosGallery = supplier.photosGallery.filter(p => p.url !== decodedUrl);
        await dbUnified.write('suppliers', suppliers);

        // Delete physical files
        await photoUpload.deleteImage(decodedUrl);
      }
    } else if (type === 'package') {
      const packages = await dbUnified.read('packages');
      const pkg = packages.find(p => p.id === id);

      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }

      const suppliers = await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.id === pkg.supplierId);

      if (!supplier || (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (pkg.gallery) {
        pkg.gallery = pkg.gallery.filter(p => p.url !== decodedUrl);
        await dbUnified.write('packages', packages);

        // Delete physical files
        await photoUpload.deleteImage(decodedUrl);
      }
    }

    res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo', details: error.message });
  }
});

/**
 * Approve photo (admin only)
 * POST /api/photos/approve
 * Body: { type, id, photoUrl, approved }
 */
app.post(
  '/api/photos/approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { type, id, photoUrl, approved } = req.body;

      if (!type || !id || !photoUrl || typeof approved !== 'boolean') {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      if (type === 'supplier') {
        const suppliers = await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === id);

        if (!supplier) {
          return res.status(404).json({ error: 'Supplier not found' });
        }

        if (supplier.photosGallery) {
          const photo = supplier.photosGallery.find(p => p.url === photoUrl);
          if (photo) {
            photo.approved = approved;
            photo.approvedAt = Date.now();
            photo.approvedBy = req.user.id;
            await dbUnified.write('suppliers', suppliers);
          }
        }
      } else if (type === 'package') {
        const packages = await dbUnified.read('packages');
        const pkg = packages.find(p => p.id === id);

        if (!pkg) {
          return res.status(404).json({ error: 'Package not found' });
        }

        if (pkg.gallery) {
          const photo = pkg.gallery.find(p => p.url === photoUrl);
          if (photo) {
            photo.approved = approved;
            photo.approvedAt = Date.now();
            photo.approvedBy = req.user.id;
            await dbUnified.write('packages', packages);
          }
        }
      }

      res.json({
        success: true,
        message: approved ? 'Photo approved' : 'Photo rejected',
      });
    } catch (error) {
      console.error('Approve photo error:', error);
      res.status(500).json({ error: 'Failed to approve photo', details: error.message });
    }
  }
);

/**
 * Crop image
 * POST /api/photos/crop
 * Body: { imageUrl, cropData: { x, y, width, height } }
 */
app.post('/api/photos/crop', authRequired, csrfProtection, async (req, res) => {
  try {
    const { imageUrl, cropData } = req.body;

    if (!imageUrl || !cropData) {
      return res.status(400).json({ error: 'Missing imageUrl or cropData' });
    }

    // Validate crop data
    if (!cropData.x || !cropData.y || !cropData.width || !cropData.height) {
      return res.status(400).json({ error: 'Invalid crop data' });
    }

    const croppedImages = await photoUpload.cropImage(imageUrl, cropData);

    res.json({
      success: true,
      images: croppedImages,
      message: 'Image cropped successfully',
    });
  } catch (error) {
    console.error('Crop image error:', error);
    res.status(500).json({ error: 'Failed to crop image', details: error.message });
  }
});

/**
 * Get pending photos for moderation (admin only)
 * GET /api/photos/pending
 */
app.get('/api/photos/pending', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const pendingPhotos = [];

    // Get pending supplier photos
    const suppliers = await dbUnified.read('suppliers');
    for (const supplier of suppliers) {
      if (supplier.photosGallery) {
        const pending = supplier.photosGallery
          .filter(p => !p.approved)
          .map(p => ({
            ...p,
            type: 'supplier',
            supplierId: supplier.id,
            supplierName: supplier.name,
          }));
        pendingPhotos.push(...pending);
      }
    }

    // Get pending package photos
    const packages = await dbUnified.read('packages');
    for (const pkg of packages) {
      if (pkg.gallery) {
        const pending = pkg.gallery
          .filter(p => !p.approved)
          .map(p => ({
            ...p,
            type: 'package',
            packageId: pkg.id,
            packageTitle: pkg.title,
            supplierId: pkg.supplierId,
          }));
        pendingPhotos.push(...pending);
      }
    }

    // Sort by upload time (newest first)
    pendingPhotos.sort((a, b) => b.uploadedAt - a.uploadedAt);

    res.json({
      success: true,
      count: pendingPhotos.length,
      photos: pendingPhotos,
    });
  } catch (error) {
    console.error('Get pending photos error:', error);
    res.status(500).json({ error: 'Failed to get pending photos', details: error.message });
  }
});

/**
 * PUT /api/photos/:id
 * Edit photo metadata (caption, alt text, tags)
 */
app.put('/api/photos/:id', authRequired, csrfProtection, async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, altText, tags, isFeatured, watermark } = req.body;

    const metadata = await photoUpload.updatePhotoMetadata(id, {
      caption,
      altText,
      tags,
      isFeatured,
      watermark,
    });

    res.json({
      success: true,
      metadata,
      message: 'Photo metadata updated successfully',
    });
  } catch (error) {
    console.error('Update photo metadata error:', error);
    res.status(500).json({ error: 'Failed to update photo metadata', details: error.message });
  }
});

/**
 * POST /api/photos/:id/replace
 * Replace photo while keeping metadata
 */
app.post(
  '/api/photos/:id/replace',
  authRequired,
  photoUpload.upload.single('photo'),
  csrfProtection,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { metadata } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No photo file provided' });
      }

      const result = await photoUpload.replacePhoto(
        id,
        req.file.buffer,
        JSON.parse(metadata || '{}')
      );

      res.json({
        success: true,
        photo: result,
        message: 'Photo replaced successfully',
      });
    } catch (error) {
      console.error('Replace photo error:', error);
      res.status(500).json({ error: 'Failed to replace photo', details: error.message });
    }
  }
);

/**
 * POST /api/photos/bulk-edit
 * Bulk update multiple photos
 */
app.post('/api/photos/bulk-edit', authRequired, csrfProtection, async (req, res) => {
  try {
    const { photos } = req.body;

    if (!Array.isArray(photos)) {
      return res.status(400).json({ error: 'Photos must be an array' });
    }

    const results = await Promise.all(
      photos.map(photo => photoUpload.updatePhotoMetadata(photo.id, photo.metadata))
    );

    res.json({
      success: true,
      updated: results.length,
      photos: results,
      message: `${results.length} photo(s) updated successfully`,
    });
  } catch (error) {
    console.error('Bulk edit photos error:', error);
    res.status(500).json({ error: 'Failed to bulk edit photos', details: error.message });
  }
});

/**
 * POST /api/photos/:id/filters
 * Apply filters to photo (brightness, contrast, saturation)
 */
app.post('/api/photos/:id/filters', authRequired, csrfProtection, async (req, res) => {
  try {
    // eslint-disable-next-line no-unused-vars
    const { id: _id } = req.params; // Photo ID from URL (not currently used)
    const { imageUrl, brightness, contrast, saturation } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const result = await photoUpload.applyFilters(imageUrl, {
      brightness: parseFloat(brightness) || 1,
      contrast: parseFloat(contrast) || 1,
      saturation: parseFloat(saturation) || 1,
    });

    res.json({
      success: true,
      image: result,
      message: 'Filters applied successfully',
    });
  } catch (error) {
    console.error('Apply filters error:', error);
    res.status(500).json({ error: 'Failed to apply filters', details: error.message });
  }
});

/**
 * POST /api/photos/reorder
 * Update photo order in gallery
 */
app.post('/api/photos/reorder', authRequired, csrfProtection, async (req, res) => {
  try {
    const { photoOrder } = req.body;

    if (!Array.isArray(photoOrder)) {
      return res.status(400).json({ error: 'Photo order must be an array' });
    }

    const result = await photoUpload.updatePhotoOrder(photoOrder);

    res.json({
      success: true,
      order: result,
      message: 'Photo order updated successfully',
    });
  } catch (error) {
    console.error('Reorder photos error:', error);
    res.status(500).json({ error: 'Failed to reorder photos', details: error.message });
  }
});

// ---------- Auth Routes ----------
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// ---------- Public Maintenance Endpoint (must be before auth checks) ----------
app.get('/api/maintenance/message', async (req, res) => {
  try {
    const settings = (await dbUnified.read('settings')) || {};
    const maintenance = settings.maintenance || {
      enabled: false,
      message: "We're performing scheduled maintenance. We'll be back soon!",
    };

    // Return public maintenance information
    res.json({
      enabled: maintenance.enabled,
      message: maintenance.message,
    });
  } catch (error) {
    console.error('Error reading maintenance message:', error);
    // Return default message on error
    res.status(200).json({
      enabled: false,
      message: "We're performing scheduled maintenance. We'll be back soon!",
    });
  }
});

// ---------- Webhook Routes ----------
const webhookRoutes = require('./routes/webhooks');
app.use('/api/webhooks', webhookRoutes);

// ---------- Admin Routes ----------
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// ---------- Admin v2 Routes (RBAC with granular permissions) ----------
const adminV2Routes = require('./routes/admin-v2');
app.use('/api/v2/admin', adminV2Routes);

// ---------- Content Reporting System ----------
const reportsRoutes = require('./routes/reports');
app.use('/api', reportsRoutes);

// ---------- Messages Routes ----------
const messagesRoutes = require('./routes/messages');
app.use('/api/messages', messagesRoutes);

// ---------- Messages v2 Routes (Real-time Messaging System) ----------
const messagingV2Routes = require('./routes/messaging-v2');
app.use('/api/v2/messages', messagingV2Routes);

// ---------- Tickets Routes ----------
const ticketsRoutes = require('./routes/tickets');
app.use('/api/tickets', ticketsRoutes);

// ---------- Pexels Stock Photos Routes ----------
const pexelsRoutes = require('./routes/pexels');
app.use('/api/pexels', pexelsRoutes);

// ---------- Payment Routes ----------
const paymentRoutes = require('./routes/payments');
app.use('/api/payments', paymentRoutes);

// ---------- Profile Routes ----------
const profileRoutes = require('./routes/profile');
app.use('/api/profile', profileRoutes);

// ---------- Notification Routes ----------
const notificationRoutes = require('./routes/notifications');
// WebSocket server will be passed when available (after server starts)
let notificationRouter;
app.use('/api/notifications', (req, res, next) => {
  // Determine which WebSocket server to use based on WEBSOCKET_MODE
  // Check environment variable directly (WEBSOCKET_MODE variable is defined later in the file)
  const wsMode = (process.env.WEBSOCKET_MODE || 'v2').toLowerCase();

  let webSocketServer = null;
  if (wsMode === 'v2') {
    webSocketServer = global.wsServerV2;
  } else if (wsMode === 'v1') {
    webSocketServer = global.wsServer;
  }
  // wsMode === 'off' will result in webSocketServer === null

  if (!notificationRouter && webSocketServer) {
    notificationRouter = notificationRoutes(mongoDb.db, webSocketServer);
  }
  if (notificationRouter) {
    notificationRouter(req, res, next);
  } else {
    // Fallback if WebSocket not ready yet
    const tempRouter = notificationRoutes(mongoDb.db, null);
    tempRouter(req, res, next);
  }
});

// ---------- Photo Serving from MongoDB ----------
/**
 * GET /api/photos/:id
 * Serve photo from MongoDB
 */
app.get('/api/photos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if MongoDB is available
    if (!databaseConfig.isMongoAvailable()) {
      return res.status(503).json({ error: 'Photo storage not available' });
    }

    const db = await mongoDb.getDb();
    const collection = db.collection('photos');

    const photo = await collection.findOne({ _id: id });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Convert base64 back to buffer
    const imageBuffer = Buffer.from(photo.data, 'base64');

    // Set appropriate headers
    res.setHeader('Content-Type', photo.mimeType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Content-Length', imageBuffer.length);

    // Send the image
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error serving photo from MongoDB:', error);
    res.status(500).json({ error: 'Failed to retrieve photo' });
  }
});

// ---------- Audit Logging ----------
const { auditLog, AUDIT_ACTIONS } = require('./middleware/audit');

// Note: Admin audit endpoints moved to routes/admin.js for consolidation
// GET /api/admin/audit and GET /api/admin/audit-logs are now in routes/admin.js

// Health and ready endpoints moved to routes/system.js

// Cache statistics endpoint (admin only)
app.get('/api/admin/cache/stats', authRequired, roleRequired('admin'), async (_req, res) => {
  try {
    const cacheStats = cache.getStats();
    res.json({
      cache: cacheStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    sentry.captureException(error);
    res.status(500).json({ error: 'Failed to get cache statistics' });
  }
});

// Query performance metrics endpoint (admin only)
app.get('/api/admin/database/metrics', authRequired, roleRequired('admin'), async (_req, res) => {
  try {
    const queryMetrics = dbUnified.getQueryMetrics ? dbUnified.getQueryMetrics() : {};
    res.json({
      metrics: queryMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting query metrics:', error);
    sentry.captureException(error);
    res.status(500).json({ error: 'Failed to get database metrics' });
  }
});

// Cache clear endpoint (admin only)
app.post(
  '/api/admin/cache/clear',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (_req, res) => {
    try {
      await cache.clear();
      res.json({
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      sentry.captureException(error);
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  }
);

// CSP Violation Reporting Endpoint
app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  console.warn('CSP Violation:', req.body);
  res.status(204).end();
});

// ---------- Subscription and Payment v2 Routes ----------
const subscriptionsV2Routes = require('./routes/subscriptions-v2');
app.use('/api/v2/subscriptions', subscriptionsV2Routes);
app.use('/api/v2', subscriptionsV2Routes); // For /api/v2/invoices, /api/v2/admin, and /api/v2/webhooks/stripe

// ---------- Reviews v2 Routes ----------
const reviewsV2Routes = require('./routes/reviews-v2');
app.use('/api/v2/reviews', reviewsV2Routes);

// ---------- Mount Modular Routes ----------
// Mount all modular routes from routes/index.js
const { mountRoutes } = require('./routes/index');
mountRoutes(app, {
  APP_VERSION,
  EMAIL_ENABLED,
  postmark,
  mongoDb,
  dbUnified,
  getToken,
  authLimiter,
  healthCheckLimiter,
});

// ---------- API Documentation & 404 Handler ----------
// API Documentation (Swagger UI)
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'EventFlow API Documentation',
  })
);

// Sentry error handler (must be before other error handlers)
app.use(sentry.getErrorHandler());

// Use centralized error handler
app.use(errorHandler);

// Catch-all 404 handler (must be the LAST middleware)
// This will only be reached if no static files or routes matched
app.use((req, res) => {
  const { method, url, headers } = req;
  const isApiRequest = url.startsWith('/api');
  const acceptsJson = headers.accept && headers.accept.includes('application/json');

  // Log 404 for debugging (but not for common static assets)
  if (!url.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf)$/i)) {
    console.warn(`404 Not Found: [${method}] ${url}`);
  }

  // Return JSON for API requests or if client accepts JSON
  if (isApiRequest || acceptsJson) {
    return res.status(404).json({
      error: 'Not found',
      message: `The requested resource ${url} was not found on this server`,
      status: 404,
    });
  }

  // Return HTML for regular page requests
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - Page Not Found</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        h1 {
          font-size: 6rem;
          margin: 0;
          font-weight: 700;
        }
        p {
          font-size: 1.5rem;
          margin: 1rem 0;
        }
        a {
          display: inline-block;
          margin-top: 2rem;
          padding: 1rem 2rem;
          background: white;
          color: #667eea;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          transition: transform 0.2s;
        }
        a:hover {
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404</h1>
        <p>Page Not Found</p>
        <p style="font-size: 1rem; opacity: 0.9;">The page you're looking for doesn't exist.</p>
        <a href="/">Return to Homepage</a>
      </div>
    </body>
    </html>
  `);
});

// ---------- Start ----------
const http = require('http');
const server = http.createServer(app);

// Validate and configure WebSocket mode
// WEBSOCKET_MODE determines which WebSocket server to use:
// - 'v2': Modern WebSocket server with real-time messaging (default, recommended)
// - 'v1': Legacy WebSocket server for backwards compatibility
// - 'off': Disable WebSocket servers (not recommended - disables real-time features)
let WEBSOCKET_MODE = (process.env.WEBSOCKET_MODE || 'v2').toLowerCase();
const WEBSOCKET_PATH = process.env.WEBSOCKET_PATH || '/socket.io';
const VALID_WEBSOCKET_MODES = ['v1', 'v2', 'off'];

if (!VALID_WEBSOCKET_MODES.includes(WEBSOCKET_MODE)) {
  logger.error(
    `❌ Invalid WEBSOCKET_MODE: ${WEBSOCKET_MODE}. Must be one of: ${VALID_WEBSOCKET_MODES.join(', ')}`
  );
  logger.error('   Defaulting to v2 (recommended)');
  WEBSOCKET_MODE = 'v2'; // Update the constant, not just process.env
}

logger.info(`🔌 WebSocket Configuration:`);
logger.info(`   Mode: ${WEBSOCKET_MODE}`);
logger.info(`   Path: ${WEBSOCKET_PATH}`);

// Initialize WebSocket servers based on WEBSOCKET_MODE
// CRITICAL: Only ONE Socket.IO server can be attached to the HTTP server
// to prevent "server.handleUpgrade() was called more than once" errors
const WebSocketServer = require('./websocket-server');
const WebSocketServerV2 = require('./websocket-server-v2');
let wsServer;
let wsServerV2;

// Initialize v1 WebSocket Server (legacy notifications)
if (WEBSOCKET_MODE === 'v1') {
  try {
    wsServer = new WebSocketServer(server);
    global.wsServer = wsServer;
    app.set('wsServer', wsServer);
    logger.info('✅ WebSocket Server v1 initialized (legacy mode)');
    logger.info('   Real-time notifications enabled');
    logger.info('   ℹ️  Consider migrating to v2 for enhanced features');
  } catch (error) {
    logger.error('❌ Failed to initialize WebSocket Server v1', { error: error.message });
    logger.error('   Real-time notifications will not be available');
  }
}

// Will be initialized after MongoDB is connected (only in v2 mode)
function initializeWebSocketV2(db) {
  // Only initialize v2 if mode is v2 and not already initialized
  if (WEBSOCKET_MODE === 'v2' && !wsServerV2 && db) {
    try {
      const MessagingService = require('./services/messagingService');
      const { NotificationService } = require('./services/notificationService');

      const messagingService = new MessagingService(db);

      // Create WebSocket v2 instance first
      wsServerV2 = new WebSocketServerV2(server, messagingService, null);

      // Then create notification service with v2 WebSocket server
      // In v2 mode, notifications go through the v2 server's sendNotification method
      const notificationService = new NotificationService(db, wsServerV2);

      // Set the notification service on the v2 server
      wsServerV2.notificationService = notificationService;

      global.wsServerV2 = wsServerV2;
      app.set('wsServerV2', wsServerV2);
      app.locals.db = db;

      logger.info('✅ WebSocket Server v2 initialized (modern mode)');
      logger.info('   Real-time messaging and notifications enabled');
      logger.info('   Enhanced features: presence tracking, typing indicators, read receipts');
    } catch (error) {
      logger.error('❌ Failed to initialize WebSocket Server v2', { error: error.message });
      logger.error('   Real-time messaging will not be available');
      logger.error('   Server will continue running with reduced functionality');
    }
  } else if (WEBSOCKET_MODE === 'off') {
    logger.warn('⚠️  WebSocket servers disabled (WEBSOCKET_MODE=off)');
    logger.warn('   Real-time features will not be available');
  }
}

/**
 * Initialize all services and start the server
 * This ensures proper startup and health checks before accepting requests
 * Includes 30 second startup timeout to prevent hanging
 */
async function startServer() {
  // Set startup timeout to prevent hanging
  const startupTimeout = setTimeout(() => {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ STARTUP TIMEOUT');
    console.error('='.repeat(60));
    console.error('Server startup took longer than 30 seconds');
    console.error('This usually indicates:');
    console.error('  - Database connection hanging');
    console.error('  - Email service not responding');
    console.error('  - Network connectivity issues');
    console.error('');
    console.error('Check your configuration and try again.');
    console.error('='.repeat(60));
    process.exit(1);
  }, 30000); // 30 seconds

  try {
    console.log('='.repeat(60));
    console.log(`EventFlow ${APP_VERSION} - Starting Server`);
    console.log('='.repeat(60));
    console.log('');

    // 1. Validate critical environment variables
    console.log('📋 Checking configuration...');
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    console.log(`   BASE_URL: ${baseUrl}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   PORT: ${PORT}`);

    if (isProduction && baseUrl.includes('localhost')) {
      console.warn('⚠️  Warning: BASE_URL points to localhost in production');
      console.warn('   Set BASE_URL to your actual domain (e.g., https://event-flow.co.uk)');
    }

    // 2. Pre-flight database validation (before initialization)
    console.log('');
    console.log('🔌 Validating database configuration...');

    // Check if MongoDB is configured and validate the URI format
    if (process.env.MONGODB_URI) {
      console.log('   MongoDB URI detected - validating format...');

      // The validation will happen in db.js getConnectionUri(), but we can provide
      // early feedback here if we detect obvious issues
      const uri = process.env.MONGODB_URI;

      if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
        console.error('');
        console.error('❌ INVALID MONGODB_URI FORMAT');
        console.error('   Your connection string must start with:');
        console.error('   • mongodb:// or mongodb+srv://');
        console.error('');
        console.error('   Current value starts with:', `${uri.substring(0, 10)}...`);
        console.error('');
        console.error('📚 Setup guide: See MONGODB_SETUP_SIMPLE.md');
        console.error('');
        process.exit(1);
      }

      // Basic check for obvious placeholder values (detailed validation in db.js)
      const hasPlaceholder =
        uri.includes('username:password') ||
        uri.includes('your-') ||
        uri.includes('YourCluster') ||
        uri.includes('<password>') ||
        uri.includes('<username>');

      if (hasPlaceholder) {
        console.error('');
        console.error('❌ MONGODB_URI CONTAINS PLACEHOLDER VALUES');
        console.error(
          '   You must replace the example values with your actual MongoDB credentials.'
        );
        console.error('');
        console.error(
          '   Current MONGODB_URI contains placeholder text that needs to be replaced.'
        );
        console.error('');
        console.error('📚 Step-by-step setup guide: MONGODB_SETUP_SIMPLE.md');
        console.error('   Get your real connection string from: https://cloud.mongodb.com/');
        console.error('');
        process.exit(1);
      }

      console.log('   ✅ MongoDB URI format looks valid');
    }

    // Warn if using local storage in production (before initialization)
    if (isProduction) {
      if (!databaseConfig.isMongoAvailable()) {
        console.warn('');
        console.warn('='.repeat(70));
        console.warn('⚠️  WARNING: NO CLOUD DATABASE CONFIGURED');
        console.warn('='.repeat(70));
        console.warn('');
        console.warn('Running in LOCAL STORAGE MODE (non-persistent).');
        console.warn('');
        console.warn('⚠️  IMPORTANT:');
        console.warn('   • Data is stored in local JSON files');
        console.warn('   • Data will be LOST on server restart/redeployment');
        console.warn('   • NOT RECOMMENDED for production with real user data');
        console.warn('');
        console.warn('To set up persistent data storage with MongoDB Atlas:');
        console.warn('   1. Create account at: https://cloud.mongodb.com/');
        console.warn('   2. Follow the setup guide: MONGODB_SETUP_SIMPLE.md');
        console.warn('   3. Set MONGODB_URI environment variable');
        console.warn('');
        console.warn('📚 Documentation:');
        console.warn('   → Simple guide: MONGODB_SETUP_SIMPLE.md');
        console.warn('   → Technical guide: MONGODB_SETUP.md');
        console.warn('   → Deployment guide: DEPLOYMENT_GUIDE.md');
        console.warn('');
        console.warn('='.repeat(70));
        console.warn('');
        console.warn('Continuing with local storage...');
        console.warn('');
      }
    }

    // 3. Start the server IMMEDIATELY (before database initialization)
    // This ensures Railway healthchecks can reach /api/health without waiting for database
    console.log('');
    console.log('🚀 Starting server...');

    server.listen(PORT, '0.0.0.0', () => {
      // Clear startup timeout - server started successfully
      clearTimeout(startupTimeout);

      console.log('');
      console.log('='.repeat(60));
      console.log(`✅ Server is ready!`);
      console.log('='.repeat(60));
      console.log(`   Server: http://0.0.0.0:${PORT}`);
      console.log(`   Local:  http://localhost:${PORT}`);
      if (!baseUrl.includes('localhost')) {
        console.log(`   Public: ${baseUrl}`);
      }
      console.log(`   Health: ${baseUrl}/api/health`);
      console.log(`   Docs:   ${baseUrl}/api-docs`);
      console.log('='.repeat(60));
      console.log('');

      // Log WebSocket status based on mode
      if (WEBSOCKET_MODE === 'v1' && wsServer) {
        console.log('✅ WebSocket v1 (legacy) initialized for real-time notifications');
      } else if (WEBSOCKET_MODE === 'v2') {
        console.log('✅ WebSocket v2 (modern) will initialize after database connection');
      } else if (WEBSOCKET_MODE === 'off') {
        console.log('⚠️  WebSocket disabled (WEBSOCKET_MODE=off) - real-time features unavailable');
      } else {
        console.log('⚠️  WebSocket server not available - real-time features disabled');
      }

      console.log('Server is now accepting requests');
      console.log('');
      console.log('🔌 Database initialization running in background...');
    });

    // 4. Initialize database connection in background (non-blocking)
    // This allows the server to respond to healthchecks while database initializes
    (async () => {
      try {
        console.log('   Connecting to database...');
        await dbUnified.initializeDatabase();
        console.log('   ✅ Database connection successful');

        // Initialize WebSocket v2 with MongoDB
        try {
          const db = await mongoDb.getDb();
          initializeWebSocketV2(db);
        } catch (error) {
          console.warn('   ⚠️  WebSocket v2 initialization deferred (MongoDB not available yet)');
        }

        // 4a. Seed database with initial data
        console.log('');
        console.log('📊 Seeding database...');
        await seed({
          skipIfExists: isProduction,
          seedUsers: true,
          seedSuppliers: true, // Seed demo suppliers in production if empty (after auto-migration)
          seedPackages: true, // Seed demo packages in production if empty (after auto-migration)
          autoMigrateFromLocal: true, // Auto-migrate from local storage if detected
        });
        console.log('   ✅ Database seeding complete');
      } catch (error) {
        console.error('');
        console.error('='.repeat(70));
        console.error('⚠️  DATABASE CONNECTION FAILED');
        console.error('='.repeat(70));
        console.error('');
        console.error('Warning: Could not connect to the database.');
        console.error('Server will continue running with limited functionality:');
        console.error('   • User authentication and data may not persist');
        console.error('   • Local file storage will be used (non-persistent)');
        console.error('   • Data will be lost on server restart');
        console.error('');
        console.error('Error details:');
        console.error(`   ${error.message}`);
        console.error('');

        if (
          error.message.includes('Invalid scheme') ||
          error.message.includes('placeholder') ||
          error.message.includes('MONGODB_URI')
        ) {
          console.error('🔍 This looks like a MongoDB configuration issue.');
          console.error('');
          console.error('📚 Follow the setup guide:');
          console.error('   → MONGODB_SETUP_SIMPLE.md (beginner-friendly)');
          console.error('   → Get MongoDB Atlas free: https://cloud.mongodb.com/');
          console.error('');
        }

        console.error('='.repeat(70));
        console.error('');
      }

      // 5. Check email service
      console.log('');
      console.log('📧 Checking email configuration...');
      if (EMAIL_ENABLED) {
        if (postmark.isPostmarkEnabled()) {
          const postmarkStatus = postmark.getPostmarkStatus();
          console.log(`   ✅ Email: Postmark configured (${postmarkStatus.domain})`);
          console.log('   ✅ Postmark ready to send emails');
        } else {
          console.warn('   ⚠️  Email enabled but Postmark not configured');
          console.warn('   Set POSTMARK_API_KEY and POSTMARK_FROM in your .env file');
          console.warn('   Emails will be saved to /outbox folder instead');
        }
      } else {
        console.log('   ℹ️  Email disabled (EMAIL_ENABLED=false)');
        console.log('   Emails will be saved to /outbox folder');
      }

      // 6. Check optional services
      console.log('');
      console.log('🔧 Checking optional services...');
      if (STRIPE_ENABLED) {
        console.log('   ✅ Stripe: Configured');
      } else {
        console.log('   ℹ️  Stripe: Not configured (optional)');
      }

      if (AI_ENABLED) {
        console.log('   ✅ OpenAI: Configured');
      } else {
        console.log('   ℹ️  OpenAI: Not configured (optional)');
      }

      // Check Pexels API configuration
      const { getPexelsService } = require('./utils/pexels-service');
      const pexels = getPexelsService();
      if (pexels.isConfigured()) {
        console.log('   ✅ Pexels API: Configured');
        console.log('   Use admin settings to test connection and enable dynamic collage');
      } else {
        console.log('   ℹ️  Pexels API: Not configured (optional)');
        console.log('   Set PEXELS_API_KEY to enable stock photo integration');
      }

      console.log('');
      console.log('🎉 Background initialization complete!');
    })();
  } catch (error) {
    // Clear startup timeout
    clearTimeout(startupTimeout);

    console.error('');
    console.error('='.repeat(60));
    console.error('❌ STARTUP FAILED');
    console.error('='.repeat(60));
    console.error('Error:', error.message);
    console.error('');
    console.error('Please fix the configuration issues and try again.');
    console.error('See the documentation for setup instructions.');
    console.error('='.repeat(60));
    process.exit(1);
  }
}

// Export the app for testing (without starting the server)
module.exports = app;

// Only start the server if this file is run directly (not imported by tests)
if (require.main === module) {
  startServer().catch(error => {
    console.error('Fatal error during startup:', error);
    sentry.captureException(error);
    process.exit(1);
  });
}

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  sentry.captureException(reason);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  sentry.captureException(error);
  // Give Sentry time to send the error before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');

  // Shutdown WebSocket servers gracefully
  if (wsServerV2) {
    await wsServerV2.shutdown();
  }

  await sentry.flush(2000);
  await cache.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');

  // Shutdown WebSocket servers gracefully
  if (wsServerV2) {
    await wsServerV2.shutdown();
  }

  await sentry.flush(2000);
  await cache.close();
  process.exit(0);
});
