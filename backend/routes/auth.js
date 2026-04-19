/**
 * routes/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Authentication routes — mapping HTTP verbs + paths to controller functions.
 * No business logic lives here; all handling is delegated to authController.
 */

const router = require('express').Router();
const auth   = require('../controllers/authController');

// Public auth routes (no session required)
router.post('/register',        auth.register);
router.post('/login/user',      auth.loginUser);
router.post('/login/admin',     auth.loginAdmin);
router.post('/logout',          auth.logout);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password',  auth.resetPassword);
router.get('/session',          auth.getSession);

module.exports = router;
