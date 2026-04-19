const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { sql, poolPromise } = require('./db');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// ── File storage paths ───────────────────────────────────────────────────────
const IMGS_DIR = path.join(__dirname, '..', 'frontend', 'BooksIMG');
const PDFS_DIR = path.join(__dirname, '..', 'frontend', 'BooksPDF');

// Ensure BooksPDF directory exists
if (!fs.existsSync(PDFS_DIR)) fs.mkdirSync(PDFS_DIR, { recursive: true });

// ── Multer — disk storage, unique filenames, validation ─────────────────────
const diskStorage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, file.fieldname === 'coverImage' ? IMGS_DIR : PDFS_DIR);
    },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const safe = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${uuidv4()}-${safe}${ext}`);
    },
});

const uploadBooks = multer({
    storage: diskStorage,
    limits: { fileSize: 50 * 1024 * 1024 },          // 50 MB max
    fileFilter(req, file, cb) {
        if (file.fieldname === 'coverImage') {
            const ok = ['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype);
            return ok ? cb(null, true) : cb(new Error('Cover must be JPEG, PNG, WEBP, or GIF.'), false);
        }
        if (file.fieldname === 'pdfFile') {
            return file.mimetype === 'application/pdf'
                ? cb(null, true)
                : cb(new Error('File must be a PDF.'), false);
        }
        cb(null, true);
    },
});

// Helper: parse multipart fields for books
const bookUpload = uploadBooks.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'pdfFile',    maxCount: 1 },
]);

// Helper: delete a file from disk (silent if missing)
function unlinkOldFile(dir, publicUrl) {
    if (!publicUrl) return;
    try {
        const fullPath = path.join(dir, path.basename(publicUrl));
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (e) { console.warn('[unlinkOldFile]', e.message); }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));
app.use('/images', express.static(IMGS_DIR));
app.use('/pdfs',   express.static(PDFS_DIR));

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


// â”€â”€â”€ PUBLIC ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Route: Get All Categories (public â€“ for browsing)
app.get('/api/categories', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });
        const result = await pool.request().execute('sp_GetAllCategories');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});

// Route: Get All Categories WITH book counts (for admin & browse)
app.get('/api/categories/with-counts', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });
        const result = await pool.request().query(`
            SELECT c.CategoryID, c.Name, ISNULL(c.Description, 'No description') AS Description,
                   COUNT(b.BookID) AS BookCount
            FROM Categories c
            LEFT JOIN Books b ON b.CategoryID = c.CategoryID
            GROUP BY c.CategoryID, c.Name, c.Description
            ORDER BY c.Name ASC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching categories with counts:', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});

// Route: Get Books by Category (public â€“ browse by category)
// NOTE: This must be BEFORE /api/books/:id to avoid route conflict
app.get('/api/books/category/:categoryId', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });
        const result = await pool.request()
            .input('CategoryID', sql.INT, req.params.categoryId)
            .query('SELECT * FROM vw_AvailableBooks WHERE CategoryID = @CategoryID ORDER BY Title ASC');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching books by category:', error);
        res.status(500).json({ error: 'Failed to fetch books by category.' });
    }
});

// Route: Get Single Book by ID (public)
app.get('/api/books/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });
        const result = await pool.request()
            .input('BookID', sql.INT, req.params.id)
            .query('SELECT * FROM vw_AvailableBooks WHERE BookID = @BookID');
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Book not found.' });
        }
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching book:', error);
        res.status(500).json({ error: 'Failed to fetch book.' });
    }
});

