/**
 * Threads & Messages Routes
 * Thread management and messaging endpoints
 */

'use strict';

const express = require('express');
const router = express.Router();

// These will be injected by server.js during route mounting
let dbUnified;
let authRequired;
let csrfProtection;
let writeLimiter;
let uid;
let sendMail;
let verifyHCaptcha;
let calculateLeadScore;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Threads routes: dependencies object is required');
  }

  // Validate required dependencies
  const required = [
    'dbUnified',
    'authRequired',
    'csrfProtection',
    'writeLimiter',
    'uid',
    'sendMail',
    'verifyHCaptcha',
    'calculateLeadScore',
  ];

  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Threads routes: missing required dependencies: ${missing.join(', ')}`);
  }

  dbUnified = deps.dbUnified;
  authRequired = deps.authRequired;
  csrfProtection = deps.csrfProtection;
  writeLimiter = deps.writeLimiter;
  uid = deps.uid;
  sendMail = deps.sendMail;
  verifyHCaptcha = deps.verifyHCaptcha;
  calculateLeadScore = deps.calculateLeadScore;
}

/**
 * Deferred middleware wrappers
 * These are safe to reference in route definitions at require() time
 * because they defer the actual middleware call to request time,
 * when dependencies are guaranteed to be initialized.
 */
function applyAuthRequired(req, res, next) {
  if (!authRequired) {
    return res.status(503).json({ error: 'Auth service not initialized' });
  }
  return authRequired(req, res, next);
}

function applyCsrfProtection(req, res, next) {
  if (!csrfProtection) {
    return res.status(503).json({ error: 'CSRF service not initialized' });
  }
  return csrfProtection(req, res, next);
}

function applyWriteLimiter(req, res, next) {
  if (!writeLimiter) {
    return res.status(503).json({ error: 'Rate limiter not initialized' });
  }
  return writeLimiter(req, res, next);
}

// ---------- Thread Routes ----------

router.post('/start', applyWriteLimiter, applyAuthRequired, applyCsrfProtection, async (req, res) => {
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

router.get('/my', applyAuthRequired, async (req, res) => {
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

router.get('/:id/messages', applyAuthRequired, async (req, res) => {
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

router.post('/:id/messages', applyWriteLimiter, applyAuthRequired, applyCsrfProtection, async (req, res) => {
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
          : ((await dbUnified.read('users')).find(u => u.id === t.customerId) || {}).email || null;
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
});

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
