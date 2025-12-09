/* EventFlow v3.3.1 — Rebuilt server.js (clean, validated)
 * Features: Auth (JWT cookie), Suppliers, Packages, Plans/Notes, Threads/Messages,
 * Admin approvals + metrics, Settings, Featured packages, Sitemap.
 * Email: safe dev mode by default (writes .eml files to /outbox).
 */

'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
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
    // eslint-disable-next-line global-require
    const stripeLib = require('stripe');
    stripe = stripeLib(secret);
    STRIPE_ENABLED = true;
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
    // eslint-disable-next-line global-require
    const OpenAI = require('openai');
    openaiClient = new OpenAI({ apiKey });
    AI_ENABLED = true;
  }
} catch (err) {
  console.warn('OpenAI is not configured:', err.message);
}

// Local JSON storage helpers (from ./store.js)
const { read, write, uid, DATA_DIR } = require('./store');

// Photo upload utilities
const photoUpload = require('./photo-upload');

// Reviews and ratings system
const reviewsSystem = require('./reviews');

// Search and discovery system
const searchSystem = require('./search');

// CSRF protection middleware
const { getToken } = require('./middleware/csrf');

// Swagger API documentation
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// Helper: determine if a supplier's Pro plan is currently active.
// - isPro must be true, AND
// - proExpiresAt is either missing/null (no expiry) or in the future.
function supplierIsProActive(s) {
  if (!s || !s.isPro) return false;
  if (!s.proExpiresAt) return !!s.isPro;
  const t = Date.parse(s.proExpiresAt);
  if (!t || isNaN(t)) return !!s.isPro;
  return t > Date.now();
}

const { seed } = require('./seed');

// ---------- Initialisation ----------
seed();

const app = express();
const PDFDocument = require('pdfkit');
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = String(process.env.JWT_SECRET || 'change_me');

if (!JWT_SECRET || JWT_SECRET === 'change_me') {
  console.error('Security error: JWT_SECRET is not set or is still the default. Set JWT_SECRET in your .env file.');
  process.exit(1);
}

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Rate limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false
});

// ---------- Email (safe dev mode) ----------
const EMAIL_ENABLED = String(process.env.EMAIL_ENABLED || 'false').toLowerCase() === 'true';
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@eventflow.local';

// AWS SES Configuration
const AWS_SES_REGION = process.env.AWS_SES_REGION || 'eu-west-2';
const AWS_SES_ACCESS_KEY = process.env.AWS_SES_ACCESS_KEY_ID;
const AWS_SES_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;

let sesClient = null;
let AWS_SES_ENABLED = false;

// Initialize AWS SES if credentials are provided
if (AWS_SES_ACCESS_KEY && AWS_SES_SECRET_KEY) {
  try {
    const AWS = require('aws-sdk');
    AWS.config.update({
      region: AWS_SES_REGION,
      accessKeyId: AWS_SES_ACCESS_KEY,
      secretAccessKey: AWS_SES_SECRET_KEY
    });
    sesClient = new AWS.SES({ apiVersion: '2010-12-01' });
    AWS_SES_ENABLED = true;
    console.log(`AWS SES configured for region: ${AWS_SES_REGION}`);
  } catch (err) {
    console.warn('AWS SES configuration failed:', err.message);
  }
}

/**
 * Optional SendGrid helper:
 * If SENDGRID_API_KEY is set (and no explicit SMTP_HOST), configure SMTP to use SendGrid.
 * This works both locally and in production.
 */
if (!process.env.SMTP_HOST && process.env.SENDGRID_API_KEY && !AWS_SES_ENABLED) {
  process.env.SMTP_HOST = 'smtp.sendgrid.net';
  process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
  // For SendGrid SMTP, the username is always literally 'apikey'
  process.env.SMTP_USER = process.env.SMTP_USER || 'apikey';
  process.env.SMTP_PASS = process.env.SMTP_PASS || process.env.SENDGRID_API_KEY;
}

let transporter = null;

if (EMAIL_ENABLED && process.env.SMTP_HOST && !AWS_SES_ENABLED) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: (process.env.SMTP_USER && process.env.SMTP_PASS)
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
}

// Always save outgoing email to /outbox in dev
function ensureOutbox() {
  const outDir = path.join(DATA_DIR, '..', 'outbox');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
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
  // Support both legacy (to, subject, text) and object-based calls: sendMail({ to, subject, text, html, template, templateData })
  let to = toOrOpts;
  let subj = subject;
  let body = text;
  let html = null;
  let template = null;
  let templateData = {};

  if (toOrOpts && typeof toOrOpts === 'object') {
    to = toOrOpts.to;
    subj = toOrOpts.subject;
    body = toOrOpts.text || '';
    html = toOrOpts.html || null;
    template = toOrOpts.template || null;
    templateData = toOrOpts.templateData || {};
  }

  // Load template if specified
  if (template && !html) {
    html = loadEmailTemplate(template, templateData);
  }

  const outDir = ensureOutbox();
  const safeTo = Array.isArray(to) ? to.join(', ') : to;
  const blob = `To: ${safeTo}\nFrom: ${FROM_EMAIL}\nSubject: ${subj}\n\n${html || body}\n`;
  fs.writeFileSync(path.join(outDir, `email-${Date.now()}.eml`), blob, 'utf8');

  // Try AWS SES first
  if (AWS_SES_ENABLED && sesClient && to) {
    try {
      const params = {
        Source: FROM_EMAIL,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to]
        },
        Message: {
          Subject: {
            Data: subj,
            Charset: 'UTF-8'
          },
          Body: html ? {
            Html: {
              Data: html,
              Charset: 'UTF-8'
            }
          } : {
            Text: {
              Data: body,
              Charset: 'UTF-8'
            }
          }
        }
      };
      
      await sesClient.sendEmail(params).promise();
      console.log(`Email sent via AWS SES to ${safeTo}`);
      return;
    } catch (e) {
      console.error('Error sending email via AWS SES:', e.message);
      // Fall through to SMTP if SES fails
    }
  }

  // Fall back to SMTP/SendGrid
  if (transporter && to) {
    try {
      const mailOptions = {
        from: FROM_EMAIL,
        to,
        subject: subj
      };
      
      if (html) {
        mailOptions.html = html;
        mailOptions.text = body; // Provide text fallback
      } else {
        mailOptions.text = body;
      }
      
      await transporter.sendMail(mailOptions);
      console.log(`Email sent via SMTP to ${safeTo}`);
    } catch (e) {
      console.error('Error sending email via transporter:', e.message);
    }
  }
}

