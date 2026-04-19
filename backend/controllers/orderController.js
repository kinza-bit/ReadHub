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

// ─── GET /api/ebook/download/:bookId — retrieve PDF URL if access is valid ────
const downloadEbook = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('BookID', sql.INT, req.params.bookId)
            .execute('sp_DownloadEbook');

        if (result.recordset.length === 0 || !result.recordset[0].PdfURL) {
            return res.status(403).json({ error: 'Access denied. Purchase or rent this ebook first.' });
        }

        res.json({ pdfUrl: result.recordset[0].PdfURL });
    } catch (error) {
        console.error('Ebook download error:', error);
        res.status(500).json({ error: 'Failed to retrieve ebook download link.' });
    }
};

module.exports = { buyBook, rentBook, downloadEbook };
