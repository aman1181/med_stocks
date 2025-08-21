const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/dbServices');
const { logEvent, Events } = require('../services/eventServices');

const JWT_SECRET = process.env.JWT_SECRET || 'medstock-secret-key-2024';
const SALT_ROUNDS = 10;

// --- Valid roles ---
const VALID_ROLES = ['admin', 'pharmacist', 'audit'];

// --- Helper function: Create user ---
function createUser(username, password, role = 'pharmacist') {
    try {
        // Validate role
        if (!VALID_ROLES.includes(role)) {
            throw new Error(`Invalid role: ${role}. Valid roles: ${VALID_ROLES.join(', ')}`);
        }

        // Check if user exists
        const existingUser = db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser) {
            throw new Error('Username already exists');
        }

        const id = uuidv4();
        const hash = bcrypt.hashSync(password, SALT_ROUNDS);
        const ts = new Date().toISOString();

        db.run(
            `INSERT INTO users (uuid, username, password, role, created_at, updated_at) 
             VALUES(?, ?, ?, ?, ?, ?)`,
            [id, username, hash, role, ts, ts]
        );

        // Log user creation
        logEvent(Events.USER_LOGIN, {
            action: 'user_created',
            userId: id,
            username,
            role,
            timestamp: ts
        }, `User created: ${username} with role ${role}`);

        return { uuid: id, username, role, created_at: ts };
    } catch (error) {
        logEvent(Events.SYSTEM_ERROR, {
            error: 'User creation failed',
            username,
            role,
            details: error.message
        }, `Failed to create user: ${username}`);
        throw error;
    }
}

// --- Helper function: Verify user ---
function verifyUser(username, password) {
    try {
        const user = db.get(`SELECT * FROM users WHERE username = ?`, [username]);
        if (!user) {
            logEvent(Events.USER_LOGIN, {
                action: 'login_failed',
                username,
                reason: 'user_not_found'
            }, `Login failed - user not found: ${username}`);
            return null;
        }

        const ok = bcrypt.compareSync(password, user.password);
        if (!ok) {
            logEvent(Events.USER_LOGIN, {
                action: 'login_failed',
                userId: user.uuid,
                username,
                reason: 'invalid_password'
            }, `Login failed - invalid password: ${username}`);
            return null;
        }

        // Remove password before returning
        const { password: _, ...userWithoutPassword } = user;
        
        logEvent(Events.USER_LOGIN, {
            action: 'user_verified',
            userId: user.uuid,
            username: user.username,
            role: user.role
        }, `User verified successfully: ${username}`);

        return userWithoutPassword;
    } catch (error) {
        logEvent(Events.SYSTEM_ERROR, {
            error: 'User verification failed',
            username,
            details: error.message
        }, `User verification error: ${username}`);
        return null;
    }
}

