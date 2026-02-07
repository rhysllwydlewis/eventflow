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

const APP_VERSION = 'v18.1.0';

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
  userExtractionMiddleware,
} = require('./middleware/auth');
const { featureRequired } = require('./middleware/features');
const { apiCacheControlMiddleware, staticCachingMiddleware } = require('./middleware/cache');
const { noindexMiddleware } = require('./middleware/seo');
const { adminPageProtectionMiddleware } = require('./middleware/adminPages');

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
const uploadValidation = require('./utils/uploadValidation');

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

// User extraction middleware - extracts user from JWT cookie
app.use(userExtractionMiddleware);

// Maintenance mode check - blocks non-admin users if enabled
// Must come after user extraction so it can check user role
const maintenanceMode = require('./middleware/maintenance');
app.use(maintenanceMode);

// ---------- API Cache Control Middleware ----------
// SECURITY: Prevent service worker and intermediaries from caching sensitive API responses
app.use('/api', apiCacheControlMiddleware());

// ---------- Static File Serving ----------
// Serve static files early in the middleware chain (before API routes)
// This ensures files like verify.html are served before any route handlers

// ---------- SEO: Noindex Middleware for Non-Public Pages ----------
// Add X-Robots-Tag header to prevent indexing of authenticated/private pages
// This MUST come before express.static() so it intercepts HTML file requests
app.use(noindexMiddleware());

// Static assets with caching strategy
app.use(staticCachingMiddleware());

// Dynamic verification route - CRITICAL: Must be before express.static()
// This ensures /verify is handled by the backend route, not static file serving
// Fixes 404 errors in production where static files may not deploy correctly
// Each user receives a unique verification token in their email (e.g., verify_abc123)
// Rate limiting applied to prevent abuse
// Static/SEO routes (verify, sitemap, robots.txt, redirects) moved to routes/static.js
const staticRoutes = require('./routes/static');
app.use('/', staticRoutes);

// Canonical routes for other pages
// Note: These routes let the template middleware handle file rendering
const canonicalPages = [
  'start',
  'blog',
  'pricing',
  'faq',
  'for-suppliers',
  'auth',
  'contact',
  'legal',
  'credits',
];

canonicalPages.forEach(page => {
  // Redirect .html to canonical (this ensures canonical URLs)
  app.get(`/${page}.html`, (req, res) => {
    res.redirect(301, `/${page}`);
  });
  // The canonical URL without .html is handled by template middleware + static files
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
app.use(adminPageProtectionMiddleware());

// ---------- Template Rendering Middleware ----------
// CRITICAL: Must come before express.static() to process HTML files with placeholders
// Replaces {{PLACEHOLDER}} values in HTML files with dynamic content
const { templateMiddleware } = require('./utils/template-renderer');
app.use(templateMiddleware());

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
// Auth routes (register, login, verify, logout, etc.) moved to routes/auth.js

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

/**
 * Get venues near a location
 * (Route extracted to routes/misc.js)
 */

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

// Admin-only: auto-categorisation & scoring for suppliers moved to routes/supplier-admin.js

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

// Badge management routes moved to routes/supplier-admin.js and routes/supplier-management.js

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

// ---------- Category browsing endpoints ----------

// Public stats route moved to routes/public.js (with its own cache)
const publicRoutes = require('./routes/public');
app.use('/api/public', publicRoutes);

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
        const errorResponse = uploadValidation.formatValidationErrorResponse(error);

        // Guard against null response (should not happen but defensive coding)
        if (!errorResponse) {
          return res.status(400).json({
            error: error.message,
            details: error.details || {},
          });
        }

        // Log debug info for troubleshooting
        if (errorResponse.magicBytes) {
          logger.warn('File type validation failed - magic bytes:', {
            magicBytes: errorResponse.magicBytes,
            detectedType: errorResponse.details.detectedType,
          });
        }

        return res.status(400).json({
          error: errorResponse.error,
          details: errorResponse.details,
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

// Admin: Create new category
app.post(
  '/api/admin/categories',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { name, slug, description, icon, heroImage, pexelsAttribution, visible } = req.body;

      if (!name || !slug) {
        return res.status(400).json({ error: 'Name and slug are required' });
      }

      const categories = await dbUnified.read('categories');

      // Check if slug already exists
      if (categories.find(c => c.slug === slug)) {
        return res.status(400).json({ error: 'Category with this slug already exists' });
      }

      // Generate unique ID
      const newCategory = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        name,
        slug,
        description: description || '',
        icon: icon || '📁',
        heroImage: heroImage || '',
        pexelsAttribution: pexelsAttribution || '',
        order: categories.length + 1,
        visible: visible !== false,
      };

      categories.push(newCategory);
      await dbUnified.write('categories', categories);

      res.json({
        ok: true,
        category: newCategory,
      });
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ error: 'Failed to create category', details: error.message });
    }
  }
);

