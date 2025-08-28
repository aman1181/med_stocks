
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { logEvent, Events } = require('../services/eventServices');
const User = require('./userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'medstock-secret-key-2024';
const SALT_ROUNDS = 10;

// --- Valid roles ---
const VALID_ROLES = ['admin', 'pharmacist', 'audit'];

// --- Helper function: Create user ---
async function createUser(username, password, role = 'pharmacist') {
    // Validate role
    if (!VALID_ROLES.includes(role)) {
        throw new Error(`Invalid role: ${role}. Valid roles: ${VALID_ROLES.join(', ')}`);
    }
    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
        throw new Error('Username already exists');
    }
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = new User({
        username,
        password: hash,
        role,
        status: 'active'
    });
    await user.save();
    logEvent(Events.USER_LOGIN, {
        action: 'user_created',
        userId: user._id,
        username,
        role,
        timestamp: new Date().toISOString()
    }, `User created: ${username} with role ${role}`);
    return user;
}

// --- Helper function: Verify user ---
async function verifyUser(username, password) {
    const user = await User.findOne({ username });
    if (!user) {
        logEvent(Events.USER_LOGIN, {
            action: 'login_failed',
            username,
            reason: 'user_not_found'
        }, `Login failed - user not found: ${username}`);
        return null;
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
        logEvent(Events.USER_LOGIN, {
            action: 'login_failed',
            userId: user._id,
            username,
            reason: 'invalid_password'
        }, `Login failed - invalid password: ${username}`);
        return null;
    }
    // Remove password before returning
    const userObj = user.toObject();
    delete userObj.password;
    logEvent(Events.USER_LOGIN, {
        action: 'user_verified',
        userId: user._id,
        username: user.username,
        role: user.role
    }, `User verified successfully: ${username}`);
    return userObj;
}

// --- API: User registration ---
exports.register = async (req, res) => {
    try {
        const { username, password, role = 'pharmacist' } = req.body;
        logEvent(Events.USER_LOGIN, {
            action: 'register_attempt',
            username,
            role,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        }, `Registration attempt: ${username} as ${role}`);
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required', success: false });
        }
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long', success: false });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long', success: false });
        }
        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({ error: 'Invalid role', validRoles: VALID_ROLES, success: false });
        }
        const newUser = await createUser(username, password, role);
        logEvent(Events.USER_LOGIN, {
            action: 'register_success',
            userId: newUser._id,
            username: newUser.username,
            role: newUser.role,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        }, `User registered successfully: ${username} as ${role}`);
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: newUser._id,
                username: newUser.username,
                role: newUser.role,
                createdAt: newUser.createdAt
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Registration failed',
            username: req.body.username,
            details: error.message,
            ip: req.ip
        }, `Registration system error: ${req.body.username}`);
        res.status(500).json({ error: error.message || 'Registration failed', success: false });
    }
};

// --- API: User login ---
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        logEvent(Events.USER_LOGIN, {
            action: 'login_attempt',
            username,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        }, `Login attempt: ${username}`);
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required', success: false });
        }
        const user = await verifyUser(username, password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password', success: false });
        }
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        logEvent(Events.USER_LOGIN, {
            action: 'login_success',
            userId: user._id,
            username: user.username,
            role: user.role,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            tokenGenerated: true
        }, `User logged in successfully: ${username} (${user.role})`);
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Login failed',
            username: req.body.username,
            details: error.message,
            ip: req.ip
        }, `Login system error: ${req.body.username}`);
        res.status(500).json({ error: 'Login failed', success: false });
    }
};

// --- API: Get current user ---
exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found', success: false });
        }
        logEvent(Events.USER_LOGIN, {
            action: 'user_profile_accessed',
            userId: user._id,
            username: user.username,
            role: user.role,
            ip: req.ip
        }, `User profile accessed: ${user.username}`);
        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error('Get current user error:', error);
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Get current user failed',
            userId: req.user?.id,
            details: error.message
        }, 'Get current user system error');
        res.status(500).json({ error: 'Failed to get user data', success: false });
    }
};

// --- API: User logout ---
exports.logout = (req, res) => {
    try {
        // Log logout
        logEvent(Events.USER_LOGOUT, {
            userId: req.user?.id,
            username: req.user?.username,
            role: req.user?.role,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        }, `User logged out: ${req.user?.username}`);

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Logout failed',
            userId: req.user?.id,
            details: error.message
        }, 'Logout system error');

        res.status(500).json({ 
            error: 'Logout failed',
            success: false 
        });
    }
};

// --- API: Get all users (admin only) ---
// Replace your current getAllUsers function with this:
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        logEvent(Events.REPORT_GENERATED, {
            type: 'users_list',
            userCount: users.length,
            requestedBy: req.user?.username,
            requestedById: req.user?.id,
            ip: req.ip || req.connection?.remoteAddress
        }, `Users list fetched by ${req.user?.username}: ${users.length} users`);
        const formattedUsers = users.map(user => ({
            id: user._id,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }));
        res.json(formattedUsers);
    } catch (error) {
        console.error('❌ Get all users error:', error);
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Get all users failed',
            requestedBy: req.user?.username,
            details: error.message
        }, 'Get all users system error');
        res.status(500).json({ error: 'Failed to fetch users', success: false });
    }
};


