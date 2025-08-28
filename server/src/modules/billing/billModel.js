const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
  bill_no: { type: String, required: true },
  date: { type: Date, default: Date.now },
  total_amount: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  customer_name: { type: String, default: '' },
  customer_phone: { type: String, default: '' },
  payment_method: { type: String, default: 'cash' },
  items: [{
    product_name: String,
    quantity: Number,
    price: Number,
    batch_id: String,
    vendor_name: String,
    unit: String,
    total: Number
    // add other item fields as needed
  }],
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // add other fields as needed
}, { timestamps: true });

module.exports = mongoose.model('Bill', BillSchema);
