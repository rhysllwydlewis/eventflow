const { MongoClient } = require('mongodb');
const logger = require('../utils/logger');

let client = null;
let db = null;

async function connectDatabase() {
  if (db) {
    return db;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not set');
  }

  client = new MongoClient(uri, { maxPoolSize: 10, minPoolSize: 2 });
  await client.connect();
  db = client.db(process.env.MONGODB_DB_NAME || 'eventflow');

  logger.info('MongoDB connected');
  return db;
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not connected');
  }
  return db;
}

async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { connectDatabase, getDatabase, closeDatabase };
