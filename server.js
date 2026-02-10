/* EventFlow v18.1.0 — Refactored server.js (modular architecture)
 *
 * ARCHITECTURE OVERVIEW:
 * This file is the main entry point for the EventFlow application.
 * All route handlers have been extracted to the routes/ directory for better maintainability.
 *
 * KEY FEATURES:
 * - Authentication: JWT cookie-based auth with role-based access control
 * - Database: MongoDB-first with local storage fallback (via dbUnified)
 * - Security: CSRF protection, rate limiting, input sanitization, Helmet.js
 * - Real-time: WebSocket support for notifications and messaging
 * - Payments: Stripe integration for subscriptions
 * - AI: OpenAI integration for event planning assistance (optional)
 * - Email: Postmark for transactional emails, dev mode writes to /outbox
 *
 * STRUCTURE:
 * 1. Dependencies & Configuration
 * 2. Middleware Setup (security, logging, parsing, sessions)
 * 3. Database Connection
 * 4. Route Mounting (all routes are in routes/ modules)
 * 5. Error Handling
 * 6. Server Startup
 *
 * ROUTE MODULES (routes/):
 * - auth.js: Registration, login, logout, password reset
 * - admin.js: Admin operations (exports, metrics, settings)
 * - admin-user-management.js: User management (CRUD, roles, impersonation)
 * - admin-config.js: Badge and category management
 * - packages.js: Package CRUD operations
 * - suppliers.js: Supplier management
 * - messaging.js: Thread and message operations
 * - notifications.js: User notifications
 * - ai.js: AI-powered event planning
 * - reviews.js: Review and rating system
 * - media.js: Photo upload and management
 * - discovery.js: Trending and recommendations
 * - search.js: Search functionality
 * - and more... (see routes/index.js for complete list)
 *
 * DEVELOPMENT:
 * - Run with: npm run dev
 * - Test with: npm test
 * - Lint with: npm run lint
 */

'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

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

// Constants
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

// ==================== ROUTE MOUNTING ====================
// All API routes have been extracted to the routes/ directory
// Routes are mounted via routes/index.js mountRoutes() function

// Public routes (no authentication required)
const publicRoutes = require('./routes/public');
app.use('/api/public', publicRoutes);

// Settings routes
const settingsRoutes = require('./routes/settings');
app.use('/api/me/settings', settingsRoutes);

// Dashboard routes (protected HTML routes)
const dashboardRoutes = require('./routes/dashboard');
app.use('/', dashboardRoutes);

// ==================== IMAGE STORAGE ====================
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

// ==================== ADDITIONAL ROUTES ====================
// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Webhook routes
const webhookRoutes = require('./routes/webhooks');
app.use('/api/webhooks', webhookRoutes);

// Admin routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Admin user management routes
const adminUserManagementRoutes = require('./routes/admin-user-management');
app.use('/api/admin', adminUserManagementRoutes);

// Admin V2 routes (RBAC with granular permissions)
const adminV2Routes = require('./routes/admin-v2');
app.use('/api/v2/admin', adminV2Routes);

// Reports routes
const reportsRoutes = require('./routes/reports');
app.use('/api', reportsRoutes);

// Tickets routes
const ticketsRoutes = require('./routes/tickets');
app.use('/api/tickets', ticketsRoutes);

// Pexels image search routes
const pexelsRoutes = require('./routes/pexels');
app.use('/api/pexels', pexelsRoutes);

// AI routes
const aiRoutes = require('./routes/ai');
if (aiRoutes.initializeDependencies) {
  aiRoutes.initializeDependencies({
    openaiClient,
    AI_ENABLED,
    csrfProtection,
  });
}
app.use('/api/ai', aiRoutes);

// Payment routes
const paymentRoutes = require('./routes/payments');
app.use('/api/payments', paymentRoutes);

// Profile routes
const profileRoutes = require('./routes/profile');
app.use('/api/profile', profileRoutes);

// Supplier routes
const supplierRoutes = require('./routes/supplier');
app.use('/api/supplier', supplierRoutes);

// Audit logging middleware
const { auditLog, AUDIT_ACTIONS } = require('./middleware/audit');

// Subscription and Payment V2 routes
const subscriptionsV2Routes = require('./routes/subscriptions-v2');
app.use('/api/v2/subscriptions', subscriptionsV2Routes);
app.use('/api/v2', subscriptionsV2Routes); // For /api/v2/invoices, /api/v2/admin, and /api/v2/webhooks/stripe

// Reviews V2 routes
const reviewsV2Routes = require('./routes/reviews-v2');
app.use('/api/v2/reviews', reviewsV2Routes);

// ==================== WEBSOCKET SERVER ACCESSOR ====================
// Forward declaration of function to get WebSocket server
// The actual WebSocket servers (wsServer, wsServerV2) are initialized later after HTTP server creation
/**
 * Get the current WebSocket server based on WEBSOCKET_MODE
 * Used by notification routes to access WebSocket for real-time delivery
 * @returns {Object|null} WebSocket server instance or null if not initialized
 */
function getWebSocketServer() {
  const wsMode = (process.env.WEBSOCKET_MODE || 'v2').toLowerCase();
  if (wsMode === 'v2') {
    return global.wsServerV2 || null;
  } else if (wsMode === 'v1') {
    return global.wsServer || null;
  }
  return null;
}

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
  auditLog,

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
  getWebSocketServer,

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
