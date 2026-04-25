/**
 * server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Application bootstrap — the only responsibility of this file is to:
 *   1. Configure core Express middleware (CORS, body parsers, sessions, statics)
 *   2. Mount all route modules under /api
 *   3. Start the HTTP listener
 *
 * Business logic → controllers/
 * Auth & upload guards → middleware/
 * Route declarations → routes/
 */

const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const path    = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

// ── Route modules ─────────────────────────────────────────────────────────────
const authRoutes           = require('./routes/auth');
const bookRoutes           = require('./routes/books');
const categoryRoutes       = require('./routes/categories');
const orderRoutes          = require('./routes/orders');
const profileRoutes        = require('./routes/profile');
const adminUserRoutes      = require('./routes/adminUsers');
const adminBookRoutes      = require('./routes/adminBooks');
const adminCategoryRoutes  = require('./routes/adminCategories');
const adminInventoryRoutes = require('./routes/adminInventory');
const bookRequestRoutes    = require('./routes/bookRequestRoutes');

// ── Static file paths (for serving uploaded files) ───────────────────────────
const IMGS_DIR = path.join(__dirname, '..', 'frontend', 'BooksIMG');
const PDFS_DIR = path.join(__dirname, '..', 'frontend', 'BooksPDF');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Core middleware ───────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));
app.use('/images', express.static(IMGS_DIR));
app.use('/pdfs',   express.static(PDFS_DIR));

// Session
app.use(session({
    secret:            process.env.SESSION_SECRET,
    resave:            false,
    saveUninitialized: false,
    cookie: {
        secure: false,              // Set to true when serving over HTTPS
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    },
}));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api',          authRoutes);           // /api/register, /api/login/*, …
app.use('/api/books',    bookRoutes);           // /api/books, /api/books/search, …
app.use('/api/categories', categoryRoutes);     // /api/categories, /api/categories/with-counts
app.use('/api/orders',   orderRoutes);          // /api/orders/buy, /api/orders/rent
app.use('/api/ebook',    orderRoutes);          // /api/ebook/download/:bookId
app.use('/api',          profileRoutes);        // /api/profile, /api/user/*, /api/requests
app.use('/api/admin',    adminUserRoutes);      // /api/admin/users/*, /api/admin/stats
app.use('/api/admin/books',      adminBookRoutes);      // /api/admin/books/*
app.use('/api/admin/categories', adminCategoryRoutes);  // /api/admin/categories/*
app.use('/api/admin',    adminInventoryRoutes); // /api/admin/inventory/*, /api/admin/requests
app.use('/api',          bookRequestRoutes);    // /api/book-request, /api/admin/book-requests

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
