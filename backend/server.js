const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sql, poolPromise } = require('./db');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public'))); // Serve frontend files from frontend/public

// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// Middleware for protected routes (User)
const requireUserAuth = (req, res, next) => {
    if (req.session.userId && req.session.role === 'Customer') {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
};

// Middleware for protected routes (Admin)
const requireAdminAuth = (req, res, next) => {
    if (req.session.userId && req.session.role === 'Admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }
};

// Route: User Registration (US-01)
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation based on specifications
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline. Please check your SQL Server Configuration.' });

        // Hash password before calling SP
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Call stored procedure for registration
        await pool.request()
            .input('Username', sql.NVARCHAR, email)
            .input('PasswordHash', sql.NVARCHAR, passwordHash)
            .input('Email', sql.NVARCHAR, email)
            .input('FullName', sql.NVARCHAR, name)
            .input('RoleName', sql.NVARCHAR, 'Customer')
            .execute('sp_RegisterUser');

        res.status(201).json({ message: 'Account created successfully!' });

    } catch (error) {
        // Check for specific SP error (Email already registered)
        if (error.number === 50004) {
            return res.status(409).json({ error: 'Email address is already registered.' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'An internal error occurred during registration.' });
    }
});

// Route: User Login (US-02)
app.post('/api/login/user', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        // Use stored procedure to get user details
        const userResult = await pool.request()
            .input('Email', sql.NVARCHAR, email)
            .execute('sp_GetUserByEmail');

        if (userResult.recordset.length === 0) {
            // US-02.2: Do not specify which field is wrong
            return res.status(401).json({ error: 'Incorrect email or password.' });
        }

        const user = userResult.recordset[0];

        // Currently checking Customer role, but allow Admin to login via user portal if desired, 
        // though strictly they should use admin login. Let's strictly enforce Customer here based on specs:
        if (user.RoleName !== 'Customer') {
            return res.status(403).json({ error: 'Please use the admin login portal.' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect email or password.' });
        }

        // Establish session
        req.session.userId = user.UserID;
        req.session.role = user.RoleName;
        req.session.name = user.FullName;

        res.status(200).json({
            message: 'Login successful',
            user: { id: user.UserID, name: user.FullName, role: user.RoleName }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'An internal error occurred during login.' });
    }
});

// Route: Admin Login (US-03)
app.post('/api/login/admin', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        // Use stored procedure for admin login
        const adminResult = await pool.request()
            .input('Email', sql.NVARCHAR, email)
            .execute('sp_GetUserByEmail');

        console.log('Admin login attempt:', email);
        console.log('Recordset length:', adminResult.recordset.length);

        if (adminResult.recordset.length === 0) {
            console.log('No admin found with email:', email);
            return res.status(401).json({ error: 'Invalid admin credentials.' });
        }

        const admin = adminResult.recordset[0];

        // US-03.2: Verify Admin role
        if (admin.RoleName !== 'Admin') {
            return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, admin.PasswordHash);
        console.log('Password match:', isMatch);
        if (!isMatch) {
            console.log('Password mismatch for email:', email);
            return res.status(401).json({ error: 'Invalid admin credentials.' });
        }

        // Establish session
        req.session.userId = admin.UserID;
        req.session.role = admin.RoleName;
        req.session.name = admin.FullName;

        res.status(200).json({
            message: 'Admin login successful',
            user: { id: admin.UserID, name: admin.FullName, role: admin.RoleName }
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'An internal error occurred during admin login.' });
    }
});

// Route: User Logout (US-04)
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Could not log out completely.' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

// Route: Forgot Password
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        // Check if email exists
        const emailCheck = await pool.request()
            .input('Email', sql.NVARCHAR, email)
            .execute('sp_CheckEmailExists');

        const exists = emailCheck.recordset[0].EmailExists;

        // If email not found, return an error (we're automatically redirecting so UX trumps anti-enumeration here)
        if (!exists) {
            return res.status(404).json({ error: 'Email address not found in our records.' });
        }

        // Generate token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        // Store token in DB
        await pool.request()
            .input('Email', sql.NVARCHAR, email)
            .input('Token', sql.NVARCHAR, resetToken)
            .input('Expiry', sql.DATETIME2, tokenExpiry)
            .execute('sp_StoreResetToken');

        // Return the token to automatically redirect the user
        res.status(200).json({ message: 'Redirecting to reset password page...', token: resetToken });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

