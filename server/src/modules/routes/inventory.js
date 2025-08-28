const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeWithAuditCheck } = require("../middleware/auth");
const inventoryController = require("../inventory/inventoryController");

// GET all inventory
router.get("/", authenticateToken, inventoryController.getInventory);

// GET single product by product_id
 router.get("/:id", authenticateToken, inventoryController.getProductById);

// ADD new product + batch
router.post("/", authenticateToken, authorizeWithAuditCheck, inventoryController.addProduct);

// UPDATE product + batch
router.put("/:id", authenticateToken, authorizeWithAuditCheck, inventoryController.updateProduct);

// DELETE product + batches
router.delete("/:id", authenticateToken, authorizeWithAuditCheck, inventoryController.deleteProduct);

// SELL product (reduce qty)
router.post("/sell/:id", authenticateToken, authorizeWithAuditCheck, inventoryController.sellProduct);

// DEBUG: List all product_ids in inventory
router.get("/debug/all-ids", (req, res) => {
	const Inventory = require("../inventory/inventoryModel");
	Inventory.find({}, "product_id product_name", (err, products) => {
		if (err) return res.status(500).json({ error: "Failed to fetch product ids" });
		res.json(products);
	});
});

module.exports = router;