const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const dbpath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'medstock.db');
fs.mkdirSync(path.dirname(dbpath), { recursive: true });

const db = new Database(dbpath);

// Initialize DB Tables
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      uuid TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      uuid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      tax REAL DEFAULT 0,
      vendor_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(vendor_id) REFERENCES vendors(uuid)
    );

    CREATE TABLE IF NOT EXISTS batches (
      uuid TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      batch_no TEXT,
      expiry_date TEXT,
      qty INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      price REAL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(product_id) REFERENCES products(uuid)
    );

    CREATE TABLE IF NOT EXISTS vendors (
      uuid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT,
      address TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS doctors (
      uuid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      specialization TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS bills (
      uuid TEXT PRIMARY KEY,
      bill_no TEXT,
      date TEXT DEFAULT (datetime('now')),
      doctor_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      payment_method TEXT DEFAULT 'cash',
      total_amount REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(doctor_id) REFERENCES doctors(uuid)
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      uuid TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      batch_id TEXT,
      qty INTEGER DEFAULT 0,
      price REAL DEFAULT 0,
      FOREIGN KEY(bill_id) REFERENCES bills(uuid),
      FOREIGN KEY(product_id) REFERENCES products(uuid),
      FOREIGN KEY(batch_id) REFERENCES batches(uuid)
    );

    CREATE TABLE IF NOT EXISTS events (
      uuid TEXT PRIMARY KEY,
      type TEXT,
      payload TEXT,
      timestamp TEXT
    );
  `);

  // Indexes for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date);
    CREATE INDEX IF NOT EXISTS idx_billitems_billid ON bill_items(bill_id);
    CREATE INDEX IF NOT EXISTS idx_billitems_productid ON bill_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
  `);

  console.log('✅ DATABASE INITIALIZED AT', dbpath);
}

// Helper Functions
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

// Export both raw db methods and helpers
module.exports = {
  ...db,  
  initDB,
  run,
  get,
  all
};