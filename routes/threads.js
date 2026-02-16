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
let mongoDb;

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
    'mongoDb',
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
  mongoDb = deps.mongoDb;
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

function resolveListingSellerUserId(listing) {
  if (!listing || typeof listing !== 'object') {
    return null;
  }

  const candidate = listing.userId || listing.ownerUserId || listing.sellerUserId || null;
  if (candidate) {
    return String(candidate);
  }

  if (listing.createdBy && !String(listing.createdBy).includes('@')) {
    return String(listing.createdBy);
  }

  return null;
}

/**
 * Get MongoDB database instance
 * @param {Object} req - Express request object
 * @returns {Object|null} MongoDB database instance or null
 */
function getMongoDb(req) {
  return req.app.locals.db || mongoDb?.db || global.mongoDb?.db || null;
}

/**
 * Dual-write thread to MongoDB for v2 API compatibility
 * @param {Object} thread - Thread object from v1 API
 * @param {Object} db - MongoDB database instance
 */
async function writeThreadToMongoDB(thread, db) {
  if (!db) {
    return; // MongoDB not available, skip dual-write
  }

  try {
    const threadsCollection = db.collection('threads');

    // Build participants array from v1 fields for v2 compatibility
    const participants = [];
    if (thread.customerId) {
      participants.push(thread.customerId);
    }
    if (thread.recipientId && !participants.includes(thread.recipientId)) {
      participants.push(thread.recipientId);
    }

    // If thread has a supplierId, look up the supplier's ownerUserId and add to participants
    // Note: Don't add supplierId to participants as it's a supplier DB ID, not a user ID
    if (thread.supplierId && dbUnified) {
      try {
        // Efficient single-record lookup instead of loading all suppliers
        const suppliers = await dbUnified.read('suppliers');
        const supplier = suppliers.find(s => s.id === thread.supplierId);
        if (supplier && supplier.ownerUserId && !participants.includes(supplier.ownerUserId)) {
          participants.push(supplier.ownerUserId);
        }
      } catch (error) {
        console.error('Error looking up supplier owner for participants:', error);
        // Continue without adding supplier owner - don't block the dual-write
      }
    }

    // Separate immutable fields (only set on insert) from mutable fields (update on every write)
    const immutableFields = {
      id: thread.id, // Preserve v1 thread ID (thd_xxxxx)
      createdAt: thread.createdAt || new Date().toISOString(),
    };

    const mutableFields = {
      ...thread,
      participants, // Update participants array with complete list
      status: thread.status || 'open',
      updatedAt: thread.updatedAt || new Date().toISOString(),
      // Ensure name fields are updated when they change
      supplierName: thread.supplierName || null,
      customerName: thread.customerName || null,
      recipientName: thread.recipientName || null,
    };

    // Use updateOne with upsert: $setOnInsert for immutable, $set for mutable
    await threadsCollection.updateOne(
      { id: thread.id }, // Match by v1 thread ID
      {
        $setOnInsert: immutableFields, // Only set on insert
        $set: mutableFields, // Always update mutable fields
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error writing thread to MongoDB:', error);
    // Don't throw - dual-write failure shouldn't block the v1 API
  }
}

/**
 * Dual-write message to MongoDB for v2 API compatibility
 * @param {Object} message - Message object from v1 API
 * @param {Object} db - MongoDB database instance
 */
async function writeMessageToMongoDB(message, db) {
  if (!db) {
    return; // MongoDB not available, skip dual-write
  }

  try {
    const messagesCollection = db.collection('messages');

    // Separate immutable fields from mutable fields
    const immutableFields = {
      id: message.id, // Preserve v1 message ID
      threadId: message.threadId,
      senderId: message.fromUserId || message.senderId,
      createdAt: message.createdAt,
      sentAt: message.createdAt || message.sentAt,
    };

    // Create MongoDB document with both v1 and v2 fields
    // v1 fields: fromUserId, text, createdAt
    // v2 fields: senderId, content, sentAt
    const mutableFields = {
      ...message,
      // v2 field aliases (primary v1, fallback v2)
      content: message.text || message.content,
      // v2 required fields (can be updated)
      readBy: message.readBy || [],
      status: message.status || 'sent',
    };

    // Use updateOne with upsert: $setOnInsert for immutable, $set for mutable
    await messagesCollection.updateOne(
      { id: message.id }, // Match by v1 message ID
      {
        $setOnInsert: immutableFields, // Only set on insert
        $set: mutableFields, // Always update mutable fields
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error writing message to MongoDB:', error);
    // Don't throw - dual-write failure shouldn't block the v1 API
  }
}

// ---------- Thread Routes ----------

router.post(
  '/start',
  applyWriteLimiter,
  applyAuthRequired,
  applyCsrfProtection,
  async (req, res) => {
    const {
      supplierId,
      recipientId,
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
      marketplaceListingId,
      marketplaceListingTitle,
    } = req.body || {};

    const suppliers = await dbUnified.read('suppliers');
    let effectiveSupplierId = supplierId;
    let effectiveRecipientId = recipientId ? String(recipientId) : null;

    if (!effectiveSupplierId && effectiveRecipientId) {
      const supplierByOwner = suppliers.find(
        s => s.ownerUserId === effectiveRecipientId && s.approved
      );
      effectiveSupplierId = supplierByOwner ? supplierByOwner.id : null;
    }

    if (!effectiveSupplierId && marketplaceListingId) {
      const listings = await dbUnified.read('marketplace_listings');
      const listing = listings.find(l => l.id === String(marketplaceListingId));

      if (listing) {
        const listingSellerUserId = resolveListingSellerUserId(listing);
        if (!effectiveRecipientId && listingSellerUserId) {
          effectiveRecipientId = listingSellerUserId;
        }

        if (!effectiveSupplierId && listing.sellerSupplierId) {
          effectiveSupplierId = listing.sellerSupplierId;
        }

        if (!effectiveSupplierId && listingSellerUserId) {
          const supplierByOwner = suppliers.find(
            s => s.ownerUserId === listingSellerUserId && s.approved
          );
          effectiveSupplierId = supplierByOwner ? supplierByOwner.id : null;
        }
      }
    }

    // For marketplace peer-to-peer messaging: if no supplier exists but we have a valid recipient
    const isMarketplacePeerToPeer =
      marketplaceListingId &&
      !effectiveSupplierId &&
      effectiveRecipientId &&
      effectiveRecipientId !== req.user.id;

    if (!effectiveSupplierId && !isMarketplacePeerToPeer) {
      return res.status(400).json({
        error: 'Missing supplierId',
        message: 'No supplier could be resolved for this recipient.',
      });
    }

    let supplier = null;
    if (effectiveSupplierId) {
      supplier = suppliers.find(s => s.id === effectiveSupplierId && s.approved);
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      if (supplier.ownerUserId && supplier.ownerUserId === req.user.id) {
        return res.status(400).json({
          error: 'Cannot message your own listing',
          message: 'You cannot start a conversation on your own listing.',
        });
      }
    } else if (isMarketplacePeerToPeer) {
      // Peer-to-peer marketplace conversation - verify recipient exists
      if (effectiveRecipientId === req.user.id) {
        return res.status(400).json({
          error: 'Cannot message yourself',
          message: 'You cannot start a conversation with yourself.',
        });
      }
      const users = await dbUnified.read('users');
      const recipientUser = users.find(u => u.id === effectiveRecipientId);
      if (!recipientUser) {
        return res.status(404).json({ error: 'Recipient not found' });
      }
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
    let thread;

    if (isMarketplacePeerToPeer) {
      // For peer-to-peer marketplace conversations, find by recipientId + customerId
      thread = threads.find(
        t =>
          t.recipientId === effectiveRecipientId &&
          t.customerId === req.user.id &&
          t.marketplace?.listingId === String(marketplaceListingId)
      );
    } else {
      // Standard supplier conversation
      thread = threads.find(
        t => t.supplierId === effectiveSupplierId && t.customerId === req.user.id
      );
    }

    if (!thread) {
      // Look up customer and recipient names for thread header display
      const users = await dbUnified.read('users');
      const customerUser = users.find(u => u.id === req.user.id);
      const recipientUser = effectiveRecipientId
        ? users.find(u => u.id === effectiveRecipientId)
        : null;

      thread = {
        id: uid('thd'),
        supplierId: effectiveSupplierId || null,
        supplierName: supplier ? supplier.name : null,
        customerId: req.user.id,
        customerName: customerUser ? customerUser.name : null,
        recipientId: effectiveRecipientId || supplier?.ownerUserId || null,
        recipientName: recipientUser ? recipientUser.name : null,
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
        marketplace: marketplaceListingId
          ? {
              listingId: String(marketplaceListingId),
              listingTitle: marketplaceListingTitle
                ? String(marketplaceListingTitle).slice(0, 200)
                : null,
              isPeerToPeer: isMarketplacePeerToPeer,
            }
          : null,
      };
      threads.push(thread);
      await dbUnified.write('threads', threads);

      // Dual-write to MongoDB for v2 API compatibility
      const db = getMongoDb(req);
      await writeThreadToMongoDB(thread, db);
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
        supplierId: effectiveSupplierId || null,
        status: 'sent',
        createdAt: new Date().toISOString(),
      };
      if (marketplaceListingId) {
        entry.marketplaceListingId = String(marketplaceListingId);
        entry.marketplaceListingTitle = marketplaceListingTitle
          ? String(marketplaceListingTitle).slice(0, 200)
          : null;
      }

      msgs.push(entry);
      await dbUnified.write('messages', msgs);

      // Dual-write message to MongoDB for v2 API compatibility
      const db = getMongoDb(req);
      await writeMessageToMongoDB(entry, db);

      // Update thread timestamp and message preview
      const allThreads = await dbUnified.read('threads');
      const idx = allThreads.findIndex(t => t.id === thread.id);
      if (idx >= 0) {
        allThreads[idx].updatedAt = entry.createdAt;
        allThreads[idx].lastMessageAt = entry.createdAt;
        allThreads[idx].lastMessagePreview = entry.text.substring(0, 100);
        await dbUnified.write('threads', allThreads);

        // Also update MongoDB for v2 API compatibility
        await writeThreadToMongoDB(allThreads[idx], db);
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
  }
);

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

// Get single thread by ID
router.get('/:id', applyAuthRequired, async (req, res) => {
  const t = (await dbUnified.read('threads')).find(x => x.id === req.params.id);
  if (!t) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  // Authorization check
  let authorized = false;
  if (req.user.role === 'admin') {
    authorized = true;
  } else if (t.customerId === req.user.id) {
    authorized = true;
  } else if (t.recipientId === req.user.id) {
    // Peer-to-peer marketplace threads
    authorized = true;
  } else if (t.supplierId) {
    const own = (await dbUnified.read('suppliers')).find(
      s => s.id === t.supplierId && s.ownerUserId === req.user.id
    );
    if (own) {
      authorized = true;
    }
  }

  if (!authorized) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json({ thread: t });
});

router.get('/:id/messages', applyAuthRequired, async (req, res) => {
  const t = (await dbUnified.read('threads')).find(x => x.id === req.params.id);
  if (!t) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  // Authorization check
  let authorized = false;
  if (req.user.role === 'admin') {
    authorized = true;
  } else if (t.customerId === req.user.id) {
    authorized = true;
  } else if (t.recipientId === req.user.id) {
    // Peer-to-peer marketplace threads
    authorized = true;
  } else if (t.supplierId) {
    const own = (await dbUnified.read('suppliers')).find(
      s => s.id === t.supplierId && s.ownerUserId === req.user.id
    );
    if (own) {
      authorized = true;
    }
  }

  if (!authorized) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const msgs = (await dbUnified.read('messages'))
    .filter(m => m.threadId === t.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json({ items: msgs });
});

router.post(
  '/:id/messages',
  applyWriteLimiter,
  applyAuthRequired,
  applyCsrfProtection,
  async (req, res) => {
    const { text, packageId } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }
    const t = (await dbUnified.read('threads')).find(x => x.id === req.params.id);
    if (!t) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Authorization check
    let authorized = false;
    if (req.user.role === 'admin') {
      authorized = true;
    } else if (t.customerId === req.user.id) {
      authorized = true;
    } else if (t.recipientId === req.user.id) {
      // Peer-to-peer marketplace threads
      authorized = true;
    } else if (t.supplierId) {
      const own = (await dbUnified.read('suppliers')).find(
        s => s.id === t.supplierId && s.ownerUserId === req.user.id
      );
      if (own) {
        authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden' });
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

    // Dual-write message to MongoDB for v2 API compatibility
    const db = getMongoDb(req);
    await writeMessageToMongoDB(entry, db);

    // Update thread timestamp and message preview
    const th = await dbUnified.read('threads');
    const i = th.findIndex(x => x.id === t.id);
    if (i >= 0) {
      th[i].updatedAt = entry.createdAt;
      th[i].lastMessageAt = entry.createdAt;
      th[i].lastMessagePreview = entry.text.substring(0, 100);
      await dbUnified.write('threads', th);

      // Also update MongoDB for v2 API compatibility
      await writeThreadToMongoDB(th[i], db);
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

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
