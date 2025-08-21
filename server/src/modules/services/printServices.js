const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

async function printReceipt(bill) {
    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: 'usb', // change if TCP: 'tcp://192.168.x.x'
        options: { timeout: 5000 }
    });

    const receiptWidth = 40;

    // --- Ensure totals exist ---
    let total_amount = bill.grandTotal;
    if (total_amount === undefined) {
        total_amount = bill.items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    }
    const discount = Number(bill.discount || 0);

    printer.alignCenter();
    printer.println('MEDSTOCKS PHARMACY');
    printer.println(`Bill No: ${bill.bill_no || ''}`);
    printer.println(`Date: ${bill.date || new Date().toISOString()}`);
    printer.drawLine();

    // Column headers
    printer.println(formatLine('Item', 'Qty', 'Price', 'Total', receiptWidth));
    printer.drawLine();

    // Items
    bill.items.forEach(it => {
        const total = (Number(it.qty || 0) * Number(it.price || 0)).toFixed(2);
        printer.println(formatLine(it.name || '', it.qty || 0, Number(it.price || 0).toFixed(2), total, receiptWidth));
    });

    printer.drawLine();

    // Totals
    printer.println(rightAlign(`Total: ${total_amount.toFixed(2)}`, receiptWidth));
    if (discount > 0) {
        printer.println(rightAlign(`Discount: ${discount.toFixed(2)}`, receiptWidth));
        printer.println(rightAlign(`Net: ${(total_amount - discount).toFixed(2)}`, receiptWidth));
    }

    printer.newLine();
    printer.println(centerText('Thank you!', receiptWidth));
    printer.cut();

    try {
        const isConnected = await printer.isPrinterConnected();
        if (!isConnected) throw new Error("Printer not connected");
        await printer.execute();
        console.log("Printed successfully!");
    } catch (err) {
        console.error("Print failed:", err.message);
        throw err;
    }
}

// Formatting helpers
function formatLine(item, qty, price, total, width) {
    const itemWidth = 18;
    const qtyWidth = 5;
    const priceWidth = 7;
    const totalWidth = 8;

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

module.exports = { printReceipt };
