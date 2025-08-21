const db = require("../services/dbServices");
const { v4: uuidv4 } = require("uuid");

// GET all vendors
exports.getVendors = (req, res) => {
  try {
    const vendors = db.all(`SELECT * FROM vendors ORDER BY created_at DESC`);
    console.log("Fetched vendors:", vendors.length); // ✅ Debug log
    res.json(vendors);
  } catch (err) {
    console.error("Get vendors error:", err);
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
};

// CREATE vendor - ✅ Complete implementation
exports.addVendor = (req, res) => {
  try {
    const { name, contact, address } = req.body;
    console.log("Adding vendor:", { name, contact, address }); // ✅ Debug log
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: "Vendor name is required" });
    }

    const id = uuidv4();
    const ts = new Date().toISOString();

    // Insert vendor with all fields
    const result = db.run(
      `INSERT INTO vendors (uuid, name, contact, address, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), contact?.trim() || "", address?.trim() || "", ts, ts]
    );

    console.log("Vendor added successfully:", { id, changes: result.changes }); // ✅ Debug log
    res.json({ success: true, id, vendor: { uuid: id, name, contact, address } });
  } catch (err) {
    console.error("Add vendor error:", err);
    res.status(500).json({ error: "Failed to add vendor", details: err.message });
  }
};

// UPDATE vendor - ✅ Complete implementation
exports.updateVendor = (req, res) => {
  try {
    const { name, contact, address } = req.body;
    const { id } = req.params;
    console.log("Updating vendor:", { id, name, contact, address }); // ✅ Debug log

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: "Vendor name is required" });
    }

    const ts = new Date().toISOString();

    // Update vendor with all fields
    const result = db.run(
      `UPDATE vendors SET name=?, contact=?, address=?, updated_at=? WHERE uuid=?`,
      [name.trim(), contact?.trim() || "", address?.trim() || "", ts, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    console.log("Vendor updated successfully:", { id, changes: result.changes }); // ✅ Debug log
    res.json({ success: true, vendor: { uuid: id, name, contact, address } });
  } catch (err) {
    console.error("Update vendor error:", err);
    res.status(500).json({ error: "Failed to update vendor", details: err.message });
  }
};

// DELETE vendor - ✅ Complete implementation
exports.deleteVendor = (req, res) => {
  try {
    const { id } = req.params;
    console.log("Deleting vendor:", id); // ✅ Debug log

    // Check if vendor exists
    const vendor = db.get(`SELECT * FROM vendors WHERE uuid=?`, [id]);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Check if vendor has products
    const productCount = db.get(`SELECT COUNT(*) as count FROM products WHERE vendor_id=?`, [id]);
    if (productCount.count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete vendor. ${productCount.count} products are linked to this vendor.` 
      });
    }

    // Delete vendor
    const result = db.run(`DELETE FROM vendors WHERE uuid=?`, [id]);
    
    console.log("Vendor deleted successfully:", { id, changes: result.changes }); // ✅ Debug log
    res.json({ success: true, deletedVendor: vendor.name });
  } catch (err) {
    console.error("Delete vendor error:", err);
    res.status(500).json({ error: "Failed to delete vendor", details: err.message });
  }
};