const express = require("express");
const router = express.Router();
const reportController = require("../reports/reportController");
const { authenticateToken } = require('../middleware/auth');
const { getDailySalesFromLogs } = require('../reports/salesFromLogs');
const path = require('path');

// GET /api/reports/sales/daily-from-logs
router.get('/sales/daily-from-logs', authenticateToken, (req, res) => {
	const logFilePath = path.join(__dirname, '../../logs/events.log');
	const stats = getDailySalesFromLogs(logFilePath);
	res.json(stats);
});

// --- Sales Reports ---
// --- Sales Reports ---
router.get("/sales/daily", reportController.getDailySales);
router.get("/sales/weekly", reportController.getWeeklySales);
router.get("/sales/monthly", reportController.getMonthlySales);

// --- Doctor Reports ---
router.get("/doctor-wise", reportController.getDoctorWiseSales); // Doctor-wise sales aggregation
router.get("/doctor-wise/:id", reportController.getDoctorSalesById); // Sales for a specific doctor

// --- Vendor Reports ---
router.get("/vendor-wise", reportController.getVendorWiseSales); // Vendor-wise stock aggregation
router.get("/vendor-wise/:id", reportController.getVendorSalesById); // Stock for a specific vendor

// --- Stock Reports ---
router.get("/stock", reportController.getStockReport); // Current stock status
router.get("/stock-expiry", reportController.getExpiryReport); // Expiry report

module.exports = router;