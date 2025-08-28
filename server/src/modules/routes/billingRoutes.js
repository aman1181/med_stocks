const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeWithAuditCheck } = require('../middleware/auth');
const { 
  createBill, 
  getBills,
  getBillById,
  cancelBill,
  getDailySalesStats,
  generateTextReceipt
} = require("../billing/billingControllers");

router.get("/stats/daily", authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const stats = await getDailySalesStats(date);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch daily stats", details: err.message });
  }
});

router.get("/debug/controller", authenticateToken, async (req, res) => {
  try {
    const bills = await getBills();
    const todayStats = await getDailySalesStats();
    res.json({
      success: true,
      controllerStatus: "Working",
      totalBills: bills.length,
      todayStats: todayStats,
      user: {
        id: req.user?.id,
        username: req.user?.username,
        role: req.user?.role
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      controllerStatus: "Error",
      error: err.message
    });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const bills = await getBills();
    res.json({
      success: true,
      count: bills.length,
      bills: bills
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch bills", details: err.message });
  }
});

router.post("/", authenticateToken, authorizeWithAuditCheck, async (req, res) => {
  try {
    const billResult = await createBill(req.body);
    res.json({
      success: true,
      ...billResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to create bill", details: err.message });
  }
});

router.get("/:id/receipt", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await getBillById(id);
    if (!bill) {
      return res.status(404).json({ success: false, error: "Bill not found" });
    }
    const receiptPath = generateTextReceipt(bill);
    const receiptText = fs.readFileSync(receiptPath, 'utf8');
    res.type('text/plain').send(receiptText);
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to generate receipt", details: err.message });
  }
});

router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await getBillById(id);
    if (!bill) {
      return res.status(404).json({ success: false, error: "Bill not found" });
    }
    res.json({ success: true, bill: bill });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch bill", details: err.message });
  }
});

router.delete("/:id", authenticateToken, authorizeWithAuditCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await cancelBill(id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to cancel bill", details: err.message });
  }
});

module.exports = router;