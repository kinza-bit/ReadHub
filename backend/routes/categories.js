/**
 * routes/categories.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Public category routes for browsing — no authentication required.
 */

const router = require('express').Router();
const books  = require('../controllers/bookController');

router.get('/',            books.getCategories);
router.get('/with-counts', books.getCategoriesWithCounts);

module.exports = router;
