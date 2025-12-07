/* EventFlow v16.3.9 — Fixed email verification system
 * Changes:
 * - Better email error handling with user feedback
 * - Clearer dev vs production email setup
 * - Fixed verification flow
 * - Better logging for debugging
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

const APP_VERSION = 'v16.3.9';

require('dotenv').config();

let stripe = null;
let STRIPE_ENABLED = false;
try {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (secret) {
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
    const OpenAI = require('openai');
    openaiClient = new OpenAI({ apiKey });
    AI_ENABLED = true;
  }
} catch (err) {
  console.warn('OpenAI is not configured:', err.message);
}

const { read, write, uid, DATA_DIR } = require('./store');

function supplierIsProActive(s) {
  if (!s || !s.isPro) return false;
  if (!s.proExpiresAt) return !!s.isPro;
  var t = Date.parse(s.proExpiresAt);
  if (!t || isNaN(t)) return !!s.isPro;
  return t > Date.now();
}

const { seed } = require('./seed');

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

const authLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 80,  standardHeaders: true, legacyHeaders: false });

// ---------- IMPROVED EMAIL SYSTEM ----------

// Check if we're in production (Railway or other hosting)
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;

// Enable email by default in production
const EMAIL_ENABLED = String(process.env.EMAIL_ENABLED || (IS_PRODUCTION ? 'true' : 'false')).toLowerCase() === 'true';

const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@eventflow.local';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

console.log('📧 Email configuration:');
console.log('  - Environment:', IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT');
console.log('  - Email enabled:', EMAIL_ENABLED);
console.log('  - From address:', FROM_EMAIL);
console.log('  - Base URL:', BASE_URL);

// Auto-configure SendGrid if API key is present
if (!process.env.SMTP_HOST && process.env.SENDGRID_API_KEY) {
  process.env.SMTP_HOST = 'smtp.sendgrid.net';
  process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
  process.env.SMTP_USER = process.env.SMTP_USER || 'apikey';
  process.env.SMTP_PASS = process.env.SMTP_PASS || process.env.SENDGRID_API_KEY;
  console.log('  - Using SendGrid SMTP');
}

let transporter = null;

if (EMAIL_ENABLED && process.env.SMTP_HOST) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: (process.env.SMTP_USER && process.env.SMTP_PASS) ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    });
    console.log('  - SMTP transporter configured for', process.env.SMTP_HOST);
    
    // Verify connection
    transporter.verify(function(error, success) {
      if (error) {
        console.error('  ⚠️  SMTP verification failed:', error.message);
      } else {
        console.log('  ✓ SMTP connection verified');
      }
    });
  } catch (err) {
    console.error('  ⚠️  Failed to create SMTP transporter:', err.message);
  }
} else {
  console.log('  - Dev mode: emails will be saved to /outbox folder');
}

function ensureOutbox() {
  const outDir = path.join(DATA_DIR, '..', 'outbox');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}

async function sendMail(toOrOpts, subject, text) {
  let to = toOrOpts;
  let subj = subject;
  let body = text;

  if (toOrOpts && typeof toOrOpts === 'object') {
    to = toOrOpts.to;
    subj = toOrOpts.subject;
    body = toOrOpts.text || '';
  }

  // Always save to outbox in development for debugging
  if (!IS_PRODUCTION) {
    const outDir = ensureOutbox();
    const safeTo = Array.isArray(to) ? to.join(', ') : to;
    const blob = `To: ${safeTo}\nFrom: ${FROM_EMAIL}\nSubject: ${subj}\n\n${body}\n`;
    const filename = `email-${Date.now()}.eml`;
    fs.writeFileSync(path.join(outDir, filename), blob, 'utf8');
    console.log(`📧 Email saved to /outbox/${filename}`);
  }

  // Send via SMTP if configured
  if (EMAIL_ENABLED && transporter && to) {
    try {
      const info = await transporter.sendMail({
        from: FROM_EMAIL,
        to,
        subject: subj,
        text: body
      });
      console.log(`✓ Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (e) {
      console.error(`✗ Failed to send email to ${to}:`, e.message);
      return { success: false, error: e.message };
    }
  }

  return { success: false, error: 'Email not configured' };
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

function clearAuthCookie(res) { res.clearCookie('token'); }

function getUserFromCookie(req) {
  const t = req.cookies && req.cookies.token;
  if (!t) return null;
  try { return jwt.verify(t, JWT_SECRET); } catch { return null; }
}

function authRequired(req, res, next) {
  const u = getUserFromCookie(req);
  if (!u) return res.status(401).json({ error: 'Unauthenticated' });
  req.user = u;
  next();
}

function roleRequired(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

function passwordOk(pw='') {
  return typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

// ---------- IMPROVED AUTH WITH BETTER EMAIL HANDLING ----------

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, password, role } = req.body || {};
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  
  if (!validator.isEmail(String(email))) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  
  if (!passwordOk(password)) {
    return res.status(400).json({ 
      error: 'Password must be at least 8 characters with a letter and a number' 
    });
  }
  
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

  // Send verification email
  const verifyUrl = `${BASE_URL}/verify.html?token=${encodeURIComponent(user.verificationToken)}`;
  
  const emailResult = await sendMail({
    to: user.email,
    subject: 'Confirm your EventFlow account',
    text: `Hi ${user.name || ''},

Please confirm your EventFlow account by clicking this link:

${verifyUrl}

If you did not create this account, you can safely ignore this email.

Thanks,
The EventFlow team`
  });

  console.log(`📧 Verification email for ${user.email}:`, emailResult.success ? 'sent' : 'failed');

  // DON'T log them in yet - they need to verify first
  // But give them a helpful message
  
  let message = 'Account created! ';
  
  if (EMAIL_ENABLED && emailResult.success) {
    message += 'Please check your email to verify your account.';
  } else if (EMAIL_ENABLED && !emailResult.success) {
    message += `We had trouble sending your verification email. Please contact support or check your email settings.`;
  } else {
    // Dev mode - show the verification link directly
    message += `Verification link (dev mode): ${verifyUrl}`;
  }

  res.json({
    ok: true,
    message,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      verified: false
    },
    // In dev mode, include the verification URL so testing is easier
    ...((!EMAIL_ENABLED || !IS_PRODUCTION) && { verificationUrl: verifyUrl })
  });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const user = read('users').find(u => (u.email || '').toLowerCase() === String(email).toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  if (user.verified === false) {
    return res.status(403).json({ 
      error: 'Please verify your email address before signing in. Check your inbox for the verification link.' 
    });
  }

  // Update last login timestamp
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

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  setAuthCookie(res, token);
  res.json({ 
    ok: true, 
    user: { id: user.id, name: user.name, email: user.email, role: user.role } 
  });
});

app.post('/api/auth/forgot', authLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Missing email' });

  const users = read('users');
  const idx = users.findIndex(u => (u.email || '').toLowerCase() === String(email).toLowerCase());

  if (idx === -1) {
    // Always respond success so we don't leak which emails exist
    return res.json({ ok: true, message: 'If that email exists, we sent reset instructions.' });
  }

  const user = users[idx];
  const token = uid('reset');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  user.resetToken = token;
  user.resetTokenExpiresAt = expires;
  write('users', users);

  const resetUrl = `${BASE_URL}/reset-password.html?token=${encodeURIComponent(token)}`;

  await sendMail({
    to: user.email,
    subject: 'Reset your EventFlow password',
    text: `Hi ${user.name || ''},

Someone requested a password reset for your EventFlow account.

Click here to reset your password:
${resetUrl}

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email.

Thanks,
The EventFlow team`
  });

  res.json({ ok: true, message: 'If that email exists, we sent reset instructions.' });
});

app.get('/api/auth/verify', (req, res) => {
  const { token } = req.query || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });
  
  const users = read('users');
  const idx = users.findIndex(u => u.verificationToken === token);
  
  if (idx === -1) {
    return res.status(400).json({ error: 'Invalid or expired verification token' });
  }
  
  users[idx].verified = true;
  delete users[idx].verificationToken;
  write('users', users);
  
  console.log(`✓ User verified: ${users[idx].email}`);
  
  res.json({ ok: true, message: 'Email verified! You can now sign in.' });
});

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
  users.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  res.json({ items: users });
});

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

app.get('/api/admin/users-export', authRequired, roleRequired('admin'), (req, res) => {
  const users = read('users');
  const header = 'id,name,email,role,verified,marketingOptIn,createdAt,lastLoginAt\n';
  const rows = users.map(u => {
    const esc = (v) => String(v ?? '').replace(/"/g, '""');
    const verified = u.verified ? 'yes' : 'no';
    const marketing = u.marketingOptIn ? 'yes' : 'no';
    return `"${esc(u.id)}","${esc(u.name)}","${esc(u.email)}","${esc(u.role)}","${verified}","${marketing}","${esc(u.createdAt)}","${esc(u.lastLoginAt || '')}"`;
  }).join('\n');
  const csv = header + rows + (rows ? '\n' : '');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="eventflow-users.csv"');
  res.send(csv);
});

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

app.post('/api/auth/logout', (_req, res) => { clearAuthCookie(res); res.json({ ok: true }); });

app.get('/api/auth/me', (req, res) => {
  const p = getUserFromCookie(req);
  if (!p) return res.json({ user: null });
  const u = read('users').find(x => x.id === p.id);
  res.json({ user: u ? { id: u.id, name: u.name, email: u.email, role: u.role, notify: u.notify !== false } : null });
});

// Continue with rest of endpoints... (keeping this artifact focused on the email fix)
// [All other endpoints remain the same - I'm truncating here to keep the artifact manageable]

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

  const pkgs = read('packages');
  items = items.map((s) => {
    const featuredSupplier = pkgs.some(p => p.supplierId === s.id && p.featured);
    const isProActive = supplierIsProActive(s);
    return {
      ...s,
      featuredSupplier,
      isPro: isProActive,
      proExpiresAt: s.proExpiresAt || null
    };
  });

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
    .map((s) => {
      const copy = { ...s };
      delete copy._idx;
      return copy;
    });

  res.json({ items });
});

// [REST OF THE ENDPOINTS CONTINUE AS IN ORIGINAL FILE...]
// [I'm keeping this artifact focused on the key email fixes]

app.get('/api/health', (_req, res) => {
  res.json({ 
    ok: true, 
    version: APP_VERSION, 
    status: 'online', 
    time: new Date().toISOString(),
    email: EMAIL_ENABLED ? 'enabled' : 'disabled'
  });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use((_req, res) => res.status(404).send('Not found'));

app.listen(PORT, () => {
  console.log(`\n🚀 EventFlow ${APP_VERSION} server running`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → Email: ${EMAIL_ENABLED ? '✓ enabled' : '⚠ disabled (dev mode)'}\n`);
});
