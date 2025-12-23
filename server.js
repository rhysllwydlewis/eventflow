/* EventFlow v3.3.1 — Rebuilt server.js (clean, validated)
 * Features: Auth (JWT cookie), Suppliers, Packages, Plans/Notes, Threads/Messages,
 * Admin approvals + metrics, Settings, Featured packages, Sitemap.
 * Email: safe dev mode by default (writes .eml files to /outbox).
 *
 * PRODUCTION DEPLOYMENT:
 * - Server performs startup health checks before accepting requests
 * - Cloud database (MongoDB Atlas or Firebase) is RECOMMENDED but not required
 * - Falls back to local JSON storage if no cloud database is configured
 * - LOCAL STORAGE WARNING: Data is non-persistent and will be lost on restart
 * - Email service is optional but recommended for production
 * - Rejects localhost MongoDB URIs in production
 * - Exits with error code 1 if critical security configuration is missing (JWT_SECRET, BASE_URL)
 * - Logs warnings for optional/recommended services (database, email, Stripe, OpenAI)
 *
 * TROUBLESHOOTING 502 ERRORS:
 * - Check server startup logs for validation errors
 * - If using MongoDB, ensure MONGODB_URI points to cloud database (not localhost)
 * - Verify BASE_URL matches your actual domain
 * - Email service (Postmark) is optional - warnings logged if not configured
 * - Check /api/health endpoint for service status
 */

'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const nodemailer = require('nodemailer');

const APP_VERSION = 'v17.0.0';

require('dotenv').config();

let stripe = null;
let STRIPE_ENABLED = false;
try {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (secret) {
    // Lazy-load Stripe so the app still runs if the dependency is missing.
    // Install with: npm install stripe
    // Uses Stripe's default API version.
    // eslint-disable-next-line global-require, node/no-missing-require
    const stripeLib = require('stripe');
    stripe = stripeLib(secret);
    STRIPE_ENABLED = true;
    // Note: stripe variable is initialized for future payment integration
  }
} catch (err) {
  console.warn('Stripe is not configured:', err.message);
}

let openaiClient = null;
let AI_ENABLED = false;
try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    // Lazy-load OpenAI so the app still runs if the dependency is missing.
    // Install with: npm install openai
    // eslint-disable-next-line global-require, node/no-missing-require
    const OpenAI = require('openai');
    openaiClient = new OpenAI({ apiKey });
    AI_ENABLED = true;
  }
} catch (err) {
  console.warn('OpenAI is not configured:', err.message);
}

// Data access layer - MongoDB-first with local storage fallback
const dbUnified = require('./db-unified');
const { uid, DATA_DIR } = require('./store');

// Postmark email utility
const postmark = require('./utils/postmark');

// Database modules for startup validation
const mongoDb = require('./db');
const { isMongoAvailable } = mongoDb;

// Photo upload utilities
const photoUpload = require('./photo-upload');

// Reviews and ratings system
const reviewsSystem = require('./reviews');

// Search and discovery system
const searchSystem = require('./search');

// CSRF protection middleware
const { csrfProtection, getToken } = require('./middleware/csrf');

// Swagger API documentation
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// Constants for user management
const VALID_USER_ROLES = ['customer', 'supplier', 'admin'];
const MAX_NAME_LENGTH = 80;

// Helper: determine if a supplier's Pro plan is currently active.
// - isPro must be true, AND
// - proExpiresAt is either missing/null (no expiry) or in the future.
function supplierIsProActive(s) {
  if (!s || !s.isPro) {
    return false;
  }
  if (!s.proExpiresAt) {
    return !!s.isPro;
  }
  const t = Date.parse(s.proExpiresAt);
  if (!t || isNaN(t)) {
    return !!s.isPro;
  }
  return t > Date.now();
}

const { seed } = require('./seed');

