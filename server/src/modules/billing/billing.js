const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/dbServices');
// Import event services
const { logEvent, logBillingEvent, Events } = require('../services/eventServices');

// --- BILLING CONTROLLER: Create and save bill to database ---
function createBill(billData) {
    try {
        console.log("💾 Creating bill:", billData);

        // Log bill creation attempt
        logEvent(Events.BILL_CREATED, {
            action: 'attempt',
            customerName: billData.customer_name,
            itemCount: billData.items?.length || 0
        }, `Bill creation attempt for customer: ${billData.customer_name}`);

        // Generate bill ID and number
        const billId = uuidv4();
        const billNo = `BILL-${Date.now()}`;
        const timestamp = new Date().toISOString();

        // Validate required fields
        if (!billData.customer_name || !billData.items || billData.items.length === 0) {
            logEvent(Events.SYSTEM_ERROR, {
                error: 'Invalid bill data',
                customerName: billData.customer_name,
                itemCount: billData.items?.length || 0
            }, 'Bill validation failed');
            throw new Error("Invalid bill data: customer name and items required");
        }

        // Calculate totals
        const subtotal = billData.items.reduce((sum, item) => 
            sum + (item.quantity * item.price), 0
        );
        const discountAmount = (subtotal * (billData.discount || 0)) / 100;
        const grandTotal = subtotal - discountAmount;

        // Find doctor name if doctor_id provided
        let doctorName = null;
        if (billData.doctor_id) {
            try {
                const doctor = db.get(`SELECT name FROM doctors WHERE uuid = ?`, [billData.doctor_id]);
                doctorName = doctor ? doctor.name : null;
            } catch (err) {
                console.warn("Could not fetch doctor name:", err.message);
                logEvent(Events.SYSTEM_ERROR, {
                    error: 'Doctor fetch failed',
                    doctorId: billData.doctor_id
                }, 'Failed to fetch doctor name');
            }
        }

        // Prepare complete bill data
        const completeBillData = {
            billId,
            billNo,
            customerName: billData.customer_name.trim(),
            customerPhone: billData.customer_phone || '',
            doctorId: billData.doctor_id || null,
            doctorName: doctorName,
            paymentMethod: billData.payment_method || 'cash',
            discount: billData.discount || 0,
            subtotal: subtotal,
            discountAmount: discountAmount,
            totalAmount: grandTotal,
            items: billData.items,
            timestamp
        };

        // 1. Log billing event using eventServices
        const eventId = logBillingEvent(completeBillData);
        console.log("✅ Bill logged using eventServices:", eventId);

        // 2. Save to bills table (if exists)
        try {
            const billsTableExists = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='bills'");
            if (billsTableExists) {
                db.run(
                    `INSERT INTO bills (
                        uuid, bill_no, doctor_id, customer_name, customer_phone, 
                        payment_method, discount, total_amount, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        billId, billNo, billData.doctor_id, completeBillData.customerName,
                        completeBillData.customerPhone, completeBillData.paymentMethod,
                        completeBillData.discount, grandTotal, timestamp, timestamp
                    ]
                );
                console.log("✅ Bill saved to bills table");
                
                logEvent(Events.BILL_CREATED, {
                    action: 'table_save_success',
                    billId,
                    billNo
                }, `Bill saved to bills table: ${billNo}`);
            }
        } catch (billTableErr) {
            console.warn("⚠️ Bills table save failed:", billTableErr.message);
            logEvent(Events.SYSTEM_ERROR, {
                error: 'Bills table save failed',
                billId,
                billNo,
                details: billTableErr.message
            }, 'Bills table save failed');
        }

        // 3. Save bill items (if bill_items table exists)
        try {
            const billItemsTableExists = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='bill_items'");
            if (billItemsTableExists) {
                billData.items.forEach(item => {
                    try {
                        const itemId = uuidv4();
                        db.run(
                            `INSERT INTO bill_items (
                                uuid, bill_id, batch_id, product_id, qty, price, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [
                                itemId, billId, item.batch_id, item.product_id || item.batch_id,
                                item.quantity, item.price, timestamp
                            ]
                        );
                        console.log(`✅ Bill item saved: ${item.product_name}`);
                        
                        logEvent(Events.BILL_CREATED, {
                            action: 'item_save_success',
                            billId,
                            productName: item.product_name,
                            quantity: item.quantity
                        }, `Bill item saved: ${item.product_name}`);
                    } catch (itemErr) {
                        console.warn(`⚠️ Bill item save failed for ${item.product_name}:`, itemErr.message);
                        logEvent(Events.SYSTEM_ERROR, {
                            error: 'Bill item save failed',
                            billId,
                            productName: item.product_name,
                            details: itemErr.message
                        }, `Bill item save failed: ${item.product_name}`);
                    }
                });
            }
        } catch (itemsErr) {
            console.warn("⚠️ Bill items save failed:", itemsErr.message);
            logEvent(Events.SYSTEM_ERROR, {
                error: 'Bill items save failed',
                billId,
                details: itemsErr.message
            }, 'Bill items save failed');
        }

        // 4. Update stock quantities
        console.log("📦 Updating inventory...");
        for (const item of billData.items) {
            try {
                const batch = db.get(`SELECT * FROM batches WHERE uuid=?`, [item.batch_id]);
                if (batch && batch.qty >= item.quantity) {
                    // Update stock
                    db.run(
                        `UPDATE batches SET qty = qty - ? WHERE uuid=?`,
                        [item.quantity, item.batch_id]
                    );
                    console.log(`✅ Stock updated for ${item.product_name}: -${item.quantity}`);
                    
                    // Log stock update using eventServices
                    logEvent(Events.STOCK_SOLD, {
                        billId: billId,
                        billNo: billNo,
                        batchId: item.batch_id,
                        productName: item.product_name,
                        quantitySold: item.quantity,
                        price: item.price,
                        previousStock: batch.qty,
                        newStock: batch.qty - item.quantity,
                        timestamp
                    }, `Stock sold: ${item.product_name} x${item.quantity}`);
                    
                } else {
                    const errorMsg = `Insufficient stock for ${item.product_name}. Available: ${batch?.qty || 0}, Required: ${item.quantity}`;
                    console.warn(`⚠️ ${errorMsg}`);
                    
                    logEvent(Events.STOCK_LOW, {
                        billId,
                        billNo,
                        batchId: item.batch_id,
                        productName: item.product_name,
                        available: batch?.qty || 0,
                        required: item.quantity
                    }, errorMsg);
                    
                    throw new Error(errorMsg);
                }
            } catch (stockErr) {
                console.error(`❌ Stock update failed for ${item.product_name}:`, stockErr.message);
                
                logEvent(Events.SYSTEM_ERROR, {
                    error: 'Stock update failed',
                    billId,
                    billNo,
                    productName: item.product_name,
                    details: stockErr.message
                }, `Stock update failed: ${item.product_name}`);
                
                throw stockErr;
            }
        }

        // 5. Generate text receipt
        const receiptPath = generateTextReceipt({
            ...billData,
            bill_no: billNo,
            date: timestamp,
            grandTotal: grandTotal,
            subtotal: subtotal,
            discountAmount: discountAmount,
            doctor_name: doctorName
        });

        // Log receipt generation
        logEvent(Events.REPORT_GENERATED, {
            type: 'receipt',
            billId,
            billNo,
            receiptPath
        }, `Receipt generated for bill: ${billNo}`);

        console.log("🎉 Bill creation completed successfully!");

        // Log successful bill completion
        logEvent(Events.BILL_CREATED, {
            action: 'completed',
            billId,
            billNo,
            customerName: completeBillData.customerName,
            totalAmount: grandTotal,
            itemCount: billData.items.length
        }, `Bill creation completed: ${billNo}`);

        return {
            success: true,
            billId,
            billNo,
            grandTotal,
            subtotal,
            discountAmount,
            totalAmount: grandTotal,
            receiptPath,
            message: "Bill created and saved successfully",
            billData: completeBillData
        };

    } catch (err) {
        console.error("❌ Bill creation failed:", err);
        
        // Log bill creation failure
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Bill creation failed',
            customerName: billData.customer_name,
            details: err.message
        }, `Bill creation failed for: ${billData.customer_name}`);
        
        throw new Error(`Bill creation failed: ${err.message}`);
    }
}

