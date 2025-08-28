const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/medstock';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});
db.once('open', () => {
  console.log('✅ Connected to MongoDB at', MONGO_URI);
});

// Utility: Check connection status
function isConnected() {
  return db.readyState === 1;
}

module.exports = {
  mongoose,
  db,
  isConnected
};