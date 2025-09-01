const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Path to your database file
const dbPath = path.resolve(__dirname, '../../data/medstock.db');

// Create and export the database instance
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database:', dbPath);
  }
});

module.exports = db;
