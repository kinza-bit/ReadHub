/**
 * routes/cart.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shopping cart & checkout routes — all protected by requireUserAuth.
 * Mounted at /api/cart in server.js.
 *
 * IMPORTANT: Static routes (/count, /clear, /checkout, /orders) must come
 * BEFORE parameterized routes (/:cartItemId) to avoid conflicts.
 */

const router = require('express').Router();
const cart = require('../controllers/cartController');
const { requireUserAuth } = require('../middleware/auth');

// Cart listing & add
router.get('/',              requireUserAuth, cart.getCart);
router.post('/',             requireUserAuth, cart.addToCart);

// Static routes (must precede /:cartItemId)
router.get('/count',         requireUserAuth, cart.getCartCount);
router.delete('/clear',      requireUserAuth, cart.clearCart);
router.post('/checkout',     requireUserAuth, cart.checkout);
router.get('/orders',        requireUserAuth, cart.getOrderHistory);

// Parameterized routes
router.put('/:cartItemId',    requireUserAuth, cart.updateCartItem);
router.delete('/:cartItemId', requireUserAuth, cart.removeCartItem);

module.exports = router;
