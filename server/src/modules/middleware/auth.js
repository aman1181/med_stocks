const jwt = require('jsonwebtoken');
const { logEvent, Events } = require('../services/eventServices');
const db = require('../services/dbServices');

const JWT_SECRET = process.env.JWT_SECRET || 'medstock-secret-key-2024';

// --- Role permissions mapping --- (KEEP THIS)
const PERMISSIONS = {
  admin: {
    billing: ['create', 'read', 'update', 'delete'],
    inventory: ['create', 'read', 'update', 'delete'],
    products: ['create', 'read', 'update', 'delete'],
    doctors: ['create', 'read', 'update', 'delete'],
    vendors: ['create', 'read', 'update', 'delete'],
    users: ['create', 'read', 'update', 'delete'],
    reports: ['read'],
    audit: ['read', 'delete']
  },
  pharmacist: {
    billing: ['create', 'read'],
    inventory: ['read', 'update'],
    products: [],
    doctors: ['create', 'read', 'update', 'delete'],
    vendors: [],
    users: [],
    reports: ['read'],
    audit: []
  },
  audit: {
    billing: ['read'],
    inventory: ['read'],
    products: ['read'],
    doctors: ['read'],
    vendors: ['read'],
    users: ['read'],
    reports: ['read'],
    audit: ['read']
  }
};

// ✅ KEEP AND FIX: Your existing authenticateToken is better
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Access token required', 
      success: false, 
      code: 'NO_HEADER' 
    });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required', 
      success: false, 
      code: 'NO_TOKEN' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id || decoded.uuid;
    
    const user = db.get('SELECT uuid, username, role FROM users WHERE uuid = ?', [userId]);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found', 
        success: false, 
        code: 'USER_NOT_FOUND' 
      });
    }

    req.user = {
      id: user.uuid,
      username: user.username,
      role: user.role
    };
    
    next();
    
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired', 
        success: false, 
        code: 'TOKEN_EXPIRED' 
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid token', 
        success: false, 
      code: 'INVALID_TOKEN' 
    });
  }
};

// ✅ REMOVE DUPLICATE: Keep only ONE audit check function
// Remove the duplicate `blockAuditWrites` and keep this one:
const authorizeWithAuditCheck = (req, res, next) => {
  const userRole = req.user?.role;
  
  console.log(`🔍 Auth check for user: ${req.user?.username} (${userRole}) on ${req.method} ${req.path}`);
  
  // Allow GET requests for all authenticated users (including audit)
  if (req.method === 'GET') {
    console.log('✅ GET request allowed for all authenticated users');
    return next();
  }
  
  // Block write operations for audit users
  if (userRole === 'audit') {
    console.log('❌ Audit user blocked from write operation');
    logEvent(Events.USER_LOGIN, {
      status: 'audit_write_blocked',
      userId: req.user?.id,
      username: req.user?.username,
      role: userRole,
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress
    }, `Audit user ${req.user?.username} attempted write operation: ${req.method} ${req.path}`);

    return res.status(403).json({
      error: 'Audit users have read-only access. Write operations are not permitted.',
      success: false,
      code: 'AUDIT_READ_ONLY',
      userRole: 'audit',
      operation: req.method,
      message: 'Contact administrator for write access'
    });
  }
  
  // For non-audit users, check if they're admin or pharmacist for write operations
  if (userRole !== 'admin' && userRole !== 'pharmacist') {
    console.log(`❌ ${userRole} user not authorized for write operations`);
    return res.status(403).json({
      error: `${userRole} role cannot perform write operations`,
      success: false,
      code: 'INSUFFICIENT_PERMISSIONS',
      userRole: userRole,
      requiredRoles: ['admin', 'pharmacist']
    });
  }
  
  console.log(`✅ ${userRole} user authorized for write operation`);
  next();
};

// ✅ KEEP: These are useful
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required', 
      success: false, 
      code: 'NO_USER' 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required', 
      success: false, 
      code: 'NOT_ADMIN',
      userRole: req.user.role,
      requiredRole: 'admin'
    });
  }

  next();
};

const isPharmacistOrAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (role !== 'pharmacist' && role !== 'admin') {
    return res.status(403).json({
      error: 'Pharmacist or Admin access required',
      success: false,
      code: 'PHARMACIST_REQUIRED'
    });
  }
  next();
};

// ✅ KEEP: This is useful for complex authorization
const authorize = (resource, action) => {
  return (req, res, next) => {
    try {
      const userRole = req.user?.role;
      
      if (!userRole) {
        return res.status(403).json({ 
          error: 'User role not found',
          success: false,
          code: 'NO_ROLE'
        });
      }

      const rolePermissions = PERMISSIONS[userRole];
      const resourcePermissions = rolePermissions[resource];
      
      if (!resourcePermissions || !resourcePermissions.includes(action)) {
        return res.status(403).json({ 
          error: `Access denied: ${userRole} role cannot ${action} ${resource}`,
          success: false,
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Authorization failed',
        success: false,
        code: 'AUTH_ERROR'
      });
    }
  };
};

// ✅ KEEP: Utility functions
const hasPermission = (userRole, resource, action) => {
  const rolePermissions = PERMISSIONS[userRole];
  if (!rolePermissions) return false;
  
  const resourcePermissions = rolePermissions[resource];
  return resourcePermissions && resourcePermissions.includes(action);
};

const getUserPermissions = (userRole) => {
  return PERMISSIONS[userRole] || {};
};

const validatePermission = (req, res) => {
  try {
    const { resource, action } = req.query;
    const userRole = req.user?.role;

    if (!resource || !action) {
      return res.status(400).json({
        error: 'Resource and action parameters required',
        success: false
      });
    }

    const hasAccess = hasPermission(userRole, resource, action);
    const userPermissions = getUserPermissions(userRole);

    res.json({
      success: true,
      hasPermission: hasAccess,
      userRole: userRole,
      resource: resource,
      action: action,
      allPermissions: userPermissions
    });
  } catch (error) {
    res.status(500).json({
      error: 'Permission validation failed',
      success: false
    });
  }
};

// ✅ EXPORT: Clean up exports
module.exports = {
  authenticateToken,
  authorize,
  authorizeWithAuditCheck,       
  // REMOVED: blockAuditWrites (duplicate of authorizeWithAuditCheck)
  // REMOVED: optionalAuth (not used)
  hasPermission,
  getUserPermissions,
  isAdmin,
  requireAdmin: isAdmin, // Alias
  isPharmacistOrAdmin,
  validatePermission,
  PERMISSIONS
};