/**
 * controllers/adminOrderController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles admin-facing order management:
 *   - Viewing all orders with search/filter
 *   - Viewing single order detail
 *   - Updating order status (Pending → Processing → Shipped → Delivered)
 *   - Updating payment status (Pending/Completed/Failed)
 *   - Cancelling/Refunding orders
 *   - Getting status dropdown values
 * All routes require an active Admin session (enforced at route level).
 */

const { sql, poolPromise } = require('../db');

// ─── GET /api/admin/orders — list all orders with optional filters ────────────
const getAllOrders = async (req, res) => {
    try {
        const { search, type, status, payment, dateFrom, dateTo } = req.query;

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('Search',        sql.NVarChar, search   || null)
            .input('OrderType',     sql.NVarChar, type     || null)
            .input('StatusFilter',  sql.NVarChar, status   || null)
            .input('PaymentFilter', sql.NVarChar, payment  || null)
            .input('DateFrom',      sql.DateTime2, dateFrom ? new Date(dateFrom) : null)
            .input('DateTo',        sql.DateTime2, dateTo   ? new Date(dateTo)   : null)
            .execute('sp_AdminGetAllOrders');

        res.json(result.recordset);
    } catch (error) {
        console.error('Admin get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders.' });
    }
};

// ─── GET /api/admin/orders/:id — single order detail ──────────────────────────
const getOrderDetail = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('OrderID', sql.INT, req.params.id)
            .execute('sp_AdminGetOrderDetail');

        const orderHeader = result.recordsets[0]?.[0];
        if (!orderHeader) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        const orderItems = result.recordsets[1] || [];

        res.json({
            ...orderHeader,
            items: orderItems
        });
    } catch (error) {
        console.error('Admin get order detail error:', error);
        res.status(500).json({ error: 'Failed to fetch order details.' });
    }
};

// ─── PUT /api/admin/orders/:id/status — update order status ──────────────────
const updateOrderStatus = async (req, res) => {
    try {
        const { statusId } = req.body;
        if (!statusId) {
            return res.status(400).json({ error: 'statusId is required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('OrderID',  sql.INT, req.params.id)
            .input('StatusID', sql.INT, statusId)
            .execute('sp_AdminUpdateOrderStatus');

        res.json({ message: 'Order status updated.' });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Failed to update order status.' });
    }
};

// ─── PUT /api/admin/orders/:id/payment — update payment status ───────────────
const updatePaymentStatus = async (req, res) => {
    try {
        const { paymentStatusId } = req.body;
        if (!paymentStatusId) {
            return res.status(400).json({ error: 'paymentStatusId is required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('OrderID',         sql.INT, req.params.id)
            .input('PaymentStatusID', sql.INT, paymentStatusId)
            .execute('sp_AdminUpdatePaymentStatus');

        res.json({ message: 'Payment status updated.' });
    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(500).json({ error: 'Failed to update payment status.' });
    }
};

// ─── GET /api/admin/orders/statuses — order status dropdown values ────────────
const getOrderStatuses = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request().execute('sp_GetOrderStatuses');
        res.json(result.recordset);
    } catch (error) {
        console.error('Get order statuses error:', error);
        res.status(500).json({ error: 'Failed to fetch order statuses.' });
    }
};

// ─── GET /api/admin/orders/payment-statuses — payment status dropdown values ──
const getPaymentStatuses = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request().execute('sp_GetPaymentStatuses');
        res.json(result.recordset);
    } catch (error) {
        console.error('Get payment statuses error:', error);
        res.status(500).json({ error: 'Failed to fetch payment statuses.' });
    }
};

module.exports = {
    getAllOrders, getOrderDetail,
    updateOrderStatus, updatePaymentStatus,
    getOrderStatuses, getPaymentStatuses
};
