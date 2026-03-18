const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
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

        // Check for duplicate email
        const checkUser = await pool.request()
            .input('Email', sql.NVARCHAR, email)
            .query('SELECT UserID FROM Users WHERE Email = @Email');

        if (checkUser.recordset.length > 0) {
            return res.status(409).json({ error: 'Email address is already registered.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Get Customer Role ID
        const roleResult = await pool.request()
            .input('RoleName', sql.NVARCHAR, 'Customer')
            .query('SELECT RoleID FROM Roles WHERE RoleName = @RoleName');

        if (roleResult.recordset.length === 0) {
            return res.status(500).json({ error: 'Customer role not found in database.' });
        }
        const roleId = roleResult.recordset[0].RoleID;

        // Insert new user
        // Note: Using default values for nullable fields to fulfill schema requirements
        await pool.request()
            .input('Username', sql.NVARCHAR, email) // Using email as username for simplicity
            .input('PasswordHash', sql.NVARCHAR, passwordHash)
            .input('Email', sql.NVARCHAR, email)
            .input('FullName', sql.NVARCHAR, name)
            .input('RoleID', sql.INT, roleId)
            .query(`
                INSERT INTO Users (Username, PasswordHash, Email, FullName, RoleID, IsActive) 
                VALUES (@Username, @PasswordHash, @Email, @FullName, @RoleID, 1)
            `);

        res.status(201).json({ message: 'Account created successfully!' });

    } catch (error) {
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

        // Use vw_AllUsers view from features.sql to simplify the query
        // Note: Joining with Users only to get the PasswordHash which isn't in the view
        const userResult = await pool.request()
            .input('Email', sql.NVARCHAR, email)
            .query(`
                SELECT v.UserID, v.FullName, v.Email, u.PasswordHash, v.RoleName 
                FROM vw_AllUsers v
                INNER JOIN Users u ON v.UserID = u.UserID
                WHERE v.Email = @Email AND v.IsActive = 1
            `);

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

        // Use vw_AllUsers view for admin login as well
        const adminResult = await pool.request()
            .input('Email', sql.NVARCHAR, email)
            .query(`
                SELECT v.UserID, v.FullName, v.Email, u.PasswordHash, v.RoleName 
                FROM vw_AllUsers v
                INNER JOIN Users u ON v.UserID = u.UserID
                WHERE v.Email = @Email AND v.IsActive = 1
            `);

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

// Admin User Management Routes
// Route: Get All Users (Admin only)
app.get('/api/admin/users', requireAdminAuth, async (req, res) => {
    console.log('GET /api/admin/users hit');
    try {
        const { search, sortBy, sortOrder, role } = req.query;
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        let query = `
            SELECT v.UserID, v.FullName, v.Email, v.RoleName, u.Username, u.PhoneNumber, u.City, v.IsActive, u.CreatedAt
            FROM vw_AllUsers v
            INNER JOIN Users u ON v.UserID = u.UserID
            WHERE 1=1
        `;

        const request = pool.request();

        if (search) {
            query += ` AND (v.FullName LIKE @Search OR v.Email LIKE @Search OR u.Username LIKE @Search)`;
            request.input('Search', sql.NVARCHAR, `%${search}%`);
        }

        if (role) {
            query += ` AND v.RoleName = @Role`;
            request.input('Role', sql.NVARCHAR, role);
        }

        // Default sorting
        const validSortColumns = ['UserID', 'FullName', 'Email', 'RoleName', 'CreatedAt'];
        const validSortOrders = ['ASC', 'DESC'];
        const sortCol = validSortColumns.includes(sortBy) ? sortBy : 'UserID';
        const sortDir = validSortOrders.includes(sortOrder?.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

        query += ` ORDER BY ${sortCol} ${sortDir}`;

        const result = await request.query(query);
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
            .query(`
                SELECT UserID, Username, Email, FullName, PhoneNumber, AddressLine1, City, Country, IsActive, RoleID, CreatedAt 
                FROM Users 
                WHERE UserID = @UserID
            `);

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
            .query(`
                UPDATE Users 
                SET FullName = @FullName, Email = @Email, PhoneNumber = @PhoneNumber, City = @City, RoleID = @RoleID, IsActive = @IsActive
                WHERE UserID = @UserID
            `);

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
            .query(`UPDATE Users SET IsActive = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END WHERE UserID = @UserID`);
        
        res.json({ message: 'User status toggled successfully.' });
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ error: 'Failed to toggle user status.' });
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
