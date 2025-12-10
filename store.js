const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

const files = {
  users: path.join(DATA_DIR, 'users.json'),
  suppliers: path.join(DATA_DIR, 'suppliers.json'),
  packages: path.join(DATA_DIR, 'packages.json'),
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
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  for (const k of Object.keys(files)) {
    if (!fs.existsSync(files[k])) {
      fs.writeFileSync(files[k], '[]', 'utf8');
    }
  }
}

function read(name) {
  ensure();
  try {
    const raw = fs.readFileSync(files[name], 'utf8') || '[]';
    return JSON.parse(raw);
  } catch (_err) {
    // If a file is corrupt, fall back to backup if available; otherwise empty array.
    const backup = files[name] + '.bak';
    if (fs.existsSync(backup)) {
      try {
        return JSON.parse(fs.readFileSync(backup, 'utf8') || '[]');
      } catch (_err2) {
        return [];
      }
    }
    return [];
  }
}

function write(name, data) {
  ensure();
  const file = files[name];
  const tmp = file + '.tmp';
  const bak = file + '.bak';
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
