
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

const APP_VERSION = 'v16.3.9';

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

// Helper: determine if a supplier's Pro plan is currently active.
// - isPro must be true, AND
// - proExpiresAt is either missing/null (no expiry) or in the future.
function supplierIsProActive(s) {
  if (!s || !s.isPro) return false;
  if (!s.proExpiresAt) return !!s.isPro;
  var t = Date.parse(s.proExpiresAt);
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
const authLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 80,  standardHeaders: true, legacyHeaders: false });

// ---------- Email (safe dev mode) ----------
const EMAIL_ENABLED = String(process.env.EMAIL_ENABLED || 'false').toLowerCase() === 'true';
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@eventflow.local';

/**
 * Optional SendGrid helper:
 * If SENDGRID_API_KEY is set (and no explicit SMTP_HOST), configure SMTP to use SendGrid.
 * This works both locally and in production.
 */
if (!process.env.SMTP_HOST && process.env.SENDGRID_API_KEY) {
  process.env.SMTP_HOST = 'smtp.sendgrid.net';
  process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
  // For SendGrid SMTP, the username is always literally 'apikey'
  process.env.SMTP_USER = process.env.SMTP_USER || 'apikey';
  process.env.SMTP_PASS = process.env.SMTP_PASS || process.env.SENDGRID_API_KEY;
}

let transporter = null;

if (EMAIL_ENABLED && process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: (process.env.SMTP_USER && process.env.SMTP_PASS) ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
}

// Always save outgoing email to /outbox in dev
function ensureOutbox() {
  const outDir = path.join(DATA_DIR, '..', 'outbox');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}
