const express = require("express");
const router = express.Router();
const reportController = require("../reports/reportController");

// --- Sales Reports ---
router.get("/sales/daily", reportController.getDailySales);
router.get("/sales/weekly", reportController.getWeeklySales);
router.get("/sales/monthly", reportController.getMonthlySales);

// --- Doctor Wise ---
router.get("/doctor-wise", reportController.getDoctorWiseSales);
router.get("/doctor-wise/:id", reportController.getDoctorSalesById);

// --- Vendor Wise ---
router.get("/vendor-wise", reportController.getVendorWiseSales);
router.get("/vendor-wise/:id", reportController.getVendorSalesById);

// --- Stock Reports ---
router.get("/stock", reportController.getStockReport);
router.get("/stock-expiry", reportController.getExpiryReport); // ✅ Add missing endpoint

module.exports = router;