// ---------- Initialisation ----------
// Seed will be called after database initialization during startup
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const PDFDocument = require('pdfkit');
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = String(process.env.JWT_SECRET || 'change_me');

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
  console.error('');
  console.error('❌ SECURITY ERROR: Invalid JWT_SECRET');
  console.error('');

  if (!JWT_SECRET) {
    console.error('   JWT_SECRET is not set in your environment.');
  } else if (hasPlaceholder) {
    console.error('   JWT_SECRET contains placeholder values that must be replaced.');
  } else if (JWT_SECRET.length < 32) {
    console.error(`   JWT_SECRET is too short (${JWT_SECRET.length} characters).`);
    console.error('   A secure JWT_SECRET must be at least 32 characters long.');
  }

  console.error('');
  console.error('🔧 To generate a secure JWT_SECRET, run:');
  console.error('   openssl rand -base64 32');
  console.error('');
  console.error('   Then add it to your .env file:');
  console.error('   JWT_SECRET=<your-generated-secret>');
  console.error('');
  process.exit(1);
}

// Configure trust proxy for Railway and other reverse proxies
// This enables proper IP detection for rate limiting and X-Forwarded-* headers
const trustProxyEnv = process.env.TRUST_PROXY?.toLowerCase();
const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
const shouldTrustProxy = trustProxyEnv === 'true' || (isRailway && trustProxyEnv !== 'false');

if (shouldTrustProxy) {
  app.set('trust proxy', 1);
  console.log('🔧 Trust proxy: enabled (running behind proxy/load balancer)');
} else {
  console.log('🔧 Trust proxy: disabled (local development mode)');
}

app.disable('x-powered-by');

// Force HTTPS redirect in production (fixes 3.2s latency from HTTP→HTTPS redirect)
if (isProduction) {
  app.use((req, res, next) => {
    // Skip HTTPS redirect for health check and readiness endpoints
    // This allows platform health probes (Railway, etc.) to work over HTTP
    if (req.path === '/api/health' || req.path === '/api/ready') {
      return next();
    }

    // Check if request is not secure (HTTP)
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

    if (!isSecure) {
      // Redirect to HTTPS
      const httpsUrl = process.env.BASE_URL || `https://${req.headers.host}`;
      const redirectUrl = `${httpsUrl}${req.url}`;
      return res.redirect(301, redirectUrl);
    }

    // Check for non-www to www redirect (only if BASE_URL contains www)
    const configuredBaseUrl = process.env.BASE_URL || '';
    if (
      configuredBaseUrl.includes('www.') &&
      req.headers.host &&
      !req.headers.host.startsWith('www.')
    ) {
      const wwwUrl = `https://www.${req.headers.host}${req.url}`;
      return res.redirect(301, wwwUrl);
    }

    next();
  });
}

// Enhanced CSP headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-eval'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://cdn.tidycal.net',
          'https://estatic.com',
          'https://*.estatic.com',
          'https://maps.googleapis.com',
          'https://*.googleapis.com',
          'https://maps.gstatic.com',
          'https://*.gstatic.com',
          'https://googletagmanager.com',
          'https://*.googletagmanager.com',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://fonts.googleapis.com',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: [
          "'self'",
          'https:',
          'https://googletagmanager.com',
          'https://*.googletagmanager.com',
          'https://*.google-analytics.com',
          'https://*.analytics.google.com',
          'https://*.tidycal.net',
        ],
        frameSrc: [
          "'self'",
          'https://www.google.com',
          'https://maps.google.com',
          'https://tidycal.com',
          'https://*.tidycal.com',
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// CORS Configuration - Allow credentials and proper origins for www subdomain
// This fixes 403 Forbidden errors when frontend and backend are on different subdomains
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Get allowed origins from BASE_URL environment variable
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const allowedOrigins = [baseUrl];

    // If BASE_URL contains www, also allow non-www version and vice versa
    if (baseUrl.includes('www.')) {
      allowedOrigins.push(baseUrl.replace('www.', ''));
    } else if (baseUrl.includes('://')) {
      const [protocol, domain] = baseUrl.split('://');
      allowedOrigins.push(`${protocol}://www.${domain}`);
    }

    // For development, allow localhost on any port
    if (!isProduction) {
      allowedOrigins.push('http://localhost:3000');
      allowedOrigins.push('http://localhost:3001');
      allowedOrigins.push('http://127.0.0.1:3000');
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins but log warning
      console.warn(`CORS request from non-configured origin: ${origin}`);
    }
  },
  credentials: true, // Allow cookies to be sent with requests
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

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

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Rate limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests. Please try again later.',
});
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many password reset attempts. Please try again later.',
});
const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check rate limiter - generous limits for monitoring tools
const healthCheckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (once per second)
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many health check requests',
});