// â”€â”€â”€ USER PROTECTED ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Route: Buy a Book â€“ Physical (FormatID=1) or Ebook (FormatID=2)
app.post('/api/orders/buy', requireUserAuth, async (req, res) => {
    try {
        const { bookId, isPhysical, quantity, paymentMethodId, shippingAddress } = req.body;
        if (!bookId || isPhysical === undefined || !quantity || !paymentMethodId) {
            return res.status(400).json({ error: 'bookId, isPhysical, quantity, and paymentMethodId are required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('BookID', sql.INT, bookId)
            .input('IsPhysical', sql.Bit, isPhysical ? 1 : 0)
            .input('Quantity', sql.INT, quantity)
            .input('PaymentMethodID', sql.INT, paymentMethodId)
            .input('ShippingAddress', sql.NVarChar, shippingAddress || null)
            .execute('sp_BuyBook');

        res.status(201).json({ message: 'Order placed successfully.' });
    } catch (error) {
        if (error.number === 50002 || error.number === 50010) {
            return res.status(400).json({ error: 'Insufficient physical stock.' });
        }
        console.error('Buy book error:', error);
        res.status(500).json({ error: 'Failed to place order.' });
    }
});

// Route: Rent an Ebook (FormatID=3)
app.post('/api/orders/rent', requireUserAuth, async (req, res) => {
    try {
        const { bookId, rentalDays, paymentMethodId } = req.body;
        if (!bookId || !rentalDays || !paymentMethodId) {
            return res.status(400).json({ error: 'bookId, rentalDays, and paymentMethodId are required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('BookID', sql.INT, bookId)
            .input('RentalDays', sql.INT, rentalDays)
            .input('PaymentMethodID', sql.INT, paymentMethodId)
            .execute('sp_RentEbook');

        res.status(201).json({ message: 'Ebook rented successfully.' });
    } catch (error) {
        console.error('Rent ebook error:', error);
        res.status(500).json({ error: 'Failed to rent ebook.' });
    }
});

// Route: Get Ebook Download URL (must have purchased or active rental)
app.get('/api/ebook/download/:bookId', requireUserAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('BookID', sql.INT, req.params.bookId)
            .execute('sp_DownloadEbook');

        if (result.recordset.length === 0 || !result.recordset[0].PdfURL) {
            return res.status(403).json({ error: 'Access denied. Purchase or rent this ebook first.' });
        }

        res.json({ pdfUrl: result.recordset[0].PdfURL });
    } catch (error) {
        console.error('Ebook download error:', error);
        res.status(500).json({ error: 'Failed to retrieve ebook download link.' });
    }
});

// Route: Submit a Book Request (user)
app.post('/api/requests', requireUserAuth, async (req, res) => {
    try {
        const { title, author } = req.body;
        if (!title) return res.status(400).json({ error: 'Book title is required.' });

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('RequestedTitle', sql.NVarChar, title)
            .input('RequestedAuthor', sql.NVarChar, author || null)
            .execute('sp_RequestBook');

        res.status(201).json({ message: 'Book request submitted successfully.' });
    } catch (error) {
        console.error('Book request error:', error);
        res.status(500).json({ error: 'Failed to submit book request.' });
    }
});

// Route: Get User's Own Book Requests
app.get('/api/requests', requireUserAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .execute('sp_GetUserRequests');

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching user requests:', error);
        res.status(500).json({ error: 'Failed to fetch book requests.' });
    }
});

// Route: Rate a Book â€“ 1 to 5 stars only
app.post('/api/books/:id/rate', requireUserAuth, async (req, res) => {
    try {
        const { rating } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('BookID', sql.INT, req.params.id)
            .input('Rating', sql.INT, rating)
            .execute('sp_RateBook');

        res.json({ message: 'Rating submitted successfully.' });
    } catch (error) {
        if (error.number === 50003) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
        }
        console.error('Rating error:', error);
        res.status(500).json({ error: 'Failed to submit rating.' });
    }
});

// --- Profile Routes ---
app.get('/api/profile', requireUserAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .query('SELECT Username, Email, FullName, PhoneNumber, AddressLine1, City, Country, ProfileImageURL FROM Users WHERE UserID = @UserID');
            
        if (result.recordset.length === 0) return res.status(404).json({ error: 'User not found.' });
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile.' });
    }
});

