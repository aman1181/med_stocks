const mongoose = require('mongoose');

const BatchSchema = new mongoose.Schema({
	batch_id: { type: String }, // UUID for batch
	batch_no: { type: String },
	qty: { type: Number, default: 0 },
	cost: { type: Number },
	price: { type: Number },
	expiry_date: { type: Date },
	created_at: { type: Date, default: Date.now },
	updated_at: { type: Date, default: Date.now }
});

const InventorySchema = new mongoose.Schema({
	product_id: { type: String }, // UUID for product
	product_name: { type: String, required: true },
	unit: { type: String },
	tax: { type: Number },
	vendor_id: { type: String },
	vendor_name: { type: String },
	batches: [BatchSchema]
}, { timestamps: true });

module.exports = mongoose.model('Inventory', InventorySchema);