// ---------- Email Configuration ----------
// Postmark is the only supported email provider
const EMAIL_ENABLED = String(process.env.EMAIL_ENABLED || 'false').toLowerCase() === 'true';
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@eventflow.local';

// Note: Postmark configuration is handled by utils/postmark.js
// This section is kept minimal as email is now exclusively via Postmark

// Validate production environment
if (process.env.NODE_ENV === 'production') {
  const required = {
    BASE_URL: process.env.BASE_URL,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error(
      `Production error: Missing required environment variables: ${missing.join(', ')}`
    );
    console.error('Please set these in your .env file before deploying.');
    process.exit(1);
  }

  // Warn about email configuration but don't block startup
  if (EMAIL_ENABLED) {
    const postmarkUtil = require('./utils/postmark');
    if (!postmarkUtil.isPostmarkEnabled()) {
      console.warn('Warning: EMAIL_ENABLED=true but Postmark is not configured.');
      console.warn('Set POSTMARK_API_KEY in your .env file.');
      console.warn('Emails will be saved to /outbox folder until Postmark is configured.');
    }
    if (!process.env.FROM_EMAIL) {
      console.warn('Warning: FROM_EMAIL not set. Using default value: no-reply@eventflow.local');
    }
  }
}

// Always save outgoing email to /outbox in dev
function ensureOutbox() {
  const outDir = path.join(DATA_DIR, '..', 'outbox');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  return outDir;
}

/**
 * Helper function to load and process email templates
 * @param {string} templateName - Name of template file (without .html extension)
 * @param {object} data - Data to replace in template
 * @returns {string} Processed HTML
 */
function loadEmailTemplate(templateName, data) {
  try {
    const templatePath = path.join(__dirname, 'email-templates', `${templateName}.html`);
    if (!fs.existsSync(templatePath)) {
      return null;
    }
    let html = fs.readFileSync(templatePath, 'utf8');

    // Simple template replacement
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, data[key] || '');
    });

    // Add current year
    html = html.replace(/{{year}}/g, new Date().getFullYear());

    // Add base URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    html = html.replace(/{{baseUrl}}/g, baseUrl);

    return html;
  } catch (err) {
    console.error('Error loading email template:', err);
    return null;
  }
}

async function sendMail(toOrOpts, subject, text) {
  // Postmark is the only email provider - delegate to utils/postmark.js
  const postmarkUtil = require('./utils/postmark');

  // Support both legacy (to, subject, text) and object-based calls
  let options = {};

  if (toOrOpts && typeof toOrOpts === 'object') {
    options = toOrOpts;
  } else {
    options = {
      to: toOrOpts,
      subject: subject,
      text: text,
    };
  }

  // Delegate to Postmark utility
  return postmarkUtil.sendMail(options);
}

// ---------- Auth helpers ----------
function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: isProd ? 'lax' : 'lax', // Changed from 'strict' to 'lax' for better cross-domain support
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

function clearAuthCookie(res) {
  res.clearCookie('token');
}

function getUserFromCookie(req) {
  const t = req.cookies && req.cookies.token;
  if (!t) {
    return null;
  }
  try {
    return jwt.verify(t, JWT_SECRET);
  } catch {
    return null;
  }
}

function authRequired(req, res, next) {
  const u = getUserFromCookie(req);
  if (!u) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  req.user = u;
  // Also expose userId for routes that rely on it
  req.userId = u.id;
  next();
}

function roleRequired(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

/**
 * Middleware to check if database is ready
 * Returns 503 if database is not connected
 * Use this for routes that require database access
 */
function dbRequired(req, res, next) {
  const isMongoConnected = mongoDb.isConnected && mongoDb.isConnected();

  if (!isMongoConnected) {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'Database is not connected. Please try again in a moment.',
      retry: true,
    });
  }

  next();
}

