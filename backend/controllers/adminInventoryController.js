/**
 * controllers/adminInventoryController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles admin-facing inventory and book request management:
 *   - Viewing full inventory with stock levels
 *   - Restocking (adjusting stock quantity)
 *   - Viewing all user book requests
 * All routes require an active Admin session (enforced at the route level).
 */

const { sql, poolPromise } = require('../db');

// ─── GET /api/admin/inventory — full inventory with stock levels ───────────────
const getInventory = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().execute('sp_GetFullInventory');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: 'Failed to fetch inventory.' });
    }
};

// ─── PUT /api/admin/inventory/:bookId — update stock (restock) ────────────────
const updateStock = async (req, res) => {
    try {
        const { quantityToAdd } = req.body;
        if (quantityToAdd === undefined || quantityToAdd === null) {
            return res.status(400).json({ error: 'quantityToAdd is required.' });
        }

        const pool = await poolPromise;
        await pool.request()
            .input('BookID',        sql.INT, req.params.bookId)
            .input('QuantityToAdd', sql.INT, quantityToAdd)
            .execute('sp_UpdateStockLevel');

        res.json({ message: 'Stock updated successfully.' });
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ error: 'Failed to update stock level.' });
    }
};

// ─── GET /api/admin/requests — all user book requests (admin view) ────────────
const getAllRequests = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().execute('sp_GetAllUserRequests_Admin');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching all requests (admin):', error);
        res.status(500).json({ error: 'Failed to fetch book requests.' });
    }
};

module.exports = { getInventory, updateStock, getAllRequests };
