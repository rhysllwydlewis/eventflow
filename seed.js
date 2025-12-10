const bcrypt = require('bcryptjs');
const { read, write, uid } = require('./store');

// Seed the local JSON "database" with default records.
// For this demo build, we reset core demo data on startup
// so the logins and sample content are predictable.
// 
// Options:
// - skipIfExists: Don't overwrite existing data (for production)
// - seedUsers: Include default users (admin, supplier, customer)
// - seedSuppliers: Include demo suppliers
// - seedPackages: Include demo packages
function seed(options = {}) {
  const {
    skipIfExists = false,
    seedUsers = true,
    seedSuppliers = true,
    seedPackages = true
  } = options;

  // Users (owner account, and optional demo users)
  if (seedUsers) {
    const existingUsers = read('users');
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
        console.warn('WARNING: Using default owner password in production. Set OWNER_PASSWORD environment variable.');
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
      write('users', existingUsers);
    }
    
    if (skipIfExists && existingUsers.length > 0) {
      console.log(`User seed complete (production mode): ${existingUsers.length} users exist`);
    }
  }

  // Suppliers
  if (seedSuppliers) {
    const existingSuppliers = read('suppliers');
    if (skipIfExists && existingSuppliers.length > 0) {
      console.log('Suppliers already exist, skipping supplier seed');
    } else if (!Array.isArray(existingSuppliers) || existingSuppliers.length === 0) {
      const defaults = [
  {
    "id": "sup_xmkgxc6kd04f",
    "ownerUserId": null,
    "name": "The Willow Barn Venue",
    "category": "Venues",
    "location": "Monmouthshire, South Wales",
    "price_display": "From \u00a31,500",
    "website": "",
    "license": "",
    "amenities": [
      "Parking",
      "Garden"
    ],
    "maxGuests": 120,
    "photos": [
      "https://source.unsplash.com/featured/800x600/?wedding,barn"
    ],
    "description_short": "Rustic countryside venue.",
    "description_long": "Converted barn with indoor/outdoor spaces.",
    "email": "willowbarn@example.com",
    "approved": true
  },
  {
    "id": "sup_suj0sb6kd04f",
    "ownerUserId": null,
    "name": "Green Oak Catering",
    "category": "Catering",
    "location": "Cardiff & South Wales",
    "price_display": "\u00a3\u00a3",
    "website": "",
    "license": "",
    "amenities": [
      "Vegan options",
      "Serving staff"
    ],
    "maxGuests": 500,
    "photos": [
      "https://source.unsplash.com/featured/800x600/?catering,food"
    ],
    "description_short": "Seasonal menus with local produce.",
    "description_long": "Buffets and formal dining. Vegan options.",
    "email": "greenoakcatering@example.com",
    "approved": true
  },
  {
    "id": "sup_5n2run6kd04f",
    "ownerUserId": null,
    "name": "Snapshot Photography",
    "category": "Photography",
    "location": "Bristol & South West",
    "price_display": "From \u00a3800",
    "website": "",
    "license": "",
    "amenities": [
      "Online gallery"
    ],
    "maxGuests": 0,
    "photos": [
      "https://source.unsplash.com/featured/800x600/?wedding,photography"
    ],
    "description_short": "Relaxed documentary style.",
    "description_long": "Full-day or hourly packages.",
    "email": "snapshotphoto@example.com",
    "approved": true
  }
];
    write('suppliers', defaults);
      console.log('Created demo suppliers');
    }
  }

  // Packages
  if (seedPackages) {
    const existingPackages = read('packages');
    if (skipIfExists && existingPackages.length > 0) {
      console.log('Packages already exist, skipping package seed');
    } else if (!Array.isArray(existingPackages) || existingPackages.length === 0) {
      const defaults = [
  {
    "id": "pkg_pk1uq76kd04h",
    "supplierId": "sup_xmkgxc6kd04f",
    "title": "Barn Exclusive",
    "price": "\u00a33,500",
    "description": "Full-day venue hire, ceremony & reception areas.",
    "image": "https://source.unsplash.com/featured/800x600/?rustic,venue",
    "approved": true,
    "featured": true
  },
  {
    "id": "pkg_3e3fdh6kd04h",
    "supplierId": "sup_suj0sb6kd04f",
    "title": "Seasonal Feast",
    "price": "\u00a345 pp",
    "description": "Three-course seasonal menu with staff & setup.",
    "image": "https://source.unsplash.com/featured/800x600/?banquet,catering",
    "approved": true,
    "featured": false
  },
  {
    "id": "pkg_8b6fmw6kd04h",
    "supplierId": "sup_5n2run6kd04f",
    "title": "Full Day Capture",
    "price": "\u00a31,200",
    "description": "Prep through first dance, private gallery.",
    "image": "https://source.unsplash.com/featured/800x600/?camera,photography",
    "approved": true,
    "featured": false
  }
];
      write('packages', defaults);
      console.log('Created demo packages');
    }
  }

  // Always ensure these collections exist as arrays
  for (const name of ['plans','notes','messages','threads','events','reviews','reports','audit_logs','search_history','photos']) {
    const items = read(name);
    if (!Array.isArray(items) || items.length === 0) {
      write(name, []);
    }
  }
  
  console.log('Seed complete');
}

module.exports = { seed };