// ---------- Auth helpers ----------
function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: isProd ? 'strict' : 'lax',
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
}

function clearAuthCookie(res) {
  res.clearCookie('token');
}

function getUserFromCookie(req) {
  const t = req.cookies && req.cookies.token;
  if (!t) return null;
  try {
    return jwt.verify(t, JWT_SECRET);
  } catch {
    return null;
  }
}

function authRequired(req, res, next) {
  const u = getUserFromCookie(req);
  if (!u) return res.status(401).json({ error: 'Unauthenticated' });
  req.user = u;
  // Also expose userId for routes that rely on it
  req.userId = u.id;
  next();
}

function roleRequired(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

function passwordOk(pw = '') {
  return (
    typeof pw === 'string' &&
    pw.length >= 8 &&
    /[A-Za-z]/.test(pw) &&
    /\d/.test(pw)
  );
}

// ---------- AUTH ----------
app.post('/api/auth/register', authLimiter, (req, res) => {
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
    sendMail({
      to: user.email,
      subject: 'Confirm your EventFlow account',
      text: `Hi ${user.name || ''},

Please confirm your EventFlow account by visiting:

${verifyUrl}

If you did not create this account, you can ignore this email.`,
    });
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

app.post('/api/auth/login', authLimiter, (req, res) => {
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

app.post('/api/auth/forgot', authLimiter, async (req, res) => {
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
      if (user.email) {
        await sendMail(
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

app.get('/api/auth/verify', (req, res) => {
  const { token } = req.query || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });
  const users = read('users');
  const idx = users.findIndex(u => u.verificationToken === token);
  if (idx === -1) return res.status(400).json({ error: 'Invalid or expired token' });
  users[idx].verified = true;
  delete users[idx].verificationToken;
  write('users', users);
  
  // Send welcome email after successful verification
  const user = users[idx];
  sendMail({
    to: user.email,
    subject: 'Welcome to EventFlow!',
    template: 'welcome',
    templateData: {
      name: user.name || 'there',
      email: user.email,
      role: user.role
    }
  }).catch(e => {
    console.error('Failed to send welcome email', e);
  });
  
  res.json({ ok: true });
});

// CSRF token endpoint - provides token for frontend use
// Apply authLimiter to prevent token exhaustion attacks
app.get('/api/csrf-token', authLimiter, (req, res) => {
  const token = getToken(req);
  res.json({ csrfToken: token });
});

// Admin: list users (without password hashes)
app.get('/api/admin/users', authRequired, roleRequired('admin'), (req, res) => {
  const users = read('users').map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    verified: !!u.verified,
    marketingOptIn: !!u.marketingOptIn,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || null
  }));
  // Sort newest first by createdAt
  users.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  res.json({ items: users });
});

// Admin: export only marketing-opt-in users as CSV
app.get('/api/admin/marketing-export', authRequired, roleRequired('admin'), (req, res) => {
  const users = read('users').filter(u => u.marketingOptIn);
  const header = 'name,email,role\n';
  const rows = users.map(u => {
    const name = (u.name || '').replace(/"/g, '""');
    const email = (u.email || '').replace(/"/g, '""');
    const role = (u.role || '').replace(/"/g, '""');
    return `"${name}","${email}","${role}"`;
  }).join('\n');
  const csv = header + rows + (rows ? '\n' : '');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="eventflow-marketing.csv"');
  res.send(csv);
});

// Admin: export all users as CSV
app.get('/api/admin/users-export', authRequired, roleRequired('admin'), (req, res) => {
  const users = read('users');
  const header = 'id,name,email,role,verified,marketingOptIn,createdAt,lastLoginAt\n';
  const rows = users.map(u => {
    const esc = v => String(v ?? '').replace(/"/g, '""');
    const verified = u.verified ? 'yes' : 'no';
    const marketing = u.marketingOptIn ? 'yes' : 'no';
    return `"${esc(u.id)}","${esc(u.name)}","${esc(u.email)}","${esc(u.role)}","${verified}","${marketing}","${esc(u.createdAt)}","${esc(u.lastLoginAt || '')}"`;
  }).join('\n');
  const csv = header + rows + (rows ? '\n' : '');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="eventflow-users.csv"');
  res.send(csv);
});

// Admin: export all core collections as JSON
app.get('/api/admin/export/all', authRequired, roleRequired('admin'), (_req, res) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    users: read('users'),
    suppliers: read('suppliers'),
    packages: read('packages'),
    plans: read('plans'),
    notes: read('notes'),
    events: read('events'),
    threads: read('threads'),
    messages: read('messages')
  };
  const json = JSON.stringify(payload, null, 2);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="eventflow-export.json"');
  res.send(json);
});

app.post('/api/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const p = getUserFromCookie(req);
  if (!p) return res.json({ user: null });
  const u = read('users').find(x => x.id === p.id);
  res.json({
    user: u
      ? { id: u.id, name: u.name, email: u.email, role: u.role, notify: u.notify !== false }
      : null
  });
});

// ---------- Suppliers (public) ----------
app.get('/api/suppliers', (req, res) => {
  const { category, q, price } = req.query;
  let items = read('suppliers').filter(s => s.approved);
  if (category) items = items.filter(s => s.category === category);
  if (price) items = items.filter(s => (s.price_display || '').includes(price));
  if (q) {
    const qq = String(q).toLowerCase();
    items = items.filter(s =>
      (s.name || '').toLowerCase().includes(qq) ||
      (s.description_short || '').toLowerCase().includes(qq) ||
      (s.location || '').toLowerCase().includes(qq)
    );
  }

  // Mark suppliers that have at least one featured package and compute active Pro flag
  const pkgs = read('packages');
  items = items.map(s => {
    const featuredSupplier = pkgs.some(p => p.supplierId === s.id && p.featured);
    const isProActive = supplierIsProActive(s);
    return {
      ...s,
      featuredSupplier,
      isPro: isProActive,
      proExpiresAt: s.proExpiresAt || null
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
      if (ea === eb) return a._idx - b._idx;
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
app.post('/api/ai/plan', express.json(), async (req, res) => {
  const body = req.body || {};
  const promptText = String(body.prompt || '').trim();
  const plan = body.plan || {};
  const hasOpenAI = AI_ENABLED && !!openaiClient;

  const summaryBits = [];
  if (plan && typeof plan === 'object') {
    if (Array.isArray(plan.guests) && plan.guests.length) {
      summaryBits.push(plan.guests.length + ' guests in the list');
    }
    if (Array.isArray(plan.tasks) && plan.tasks.length) {
      summaryBits.push(plan.tasks.length + ' planning tasks');
    }
    if (Array.isArray(plan.timeline) && plan.timeline.length) {
      summaryBits.push(plan.timeline.length + ' timeline items');
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
    summaryBits.length ? ('- ' + summaryBits.join('\n- ')) : 'No existing plan data.',
    '',
    'Your JSON must use this structure:',
    '{',
    '  "checklist": [ "string task 1", "string task 2" ],',
    '  "timeline": [ { "time": "14:00", "item": "Thing", "owner": "Who" } ],',
    '  "suppliers": [ { "category": "Venues", "suggestion": "Tip or type of supplier" } ],',
    '  "budget": [ { "item": "Venue", "estimate": "£2000" } ],',
    '  "styleIdeas": [ "One-sentence styling idea" ],',
    '  "messages": [ "Friendly message the user could send to a supplier" ]',
    '}'
  ].join('\n');

  if (!hasOpenAI) {
    // Fallback: simple deterministic suggestions so the feature still works without OpenAI configured.
    const fallback = {
      checklist: [
        'Lock in your venue date',
        'Confirm catering numbers and dietary requirements',
        'Book photographer / videographer',
        'Create a draft day-of timeline'
      ],
      timeline: [
        { time: '13:00', item: 'Guests arrive', owner: 'Venue' },
        { time: '14:00', item: 'Ceremony', owner: 'Registrar / celebrant' },
        { time: '15:00', item: 'Drinks reception & photos', owner: 'Venue / photographer' },
        { time: '17:30', item: 'Wedding breakfast', owner: 'Catering' },
        { time: '20:00', item: 'First dance & evening guests', owner: 'Band / DJ' }
      ],
      suppliers: [
        { category: 'Venues', suggestion: 'Shortlist 2–3 venues within 30 minutes of where most guests live.' },
        { category: 'Catering', suggestion: 'Ask for sample menus that cover vegan and gluten-free options.' },
        { category: 'Photography', suggestion: 'Look for photographers who have shot at your chosen venue before.' }
      ],
      budget: [
        { item: 'Venue & hire', estimate: '≈ 40% of your total budget' },
        { item: 'Food & drink', estimate: '≈ 25% of your total budget' },
        { item: 'Photography / video', estimate: '≈ 10–15% of your total budget' }
      ],
      styleIdeas: [
        'Soft green and white palette with lots of candlelight.',
        'Personal touches like table names based on places you have travelled together.'
      ],
      messages: [
        'Hi! We are planning a wedding around [DATE] for around [GUESTS] guests near [LOCATION]. Are you available, and could you share a sample package or pricing?',
        'Hi! We love your work and are planning an event in [MONTH/YEAR]. Could you let us know your availability and typical pricing for this kind of day?'
      ]
    };
    return res.json({ from: 'fallback', data: fallback });
  }

  try {
    const completion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: 'You are a concise, practical wedding and event planning assistant.' },
        { role: 'user', content: basePrompt }
      ],
      temperature: 0.6
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
      parsed = { checklist: [], timeline: [], suppliers: [], budget: [], styleIdeas: [], messages: [] };
    }
    return res.json({ from: 'openai', data: parsed });
  } catch (err) {
    console.error('OpenAI planning error', err);
    return res.status(500).json({ error: 'AI planning request failed.' });
  }
});

// Admin-only: auto-categorisation & scoring for suppliers
app.post('/api/admin/suppliers/smart-tags', authRequired, roleRequired('admin'), async (req, res) => {
  const all = read('suppliers');
  const now = new Date().toISOString();
  const updated = [];

  all.forEach(s => {
    const tags = [];
    if (s.category) tags.push(s.category);
    if (Array.isArray(s.amenities)) {
      s.amenities.slice(0, 3).forEach(a => tags.push(a));
    }
    if (s.location) tags.push(s.location.split(',')[0].trim());

    let score = 40;
    if (Array.isArray(s.photos) && s.photos.length) score += 20;
    if ((s.description_short || '').length > 40) score += 15;
    if ((s.description_long || '').length > 80) score += 15;
    if (Array.isArray(s.amenities) && s.amenities.length >= 3) score += 10;
    if (score > 100) score = 100;

    s.aiTags = tags;
    s.aiScore = score;
    s.aiUpdatedAt = now;
    updated.push({ id: s.id, aiTags: tags, aiScore: score });
  });

  write('suppliers', all);
  res.json({ ok: true, items: updated, aiEnabled: AI_ENABLED });
});

app.get('/api/suppliers/:id', (req, res) => {
  const sRaw = read('suppliers').find(x => x.id === req.params.id && x.approved);
  if (!sRaw) return res.status(404).json({ error: 'Not found' });

  const pkgs = read('packages');
  const featuredSupplier = pkgs.some(p => p.supplierId === sRaw.id && p.featured);
  const isProActive = supplierIsProActive(sRaw);
  const s = {
    ...sRaw,
    featuredSupplier,
    isPro: isProActive,
    proExpiresAt: sRaw.proExpiresAt || null
  };

  res.json(s);
});

app.get('/api/suppliers/:id/packages', (req, res) => {
  const supplier = read('suppliers').find(x => x.id === req.params.id && x.approved);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  const pkgs = read('packages').filter(p => p.supplierId === supplier.id && p.approved);
  res.json({ items: pkgs });
});

app.get('/api/packages/featured', (_req, res) => {
  const items = read('packages')
    .filter(p => p.approved)
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 6);
  res.json({ items });
});

app.get('/api/packages/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const items = read('packages').filter(
    p =>
      p.approved &&
      (
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      )
  );
  res.json({ items });
});

// ---------- Supplier dashboard ----------
app.get('/api/me/suppliers', authRequired, roleRequired('supplier'), (req, res) => {
  const listRaw = read('suppliers').filter(s => s.ownerUserId === req.user.id);
  const list = listRaw.map(s => ({
    ...s,
    isPro: supplierIsProActive(s),
    proExpiresAt: s.proExpiresAt || null
  }));
  res.json({ items: list });
});

// Mark all suppliers owned by the current user as Pro
app.post('/api/me/subscription/upgrade', authRequired, roleRequired('supplier'), (req, res) => {
  const suppliers = read('suppliers');
  let changed = 0;
  suppliers.forEach(s => {
    if (s.ownerUserId === req.user.id) {
      if (!s.isPro) {
        s.isPro = true;
        changed += 1;
      }
    }
  });
  write('suppliers', suppliers);

  // Optionally also mirror this onto the user record if present
  try {
    const users = read('users');
    const u = users.find(u => u.id === req.user.id);
    if (u) {
      u.isPro = true;
      write('users', users);
    }
  } catch (_e) {
    // ignore if users store is not present
  }

  res.json({ ok: true, updatedSuppliers: changed });
});

app.post('/api/me/suppliers', writeLimiter, authRequired, roleRequired('supplier'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.category) return res.status(400).json({ error: 'Missing fields' });
  const photos = (b.photos
    ? (Array.isArray(b.photos) ? b.photos : String(b.photos).split(/\r?\n/))
    : [])
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
    email: ((read('users').find(u => u.id === req.user.id) || {}).email) || '',
    approved: false
  };
  const all = read('suppliers');
  all.push(s);
  write('suppliers', all);
  res.json({ ok: true, supplier: s });
});

app.patch('/api/me/suppliers/:id', writeLimiter, authRequired, roleRequired('supplier'), (req, res) => {
  const all = read('suppliers');
  const i = all.findIndex(s => s.id === req.params.id && s.ownerUserId === req.user.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};

  const fields = [
    'name',
    'category',
    'location',
    'price_display',
    'website',
    'license',
    'description_short',
    'description_long'
  ];
  for (const k of fields) {
    if (typeof b[k] === 'string') all[i][k] = b[k];
  }

  if (b.amenities) {
    all[i].amenities = String(b.amenities)
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);
  }
  if (b.maxGuests != null) all[i].maxGuests = parseInt(b.maxGuests, 10) || 0;
  if (b.photos) {
    const photos = (Array.isArray(b.photos)
      ? b.photos
      : String(b.photos).split(/\r?\n/))
      .map(x => String(x).trim())
      .filter(Boolean);
    if (photos.length) all[i].photos = photos;
  }
  all[i].approved = false;
  write('suppliers', all);
  res.json({ ok: true, supplier: all[i] });
});

app.get('/api/me/packages', authRequired, roleRequired('supplier'), (req, res) => {
  const mine = read('suppliers')
    .filter(s => s.ownerUserId === req.user.id)
    .map(s => s.id);
  const items = read('packages').filter(p => mine.includes(p.supplierId));
  res.json({ items });
});

app.post('/api/me/packages', writeLimiter, authRequired, roleRequired('supplier'), (req, res) => {
  const { supplierId, title, description, price, image } = req.body || {};
  if (!supplierId || !title) return res.status(400).json({ error: 'Missing fields' });
  const own = read('suppliers').find(
    s => s.id === supplierId && s.ownerUserId === req.user.id
  );
  if (!own) return res.status(403).json({ error: 'Forbidden' });

  const ownIsPro = supplierIsProActive(own);

  // Enforce a simple Free vs Pro package limit:
  // - Free suppliers can create up to FREE_PACKAGE_LIMIT packages (default 3)
  // - Pro suppliers have no limit
  const allPkgs = read('packages');
  const existingForSupplier = allPkgs.filter(p => p.supplierId === supplierId);
  const freeLimit = Number(process.env.FREE_PACKAGE_LIMIT || 3);
  if (!ownIsPro && existingForSupplier.length >= freeLimit) {
    return res.status(403).json({
      error: `Free suppliers can create up to ${freeLimit} packages. Upgrade to Pro to add more.`
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
    featured: false
  };
  const all = allPkgs;
  all.push(pkg);
  write('packages', all);
  res.json({ ok: true, package: pkg });
});

// ---------- Threads & Messages ----------
app.post('/api/threads/start', writeLimiter, authRequired, async (req, res) => {
  const { supplierId, message, eventType, eventDate, location, guests } = req.body || {};
  if (!supplierId) return res.status(400).json({ error: 'Missing supplierId' });
  const supplier = read('suppliers').find(s => s.id === supplierId && s.approved);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const threads = read('threads');
  let thread = threads.find(
    t => t.supplierId === supplierId && t.customerId === req.user.id
  );
  if (!thread) {
    thread = {
      id: uid('thd'),
      supplierId,
      supplierName: supplier.name,
      customerId: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventType: eventType || null,
      eventDate: eventDate || null,
      eventLocation: location || null,
      guests: guests || null
    };
    threads.push(thread);
    write('threads', threads);
  }

  // If an initial message was included, create it immediately
  if (message && String(message).trim()) {
    const msgs = read('messages');
    const entry = {
      id: uid('msg'),
      threadId: thread.id,
      fromUserId: req.user.id,
      text: String(message).slice(0, 4000),
      createdAt: new Date().toISOString()
    };
    msgs.push(entry);
    write('messages', msgs);

    // Update thread timestamp
    const allThreads = read('threads');
    const idx = allThreads.findIndex(t => t.id === thread.id);
    if (idx >= 0) {
      allThreads[idx].updatedAt = entry.createdAt;
      write('threads', allThreads);
    }
  }

  // Email notify supplier (safe IIFE)
  (async () => {
    try {
      const customer = read('users').find(u => u.id === req.user.id);
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

app.get('/api/threads/my', authRequired, (req, res) => {
  const ts = read('threads');
  let items = [];
  if (req.user.role === 'customer') {
    items = ts.filter(t => t.customerId === req.user.id);
  } else if (req.user.role === 'supplier') {
    const mine = read('suppliers')
      .filter(s => s.ownerUserId === req.user.id)
      .map(s => s.id);
    items = ts.filter(t => mine.includes(t.supplierId));
  } else if (req.user.role === 'admin') {
    items = ts;
  }
  const msgs = read('messages');
  items = items.map(t => ({
    ...t,
    last: msgs
      .filter(m => m.threadId === t.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null
  }));
  res.json({ items });
});

app.get('/api/threads/:id/messages', authRequired, (req, res) => {
  const t = read('threads').find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Thread not found' });
  if (req.user.role !== 'admin' && t.customerId !== req.user.id) {
    const own = read('suppliers').find(
      s => s.id === t.supplierId && s.ownerUserId === req.user.id
    );
    if (!own) return res.status(403).json({ error: 'Forbidden' });
  }
  const msgs = read('messages')
    .filter(m => m.threadId === t.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json({ items: msgs });
});

app.post('/api/threads/:id/messages', writeLimiter, authRequired, (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Missing text' });
  const t = read('threads').find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Thread not found' });
  if (req.user.role !== 'admin' && t.customerId !== req.user.id) {
    const own = read('suppliers').find(
      s => s.id === t.supplierId && s.ownerUserId === req.user.id
    );
    if (!own) return res.status(403).json({ error: 'Forbidden' });
  }
  const msgs = read('messages');
  const entry = {
    id: uid('msg'),
    threadId: t.id,
    fromUserId: req.user.id,
    fromRole: req.user.role,
    text: String(text).slice(0, 4000),
    createdAt: new Date().toISOString()
  };
  msgs.push(entry);
  write('messages', msgs);

  // Update thread timestamp
  const th = read('threads');
  const i = th.findIndex(x => x.id === t.id);
  if (i >= 0) {
    th[i].updatedAt = entry.createdAt;
    write('threads', th);
  }

  // Email notify other party (safe IIFE)
  (async () => {
    try {
      const otherEmail =
        (req.user.role === 'customer')
          ? (((read('suppliers').find(s => s.id === t.supplierId) || {}).email) || null)
          : (((read('users').find(u => u.id === t.customerId) || {}).email) || null);
      const me = read('users').find(u => u.id === req.user.id);
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
});

// ---------- Plan & Notes (customer) ----------
app.get('/api/plan', authRequired, (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const plans = read('plans').filter(p => p.userId === req.user.id);
  const suppliers = read('suppliers').filter(s => s.approved);
  const items = plans
    .map(p => suppliers.find(s => s.id === p.supplierId))
    .filter(Boolean);
  res.json({ items });
});

app.post('/api/plan', authRequired, (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const { supplierId } = req.body || {};
  if (!supplierId) return res.status(400).json({ error: 'Missing supplierId' });
  const s = read('suppliers').find(x => x.id === supplierId && x.approved);
  if (!s) return res.status(404).json({ error: 'Supplier not found' });
  const all = read('plans');
  if (!all.find(p => p.userId === req.user.id && p.supplierId === supplierId)) {
    all.push({
      id: uid('pln'),
      userId: req.user.id,
      supplierId,
      createdAt: new Date().toISOString()
    });
  }
  write('plans', all);
  res.json({ ok: true });
});

app.delete('/api/plan/:supplierId', authRequired, (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const all = read('plans').filter(
    p => !(p.userId === req.user.id && p.supplierId === req.params.supplierId)
  );
  write('plans', all);
  res.json({ ok: true });
});

app.get('/api/notes', authRequired, (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const n = read('notes').find(x => x.userId === req.user.id);
  res.json({ text: (n && n.text) || '' });
});

app.post('/api/notes', authRequired, (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const all = read('notes');
  const i = all.findIndex(x => x.userId === req.user.id);
  if (i >= 0) {
    all[i].text = String((req.body && req.body.text) || '');
    all[i].updatedAt = new Date().toISOString();
  } else {
    all.push({
      id: uid('nte'),
      userId: req.user.id,
      text: String((req.body && req.body.text) || ''),
      createdAt: new Date().toISOString()
    });
  }
  write('notes', all);
  res.json({ ok: true });
});

// ---------- Settings ----------
app.get('/api/me/settings', authRequired, (req, res) => {
  const users = read('users');
  const i = users.findIndex(u => u.id === req.user.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  res.json({ notify: users[i].notify !== false });
});

app.post('/api/me/settings', authRequired, (req, res) => {
  const users = read('users');
  const i = users.findIndex(u => u.id === req.user.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  users[i].notify = !!(req.body && req.body.notify);
  write('users', users);
  res.json({ ok: true, notify: users[i].notify });
});

// ---------- Meta & status ----------
app.get('/api/meta', (_req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    node: process.version,
    env: process.env.NODE_ENV || 'development'
  });
});

// Lightweight metrics endpoints (no-op by default)
app.post('/api/metrics/track', (req, res) => {
  // In a real deployment you could log req.body here.
  res.json({ ok: true });
});

// Simple synthetic timeseries for admin charts
app.get('/api/admin/metrics/timeseries', authRequired, roleRequired('admin'), (_req, res) => {
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
      plans: 1 + (i % 3)
    });
  }
  res.json({ series });
});

// ---------- Admin ----------
app.get('/api/admin/metrics', authRequired, roleRequired('admin'), (_req, res) => {
  const users = read('users');
  const suppliers = read('suppliers');
  const plans = read('plans');
  const msgs = read('messages');
  const pkgs = read('packages');
  const threads = read('threads');
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
      threadsTotal: threads.length
    }
  });
});

app.post('/api/admin/reset-demo', authRequired, roleRequired('admin'), (req, res) => {
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
      'events'
    ];
    collections.forEach(name => write(name, []));
    seed();
    res.json({ ok: true });
  } catch (err) {
    console.error('Reset demo failed', err);
    res.status(500).json({ error: 'Reset demo failed' });
  }
});

app.get('/api/admin/suppliers', authRequired, roleRequired('admin'), (_req, res) => {
  const raw = read('suppliers');
  const items = raw.map(s => ({
    ...s,
    isPro: supplierIsProActive(s),
    proExpiresAt: s.proExpiresAt || null
  }));
  res.json({ items });
});

app.post('/api/admin/suppliers/:id/approve', authRequired, roleRequired('admin'), (req, res) => {
  const all = read('suppliers');
  const i = all.findIndex(s => s.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  all[i].approved = !!(req.body && req.body.approved);
  write('suppliers', all);
  res.json({ ok: true, supplier: all[i] });
});

app.post('/api/admin/suppliers/:id/pro', authRequired, roleRequired('admin'), (req, res) => {
  const { mode, duration } = req.body || {};
  const all = read('suppliers');
  const i = all.findIndex(s => s.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });

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
      const users = read('users');
      const u = users.find(u => u.id === s.ownerUserId);
      if (u) {
        u.isPro = !!s.isPro;
        write('users', users);
      }
    }
  } catch (_e) {
    // ignore errors from user store
  }

  all[i] = s;
  write('suppliers', all);

  const active = supplierIsProActive(s);
  res.json({
    ok: true,
    supplier: {
      ...s,
      isPro: active,
      proExpiresAt: s.proExpiresAt || null
    }
  });
});

app.get('/api/admin/packages', authRequired, roleRequired('admin'), (_req, res) => {
  res.json({ items: read('packages') });
});

app.post('/api/admin/packages/:id/approve', authRequired, roleRequired('admin'), (req, res) => {
  const all = read('packages');
  const i = all.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  all[i].approved = !!(req.body && req.body.approved);
  write('packages', all);
  res.json({ ok: true, package: all[i] });
});

app.post('/api/admin/packages/:id/feature', authRequired, roleRequired('admin'), (req, res) => {
  const all = read('packages');
  const i = all.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  all[i].featured = !!(req.body && req.body.featured);
  write('packages', all);
  res.json({ ok: true, package: all[i] });
});

// ---------- Sitemap ----------
app.get('/sitemap.xml', (_req, res) => {
  const base = `http://localhost:${PORT}`;
  const suppliers = read('suppliers')
    .filter(s => s.approved)
    .map(s => `${base}/supplier.html?id=${s.id}`);
  const urls = [
    `${base}/`,
    `${base}/suppliers.html`,
    `${base}/start.html`,
    `${base}/plan.html`,
    `${base}/auth.html`,
    ...suppliers
  ];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(u => `<url><loc>${u}</loc></url>`),
    '</urlset>'
  ].join('');
  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

// ---------- Protected HTML routes ----------
const sendHTML = (res, file) => res.sendFile(path.join(__dirname, 'public', file));

app.get('/dashboard/customer', authRequired, (req, res) => {
  if (req.user.role !== 'customer') return res.redirect('/auth.html');
  sendHTML(res, 'dashboard-customer.html');
});

app.get('/dashboard/supplier', authRequired, (req, res) => {
  if (req.user.role !== 'supplier') return res.redirect('/auth.html');
  sendHTML(res, 'dashboard-supplier.html');
});

app.get('/admin', authRequired, (req, res) => {
  if (req.user.role !== 'admin') return res.redirect('/auth.html');
  sendHTML(res, 'admin.html');
});

// ---------- Healthcheck & plan save system ----------

// --- PLAN SAVE SYSTEM ---
function planOwnerOnly(req, res, next) {
  if (!req.userId) return res.status(403).json({ error: 'Not logged in' });
  next();
}

app.post('/api/me/plan/save', authRequired, planOwnerOnly, (req, res) => {
  const { plan } = req.body || {};
  if (!plan) return res.status(400).json({ error: 'Missing plan' });
  const plans = read('plans');
  let p = plans.find(x => x.userId === req.userId);
  if (!p) {
    p = { id: uid('pln'), userId: req.userId, plan };
    plans.push(p);
  } else {
    p.plan = plan;
  }
  write('plans', plans);
  res.json({ ok: true, plan: p });
});

app.get('/api/me/plan', authRequired, planOwnerOnly, (req, res) => {
  const plans = read('plans');
  const p = plans.find(x => x.userId === req.userId);
  if (!p) return res.json({ ok: true, plan: null });
  res.json({ ok: true, plan: p.plan });
});

// --- PDF EXPORT ---
app.get('/api/plan/export/pdf', authRequired, planOwnerOnly, async (req, res) => {
  const plans = read('plans');
  const p = plans.find(x => x.userId === req.userId);
  if (!p) return res.status(400).json({ error: 'No plan saved' });

  const suppliers = read('suppliers');
  const packages = read('packages'); // currently unused, but kept for future detail

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=event_plan.pdf');

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(22).text('EventFlow — Event Plan', { align: 'center' });
  doc.moveDown();
  doc.fontSize(14).text('Generated: ' + new Date().toLocaleString());
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
  const dirs = [
    UP_ROOT,
    path.join(UP_ROOT, 'suppliers'),
    path.join(UP_ROOT, 'packages')
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}
ensureDirs();

function saveImageBase64(base64, ownerType, ownerId) {
  try {
    const match = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    const ext = match[1].split('/')[1];
    const buffer = Buffer.from(match[2], 'base64');
    const folder = path.join(UP_ROOT, ownerType, ownerId);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const filename = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
    const filePath = path.join(folder, filename);
    fs.writeFileSync(filePath, buffer);
    return '/uploads/' + ownerType + '/' + ownerId + '/' + filename;
  } catch (e) {
    return null;
  }
}

// Supplier image upload
app.post('/api/me/suppliers/:id/photos', authRequired, (req, res) => {
  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Missing image' });
  const suppliers = read('suppliers');
  const s = suppliers.find(x => x.id === req.params.id && x.ownerUserId === req.userId);
  if (!s) return res.status(403).json({ error: 'Not owner' });
  const url = saveImageBase64(image, 'suppliers', req.params.id);
  if (!url) return res.status(400).json({ error: 'Invalid image' });
  if (!s.photosGallery) s.photosGallery = [];
  s.photosGallery.push({ url, approved: false, uploadedAt: Date.now() });
  write('suppliers', suppliers);
  res.json({ ok: true, url });
});

// Package image upload
app.post('/api/me/packages/:id/photos', authRequired, (req, res) => {
  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Missing image' });
  const pkgs = read('packages');
  const p = pkgs.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const suppliers = read('suppliers');
  const own = suppliers.find(x => x.id === p.supplierId && x.ownerUserId === req.userId);
  if (!own) return res.status(403).json({ error: 'Not owner' });
  const url = saveImageBase64(image, 'packages', req.params.id);
  if (!url) return res.status(400).json({ error: 'Invalid image' });
  if (!p.gallery) p.gallery = [];
  p.gallery.push({ url, approved: false, uploadedAt: Date.now() });
  write('packages', pkgs);
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
app.post('/api/reviews', authRequired, async (req, res) => {
  try {
    const { supplierId, rating, comment, eventType, eventDate } = req.body;

    // Validate input
    if (!supplierId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid input. Rating must be between 1 and 5.' });
    }

    // Check if supplier exists
    const suppliers = await read('suppliers');
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get user info
    const users = await read('users');
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
app.post('/api/reviews/:reviewId/helpful', async (req, res) => {
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
app.post('/api/admin/reviews/:reviewId/approve', authRequired, roleRequired('admin'), async (req, res) => {
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
});

/**
 * Delete a review
 * DELETE /api/reviews/:reviewId
 */
app.delete('/api/reviews/:reviewId', authRequired, async (req, res) => {
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
app.post('/api/photos/upload', authRequired, photoUpload.upload.single('photo'), async (req, res) => {
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
      const suppliers = await read('suppliers');
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

      await write('suppliers', suppliers);
      
      return res.json({
        success: true,
        photo: photoRecord,
        message: 'Photo uploaded successfully. Pending admin approval.',
      });
    } else if (type === 'package') {
      const packages = await read('packages');
      const pkg = packages.find(p => p.id === id);
      
      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }

      // Check if user owns this package's supplier
      const suppliers = await read('suppliers');
      const supplier = suppliers.find(s => s.id === pkg.supplierId);
      
      if (!supplier || (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Add to gallery
      if (!pkg.gallery) {
        pkg.gallery = [];
      }
      pkg.gallery.push(photoRecord);

      await write('packages', packages);
      
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
});

/**
 * Upload multiple photos (batch upload)
 * POST /api/photos/upload/batch
 * Body: multipart/form-data with 'photos' field (multiple files)
 * Query: ?type=supplier|package&id=<supplierId|packageId>
 */
app.post('/api/photos/upload/batch', authRequired, photoUpload.upload.array('photos', 10), async (req, res) => {
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
      const suppliers = await read('suppliers');
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

      await write('suppliers', suppliers);
    } else if (type === 'package') {
      const packages = await read('packages');
      const pkg = packages.find(p => p.id === id);
      
      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }

      const suppliers = await read('suppliers');
      const supplier = suppliers.find(s => s.id === pkg.supplierId);
      
      if (!supplier || (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (!pkg.gallery) {
        pkg.gallery = [];
      }
      pkg.gallery.push(...uploadedPhotos);

      await write('packages', packages);
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
});

/**
 * Delete photo
 * DELETE /api/photos/:photoUrl
 * Query: ?type=supplier|package&id=<supplierId|packageId>
 */
app.delete('/api/photos/delete', authRequired, async (req, res) => {
  try {
    const { type, id, photoUrl } = req.query;
    
    if (!type || !id || !photoUrl) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const decodedUrl = decodeURIComponent(photoUrl);

    if (type === 'supplier') {
      const suppliers = await read('suppliers');
      const supplier = suppliers.find(s => s.id === id);
      
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      if (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (supplier.photosGallery) {
        supplier.photosGallery = supplier.photosGallery.filter(p => p.url !== decodedUrl);
        await write('suppliers', suppliers);
        
        // Delete physical files
        await photoUpload.deleteImage(decodedUrl);
      }
    } else if (type === 'package') {
      const packages = await read('packages');
      const pkg = packages.find(p => p.id === id);
      
      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }

      const suppliers = await read('suppliers');
      const supplier = suppliers.find(s => s.id === pkg.supplierId);
      
      if (!supplier || (supplier.ownerUserId !== req.user.id && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (pkg.gallery) {
        pkg.gallery = pkg.gallery.filter(p => p.url !== decodedUrl);
        await write('packages', packages);
        
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
app.post('/api/photos/approve', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const { type, id, photoUrl, approved } = req.body;
    
    if (!type || !id || !photoUrl || typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (type === 'supplier') {
      const suppliers = await read('suppliers');
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
          await write('suppliers', suppliers);
        }
      }
    } else if (type === 'package') {
      const packages = await read('packages');
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
          await write('packages', packages);
        }
      }
    }

    res.json({ 
      success: true, 
      message: approved ? 'Photo approved' : 'Photo rejected' 
    });
  } catch (error) {
    console.error('Approve photo error:', error);
    res.status(500).json({ error: 'Failed to approve photo', details: error.message });
  }
});

/**
 * Crop image
 * POST /api/photos/crop
 * Body: { imageUrl, cropData: { x, y, width, height } }
 */
app.post('/api/photos/crop', authRequired, async (req, res) => {
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
    const suppliers = await read('suppliers');
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
    const packages = await read('packages');
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
app.put('/api/photos/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, altText, tags, isFeatured, watermark } = req.body;
    
    const metadata = await photoUpload.updatePhotoMetadata(id, {
      caption,
      altText,
      tags,
      isFeatured,
      watermark
    });
    
    res.json({
      success: true,
      metadata,
      message: 'Photo metadata updated successfully'
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
app.post('/api/photos/:id/replace', authRequired, photoUpload.upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { metadata } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }
    
    const result = await photoUpload.replacePhoto(id, req.file.buffer, JSON.parse(metadata || '{}'));
    
    res.json({
      success: true,
      photo: result,
      message: 'Photo replaced successfully'
    });
  } catch (error) {
    console.error('Replace photo error:', error);
    res.status(500).json({ error: 'Failed to replace photo', details: error.message });
  }
});

/**
 * POST /api/photos/bulk-edit
 * Bulk update multiple photos
 */
app.post('/api/photos/bulk-edit', authRequired, async (req, res) => {
  try {
    const { photos } = req.body;
    
    if (!Array.isArray(photos)) {
      return res.status(400).json({ error: 'Photos must be an array' });
    }
    
    const results = await Promise.all(
      photos.map(photo => 
        photoUpload.updatePhotoMetadata(photo.id, photo.metadata)
      )
    );
    
    res.json({
      success: true,
      updated: results.length,
      photos: results,
      message: `${results.length} photo(s) updated successfully`
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
app.post('/api/photos/:id/filters', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl, brightness, contrast, saturation } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }
    
    const result = await photoUpload.applyFilters(imageUrl, {
      brightness: parseFloat(brightness) || 1,
      contrast: parseFloat(contrast) || 1,
      saturation: parseFloat(saturation) || 1
    });
    
    res.json({
      success: true,
      image: result,
      message: 'Filters applied successfully'
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
app.post('/api/photos/reorder', authRequired, async (req, res) => {
  try {
    const { photoOrder } = req.body;
    
    if (!Array.isArray(photoOrder)) {
      return res.status(400).json({ error: 'Photo order must be an array' });
    }
    
    const result = await photoUpload.updatePhotoOrder(photoOrder);
    
    res.json({
      success: true,
      order: result,
      message: 'Photo order updated successfully'
    });
  } catch (error) {
    console.error('Reorder photos error:', error);
    res.status(500).json({ error: 'Failed to reorder photos', details: error.message });
  }
});

// ---------- Content Reporting System ----------
const reportsRoutes = require('./routes/reports');
app.use('/api', reportsRoutes);

// ---------- Audit Logging ----------
const { getAuditLogs } = require('./middleware/audit');

/**
 * GET /api/admin/audit-logs
 * Get audit logs with optional filtering
 */
app.get('/api/admin/audit-logs', authRequired, roleRequired('admin'), (req, res) => {
  const { adminId, action, targetType, targetId, startDate, endDate, limit } = req.query;
  
  const logs = getAuditLogs({
    adminId,
    action,
    targetType,
    targetId,
    startDate,
    endDate,
    limit: limit ? parseInt(limit, 10) : 100
  });
  
  res.json({ logs, count: logs.length });
});

// Basic API healthcheck
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    status: 'online',
    time: new Date().toISOString()
  });
});

// ---------- Static & 404 ----------
// API Documentation (Swagger UI)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'EventFlow API Documentation',
}));

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

server.listen(PORT, () => {
  console.log(`EventFlow ${APP_VERSION} server running → http://localhost:${PORT}`);
  console.log(`WebSocket server initialized for real-time features`);
});
