/**
 * controllers/bookRequestController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles book requests (US-3.4):
 *   - Customer submission
 *   - Admin management (list, update status, delete)
 */

const { sql, poolPromise } = require('../db');

// ─── POST /api/book-request — Submit a new book request (User) ───────────────
const submitRequest = async (req, res) => {
    try {
        const { title, author, notes } = req.body;
        
        if (!title || !author) {
            return res.status(400).json({ error: 'Book title and author name are required.' });
        }

        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.Int, req.session.userId)
            .input('Title',  sql.NVarChar, title)
            .input('Author', sql.NVarChar, author)
            .input('Notes',  sql.NVarChar, notes || null)
            .query(`
                INSERT INTO book_requests (user_id, title, author, notes)
                VALUES (@UserID, @Title, @Author, @Notes)
            `);

        res.status(201).json({ message: 'Book request submitted successfully. Thank you!' });
    } catch (error) {
        console.error('Submit request error:', error);
        res.status(500).json({ error: 'Failed to submit book request.' });
    }
};

// ─── GET /api/admin/book-requests — Fetch all requests (Admin) ───────────────
const getAllRequests = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT br.id, br.user_id, br.title, br.author, br.notes, br.status, br.created_at,
                   u.Username, u.Email
            FROM book_requests br
            JOIN Users u ON br.user_id = u.UserID
            ORDER BY br.created_at DESC
        `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Fetch all requests error:', error);
        res.status(500).json({ error: 'Failed to fetch book requests.' });
    }
};

// ─── PUT /api/admin/book-requests/:id — Update request status (Admin) ─────────
const updateRequestStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['Pending', 'Reviewed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be Pending or Reviewed.' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('ID',     sql.Int,      id)
            .input('Status', sql.NVarChar, status)
            .query('UPDATE book_requests SET status = @Status WHERE id = @ID');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Book request not found.' });
        }

        res.json({ message: `Request marked as ${status}.` });
    } catch (error) {
        console.error('Update request error:', error);
        res.status(500).json({ error: 'Failed to update book request.' });
    }
};

// ─── DELETE /api/admin/book-requests/:id — Remove request (Admin) ──────────────
const deleteRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('ID', sql.Int, id)
            .query('DELETE FROM book_requests WHERE id = @ID');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Book request not found.' });
        }

        res.json({ message: 'Book request deleted successfully.' });
    } catch (error) {
        console.error('Delete request error:', error);
        res.status(500).json({ error: 'Failed to delete book request.' });
    }
};

// ─── GET /api/my-book-requests — Fetch current user's requests ────────────────
const getUserRequests = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, req.session.userId)
            .query(`
                SELECT id, title, author, notes, status, created_at
                FROM book_requests
                WHERE user_id = @UserID
                ORDER BY created_at DESC
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Fetch user requests error:', error);
        res.status(500).json({ error: 'Failed to fetch your book requests.' });
    }
};

module.exports = {
    submitRequest,
    getAllRequests,
    updateRequestStatus,
    deleteRequest,
    getUserRequests
};
