/* filepath: server/src/modules/reports/reportController.js */
const db = require("../services/dbServices");
// Import event services for logging
const { logEvent, getSalesStats, Events } = require("../services/eventServices");

// --- Sales over time (daily) - Using Event Log ---
exports.getDailySales = (req, res) => {
  try {
    console.log("📊 Getting daily sales from event log...");
    
    // Log report request
    logEvent(Events.REPORT_GENERATED, {
      type: 'daily_sales',
      requestedBy: req.ip || 'unknown',
      userAgent: req.get('User-Agent')
    }, 'Daily sales report requested');

    const today = new Date().toISOString().split('T')[0];
    console.log("Today's date:", today);
    
    // Use eventServices to get sales stats from event log
    const stats = getSalesStats(today);
    
    // Log successful report generation
    logEvent(Events.REPORT_GENERATED, {
      type: 'daily_sales',
      date: today,
      transactions: stats.transactions,
      revenue: stats.revenue,
      sales: stats.sales,
      status: 'success'
    }, `Daily sales report generated: ${stats.transactions} transactions, ₹${stats.revenue} revenue`);
    
    console.log("✅ Daily sales result:", stats);
    res.json(stats);
    
  } catch (err) {
    console.error("❌ Get daily sales error:", err);
    
    // Log error
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Daily sales report failed',
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, 'Daily sales report generation failed');
    
    const today = new Date().toISOString().split('T')[0];
    res.json({ 
      date: today, 
      transactions: 0, 
      revenue: 0, 
      sales: 0,
      error: err.message 
    });
  }
};

// --- Sales over time (weekly) ---
exports.getWeeklySales = (req, res) => {
  try {
    console.log("📊 Getting weekly sales...");
    
    // Log weekly sales request
    logEvent(Events.REPORT_GENERATED, {
      type: 'weekly_sales',
      requestedBy: req.ip || 'unknown',
      userAgent: req.get('User-Agent')
    }, 'Weekly sales report requested');

    // Check if bills table exists, fallback to event log
    const billsTableExists = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='bills'");
    
    let rows = [];
    
    if (billsTableExists) {
      // Use bills table if available
      rows = db.all(`
        SELECT 
          strftime('%Y-%W', created_at) as sale_date,
          COUNT(uuid) as transactions,
          COALESCE(SUM((SELECT SUM(qty) FROM bill_items WHERE bill_id = bills.uuid)), 0) as quantity,
          COALESCE(SUM(total_amount), 0) as revenue
        FROM bills
        GROUP BY strftime('%Y-%W', created_at)
        ORDER BY sale_date DESC
        LIMIT 10
      `);
    } else {
      // Fallback to event log
      const billEvents = db.all(`
        SELECT * FROM events 
        WHERE type = 'BILL_CREATED' 
        ORDER BY timestamp DESC
      `);
      
      // Group by week
      const weeklyData = {};
      
      billEvents.forEach(event => {
        try {
          const billData = JSON.parse(event.payload);
          const eventDate = new Date(event.timestamp);
          const weekKey = getWeekKey(eventDate);
          
          if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = {
              sale_date: weekKey,
              transactions: 0,
              revenue: 0,
              quantity: 0
            };
          }
          
          weeklyData[weekKey].transactions += 1;
          weeklyData[weekKey].revenue += billData.totalAmount || 0;
          
          if (billData.items && Array.isArray(billData.items)) {
            weeklyData[weekKey].quantity += billData.items.reduce((sum, item) => 
              sum + (item.quantity || 0), 0
            );
          }
        } catch (parseErr) {
          console.warn("Could not parse weekly bill event:", parseErr.message);
        }
      });
      
      rows = Object.values(weeklyData).sort((a, b) => 
        b.sale_date.localeCompare(a.sale_date)
      ).slice(0, 10);
    }
    
    // Log successful report generation
    logEvent(Events.REPORT_GENERATED, {
      type: 'weekly_sales',
      weekCount: rows.length,
      dataSource: billsTableExists ? 'bills_table' : 'event_log',
      status: 'success'
    }, `Weekly sales report generated: ${rows.length} weeks`);
    
    res.json(rows);
  } catch (err) {
    console.error("Get weekly sales error:", err);
    
    // Log error
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Weekly sales report failed',
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, 'Weekly sales report generation failed');
    
    res.status(500).json({ error: "Failed to fetch weekly sales" });
  }
};

