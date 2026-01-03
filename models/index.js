/**
 * MongoDB Schema Definitions and Validation
 * Defines the structure and validation rules for all collections
 */

'use strict';

// Schema definitions don't need direct collection access

/**
 * User Schema
 * Stores user accounts for customers, suppliers, and admins
 */
const userSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'email', 'role', 'passwordHash'],
      properties: {
        id: { bsonType: 'string', description: 'Unique user identifier' },
        name: { bsonType: 'string', description: 'User full name' },
        firstName: { bsonType: 'string', description: 'User first name' },
        lastName: { bsonType: 'string', description: 'User last name' },
        email: { bsonType: 'string', description: 'User email address' },
        role: { enum: ['customer', 'supplier', 'admin'], description: 'User role' },
        passwordHash: { bsonType: 'string', description: 'Hashed password' },
        location: { bsonType: 'string', description: 'User location (UK county)' },
        postcode: { bsonType: 'string', description: 'User postcode (optional)' },
        company: { bsonType: 'string', description: 'Company name (required for suppliers)' },
        jobTitle: { bsonType: 'string', description: 'Job title (optional for suppliers)' },
        website: { bsonType: 'string', description: 'Website URL (optional for suppliers)' },
        socials: {
          bsonType: 'object',
          description: 'Social media URLs (optional)',
          properties: {
            instagram: { bsonType: 'string' },
            facebook: { bsonType: 'string' },
            twitter: { bsonType: 'string' },
            linkedin: { bsonType: 'string' },
          },
        },
        avatarUrl: { bsonType: 'string', description: 'User avatar/profile picture URL' },
        notify: {
          bsonType: 'bool',
          description: 'Email notification preference (deprecated, use notify_account)',
        },
        notify_account: {
          bsonType: 'bool',
          description: 'Transactional email notifications (account, security)',
        },
        notify_marketing: {
          bsonType: 'bool',
          description: 'Marketing and promotional email consent',
        },
        marketingOptIn: {
          bsonType: 'bool',
          description: 'Marketing email consent (deprecated, use notify_marketing)',
        },
        verified: { bsonType: 'bool', description: 'Email verification status' },
        verificationToken: { bsonType: 'string', description: 'Email verification token' },
        verificationTokenExpiresAt: {
          bsonType: 'string',
          description: 'Verification token expiration timestamp',
        },
        resetToken: { bsonType: 'string', description: 'Password reset token' },
        resetTokenExpiresAt: { bsonType: 'string', description: 'Reset token expiration' },
        isPro: { bsonType: 'bool', description: 'Pro subscription status' },
        createdAt: { bsonType: 'string', description: 'Account creation timestamp' },
        lastLoginAt: { bsonType: 'string', description: 'Last login timestamp' },
        badges: {
          bsonType: 'array',
          items: { bsonType: 'string' },
          description: 'Badge IDs awarded to this user',
        },
      },
    },
  },
};

/**
 * Supplier Schema
 * Stores supplier/vendor business information
 */
const supplierSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'name', 'category'],
      properties: {
        id: { bsonType: 'string', description: 'Unique supplier identifier' },
        ownerUserId: { bsonType: 'string', description: 'User ID of the owner' },
        name: { bsonType: 'string', description: 'Business name' },
        logo: { bsonType: 'string', description: 'Business logo URL' },
        blurb: { bsonType: 'string', description: 'Short business blurb/tagline' },
        category: { bsonType: 'string', description: 'Supplier category' },
        location: { bsonType: 'string', description: 'Business location' },
        price_display: { bsonType: 'string', description: 'Price range display' },
        website: { bsonType: 'string', description: 'Business website URL' },
        email: { bsonType: 'string', description: 'Business contact email' },
        phone: { bsonType: 'string', description: 'Business contact phone' },
        license: { bsonType: 'string', description: 'Business license number' },
        amenities: {
          bsonType: 'array',
          items: { bsonType: 'string' },
          description: 'List of amenities',
        },
        maxGuests: { bsonType: 'int', description: 'Maximum guest capacity' },
        description_short: { bsonType: 'string', description: 'Short description' },
        description_long: { bsonType: 'string', description: 'Detailed description' },
        photos: { bsonType: 'array', items: { bsonType: 'string' }, description: 'Photo URLs' },
        photosGallery: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            properties: {
              url: { bsonType: 'string' },
              approved: { bsonType: 'bool' },
              uploadedAt: { bsonType: 'number' },
            },
          },
          description: 'Photo gallery with approval status',
        },
        approved: { bsonType: 'bool', description: 'Admin approval status' },
        isPro: { bsonType: 'bool', description: 'Pro subscription status' },
        proExpiresAt: { bsonType: 'string', description: 'Pro subscription expiration' },
        aiTags: {
          bsonType: 'array',
          items: { bsonType: 'string' },
          description: 'AI-generated tags',
        },
        aiScore: { bsonType: 'number', description: 'AI quality score' },
        aiUpdatedAt: { bsonType: 'string', description: 'Last AI update timestamp' },
        badges: {
          bsonType: 'array',
          items: { bsonType: 'string' },
          description: 'Badge IDs awarded to this supplier',
        },
        isTest: { bsonType: 'bool', description: 'Flag indicating test/seed data' },
        seedBatch: { bsonType: 'string', description: 'Seed batch identifier for cleanup' },
        createdAt: { bsonType: 'string', description: 'Creation timestamp' },
      },
    },
  },
};

