const bcrypt = require('bcryptjs');
const dbUnified = require('./db-unified');
const { uid } = require('./store');

// Seed the database with default records.
// MongoDB-first: Data goes to MongoDB when available, local storage as fallback.
//
// Options:
// - skipIfExists: Don't overwrite existing data (for production)
// - seedUsers: Include default users (admin, supplier, customer)
// - seedSuppliers: Include demo suppliers
// - seedPackages: Include demo packages
async function seed(options = {}) {
  const {
    skipIfExists = false,
    seedUsers = true,
    seedSuppliers = true,
    seedPackages = true,
    autoMigrateFromLocal = true, // New option to auto-migrate from local storage
  } = options;

  // AUTO-MIGRATION: If MongoDB is being used and local data exists, migrate it first
  if (autoMigrateFromLocal) {
    try {
      // Wait for database to be initialized
      await dbUnified.initializeDatabase();
      const dbType = dbUnified.getDatabaseType();
      
      if (dbType === 'mongodb') {
        // Check if MongoDB is empty and local storage has data
        const usersInMongo = await dbUnified.read('users');
        const packagesInMongo = await dbUnified.read('packages');
        const suppliersInMongo = await dbUnified.read('suppliers');
        
        const mongoIsEmpty = usersInMongo.length <= 1 && // Allow owner account
                            packagesInMongo.length === 0 && 
                            suppliersInMongo.length === 0;
        
        if (mongoIsEmpty) {
          // Try to read from local storage
          const store = require('./store');
          const localPackages = store.read('packages');
          const localSuppliers = store.read('suppliers');
          const localUsers = store.read('users');
          
          const hasLocalData = (Array.isArray(localPackages) && localPackages.length > 0) ||
                               (Array.isArray(localSuppliers) && localSuppliers.length > 0) ||
                               (Array.isArray(localUsers) && localUsers.length > 1); // More than just owner
          
          if (hasLocalData) {
            console.log('');
            console.log('🔄 Auto-migration: Detected local data, migrating to MongoDB...');
            const dbUtils = require('./db-utils');
            const migrationResults = await dbUtils.migrateFromJson(store);
            
            console.log('✅ Auto-migration complete!');
            console.log(`   Migrated: ${migrationResults.success.join(', ')}`);
            if (migrationResults.failed.length > 0) {
              console.log(`   Failed: ${migrationResults.failed.join(', ')}`);
            }
            console.log('');
            
            // Skip seeding since we just migrated real data
            return;
          }
        }
      }
    } catch (error) {
      console.log('Auto-migration check skipped:', error.message);
      // Continue with normal seeding
    }
  }

  // Users (owner account, and optional demo users)
  if (seedUsers) {
    const existingUsers = await dbUnified.read('users');
    const now = new Date().toISOString();
    let usersModified = false;

    // Always ensure owner account exists (protected from deletion)
    const ownerEmail = 'admin@event-flow.co.uk';
    const ownerPassword = process.env.OWNER_PASSWORD || 'Admin123!'; // Default for dev only
    const ownerExists = existingUsers.find(u => u.email === ownerEmail);
    if (!ownerExists) {
      const owner = {
        id: uid('usr'),
        name: 'EventFlow Owner',
        email: ownerEmail,
        role: 'admin',
        passwordHash: bcrypt.hashSync(ownerPassword, 10),
        createdAt: now,
        notify: true,
        marketingOptIn: false,
        verified: true,
        isOwner: true, // Special flag to protect from deletion
      };
      existingUsers.push(owner);
      usersModified = true;
      console.log(`Created owner account: ${ownerEmail}`);
      if (!process.env.OWNER_PASSWORD && process.env.NODE_ENV === 'production') {
        console.warn(
          'WARNING: Using default owner password in production. Set OWNER_PASSWORD environment variable.'
        );
      }
    }

    // Create demo users only if skipIfExists is false (demo/dev mode)
    if (!skipIfExists) {
      // Check and create demo admin if it doesn't exist
      const demoAdminEmail = 'admin@eventflow.local';
      if (!existingUsers.find(u => u.email === demoAdminEmail)) {
        const admin = {
          id: uid('usr'),
          name: 'Admin',
          email: demoAdminEmail,
          role: 'admin',
          passwordHash: bcrypt.hashSync('Admin123!', 10),
          createdAt: now,
          notify: true,
          marketingOptIn: false,
          verified: true,
        };
        existingUsers.push(admin);
        usersModified = true;
        console.log(`Created demo admin user: ${demoAdminEmail}`);
      }

      // Check and create demo supplier if it doesn't exist
      const demoSupplierEmail = 'supplier@eventflow.local';
      if (!existingUsers.find(u => u.email === demoSupplierEmail)) {
        const supplier = {
          id: uid('usr'),
          name: 'Supplier Demo',
          email: demoSupplierEmail,
          role: 'supplier',
          passwordHash: bcrypt.hashSync('Supplier123!', 10),
          createdAt: now,
          notify: true,
          marketingOptIn: false,
          verified: true,
        };
        existingUsers.push(supplier);
        usersModified = true;
        console.log(`Created demo supplier user: ${demoSupplierEmail}`);
      }

      // Check and create demo customer if it doesn't exist
      const demoCustomerEmail = 'customer@eventflow.local';
      if (!existingUsers.find(u => u.email === demoCustomerEmail)) {
        const customer = {
          id: uid('usr'),
          name: 'Customer Demo',
          email: demoCustomerEmail,
          role: 'customer',
          passwordHash: bcrypt.hashSync('Customer123!', 10),
          createdAt: now,
          notify: true,
          marketingOptIn: false,
          verified: true,
        };
        existingUsers.push(customer);
        usersModified = true;
        console.log(`Created demo customer user: ${demoCustomerEmail}`);
      }
    }

    // Only write if we made changes
    if (usersModified) {
      await dbUnified.write('users', existingUsers);
    }

    if (skipIfExists && existingUsers.length > 0) {
      console.log(`User seed complete (production mode): ${existingUsers.length} users exist`);
    }
  }

  // Categories
  const existingCategories = await dbUnified.read('categories');
  if (!Array.isArray(existingCategories) || existingCategories.length === 0) {
    const categories = [
      {
        id: 'cat_venues',
        name: 'Venues',
        slug: 'venues',
        description:
          'Find the perfect space for your event, from grand ballrooms to intimate gardens',
        heroImage: '/assets/images/collage-venue.jpg',
        icon: '🏛️',
        order: 1,
      },
      {
        id: 'cat_catering',
        name: 'Catering',
        slug: 'catering',
        description: 'Delicious food and drink options to suit every taste and budget',
        heroImage: '/assets/images/collage-catering.jpg',
        icon: '🍽️',
        order: 2,
      },
      {
        id: 'cat_entertainment',
        name: 'Entertainment',
        slug: 'entertainment',
        description: 'Live music, DJs, performers and entertainment to make your event memorable',
        heroImage: '/assets/images/collage-entertainment.jpg',
        icon: '🎵',
        order: 3,
      },
      {
        id: 'cat_photography',
        name: 'Photography',
        slug: 'photography',
        description: 'Professional photographers and videographers to capture every special moment',
        heroImage: '/assets/images/collage-photography.jpg',
        icon: '📸',
        order: 4,
      },
      {
        id: 'cat_decor',
        name: 'Decor & Styling',
        slug: 'decor-styling',
        description: 'Transform your venue with beautiful decorations, flowers, and styling',
        heroImage: '',
        icon: '💐',
        order: 5,
      },
      {
        id: 'cat_av',
        name: 'AV & Lighting',
        slug: 'av-lighting',
        description: 'Professional sound systems, lighting, and audiovisual equipment',
        heroImage: '',
        icon: '💡',
        order: 6,
      },
      {
        id: 'cat_transport',
        name: 'Transport',
        slug: 'transport',
        description: 'Luxury cars, coaches, and transportation services for your guests',
        heroImage: '',
        icon: '🚗',
        order: 7,
      },
      {
        id: 'cat_planning',
        name: 'Event Planning',
        slug: 'planning',
        description: 'Expert planners and coordinators to bring your vision to life',
        heroImage: '',
        icon: '📋',
        order: 8,
      },
      {
        id: 'cat_cakes',
        name: 'Cakes & Florals',
        slug: 'cakes-florals',
        description: 'Beautiful wedding cakes and stunning floral arrangements',
        heroImage: '',
        icon: '🎂',
        order: 9,
      },
    ];
    await dbUnified.write('categories', categories);
    console.log('Created demo categories');
  }

  // Suppliers
  if (seedSuppliers) {
    const existingSuppliers = await dbUnified.read('suppliers');
    if (skipIfExists && existingSuppliers.length > 0) {
      console.log('Suppliers already exist, skipping supplier seed');
    } else if (!Array.isArray(existingSuppliers) || existingSuppliers.length === 0) {
      const defaults = [
        {
          id: 'sup_xmkgxc6kd04f',
          ownerUserId: null,
          name: 'The Willow Barn Venue',
          logo: 'https://source.unsplash.com/100x100/?logo,barn',
          blurb: 'Your perfect rustic wedding venue',
          category: 'Venues',
          location: 'Monmouthshire, South Wales',
          price_display: 'From \u00a31,500',
          website: '',
          email: 'willowbarn@example.com',
          phone: '01234 567890',
          license: '',
          amenities: ['Parking', 'Garden'],
          maxGuests: 120,
          photos: ['https://source.unsplash.com/featured/800x600/?wedding,barn'],
          description_short: 'Rustic countryside venue.',
          description_long: 'Converted barn with indoor/outdoor spaces.',
          approved: true,
        },
        {
          id: 'sup_suj0sb6kd04f',
          ownerUserId: null,
          name: 'Green Oak Catering',
          logo: 'https://source.unsplash.com/100x100/?logo,food',
          blurb: 'Seasonal menus with local produce',
          category: 'Catering',
          location: 'Cardiff & South Wales',
          price_display: '\u00a3\u00a3',
          website: '',
          email: 'greenoakcatering@example.com',
          phone: '01234 567891',
          license: '',
          amenities: ['Vegan options', 'Serving staff'],
          maxGuests: 500,
          photos: ['https://source.unsplash.com/featured/800x600/?catering,food'],
          description_short: 'Seasonal menus with local produce.',
          description_long: 'Buffets and formal dining. Vegan options.',
          approved: true,
        },
        {
          id: 'sup_5n2run6kd04f',
          ownerUserId: null,
          name: 'Snapshot Photography',
          logo: 'https://source.unsplash.com/100x100/?logo,camera',
          blurb: 'Capturing your special moments',
          category: 'Photography',
          location: 'Bristol & South West',
          price_display: 'From \u00a3800',
          website: '',
          email: 'snapshotphoto@example.com',
          phone: '01234 567892',
          license: '',
          amenities: ['Online gallery'],
          maxGuests: 0,
          photos: ['https://source.unsplash.com/featured/800x600/?wedding,photography'],
          description_short: 'Relaxed documentary style.',
          description_long: 'Full-day or hourly packages.',
          approved: true,
        },
      ];
      await dbUnified.write('suppliers', defaults);
      console.log('Created demo suppliers');
    }
  }

  // Packages
  if (seedPackages) {
    const existingPackages = await dbUnified.read('packages');
    if (skipIfExists && existingPackages.length > 0) {
      console.log('Packages already exist, skipping package seed');
    } else if (!Array.isArray(existingPackages) || existingPackages.length === 0) {
      const defaults = [
        {
          id: 'pkg_pk1uq76kd04h',
          supplierId: 'sup_xmkgxc6kd04f',
          slug: 'barn-exclusive',
          title: 'Barn Exclusive',
          price: '\u00a33,500',
          location: 'Monmouthshire, South Wales',
          description:
            'Full-day venue hire, ceremony & reception areas. Includes indoor and outdoor spaces, tables and chairs, parking for 50 cars.',
          image: 'https://source.unsplash.com/featured/800x600/?rustic,venue',
          gallery: [
            {
              url: 'https://source.unsplash.com/featured/800x600/?rustic,venue',
              approved: true,
              uploadedAt: Date.now(),
            },
            {
              url: 'https://source.unsplash.com/featured/800x600/?barn,interior',
              approved: true,
              uploadedAt: Date.now(),
            },
          ],
          categories: ['venues'],
          tags: ['rustic', 'barn', 'countryside', 'outdoor'],
          approved: true,
          featured: true,
          isFeatured: true,
        },
        {
          id: 'pkg_3e3fdh6kd04h',
          supplierId: 'sup_suj0sb6kd04f',
          slug: 'seasonal-feast',
          title: 'Seasonal Feast',
          price: '\u00a345 pp',
          location: 'Cardiff & South Wales',
          description:
            'Three-course seasonal menu with staff & setup. Includes locally sourced ingredients, vegan options available.',
          image: 'https://source.unsplash.com/featured/800x600/?banquet,catering',
          gallery: [
            {
              url: 'https://source.unsplash.com/featured/800x600/?banquet,catering',
              approved: true,
              uploadedAt: Date.now(),
            },
          ],
          categories: ['catering'],
          tags: ['seasonal', 'local', 'vegan-friendly'],
          approved: true,
          featured: false,
          isFeatured: false,
        },
        {
          id: 'pkg_8b6fmw6kd04h',
          supplierId: 'sup_5n2run6kd04f',
          slug: 'full-day-capture',
          title: 'Full Day Capture',
          price: '\u00a31,200',
          location: 'Bristol & South West',
          description:
            'Prep through first dance, private gallery. Includes all edited photos, online gallery access, and print rights.',
          image: 'https://source.unsplash.com/featured/800x600/?camera,photography',
          gallery: [
            {
              url: 'https://source.unsplash.com/featured/800x600/?camera,photography',
              approved: true,
              uploadedAt: Date.now(),
            },
          ],
          categories: ['photography'],
          tags: ['documentary', 'candid', 'full-day'],
          approved: true,
          featured: true,
          isFeatured: true,
        },
      ];
      await dbUnified.write('packages', defaults);
      console.log('Created demo packages');
    }
  }

  // Always ensure these collections exist as arrays
  for (const name of [
    'categories',
    'plans',
    'notes',
    'messages',
    'threads',
    'events',
    'reviews',
    'reports',
    'audit_logs',
    'search_history',
    'photos',
  ]) {
    const items = await dbUnified.read(name);
    if (!Array.isArray(items) || items.length === 0) {
      await dbUnified.write(name, []);
    }
  }

  console.log('Seed complete');
}

module.exports = { seed };