app.put('/api/profile', requireUserAuth, async (req, res) => {
    try {
        const { fullName, phoneNumber, addressLine1, city, country, profileImageUrl } = req.body;
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('FullName', sql.NVarChar, fullName)
            .input('PhoneNumber', sql.NVarChar, phoneNumber || null)
            .input('AddressLine1', sql.NVarChar, addressLine1 || null)
            .input('City', sql.NVarChar, city || null)
            .input('Country', sql.NVarChar, country || null)
            .input('ProfileImageURL', sql.NVarChar, profileImageUrl || null)
            .query(`
                UPDATE Users 
                SET FullName = @FullName, PhoneNumber = @PhoneNumber, AddressLine1 = @AddressLine1, 
                    City = @City, Country = @Country, ProfileImageURL = @ProfileImageURL
                WHERE UserID = @UserID
            `);
        res.json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

// --- Purchases & Wishlist Routes ---
app.get('/api/user/purchases', requireUserAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .query(`
                SELECT o.OrderDate, oi.Quantity, oi.UnitPrice, b.Title, b.Author, b.ImageURL, b.BookID
                FROM Orders o
                JOIN OrderItems oi ON o.OrderID = oi.OrderID
                JOIN Books b ON oi.BookID = b.BookID
                WHERE o.UserID = @UserID
                ORDER BY o.OrderDate DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Purchases fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch purchases.' });
    }
});

app.get('/api/user/wishlist', requireUserAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .query(`
                SELECT w.WishlistID, w.CreatedAt, b.Title, b.Author, b.ImageURL, b.BookID, b.AverageRating
                FROM UserWishlist w
                JOIN Books b ON w.BookID = b.BookID
                WHERE w.UserID = @UserID
                ORDER BY w.CreatedAt DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Wishlist fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch wishlist.' });
    }
});

app.post('/api/user/wishlist', requireUserAuth, async (req, res) => {
    try {
        const { bookId } = req.body;
        if (!bookId) return res.status(400).json({ error: 'bookId is required.' });
        
        const pool = await poolPromise;
        const check = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('BookID', sql.INT, bookId)
            .query('SELECT * FROM UserWishlist WHERE UserID = @UserID AND BookID = @BookID');
            
        if (check.recordset.length > 0) {
            return res.status(400).json({ error: 'Book already in wishlist.' });
        }
        
        await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('BookID', sql.INT, bookId)
            .query('INSERT INTO UserWishlist (UserID, BookID) VALUES (@UserID, @BookID)');
            
        res.status(201).json({ message: 'Added to wishlist.' });
    } catch (error) {
        console.error('Wishlist add error:', error);
        res.status(500).json({ error: 'Failed to add to wishlist.' });
    }
});

app.delete('/api/user/wishlist/:bookId', requireUserAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('BookID', sql.INT, req.params.bookId)
            .query('DELETE FROM UserWishlist WHERE UserID = @UserID AND BookID = @BookID');
            
        res.json({ message: 'Removed from wishlist.' });
    } catch (error) {
        console.error('Wishlist remove error:', error);
        res.status(500).json({ error: 'Failed to remove from wishlist.' });
    }
});

// â”€â”€â”€ ADMIN ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Route: Get All Categories (Admin)
app.get('/api/admin/categories', requireAdminAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().execute('sp_GetAllCategories');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching categories (admin):', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});

// Route: Add Category (Admin)
app.post('/api/admin/categories', requireAdminAuth, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Category name is required.' });

        const pool = await poolPromise;
        await pool.request()
            .input('CategoryName', sql.NVarChar, name)
            .input('CategoryDescription', sql.NVarChar, description || null)
            .execute('sp_AddCategory');

        res.status(201).json({ message: 'Category added successfully.' });
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ error: 'Failed to add category.' });
    }
});

