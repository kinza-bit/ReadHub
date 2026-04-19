/**
 * routes/adminInventory.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin inventory and book request routes — all protected by requireAdminAuth.
 */

const router           = require('express').Router();
const adminInventory   = require('../controllers/adminInventoryController');
const { requireAdminAuth } = require('../middleware/auth');

// Inventory management
router.get('/inventory',           requireAdminAuth, adminInventory.getInventory);
router.put('/inventory/:bookId',   requireAdminAuth, adminInventory.updateStock);

// All user book requests (admin view)
router.get('/requests',            requireAdminAuth, adminInventory.getAllRequests);

module.exports = router;
