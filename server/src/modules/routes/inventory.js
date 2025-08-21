const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const db = require("../services/dbServices");

// ✅ FIXED: Import correct authentication middleware
const { 
  authenticateToken, 
  authorizeWithAuditCheck
} = require("../middleware/auth");

console.log('📦 Loading inventory routes...');

// ✅ FIXED: GET - Allow all authenticated users (including audit) to read
router.get("/", authenticateToken, (req, res) => {
  try {
    console.log("📦 GET /api/inventory called by:", req.user?.username);
    console.log("📦 Fetching inventory...");
    
    const inventory = db.all(`
      SELECT 
        b.uuid as batch_id,
        p.uuid as product_id,
        p.name as product_name,
        p.unit,
        p.tax,
        v.name as vendor_name,
        v.uuid as vendor_id,
        b.batch_no,
        b.expiry_date,
        b.qty,
        b.cost,
        b.price,
        b.created_at
      FROM batches b
      LEFT JOIN products p ON b.product_id = p.uuid
      LEFT JOIN vendors v ON p.vendor_id = v.uuid
      ORDER BY b.created_at DESC
    `);

    console.log(`📦 Fetched ${inventory.length} inventory items for ${req.user?.username}`);
    res.json(inventory);
  } catch (err) {
    console.error("Inventory fetch error:", err);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

// ✅ FIXED: POST - Block audit users from creating
router.post("/", authenticateToken, authorizeWithAuditCheck, (req, res) => {
  try {
    console.log("➕ POST /api/inventory called by:", req.user?.username);
    
    const { 
      name, unit, tax, vendor_id, batch_no, 
      expiry_date, qty, cost, price 
    } = req.body;

    if (!name || !vendor_id || !batch_no) {
      return res.status(400).json({ 
        error: "Product name, vendor, and batch number are required" 
      });
    }

    const ts = new Date().toISOString();
    const productId = uuidv4();
    const batchId = uuidv4();

    // Check if product exists
    let existingProduct = db.get(
      `SELECT uuid FROM products WHERE name = ? AND vendor_id = ?`, 
      [name, vendor_id]
    );

    if (!existingProduct) {
      // Create new product
      db.run(
        `INSERT INTO products (uuid, name, unit, tax, vendor_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [productId, name, unit || '', parseFloat(tax) || 0, vendor_id, ts, ts]
      );
      existingProduct = { uuid: productId };
    }

    // Create batch
    db.run(
      `INSERT INTO batches (uuid, product_id, batch_no, expiry_date, qty, cost, price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId, 
        existingProduct.uuid, 
        batch_no, 
        expiry_date || null, 
        parseInt(qty) || 0, 
        parseFloat(cost) || 0, 
        parseFloat(price) || 0, 
        ts, 
        ts
      ]
    );

    console.log(`✅ ${req.user?.username} added inventory item: ${name}`);
    res.json({ success: true, batchId, productId: existingProduct.uuid });
  } catch (err) {
    console.error("Add inventory error:", err);
    res.status(500).json({ error: "Failed to add inventory item" });
  }
});

// ✅ FIXED: PUT - Block audit users from updating
router.put("/:id", authenticateToken, authorizeWithAuditCheck, (req, res) => {
  try {
    console.log("✏️ PUT /api/inventory/:id called by:", req.user?.username);
    
    const { id: batchId } = req.params;
    const { 
      name, unit, tax, vendor_id, batch_no, 
      expiry_date, qty, cost, price 
    } = req.body;

    const ts = new Date().toISOString();

    // Update product
    const batch = db.get(`SELECT product_id FROM batches WHERE uuid = ?`, [batchId]);
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    db.run(
      `UPDATE products SET name = ?, unit = ?, tax = ?, vendor_id = ?, updated_at = ?
       WHERE uuid = ?`,
      [name, unit || '', parseFloat(tax) || 0, vendor_id, ts, batch.product_id]
    );

    // Update batch
    db.run(
      `UPDATE batches SET batch_no = ?, expiry_date = ?, qty = ?, cost = ?, price = ?, updated_at = ?
       WHERE uuid = ?`,
      [
        batch_no, 
        expiry_date || null, 
        parseInt(qty) || 0, 
        parseFloat(cost) || 0, 
        parseFloat(price) || 0, 
        ts, 
        batchId
      ]
    );

    console.log(`✅ ${req.user?.username} updated inventory item: ${batchId}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Update inventory error:", err);
    res.status(500).json({ error: "Failed to update inventory item" });
  }
});

// ✅ FIXED: DELETE - Block audit users from deleting
router.delete("/:id", authenticateToken, authorizeWithAuditCheck, (req, res) => {
  try {
    console.log("🗑️ DELETE /api/inventory/:id called by:", req.user?.username);
    
    const { id: batchId } = req.params;

    const result = db.run(`DELETE FROM batches WHERE uuid = ?`, [batchId]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: "Batch not found" });
    }

    console.log(`✅ ${req.user?.username} deleted inventory item: ${batchId}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete inventory error:", err);
    res.status(500).json({ error: "Failed to delete inventory item" });
  }
});

// ✅ FIXED: POST sell - Block audit users from selling
router.post("/sell/:id", authenticateToken, authorizeWithAuditCheck, (req, res) => {
  try {
    console.log("💰 POST /api/inventory/sell/:id called by:", req.user?.username);
    
    const { id: batchId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: "Valid quantity is required" });
    }

    // Get current batch info
    const batch = db.get(`
      SELECT b.*, p.name as product_name 
      FROM batches b 
      LEFT JOIN products p ON b.product_id = p.uuid 
      WHERE b.uuid = ?
    `, [batchId]);

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    if (batch.qty < quantity) {
      return res.status(400).json({ 
        error: `Insufficient stock. Available: ${batch.qty}, Requested: ${quantity}` 
      });
    }

    // Update quantity
    const newQty = batch.qty - quantity;
    db.run(
      `UPDATE batches SET qty = ?, updated_at = ? WHERE uuid = ?`,
      [newQty, new Date().toISOString(), batchId]
    );

    console.log(`✅ ${req.user?.username} sold ${quantity} units of ${batch.product_name}`);
    res.json({ 
      success: true, 
      message: `Sold ${quantity} units successfully`,
      remainingQty: newQty
    });
  } catch (err) {
    console.error("Sell inventory error:", err);
    res.status(500).json({ error: "Failed to sell inventory item" });
  }
});

console.log('✅ Inventory routes loaded successfully');
module.exports = router;