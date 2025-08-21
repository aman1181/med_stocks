const db = require("../services/dbServices");
const { v4: uuidv4 } = require("uuid");
const { logEvent, Events } = require("../services/eventServices");

const LOW_STOCK_LIMIT = 10;

// --- GET all inventory (API endpoint) ---
exports.getInventory = (req, res) => {
  try {
    const inventory = db.all(`
      SELECT 
        p.uuid AS product_id,
        p.name AS product_name,
        p.unit,
        p.tax,
        p.vendor_id,
        v.name AS vendor_name,
        b.uuid AS batch_id,
        b.batch_no,
        b.qty,
        b.cost,
        b.price,
        b.expiry_date,
        b.created_at,
        b.updated_at
      FROM products p
      LEFT JOIN vendors v ON p.vendor_id = v.uuid
      LEFT JOIN batches b ON p.uuid = b.product_id
      ORDER BY 
        CASE 
          WHEN b.expiry_date IS NOT NULL AND DATE(b.expiry_date) < DATE('now') THEN 0
          ELSE 1
        END,
        b.expiry_date ASC,
        b.qty ASC
    `);
    
    console.log("Fetched inventory:", inventory.length);
    res.json(inventory);
  } catch (err) {
    console.error("Get inventory error:", err);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
};

// --- ADD new product + batch (API endpoint) ---
exports.addProduct = (req, res) => {
  try {
    const { name, unit, tax, vendor_id, batch_no, expiry_date, qty, cost, price } = req.body;
    console.log("Adding product:", { name, unit, tax, vendor_id, batch_no, qty, cost, price });

    if (!name || !qty || !cost || !price) {
      return res.status(400).json({ error: "Name, quantity, cost, and price are required" });
    }

    const productId = uuidv4();
    const batchId = uuidv4();
    const ts = new Date().toISOString();

    // Insert product
    db.run(
      `INSERT INTO products (uuid, name, unit, tax, vendor_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [productId, name.trim(), unit?.trim() || '', parseFloat(tax) || 0, vendor_id || null, ts, ts]
    );

    // Insert batch
    db.run(
      `INSERT INTO batches (uuid, product_id, batch_no, expiry_date, qty, cost, price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [batchId, productId, batch_no?.trim() || '', expiry_date || null, parseInt(qty), parseFloat(cost), parseFloat(price), ts, ts]
    );

    // ✅ Enhanced event logging
    logEvent({
      type: Events.PRODUCT_ADDED,
      payload: {
        product_id: productId,
        batch_id: batchId,
        name: name,
        batch_no: batch_no,
        qty: parseInt(qty),
        cost: parseFloat(cost),
        price: parseFloat(price)
      },
      timestamp: ts
    });

    console.log("Product added successfully:", { productId, batchId });
    res.json({ success: true, productId, batchId });
  } catch (err) {
    console.error("Add product error:", err);
    res.status(500).json({ error: "Failed to add product", details: err.message });
  }
};

// --- UPDATE product + batch (API endpoint) ---
exports.updateProduct = (req, res) => {
  try {
    const { id } = req.params;
    const { name, unit, tax, vendor_id, batch_id, batch_no, expiry_date, qty, cost, price } = req.body;
    console.log("Updating product:", { id, name, batch_id, qty });

    if (!name || !qty || !cost || !price) {
      return res.status(400).json({ error: "Name, quantity, cost, and price are required" });
    }

    const ts = new Date().toISOString();

    // Get old data for logging
    const oldProduct = db.get('SELECT * FROM products WHERE uuid = ?', [id]);
    const oldBatch = batch_id ? db.get('SELECT * FROM batches WHERE uuid = ?', [batch_id]) : null;

    if (!oldProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Update product
    const productResult = db.run(
      `UPDATE products
       SET name=?, unit=?, tax=?, vendor_id=?, updated_at=?
       WHERE uuid=?`,
      [name.trim(), unit?.trim() || '', parseFloat(tax) || 0, vendor_id || null, ts, id]
    );

    // Update batch if batch_id provided
    if (batch_id) {
      const batchResult = db.run(
        `UPDATE batches
         SET batch_no=?, expiry_date=?, qty=?, cost=?, price=?, updated_at=?
         WHERE uuid=?`,
        [batch_no?.trim() || '', expiry_date || null, parseInt(qty), parseFloat(cost), parseFloat(price), ts, batch_id]
      );

      if (batchResult.changes === 0) {
        return res.status(404).json({ error: "Batch not found" });
      }
    }

    // ✅ Enhanced event logging
    logEvent({
      type: Events.PRODUCT_UPDATED,
      payload: {
        product_id: id,
        batch_id: batch_id,
        name: name,
        old_data: {
          name: oldProduct?.name,
          qty: oldBatch?.qty
        },
        new_data: {
          name: name,
          qty: parseInt(qty)
        }
      },
      timestamp: ts
    });

    console.log("Product updated successfully:", { id, changes: productResult.changes });
    res.json({ success: true });
  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({ error: "Failed to update product", details: err.message });
  }
};

// --- DELETE product + batches (API endpoint) ---
exports.deleteProduct = (req, res) => {
  try {
    const { id } = req.params;
    console.log("Deleting product:", id);

    // Get product details before deletion for logging
    const productInfo = db.get('SELECT * FROM products WHERE uuid = ?', [id]);
    if (!productInfo) {
      return res.status(404).json({ error: "Product not found" });
    }

    const batchesInfo = db.all('SELECT * FROM batches WHERE product_id = ?', [id]);

    // Delete batches first (foreign key constraint)
    const batchResult = db.run(`DELETE FROM batches WHERE product_id=?`, [id]);
    const productResult = db.run(`DELETE FROM products WHERE uuid=?`, [id]);

    // ✅ Enhanced event logging
    logEvent({
      type: Events.PRODUCT_DELETED,
      payload: {
        product_id: id,
        name: productInfo?.name || 'Unknown',
        deleted_batches: batchesInfo.length,
        batches: batchesInfo.map(b => ({
          batch_id: b.uuid,
          batch_no: b.batch_no,
          qty: b.qty
        }))
      },
      timestamp: new Date().toISOString()
    });

    console.log("Product deleted successfully:", { id, batches_deleted: batchResult.changes });
    res.json({ success: true, deletedBatches: batchResult.changes });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ error: "Failed to delete product", details: err.message });
  }
};

// --- SELL product (reduce qty + event log) (API endpoint) ---
exports.sellProduct = (req, res) => {
  try {
    const { batchId } = req.params;
    const { quantity } = req.body;
    console.log("Selling product:", { batchId, quantity });

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: "Valid quantity is required" });
    }

    const batch = db.get(`SELECT * FROM batches WHERE uuid=?`, [batchId]);
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    if (batch.qty < parseInt(quantity)) {
      return res.status(400).json({ error: "Not enough stock available" });
    }

    // Get product name for logging
    const product = db.get('SELECT name FROM products WHERE uuid = ?', [batch.product_id]);

    // Update stock
    const updateResult = db.run(`UPDATE batches SET qty = qty - ? WHERE uuid=?`, [parseInt(quantity), batchId]);

    // Fetch updated stock
    const updatedBatch = db.get(
      `SELECT qty, expiry_date, product_id FROM batches WHERE uuid=?`,
      [batchId]
    );

    const ts = new Date().toISOString();

    // Low stock event
    if (updatedBatch.qty <= LOW_STOCK_LIMIT) {
      logEvent({
        type: Events.STOCK_LOW,
        payload: {
          product_id: updatedBatch.product_id,
          batch_id: batchId,
          product_name: product?.name,
          remaining_qty: updatedBatch.qty,
          threshold: LOW_STOCK_LIMIT
        },
        timestamp: ts
      });
    }

    // Expired stock event
    if (
      updatedBatch.expiry_date &&
      new Date(updatedBatch.expiry_date) < new Date()
    ) {
      logEvent({
        type: 'stock.expired',
        payload: {
          product_id: updatedBatch.product_id,
          batch_id: batchId,
          product_name: product?.name,
          expiry_date: updatedBatch.expiry_date
        },
        timestamp: ts
      });
    }

    // ✅ Enhanced sell event logging
    logEvent({
      type: Events.PRODUCT_SOLD,
      payload: {
        batch_id: batchId,
        product_id: batch.product_id,
        product_name: product?.name,
        batch_no: batch.batch_no,
        quantity_sold: parseInt(quantity),
        remaining_qty: updatedBatch.qty,
        sale_value: (parseInt(quantity) * parseFloat(batch.price)).toFixed(2)
      },
      timestamp: ts
    });

    console.log("Product sold successfully:", { batchId, quantity, remaining: updatedBatch.qty });
    res.json({ 
      success: true, 
      remaining_qty: updatedBatch.qty,
      sale_value: (parseInt(quantity) * parseFloat(batch.price)).toFixed(2)
    });
  } catch (err) {
    console.error("Sell product error:", err);
    res.status(500).json({ error: "Failed to sell product", details: err.message });
  }
};

// --- Helper functions (for internal use) ---
function getInventory() {
  return db.all(`
    SELECT 
      p.uuid AS product_id,
      p.name AS product_name,
      p.unit,
      p.tax,
      v.name AS vendor_name,
      b.uuid AS batch_id,
      b.batch_no,
      b.qty,
      b.cost,
      b.price,
      b.expiry_date
    FROM products p
    LEFT JOIN vendors v ON p.vendor_id = v.uuid
    LEFT JOIN batches b ON p.uuid = b.product_id
    ORDER BY 
      CASE 
        WHEN b.expiry_date IS NOT NULL AND DATE(b.expiry_date) < DATE('now') THEN 0
        ELSE 1
      END,
      b.expiry_date ASC
  `);
}

module.exports = {
  getInventory: exports.getInventory,
  addProduct: exports.addProduct,
  updateProduct: exports.updateProduct,
  deleteProduct: exports.deleteProduct,
  sellProduct: exports.sellProduct,
  getInventoryData: getInventory // Helper function
};