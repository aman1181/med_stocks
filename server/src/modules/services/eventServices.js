const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./dbServices');

// --- Log to both file and database ---
const logEvent = (type, payload, description = '') => {
  try {
    const timestamp = new Date().toISOString();
    const eventId = uuidv4();
    
    // Prepare event data
    const eventData = {
      id: eventId,
      type,
      payload,
      description,
      timestamp,
      source: 'eventServices'
    };

    // 1. Log to database (Primary)
    try {
      db.run(
        `INSERT INTO events (uuid, type, payload, timestamp)
         VALUES (?, ?, ?, ?)`,
        [eventId, type, JSON.stringify(payload), timestamp]
      );
      console.log(`📝 Event logged to DB: ${type}`);
    } catch (dbErr) {
      console.warn("Database event log failed:", dbErr.message);
    }

    // 2. Log to file (Backup)
    try {
      const logsDir = path.join(__dirname, '../../logs');
      const logFile = path.join(logsDir, 'events.log');
      
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      const logEntry = `${timestamp} - ${type} - ${description} - ${JSON.stringify(payload)}\n`;
      fs.appendFileSync(logFile, logEntry);
      console.log(`📄 Event logged to file: ${type}`);
    } catch (fileErr) {
      console.warn("File event log failed:", fileErr.message);
    }

    return eventId;
  } catch (error) {
    console.error('Event logging error:', error);
    return null;
  }
};

// --- Specialized billing event logger ---
const logBillingEvent = (billData) => {
  try {
    console.log("💰 Logging billing event:", billData);
    
    const eventId = logEvent('BILL_CREATED', billData, `Bill created: ${billData.billNo || 'Unknown'}`);
    
    // Log each item sold as separate events
    if (billData.items && Array.isArray(billData.items)) {
      billData.items.forEach(item => {
        const stockEvent = {
          billId: billData.billId,
          billNo: billData.billNo,
          batchId: item.batch_id,
          productName: item.product_name,
          quantitySold: item.quantity || item.qty || 0,
          price: item.price,
          total: (item.quantity || item.qty || 0) * item.price,
          timestamp: new Date().toISOString()
        };
        
        logEvent('STOCK_SOLD', stockEvent, `Stock sold: ${item.product_name} x${item.quantity}`);
      });
    }
    
    return eventId;
  } catch (err) {
    console.error("Billing event log failed:", err);
    return null;
  }
};

// --- Sales stats from event log ---
const getSalesStats = (date = null) => {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    console.log(`📊 Getting sales stats for: ${targetDate}`);
    
    // Get bill events for the date
    const billEvents = db.all(`
      SELECT * FROM events 
      WHERE type = 'BILL_CREATED' 
      AND DATE(timestamp) = ?
      ORDER BY timestamp DESC
    `, [targetDate]);
    
    let totalRevenue = 0;
    let totalTransactions = billEvents.length;
    let totalItemsSold = 0;
    
    billEvents.forEach(event => {
      try {
        const billData = JSON.parse(event.payload);
        totalRevenue += billData.totalAmount || 0;
        
        if (billData.items && Array.isArray(billData.items)) {
          totalItemsSold += billData.items.reduce((sum, item) => 
            sum + (item.quantity || item.qty || 0), 0
          );
        }
      } catch (parseErr) {
        console.warn("Could not parse bill event:", parseErr.message);
      }
    });
    
    const stats = {
      date: targetDate,
      transactions: totalTransactions,
      revenue: totalRevenue,
      sales: totalItemsSold
    };
    
    console.log("📊 Sales stats:", stats);
    return stats;
    
  } catch (err) {
    console.error("Sales stats error:", err);
    return {
      date: date || new Date().toISOString().split('T')[0],
      transactions: 0,
      revenue: 0,
      sales: 0
    };
  }
};

// --- Get all events ---
const getEvents = (type = null, limit = 100) => {
  try {
    let query = `SELECT * FROM events`;
    let params = [];
    
    if (type) {
      query += ` WHERE type = ?`;
      params.push(type);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);
    
    const events = db.all(query, params);
    return events || [];
  } catch (err) {
    console.error("Get events error:", err);
    return [];
  }
};

// ✅ Complete Event Types for MedStock
const Events = {
  // Product Events
  PRODUCT_ADDED: 'PRODUCT_ADDED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED', 
  PRODUCT_DELETED: 'PRODUCT_DELETED',
  
  // Batch/Stock Events
  BATCH_ADDED: 'BATCH_ADDED',
  BATCH_UPDATED: 'BATCH_UPDATED',
  STOCK_LOW: 'STOCK_LOW',
  STOCK_SOLD: 'STOCK_SOLD',
  STOCK_EXPIRED: 'STOCK_EXPIRED',
  
  // Billing Events
  BILL_CREATED: 'BILL_CREATED',
  BILL_CANCELLED: 'BILL_CANCELLED',
  BILL_UPDATED: 'BILL_UPDATED',
  
  // Vendor Events
  VENDOR_ADDED: 'VENDOR_ADDED',
  VENDOR_UPDATED: 'VENDOR_UPDATED',
  
  // Doctor Events
  DOCTOR_ADDED: 'DOCTOR_ADDED',
  DOCTOR_UPDATED: 'DOCTOR_UPDATED',
  
  // System Events
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  DATABASE_BACKUP: 'DATABASE_BACKUP',
  
  // Report Events
  REPORT_GENERATED: 'REPORT_GENERATED',
  EXPORT_DATA: 'EXPORT_DATA'
};

// --- Helper functions ---
const logProductEvent = (type, productData) => {
  return logEvent(type, productData, `Product ${type.toLowerCase()}: ${productData.name || 'Unknown'}`);
};

const logStockEvent = (type, stockData) => {
  return logEvent(type, stockData, `Stock ${type.toLowerCase()}: ${stockData.productName || 'Unknown'}`);
};

const logUserEvent = (type, userData) => {
  return logEvent(type, userData, `User ${type.toLowerCase()}: ${userData.username || 'Unknown'}`);
};

// --- Export all functions ---
module.exports = { 
  logEvent,
  logBillingEvent,
  getSalesStats,
  getEvents,
  Events,
  logProductEvent,
  logStockEvent,
  logUserEvent
};