// --- BILLING CONTROLLER: Get all bills from event log ---
function getBills() {
    try {
        console.log("📋 Fetching bills from event log...");
        
        // Log bills fetch request
        logEvent(Events.REPORT_GENERATED, {
            type: 'bills_list',
            action: 'fetch_request'
        }, 'Bills fetch requested');

        // Check if events table exists
        const eventsTableExists = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='events'");
        if (!eventsTableExists) {
            console.log("ℹ️ Events table doesn't exist");
            logEvent(Events.SYSTEM_ERROR, {
                error: 'Events table not found'
            }, 'Events table does not exist');
            return [];
        }

        // Fetch bill events
        const billEvents = db.all(`
            SELECT * FROM events 
            WHERE type = 'BILL_CREATED' 
            ORDER BY timestamp DESC
        `);

        console.log(`📋 Found ${billEvents.length} bill events`);
        
        const bills = billEvents.map(event => {
            try {
                const billData = JSON.parse(event.payload);
                return {
                    bill_id: event.uuid,
                    bill_no: billData.billNo || `BILL-${event.timestamp}`,
                    created_at: event.timestamp,
                    customer_name: billData.customerName || 'Walk-in Customer',
                    customer_phone: billData.customerPhone || '',
                    payment_method: billData.paymentMethod || 'cash',
                    total: billData.totalAmount || 0,
                    discount: billData.discount || 0,
                    doctor_id: billData.doctorId || null,
                    doctor_name: billData.doctorName || null,
                    items: JSON.stringify(billData.items || []),
                    date: event.timestamp
                };
            } catch (parseErr) {
                console.warn("⚠️ Could not parse bill event:", parseErr);
                logEvent(Events.SYSTEM_ERROR, {
                    error: 'Bill event parse failed',
                    eventId: event.uuid,
                    details: parseErr.message
                }, 'Failed to parse bill event');
                return {
                    bill_id: event.uuid,
                    bill_no: `BILL-${event.timestamp}`,
                    created_at: event.timestamp,
                    customer_name: 'Walk-in Customer',
                    total: 0,
                    items: '[]'
                };
            }
        });

        console.log(`✅ Processed ${bills.length} bills from event log`);
        
        // Log successful bills fetch
        logEvent(Events.REPORT_GENERATED, {
            type: 'bills_list',
            action: 'fetch_success',
            billCount: bills.length
        }, `Bills fetched successfully: ${bills.length} bills`);

        return bills;

    } catch (err) {
        console.error("❌ Get bills error:", err);
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Get bills failed',
            details: err.message
        }, 'Failed to fetch bills');
        return [];
    }
}

