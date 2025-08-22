const express = require('express');
const router = express.Router();

console.log('📡 Loading auth routes...');

// ✅ FIXED: Remove blockAuditWrites from import (it doesn't exist)
const authController = require('../auth/authController');
const { authenticateToken, isAdmin, authorizeWithAuditCheck, authorize, validatePermission } = require('../middleware/auth');

console.log('✅ Auth controller and middleware loaded');

// --- PUBLIC ROUTES ---
router.post('/login', (req, res) => {
  console.log('📡 POST /api/auth/login called for:', req.body.username);
  authController.login(req, res);
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth service is running',
    timestamp: new Date().toISOString(),
    middleware: {
      authenticateToken: !!authenticateToken,
      isAdmin: !!isAdmin,
      authorize: !!authorize
    }
  });
});

// --- PROTECTED ROUTES ---
router.get('/me', authenticateToken, (req, res) => {
  console.log('📡 GET /api/auth/me called by:', req.user?.username);
  authController.getCurrentUser(req, res);
});

router.post('/logout', authenticateToken, (req, res) => {
  console.log('📡 POST /api/auth/logout called by:', req.user?.username);
  authController.logout(req, res);
});

router.get('/permissions', authenticateToken, (req, res) => {
  console.log('📡 GET /api/auth/permissions called by:', req.user?.username);
  validatePermission(req, res);
});

router.get('/refresh', authenticateToken, (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'medstock-secret-key-2024';
    
    const newToken = jwt.sign(
      { 
        id: req.user.id, 
        username: req.user.username, 
        role: req.user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('🔄 Token refreshed for:', req.user.username);
    res.json({
      success: true,
      token: newToken,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
});

// --- ADMIN ROUTES ---
router.get('/users', authenticateToken, authorizeWithAuditCheck, (req, res) => {
  console.log('👥 GET /api/auth/users called by:', req.user?.username, '(Role:', req.user?.role, ')');
  console.log('🔍 User object:', req.user);
  authController.getAllUsers(req, res);
});

router.post('/register', authenticateToken, isAdmin, (req, res) => {
  console.log('➕ POST /api/auth/register called by admin:', req.user?.username);
  authController.register(req, res);
});

router.get('/users/:id', authenticateToken, authorizeWithAuditCheck, (req, res) => {
  console.log('👤 GET /api/auth/users/:id called by:', req.user?.username);
  res.status(501).json({
    success: false,
    error: 'Get single user not implemented yet'
  });
});

router.put('/users/:id', authenticateToken, authorizeWithAuditCheck, (req, res) => {
  console.log('✏️ PUT /api/auth/users/:id called by:', req.user?.username);
  authController.updateUser(req, res);
});

router.delete('/users/:id', authenticateToken, authorizeWithAuditCheck, (req, res) => {
  console.log('🗑️ DELETE /api/auth/users/:id called by:', req.user?.username);
  authController.deleteUser(req, res);
});

router.put('/users/:id/role', authenticateToken, authorizeWithAuditCheck, (req, res) => {
  console.log('🔄 PUT /api/auth/users/:id/role called by:', req.user?.username);
  authController.updateUser(req, res);
});

// ✅ Debug endpoints
router.get('/debug/token', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

router.get('/debug/admin', authenticateToken, authorizeWithAuditCheck, (req, res) => {
  res.json({
    success: true,
    message: 'Admin access granted',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// --- ERROR HANDLER ---
router.use((error, req, res, next) => {
  console.error('❌ Auth route error:', error);
  res.status(500).json({
    success: false,
    error: 'Auth service error',
    details: error.message
  });
});



console.log('✅ Auth routes loaded successfully');
console.log('📋 Available endpoints:');
console.log('   POST /api/auth/login');
console.log('   GET  /api/auth/health');
console.log('   GET  /api/auth/me');
console.log('   GET  /api/auth/debug/token');
console.log('   GET  /api/auth/debug/admin');
console.log('   GET  /api/auth/users (Admin) ← MAIN ENDPOINT');
console.log('   POST /api/auth/register (Admin)');
console.log('   PUT  /api/auth/users/:id (Admin)');
console.log('   DELETE /api/auth/users/:id (Admin)');

module.exports = router;