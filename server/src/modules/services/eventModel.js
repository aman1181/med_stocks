const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed },
  description: { type: String },
  timestamp: { type: Date, default: Date.now },
  source: { type: String, default: 'eventServices' }
});

module.exports = mongoose.model('Event', EventSchema);
