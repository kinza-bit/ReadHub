/**
 * controllers/adminUserController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all admin-facing user management operations:
 *   - Listing / filtering users
 *   - Viewing a single user's details
 *   - Updating user fields
 *   - Soft-deleting (toggling active status)
 *   - Dashboard summary statistics
 * All routes in this controller require an active Admin session (enforced
 * at the route level via requireAdminAuth).
 */

const { sql, poolPromise } = require('../db');

// ─── GET /api/admin/users — list users with optional filter/sort ───────────────
const getAllUsers = async (req, res) => {
    console.log('GET /api/admin/users hit');
    try {
        const { search, sortBy, sortOrder, role } = req.query;
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('Search',    sql.NVARCHAR, search    || null)
            .input('Role',      sql.NVARCHAR, role      || null)
            .input('SortBy',    sql.NVARCHAR, sortBy    || 'UserID')
            .input('SortOrder', sql.NVARCHAR, sortOrder || 'ASC')
            .execute('sp_GetUsersFiltered');

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
};

// ─── GET /api/admin/users/:id — single user detail ───────────────────────────
const getUserDetails = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.INT, req.params.id)
            .execute('sp_GetUserDetails');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ error: 'Failed to fetch user details.' });
    }
};

// ─── PUT /api/admin/users/:id — update user fields ───────────────────────────
const updateUser = async (req, res) => {
    try {
        const { fullName, email, phoneNumber, city, roleId, isActive } = req.body;
        const pool = await poolPromise;

        await pool.request()
            .input('UserID',      sql.INT,      req.params.id)
            .input('FullName',    sql.NVARCHAR,  fullName)
            .input('Email',       sql.NVARCHAR,  email)
            .input('PhoneNumber', sql.NVARCHAR,  phoneNumber)
            .input('City',        sql.NVARCHAR,  city)
            .input('RoleID',      sql.INT,       roleId)
            .input('IsActive',    sql.BIT,       isActive ? 1 : 0)
            .execute('sp_UpdateUserDetails');

        res.json({ message: 'User updated successfully.' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user.' });
    }
};

// ─── DELETE /api/admin/users/:id — soft delete (toggle active status) ────────
const toggleUserStatus = async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.INT, req.params.id)
            .execute('sp_ToggleUserStatus');

        res.json({ message: 'User status toggled successfully.' });
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ error: 'Failed to toggle user status.' });
    }
};

// ─── GET /api/admin/stats — dashboard summary counts ─────────────────────────
const getStats = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request().query(`
            SELECT
                (SELECT COUNT(*) FROM Users)  AS TotalUsers,
                (SELECT COUNT(*) FROM Books)  AS TotalBooks,
                (SELECT COUNT(*) FROM Orders) AS TotalOrders
        `);

        const row = result.recordset[0];
        res.json({
            totalUsers:  row.TotalUsers  || 0,
            totalBooks:  row.TotalBooks  || 0,
            totalOrders: row.TotalOrders || 0,
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
};

module.exports = { getAllUsers, getUserDetails, updateUser, toggleUserStatus, getStats };
