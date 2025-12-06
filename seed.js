const bcrypt = require('bcryptjs');
const { read, write, uid } = require('./store');

// Seed the local JSON "database" with default records.
// For this demo build, we reset core demo data on startup
// so the logins and sample content are predictable.
function seed() {
  // Users (admin, supplier demo, customer demo)
  const now = new Date().toISOString();
  const admin = {
    id: uid('usr'),
    name: 'Admin',
    email: 'admin@eventflow.local',
    role: 'admin',
    passwordHash: bcrypt.hashSync('Admin123!', 10),
    createdAt: now,
    notify: true,
    marketingOptIn: false,
    verified: true,
  };
  const supplier = {
    id: uid('usr'),
    name: 'Supplier Demo',
    email: 'supplier@eventflow.local',
    role: 'supplier',
    passwordHash: bcrypt.hashSync('Supplier123!', 10),
    createdAt: now,
    notify: true,
    marketingOptIn: false,
    verified: true,
  };
  const customer = {
    id: uid('usr'),
    name: 'Customer Demo',
    email: 'customer@eventflow.local',
    role: 'customer',
    passwordHash: bcrypt.hashSync('Customer123!', 10),
    createdAt: now,
    notify: true,
    marketingOptIn: false,
    verified: true,
  };
  write('users', [admin, supplier, customer]);

  // Suppliers
  if (!Array.isArray(read('suppliers')) || read('suppliers').length === 0) {
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
  }

  // Packages
  if (!Array.isArray(read('packages')) || read('packages').length === 0) {
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
  }

  // Always ensure these collections exist as arrays
  for (const name of ['plans','notes','messages','threads','events']) {
    const items = read(name);
    if (!Array.isArray(items) || items.length === 0) {
      write(name, []);
    }
  }
}

module.exports = { seed };