// --- BILLING CONTROLLER: Get single bill by ID ---
function getBillById(billId) {
    try {
        console.log(`📋 Fetching bill: ${billId}`);
        
        // Log bill fetch request
        logEvent(Events.REPORT_GENERATED, {
            type: 'single_bill',
            action: 'fetch_request',
            billId
        }, `Single bill fetch requested: ${billId}`);
        
        const billEvent = db.get(`
            SELECT * FROM events 
            WHERE uuid = ? AND type = 'BILL_CREATED'
        `, [billId]);

        if (!billEvent) {
            console.log(`❌ Bill not found: ${billId}`);
            logEvent(Events.SYSTEM_ERROR, {
                error: 'Bill not found',
                billId
            }, `Bill not found: ${billId}`);
            return null;
        }

        try {
            const billData = JSON.parse(billEvent.payload);
            
            // Log successful bill fetch
            logEvent(Events.REPORT_GENERATED, {
                type: 'single_bill',
                action: 'fetch_success',
                billId,
                billNo: billData.billNo
            }, `Bill fetched successfully: ${billData.billNo}`);
            
            return {
                bill_id: billEvent.uuid,
                ...billData,
                created_at: billEvent.timestamp
            };
        } catch (parseErr) {
            console.error("Could not parse bill data:", parseErr);
            logEvent(Events.SYSTEM_ERROR, {
                error: 'Bill data parse failed',
                billId,
                details: parseErr.message
            }, `Failed to parse bill data: ${billId}`);
            return null;
        }
    } catch (err) {
        console.error("Get bill by ID error:", err);
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Get bill by ID failed',
            billId,
            details: err.message
        }, `Get bill by ID failed: ${billId}`);
        return null;
    }
}

