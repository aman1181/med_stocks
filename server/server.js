const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const dbService = require("./src/modules/services/dbServices");
// Mongoose connection is handled in dbServices.js

const app = express();

// Middleware
// CORS Configuration with dynamic origin function
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [ 
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000'
    ];
    
    // Allow any Vercel deployment
    const isVercelDomain = origin.includes('.vercel.app');
    
    if (allowedOrigins.includes(origin) || isVercelDomain) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  next();
});

// Root
app.get('/', (req, res) => {
  res.json({ 
    message: 'MedStock API Server is running!', 
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
});

// Load all routes
app.use("/api/auth", require("./src/modules/routes/authRoutes"));
app.use("/api/vendors", require("./src/modules/routes/vendorRoutes"));
app.use("/api/doctors", require("./src/modules/routes/doctorRoutes"));
app.use("/api/inventory", require("./src/modules/routes/inventory"));
app.use("/api/billing", require("./src/modules/routes/billingRoutes"));
app.use("/api/bills", require("./src/modules/routes/billingRoutes"));
app.use("/api/reports", require("./src/modules/routes/reports"));

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Error handler  
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 MedStock API running on http://localhost:${PORT}`);
  console.log('✅ Server started successfully!');
});