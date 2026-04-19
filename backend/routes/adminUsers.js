/**
 * routes/adminUsers.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin user management routes — all protected by requireAdminAuth.
 * Covers listing, viewing, updating users and the dashboard stats endpoint.
 */

const router     = require('express').Router();
const adminUsers = require('../controllers/adminUserController');
const { requireAdminAuth } = require('../middleware/auth');

// Dashboard stats
router.get('/stats',    requireAdminAuth, adminUsers.getStats);

// User CRUD
router.get('/users',          requireAdminAuth, adminUsers.getAllUsers);
router.get('/users/:id',      requireAdminAuth, adminUsers.getUserDetails);
router.put('/users/:id',      requireAdminAuth, adminUsers.updateUser);
router.delete('/users/:id',   requireAdminAuth, adminUsers.toggleUserStatus);

module.exports = router;