// --- BILLING CONTROLLER: Delete/Cancel bill ---
function cancelBill(billId) {
    try {
        console.log(`🗑️ Cancelling bill: ${billId}`);
        
        // Log cancellation attempt
        logEvent(Events.BILL_CANCELLED, {
            action: 'attempt',
            billId
        }, `Bill cancellation attempt: ${billId}`);
        
        // Get bill data first
        const bill = getBillById(billId);
        if (!bill) {
            throw new Error("Bill not found");
        }

        // Restore stock quantities
        if (bill.items && Array.isArray(bill.items)) {
            bill.items.forEach(item => {
                try {
                    db.run(
                        `UPDATE batches SET qty = qty + ? WHERE uuid=?`,
                        [item.quantity, item.batch_id]
                    );
                    console.log(`✅ Stock restored for ${item.product_name}: +${item.quantity}`);
                    
                    // Log stock restoration
                    logEvent(Events.STOCK_SOLD, {
                        action: 'restored',
                        billId,
                        billNo: bill.billNo,
                        batchId: item.batch_id,
                        productName: item.product_name,
                        quantityRestored: item.quantity
                    }, `Stock restored: ${item.product_name} +${item.quantity}`);
                    
                } catch (stockErr) {
                    console.warn(`⚠️ Stock restore failed for ${item.product_name}:`, stockErr.message);
                    logEvent(Events.SYSTEM_ERROR, {
                        error: 'Stock restore failed',
                        billId,
                        productName: item.product_name,
                        details: stockErr.message
                    }, `Stock restore failed: ${item.product_name}`);
                }
            });
        }

        // Mark as cancelled in event log using eventServices
        logEvent(Events.BILL_CANCELLED, {
            action: 'completed',
            originalBillId: billId,
            billNo: bill.billNo,
            reason: "Bill cancelled",
            customerName: bill.customerName,
            totalAmount: bill.totalAmount
        }, `Bill cancelled: ${bill.billNo}`);

        console.log(`✅ Bill cancelled: ${billId}`);
        return { success: true, message: "Bill cancelled successfully" };

    } catch (err) {
        console.error("❌ Cancel bill error:", err);
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Bill cancellation failed',
            billId,
            details: err.message
        }, `Bill cancellation failed: ${billId}`);
        throw new Error(`Cancel bill failed: ${err.message}`);
    }
}

