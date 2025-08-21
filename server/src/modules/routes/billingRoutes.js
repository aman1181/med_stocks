const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const db = require("../services/dbServices");

const { 
  authenticateToken, 
  authorizeWithAuditCheck
} = require('../middleware/auth');

const { 
  createBill, 
  getBills,
  getBillById,
  cancelBill,
  getDailySalesStats,
  generateTextReceipt
} = require("../billing/billing");

function logActivity(type, data, description = '') {
  try {
    const eventId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const eventData = {
      ...data,
      description,
      timestamp,
      source: 'billing-routes'
    };

    db.run(
      `INSERT INTO events (uuid, type, payload, timestamp)
       VALUES (?, ?, ?, ?)`,
      [eventId, type, JSON.stringify(eventData), timestamp]
    );
    
    console.log(`Event logged: ${type} - ${description}`);
  } catch (err) {
    console.warn("Event logging failed:", err.message);
  }
}

router.get("/stats/daily", authenticateToken, (req, res) => {
  try {
    const { date } = req.query;
    console.log(`Getting daily stats for: ${date || 'today'}`);
    
    logActivity('STATS_REQUEST', {
      type: 'daily',
      date: date || 'today',
      userId: req.user?.id,
      username: req.user?.username,
      ip: req.ip
    }, `Daily stats requested by ${req.user?.username}`);

    const stats = getDailySalesStats(date);
    
    logActivity('STATS_SUCCESS', {
      type: 'daily',
      date: stats.date,
      transactions: stats.transactions,
      revenue: stats.revenue,
      userId: req.user?.id,
      username: req.user?.username
    }, `Daily stats: ${stats.transactions} transactions, Rs${stats.revenue}`);

    res.json(stats);
  } catch (err) {
    console.error("Daily stats error:", err);
    
    logActivity('STATS_ERROR', {
      type: 'daily',
      error: err.message,
      userId: req.user?.id,
      username: req.user?.username
    }, 'Daily stats fetch failed');

    res.status(500).json({ 
      error: "Failed to fetch daily stats", 
      details: err.message 
    });
  }
});

