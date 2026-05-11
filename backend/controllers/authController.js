/**
 * controllers/authController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all authentication-related request/response logic.
 * DB calls are made through the shared poolPromise; business rules
 * (hashing, token generation, role enforcement) live here.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sql, poolPromise } = require('../db');

// ─── US-01: Register a new Customer account ───────────────────────────────────
const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

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

        if (password.length > 255) {
            return res.status(400).json({ error: 'Password cannot be greater than 255 characters.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline. Please check your SQL Server Configuration.' });

        const salt         = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await pool.request()
            .input('Username',     sql.NVARCHAR, email)
            .input('PasswordHash', sql.NVARCHAR, passwordHash)
            .input('Email',        sql.NVARCHAR, email)
            .input('FullName',     sql.NVARCHAR, name)
            .input('RoleName',     sql.NVARCHAR, 'Customer')
            .execute('sp_RegisterUser');

        res.status(201).json({ message: 'Account created successfully!' });

    } catch (error) {
        if (error.number === 50004) {
            return res.status(409).json({ error: 'Email address is already registered.' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'An internal error occurred during registration.' });
    }
};

// ─── US-02: Customer login ────────────────────────────────────────────────────
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const userResult = await pool.request()
            .input('Email', sql.NVARCHAR, email)
            .execute('sp_GetUserByEmail');

        if (userResult.recordset.length === 0) {
            return res.status(401).json({ error: 'Incorrect email or password.' });
        }

        const user = userResult.recordset[0];

        // Strictly enforce Customer role on the user portal
        if (user.RoleName !== 'Customer') {
            return res.status(403).json({ error: 'Please use the admin login portal.' });
        }

        const isMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect email or password.' });
        }

        req.session.userId = user.UserID;
        req.session.role   = user.RoleName;
        req.session.name   = user.FullName;

        res.status(200).json({
            message: 'Login successful',
            user: { id: user.UserID, name: user.FullName, role: user.RoleName },
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'An internal error occurred during login.' });
    }
};

// ─── US-03: Admin login ───────────────────────────────────────────────────────
const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

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

        if (admin.RoleName !== 'Admin') {
            return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
        }

        const isMatch = await bcrypt.compare(password, admin.PasswordHash);
        console.log('Password match:', isMatch);
        if (!isMatch) {
            console.log('Password mismatch for email:', email);
            return res.status(401).json({ error: 'Invalid admin credentials.' });
        }

        req.session.userId = admin.UserID;
        req.session.role   = admin.RoleName;
        req.session.name   = admin.FullName;

        res.status(200).json({
            message: 'Admin login successful',
            user: { id: admin.UserID, name: admin.FullName, role: admin.RoleName },
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'An internal error occurred during admin login.' });
    }
};

// ─── US-04: Logout ────────────────────────────────────────────────────────────
const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Could not log out completely.' });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logged out successfully' });
    });
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required.' });

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const emailCheck = await pool.request()
            .input('Email', sql.NVARCHAR, email)
            .execute('sp_CheckEmailExists');

        const exists = emailCheck.recordset[0].EmailExists;
        if (!exists) {
            return res.status(404).json({ error: 'Email address not found in our records.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 3600000); // 1 hour

        await pool.request()
            .input('Email',  sql.NVARCHAR,  email)
            .input('Token',  sql.NVARCHAR,  resetToken)
            .input('Expiry', sql.DATETIME2, tokenExpiry)
            .execute('sp_StoreResetToken');

        res.status(200).json({ message: 'Redirecting to reset password page...', token: resetToken });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
};

// ─── Reset Password ───────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required.' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }
        if (newPassword.length > 255) {
            return res.status(400).json({ error: 'Password cannot be greater than 255 characters.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const tokenCheck = await pool.request()
            .input('Token', sql.NVARCHAR, token)
            .execute('sp_ValidateResetToken');

        if (tokenCheck.recordset.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token.' });
        }

        const userId = tokenCheck.recordset[0].UserID;

        const salt         = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await pool.request()
            .input('UserID',          sql.INT,      userId)
            .input('NewPasswordHash', sql.NVARCHAR, passwordHash)
            .execute('sp_UpdatePasswordAndClearToken');

        res.status(200).json({ message: 'Password has been successfully reset. You can now log in.' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'An error occurred while resetting your password.' });
    }
};

// ─── Session Check ────────────────────────────────────────────────────────────
const getSession = (req, res) => {
    if (req.session.userId) {
        return res.json({
            isAuthenticated: true,
            user: { id: req.session.userId, name: req.session.name, role: req.session.role },
        });
    }
    res.json({ isAuthenticated: false });
};

module.exports = { register, loginUser, loginAdmin, logout, forgotPassword, resetPassword, getSession };