// --- BILLING CONTROLLER: Get daily sales stats ---
function getDailySalesStats(date = null) {
    try {
        const targetDate = date || new Date().toISOString().split('T')[0];
        console.log(`📊 Getting daily sales for: ${targetDate}`);
        
        // Log stats request
        logEvent(Events.REPORT_GENERATED, {
            type: 'daily_sales_stats',
            date: targetDate
        }, `Daily sales stats requested for: ${targetDate}`);
        
        const billEvents = db.all(`
            SELECT * FROM events 
            WHERE type = 'BILL_CREATED' 
            AND DATE(timestamp) = ?
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
                        sum + (item.quantity || 0), 0
                    );
                }
            } catch (parseErr) {
                console.warn("Could not parse bill for stats:", parseErr.message);
            }
        });

        const stats = {
            date: targetDate,
            transactions: totalTransactions,
            revenue: totalRevenue,
            itemsSold: totalItemsSold
        };

        // Log stats generation success
        logEvent(Events.REPORT_GENERATED, {
            type: 'daily_sales_stats',
            date: targetDate,
            stats: stats
        }, `Daily sales stats generated: ${totalTransactions} transactions, ₹${totalRevenue} revenue`);

        return stats;

    } catch (err) {
        console.error("❌ Daily sales stats error:", err);
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Daily sales stats failed',
            date: date,
            details: err.message
        }, 'Daily sales stats generation failed');
        return {
            date: date || new Date().toISOString().split('T')[0],
            transactions: 0,
            revenue: 0,
            itemsSold: 0
        };
    }
}

// --- Generate text receipt file ---
function generateTextReceipt(bill) {
    try {
        const dest = path.join(__dirname, 'receipts');
        fs.mkdirSync(dest, { recursive: true });

        const receiptWidth = 50;
        const lines = [];

        lines.push(centerText('🏥 MEDSTOCKS PHARMACY', receiptWidth));
        lines.push(centerText('================================', receiptWidth));
        lines.push(centerText(`Bill No: ${bill.bill_no}`, receiptWidth));
        lines.push(centerText(`Date: ${new Date(bill.date).toLocaleString()}`, receiptWidth));
        lines.push(centerText(`Customer: ${bill.customer_name}`, receiptWidth));
        
        if (bill.customer_phone) {
            lines.push(centerText(`Phone: ${bill.customer_phone}`, receiptWidth));
        }
        
        if (bill.doctor_name) {
            lines.push(centerText(`Doctor: Dr. ${bill.doctor_name}`, receiptWidth));
        }
        
        lines.push('='.repeat(receiptWidth));
        lines.push(formatLine('Item', 'Qty', 'Price', 'Total', receiptWidth));
        lines.push('-'.repeat(receiptWidth));

        bill.items.forEach(item => {
            const total = (item.quantity * item.price).toFixed(2);
            lines.push(formatLine(
                item.product_name || 'Unknown',
                item.quantity,
                item.price.toFixed(2),
                total,
                receiptWidth
            ));
        });

        lines.push('-'.repeat(receiptWidth));
        lines.push(rightAlign(`Subtotal: ₹${bill.subtotal.toFixed(2)}`, receiptWidth));
        
        if (bill.discount > 0) {
            lines.push(rightAlign(`Discount (${bill.discount}%): -₹${bill.discountAmount.toFixed(2)}`, receiptWidth));
        }
        
        lines.push(rightAlign(`Grand Total: ₹${bill.grandTotal.toFixed(2)}`, receiptWidth));
        lines.push(rightAlign(`Payment: ${(bill.payment_method || 'cash').toUpperCase()}`, receiptWidth));
        lines.push('');
        lines.push(centerText('Thank you for your business!', receiptWidth));
        lines.push(centerText('Visit again! 🙏', receiptWidth));

        const filePath = path.join(dest, `receipt_${bill.bill_no}_${Date.now()}.txt`);
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        
        console.log(`📄 Receipt saved to: ${filePath}`);
        return filePath;
    } catch (err) {
        console.error("Receipt generation failed:", err);
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Receipt generation failed',
            billNo: bill.bill_no,
            details: err.message
        }, `Receipt generation failed for: ${bill.bill_no}`);
        return null;
    }
}

// --- Helper functions ---
function formatLine(item, qty, price, total, width) {
    const itemWidth = Math.floor(width * 0.45); // 45% for item
    const qtyWidth = Math.floor(width * 0.15);  // 15% for qty
    const priceWidth = Math.floor(width * 0.20); // 20% for price
    const totalWidth = Math.floor(width * 0.20); // 20% for total

    let itemStr = String(item).padEnd(itemWidth).slice(0, itemWidth);
    let qtyStr = String(qty).padStart(qtyWidth);
    let priceStr = String(price).padStart(priceWidth);
    let totalStr = String(total).padStart(totalWidth);

    return itemStr + qtyStr + priceStr + totalStr;
}

function centerText(text, width) {
    let space = Math.floor((width - text.length) / 2);
    return ' '.repeat(Math.max(space, 0)) + text;
}

function rightAlign(text, width) {
    return text.padStart(width);
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