/**
 * Package Schema
 * Stores service packages offered by suppliers
 */
const packageSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'supplierId', 'title'],
      properties: {
        id: { bsonType: 'string', description: 'Unique package identifier' },
        supplierId: { bsonType: 'string', description: 'Associated supplier ID' },
        title: { bsonType: 'string', description: 'Package title' },
        slug: { bsonType: 'string', description: 'URL-friendly package slug' },
        description: { bsonType: 'string', description: 'Package description' },
        price: { bsonType: 'string', description: 'Package price' },
        price_display: {
          bsonType: 'string',
          description: 'Display price (e.g., "From £500" or "Contact for pricing")',
        },
        location: { bsonType: 'string', description: 'Package location' },
        image: { bsonType: 'string', description: 'Main package image URL' },
        gallery: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            properties: {
              url: { bsonType: 'string' },
              approved: { bsonType: 'bool' },
              uploadedAt: { bsonType: 'number' },
            },
          },
          description: 'Package image gallery',
        },
        categories: {
          bsonType: 'array',
          items: { bsonType: 'string' },
          description: 'Category slugs this package belongs to',
        },
        primaryCategoryKey: {
          bsonType: 'string',
          description: 'Primary category key/slug (required, single-select)',
        },
        eventTypes: {
          bsonType: 'array',
          items: { enum: ['wedding', 'other'] },
          description: 'Event types this package is suitable for (required, multi-select)',
        },
        tags: {
          bsonType: 'array',
          items: { bsonType: 'string' },
          description: 'Package tags for search and filtering',
        },
        approved: { bsonType: 'bool', description: 'Admin approval status' },
        featured: { bsonType: 'bool', description: 'Featured package flag' },
        isFeatured: { bsonType: 'bool', description: 'Featured package flag (alias)' },
        isTest: { bsonType: 'bool', description: 'Flag indicating test/seed data' },
        seedBatch: { bsonType: 'string', description: 'Seed batch identifier for cleanup' },
        createdAt: { bsonType: 'string', description: 'Creation timestamp' },
      },
    },
  },
};

/**
 * Plan Schema
 * Stores customer event plans (saved suppliers and event details)
 */
const planSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'userId'],
      properties: {
        id: { bsonType: 'string', description: 'Unique plan identifier' },
        userId: { bsonType: 'string', description: 'Customer user ID' },
        supplierId: { bsonType: 'string', description: 'Saved supplier ID' },
        plan: { bsonType: 'object', description: 'Complete plan data structure' },
        eventType: { bsonType: 'string', description: 'Event type (Wedding, Other, etc.)' },
        eventName: { bsonType: 'string', description: 'Event name/title' },
        location: { bsonType: 'string', description: 'Event location' },
        date: { bsonType: 'string', description: 'Event date' },
        guests: { bsonType: 'int', description: 'Number of guests' },
        budget: { bsonType: 'string', description: 'Budget range' },
        packages: {
          bsonType: 'array',
          items: { bsonType: 'string' },
          description: 'Package IDs selected in wizard',
        },
        createdAt: { bsonType: 'string', description: 'Creation timestamp' },
        updatedAt: { bsonType: 'string', description: 'Last update timestamp' },
      },
    },
  },
};

