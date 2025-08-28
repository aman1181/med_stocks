
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	role: { type: String, enum: ['admin', 'user', 'audit', 'pharmacist'], default: 'user' },
	status: { type: String, enum: ['active', 'inactive'], default: 'active' },
	last_login: { type: Date },
	// Add other fields as needed
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
