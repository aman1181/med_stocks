
const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
	vendor_id: { type: String }, // UUID for vendor
	name: { type: String, required: true },
	contact_person: { type: String },
	phone: { type: String },
	email: { type: String },
	address: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Vendor', VendorSchema);