// Admin: Update category
app.put(
  '/api/admin/categories/:id',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const categoryId = req.params.id;
      const { name, slug, description, icon, heroImage, pexelsAttribution, visible } = req.body;

      const categories = await dbUnified.read('categories');
      const categoryIndex = categories.findIndex(c => c.id === categoryId);

      if (categoryIndex === -1) {
        return res.status(404).json({ error: 'Category not found' });
      }

      // Check if slug already exists for another category
      if (slug && slug !== categories[categoryIndex].slug) {
        if (categories.find((c, idx) => c.slug === slug && idx !== categoryIndex)) {
          return res.status(400).json({ error: 'Category with this slug already exists' });
        }
      }

      // Update fields
      if (name !== undefined) {
        categories[categoryIndex].name = name;
      }
      if (slug !== undefined) {
        categories[categoryIndex].slug = slug;
      }
      if (description !== undefined) {
        categories[categoryIndex].description = description;
      }
      if (icon !== undefined) {
        categories[categoryIndex].icon = icon;
      }
      if (heroImage !== undefined) {
        categories[categoryIndex].heroImage = heroImage;
      }
      if (pexelsAttribution !== undefined) {
        categories[categoryIndex].pexelsAttribution = pexelsAttribution;
      }
      if (visible !== undefined) {
        categories[categoryIndex].visible = visible;
      }

      await dbUnified.write('categories', categories);

      res.json({
        ok: true,
        category: categories[categoryIndex],
      });
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ error: 'Failed to update category', details: error.message });
    }
  }
);

// Admin: Delete category
app.delete(
  '/api/admin/categories/:id',
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

      const deletedCategory = categories[categoryIndex];
      categories.splice(categoryIndex, 1);

      await dbUnified.write('categories', categories);

      res.json({
        ok: true,
        category: deletedCategory,
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ error: 'Failed to delete category', details: error.message });
    }
  }
);

// Admin: Reorder categories
app.put(
  '/api/admin/categories/reorder',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { orderedIds } = req.body;

      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: 'orderedIds must be an array' });
      }

      const categories = await dbUnified.read('categories');

      // Update order based on position in array
      orderedIds.forEach((id, index) => {
        const category = categories.find(c => c.id === id);
        if (category) {
          category.order = index + 1;
        }
      });

      // Handle orphaned categories (not in orderedIds) - assign them to the end
      const orderedSet = new Set(orderedIds);
      const orphanedCategories = categories.filter(c => !orderedSet.has(c.id));
      orphanedCategories.forEach((category, index) => {
        category.order = orderedIds.length + index + 1;
      });

      // Sort by order
      categories.sort((a, b) => (a.order || 0) - (b.order || 0));

      await dbUnified.write('categories', categories);

      res.json({
        ok: true,
        categories,
      });
    } catch (error) {
      console.error('Error reordering categories:', error);
      res.status(500).json({ error: 'Failed to reorder categories', details: error.message });
    }
  }
);