/**
 * Note Schema
 * Stores customer notes for event planning
 */
const noteSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'userId'],
      properties: {
        id: { bsonType: 'string', description: 'Unique note identifier' },
        userId: { bsonType: 'string', description: 'Note owner user ID' },
        text: { bsonType: 'string', description: 'Note content' },
        createdAt: { bsonType: 'string', description: 'Creation timestamp' },
        updatedAt: { bsonType: 'string', description: 'Last update timestamp' },
      },
    },
  },
};

/**
 * Message Schema
 * Stores individual messages in conversation threads
 */
const messageSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'threadId', 'fromUserId', 'text'],
      properties: {
        id: { bsonType: 'string', description: 'Unique message identifier' },
        threadId: { bsonType: 'string', description: 'Parent thread ID' },
        fromUserId: { bsonType: 'string', description: 'Sender user ID' },
        fromRole: { bsonType: 'string', description: 'Sender role' },
        text: { bsonType: 'string', description: 'Message content' },
        packageId: { bsonType: 'string', description: 'Related package ID (optional)' },
        supplierId: { bsonType: 'string', description: 'Related supplier ID (optional)' },
        status: { bsonType: 'string', description: 'Message status (sent, read, etc.)' },
        isDraft: { bsonType: 'bool', description: 'Whether message is a draft' },
        sentAt: { bsonType: 'string', description: 'When message was sent (null for drafts)' },
        readBy: {
          bsonType: 'array',
          items: { bsonType: 'string' },
          description: 'User IDs who have read this message',
        },
        createdAt: { bsonType: 'string', description: 'Creation timestamp' },
        updatedAt: { bsonType: 'string', description: 'Last update timestamp' },
      },
    },
  },
};

/**
 * Thread Schema
 * Stores conversation threads between customers and suppliers
 */
const threadSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'supplierId', 'customerId'],
      properties: {
        id: { bsonType: 'string', description: 'Unique thread identifier' },
        supplierId: { bsonType: 'string', description: 'Supplier user/business ID' },
        supplierName: { bsonType: 'string', description: 'Supplier name' },
        customerId: { bsonType: 'string', description: 'Customer user ID' },
        customerName: { bsonType: 'string', description: 'Customer name' },
        packageId: { bsonType: 'string', description: 'Related package ID (optional)' },
        subject: { bsonType: 'string', description: 'Conversation subject' },
        status: { bsonType: 'string', description: 'Thread status (open, closed, archived)' },
        eventType: { bsonType: 'string', description: 'Type of event' },
        eventDate: { bsonType: 'string', description: 'Event date' },
        eventLocation: { bsonType: 'string', description: 'Event location' },
        guests: { bsonType: 'string', description: 'Number of guests' },
        lastMessageAt: { bsonType: 'string', description: 'Timestamp of last message' },
        lastMessagePreview: { bsonType: 'string', description: 'Preview of last message' },
        unreadCount: {
          bsonType: 'object',
          description: 'Unread message count per user',
        },
        createdAt: { bsonType: 'string', description: 'Thread creation timestamp' },
        updatedAt: { bsonType: 'string', description: 'Last activity timestamp' },
      },
    },
  },
};

/**
 * Category Schema
 * Stores package categories for browsing and filtering
 */
const categorySchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'name', 'slug'],
      properties: {
        id: { bsonType: 'string', description: 'Unique category identifier' },
        name: { bsonType: 'string', description: 'Category display name' },
        slug: { bsonType: 'string', description: 'URL-friendly category slug' },
        description: { bsonType: 'string', description: 'Category description' },
        heroImage: { bsonType: 'string', description: 'Hero image URL for category page' },
        icon: { bsonType: 'string', description: 'Icon or emoji for category' },
        order: { bsonType: 'int', description: 'Display order' },
      },
    },
  },
};

/**
 * Event Schema
 * Stores event records (if used)
 */
const eventSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id'],
      properties: {
        id: { bsonType: 'string', description: 'Unique event identifier' },
        userId: { bsonType: 'string', description: 'Event creator user ID' },
        title: { bsonType: 'string', description: 'Event title' },
        date: { bsonType: 'string', description: 'Event date' },
        location: { bsonType: 'string', description: 'Event location' },
        description: { bsonType: 'string', description: 'Event description' },
        createdAt: { bsonType: 'string', description: 'Creation timestamp' },
        updatedAt: { bsonType: 'string', description: 'Last update timestamp' },
      },
    },
  },
};

/**
 * Badge Schema
 * Stores badges that can be awarded to users and suppliers
 */
const badgeSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'name', 'type'],
      properties: {
        id: { bsonType: 'string', description: 'Unique badge identifier' },
        name: { bsonType: 'string', description: 'Badge name' },
        slug: { bsonType: 'string', description: 'URL-friendly badge slug' },
        type: {
          enum: ['founder', 'pro', 'pro-plus', 'verified', 'featured', 'custom'],
          description: 'Badge type',
        },
        description: { bsonType: 'string', description: 'Badge description' },
        icon: { bsonType: 'string', description: 'Badge icon/emoji' },
        color: { bsonType: 'string', description: 'Badge color (hex code)' },
        autoAssign: { bsonType: 'bool', description: 'Whether badge is auto-assigned' },
        autoAssignCriteria: {
          bsonType: 'object',
          description: 'Criteria for auto-assignment',
        },
        displayOrder: { bsonType: 'int', description: 'Display order priority' },
        active: { bsonType: 'bool', description: 'Whether badge is active' },
        createdAt: { bsonType: 'string', description: 'Creation timestamp' },
        updatedAt: { bsonType: 'string', description: 'Last update timestamp' },
      },
    },
  },
};

/**
 * Payment Schema
 * Stores payment and subscription records from Stripe
 */
const paymentSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'userId', 'amount', 'currency', 'status'],
      properties: {
        id: { bsonType: 'string', description: 'Unique payment identifier' },
        stripePaymentId: { bsonType: 'string', description: 'Stripe payment intent ID' },
        stripeCustomerId: { bsonType: 'string', description: 'Stripe customer ID' },
        stripeSubscriptionId: {
          bsonType: 'string',
          description: 'Stripe subscription ID (if applicable)',
        },
        userId: { bsonType: 'string', description: 'User ID who made the payment' },
        amount: { bsonType: 'number', description: 'Payment amount' },
        currency: { bsonType: 'string', description: 'Payment currency (e.g., GBP, USD)' },
        status: {
          enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refunded'],
          description: 'Payment status',
        },
        type: {
          enum: ['one_time', 'subscription'],
          description: 'Payment type',
        },
        subscriptionDetails: {
          bsonType: 'object',
          description: 'Subscription information if type is subscription',
          properties: {
            planId: { bsonType: 'string', description: 'Subscription plan ID' },
            planName: { bsonType: 'string', description: 'Subscription plan name' },
            interval: {
              enum: ['month', 'year'],
              description: 'Billing interval',
            },
            currentPeriodStart: {
              bsonType: 'string',
              description: 'Current billing period start date',
            },
            currentPeriodEnd: {
              bsonType: 'string',
              description: 'Current billing period end date',
            },
            cancelAtPeriodEnd: {
              bsonType: 'bool',
              description: 'Whether subscription will cancel at period end',
            },
            canceledAt: { bsonType: 'string', description: 'When subscription was canceled' },
          },
        },
        metadata: {
          bsonType: 'object',
          description: 'Additional metadata from Stripe',
        },
        createdAt: { bsonType: 'string', description: 'Payment creation timestamp' },
        updatedAt: { bsonType: 'string', description: 'Last update timestamp' },
      },
    },
  },
};

/**
 * Initialize collections with schemas and indexes
 * @param {Object} db - MongoDB database instance
 */
async function initializeCollections(db) {
  const collections = {
    users: userSchema,
    suppliers: supplierSchema,
    packages: packageSchema,
    categories: categorySchema,
    plans: planSchema,
    notes: noteSchema,
    messages: messageSchema,
    threads: threadSchema,
    events: eventSchema,
    badges: badgeSchema,
    payments: paymentSchema,
  };

  for (const [name, schema] of Object.entries(collections)) {
    try {
      // Check if collection exists
      const existingCollections = await db.listCollections({ name }).toArray();

      if (existingCollections.length === 0) {
        // Create collection with schema validation
        await db.createCollection(name, schema);
        console.log(`Created collection: ${name}`);
      } else {
        // Update validation rules for existing collection
        await db.command({
          collMod: name,
          validator: schema.validator,
        });
        console.log(`Updated validation for collection: ${name}`);
      }
    } catch (error) {
      console.error(`Error initializing collection ${name}:`, error.message);
    }
  }

  // Create indexes for better query performance
  await createIndexes(db);
}