router.get("/debug/events", authenticateToken, (req, res) => {
  try {
    logActivity('DEBUG_EVENTS_REQUEST', {
      userId: req.user?.id,
      username: req.user?.username,
      ip: req.ip
    }, `Debug events requested by ${req.user?.username}`);

    const events = db.all(`
      SELECT type, timestamp, 
             CASE 
               WHEN length(payload) > 100 THEN substr(payload, 1, 100) || '...'
               ELSE payload 
             END as payload_preview
      FROM events 
      WHERE type LIKE 'BILL%' OR type LIKE 'BILLING%'
      ORDER BY timestamp DESC 
      LIMIT 50
    `);
    
    res.json({
      success: true,
      count: events.length,
      events: events
    });
  } catch (err) {
    console.error("Events fetch error:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.get("/debug/bills", authenticateToken, (req, res) => {
  try {
    logActivity('DEBUG_BILLS_REQUEST', {
      userId: req.user?.id,
      username: req.user?.username,
      ip: req.ip
    }, `Debug bills requested by ${req.user?.username}`);

    const billEvents = db.all(`
      SELECT uuid, timestamp, 
             CASE 
               WHEN length(payload) > 200 THEN substr(payload, 1, 200) || '...'
               ELSE payload 
             END as payload_preview
      FROM events 
      WHERE type = 'BILL_CREATED'
      ORDER BY timestamp DESC 
      LIMIT 20
    `);
    
    res.json({
      success: true,
      total: billEvents.length,
      bills: billEvents
    });
  } catch (err) {
    console.error("Bill events fetch error:", err);
    res.status(500).json({ error: "Failed to fetch bill events" });
  }
});

router.get("/debug/controller", authenticateToken, (req, res) => {
  try {
    logActivity('HEALTH_CHECK', {
      userId: req.user?.id,
      username: req.user?.username,
      ip: req.ip
    }, `Health check by ${req.user?.username}`);

    const bills = getBills();
    const todayStats = getDailySalesStats();
    
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

router.get("/", authenticateToken, (req, res) => {
  try {
    console.log("Fetching bills...");
    
    logActivity('BILLS_FETCH_REQUEST', {
      userId: req.user?.id,
      username: req.user?.username,
      ip: req.ip
    }, `Bills fetch by ${req.user?.username}`);

    const bills = getBills();
    
    logActivity('BILLS_FETCH_SUCCESS', {
      billCount: bills.length,
      userId: req.user?.id,
      username: req.user?.username
    }, `Fetched ${bills.length} bills for ${req.user?.username}`);

    res.json({
      success: true,
      count: bills.length,
      bills: bills
    });
  } catch (err) {
    console.error("Get bills error:", err);
    
    logActivity('BILLS_FETCH_ERROR', {
      error: err.message,
      userId: req.user?.id,
      username: req.user?.username
    }, `Bills fetch failed for ${req.user?.username}`);

    res.status(500).json({ 
      success: false,
      error: "Failed to fetch bills", 
      details: err.message 
    });
  }
});

router.post("/", authenticateToken, authorizeWithAuditCheck, (req, res) => {
  try {
    console.log("Creating bill...");
    
    logActivity('BILL_CREATE_ATTEMPT', {
      customerName: req.body.customer_name,
      itemCount: req.body.items?.length || 0,
      totalAmount: req.body.total_amount,
      userId: req.user?.id,
      username: req.user?.username,
      ip: req.ip
    }, `Bill creation by ${req.user?.username} for ${req.body.customer_name}`);

    const billResult = createBill(req.body);
    
    logActivity('BILL_CREATE_SUCCESS', {
      billId: billResult.billId,
      billNo: billResult.billNo,
      customerName: req.body.customer_name,
      totalAmount: billResult.totalAmount,
      userId: req.user?.id,
      username: req.user?.username
    }, `Bill ${billResult.billNo} created by ${req.user?.username}`);

    res.json({
      success: true,
      ...billResult
    });
  } catch (err) {
    console.error("Create bill error:", err);
    
    logActivity('BILL_CREATE_ERROR', {
      error: err.message,
      customerName: req.body.customer_name,
      userId: req.user?.id,
      username: req.user?.username
    }, `Bill creation failed for ${req.user?.username}`);

    res.status(500).json({ 
      success: false,
      error: "Failed to create bill", 
      details: err.message 
    });
  }
});

router.get("/:id/receipt", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Generating receipt for bill: ${id}`);
    
    logActivity('RECEIPT_REQUEST', {
      billId: id,
      userId: req.user?.id,
      username: req.user?.username,
      ip: req.ip
    }, `Receipt requested by ${req.user?.username}`);

    const bill = getBillById(id);
    if (!bill) {
      return res.status(404).json({ 
        success: false,
        error: "Bill not found" 
      });
    }
    
    const textReceipt = generateTextReceipt(bill);
    
    logActivity('RECEIPT_GENERATED', {
      billId: id,
      billNo: bill.billNo,
      userId: req.user?.id,
      username: req.user?.username
    }, `Receipt generated for ${bill.billNo}`);

    res.type('text/plain').send(textReceipt);
  } catch (err) {
    console.error("Receipt generation error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to generate receipt", 
      details: err.message 
    });
  }
});

router.get("/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching bill: ${id}`);
    
    logActivity('BILL_FETCH_REQUEST', {
      billId: id,
      userId: req.user?.id,
      username: req.user?.username,
      ip: req.ip
    }, `Single bill fetch by ${req.user?.username}`);

    const bill = getBillById(id);
    
    if (!bill) {
      logActivity('BILL_NOT_FOUND', {
        billId: id,
        userId: req.user?.id,
        username: req.user?.username
      }, `Bill not found: ${id}`);

      return res.status(404).json({ 
        success: false,
        error: "Bill not found" 
      });
    }
    
    logActivity('BILL_FETCH_SUCCESS', {
      billId: id,
      billNo: bill.billNo,
      userId: req.user?.id,
      username: req.user?.username
    }, `Bill ${bill.billNo} fetched by ${req.user?.username}`);

    res.json({
      success: true,
      bill: bill
    });
  } catch (err) {
    console.error("Get bill by ID error:", err);
    
    logActivity('BILL_FETCH_ERROR', {
      billId: req.params.id,
      error: err.message,
      userId: req.user?.id,
      username: req.user?.username
    }, `Bill fetch failed for ${req.user?.username}`);

    res.status(500).json({ 
      success: false,
      error: "Failed to fetch bill", 
      details: err.message 
    });
  }
});

router.delete("/:id", authenticateToken, authorizeWithAuditCheck, (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Cancelling bill: ${id}`);
    
    logActivity('BILL_CANCEL_ATTEMPT', {
      billId: id,
      userId: req.user?.id,
      username: req.user?.username,
      ip: req.ip
    }, `Bill cancellation by ${req.user?.username}`);

    const result = cancelBill(id);
    
    logActivity('BILL_CANCEL_SUCCESS', {
      billId: id,
      userId: req.user?.id,
      username: req.user?.username
    }, `Bill cancelled by ${req.user?.username}`);

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error("Cancel bill error:", err);
    
    logActivity('BILL_CANCEL_ERROR', {
      billId: req.params.id,
      error: err.message,
      userId: req.user?.id,
      username: req.user?.username
    }, `Bill cancellation failed for ${req.user?.username}`);

    res.status(500).json({ 
      success: false,
      error: "Failed to cancel bill", 
      details: err.message 
    });
  }
});

module.exports = router;