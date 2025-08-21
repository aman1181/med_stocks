const express = require("express");
const router = express.Router();
const vendorController = require("../vendors/vendorController");

// ADD: Import authentication middleware
const { 
  authenticateToken, 
  authorizeWithAuditCheck, 
} = require("../middleware/auth");


//  Vendor CRUD Routes with audit restrictions
router.get("/", authenticateToken, vendorController.getVendors);
router.post("/", authenticateToken, authorizeWithAuditCheck, vendorController.addVendor);
router.put("/:id", authenticateToken, authorizeWithAuditCheck, vendorController.updateVendor);
router.delete("/:id", authenticateToken, authorizeWithAuditCheck, vendorController.deleteVendor);

module.exports = router;