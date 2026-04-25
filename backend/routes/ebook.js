/**
 * routes/ebook.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Ebook specific routes for accessing and downloading content securely.
 */

const router = require('express').Router();
const ebookController = require('../controllers/ebookController');
const { requireUserAuth } = require('../middleware/auth');

// Get user's library of ebooks (rented and purchased)
router.get('/library', requireUserAuth, ebookController.getLibrary);

// Get secure access to an ebook (download or rent)
router.get('/access/:orderId/:bookId', requireUserAuth, ebookController.getEbookAccess);
router.get('/access/:orderId/:bookId/:formatId', requireUserAuth, ebookController.getEbookAccess);

module.exports = router;
