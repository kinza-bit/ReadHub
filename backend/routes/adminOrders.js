/**
 * routes/adminOrders.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin order management routes — all protected by requireAdminAuth.
 * Mounted at /api/admin/orders in server.js.
 */

const router = require('express').Router();
const adminOrders = require('../controllers/adminOrderController');
const { requireAdminAuth } = require('../middleware/auth');

// Status/payment dropdown values (must come BEFORE /:id routes)
router.get('/statuses',          requireAdminAuth, adminOrders.getOrderStatuses);
router.get('/payment-statuses',  requireAdminAuth, adminOrders.getPaymentStatuses);

// List all orders (with optional search/filter query params)
router.get('/',                  requireAdminAuth, adminOrders.getAllOrders);

// Single order detail
router.get('/:id',               requireAdminAuth, adminOrders.getOrderDetail);

// Update order status
router.put('/:id/status',        requireAdminAuth, adminOrders.updateOrderStatus);

// Update payment status
router.put('/:id/payment',       requireAdminAuth, adminOrders.updatePaymentStatus);

module.exports = router;
