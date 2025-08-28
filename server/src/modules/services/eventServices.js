const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Event = require('./eventModel');

// --- Log to both file and MongoDB ---
const logEvent = async (type, payload, description = '') => {
  try {
    const timestamp = new Date();
    const event = new Event({
      type,
      payload,
      description,
      timestamp,
      source: 'eventServices'
    });
    await event.save();
    // Log to file (Backup)
    try {
      const logsDir = path.join(__dirname, '../../logs');
      const logFile = path.join(logsDir, 'events.log');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const logEntry = `${timestamp.toISOString()} - ${type} - ${description} - ${JSON.stringify(payload)}\n`;
      fs.appendFileSync(logFile, logEntry);
    } catch (fileErr) {
      console.warn("File event log failed:", fileErr.message);
    }
    return event._id;
  } catch (error) {
    console.error('Event logging error:', error);
    return null;
  }
};

// --- Specialized billing event logger ---
const logBillingEvent = async (billData) => {
  try {
    const eventId = await logEvent('BILL_CREATED', billData, `Bill created: ${billData.billNo || 'Unknown'}`);
    // Log each item sold as separate events
    if (billData.items && Array.isArray(billData.items)) {
      for (const item of billData.items) {
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
        await logEvent('STOCK_SOLD', stockEvent, `Stock sold: ${item.product_name} x${item.quantity}`);
      }
    }
    return eventId;
  } catch (err) {
    console.error("Billing event log failed:", err);
    return null;
  }
};

// --- Sales stats from event log ---
const getSalesStats = async (date = null) => {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    // Get bill events for the date
    const start = new Date(targetDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    const billEvents = await Event.find({
      type: 'BILL_CREATED',
      timestamp: { $gte: start, $lt: end }
    });
    let totalRevenue = 0;
    let totalTransactions = billEvents.length;
    let totalItemsSold = 0;
    billEvents.forEach(event => {
      const billData = event.payload;
      totalRevenue += billData.totalAmount || 0;
      if (billData.items && Array.isArray(billData.items)) {
        totalItemsSold += billData.items.reduce((sum, item) => sum + (item.quantity || item.qty || 0), 0);
      }
    });
    return {
      date: targetDate,
      transactions: totalTransactions,
      revenue: totalRevenue,
      sales: totalItemsSold
    };
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
const getEvents = async (type = null, limit = 100) => {
  try {
    const query = type ? { type } : {};
    const events = await Event.find(query).sort({ timestamp: -1 }).limit(limit);
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
const logProductEvent = async (type, productData) => {
  return await logEvent(type, productData, `Product ${type.toLowerCase()}: ${productData.name || 'Unknown'}`);
};

const logStockEvent = async (type, stockData) => {
  return await logEvent(type, stockData, `Stock ${type.toLowerCase()}: ${stockData.productName || 'Unknown'}`);
};

const logUserEvent = async (type, userData) => {
  return await logEvent(type, userData, `User ${type.toLowerCase()}: ${userData.username || 'Unknown'}`);
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