function passwordOk(pw = '') {
  return typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

// ---------- AUTH ----------
app.post('/api/auth/register', strictAuthLimiter, csrfProtection, async (req, res) => {
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

  const users = await dbUnified.read('users');
  if (users.find(u => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const user = {
    id: uid('usr'),
    name: String(name).trim().slice(0, MAX_NAME_LENGTH),
    email: String(email).toLowerCase(),
    role: roleFinal,
    passwordHash: bcrypt.hashSync(password, 10),
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
  } catch (e) {
    console.error('Failed to send verification email', e);

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
  const { email, password } = req.body || {};
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

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
  setAuthCookie(res, token);

  res.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
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
  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }
  const users = await dbUnified.read('users');
  const idx = users.findIndex(u => u.verificationToken === token);
  if (idx === -1) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  // Check if token has expired
  if (
    users[idx].verificationTokenExpiresAt &&
    new Date(users[idx].verificationTokenExpiresAt) < new Date()
  ) {
    return res.status(400).json({
      error: 'Verification link has expired. Please request a new one.',
      expired: true,
    });
  }

  users[idx].verified = true;
  delete users[idx].verificationToken;
  delete users[idx].verificationTokenExpiresAt;
  await dbUnified.write('users', users);

  // Send welcome email after successful verification
  const user = users[idx];
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
    console.error('Failed to send welcome email', e);
  });

  res.json({ ok: true });
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

    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to resend verification email', e);
    return res.status(500).json({
      error: 'Failed to send verification email. Please try again later.',
    });
  }
});

// CSRF token endpoint - provides token for frontend use
// Apply authLimiter to prevent token exhaustion attacks
app.get('/api/csrf-token', authLimiter, async (req, res) => {
  const token = getToken(req);
  res.json({ csrfToken: token });
});

// Client config endpoint - provides public configuration values
// Apply rate limiting to prevent abuse of API key exposure
app.get('/api/config', authLimiter, async (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    version: APP_VERSION,
  });
});

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
    return res.json({ user: null });
  }
  const u = (await dbUnified.read('users')).find(x => x.id === p.id);
  res.json({
    user: u
      ? { id: u.id, name: u.name, email: u.email, role: u.role, notify: u.notify !== false }
      : null,
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
  const items = (await dbUnified.read('packages'))
    .filter(p => p.approved && isFeaturedPackage(p))
    .slice(0, 6);
  res.json({ items });
});

