/**
 * routes/adminCategories.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin category management routes — all protected by requireAdminAuth.
 */

const router         = require('express').Router();
const adminCategories = require('../controllers/adminCategoryController');
const { requireAdminAuth } = require('../middleware/auth');

router.get('/',    requireAdminAuth, adminCategories.getCategories);
router.post('/',   requireAdminAuth, adminCategories.addCategory);
router.put('/:id', requireAdminAuth, adminCategories.updateCategory);
router.delete('/:id', requireAdminAuth, adminCategories.deleteCategory);

module.exports = router;