// Route: Update Category (Admin)
app.put('/api/admin/categories/:id', requireAdminAuth, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Category name is required.' });

        const pool = await poolPromise;
        await pool.request()
            .input('CategoryID', sql.INT, req.params.id)
            .input('CategoryName', sql.NVarChar, name)
            .input('CategoryDescription', sql.NVarChar, description || null)
            .execute('sp_UpdateCategory');

        res.json({ message: 'Category updated successfully.' });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category.' });
    }
});

// Route: Delete Category (Admin — fails if books still in it)
app.delete('/api/admin/categories/:id', requireAdminAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('CategoryID', sql.INT, req.params.id)
            .execute('sp_DeleteCategory');

        res.json({ message: 'Category deleted successfully.' });
    } catch (error) {
        if (error.number === 50001) {
            return res.status(409).json({ error: 'Cannot delete a category that still contains books.' });
        }
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category.' });
    }
});

// ── Admin Book Management — with image & PDF file upload ─────────────────────

// GET all books (admin view — full object with ImageURL and PdfURL)
app.get('/api/admin/books', requireAdminAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT b.BookID, b.ISBN, b.Title, b.Author,
                   b.CategoryID,  c.Name AS CategoryName,
                   b.Description,
                   b.PhysicalPrice, b.EbookPrice,
                   b.RentalPricePerDay, b.LateFeePerDay,
                   b.AverageRating,
                   b.ImageURL,   -- cover image URL stored in DB
                   b.PdfURL,     -- PDF URL stored in DB
                   i.StockLevel, i.LowStockThreshold
            FROM Books b
            LEFT JOIN Categories c ON c.CategoryID = b.CategoryID
            LEFT JOIN Inventory  i ON i.BookID     = b.BookID
            ORDER BY b.BookID DESC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching admin books:', error);
        res.status(500).json({ error: 'Failed to fetch books.' });
    }
});

// GET single book by ID
app.get('/api/admin/books/:id', requireAdminAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('BookID', sql.INT, req.params.id)
            .query(`
                SELECT b.BookID, b.ISBN, b.Title, b.Author,
                       b.CategoryID, c.Name AS CategoryName,
                       b.Description,
                       b.PhysicalPrice, b.EbookPrice,
                       b.RentalPricePerDay, b.LateFeePerDay,
                       b.AverageRating,
                       b.ImageURL, b.PdfURL,
                       i.StockLevel, i.LowStockThreshold
                FROM Books b
                LEFT JOIN Categories c ON c.CategoryID = b.CategoryID
                LEFT JOIN Inventory  i ON i.BookID     = b.BookID
                WHERE b.BookID = @BookID
            `);
        if (!result.recordset.length) return res.status(404).json({ error: 'Book not found.' });
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching book:', error);
        res.status(500).json({ error: 'Failed to fetch book.' });
    }
});