// --- Sales over time (monthly) ---
exports.getMonthlySales = (req, res) => {
  try {
    console.log("📊 Getting monthly sales...");
    
    // Log monthly sales request
    logEvent(Events.REPORT_GENERATED, {
      type: 'monthly_sales',
      requestedBy: req.ip || 'unknown',
      userAgent: req.get('User-Agent')
    }, 'Monthly sales report requested');

    // Check if bills table exists, fallback to event log
    const billsTableExists = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='bills'");
    
    let rows = [];
    
    if (billsTableExists) {
      // Use bills table if available
      rows = db.all(`
        SELECT 
          strftime('%Y-%m', created_at) as month,
          COUNT(uuid) as transactions,
          COALESCE(SUM((SELECT SUM(qty) FROM bill_items WHERE bill_id = bills.uuid)), 0) as quantity,
          COALESCE(SUM(total_amount), 0) as revenue
        FROM bills
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month DESC
        LIMIT 12
      `);
    } else {
      // Fallback to event log
      const billEvents = db.all(`
        SELECT * FROM events 
        WHERE type = 'BILL_CREATED' 
        ORDER BY timestamp DESC
      `);
      
      // Group by month
      const monthlyData = {};
      
      billEvents.forEach(event => {
        try {
          const billData = JSON.parse(event.payload);
          const eventDate = new Date(event.timestamp);
          const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
              month: monthKey,
              transactions: 0,
              revenue: 0,
              quantity: 0
            };
          }
          
          monthlyData[monthKey].transactions += 1;
          monthlyData[monthKey].revenue += billData.totalAmount || 0;
          
          if (billData.items && Array.isArray(billData.items)) {
            monthlyData[monthKey].quantity += billData.items.reduce((sum, item) => 
              sum + (item.quantity || 0), 0
            );
          }
        } catch (parseErr) {
          console.warn("Could not parse monthly bill event:", parseErr.message);
        }
      });
      
      rows = Object.values(monthlyData).sort((a, b) => 
        b.month.localeCompare(a.month)
      ).slice(0, 12);
    }
    
    // Log successful report generation
    logEvent(Events.REPORT_GENERATED, {
      type: 'monthly_sales',
      monthCount: rows.length,
      dataSource: billsTableExists ? 'bills_table' : 'event_log',
      status: 'success'
    }, `Monthly sales report generated: ${rows.length} months`);
    
    res.json(rows);
  } catch (err) {
    console.error("Get monthly sales error:", err);
    
    // Log error
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Monthly sales report failed',
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, 'Monthly sales report generation failed');
    
    res.status(500).json({ error: "Failed to fetch monthly sales" });
  }
};

// --- Doctor wise sales ---
exports.getDoctorWiseSales = (req, res) => {
  try {
    console.log("📊 Getting doctor-wise sales...");
    
    // Log doctor sales request
    logEvent(Events.REPORT_GENERATED, {
      type: 'doctor_wise_sales',
      requestedBy: req.ip || 'unknown',
      userAgent: req.get('User-Agent')
    }, 'Doctor-wise sales report requested');

    // Always use event log for doctor-wise sales
    const billEvents = db.all(`
      SELECT * FROM events 
      WHERE type = 'BILL_CREATED' 
      ORDER BY timestamp DESC
    `);
    const doctorData = {};
    billEvents.forEach(event => {
      try {
        const billData = JSON.parse(event.payload);
        const doctorKey = billData.doctorName || 'Walk-in Customer';
        if (!doctorData[doctorKey]) {
          doctorData[doctorKey] = {
            doctor_name: doctorKey,
            prescriptions: 0,
            total_value: 0
          };
        }
        doctorData[doctorKey].prescriptions += 1;
        doctorData[doctorKey].total_value += billData.totalAmount || 0;
      } catch (parseErr) {
        console.warn("Could not parse doctor bill event:", parseErr.message);
      }
    });
    const rows = Object.values(doctorData).sort((a, b) => b.total_value - a.total_value);
    
    // Log successful report generation
    logEvent(Events.REPORT_GENERATED, {
      type: 'doctor_wise_sales',
      doctorCount: rows.length,
      dataSource: billsTableExists ? 'bills_table' : 'event_log',
      status: 'success'
    }, `Doctor-wise sales report generated: ${rows.length} doctors`);
    
    res.json(rows);
  } catch (err) {
    console.error("Get doctor-wise sales error:", err);
    
    // Log error
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Doctor-wise sales report failed',
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, 'Doctor-wise sales report generation failed');
    
    res.status(500).json({ error: "Failed to fetch doctor-wise sales" });
  }
};

