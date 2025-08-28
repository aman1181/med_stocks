const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialization: { type: String, required: true },
  phone: String
}, { timestamps: true });

module.exports = mongoose.model('Doctor', DoctorSchema);
