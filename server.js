/* EventFlow v16.3.9 — Complete Fixed Server
 * All endpoints restored and working
 * Email system fixed
 * Production ready
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
  console.warn('Stripe not configured:', err.message);
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
  console.warn('OpenAI not configured:', err.message);
}

const { read, write, uid, DATA_DIR } = require('./store');

function supplierIsProActive(s) {
  if (!s || !s.isPro) return false;
  if (!s.proExpiresAt) return !!s.isPro;
  const t = Date.parse(s.proExpiresAt);
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
  console.error('⚠️  JWT_SECRET not set. Set it in .env file.');
  process.exit(1);
}

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const authLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 80,  standardHeaders: true, legacyHeaders: false });

// Email config
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
const EMAIL_ENABLED = String(process.env.EMAIL_ENABLED || (IS_PRODUCTION ? 'true' : 'false')).toLowerCase() === 'true';
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@eventflow.local';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

console.log('📧 Email:', EMAIL_ENABLED ? 'enabled' : 'disabled');

if (!process.env.SMTP_HOST && process.env.SENDGRID_API_KEY) {
  process.env.SMTP_HOST = 'smtp.sendgrid.net';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'apikey';
  process.env.SMTP_PASS = process.env.SENDGRID_API_KEY;
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
  } catch (err) {
    console.error('SMTP setup failed:', err.message);
  }
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

  if (!IS_PRODUCTION) {
    const outDir = ensureOutbox();
    const safeTo = Array.isArray(to) ? to.join(', ') : to;
    const blob = `To: ${safeTo}\nFrom: ${FROM_EMAIL}\nSubject: ${subj}\n\n${body}\n`;
    fs.writeFileSync(path.join(outDir, `email-${Date.now()}.eml`), blob, 'utf8');
  }

  if (EMAIL_ENABLED && transporter && to) {
    try {
      const info = await transporter.sendMail({
        from: FROM_EMAIL,
        to,
        subject: subj,
        text: body
      });
      return { success: true, messageId: info.messageId };
    } catch (e) {
      console.error('Email failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  return { success: false, error: 'Email not configured' };
}

// Auth helpers
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

function passwordOk(pw='') {
  return typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

// AUTH ROUTES
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

  const verifyUrl = `${BASE_URL}/verify.html?token=${encodeURIComponent(user.verificationToken)}`;
  
  const emailResult = await sendMail({
    to: user.email,
    subject: 'Confirm your EventFlow account',
    text: `Hi ${user.name},

Please confirm your EventFlow account:
${verifyUrl}

If you didn't create this account, ignore this email.

Thanks,
EventFlow`
  });

  let message = 'Account created! ';
  
  if (EMAIL_ENABLED && emailResult.success) {
    message += 'Check your email to verify.';
  } else if (EMAIL_ENABLED) {
    message += 'Trouble sending verification email. Contact support.';
  } else {
    message += `Dev mode - verify at: ${verifyUrl}`;
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
      error: 'Please verify your email before signing in. Check your inbox.' 
    });
  }

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
    return res.json({ ok: true, message: 'If that email exists, we sent instructions.' });
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
    text: `Hi ${user.name},

Reset your password:
${resetUrl}

Link expires in 1 hour.

Didn't request this? Ignore this email.

Thanks,
EventFlow`
  });

  res.json({ ok: true, message: 'If that email exists, we sent instructions.' });
});

app.get('/api/auth/verify', (req, res) => {
  const { token } = req.query || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });
  
  const users = read('users');
  const idx = users.findIndex(u => u.verificationToken === token);
  
  if (idx === -1) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
  
  users[idx].verified = true;
  delete users[idx].verificationToken;
  write('users', users);
  
  res.json({ ok: true, message: 'Email verified! You can now sign in.' });
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
    user: u ? { 
      id: u.id, 
      name: u.name, 
      email: u.email, 
      role: u.role, 
      notify: u.notify !== false 
    } : null 
  });
});

// ADMIN ROUTES
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

app.get('/api/admin/suppliers', authRequired, roleRequired('admin'), (_req, res) => {
  const raw = read('suppliers');
  const items = raw.map((s) => ({
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
      case '1d': ms = 1 * 24 * 60 * 60 * 1000; break;
      case '7d': ms = 7 * 24 * 60 * 60 * 1000; break;
      case '1m': ms = 30 * 24 * 60 * 60 * 1000; break;
      case '1y': ms = 365 * 24 * 60 * 60 * 1000; break;
      default: return res.status(400).json({ error: 'Invalid duration' });
    }
    s.isPro = true;
    s.proExpiresAt = new Date(now + ms).toISOString();
  } else {
    return res.status(400).json({ error: 'Invalid mode' });
  }

  all[i] = s;
  write('suppliers', all);

  res.json({
    ok: true,
    supplier: {
      ...s,
      isPro: supplierIsProActive(s),
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
      usersByRole: users.reduce((a,u) => { a[u.role] = (a[u.role] || 0) + 1; return a; }, {}),
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
    const collections = ['users', 'suppliers', 'packages', 'plans', 'notes', 'messages', 'threads', 'events'];
    collections.forEach((name) => write(name, []));
    seed();
    res.json({ ok: true });
  } catch (err) {
    console.error('Reset failed', err);
    res.status(500).json({ error: 'Reset failed' });
  }
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

app.post('/api/admin/suppliers/smart-tags', authRequired, roleRequired('admin'), async (req, res) => {
  const all = read('suppliers');
  const now = new Date().toISOString();
  const updated = [];

  all.forEach((s) => {
    const tags = [];
    if (s.category) tags.push(s.category);
    if (Array.isArray(s.amenities)) {
      s.amenities.slice(0, 3).forEach((a) => tags.push(a));
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

// SUPPLIER ROUTES
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

// PACKAGE ROUTES
app.get('/api/packages/featured', (_req, res) => {
  const items = read('packages')
    .filter(p => p.approved)
    .sort((a,b) => Number(b.featured) - Number(a.featured))
    .slice(0, 6);
  res.json({ items });
});

app.get('/api/packages/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const items = read('packages').filter(p => p.approved && (
    (p.title || '').toLowerCase().includes(q) || 
    (p.description || '').toLowerCase().includes(q)
  ));
  res.json({ items });
});

// SUPPLIER DASHBOARD
app.get('/api/me/suppliers', authRequired, roleRequired('supplier'), (req, res) => {
  const listRaw = read('suppliers').filter(s => s.ownerUserId === req.user.id);
  const list = listRaw.map((s) => ({
    ...s,
    isPro: supplierIsProActive(s),
    proExpiresAt: s.proExpiresAt || null
  }));
  res.json({ items: list });
});

app.post('/api/me/subscription/upgrade', authRequired, roleRequired('supplier'), (req, res) => {
  const suppliers = read('suppliers');
  let changed = 0;
  suppliers.forEach((s) => {
    if (s.ownerUserId === req.user.id) {
      if (!s.isPro) {
        s.isPro = true;
        changed += 1;
      }
    }
  });