// --- Vendor wise sales ---
exports.getVendorWiseSales = (req, res) => {
  try {
    console.log("📊 Getting vendor-wise sales...");
    
    // Log vendor sales request
    logEvent(Events.REPORT_GENERATED, {
      type: 'vendor_wise_sales',
      requestedBy: req.ip || 'unknown',
      userAgent: req.get('User-Agent')
    }, 'Vendor-wise sales report requested');

    const rows = db.all(`
      SELECT 
        COALESCE(v.name, 'Unknown Vendor') as vendor_name,
        COALESCE(v.contact, 'N/A') as contact,
        COUNT(DISTINCT p.uuid) as total_products,
        COALESCE(SUM(b.qty), 0) as total_stock,
        COALESCE(SUM(b.qty * b.price), 0) as stock_value
      FROM vendors v
      LEFT JOIN products p ON v.uuid = p.vendor_id
      LEFT JOIN batches b ON p.uuid = b.product_id
      GROUP BY v.uuid, v.name, v.contact
      ORDER BY stock_value DESC
    `);
    
    // Log successful report generation
    logEvent(Events.REPORT_GENERATED, {
      type: 'vendor_wise_sales',
      vendorCount: rows.length,
      status: 'success'
    }, `Vendor-wise sales report generated: ${rows.length} vendors`);
    
    res.json(rows);
  } catch (err) {
    console.error("Get vendor-wise sales error:", err);
    
    // Log error
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Vendor-wise sales report failed',
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, 'Vendor-wise sales report generation failed');
    
    res.status(500).json({ error: "Failed to fetch vendor-wise sales" });
  }
};

// --- Stock report ---
exports.getStockReport = (req, res) => {
  try {
    console.log("📊 Getting stock report...");
    
    // Log stock report request
    logEvent(Events.REPORT_GENERATED, {
      type: 'stock_report',
      requestedBy: req.ip || 'unknown',
      userAgent: req.get('User-Agent')
    }, 'Stock report requested');

    const productsExists = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='products'");
    
    if (!productsExists) {
      logEvent(Events.SYSTEM_ERROR, {
        error: 'Products table not found',
        reportType: 'stock_report'
      }, 'Stock report failed - products table missing');
      return res.json([]);
    }
    
    const rows = db.all(`
      SELECT 
        p.name as product_name,
        p.unit,
        COALESCE(v.name, 'No Vendor') as vendor_name,
        COALESCE(b.batch_no, 'No Batch') as batch_no,
        COALESCE(b.qty, 0) as qty,
        CASE 
          WHEN COALESCE(b.qty, 0) = 0 THEN 'Out of Stock'
          WHEN COALESCE(b.qty, 0) <= 10 THEN 'Low Stock'
          ELSE 'In Stock'
        END as stock_status
      FROM products p
      LEFT JOIN vendors v ON p.vendor_id = v.uuid
      LEFT JOIN batches b ON p.uuid = b.product_id
      ORDER BY 
        CASE 
          WHEN COALESCE(b.qty, 0) = 0 THEN 0
          WHEN COALESCE(b.qty, 0) <= 10 THEN 1
          ELSE 2
        END,
        p.name ASC
    `);
    
    // Count stock status
    const stockStats = rows.reduce((stats, row) => {
      stats[row.stock_status] = (stats[row.stock_status] || 0) + 1;
      return stats;
    }, {});
    
    // Log successful report generation
    logEvent(Events.REPORT_GENERATED, {
      type: 'stock_report',
      productCount: rows.length,
      stockStats: stockStats,
      status: 'success'
    }, `Stock report generated: ${rows.length} products`);
    
    res.json(rows || []);
  } catch (err) {
    console.error("Get stock report error:", err);
    
    // Log error
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Stock report failed',
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, 'Stock report generation failed');
    
    res.json([]);
  }
};

