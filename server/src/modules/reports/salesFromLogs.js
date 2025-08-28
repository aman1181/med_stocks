const fs = require('fs');
const path = require('path');

// Utility to get today's date string in YYYY-MM-DD format (IST)
function getTodayISTString() {
  const now = new Date();
  // Convert to IST
  const istOffset = 330; // minutes
  const istTime = new Date(now.getTime() + istOffset * 60000);
  return istTime.toISOString().split('T')[0];
}

// Parse event logs for today's BILL_CREATED events
function getDailySalesFromLogs(logFilePath) {
  const todayStr = getTodayISTString();
  let salesCount = 0;
  let revenue = 0;
  try {
    const logData = fs.readFileSync(logFilePath, 'utf8');
    const lines = logData.split('\n');
    lines.forEach(line => {
      if (line.includes('BILL_CREATED') && line.includes(todayStr)) {
        // Example log: { ... "eventType":"BILL_CREATED", ... "total":1234, ... "timestamp":"2025-08-28T10:23:45.123Z" }
        try {
          const jsonMatch = line.match(/\{.*\}/);
          if (jsonMatch) {
            const event = JSON.parse(jsonMatch[0]);
            if (event.total) revenue += Number(event.total);
            salesCount++;
          }
        } catch {}
      }
    });
  } catch (err) {
    return { error: 'Failed to read log file', details: err.message };
  }
  return { date: todayStr, transactions: salesCount, revenue };
}

module.exports = { getDailySalesFromLogs };