async function sendMail(toOrOpts, subject, text) {
  // Support both legacy (to, subject, text) and object-based calls: sendMail({ to, subject, text })
  let to = toOrOpts;
  let subj = subject;
  let body = text;

  if (toOrOpts && typeof toOrOpts === 'object') {
    to = toOrOpts.to;
    subj = toOrOpts.subject;
    body = toOrOpts.text || '';
  }

  const outDir = ensureOutbox();
  const safeTo = Array.isArray(to) ? to.join(', ') : to;
  const blob = `To: ${safeTo}\nFrom: ${FROM_EMAIL}\nSubject: ${subj}\n\n${body}\n`;
  fs.writeFileSync(path.join(outDir, `email-${Date.now()}.eml`), blob, 'utf8');

  if (transporter && to) {
    try {
      await transporter.sendMail({
        from: FROM_EMAIL,
        to,
        subject: subj,
        text: body
      });
    } catch (e) {
      console.error('Error sending email via transporter', e);
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

// ---------- AUTH ----------
app.post('/api/auth/register', authLimiter, (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (!validator.isEmail(String(email))) return res.status(400).json({ error: 'Invalid email' });
  if (!passwordOk(password)) return res.status(400).json({ error: 'Weak password' });
  const roleFinal = (role === 'supplier' || role === 'customer') ? role : 'customer';

  const users = read('users');
  if (users.find(u => u.email.toLowerCase() === String(email).toLowerCase())) return res.status(409).json({ error: 'Email already registered' });

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
  users.push(user); write('users', users);

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

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  setAuthCookie(res, token);

  res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const user = read('users').find(u => (u.email || '').toLowerCase() === String(email).toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid email or password' });
  if (user.verified === false) return res.status(403).json({ error: 'Please verify your email address before signing in.' });

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

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  setAuthCookie(res, token);
  res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});


app.post('/api/auth/forgot', authLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Missing email' });

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
  res.json({ ok: true });
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

app.post('/api/auth/logout', (_req, res) => { clearAuthCookie(res); res.json({ ok: true }); });
app.get('/api/auth/me', (req, res) => {
  const p = getUserFromCookie(req);
  if (!p) return res.json({ user: null });
  const u = read('users').find(x => x.id === p.id);
  res.json({ user: u ? { id: u.id, name: u.name, email: u.email, role: u.role, notify: u.notify !== false } : null });
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
    .map((s) => {
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
    if (Array.isArray(plan.guests) && plan.guests.length) summaryBits.push(plan.guests.length + ' guests in the list');
    if (Array.isArray(plan.tasks) && plan.tasks.length) summaryBits.push(plan.tasks.length + ' planning tasks');
    if (Array.isArray(plan.timeline) && plan.timeline.length) summaryBits.push(plan.timeline.length + ' timeline items');
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

    const raw = (completion && completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content) || '';
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
  const items = read('packages').filter(p => p.approved).sort((a,b) => Number(b.featured) - Number(a.featured)).slice(0, 6);
  res.json({ items });
});

app.get('/api/packages/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const items = read('packages').filter(p => p.approved && (
    (p.title || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
  ));
  res.json({ items });
});

// ---------- Supplier dashboard ----------
app.get('/api/me/suppliers', authRequired, roleRequired('supplier'), (req, res) => {
  const listRaw = read('suppliers').filter(s => s.ownerUserId === req.user.id);
  const list = listRaw.map((s) => ({
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
  suppliers.forEach((s) => {
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
  const photos = (b.photos ? (Array.isArray(b.photos) ? b.photos : String(b.photos).split(/\r?\n/)) : [])
    .map(x => String(x).trim()).filter(Boolean);

  const amenities = (b.amenities ? String(b.amenities).split(',') : []).map(x => x.trim()).filter(Boolean);

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
    photos: photos.length ? photos : [`https://source.unsplash.com/featured/800x600/?event,${encodeURIComponent(b.category)}`],
    email: ((read('users').find(u => u.id === req.user.id) || {}).email) || '',
    approved: false
  };
  const all = read('suppliers'); all.push(s); write('suppliers', all);
  res.json({ ok: true, supplier: s });
});

app.patch('/api/me/suppliers/:id', writeLimiter, authRequired, roleRequired('supplier'), (req, res) => {
  const all = read('suppliers');
  const i = all.findIndex(s => s.id === req.params.id && s.ownerUserId === req.user.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};

  const fields = ['name','category','location','price_display','website','license','description_short','description_long'];
  for (const k of fields) if (typeof b[k] === 'string') all[i][k] = b[k];

  if (b.amenities) all[i].amenities = String(b.amenities).split(',').map(x => x.trim()).filter(Boolean);
  if (b.maxGuests != null) all[i].maxGuests = parseInt(b.maxGuests,10) || 0;
  if (b.photos) {
    const photos = (Array.isArray(b.photos) ? b.photos : String(b.photos).split(/\r?\n/)).map(x => String(x).trim()).filter(Boolean);
    if (photos.length) all[i].photos = photos;
  }
  all[i].approved = false;
  write('suppliers', all);
  res.json({ ok: true, supplier: all[i] });
});

app.get('/api/me/packages', authRequired, roleRequired('supplier'), (req, res) => {
  const mine = read('suppliers').filter(s => s.ownerUserId === req.user.id).map(s => s.id);
  const items = read('packages').filter(p => mine.includes(p.supplierId));
  res.json({ items });
});

app.post('/api/me/packages', writeLimiter, authRequired, roleRequired('supplier'), (req, res) => {
  const { supplierId, title, description, price, image } = req.body || {};
  if (!supplierId || !title) return res.status(400).json({ error: 'Missing fields' });
  const own = read('suppliers').find(s => s.id === supplierId && s.ownerUserId === req.user.id);
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
  const all = allPkgs; all.push(pkg); write('packages', all);
  res.json({ ok: true, package: pkg });
});

// ---------- Threads & Messages ----------
app.post('/api/threads/start', writeLimiter, authRequired, async (req, res) => {
  const { supplierId, message, eventType, eventDate, location, guests } = req.body || {};
  if (!supplierId) return res.status(400).json({ error: 'Missing supplierId' });
  const supplier = read('suppliers').find(s => s.id === supplierId && s.approved);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const threads = read('threads');
  let thread = threads.find(t => t.supplierId === supplierId && t.customerId === req.user.id);
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
    } catch (e) { /* dev-safe */ }
  })();

  res.json({ ok: true, thread });
});

app.get('/api/threads/my', authRequired, (req, res) => {
  const ts = read('threads');
  let items = [];
  if (req.user.role === 'customer') items = ts.filter(t => t.customerId === req.user.id);
  else if (req.user.role === 'supplier') {
    const mine = read('suppliers').filter(s => s.ownerUserId === req.user.id).map(s => s.id);
    items = ts.filter(t => mine.includes(t.supplierId));
  } else if (req.user.role === 'admin') items = ts;
  const msgs = read('messages');
  items = items.map(t => ({ ...t, last: msgs.filter(m => m.threadId === t.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0] || null }));
  res.json({ items });
});

app.get('/api/threads/:id/messages', authRequired, (req, res) => {
  const t = read('threads').find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Thread not found' });
  if (req.user.role !== 'admin' && t.customerId !== req.user.id) {
    const own = read('suppliers').find(s => s.id === t.supplierId && s.ownerUserId === req.user.id);
    if (!own) return res.status(403).json({ error: 'Forbidden' });
  }
  const msgs = read('messages').filter(m => m.threadId === t.id).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
  res.json({ items: msgs });
});

app.post('/api/threads/:id/messages', writeLimiter, authRequired, (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Missing text' });
  const t = read('threads').find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Thread not found' });
  if (req.user.role !== 'admin' && t.customerId !== req.user.id) {
    const own = read('suppliers').find(s => s.id === t.supplierId && s.ownerUserId === req.user.id);
    if (!own) return res.status(403).json({ error: 'Forbidden' });
  }
  const msgs = read('messages'); const entry = { id: uid('msg'), threadId: t.id, fromUserId: req.user.id, fromRole: req.user.role, text: String(text).slice(0, 4000), createdAt: new Date().toISOString() };
  msgs.push(entry); write('messages', msgs);

  // Update thread timestamp
  const th = read('threads'); const i = th.findIndex(x => x.id === t.id); if (i >= 0) { th[i].updatedAt = entry.createdAt; write('threads', th); }

  // Email notify other party (safe IIFE)
  (async () => {
    try {
      const otherEmail = (req.user.role === 'customer')
        ? (((read('suppliers').find(s => s.id === t.supplierId) || {}).email) || null)
        : (((read('users').find(u => u.id === t.customerId) || {}).email) || null);
      const me = read('users').find(u => u.id === req.user.id);
      if (otherEmail && me && me.notify !== false) {
        await sendMail(otherEmail, 'New message on EventFlow', `You have a new message in a conversation.\n\n${entry.text.slice(0, 500)}`);
      }
    } catch (e) { /* dev-safe */ }
  })();

  res.json({ ok: true, message: entry });
});

// ---------- Plan & Notes (customer) ----------
app.get('/api/plan', authRequired, (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customers only' });
  const plans = read('plans').filter(p => p.userId === req.user.id);
  const suppliers = read('suppliers').filter(s => s.approved);
  const items = plans.map(p => suppliers.find(s => s.id === p.supplierId)).filter(Boolean);
  res.json({ items });
});

app.post('/api/plan', authRequired, (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customers only' });
  const { supplierId } = req.body || {}; if (!supplierId) return res.status(400).json({ error: 'Missing supplierId' });
  const s = read('suppliers').find(x => x.id === supplierId && x.approved); if (!s) return res.status(404).json({ error: 'Supplier not found' });
  const all = read('plans'); if (!all.find(p => p.userId === req.user.id && p.supplierId === supplierId)) all.push({ id: uid('pln'), userId: req.user.id, supplierId, createdAt: new Date().toISOString() });
  write('plans', all); res.json({ ok: true });
});

app.delete('/api/plan/:supplierId', authRequired, (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customers only' });
  const all = read('plans').filter(p => !(p.userId === req.user.id && p.supplierId === req.params.supplierId));
  write('plans', all); res.json({ ok: true });
});

app.get('/api/notes', authRequired, (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customers only' });
  const n = read('notes').find(x => x.userId === req.user.id); res.json({ text: (n && n.text) || '' });
});

app.post('/api/notes', authRequired, (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customers only' });
  const all = read('notes'); const i = all.findIndex(x => x.userId === req.user.id);
  if (i >= 0) { all[i].text = String((req.body && req.body.text) || ''); all[i].updatedAt = new Date().toISOString(); }
  else { all.push({ id: uid('nte'), userId: req.user.id, text: String((req.body && req.body.text) || ''), createdAt: new Date().toISOString() }); }
  write('notes', all); res.json({ ok: true });
});

// ---------- Settings ----------
app.get('/api/me/settings', authRequired, (req, res) => {
  const users = read('users'); const i = users.findIndex(u => u.id === req.user.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  res.json({ notify: users[i].notify !== false });
});
app.post('/api/me/settings', authRequired, (req, res) => {
  const users = read('users'); const i = users.findIndex(u => u.id === req.user.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  users[i].notify = !!(req.body && req.body.notify); write('users', users); res.json({ ok: true, notify: users[i].notify });
});

// ---------- Meta & status ----------
app.get('/api/meta', (_req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    node: process.version,
    env: process.env.NODE_ENV || 'development'
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
    const d = new Date(today); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    series.push({ date: iso, visitors: 20 + ((i * 7) % 15), signups: 3 + (i % 4), plans: 1 + (i % 3) });
  }
  res.json({ series });
});

});

// ---------- Admin ----------
app.get('/api/admin/metrics', authRequired, roleRequired('admin'), (_req, res) => {
  const users = read('users'), suppliers = read('suppliers'), plans = read('plans'), msgs = read('messages'), pkgs = read('packages'), threads = read('threads');
  res.json({ counts: {
    usersTotal: users.length,
    usersByRole: users.reduce((a,u) => { a[u.role] = (a[u.role] || 0) + 1; return a; }, {}),
    suppliersTotal: suppliers.length,
    packagesTotal: pkgs.length,
    plansTotal: plans.length,
    messagesTotal: msgs.length,
    threadsTotal: threads.length
  }});
});

app.post('/api/admin/reset-demo', authRequired, roleRequired('admin'), (req, res) => {
  try {
    // Clear key collections and rerun seeding
    const collections = ['users', 'suppliers', 'packages', 'plans', 'notes', 'messages', 'threads', 'events'];
    collections.forEach((name) => write(name, []));
    seed();
    res.json({ ok: true });
  } catch (err) {
    console.error('Reset demo failed', err);
    res.status(500).json({ error: 'Reset demo failed' });
  }
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
  const all = read('suppliers'); const i = all.findIndex(s => s.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  all[i].approved = !!(req.body && req.body.approved); write('suppliers', all); res.json({ ok: true, supplier: all[i] });
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
app.get('/api/admin/packages', authRequired, roleRequired('admin'), (_req, res) => res.json({ items: read('packages') }));
app.post('/api/admin/packages/:id/approve', authRequired, roleRequired('admin'), (req, res) => {
  const all = read('packages'); const i = all.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  all[i].approved = !!(req.body && req.body.approved); write('packages', all); res.json({ ok: true, package: all[i] });
});
app.post('/api/admin/packages/:id/feature', authRequired, roleRequired('admin'), (req, res) => {
  const all = read('packages'); const i = all.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  all[i].featured = !!(req.body && req.body.featured); write('packages', all); res.json({ ok: true, package: all[i] });
});

// ---------- Sitemap ----------
app.get('/sitemap.xml', (_req, res) => {
  const base = `http://localhost:${PORT}`;
  const suppliers = read('suppliers').filter(s => s.approved).map(s => `${base}/supplier.html?id=${s.id}`);
  const urls = [ `${base}/`, `${base}/suppliers.html`, `${base}/start.html`, `${base}/plan.html`, `${base}/auth.html`, ...suppliers ];
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls.map(u => `<url><loc>${u}</loc></url>`), '</urlset>'].join('');
  res.set('Content-Type','application/xml'); res.send(xml);
});

// ---------- Protected HTML routes ----------
const sendHTML = (res, file) => res.sendFile(path.join(__dirname, 'public', file));
app.get('/dashboard/customer', authRequired, (req, res) => { if (req.user.role !== 'customer') return res.redirect('/auth.html'); sendHTML(res, 'dashboard-customer.html'); });
app.get('/dashboard/supplier', authRequired, (req, res) => { if (req.user.role !== 'supplier') return res.redirect('/auth.html'); sendHTML(res, 'dashboard-supplier.html'); });
app.get('/admin', authRequired, (req, res) => { if (req.user.role !== 'admin') return res.redirect('/auth.html'); sendHTML(res, 'admin.html'); });


// ---------- Healthcheck ----------

// --- PLAN SAVE SYSTEM ---
function planOwnerOnly(req,res,next){
  if(!req.userId) return res.status(403).json({error:'Not logged in'});
  next();
}

app.post('/api/me/plan/save', planOwnerOnly, (req,res)=>{
  const { plan } = req.body || {};
  if(!plan) return res.status(400).json({error:'Missing plan'});
  const plans = read('plans');
  let p = plans.find(x=>x.userId===req.userId);
  if(!p){
    p = { id:uid('pln'), userId:req.userId, plan };
    plans.push(p);
  } else {
    p.plan = plan;
  }
  write('plans', plans);
  res.json({ok:true, plan:p});
});

app.get('/api/me/plan', planOwnerOnly, (req,res)=>{
  const plans = read('plans');
  const p = plans.find(x=>x.userId===req.userId);
  if(!p) return res.json({ok:true, plan:null});
  res.json({ok:true, plan:p.plan});
});


// --- PDF EXPORT ---
app.get('/api/plan/export/pdf', async (req,res)=>{
  if(!req.userId) return res.status(403).json({error:'Not logged in'});

  const plans = read('plans');
  const p = plans.find(x=>x.userId===req.userId);
  if(!p) return res.status(400).json({error:'No plan saved'});

  const suppliers = read('suppliers');
  const packages = read('packages');

  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition','attachment; filename=event_plan.pdf');

  const doc = new PDFDocument({margin:50});
  doc.pipe(res);

  doc.fontSize(22).text("EventFlow — Event Plan", {align:'center'});
  doc.moveDown();
  doc.fontSize(14).text("Generated: "+new Date().toLocaleString());
  doc.moveDown();
  doc.fontSize(16).text("Event Summary", {underline:true});
  doc.fontSize(12).text(JSON.stringify(p.plan.summary||{},null,2));
  doc.moveDown();

  doc.fontSize(16).text("Timeline",{underline:true});
  doc.fontSize(12).text(JSON.stringify(p.plan.timeline||[],null,2));
  doc.moveDown();

  doc.fontSize(16).text("Suppliers",{underline:true});
  const supIds = (p.plan.suppliers||[]).map(s=>s.id);
  suppliers.filter(s=>supIds.includes(s.id)).forEach(s=>{
    doc.fontSize(14).text(s.name);
    doc.fontSize(12).text(s.category);
    doc.moveDown();
  });

  doc.fontSize(16).text("Notes",{underline:true});
  doc.fontSize(12).text(p.plan.notes||"None");
  doc.moveDown();

  doc.end();
});


// --- IMAGE STORAGE (V9.3) ---
// fs and path are already required at the top of this file
const UP_ROOT = path.join(DATA_DIR, 'uploads');

function ensureDirs(){
  const dirs = [
    UP_ROOT,
    path.join(UP_ROOT,'suppliers'),
    path.join(UP_ROOT,'packages')
  ];
  for(const d of dirs) if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true});
}
ensureDirs();

function saveImageBase64(base64, ownerType, ownerId){
  try{
    const match = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if(!match) return null;
    const ext = match[1].split('/')[1];
    const buffer = Buffer.from(match[2], 'base64');
    const folder = path.join(UP_ROOT, ownerType, ownerId);
    if(!fs.existsSync(folder)) fs.mkdirSync(folder,{recursive:true});
    const filename = 'img_'+Date.now()+'_'+Math.random().toString(36).slice(2)+'.'+ext;
    const filePath = path.join(folder, filename);
    fs.writeFileSync(filePath, buffer);
    return '/uploads/'+ownerType+'/'+ownerId+'/'+filename;
  }catch(e){ return null; }
}

// Supplier image upload
app.post('/api/me/suppliers/:id/photos', authRequired, (req,res)=>{
  const { image } = req.body || {};
  if(!image) return res.status(400).json({error:'Missing image'});
  const suppliers = read('suppliers');
  const s = suppliers.find(x=>x.id===req.params.id && x.ownerUserId===req.userId);
  if(!s) return res.status(403).json({error:'Not owner'});
  const url = saveImageBase64(image,'suppliers',req.params.id);
  if(!url) return res.status(400).json({error:'Invalid image'});
  if(!s.photosGallery) s.photosGallery=[];
  s.photosGallery.push({url,approved:false,uploadedAt:Date.now()});
  write('suppliers',suppliers);
  res.json({ok:true,url});
});

// Package image upload
app.post('/api/me/packages/:id/photos', authRequired, (req,res)=>{
  const { image } = req.body || {};
  if(!image) return res.status(400).json({error:'Missing image'});
  const pkgs = read('packages');
  const p = pkgs.find(x=>x.id===req.params.id);
  if(!p) return res.status(404).json({error:'Not found'});
  const suppliers = read('suppliers');
  const own = suppliers.find(x=>x.id===p.supplierId && x.ownerUserId===req.userId);
  if(!own) return res.status(403).json({error:'Not owner'});
  const url = saveImageBase64(image,'packages',req.params.id);
  if(!url) return res.status(400).json({error:'Invalid image'});
  if(!p.gallery) p.gallery=[];
  p.gallery.push({url,approved:false,uploadedAt:Date.now()});
  write('packages',pkgs);
  res.json({ok:true,url});
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: APP_VERSION, status: 'online', time: new Date().toISOString() });
});

// ---------- Static & 404 ----------
app.use(express.static(path.join(__dirname, 'public')));
app.use((_req, res) => res.status(404).send('Not found'));

// ---------- Start ----------
app.listen(PORT, () => console.log(`EventFlow ${APP_VERSION} server running → http://localhost:${PORT}`));