// Route: Reset Password
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required.' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        // Validate Token
        const tokenCheck = await pool.request()
            .input('Token', sql.NVARCHAR, token)
            .execute('sp_ValidateResetToken');

        if (tokenCheck.recordset.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token.' });
        }

        const userId = tokenCheck.recordset[0].UserID;

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        // Update password and clear token
        await pool.request()
            .input('UserID', sql.INT, userId)
            .input('NewPasswordHash', sql.NVARCHAR, passwordHash)
            .execute('sp_UpdatePasswordAndClearToken');

        res.status(200).json({ message: 'Password has been successfully reset. You can now log in.' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'An error occurred while resetting your password.' });
    }
});

// Admin User Management Routes
// Route: Get All Users (Admin only)
app.get('/api/admin/users', requireAdminAuth, async (req, res) => {
    console.log('GET /api/admin/users hit');
    try {
        const { search, sortBy, sortOrder, role } = req.query;
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        // Using Stored Procedure for filtered and sorted users
        const result = await pool.request()
            .input('Search', sql.NVARCHAR, search || null)
            .input('Role', sql.NVARCHAR, role || null)
            .input('SortBy', sql.NVARCHAR, sortBy || 'UserID')
            .input('SortOrder', sql.NVARCHAR, sortOrder || 'ASC')
            .execute('sp_GetUsersFiltered');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

// Route: Get User Details (Admin only)
app.get('/api/admin/users/:id', requireAdminAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.INT, req.params.id)
            .execute('sp_GetUserDetails');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ error: 'Failed to fetch user details.' });
    }
});

// Route: Update User (Admin only)
app.put('/api/admin/users/:id', requireAdminAuth, async (req, res) => {
    try {
        const { fullName, email, phoneNumber, city, roleId, isActive } = req.body;
        const pool = await poolPromise;
        
        await pool.request()
            .input('UserID', sql.INT, req.params.id)
            .input('FullName', sql.NVARCHAR, fullName)
            .input('Email', sql.NVARCHAR, email)
            .input('PhoneNumber', sql.NVARCHAR, phoneNumber)
            .input('City', sql.NVARCHAR, city)
            .input('RoleID', sql.INT, roleId)
            .input('IsActive', sql.BIT, isActive ? 1 : 0)
            .execute('sp_UpdateUserDetails');

        res.json({ message: 'User updated successfully.' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user.' });
    }
});

// Route: Toggle User Active Status (Soft Delete)
app.delete('/api/admin/users/:id', requireAdminAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.INT, req.params.id)
            .execute('sp_ToggleUserStatus');
        
        res.json({ message: 'User status toggled successfully.' });
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ error: 'Failed to toggle user status.' });
    }
});

// Route: Admin Stats (for Dashboard)
app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request().query(`
            SELECT
                (SELECT COUNT(*) FROM Users) AS TotalUsers,
                (SELECT COUNT(*) FROM Books) AS TotalBooks,
                (SELECT COUNT(*) FROM Orders) AS TotalOrders
        `);

        const row = result.recordset[0];
        res.json({
            totalUsers: row.TotalUsers || 0,
            totalBooks: row.TotalBooks || 0,
            totalOrders: row.TotalOrders || 0
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

// New Route: Get All Available Books (Demonstrating Stored Procedure)
app.get('/api/books', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        // Calling a Stored Procedure from features.sql
        // This handles complex logic (inventory check, categories) in one call
        const result = await pool.request()
            .execute('sp_ViewAvailableBooks');

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ error: 'Failed to fetch books.' });
    }
});

// New Route: Search Books (Demonstrating Stored Procedure with Parameters)
app.get('/api/books/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ error: 'Search term is required.' });

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        // Calling a Stored Procedure with parameters
        const result = await pool.request()
            .input('SearchTerm', sql.NVARCHAR, q)
            .execute('sp_SearchBooks');

        res.json(result.recordset);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed.' });
    }
});

// Route: Check User Session state

// Route: Check User Session state
app.get('/api/session', (req, res) => {
    if (req.session.userId) {
        res.json({
            isAuthenticated: true,
            user: {
                id: req.session.userId,
                name: req.session.name,
                role: req.session.role
            }
        });
    } else {
        res.json({ isAuthenticated: false });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