// --- Expiry report ---
exports.getExpiryReport = (req, res) => {
  try {
    const days = Number(req.query.days || 30);
    console.log(`📊 Getting expiry report for ${days} days...`);
    
    // Log expiry report request
    logEvent(Events.REPORT_GENERATED, {
      type: 'expiry_report',
      days: days,
      requestedBy: req.ip || 'unknown',
      userAgent: req.get('User-Agent')
    }, `Expiry report requested for ${days} days`);

    const batchesExists = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='batches'");
    
    if (!batchesExists) {
      logEvent(Events.SYSTEM_ERROR, {
        error: 'Batches table not found',
        reportType: 'expiry_report'
      }, 'Expiry report failed - batches table missing');
      return res.json([]);
    }
    
    const rows = db.all(`
      SELECT 
        p.name as product_name,
        COALESCE(v.name, 'No Vendor') as vendor_name,
        COALESCE(b.batch_no, 'No Batch') as batch_no,
        COALESCE(b.qty, 0) as qty,
        b.expiry_date,
        CASE 
          WHEN date(b.expiry_date) < date('now') THEN 'Expired'
          WHEN date(b.expiry_date) <= date('now', '+7 days') THEN 'Expires This Week'
          ELSE 'Expires Soon'
        END as expiry_status
      FROM batches b
      JOIN products p ON b.product_id = p.uuid
      LEFT JOIN vendors v ON p.vendor_id = v.uuid
      WHERE b.expiry_date IS NOT NULL
        AND date(b.expiry_date) <= date('now', '+' || ? || ' days')
      ORDER BY date(b.expiry_date) ASC
    `, [days]);
    
    // Count expiry status
    const expiryStats = rows.reduce((stats, row) => {
      stats[row.expiry_status] = (stats[row.expiry_status] || 0) + 1;
      return stats;
    }, {});
    
    // Log successful report generation
    logEvent(Events.REPORT_GENERATED, {
      type: 'expiry_report',
      days: days,
      productCount: rows.length,
      expiryStats: expiryStats,
      status: 'success'
    }, `Expiry report generated: ${rows.length} products expiring in ${days} days`);
    
    res.json(rows || []);
  } catch (err) {
    console.error("Get expiry report error:", err);
    
    // Log error
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Expiry report failed',
      details: err.message,
      days: req.query.days,
      requestedBy: req.ip || 'unknown'
    }, 'Expiry report generation failed');
    
    res.json([]);
  }
};

// --- Doctor sales by ID ---
exports.getDoctorSalesById = (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📊 Getting sales for doctor: ${id}`);
    
    // Log doctor sales by ID request
    logEvent(Events.REPORT_GENERATED, {
      type: 'doctor_sales_by_id',
      doctorId: id,
      requestedBy: req.ip || 'unknown',
      userAgent: req.get('User-Agent')
    }, `Doctor sales by ID requested: ${id}`);

    const rows = db.all(`
      SELECT b.uuid as bill_id, b.bill_no, b.created_at as date, 
             b.total_amount, b.discount
      FROM bills b
      WHERE b.doctor_id = ?
      ORDER BY b.created_at DESC
    `, [id]);
    
    // Log successful report generation
    logEvent(Events.REPORT_GENERATED, {
      type: 'doctor_sales_by_id',
      doctorId: id,
      billCount: rows.length,
      status: 'success'
    }, `Doctor sales by ID generated: ${rows.length} bills for doctor ${id}`);
    
    res.json(rows);
  } catch (err) {
    console.error("Get doctor sales by id error:", err);
    
    // Log error
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Doctor sales by ID failed',
      doctorId: req.params.id,
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, `Doctor sales by ID failed for doctor: ${req.params.id}`);
    
    res.status(500).json({ error: "Failed to fetch doctor sales" });
  }
};

// --- Vendor sales by ID ---
exports.getVendorSalesById = (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📊 Getting sales for vendor: ${id}`);
    
    // Log vendor sales by ID request
    logEvent(Events.REPORT_GENERATED, {
      type: 'vendor_sales_by_id',
      vendorId: id,
      requestedBy: req.ip || 'unknown',
      userAgent: req.get('User-Agent')
    }, `Vendor sales by ID requested: ${id}`);

    const rows = db.all(`
      SELECT bi.bill_id, b.bill_no, b.created_at as date, 
             bi.product_id, bi.batch_id, bi.qty, bi.price, 
             (bi.qty*bi.price) as amount
      FROM bill_items bi
      JOIN bills b ON bi.bill_id = b.uuid
      JOIN products p ON bi.product_id = p.uuid
      WHERE p.vendor_id = ?
      ORDER BY b.created_at DESC
    `, [id]);
    
    // Log successful report generation
    logEvent(Events.REPORT_GENERATED, {
      type: 'vendor_sales_by_id',
      vendorId: id,
      saleCount: rows.length,
      status: 'success'
    }, `Vendor sales by ID generated: ${rows.length} sales for vendor ${id}`);
    
    res.json(rows);
  } catch (err) {
    console.error("Get vendor sales by id error:", err);
    
    // Log error
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Vendor sales by ID failed',
      vendorId: req.params.id,
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, `Vendor sales by ID failed for vendor: ${req.params.id}`);
    
    res.status(500).json({ error: "Failed to fetch vendor sales" });
  }
};

// Helper function for week calculation
function getWeekKey(date) {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}