// Admin: Toggle category visibility
app.put(
  '/api/admin/categories/:id/visibility',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const categoryId = req.params.id;
      const { visible } = req.body;

      if (typeof visible !== 'boolean') {
        return res.status(400).json({ error: 'visible must be a boolean' });
      }

      const categories = await dbUnified.read('categories');
      const categoryIndex = categories.findIndex(c => c.id === categoryId);

      if (categoryIndex === -1) {
        return res.status(404).json({ error: 'Category not found' });
      }

      categories[categoryIndex].visible = visible;

      await dbUnified.write('categories', categories);

      res.json({
        ok: true,
        category: categories[categoryIndex],
      });
    } catch (error) {
      console.error('Error toggling category visibility:', error);
      res.status(500).json({ error: 'Failed to toggle visibility', details: error.message });
    }
  }
);

// Admin: Upload package image moved to routes/packages.js

// ---------- Supplier dashboard ----------
/**
 * GET /api/me/suppliers/:id/analytics
 * Get analytics data for a supplier using real event tracking
 */
// Supplier analytics and badge evaluation routes moved to routes/supplier-management.js

// Mark all suppliers owned by the current user as Pro moved to routes/supplier-management.js

// Supplier CRUD routes (POST, PATCH) moved to routes/supplier-management.js

// Package routes moved to routes/packages.js

// Package routes moved to routes/packages.js

// ---------- CAPTCHA Verification ----------
// (Route extracted to routes/misc.js)

// ---------- Threads & Messages ----------

// ---------- Marketplace Listings ----------

// ---------- Plan & Notes (customer) ----------

// ---------- Settings ----------
// Settings routes (GET/POST /api/me/settings) moved to routes/settings.js
const settingsRoutes = require('./routes/settings');
app.use('/api/me/settings', settingsRoutes);

// ---------- Meta & status ----------
// Meta endpoint moved to routes/system.js

// Lightweight metrics endpoints moved to routes/metrics.js

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

// Admin supplier management routes moved to routes/supplier-admin.js

// Package routes moved to routes/packages.js

// ---------- Protected HTML routes ----------
// Dashboard routes moved to routes/dashboard.js
const dashboardRoutes = require('./routes/dashboard');
app.use('/', dashboardRoutes);

// ---------- Healthcheck & plan save system ----------

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

// saveImageBase64 function moved to routes/suppliers-v2.js and routes/packages.js

// Supplier image upload route moved to routes/suppliers-v2.js

// Package image upload moved to routes/packages.js

// ---------- Advanced Search & Discovery ----------

// ---------- Reviews and Ratings System ----------

// ---------- Photo Upload & Management ----------

// ---------- Photo Upload & Management ----------
// Photo upload routes (upload, batch upload, management, etc.) moved to routes/photos.js
// Mounted via routes/index.js

// ---------- Static & SEO Routes ----------
// Already mounted at line 345

// ---------- Dashboard & Page Routes ----------
// Already mounted at line 2596

// ---------- Auth Routes ----------
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// ---------- Public Maintenance Endpoint (must be before auth checks) ----------
// (Route extracted to routes/system.js)

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

// ---------- AI Routes ----------
const aiRoutes = require('./routes/ai');
app.use('/api/ai', aiRoutes);

// ---------- Payment Routes ----------
const paymentRoutes = require('./routes/payments');
app.use('/api/payments', paymentRoutes);

// ---------- Profile Routes ----------
const profileRoutes = require('./routes/profile');
app.use('/api/profile', profileRoutes);

// ---------- Suppliers V2 Routes ----------
// Suppliers V2 routes (photo gallery) moved to routes/suppliers-v2.js and mounted in routes/index.js

// ---------- Supplier Routes (analytics, trials, etc.) ----------
const supplierRoutes = require('./routes/supplier');
app.use('/api/supplier', supplierRoutes);

