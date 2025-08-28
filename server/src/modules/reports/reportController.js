/* filepath: server/src/modules/reports/reportController.js */

const { logEvent, Events } = require("../services/eventServices");
const Bill = require('../billing/billModel');
const Inventory = require('../inventory/inventoryModel');
const Vendor = require('../vendors/vendorModels');
const Doctor = require('../doctors/doctorModel');

// --- Sales over time (daily) - Using Event Log ---
exports.getDailySales = async (req, res) => {
  try {
    const today = new Date();
    const start = new Date(today.setHours(0,0,0,0));
    const end = new Date(today.setHours(23,59,59,999));
    const bills = await Bill.find({ date: { $gte: start, $lte: end } });
    let transactions = bills.length;
    let revenue = bills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0);
    let sales = bills.reduce((sum, bill) => sum + (bill.items ? bill.items.reduce((s, i) => s + (i.quantity || 0), 0) : 0), 0);
    logEvent(Events.REPORT_GENERATED, {
      type: 'daily_sales',
      date: start.toISOString().split('T')[0],
      transactions,
      revenue,
      sales,
      status: 'success'
    }, `Daily sales report generated: ${transactions} transactions, ₹${revenue} revenue`);
    res.json({ date: start.toISOString().split('T')[0], transactions, revenue, sales });
  } catch (err) {
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Daily sales report failed',
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, 'Daily sales report generation failed');
    res.json({ date: new Date().toISOString().split('T')[0], transactions: 0, revenue: 0, sales: 0, error: err.message });
  }
};

// --- Sales over time (weekly) ---
exports.getWeeklySales = async (req, res) => {
  try {
    const bills = await Bill.find();
    const weeklyData = {};
    bills.forEach(bill => {
      const eventDate = new Date(bill.date);
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
      weeklyData[weekKey].revenue += bill.total_amount || 0;
      if (bill.items && Array.isArray(bill.items)) {
        weeklyData[weekKey].quantity += bill.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      }
    });
    const rows = Object.values(weeklyData).sort((a, b) => b.sale_date.localeCompare(a.sale_date)).slice(0, 10);
    logEvent(Events.REPORT_GENERATED, {
      type: 'weekly_sales',
      weekCount: rows.length,
      status: 'success'
    }, `Weekly sales report generated: ${rows.length} weeks`);
    res.json(rows);
  } catch (err) {
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Weekly sales report failed',
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, 'Weekly sales report generation failed');
    res.status(500).json({ error: "Failed to fetch weekly sales" });
  }
};

// --- Sales over time (monthly) ---
exports.getMonthlySales = async (req, res) => {
  try {
    const bills = await Bill.find();
    const monthlyData = {};
    bills.forEach(bill => {
      const eventDate = new Date(bill.date);
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
      monthlyData[monthKey].revenue += bill.total_amount || 0;
      if (bill.items && Array.isArray(bill.items)) {
        monthlyData[monthKey].quantity += bill.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      }
    });
    const rows = Object.values(monthlyData).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);
    logEvent(Events.REPORT_GENERATED, {
      type: 'monthly_sales',
      monthCount: rows.length,
      status: 'success'
    }, `Monthly sales report generated: ${rows.length} months`);
    res.json(rows);
  } catch (err) {
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Monthly sales report failed',
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, 'Monthly sales report generation failed');
    res.status(500).json({ error: "Failed to fetch monthly sales" });
  }
};

// --- Doctor wise sales ---
exports.getDoctorWiseSales = async (req, res) => {
  try {
    const bills = await Bill.find().populate('doctor');
    const doctorData = {};
    bills.forEach(bill => {
      const doctorKey = bill.doctor && bill.doctor.name ? bill.doctor.name : 'Walk-in Customer';
      if (!doctorData[doctorKey]) {
        doctorData[doctorKey] = {
          doctor_name: doctorKey,
          prescriptions: 0,
          total_value: 0
        };
      }
      doctorData[doctorKey].prescriptions += 1;
      doctorData[doctorKey].total_value += bill.total_amount || 0;
    });
    const rows = Object.values(doctorData).sort((a, b) => b.total_value - a.total_value);
    logEvent(Events.REPORT_GENERATED, {
      type: 'doctor_wise_sales',
      doctorCount: rows.length,
      status: 'success'
    }, `Doctor-wise sales report generated: ${rows.length} doctors`);
    res.json(rows);
  } catch (err) {
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Doctor-wise sales report failed',
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, 'Doctor-wise sales report generation failed');
    res.status(500).json({ error: "Failed to fetch doctor-wise sales" });
  }
};

