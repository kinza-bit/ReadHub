/**
 * admin-categories.js — Category Management Page Logic
 * Handles: Load/render categories with book counts,
 *          Add/Edit/Delete flows, guard against deleting non-empty categories
 */
document.addEventListener('DOMContentLoaded', () => {
    // ─── DOM REFS ─────────────────────────────────────────────────
    const categoriesContainer = document.getElementById('categories-container');
    const addForm             = document.getElementById('add-category-form');
    const newNameInput        = document.getElementById('new-category-name');
    const newDescInput        = document.getElementById('new-category-desc');

    // Edit modal
    const categoryModal       = document.getElementById('category-modal');
    const editForm            = document.getElementById('edit-category-form');
    const editIdField         = document.getElementById('edit-category-id');
    const editNameField       = document.getElementById('edit-category-name');
    const editDescField       = document.getElementById('edit-category-description');
    const closeModalBtns      = categoryModal.querySelectorAll('.close-modal');

    // Delete dialog
    const deleteConfirm       = document.getElementById('delete-confirm');
    const deleteMessage       = document.getElementById('delete-confirm-message');
    const btnConfirmDel       = document.getElementById('btn-confirm-delete');
    const btnCancelDel        = document.getElementById('btn-cancel-delete');

    // Sidebar
    const hamburger = document.getElementById('hamburger-menu');
    const closeBtn  = document.getElementById('sidebar-close');
    const sidebar   = document.getElementById('sidebar');
    const overlay   = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
    if (hamburger) hamburger.addEventListener('click', toggleSidebar);
    if (closeBtn)  closeBtn.addEventListener('click', toggleSidebar);
    if (overlay)   overlay.addEventListener('click', toggleSidebar);

    // ─── STATE ────────────────────────────────────────────────────
    let allCategories = [];
    let deleteCatId   = null;

    // ─── TOAST HELPER ─────────────────────────────────────────────
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;
        container.appendChild(toast);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        });

        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('toast-exit');
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }

    // ─── ESCAPE HTML ──────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── LOAD CATEGORIES ──────────────────────────────────────────
    async function loadCategories() {
        try {
            const res = await fetch('/api/admin/categories/with-counts');
            if (!res.ok) throw new Error('Failed');
            allCategories = await res.json();
            renderCategories();
        } catch (err) {
            console.error('Load categories error:', err);
            categoriesContainer.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-title">Failed to load categories</div>
                    <p>Please check your connection and try again.</p>
                </div>`;
        }
    }

    // ─── RENDER CATEGORIES ────────────────────────────────────────
    function renderCategories() {
        if (!allCategories || allCategories.length === 0) {
            categoriesContainer.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">🏷️</div>
                    <div class="empty-state-title">No categories yet</div>
                    <p>Create your first category using the form above.</p>
                </div>`;
            return;
        }

        categoriesContainer.innerHTML = allCategories.map(cat => {
            const bookWord = cat.BookCount === 1 ? 'book' : 'books';
            const canDelete = cat.BookCount === 0;

            return `
                <div class="category-card">
                    <div class="category-card-header">
                        <span class="category-card-name">${escapeHtml(cat.CategoryName)}</span>
                        <span class="category-card-count">${cat.BookCount} ${bookWord}</span>
                    </div>
                    ${cat.CategoryDescription
                        ? `<p class="category-card-desc">${escapeHtml(cat.CategoryDescription)}</p>`
                        : `<p class="category-card-desc" style="font-style: italic; opacity: 0.6;">No description</p>`
                    }
                    <div class="category-card-actions">
                        <button class="btn btn-secondary btn-sm" onclick="editCategory(${cat.CategoryID})">✏️ Rename</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteCategory(${cat.CategoryID}, '${escapeHtml(cat.CategoryName).replace(/'/g, "\\'")}', ${cat.BookCount})"
                            ${!canDelete ? 'title="Cannot delete — category has books"' : 'title="Delete this category"'}>
                            🗑️ Delete
                        </button>
                    </div>
                </div>`;
        }).join('');
    }

    // ─── ADD CATEGORY ─────────────────────────────────────────────
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = newNameInput.value.trim();
        const description = newDescInput.value.trim();

        if (!name) {
            showToast('Category name is required.', 'error');
            return;
        }

        try {
            const res = await fetch('/api/admin/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description: description || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add category.');

            showToast('Category added successfully!');
            addForm.reset();
            await loadCategories();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // ─── EDIT CATEGORY ────────────────────────────────────────────
    window.editCategory = function (catId) {
        const cat = allCategories.find(c => c.CategoryID === catId);
        if (!cat) return;

        editIdField.value   = cat.CategoryID;
        editNameField.value = cat.CategoryName;
        editDescField.value = cat.CategoryDescription || '';
        categoryModal.classList.add('active');
    };

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => categoryModal.classList.remove('active'));
    });
    categoryModal.addEventListener('click', (e) => {
        if (e.target === categoryModal) categoryModal.classList.remove('active');
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = editIdField.value;
        const name = editNameField.value.trim();
        const description = editDescField.value.trim();

        if (!name) {
            showToast('Category name is required.', 'error');
            return;
        }

        try {
            const res = await fetch(`/api/admin/categories/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description: description || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update category.');

            showToast('Category updated successfully!');
            categoryModal.classList.remove('active');
            await loadCategories();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // ─── DELETE CATEGORY ──────────────────────────────────────────
    window.deleteCategory = function (catId, catName, bookCount) {
        if (bookCount > 0) {
            showToast(`Cannot delete "${catName}" — it still has ${bookCount} book(s). Move or delete them first.`, 'error');
            return;
        }

        deleteCatId = catId;
        deleteMessage.textContent = `Are you sure you want to delete the category "${catName}"? This action cannot be undone.`;
        deleteConfirm.classList.add('active');
    };

    btnConfirmDel.addEventListener('click', async () => {
        if (!deleteCatId) return;

        try {
            btnConfirmDel.disabled = true;
            btnConfirmDel.textContent = 'Deleting...';

            const res = await fetch(`/api/admin/categories/${deleteCatId}`, { method: 'DELETE' });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to delete category.');

            showToast('Category deleted successfully!');
            deleteConfirm.classList.remove('active');
            await loadCategories();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btnConfirmDel.disabled = false;
            btnConfirmDel.textContent = 'Delete';
            deleteCatId = null;
        }
    });

    btnCancelDel.addEventListener('click', () => {
        deleteConfirm.classList.remove('active');
        deleteCatId = null;
    });

    deleteConfirm.addEventListener('click', (e) => {
        if (e.target === deleteConfirm) {
            deleteConfirm.classList.remove('active');
            deleteCatId = null;
        }
    });

    // ─── INIT ─────────────────────────────────────────────────────
    loadCategories();
});