// ---------- Notification Routes ----------
const notificationRoutes = require('./routes/notifications');
// WebSocket server will be passed when available (after server starts)
let notificationRouter;
let tempNotificationRouter; // Cache temp router to prevent memory leak
let lastDbInstance; // Track DB instance to detect reconnections
app.use('/api/notifications', async (req, res, next) => {
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

  // CRITICAL FIX: Ensure DB is available before initializing
  // Check if MongoDB is connected before accessing it
  let db = null;
  try {
    if (mongoDb.isConnected()) {
      db = await mongoDb.getDb();
    }
  } catch (error) {
    // DB not available yet
    logger.warn('MongoDB not available for notifications endpoint', { error: error.message });
  }

  if (!db) {
    // If DB is not ready, return 503 instead of crashing in constructor
    // Also clear cached routers since DB is unavailable
    notificationRouter = null;
    tempNotificationRouter = null;
    lastDbInstance = null;
    return res
      .status(503)
      .json({ error: 'Service temporarily unavailable - Database not connected' });
  }

  // Clear routers if DB instance changed (reconnection detected)
  if (lastDbInstance && lastDbInstance !== db) {
    notificationRouter = null;
    tempNotificationRouter = null;
  }
  lastDbInstance = db;

  // Initialize main router if WebSocket is available
  if (!notificationRouter && webSocketServer) {
    notificationRouter = notificationRoutes(db, webSocketServer);
  }

  if (notificationRouter) {
    notificationRouter(req, res, next);
  } else {
    // Fallback if WebSocket not ready yet but DB is ready
    // Cache temp router to prevent memory leak
    if (!tempNotificationRouter) {
      tempNotificationRouter = notificationRoutes(db, null);
    }
    tempNotificationRouter(req, res, next);
  }
});

// ---------- Photo Serving from MongoDB ----------
// GET /api/photos/:id route moved to routes/photos.js

// ---------- Audit Logging ----------
const { auditLog, AUDIT_ACTIONS } = require('./middleware/audit');

// Note: Admin audit endpoints moved to routes/admin.js for consolidation
// GET /api/admin/audit and GET /api/admin/audit-logs are now in routes/admin.js

// Health and ready endpoints moved to routes/system.js

// Cache statistics, database metrics, and CSP reporting endpoints moved to routes/system.js

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
  // System dependencies
  APP_VERSION,
  EMAIL_ENABLED,
  postmark,
  mongoDb,
  dbUnified,
  getToken,

  // Rate limiters
  authLimiter,
  strictAuthLimiter,
  passwordResetLimiter,
  writeLimiter,
  healthCheckLimiter,

  // Authentication & authorization middleware
  authRequired,
  roleRequired,
  getUserFromCookie,
  featureRequired,

  // Security middleware
  csrfProtection,

  // Services & systems
  searchSystem,
  reviewsSystem,
  photoUpload,
  uploadValidation,
  cache,

  // Utilities
  uid,
  logger,
  sentry,
  sendMail,
  verifyHCaptcha,
  geocoding,
  calculateLeadScore,
  supplierIsProActive,
  seed,
  AI_ENABLED,

  // Node.js built-ins for package routes
  path,
  fs,
  DATA_DIR,

  // Analytics
  supplierAnalytics: require('./utils/supplierAnalytics'),
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
    // Note: In production, the app will exit if MongoDB is not properly configured
    (async () => {
      try {
        console.log('   Connecting to database...');
        await dbUnified.initializeDatabase();
        console.log('   ✅ Database connection successful');

        // Verify database connection in production
        // IMPORTANT: This happens after server.listen() to allow health checks during startup,
        // but will terminate the process if production is misconfigured with wrong database.
        // This is intentional - the brief window allows orchestrators to detect the issue
        // without blocking health checks, then the process exits for proper restart.
        if (process.env.NODE_ENV === 'production') {
          console.log('');
          console.log('🔒 Verifying production database configuration...');
          const dbStatus = await dbUnified.getStatus();

          if (dbStatus.backend !== 'mongodb') {
            logger.error('');
            logger.error('❌ CRITICAL: Production is using local file storage instead of MongoDB!');
            logger.error('❌ Data will NOT persist between restarts!');
            logger.error('❌ Check MONGODB_URI environment variable.');
            logger.error('Current status:', dbStatus);
            logger.error('');

            // Fail fast - don't start server with wrong database
            process.exit(1);
          }

          if (!dbStatus.connected) {
            logger.error('');
            logger.error('❌ CRITICAL: MongoDB configured but not connected!');
            logger.error('');
            process.exit(1);
          }

          logger.info('✅ Production database verification passed:', dbStatus);
          console.log('   ✅ MongoDB configured and connected');
          console.log('   ✅ Production database verification passed');
        }

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
