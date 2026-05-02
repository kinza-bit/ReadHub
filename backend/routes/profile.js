/**
 * routes/profile.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Customer profile & personal-data routes — all protected by requireUserAuth.
 * Covers profile CRUD, purchase history, wishlist, and book requests.
 */

const router  = require('express').Router();
const profile = require('../controllers/profileController');
const { requireUserAuth } = require('../middleware/auth');

// Profile
router.get('/profile',                requireUserAuth, profile.getProfile);
router.put('/profile',                requireUserAuth, profile.updateProfile);

// Purchase history
router.get('/user/purchases',         requireUserAuth, profile.getPurchases);
router.get('/user/rentals',           requireUserAuth, profile.getRentals);
router.get('/user/recently-added',    requireUserAuth, profile.getRecentlyAdded);

// Wishlist
router.get('/user/wishlist',          requireUserAuth, profile.getWishlist);
router.post('/user/wishlist',         requireUserAuth, profile.addToWishlist);
router.delete('/user/wishlist/:bookId', requireUserAuth, profile.removeFromWishlist);

// Book requests
router.post('/requests',              requireUserAuth, profile.submitRequest);
router.get('/requests',               requireUserAuth, profile.getRequests);

module.exports = router;
