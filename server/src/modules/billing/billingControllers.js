const fs = require('fs');
const path = require('path');
const { logEvent, Events } = require('../services/eventServices');
const Bill = require('./billModel');
const Doctor = require('../doctors/doctorModel');

// --- Create and save bill to MongoDB ---
async function createBill(billData) {
  try {
    console.log('[createBill] Incoming billData:', billData);
    if (!billData.customer_name || !billData.items || billData.items.length === 0) {
      console.error('[createBill] Invalid bill data:', billData);
      throw new Error("Invalid bill data: customer name and items required");
    }
    const subtotal = billData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const discountAmount = (subtotal * (billData.discount || 0)) / 100;
    const grandTotal = subtotal - discountAmount;

    let doctor = null;
    if (billData.doctor_id) {
      doctor = await Doctor.findOne({ _id: billData.doctor_id });
      if (!doctor) {
        console.error('[createBill] Doctor not found for doctor_id:', billData.doctor_id);
        throw new Error("Doctor not found");
      }
    }

    // Deduct sold quantities from inventory for each item
    const Inventory = require('../inventory/inventoryModel');
    for (const item of billData.items) {
      if (item.batch_id && item.quantity) {
        // Find inventory containing the batch
        const inventory = await Inventory.findOne({ 'batches.batch_id': item.batch_id });
        if (inventory) {
          const batch = inventory.batches.find(b => b.batch_id === item.batch_id);
          if (batch) {
            if (batch.qty < item.quantity) {
              console.error('[createBill] Not enough stock for product:', item.product_name, 'batch:', item.batch_id);
              throw new Error(`Not enough stock for product ${item.product_name} (batch ${item.batch_id})`);
            }
            batch.qty -= item.quantity;
            batch.updated_at = new Date();
            await inventory.save();
          } else {
            console.error('[createBill] Batch not found for batch_id:', item.batch_id);
          }
        } else {
          console.error('[createBill] Inventory not found for batch_id:', item.batch_id);
        }
      }
    }

    const bill = new Bill({
      bill_no: `BILL-${Date.now()}`,
      date: new Date(),
      total_amount: grandTotal,
      discount: billData.discount || 0,
      doctor: doctor ? doctor._id : null,
      customer_name: billData.customer_name || '',
      customer_phone: billData.customer_phone || '',
      payment_method: billData.payment_method || 'cash',
      items: billData.items.map(item => ({
        product_name: item.product_name || item.name || '',
        quantity: item.quantity || 0,
        price: item.price || 0,
        batch_id: item.batch_id || '',
        vendor_name: item.vendor_name || '',
        unit: item.unit || '',
        total: item.total || (item.quantity * item.price) || 0
      })),
      created_by: billData.created_by
    });

    await bill.save();
    console.log('[createBill] Bill saved:', bill);
    logEvent(Events.BILL_CREATED, { billId: bill._id, doctorId: bill.doctor, total: bill.total_amount });

    return {
      success: true,
      billId: bill._id,
      billNo: bill.bill_no,
      grandTotal,
      subtotal,
      discountAmount,
      totalAmount: grandTotal,
      message: "Bill created and saved successfully",
      billData: bill
    };
  } catch (err) {
    console.error('[createBill] Error:', err);
    logEvent(Events.SYSTEM_ERROR, { error: err.message });
    throw err;
  }
}

// --- Get all bills from MongoDB ---
async function getBills() {
  try {
    const bills = await Bill.find().populate('doctor');
    logEvent(Events.REPORT_GENERATED, {
      type: 'bills_list',
      action: 'fetch_success',
      billCount: bills.length
    }, `Bills fetched successfully: ${bills.length} bills`);
    return bills;
  } catch (err) {
    logEvent(Events.SYSTEM_ERROR, { error: 'Get bills failed', details: err.message }, 'Failed to fetch bills');
    return [];
  }
}

// --- Get single bill by ID ---
async function getBillById(billId) {
  try {
    const bill = await Bill.findById(billId).populate('doctor');
    if (!bill) throw new Error('Bill not found');
    logEvent(Events.REPORT_GENERATED, {
      type: 'single_bill',
      action: 'fetch_success',
      billId,
      billNo: bill.bill_no
    }, `Bill fetched successfully: ${bill.bill_no}`);
    return bill;
  } catch (err) {
    logEvent(Events.SYSTEM_ERROR, { error: 'Get bill by ID failed', billId, details: err.message }, `Get bill by ID failed: ${billId}`);
    return null;
  }
}