// ✅ ADD THIS NEW FUNCTION after getAllUsers
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, role } = req.body;

        // Validation
        if (username && username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long', success: false });
        }
        if (role && !VALID_ROLES.includes(role)) {
            return res.status(400).json({ error: 'Invalid role', validRoles: VALID_ROLES, success: false });
        }

        // Find user
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found', success: false });
        }
        // Don't allow changing admin username or demoting admin
        if (user.role === 'admin' && role && role !== 'admin') {
            return res.status(400).json({ error: 'Cannot change admin role', success: false });
        }

        // Build update object
        const updateObj = {};
        if (username) updateObj.username = username;
        if (role) updateObj.role = role;
        if (password && password.trim().length >= 6) {
            updateObj.password = await bcrypt.hash(password.trim(), SALT_ROUNDS);
        }

        const updatedUser = await User.findByIdAndUpdate(id, updateObj, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found or no changes made', success: false });
        }

        logEvent(Events.USER_LOGIN, {
            action: 'user_updated',
            targetUserId: id,
            targetUsername: updatedUser.username,
            oldRole: user.role,
            newRole: updatedUser.role,
            updatedBy: req.user?.username,
            updatedById: req.user?.id,
            passwordChanged: !!(password && password.trim()),
            ip: req.ip
        }, `User updated by ${req.user?.username}: ${updatedUser.username} (${user.role} → ${updatedUser.role})`);

        console.log('✅ User updated successfully:', updatedUser.username);

        res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                id: updatedUser._id,
                username: updatedUser.username,
                role: updatedUser.role,
                updatedAt: updatedUser.updatedAt
            }
        });
    } catch (error) {
        console.error('❌ Update user error:', error);
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Update user failed',
            targetUserId: req.params.id,
            updatedBy: req.user?.username,
            details: error.message
        }, 'Update user system error');
        res.status(500).json({ error: 'Failed to update user', success: false });
    }
};

// --- API: Update user role (admin only) ---
exports.updateUserRole = (req, res) => {
    try {
        const { userId, role } = req.body;

        // Validation
        if (!userId || !role) {
            return res.status(400).json({ 
                error: 'User ID and role are required',
                success: false 
            });
        }

        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({ 
                error: 'Invalid role', 
                validRoles: VALID_ROLES,
                success: false 
            });
        }

        // Get current user data
        const user = db.get('SELECT * FROM users WHERE uuid = ?', [userId]);
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found',
                success: false 
            });
        }

        // Don't allow changing admin role
        if (user.role === 'admin' && role !== 'admin') {
            return res.status(400).json({ 
                error: 'Cannot change admin role',
                success: false 
            });
        }

        // Update role
        db.run(
            'UPDATE users SET role = ?, updated_at = ? WHERE uuid = ?',
            [role, new Date().toISOString(), userId]
        );

        // Log role update
        logEvent(Events.USER_LOGIN, {
            action: 'role_updated',
            targetUserId: userId,
            targetUsername: user.username,
            oldRole: user.role,
            newRole: role,
            updatedBy: req.user?.username,
            updatedById: req.user?.id,
            ip: req.ip
        }, `User role updated by ${req.user?.username}: ${user.username} from ${user.role} to ${role}`);

        res.json({
            success: true,
            message: 'User role updated successfully',
            user: {
                id: userId,
                username: user.username,
                role: role
            }
        });
    } catch (error) {
        console.error('Update user role error:', error);
        
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Update user role failed',
            targetUserId: req.body.userId,
            updatedBy: req.user?.username,
            details: error.message
        }, 'Update user role system error');

        res.status(500).json({ 
            error: 'Failed to update user role',
            success: false 
        });
    }
};

// --- API: Delete user (admin only) ---
// Replace your current deleteUser function with this:
exports.deleteUser = (req, res) => {
    try {
        const { id } = req.params; // Get ID from URL params (not userId)

        console.log('🗑️ Deleting user:', id, 'by:', req.user?.username);

        // Get user data
        const user = db.get('SELECT * FROM users WHERE uuid = ?', [id]);
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found',
                success: false 
            });
        }

        // Don't allow deleting admin users
        if (user.role === 'admin') {
            return res.status(400).json({ 
                error: 'Cannot delete admin users',
                success: false 
            });
        }

        // Don't allow users to delete themselves
        if (id === req.user.id) {
            return res.status(400).json({ 
                error: 'Cannot delete your own account',
                success: false 
            });
        }

        // Delete user
        const result = db.run('DELETE FROM users WHERE uuid = ?', [id]);

        if (result.changes === 0) {
            return res.status(404).json({ 
                error: 'User not found',
                success: false 
            });
        }

        // Log user deletion
        logEvent(Events.USER_LOGIN, {
            action: 'user_deleted',
            deletedUserId: id,
            deletedUsername: user.username,
            deletedRole: user.role,
            deletedBy: req.user?.username,
            deletedById: req.user?.id,
            ip: req.ip
        }, `User deleted by ${req.user?.username}: ${user.username} (${user.role})`);

        console.log('✅ User deleted successfully:', user.username);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('❌ Delete user error:', error);
        
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Delete user failed',
            targetUserId: req.params.id,
            deletedBy: req.user?.username,
            details: error.message
        }, 'Delete user system error');

        res.status(500).json({ 
            error: 'Failed to delete user',
            success: false 
        });
    }
};
// --- Export helper functions for backward compatibility ---
module.exports = { 
    createUser, 
    verifyUser,
    register: exports.register,
    login: exports.login,
    getCurrentUser: exports.getCurrentUser,
    logout: exports.logout,
    getAllUsers: exports.getAllUsers,
    updateUser: exports.updateUser,
    updateUserRole: exports.updateUserRole,
    deleteUser: exports.deleteUser,
    VALID_ROLES
};