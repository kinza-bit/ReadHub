/**
 * controllers/orderController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all customer order operations:
 *   - Purchasing a physical or ebook
 *   - Renting an ebook
 *   - Retrieving an ebook's download URL
 * All routes in this controller require an active Customer session (enforced
 * at the route level via requireUserAuth).
 */

const { sql, poolPromise } = require('../db');

// ─── POST /api/orders/buy — buy a physical or ebook copy ─────────────────────
const buyBook = async (req, res) => {
    try {
        const { bookId, isPhysical, quantity, paymentMethodId, shippingAddress } = req.body;

        if (!bookId || isPhysical === undefined || !quantity || !paymentMethodId) {
            return res.status(400).json({ error: 'bookId, isPhysical, quantity, and paymentMethodId are required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('UserID',          sql.INT,     req.session.userId)
            .input('BookID',          sql.INT,     bookId)
            .input('IsPhysical',      sql.Bit,     isPhysical ? 1 : 0)
            .input('Quantity',        sql.INT,     quantity)
            .input('PaymentMethodID', sql.INT,     paymentMethodId)
            .input('ShippingAddress', sql.NVarChar, shippingAddress || null)
            .execute('sp_BuyBook');

        res.status(201).json({ message: 'Order placed successfully.' });
    } catch (error) {
        if (error.number === 50002 || error.number === 50010) {
            return res.status(400).json({ error: 'Insufficient physical stock.' });
        }
        console.error('Buy book error:', error);
        res.status(500).json({ error: 'Failed to place order.' });
    }
};

// ─── POST /api/orders/rent — rent an ebook for N days ────────────────────────
const rentBook = async (req, res) => {
    try {
        const { bookId, rentalDays, paymentMethodId } = req.body;

        if (!bookId || !rentalDays || !paymentMethodId) {
            return res.status(400).json({ error: 'bookId, rentalDays, and paymentMethodId are required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('UserID',          sql.INT, req.session.userId)
            .input('BookID',          sql.INT, bookId)
            .input('RentalDays',      sql.INT, rentalDays)
            .input('PaymentMethodID', sql.INT, paymentMethodId)
            .execute('sp_RentEbook');

        res.status(201).json({ message: 'Ebook rented successfully.' });
    } catch (error) {
        console.error('Rent ebook error:', error);
        res.status(500).json({ error: 'Failed to rent ebook.' });
    }
};

module.exports = { buyBook, rentBook };