/**
 * Create database indexes for performance optimization
 * @param {Object} db - MongoDB database instance
 */
async function createIndexes(db) {
  try {
    // User indexes
    await db.collection('users').createIndex({ id: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1 });
    await db.collection('users').createIndex({ verificationToken: 1 }, { sparse: true });
    await db.collection('users').createIndex({ verificationTokenExpiresAt: 1 }, { sparse: true });
    await db.collection('users').createIndex({ resetToken: 1 }, { sparse: true });

    // Supplier indexes
    await db.collection('suppliers').createIndex({ id: 1 }, { unique: true });
    await db.collection('suppliers').createIndex({ ownerUserId: 1 });
    await db.collection('suppliers').createIndex({ category: 1 });
    await db.collection('suppliers').createIndex({ approved: 1 });
    await db.collection('suppliers').createIndex({ isPro: 1 });

    // Package indexes
    await db.collection('packages').createIndex({ id: 1 }, { unique: true });
    await db.collection('packages').createIndex({ slug: 1 }, { unique: true, sparse: true });
    await db.collection('packages').createIndex({ supplierId: 1 });
    await db.collection('packages').createIndex({ approved: 1 });
    await db.collection('packages').createIndex({ featured: 1 });
    await db.collection('packages').createIndex({ isFeatured: 1 });
    await db.collection('packages').createIndex({ categories: 1 });
    await db.collection('packages').createIndex({ primaryCategoryKey: 1 });
    await db.collection('packages').createIndex({ eventTypes: 1 });

    // Category indexes
    await db.collection('categories').createIndex({ id: 1 }, { unique: true });
    await db.collection('categories').createIndex({ slug: 1 }, { unique: true });
    await db.collection('categories').createIndex({ order: 1 });

    // Plan indexes
    await db.collection('plans').createIndex({ id: 1 }, { unique: true });
    await db.collection('plans').createIndex({ userId: 1 });
    await db.collection('plans').createIndex({ supplierId: 1 });

    // Note indexes
    await db.collection('notes').createIndex({ id: 1 }, { unique: true });
    await db.collection('notes').createIndex({ userId: 1 });

    // Message indexes
    await db.collection('messages').createIndex({ id: 1 }, { unique: true });
    await db.collection('messages').createIndex({ threadId: 1 });
    await db.collection('messages').createIndex({ fromUserId: 1 });
    await db.collection('messages').createIndex({ createdAt: 1 });

    // Thread indexes
    await db.collection('threads').createIndex({ id: 1 }, { unique: true });
    await db.collection('threads').createIndex({ customerId: 1 });
    await db.collection('threads').createIndex({ supplierId: 1 });
    await db.collection('threads').createIndex({ updatedAt: 1 });

    // Event indexes
    await db.collection('events').createIndex({ id: 1 }, { unique: true });
    await db.collection('events').createIndex({ userId: 1 });

    // Badge indexes
    await db.collection('badges').createIndex({ id: 1 }, { unique: true });
    await db.collection('badges').createIndex({ slug: 1 }, { unique: true, sparse: true });
    await db.collection('badges').createIndex({ type: 1 });
    await db.collection('badges').createIndex({ active: 1 });

    // Payment indexes
    await db.collection('payments').createIndex({ id: 1 }, { unique: true });
    await db.collection('payments').createIndex({ userId: 1 });
    await db.collection('payments').createIndex({ stripePaymentId: 1 }, { sparse: true });
    await db.collection('payments').createIndex({ stripeCustomerId: 1 }, { sparse: true });
    await db.collection('payments').createIndex({ stripeSubscriptionId: 1 }, { sparse: true });
    await db.collection('payments').createIndex({ status: 1 });
    await db.collection('payments').createIndex({ createdAt: 1 });

    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error.message);
  }
}

module.exports = {
  initializeCollections,
  createIndexes,
};
