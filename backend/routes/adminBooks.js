/**
 * routes/adminBooks.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin book management routes — all protected by requireAdminAuth.
 * POST and PUT routes wrap bookUpload middleware to handle multipart
 * form data (cover images + PDFs). Multer errors are caught and returned
 * as 400 responses before the controller runs.
 */

const router     = require('express').Router();
const adminBooks = require('../controllers/adminBookController');
const { requireAdminAuth } = require('../middleware/auth');
const { bookUpload }       = require('../middleware/upload');

/**
 * wrapUpload
 * Middleware that runs bookUpload and converts multer validation errors
 * (wrong MIME type, file too large) into 400 JSON responses.
 */
const wrapUpload = (req, res, next) => {
    bookUpload(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
};

// Admin book CRUD
router.get('/',       requireAdminAuth,             adminBooks.getAllBooks);
router.get('/:id',    requireAdminAuth,             adminBooks.getBookById);
router.post('/',      requireAdminAuth, wrapUpload, adminBooks.addBook);
router.put('/:id',    requireAdminAuth, wrapUpload, adminBooks.updateBook);
router.delete('/:id', requireAdminAuth,             adminBooks.deleteBook);

module.exports = router;
