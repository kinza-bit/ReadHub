/**
 * routes/books.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Public book browsing routes — no authentication required.
 * Route order matters: /search and /category/:id must appear BEFORE /:id
 * to prevent Express from treating "search" or "category" as a book ID.
 */

const router      = require('express').Router();
const books       = require('../controllers/bookController');
const { requireUserAuth } = require('../middleware/auth');

// Public book routes
router.get('/',                        books.getBooks);
router.get('/search',                  books.searchBooks);
router.get('/category/:categoryId',    books.getBooksByCategory);
router.get('/:id',                     books.getBookById);

// User-protected rating — requires active Customer session
router.post('/:id/rate', requireUserAuth, books.rateBook);

module.exports = router;