// --- API: User registration ---
exports.register = async (req, res) => {
    try {
        const { username, password, role = 'pharmacist' } = req.body;

        // Log registration attempt
        logEvent(Events.USER_LOGIN, {
            action: 'register_attempt',
            username,
            role,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        }, `Registration attempt: ${username} as ${role}`);

        // Validation
        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username and password are required',
                success: false 
            });
        }

        if (username.length < 3) {
            return res.status(400).json({ 
                error: 'Username must be at least 3 characters long',
                success: false 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Password must be at least 6 characters long',
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

        // Create user
        const newUser = createUser(username, password, role);

        // Log successful registration
        logEvent(Events.USER_LOGIN, {
            action: 'register_success',
            userId: newUser.uuid,
            username: newUser.username,
            role: newUser.role,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        }, `User registered successfully: ${username} as ${role}`);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: newUser.uuid,
                username: newUser.username,
                role: newUser.role,
                createdAt: newUser.created_at
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

        res.status(500).json({ 
            error: error.message || 'Registration failed',
            success: false 
        });
    }
};

// --- API: User login ---
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Log login attempt
        logEvent(Events.USER_LOGIN, {
            action: 'login_attempt',
            username,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        }, `Login attempt: ${username}`);

        // Validation
        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username and password are required',
                success: false 
            });
        }

        // Verify user
        const user = verifyUser(username, password);
        if (!user) {
            return res.status(401).json({ 
                error: 'Invalid username or password',
                success: false 
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.uuid, 
                username: user.username, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Log successful login
        logEvent(Events.USER_LOGIN, {
            action: 'login_success',
            userId: user.uuid,
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
                id: user.uuid,
                username: user.username,
                role: user.role,
                createdAt: user.created_at
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

        res.status(500).json({ 
            error: 'Login failed',
            success: false 
        });
    }
};

// --- API: Get current user ---
exports.getCurrentUser = (req, res) => {
    try {
        const user = db.get(
            'SELECT uuid, username, role, created_at, updated_at FROM users WHERE uuid = ?', 
            [req.user.id]
        );
        
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found',
                success: false 
            });
        }

        logEvent(Events.USER_LOGIN, {
            action: 'user_profile_accessed',
            userId: user.uuid,
            username: user.username,
            role: user.role,
            ip: req.ip
        }, `User profile accessed: ${user.username}`);

        res.json({
            success: true,
            user: {
                id: user.uuid,
                username: user.username,
                role: user.role,
                createdAt: user.created_at,
                updatedAt: user.updated_at
            }
        });
    } catch (error) {
        console.error('Get current user error:', error);
        
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Get current user failed',
            userId: req.user?.id,
            details: error.message
        }, 'Get current user system error');

        res.status(500).json({ 
            error: 'Failed to get user data',
            success: false 
        });
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
exports.getAllUsers = (req, res) => {
    try {
        console.log('📡 GET /api/auth/users called by:', req.user?.username, '(Role:', req.user?.role, ')');
        
        const users = db.all(`
            SELECT uuid, username, role, created_at, updated_at 
            FROM users 
            ORDER BY created_at DESC
        `);

        console.log(`👥 Found ${users.length} users in database`);

        // Log users fetch
        logEvent(Events.REPORT_GENERATED, {
            type: 'users_list',
            userCount: users.length,
            requestedBy: req.user?.username,
            requestedById: req.user?.id,
            ip: req.ip || req.connection?.remoteAddress
        }, `Users list fetched by ${req.user?.username}: ${users.length} users`);

        // ✅ Return array directly to match frontend expectations
        const formattedUsers = users.map(user => ({
            id: user.uuid,
            username: user.username,
            role: user.role,
            created_at: user.created_at, // Keep original field name for frontend
            updated_at: user.updated_at
        }));

        console.log('✅ Returning users:', formattedUsers.length);
        res.json(formattedUsers); // Return array directly, not wrapped in object

    } catch (error) {
        console.error('❌ Get all users error:', error);
        
        logEvent(Events.SYSTEM_ERROR, {
            error: 'Get all users failed',
            requestedBy: req.user?.username,
            details: error.message
        }, 'Get all users system error');

        res.status(500).json({ 
            error: 'Failed to fetch users',
            success: false 
        });
    }
};


// ✅ ADD THIS NEW FUNCTION after getAllUsers
exports.updateUser = (req, res) => {
    try {
        const { id } = req.params; // Get ID from URL params
        const { username, password, role } = req.body;

        console.log('🔄 Updating user:', { id, username, role, hasPassword: !!password });

        // Validation
        if (!username || !role) {
            return res.status(400).json({ 
                error: 'Username and role are required',
                success: false 
            });
        }

        if (username.length < 3) {
            return res.status(400).json({ 
                error: 'Username must be at least 3 characters long',
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
        const user = db.get('SELECT * FROM users WHERE uuid = ?', [id]);
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found',
                success: false 
            });
        }

        // Don't allow changing admin username or demoting admin
        if (user.role === 'admin' && role !== 'admin') {
            return res.status(400).json({ 
                error: 'Cannot change admin role',
                success: false 
            });
        }

        // Build update query
        let updateQuery = 'UPDATE users SET username = ?, role = ?, updated_at = ?';
        let params = [username, role, new Date().toISOString()];

        // Add password if provided
        if (password && password.trim().length >= 6) {
            const hash = bcrypt.hashSync(password.trim(), SALT_ROUNDS);
            updateQuery += ', password = ?';
            params.splice(2, 0, hash); // Insert after role
        }

        updateQuery += ' WHERE uuid = ?';
        params.push(id);

        // Execute update
        const result = db.run(updateQuery, params);

        if (result.changes === 0) {
            return res.status(404).json({ 
                error: 'User not found or no changes made',
                success: false 
            });
        }

        // Log user update
        logEvent(Events.USER_LOGIN, {
            action: 'user_updated',
            targetUserId: id,
            targetUsername: username,
            oldRole: user.role,
            newRole: role,
            updatedBy: req.user?.username,
            updatedById: req.user?.id,
            passwordChanged: !!(password && password.trim()),
            ip: req.ip
        }, `User updated by ${req.user?.username}: ${username} (${user.role} → ${role})`);

        console.log('✅ User updated successfully:', username);

        res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                id: id,
                username: username,
                role: role,
                updatedAt: new Date().toISOString()
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

        res.status(500).json({ 
            error: 'Failed to update user',
            success: false 
        });
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