// POST — add new book (multipart: coverImage + pdfFile)
app.post('/api/admin/books', requireAdminAuth, (req, res, next) => {
    bookUpload(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    const coverFile = req.files?.coverImage?.[0];
    const pdfFile   = req.files?.pdfFile?.[0];

    const {
        isbn, title, author, categoryId, description,
        physicalPrice, ebookPrice, rentalPricePerDay, lateFeePerDay,
        stockLevel, lowStockThreshold
    } = req.body;

    if (!title || !author || !categoryId) {
        if (coverFile) unlinkOldFile(IMGS_DIR, '/images/' + coverFile.filename);
        if (pdfFile)   unlinkOldFile(PDFS_DIR, '/pdfs/'   + pdfFile.filename);
        return res.status(400).json({ error: 'title, author, and categoryId are required.' });
    }

    const imgUrl = coverFile ? `/images/${coverFile.filename}` : null;
    const pdfUrl = pdfFile   ? `/pdfs/${pdfFile.filename}`     : null;

    try {
        const pool = await poolPromise;
        await pool.request()
            .input('ISBN',              sql.NVarChar,      isbn            || null)
            .input('Title',             sql.NVarChar,      title)
            .input('Author',            sql.NVarChar,      author)
            .input('CategoryID',        sql.INT,           parseInt(categoryId))
            .input('Description',       sql.NVarChar,      description     || null)
            .input('PhysicalPrice',     sql.Decimal(10,2), physicalPrice     ? parseFloat(physicalPrice)     : null)
            .input('EbookPrice',        sql.Decimal(10,2), ebookPrice        ? parseFloat(ebookPrice)        : null)
            .input('RentalPricePerDay', sql.Decimal(10,2), rentalPricePerDay ? parseFloat(rentalPricePerDay) : null)
            .input('LateFeePerDay',     sql.Decimal(10,2), lateFeePerDay     ? parseFloat(lateFeePerDay)     : 1.00)
            .input('ImageURL',          sql.NVarChar,      imgUrl)
            .input('PdfURL',            sql.NVarChar,      pdfUrl)
            .input('StockLevel',        sql.INT,           stockLevel        ? parseInt(stockLevel)        : 0)
            .input('LowStockThreshold', sql.INT,           lowStockThreshold ? parseInt(lowStockThreshold) : 5)
            .execute('sp_AddNewBook');

        res.status(201).json({ message: 'Book added successfully.', ImageURL: imgUrl, PdfURL: pdfUrl });
    } catch (error) {
        console.error('Error adding book:', error);
        if (coverFile) unlinkOldFile(IMGS_DIR, '/images/' + coverFile.filename);
        if (pdfFile)   unlinkOldFile(PDFS_DIR, '/pdfs/'   + pdfFile.filename);
        res.status(500).json({ error: 'Failed to add book. Uploaded files rolled back.' });
    }
});

// PUT — update book (multipart: optional new coverImage + pdfFile)
app.put('/api/admin/books/:id', requireAdminAuth, (req, res, next) => {
    bookUpload(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    const bookId    = parseInt(req.params.id);
    const coverFile = req.files?.coverImage?.[0];
    const pdfFile   = req.files?.pdfFile?.[0];

    const {
        title, author, isbn, categoryId, description,
        physicalPrice, ebookPrice, rentalPricePerDay, lateFeePerDay
    } = req.body;

    // Fetch existing record for old file paths
    let existing;
    try {
        const pool = await poolPromise;
        const r = await pool.request()
            .input('BookID', sql.INT, bookId)
            .query('SELECT ImageURL, PdfURL FROM Books WHERE BookID = @BookID');
        if (!r.recordset.length) {
            if (coverFile) unlinkOldFile(IMGS_DIR, '/images/' + coverFile.filename);
            if (pdfFile)   unlinkOldFile(PDFS_DIR, '/pdfs/'   + pdfFile.filename);
            return res.status(404).json({ error: 'Book not found.' });
        }
        existing = r.recordset[0];
    } catch (err) {
        if (coverFile) unlinkOldFile(IMGS_DIR, '/images/' + coverFile.filename);
        if (pdfFile)   unlinkOldFile(PDFS_DIR, '/pdfs/'   + pdfFile.filename);
        return res.status(500).json({ error: 'Failed to retrieve existing book.' });
    }

    const finalImgUrl = coverFile ? `/images/${coverFile.filename}` : existing.ImageURL;
    const finalPdfUrl = pdfFile   ? `/pdfs/${pdfFile.filename}`     : existing.PdfURL;

    try {
        const pool = await poolPromise;
        await pool.request()
            .input('BookID',            sql.INT,           bookId)
            .input('Title',             sql.NVarChar,      title          || null)
            .input('Author',            sql.NVarChar,      author         || null)
            .input('ISBN',              sql.NVarChar,      isbn           || null)
            .input('CategoryID',        sql.INT,           categoryId     ? parseInt(categoryId) : null)
            .input('Description',       sql.NVarChar,      description    || null)
            .input('PhysicalPrice',     sql.Decimal(10,2), physicalPrice     ? parseFloat(physicalPrice)     : null)
            .input('EbookPrice',        sql.Decimal(10,2), ebookPrice        ? parseFloat(ebookPrice)        : null)
            .input('RentalPricePerDay', sql.Decimal(10,2), rentalPricePerDay ? parseFloat(rentalPricePerDay) : null)
            .input('LateFeePerDay',     sql.Decimal(10,2), lateFeePerDay     ? parseFloat(lateFeePerDay)     : null)
            .input('ImageURL',          sql.NVarChar,      finalImgUrl)
            .input('PdfURL',            sql.NVarChar,      finalPdfUrl)
            .execute('sp_UpdateBook');

        // Delete old files AFTER successful DB update
        if (coverFile && existing.ImageURL) unlinkOldFile(IMGS_DIR, existing.ImageURL);
        if (pdfFile   && existing.PdfURL)   unlinkOldFile(PDFS_DIR, existing.PdfURL);

        res.json({ message: 'Book updated successfully.', ImageURL: finalImgUrl, PdfURL: finalPdfUrl });
    } catch (error) {
        console.error('Error updating book:', error);
        if (coverFile) unlinkOldFile(IMGS_DIR, '/images/' + coverFile.filename);
        if (pdfFile)   unlinkOldFile(PDFS_DIR, '/pdfs/'   + pdfFile.filename);
        res.status(500).json({ error: 'Failed to update book. Uploaded files rolled back.' });
    }
});

// DELETE — remove book + delete its cover image and PDF from disk
app.delete('/api/admin/books/:id', requireAdminAuth, async (req, res) => {
    const bookId = parseInt(req.params.id);

    // 1. Fetch file paths before deleting
    let toDelete;
    try {
        const pool = await poolPromise;
        const r = await pool.request()
            .input('BookID', sql.INT, bookId)
            .query('SELECT ImageURL, PdfURL FROM Books WHERE BookID = @BookID');
        if (!r.recordset.length) return res.status(404).json({ error: 'Book not found.' });
        toDelete = r.recordset[0];
    } catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve book.' });
    }

    // 2. Delete DB record
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('BookID', sql.INT, bookId)
            .execute('sp_DeleteBook');
    } catch (error) {
        console.error('Error deleting book:', error);
        return res.status(500).json({ error: 'Failed to delete book.' });
    }

    // 3. Delete files from disk
    unlinkOldFile(IMGS_DIR, toDelete.ImageURL);
    unlinkOldFile(PDFS_DIR, toDelete.PdfURL);

    res.json({ message: 'Book and its files deleted successfully.' });
});

// Route: Get Full Inventory (Admin)
app.get('/api/admin/inventory', requireAdminAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().execute('sp_GetFullInventory');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: 'Failed to fetch inventory.' });
    }
});

// Route: Update Stock Level / Restock (Admin)
app.put('/api/admin/inventory/:bookId', requireAdminAuth, async (req, res) => {
    try {
        const { quantityToAdd } = req.body;
        if (quantityToAdd === undefined || quantityToAdd === null) {
            return res.status(400).json({ error: 'quantityToAdd is required.' });
        }

        const pool = await poolPromise;
        await pool.request()
            .input('BookID', sql.INT, req.params.bookId)
            .input('QuantityToAdd', sql.INT, quantityToAdd)
            .execute('sp_UpdateStockLevel');

        res.json({ message: 'Stock updated successfully.' });
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ error: 'Failed to update stock level.' });
    }
});

// Route: Get All User Book Requests (Admin)
app.get('/api/admin/requests', requireAdminAuth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().execute('sp_GetAllUserRequests_Admin');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching all requests (admin):', error);
        res.status(500).json({ error: 'Failed to fetch book requests.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
