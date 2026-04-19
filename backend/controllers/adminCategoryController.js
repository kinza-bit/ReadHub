/**
 * controllers/adminCategoryController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles admin-facing category management:
 *   - Listing all categories (simple list for dropdowns)
 *   - Adding, updating, and deleting categories
 * All routes require an active Admin session (enforced at the route level).
 */

const { sql, poolPromise } = require('../db');

// ─── GET /api/admin/categories — list all categories ─────────────────────────
const getCategories = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().execute('sp_GetAllCategories');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching categories (admin):', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
};

// ─── POST /api/admin/categories — create a new category ──────────────────────
const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Category name is required.' });

        const pool = await poolPromise;
        await pool.request()
            .input('CategoryName',        sql.NVarChar, name)
            .input('CategoryDescription', sql.NVarChar, description || null)
            .execute('sp_AddCategory');

        res.status(201).json({ message: 'Category added successfully.' });
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ error: 'Failed to add category.' });
    }
};

// ─── PUT /api/admin/categories/:id — update an existing category ──────────────
const updateCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Category name is required.' });

        const pool = await poolPromise;
        await pool.request()
            .input('CategoryID',          sql.INT,      req.params.id)
            .input('CategoryName',        sql.NVarChar, name)
            .input('CategoryDescription', sql.NVarChar, description || null)
            .execute('sp_UpdateCategory');

        res.json({ message: 'Category updated successfully.' });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category.' });
    }
};

// ─── DELETE /api/admin/categories/:id — delete a category (blocks if books exist)
const deleteCategory = async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('CategoryID', sql.INT, req.params.id)
            .execute('sp_DeleteCategory');

        res.json({ message: 'Category deleted successfully.' });
    } catch (error) {
        if (error.number === 50001) {
            return res.status(409).json({ error: 'Cannot delete a category that still contains books.' });
        }
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category.' });
    }
};

module.exports = { getCategories, addCategory, updateCategory, deleteCategory };
