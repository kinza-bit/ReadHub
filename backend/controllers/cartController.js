/**
 * controllers/cartController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles shopping cart operations:
 *   - Add item to cart
 *   - View cart items
 *   - Update item quantity
 *   - Remove item from cart
 *   - Clear entire cart
 *   - Get cart item count (for badge)
 *   - Checkout (place order from cart)
 * All routes require an active Customer session (enforced at route level).
 */

const { sql, poolPromise } = require('../db');

// ─── POST /api/cart — add item to cart ────────────────────────────────────────
const addToCart = async (req, res) => {
    try {
        const { bookId, formatId, quantity, rentalDays } = req.body;

        if (!bookId || !formatId) {
            return res.status(400).json({ error: 'bookId and formatId are required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('UserID',     sql.INT, req.session.userId)
            .input('BookID',     sql.INT, bookId)
            .input('FormatID',   sql.INT, formatId)
            .input('Quantity',   sql.INT, quantity || 1)
            .input('RentalDays', sql.INT, rentalDays || null)
            .execute('sp_AddToCart');

        res.status(201).json({ message: 'Item added to cart.' });
    } catch (error) {
        // Handle specific SQL errors from sp_AddToCart
        if (error.number === 50050 || error.number === 50051 || error.number === 50052) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Add to cart error:', error);
        res.status(500).json({ error: 'Failed to add item to cart.' });
    }
};

// ─── GET /api/cart — get cart items ───────────────────────────────────────────
const getCart = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .execute('sp_GetCartItems');

        res.json(result.recordset);
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ error: 'Failed to fetch cart.' });
    }
};

// ─── PUT /api/cart/:cartItemId — update cart item quantity ────────────────────
const updateCartItem = async (req, res) => {
    try {
        const { quantity } = req.body;
        if (!quantity || quantity < 1) {
            return res.status(400).json({ error: 'Quantity must be at least 1.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        // 1. Check if it's an eBook format (2 or 3)
        const checkResult = await pool.request()
            .input('CartItemID', sql.INT, req.params.cartItemId)
            .query('SELECT FormatID FROM CartItems WHERE CartItemID = @CartItemID');
        
        if (checkResult.recordset.length > 0) {
            const formatId = checkResult.recordset[0].FormatID;
            if (formatId === 2 || formatId === 3) {
                if (quantity > 1) {
                    return res.status(400).json({ error: 'You can only have one copy of an eBook.' });
                }
            }
        }

        await pool.request()
            .input('UserID',     sql.INT, req.session.userId)
            .input('CartItemID', sql.INT, req.params.cartItemId)
            .input('Quantity',   sql.INT, quantity)
            .execute('sp_UpdateCartItemQty');

        res.json({ message: 'Cart item updated.' });
    } catch (error) {
        console.error('Update cart item error:', error);
        res.status(500).json({ error: 'Failed to update cart item.' });
    }
};

// ─── DELETE /api/cart/:cartItemId — remove item from cart ─────────────────────
const removeCartItem = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('UserID',     sql.INT, req.session.userId)
            .input('CartItemID', sql.INT, req.params.cartItemId)
            .execute('sp_RemoveCartItem');

        res.json({ message: 'Item removed from cart.' });
    } catch (error) {
        console.error('Remove cart item error:', error);
        res.status(500).json({ error: 'Failed to remove item from cart.' });
    }
};

// ─── DELETE /api/cart — clear entire cart ─────────────────────────────────────
const clearCart = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .execute('sp_ClearCart');

        res.json({ message: 'Cart cleared.' });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ error: 'Failed to clear cart.' });
    }
};

// ─── GET /api/cart/count — cart item count (for badge) ────────────────────────
const getCartCount = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .execute('sp_GetCartCount');

        res.json({ count: result.recordset[0]?.CartCount || 0 });
    } catch (error) {
        console.error('Cart count error:', error);
        res.status(500).json({ error: 'Failed to get cart count.' });
    }
};

// ─── POST /api/cart/checkout — place order from cart ──────────────────────────
const checkout = async (req, res) => {
    try {
        const { paymentMethodId, shippingName, shippingAddress, shippingCity, shippingPhone } = req.body;

        if (!paymentMethodId) {
            return res.status(400).json({ error: 'Payment method is required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        // ─── Fetch cart items to validate restrictions ───
        const cartResult = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .execute('sp_GetCartItems');
        const cartItems = cartResult.recordset;

        if (cartItems.length === 0) {
            return res.status(400).json({ error: 'Your cart is empty.' });
        }

        const hasPhysical = cartItems.some(item => item.FormatID === 1);

        // ─── COD Restriction ───
        if (paymentMethodId === 1 && !hasPhysical) {
            return res.status(400).json({ error: 'Cash on Delivery is only available for physical books.' });
        }

        // ─── Address Validation ───
        if (hasPhysical) {
            if (!shippingName?.trim() || !shippingAddress?.trim() || !shippingCity?.trim() || !shippingPhone?.trim()) {
                return res.status(400).json({ error: 'All delivery details are required for physical items.' });
            }
        }

        const result = await pool.request()
            .input('UserID',          sql.INT,      req.session.userId)
            .input('PaymentMethodID', sql.INT,      paymentMethodId)
            .input('ShippingName',    sql.NVarChar, (shippingName || 'Digital Purchase').trim())
            .input('ShippingAddress', sql.NVarChar, (shippingAddress || 'No Shipping Required').trim())
            .input('ShippingCity',    sql.NVarChar, (shippingCity || 'Online').trim())
            .input('ShippingPhone',   sql.NVarChar, (shippingPhone || 'N/A').trim())
            .execute('sp_CheckoutCart');

        const order = result.recordset[0];
        res.status(201).json({
            message: 'Order placed successfully!',
            orderNumber: order.OrderNumber,
            orderId: order.OrderID,
            totalAmount: order.TotalAmount
        });
    } catch (error) {
        if (error.number === 50020) {
            return res.status(400).json({ error: 'Your cart is empty.' });
        }
        if (error.number === 50010) {
            return res.status(400).json({ error: 'Insufficient stock for one or more items.' });
        }
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Checkout failed. Please try again.' });
    }
};

// ─── GET /api/orders/history — order history for current user ─────────────────
const getOrderHistory = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .execute('sp_GetUserOrderHistory');

        // Combine orders with their items
        const orders = result.recordsets[0] || [];
        const items = result.recordsets[1] || [];

        // Group items by OrderID
        const itemsByOrder = {};
        items.forEach(item => {
            if (!itemsByOrder[item.OrderID]) itemsByOrder[item.OrderID] = [];
            itemsByOrder[item.OrderID].push(item);
        });

        // Attach items to orders
        const ordersWithItems = orders.map(order => ({
            ...order,
            items: itemsByOrder[order.OrderID] || []
        }));

        res.json(ordersWithItems);
    } catch (error) {
        console.error('Order history error:', error);
        res.status(500).json({ error: 'Failed to fetch order history.' });
    }
};

module.exports = {
    addToCart, getCart, updateCartItem, removeCartItem, clearCart, getCartCount,
    checkout, getOrderHistory
};
