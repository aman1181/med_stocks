// --- GET single product by product_id (API endpoint) ---
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Inventory.findOne({ product_id: id });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    console.error("Get product by id error:", err);
    res.status(500).json({ error: "Failed to fetch product", details: err.message });
  }
};
const { logEvent, Events } = require("../services/eventServices");
const Inventory = require("./inventoryModel");
const LOW_STOCK_LIMIT = 10;

// --- GET all inventory (API endpoint) ---
exports.getInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find();
    res.json(inventory);
  } catch (err) {
    console.error("Get inventory error:", err);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
};

// --- ADD new product + batch (API endpoint) ---
exports.addProduct = async (req, res) => {
  try {
    const { product_name, unit, tax, vendor_id, vendor_name, batch_no, expiry_date, qty, cost, price } = req.body;
    if (!product_name || !qty || !cost || !price) {
      return res.status(400).json({ error: "Product name, quantity, cost, and price are required" });
    }
    const batchId = require('uuid').v4();
    const batch = {
      batch_id: batchId,
      batch_no,
      qty,
      cost,
      price,
      expiry_date,
      created_at: new Date(),
      updated_at: new Date()
    };
    const inventory = new Inventory({
      product_id: require('uuid').v4(),
      product_name,
      unit,
      tax,
      vendor_id,
      vendor_name,
      batches: [batch]
    });
    await inventory.save();
    logEvent({
      type: Events.PRODUCT_ADDED,
      payload: {
        product_id: inventory.product_id,
        batch_id: batchId,
        name: product_name,
        batch_no,
        qty,
        cost,
        price
      },
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, productId: inventory.product_id, batchId });
  } catch (err) {
    console.error("Add product error:", err);
    res.status(500).json({ error: "Failed to add product", details: err.message });
  }
};

// --- UPDATE product + batch (API endpoint) ---
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, unit, tax, vendor_id, vendor_name, batch_id, batch_no, expiry_date, qty, cost, price } = req.body;
    console.log("[updateProduct] Incoming data:", { id, product_name, unit, tax, vendor_id, vendor_name, batch_id, batch_no, expiry_date, qty, cost, price });
    if (!product_name || !qty || !cost || !price) {
      console.log("[updateProduct] Missing required fields");
      return res.status(400).json({ error: "Product name, quantity, cost, and price are required" });
    }
    const inventory = await Inventory.findOne({ product_id: id });
    if (!inventory) {
      console.log(`[updateProduct] Product not found for product_id: ${id}`);
      return res.status(404).json({ error: "Product not found" });
    }
    // Update product fields
    inventory.product_name = product_name;
    inventory.unit = unit;
    inventory.tax = tax;
    inventory.vendor_id = vendor_id;
    inventory.vendor_name = vendor_name;
    // Update batch if batch_id provided
    let oldBatch = null;
    if (batch_id) {
      const batch = inventory.batches.find(b => b.batch_id === batch_id);
      console.log(`[updateProduct] Batch lookup for batch_id: ${batch_id}`, batch ? "FOUND" : "NOT FOUND", batch);
      if (!batch) {
        console.log(`[updateProduct] Batch not found for batch_id: ${batch_id}`);
        return res.status(404).json({ error: "Batch not found" });
      }
      oldBatch = { ...batch };
      batch.batch_no = batch_no;
      batch.expiry_date = expiry_date;
      batch.qty = qty;
      batch.cost = cost;
      batch.price = price;
      batch.updated_at = new Date();
    } else {
      console.log("[updateProduct] No batch_id provided, batch update skipped.");
    }
    await inventory.save();
    logEvent({
      type: Events.PRODUCT_UPDATED,
      payload: {
        product_id: id,
        batch_id,
        name: product_name,
        old_data: oldBatch,
        new_data: { name: product_name, qty }
      },
      timestamp: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({ error: "Failed to update product", details: err.message });
  }
};

// --- DELETE product + batches (API endpoint) ---
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const inventory = await Inventory.findOne({ product_id: id });
    if (!inventory) {
      return res.status(404).json({ error: "Product not found" });
    }
    const batchesInfo = inventory.batches || [];
    await Inventory.deleteOne({ product_id: id });
    logEvent({
      type: Events.PRODUCT_DELETED,
      payload: {
        product_id: id,
        name: inventory.product_name || 'Unknown',
        deleted_batches: batchesInfo.length,
        batches: batchesInfo.map(b => ({
          batch_id: b.batch_id,
          batch_no: b.batch_no,
          qty: b.qty
        }))
      },
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, deletedBatches: batchesInfo.length });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ error: "Failed to delete product", details: err.message });
  }
};

// --- SELL product (reduce qty + event log) (API endpoint) ---
exports.sellProduct = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: "Valid quantity is required" });
    }
    // Find inventory containing the batch
    const inventory = await Inventory.findOne({ 'batches.batch_id': batchId });
    if (!inventory) {
      return res.status(404).json({ error: "Batch not found" });
    }
    const batch = inventory.batches.find(b => b.batch_id === batchId);
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }
    if (batch.qty < quantity) {
      return res.status(400).json({ error: "Not enough stock available" });
    }
    batch.qty -= quantity;
    batch.updated_at = new Date();
    await inventory.save();
    const ts = new Date().toISOString();
    // Low stock event
    if (batch.qty <= LOW_STOCK_LIMIT) {
      logEvent({
        type: Events.STOCK_LOW,
        payload: {
          product_id: inventory.product_id,
          batch_id: batchId,
          product_name: inventory.product_name,
          remaining_qty: batch.qty,
          threshold: LOW_STOCK_LIMIT
        },
        timestamp: ts
      });
    }
    // Expired stock event
    if (batch.expiry_date && new Date(batch.expiry_date) < new Date()) {
      logEvent({
        type: 'stock.expired',
        payload: {
          product_id: inventory.product_id,
          batch_id: batchId,
          product_name: inventory.product_name,
          expiry_date: batch.expiry_date
        },
        timestamp: ts
      });
    }
    // Sell event
    logEvent({
      type: Events.PRODUCT_SOLD,
      payload: {
        batch_id: batchId,
        product_id: inventory.product_id,
        product_name: inventory.product_name,
        batch_no: batch.batch_no,
        quantity_sold: quantity,
        remaining_qty: batch.qty,
        sale_value: (quantity * batch.price).toFixed(2)
      },
      timestamp: ts
    });
    res.json({ success: true, remaining_qty: batch.qty, sale_value: (quantity * batch.price).toFixed(2) });
  } catch (err) {
    console.error("Sell product error:", err);
    res.status(500).json({ error: "Failed to sell product", details: err.message });
  }
};

// --- Helper functions (for internal use) ---
module.exports = {
  getInventory: exports.getInventory,
  addProduct: exports.addProduct,
  updateProduct: exports.updateProduct,
  deleteProduct: exports.deleteProduct,
  sellProduct: exports.sellProduct
  ,getProductById: exports.getProductById
};