// --- Cancel bill ---
async function cancelBill(billId) {
  try {
    const bill = await Bill.findById(billId);
    if (!bill) throw new Error('Bill not found');
    await Bill.findByIdAndDelete(billId);
    logEvent(Events.BILL_CANCELLED, {
      action: 'completed',
      originalBillId: billId,
      billNo: bill.bill_no,
      reason: "Bill cancelled",
      customerName: bill.customer_name,
      totalAmount: bill.total_amount
    }, `Bill cancelled: ${bill.bill_no}`);
    return { success: true, message: "Bill cancelled successfully" };
  } catch (err) {
    logEvent(Events.SYSTEM_ERROR, { error: 'Bill cancellation failed', billId, details: err.message }, `Bill cancellation failed: ${billId}`);
    throw new Error(`Cancel bill failed: ${err.message}`);
  }
}

// --- Get daily sales stats ---
async function getDailySalesStats(date = null) {
  try {
  // Use IST (Indian Standard Time, UTC+5:30) for start and end of day
  const targetDate = date ? new Date(date) : new Date();
  // Get IST offset in minutes
  const IST_OFFSET_MINUTES = 330;
  // Get UTC midnight for today
  const utcMidnight = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
  // Add IST offset to get IST midnight
  const start = new Date(utcMidnight.getTime() + IST_OFFSET_MINUTES * 60000);
  // End of day IST
  const end = new Date(start.getTime() + (24 * 60 * 60 * 1000) - 1);
    const bills = await Bill.find({ date: { $gte: start, $lte: end } });
    let totalRevenue = 0;
    let totalTransactions = bills.length;
    let totalItemsSold = 0;
    bills.forEach(bill => {
      totalRevenue += bill.total_amount || 0;
      if (bill.items && Array.isArray(bill.items)) {
        totalItemsSold += bill.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      }
    });
    const stats = {
      date: start.toISOString().split('T')[0],
      transactions: totalTransactions,
      revenue: totalRevenue,
      itemsSold: totalItemsSold
    };
    logEvent(Events.REPORT_GENERATED, {
      type: 'daily_sales_stats',
      date: stats.date,
      stats: stats
    }, `Daily sales stats generated: ${totalTransactions} transactions, ₹${totalRevenue} revenue`);
    return stats;
  } catch (err) {
    logEvent(Events.SYSTEM_ERROR, { error: 'Daily sales stats failed', date, details: err.message }, 'Daily sales stats generation failed');
    return {
      date: date || new Date().toISOString().split('T')[0],
      transactions: 0,
      revenue: 0,
      itemsSold: 0
    };
  }
}

function generateTextReceipt(bill) {
  const receiptLines = [];
  receiptLines.push(`MedStock Billing Receipt`);
  receiptLines.push(`Bill No: ${bill.bill_no}`);
  receiptLines.push(`Date: ${bill.date.toLocaleString()}`);
  receiptLines.push(`Customer: ${bill.customer_name || 'N/A'}`);
  receiptLines.push(`Doctor: ${bill.doctor && bill.doctor.name ? bill.doctor.name : 'N/A'}`);
  receiptLines.push(`----------------------------------------`);
  receiptLines.push(`Items:`);
  bill.items.forEach(item => {
    receiptLines.push(
      `${item.name} x${item.quantity} @ ₹${item.price} = ₹${item.quantity * item.price}`
    );
  });
  receiptLines.push(`----------------------------------------`);
  receiptLines.push(`Subtotal: ₹${bill.items.reduce((sum, item) => sum + (item.quantity * item.price), 0)}`);
  receiptLines.push(`Discount: ${bill.discount || 0}%`);
  const discountAmount = (bill.items.reduce((sum, item) => sum + (item.quantity * item.price), 0) * (bill.discount || 0)) / 100;
  receiptLines.push(`Discount Amount: ₹${discountAmount}`);
  receiptLines.push(`Total: ₹${bill.total_amount}`);
  receiptLines.push(`----------------------------------------`);
  receiptLines.push(`Thank you for your purchase!`);

  const receiptText = receiptLines.join('\n');
  const receiptsDir = path.join(__dirname, 'receipts');
  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }
  const fileName = `receipt_${bill.bill_no}_${Date.now()}.txt`;
  const filePath = path.join(receiptsDir, fileName);
  fs.writeFileSync(filePath, receiptText);

  return filePath;
}



// --- Export all billing controller functions ---
module.exports = { 
  createBill, 
  getBills,
  getBillById,
  cancelBill,
  getDailySalesStats,
  generateTextReceipt
};