// --- Vendor wise sales ---
exports.getVendorWiseSales = async (req, res) => {
  try {
    const inventories = await Inventory.find();
    const vendorData = {};
    inventories.forEach(inv => {
      const vendorKey = inv.vendor_name || 'Unknown Vendor';
      if (!vendorData[vendorKey]) {
        vendorData[vendorKey] = {
          vendor_name: vendorKey,
          total_products: 0,
          total_stock: 0,
          stock_value: 0
        };
      }
      vendorData[vendorKey].total_products += 1;
      if (inv.batches && Array.isArray(inv.batches)) {
        inv.batches.forEach(batch => {
          vendorData[vendorKey].total_stock += batch.qty || 0;
          vendorData[vendorKey].stock_value += (batch.qty || 0) * (batch.price || 0);
        });
      }
    });
    const rows = Object.values(vendorData).sort((a, b) => b.stock_value - a.stock_value);
    logEvent(Events.REPORT_GENERATED, {
      type: 'vendor_wise_sales',
      vendorCount: rows.length,
      status: 'success'
    }, `Vendor-wise sales report generated: ${rows.length} vendors`);
    res.json(rows);
  } catch (err) {
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Vendor-wise sales report failed',
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, 'Vendor-wise sales report generation failed');
    res.status(500).json({ error: "Failed to fetch vendor-wise sales" });
  }
};

// --- Stock report ---
exports.getStockReport = async (req, res) => {
  try {
    const inventories = await Inventory.find();
    const rows = [];
    inventories.forEach(inv => {
      if (inv.batches && Array.isArray(inv.batches)) {
        inv.batches.forEach(batch => {
          let stock_status = 'In Stock';
          if ((batch.qty || 0) === 0) stock_status = 'Out of Stock';
          else if ((batch.qty || 0) <= 10) stock_status = 'Low Stock';
          rows.push({
            product_name: inv.product_name,
            unit: inv.unit,
            vendor_name: inv.vendor_name || 'No Vendor',
            batch_no: batch.batch_no || 'No Batch',
            qty: batch.qty || 0,
            stock_status
          });
        });
      }
    });
    const stockStats = rows.reduce((stats, row) => {
      stats[row.stock_status] = (stats[row.stock_status] || 0) + 1;
      return stats;
    }, {});
    logEvent(Events.REPORT_GENERATED, {
      type: 'stock_report',
      productCount: rows.length,
      stockStats: stockStats,
      status: 'success'
    }, `Stock report generated: ${rows.length} products`);
    res.json(rows || []);
  } catch (err) {
    logEvent(Events.SYSTEM_ERROR, {
      error: 'Stock report failed',
      details: err.message,
      requestedBy: req.ip || 'unknown'
    }, 'Stock report generation failed');
    res.json([]);
  }
};

// --- Expiry report ---
exports.getExpiryReport = async (req, res) => {
  try {
    const days = Number(req.query.days || 30);
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const inventories = await Inventory.find();
    const rows = [];
    inventories.forEach(inv => {
      if (inv.batches && Array.isArray(inv.batches)) {
        inv.batches.forEach(batch => {
          if (batch.expiry_date) {
            let expiry_status = 'Expires Soon';
            const expiryDate = new Date(batch.expiry_date);
            if (expiryDate < now) expiry_status = 'Expired';
            else if (expiryDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) expiry_status = 'Expires This Week';
            if (expiryDate <= endDate) {
              rows.push({
                product_name: inv.product_name,
                vendor_name: inv.vendor_name || 'No Vendor',
                batch_no: batch.batch_no || 'No Batch',
                qty: batch.qty || 0,
                expiry_date: batch.expiry_date,
                expiry_status
              });
            }
          }
        });
      }
    });
    const expiryStats = rows.reduce((stats, row) => {
      stats[row.expiry_status] = (stats[row.expiry_status] || 0) + 1;
      return stats;
    }, {});
    logEvent(Events.REPORT_GENERATED, {
      type: 'expiry_report',
      days: days,
      productCount: rows.length,
      expiryStats: expiryStats,
      status: 'success'
    }, `Expiry report generated: ${rows.length} products expiring in ${days} days`);
    res.json(rows || []);
  } catch (err) {
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
exports.getDoctorSalesById = async (req, res) => {
  try {
    const { id } = req.params;
    const bills = await Bill.find({ doctor: id });
    const rows = bills.map(bill => ({
      bill_id: bill._id,
      bill_no: bill.bill_no,
      date: bill.date,
      total_amount: bill.total_amount,
      discount: bill.discount
    }));
    logEvent(Events.REPORT_GENERATED, {
      type: 'doctor_sales_by_id',
      doctorId: id,
      billCount: rows.length,
      status: 'success'
    }, `Doctor sales by ID generated: ${rows.length} bills for doctor ${id}`);
    res.json(rows);
  } catch (err) {
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
exports.getVendorSalesById = async (req, res) => {
  try {
    const { id } = req.params;
    const inventories = await Inventory.find({ vendor_id: id });
    let rows = [];
    for (const inv of inventories) {
      if (inv.batches && Array.isArray(inv.batches)) {
        inv.batches.forEach(batch => {
          rows.push({
            product_id: inv.product_id,
            batch_id: batch.batch_id,
            batch_no: batch.batch_no,
            qty: batch.qty,
            price: batch.price,
            amount: (batch.qty || 0) * (batch.price || 0)
          });
        });
      }
    }
    logEvent(Events.REPORT_GENERATED, {
      type: 'vendor_sales_by_id',
      vendorId: id,
      saleCount: rows.length,
      status: 'success'
    }, `Vendor sales by ID generated: ${rows.length} sales for vendor ${id}`);
    res.json(rows);
  } catch (err) {
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