app.get('/api/packages/search', async (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const items = (await dbUnified.read('packages')).filter(
    p =>
      p.approved &&
      ((p.title || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
  );
  res.json({ items });
});

// ---------- Category browsing endpoints ----------
app.get('/api/categories', async (_req, res) => {
  const categories = await dbUnified.read('categories');
  const sorted = categories.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ items: sorted });
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

      // Process and save the image
      const imageData = await photoUpload.processAndSaveImage(
        req.file.buffer,
        req.file.originalname
      );

      // Update category with new hero image URL
      categories[categoryIndex].heroImage = imageData.optimized || imageData.large;

      await dbUnified.write('categories', categories);

      res.json({
        ok: true,
        category: categories[categoryIndex],
        imageUrl: categories[categoryIndex].heroImage,
      });
    } catch (error) {
      console.error('Error uploading category hero image:', error);
      res.status(500).json({ error: 'Failed to upload image', details: error.message });
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

      // Process and save the image
      const imageData = await photoUpload.processAndSaveImage(
        req.file.buffer,
        req.file.originalname
      );

      // Update package with new image URL
      packages[packageIndex].image = imageData.optimized || imageData.large;
      packages[packageIndex].updatedAt = new Date().toISOString();

      await dbUnified.write('packages', packages);

      res.json({
        ok: true,
        package: packages[packageIndex],
        imageUrl: packages[packageIndex].image,
      });
    } catch (error) {
      console.error('Error uploading package image:', error);
      res.status(500).json({ error: 'Failed to upload image', details: error.message });
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
      photos: photos.length
        ? photos
        : [`https://source.unsplash.com/featured/800x600/?event,${encodeURIComponent(b.category)}`],
      email: ((await dbUnified.read('users')).find(u => u.id === req.user.id) || {}).email || '',
      approved: false,
    };
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
  async (req, res) => {
    const all = await dbUnified.read('suppliers');
    const i = all.findIndex(s => s.id === req.params.id && s.ownerUserId === req.user.id);
    if (i < 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    const b = req.body || {};

    const fields = [
      'name',
      'category',
      'location',
      'price_display',
      'website',
      'license',
      'description_short',
      'description_long',
    ];
    for (const k of fields) {
      if (typeof b[k] === 'string') {
        all[i][k] = b[k];
      }
    }

    if (b.amenities) {
      all[i].amenities = String(b.amenities)
        .split(',')
        .map(x => x.trim())
        .filter(Boolean);
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
    const { supplierId, title, description, price, image } = req.body || {};
    if (!supplierId || !title) {
      return res.status(400).json({ error: 'Missing fields' });
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
      image: image || 'https://source.unsplash.com/featured/800x600/?package,event',
      approved: false,
      featured: false,
    };
    const all = allPkgs;
    all.push(pkg);
    await dbUnified.write('packages', all);
    res.json({ ok: true, package: pkg });
  }
);

// ---------- Threads & Messages ----------
app.post('/api/threads/start', writeLimiter, authRequired, csrfProtection, async (req, res) => {
  const { supplierId, packageId, message, eventType, eventDate, location, guests } = req.body || {};
  if (!supplierId) {
    return res.status(400).json({ error: 'Missing supplierId' });
  }
  const supplier = (await dbUnified.read('suppliers')).find(s => s.id === supplierId && s.approved);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

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
app.get('/api/meta', async (_req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    node: process.version,
    env: process.env.NODE_ENV || 'development',
  });
});

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

// ---------- Sitemap ----------
app.get('/sitemap.xml', async (_req, res) => {
  const base = `http://localhost:${PORT}`;
  const suppliers = (await dbUnified.read('suppliers'))
    .filter(s => s.approved)
    .map(s => `${base}/supplier.html?id=${s.id}`);
  const urls = [
    `${base}/`,
    `${base}/suppliers.html`,
    `${base}/start.html`,
    `${base}/plan.html`,
    `${base}/auth.html`,
    ...suppliers,
  ];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(u => `<url><loc>${u}</loc></url>`),
    '</urlset>',
  ].join('');
  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

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

// --- PDF EXPORT ---
app.get('/api/plan/export/pdf', authRequired, planOwnerOnly, async (req, res) => {
  const plans = await dbUnified.read('plans');
  const p = plans.find(x => x.userId === req.userId);
  if (!p) {
    return res.status(400).json({ error: 'No plan saved' });
  }

  const suppliers = await dbUnified.read('suppliers');
  const packages = await dbUnified.read('packages'); // currently unused, but kept for future detail

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
app.post('/api/me/suppliers/:id/photos', authRequired, csrfProtection, async (req, res) => {
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
});

// Package image upload
app.post('/api/me/packages/:id/photos', authRequired, csrfProtection, async (req, res) => {
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
});

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
 * Create a review for a supplier
 * POST /api/reviews
 * Body: { supplierId, rating, comment, eventType, eventDate }
 */
app.post('/api/reviews', authRequired, csrfProtection, async (req, res) => {
  try {
    const { supplierId, rating, comment, eventType, eventDate } = req.body;

    // Validate input
    if (!supplierId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid input. Rating must be between 1 and 5.' });
    }

    // Check if supplier exists
    const suppliers = await await dbUnified.read('suppliers');
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get user info
    const users = await await dbUnified.read('users');
    const user = users.find(u => u.id === req.user.id);

    // Create review
    const review = await reviewsSystem.createReview({
      supplierId,
      userId: req.user.id,
      userName: user.name || 'Anonymous',
      rating: Number(rating),
      comment: comment || '',
      eventType: eventType || '',
      eventDate: eventDate || '',
      verified: false, // TODO: Check if user actually booked this supplier
    });

    res.json({
      success: true,
      review,
      message: 'Review submitted successfully. Pending admin approval.',
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review', details: error.message });
  }
});

/**
 * Get reviews for a supplier
 * GET /api/reviews/supplier/:supplierId
 */
app.get('/api/reviews/supplier/:supplierId', async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { minRating, sortBy } = req.query;

    const reviews = await reviewsSystem.getSupplierReviews(supplierId, {
      approvedOnly: true,
      minRating: minRating ? Number(minRating) : undefined,
      sortBy: sortBy || 'date',
    });

    res.json({
      success: true,
      count: reviews.length,
      reviews,
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
 * Mark review as helpful
 * POST /api/reviews/:reviewId/helpful
 */
app.post('/api/reviews/:reviewId/helpful', csrfProtection, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await reviewsSystem.markHelpful(reviewId);

    res.json({
      success: true,
      review,
      message: 'Thank you for your feedback!',
    });
  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get pending reviews (admin only)
 * GET /api/admin/reviews/pending
 */
app.get('/api/admin/reviews/pending', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const pending = await reviewsSystem.getPendingReviews();

    res.json({
      success: true,
      count: pending.length,
      reviews: pending,
    });
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({ error: 'Failed to get pending reviews', details: error.message });
  }
});

/**
 * Approve or reject a review (admin only)
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

      const review = await reviewsSystem.approveReview(reviewId, approved, req.user.id);

      res.json({
        success: true,
        review,
        message: approved ? 'Review approved' : 'Review rejected',
      });
    } catch (error) {
      console.error('Approve review error:', error);
      res.status(500).json({ error: error.message });
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
 * Upload single photo for supplier or package
 * POST /api/photos/upload
 * Body: multipart/form-data with 'photo' field
 * Query: ?type=supplier|package&id=<supplierId|packageId>
 */
app.post(
  '/api/photos/upload',
  authRequired,
  photoUpload.upload.single('photo'),
  csrfProtection,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { type, id } = req.query;
      if (!type || !id) {
        return res.status(400).json({ error: 'Missing type or id parameter' });
      }

      // Process and save image
      const images = await photoUpload.processAndSaveImage(req.file.buffer, req.file.originalname);

      // Get metadata
      const metadata = await photoUpload.getImageMetadata(req.file.buffer);

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
        const suppliers = await await dbUnified.read('suppliers');
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

        await await dbUnified.write('suppliers', suppliers);

        return res.json({
          success: true,
          photo: photoRecord,
          message: 'Photo uploaded successfully. Pending admin approval.',
        });
      } else if (type === 'package') {
        const packages = await await dbUnified.read('packages');
        const pkg = packages.find(p => p.id === id);

        if (!pkg) {
          return res.status(404).json({ error: 'Package not found' });
        }

        // Check if user owns this package's supplier
        const suppliers = await await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === pkg.supplierId);

        if (!supplier || (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin')) {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Add to gallery
        if (!pkg.gallery) {
          pkg.gallery = [];
        }
        pkg.gallery.push(photoRecord);

        await await dbUnified.write('packages', packages);

        return res.json({
          success: true,
          photo: photoRecord,
          message: 'Photo uploaded successfully. Pending admin approval.',
        });
      } else {
        return res.status(400).json({ error: 'Invalid type. Must be supplier or package.' });
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
 * Query: ?type=supplier|package&id=<supplierId|packageId>
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
          const images = await photoUpload.processAndSaveImage(file.buffer, file.originalname);
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

      // Update supplier or package with new photos
      if (type === 'supplier') {
        const suppliers = await await dbUnified.read('suppliers');
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

        await await dbUnified.write('suppliers', suppliers);
      } else if (type === 'package') {
        const packages = await await dbUnified.read('packages');
        const pkg = packages.find(p => p.id === id);

        if (!pkg) {
          return res.status(404).json({ error: 'Package not found' });
        }

        const suppliers = await await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === pkg.supplierId);

        if (!supplier || (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin')) {
          return res.status(403).json({ error: 'Not authorized' });
        }

        if (!pkg.gallery) {
          pkg.gallery = [];
        }
        pkg.gallery.push(...uploadedPhotos);

        await await dbUnified.write('packages', packages);
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
      const suppliers = await await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.id === id);

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      if (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (supplier.photosGallery) {
        supplier.photosGallery = supplier.photosGallery.filter(p => p.url !== decodedUrl);
        await await dbUnified.write('suppliers', suppliers);

        // Delete physical files
        await photoUpload.deleteImage(decodedUrl);
      }
    } else if (type === 'package') {
      const packages = await await dbUnified.read('packages');
      const pkg = packages.find(p => p.id === id);

      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }

      const suppliers = await await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.id === pkg.supplierId);

      if (!supplier || (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (pkg.gallery) {
        pkg.gallery = pkg.gallery.filter(p => p.url !== decodedUrl);
        await await dbUnified.write('packages', packages);

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
        const suppliers = await await dbUnified.read('suppliers');
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
            await await dbUnified.write('suppliers', suppliers);
          }
        }
      } else if (type === 'package') {
        const packages = await await dbUnified.read('packages');
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
            await await dbUnified.write('packages', packages);
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
    const suppliers = await await dbUnified.read('suppliers');
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
    const packages = await await dbUnified.read('packages');
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

// ---------- Maintenance Mode ----------
// Extract user from cookie for all requests (optional - doesn't block if not authenticated)
app.use((req, res, next) => {
  const u = getUserFromCookie(req);
  if (u) {
    req.user = u;
    req.userId = u.id;
  }
  next();
});

// Maintenance mode check - blocks non-admin users if enabled
const maintenanceMode = require('./middleware/maintenance');
app.use(maintenanceMode);

// ---------- Auth Routes ----------
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// ---------- Admin Routes ----------
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// ---------- Content Reporting System ----------
const reportsRoutes = require('./routes/reports');
app.use('/api', reportsRoutes);

// ---------- Audit Logging ----------
const { getAuditLogs, auditLog, AUDIT_ACTIONS } = require('./middleware/audit');

/**
 * GET /api/admin/audit-logs
 * Get audit logs with optional filtering
 */
app.get('/api/admin/audit-logs', authRequired, roleRequired('admin'), async (req, res) => {
  const { adminId, action, targetType, targetId, startDate, endDate, limit } = req.query;

  const logs = getAuditLogs({
    adminId,
    action,
    targetType,
    targetId,
    startDate,
    endDate,
    limit: limit ? parseInt(limit, 10) : 100,
  });

  res.json({ logs, count: logs.length });
});

// Basic API healthcheck with rate limiting
app.get('/api/health', healthCheckLimiter, async (_req, res) => {
  // Server is always "ok" if it's running and accepting requests
  // Database status is reported as a service status, not overall health
  const timestamp = new Date().toISOString();

  // Determine email status
  let emailStatus = 'disabled';
  if (EMAIL_ENABLED) {
    emailStatus = postmark.isPostmarkEnabled() ? 'postmark' : 'disabled';
  }

  // Initialize response with server status
  const response = {
    status: 'ok', // Always ok if server is running
    timestamp,
    services: {
      server: 'running',
    },
  };

  // Check MongoDB connection status (non-blocking)
  try {
    const mongoState = mongoDb.getConnectionState ? mongoDb.getConnectionState() : null;
    const mongoError = mongoDb.getConnectionError ? mongoDb.getConnectionError() : null;

    if (mongoState) {
      // Map MongoDB states to service status
      if (mongoState === 'connected') {
        response.services.mongodb = 'connected';
      } else if (mongoState === 'connecting') {
        response.services.mongodb = 'connecting';
        response.status = 'degraded'; // Server is degraded while DB is connecting
      } else if (mongoState === 'error') {
        response.services.mongodb = 'disconnected';
        response.status = 'degraded';
        if (mongoError) {
          response.services.mongodbError = mongoError;
          response.services.lastConnectionError = mongoError; // For debugging
        }
      } else {
        response.services.mongodb = 'disconnected';
      }
    } else {
      // Fallback for older db.js without state tracking
      response.services.mongodb = mongoDb.isConnected() ? 'connected' : 'disconnected';
    }
  } catch (error) {
    // If MongoDB check fails, report it but still return healthy
    response.services.mongodb = 'unknown';
    response.services.mongodbError = error.message;
    response.services.lastConnectionError = error.message;
    response.status = 'degraded';
  }

  // Check database status from unified layer and determine active backend
  try {
    const dbStatus = dbUnified.getDatabaseStatus ? dbUnified.getDatabaseStatus() : null;

    if (dbStatus) {
      response.services.database = dbStatus.type;
      response.services.activeBackend = dbStatus.type; // mongodb or local

      // Determine database status based on state
      if (dbStatus.connected) {
        response.services.databaseStatus = 'connected';
      } else if (dbStatus.state === 'in_progress') {
        response.services.databaseStatus = 'initializing';
        response.status = 'degraded';
      } else {
        response.services.databaseStatus = 'disconnected';
      }

      if (dbStatus.error) {
        response.services.databaseError = dbStatus.error;
        if (!response.services.lastConnectionError) {
          response.services.lastConnectionError = dbStatus.error;
        }
      }
    } else {
      // Fallback for older db-unified versions
      response.services.database = dbUnified.getDatabaseType
        ? dbUnified.getDatabaseType()
        : 'unknown';
      response.services.databaseStatus = 'unknown';
      response.services.activeBackend = response.services.database;
    }
  } catch (error) {
    response.services.database = 'unknown';
    response.services.databaseError = error.message;
    response.services.activeBackend = 'unknown';
  }

  // Add additional service information
  response.version = APP_VERSION;
  response.environment = process.env.NODE_ENV || 'development';
  response.email = emailStatus;

  // Check Postmark status (non-critical)
  if (postmark.isPostmarkEnabled()) {
    const postmarkStatus = postmark.getPostmarkStatus();
    response.services.emailStatus = 'configured';
    response.services.postmarkFrom = postmarkStatus.domain;
  } else {
    response.services.emailStatus = EMAIL_ENABLED ? 'not_configured' : 'disabled';
  }

  // Always return 200 OK - Railway health checks should pass immediately
  // even if database is still connecting (degraded state)
  res.status(200).json(response);
});

// Readiness check endpoint - returns 200 only when MongoDB is connected
// Use this for load balancers, uptime monitors, or readiness probes
app.get('/api/ready', healthCheckLimiter, async (_req, res) => {
  const timestamp = new Date().toISOString();

  // Check if MongoDB is actually connected
  const isMongoConnected = mongoDb.isConnected && mongoDb.isConnected();
  const mongoState = mongoDb.getConnectionState ? mongoDb.getConnectionState() : 'disconnected';
  const mongoError = mongoDb.getConnectionError ? mongoDb.getConnectionError() : null;

  // Get active backend from unified database layer
  let activeBackend = 'unknown';
  try {
    const dbStatus = dbUnified.getDatabaseStatus ? dbUnified.getDatabaseStatus() : null;
    if (dbStatus) {
      activeBackend = dbStatus.type; // 'mongodb' or 'local'
    }
  } catch (error) {
    // Ignore errors in determining backend
  }

  if (!isMongoConnected) {
    return res.status(503).json({
      status: 'not_ready',
      timestamp,
      reason: 'Database not connected',
      details: mongoError || 'MongoDB connection is not established',
      services: {
        server: 'running',
        mongodb: mongoState,
        activeBackend: activeBackend,
      },
      debug: {
        mongoState: mongoState,
        lastConnectionError: mongoError,
        message:
          'Server is operational but MongoDB is not connected. Using fallback storage if configured.',
      },
    });
  }

  // MongoDB is connected, server is ready
  return res.status(200).json({
    status: 'ready',
    timestamp,
    services: {
      server: 'running',
      mongodb: 'connected',
      activeBackend: 'mongodb',
    },
    message: 'All systems operational',
  });
});

// ---------- Static & 404 ----------
// API Documentation (Swagger UI)
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'EventFlow API Documentation',
  })
);

// Static assets with caching strategy (fixes poor cache headers)
// Cache immutable assets for 1 year, other assets for 1 hour
app.use((req, res, next) => {
  // Skip caching for HTML files (they might change more often)
  if (req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return next();
  }

  // Cache versioned assets (with hash in filename) for 1 year
  if (req.path.match(/\.[0-9a-f]{8,}\.(css|js|jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot)$/i)) {
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

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use((_req, res) => res.status(404).send('Not found'));

// ---------- Start ----------
const http = require('http');
const server = http.createServer(app);

// Initialize WebSocket server
const WebSocketServer = require('./websocket-server');
const wsServer = new WebSocketServer(server);

// Make wsServer available to routes if needed
app.set('wsServer', wsServer);

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
      if (!isMongoAvailable()) {
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
      console.log('WebSocket server initialized for real-time features');
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
          console.warn('   Set MAILGUN_API_KEY and MAILGUN_DOMAIN in your .env file');
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

// Start the server with proper initialization
startServer().catch(error => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
