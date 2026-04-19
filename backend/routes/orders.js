/**
 * routes/orders.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Customer order routes — all protected by requireUserAuth.
 * Mounted at /api/orders in server.js.
 *
 * Note: ebook download is mounted separately at /api/ebook in server.js
 * to preserve the original URL: GET /api/ebook/download/:bookId
 */

const router = require('express').Router();
const orders = require('../controllers/orderController');
const { requireUserAuth } = require('../middleware/auth');

// Purchase and rental routes
router.post('/buy',  requireUserAuth, orders.buyBook);
router.post('/rent', requireUserAuth, orders.rentBook);

// Ebook download — exposed separately at /api/ebook/download/:bookId
router.get('/download/:bookId', requireUserAuth, orders.downloadEbook);

module.exports = router;
