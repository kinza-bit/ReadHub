/**
 * routes/bookRequestRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes for the Book Request module (US-3.4).
 */

const router = require('express').Router();
const brController = require('../controllers/bookRequestController');
const { requireUserAuth, requireAdminAuth } = require('../middleware/auth');

// User side
router.post('/book-request', requireUserAuth, brController.submitRequest);
router.get('/my-book-requests', requireUserAuth, brController.getUserRequests);

// Admin side
router.get('/admin/book-requests',            requireAdminAuth, brController.getAllRequests);
router.put('/admin/book-requests/:id',        requireAdminAuth, brController.updateRequestStatus);
router.delete('/admin/book-requests/:id',     requireAdminAuth, brController.deleteRequest);

module.exports = router;
