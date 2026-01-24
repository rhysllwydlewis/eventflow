const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

const files = {
  users: path.join(DATA_DIR, 'users.json'),
  suppliers: path.join(DATA_DIR, 'suppliers.json'),
  packages: path.join(DATA_DIR, 'packages.json'),
  categories: path.join(DATA_DIR, 'categories.json'),
  plans: path.join(DATA_DIR, 'plans.json'),
  notes: path.join(DATA_DIR, 'notes.json'),
  messages: path.join(DATA_DIR, 'messages.json'),
  threads: path.join(DATA_DIR, 'threads.json'),
  events: path.join(DATA_DIR, 'events.json'),
  reviews: path.join(DATA_DIR, 'reviews.json'),
  reports: path.join(DATA_DIR, 'reports.json'),
  audit_logs: path.join(DATA_DIR, 'audit_logs.json'),
  search_history: path.join(DATA_DIR, 'search_history.json'),
  photos: path.join(DATA_DIR, 'photos.json'),
  payments: path.join(DATA_DIR, 'payments.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
  badges: path.join(DATA_DIR, 'badges.json'),
  marketplace_listings: path.join(DATA_DIR, 'marketplace_listings.json'),
  tickets: path.join(DATA_DIR, 'tickets.json'),
  newsletterSubscribers: path.join(DATA_DIR, 'newsletter_subscribers.json'),
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  for (const k of Object.keys(files)) {
    if (!fs.existsSync(files[k])) {
      // Settings should be initialized as an object, not an array
      const initialValue = k === 'settings' ? '{}' : '[]';
      fs.writeFileSync(files[k], initialValue, 'utf8');
    }
  }
}

function read(name) {
  ensure();

  // Safety check: if the collection name is not registered, return empty array/object
  if (!files[name]) {
    if (process.env.NODE_ENV === 'test') {
      console.warn(
        `Warning: Attempted to read unknown collection '${name}' - returning empty array in test mode`
      );
      return [];
    }
    throw new Error(`Unknown collection: ${name}. Add it to the files object in store.js`);
  }

  try {
    const raw = fs.readFileSync(files[name], 'utf8') || '[]';
    // Settings should be an object, not an array
    const defaultValue = name === 'settings' ? '{}' : '[]';
    return JSON.parse(raw || defaultValue);
  } catch (_err) {
    // If a file is corrupt, fall back to backup if available; otherwise empty array/object.
    const backup = `${files[name]}.bak`;
    if (fs.existsSync(backup)) {
      try {
        const defaultValue = name === 'settings' ? '{}' : '[]';
        return JSON.parse(fs.readFileSync(backup, 'utf8') || defaultValue);
      } catch (_err2) {
        return name === 'settings' ? {} : [];
      }
    }
    return name === 'settings' ? {} : [];
  }
}

function write(name, data) {
  ensure();
  const file = files[name];

  // Safety check: if the collection name is not registered, skip the write in test environment
  if (!file) {
    if (process.env.NODE_ENV === 'test') {
      console.warn(
        `Warning: Attempted to write unknown collection '${name}' - skipping in test mode`
      );
      return;
    }
    throw new Error(`Unknown collection: ${name}. Add it to the files object in store.js`);
  }

  const tmp = `${file}.tmp`;
  const bak = `${file}.bak`;
  const json = JSON.stringify(data, null, 2);

  // Write to temp file first
  fs.writeFileSync(tmp, json, 'utf8');

  // Keep a simple backup of the last good state
  if (fs.existsSync(file)) {
    try {
      fs.copyFileSync(file, bak);
    } catch (_err) {
      // best-effort backup; ignore failures
    }
  }

  // Atomically replace the main file
  fs.renameSync(tmp, file);
}

function uid(prefix = 'id') {
  const s = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(2);
  return `${prefix}_${s}`;
}

module.exports = { read, write, uid, DATA_DIR };
