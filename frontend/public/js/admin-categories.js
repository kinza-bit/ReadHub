// admin-categories.js — Category CRUD management for Admin (US-04)

document.addEventListener('DOMContentLoaded', () => {
    const categoriesGrid = document.getElementById('categories-grid');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const categoryModal = document.getElementById('category-modal');
    const categoryForm = document.getElementById('category-form');
    const catModalTitle = document.getElementById('cat-modal-title');
    const deleteCatModal = document.getElementById('delete-cat-modal');
    const confirmDeleteCatBtn = document.getElementById('confirm-delete-cat-btn');

    let categories = [];

    // ── Initialize ──
    initSidebar();
    loadCategories();

    // ── Sidebar Toggle ──
    function initSidebar() {
        const hamburger = document.getElementById('hamburger-menu');
        const closeBtn = document.getElementById('sidebar-close');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        function toggleSidebar() {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        }
        if (hamburger) hamburger.addEventListener('click', toggleSidebar);
        if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
        if (overlay) overlay.addEventListener('click', toggleSidebar);
    }

    // ── Load Categories ──
    async function loadCategories() {
        try {
            const res = await fetch('/api/categories/with-counts');
            if (!res.ok) throw new Error('Failed');
            categories = await res.json();
            renderCategories();
        } catch (err) {
            console.error('Error loading categories:', err);
            categoriesGrid.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--text-muted);">Failed to load categories. Is the database running?</div>`;
        }
    }

    // ── Render Category Cards ──
    function renderCategories() {
        if (!categories.length) {
            categoriesGrid.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--text-muted);">No categories yet. Click "Add Category" to create one.</div>`;
            return;
        }

        categoriesGrid.innerHTML = categories.map(cat => {
            const iconColors = ['#7C3AED', '#D946EF', '#EC4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];
            const color = iconColors[cat.CategoryID % iconColors.length];

            return `
                <div class="rh-cat-card glass">
                    <div class="rh-cat-card-header">
                        <div class="rh-cat-icon" style="background: ${color}20; color: ${color};">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                        </div>
                        <div class="rh-cat-actions">
                            <button class="rh-icon-btn edit-cat-btn" data-id="${cat.CategoryID}" title="Edit">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="rh-icon-btn rh-icon-btn--danger delete-cat-btn" data-id="${cat.CategoryID}" data-name="${cat.Name}" data-count="${cat.BookCount}" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <h3 class="rh-cat-name">${cat.Name}</h3>
                    <p class="rh-cat-desc">${cat.Description}</p>
                    <div class="rh-cat-footer">
                        <span class="rh-cat-count">${cat.BookCount} book${cat.BookCount !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Attach listeners
        document.querySelectorAll('.edit-cat-btn').forEach(btn =>
            btn.addEventListener('click', () => openEditModal(btn.dataset.id))
        );
        document.querySelectorAll('.delete-cat-btn').forEach(btn =>
            btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.name, parseInt(btn.dataset.count)))
        );
    }

    // ── Open Add Modal ──
    addCategoryBtn.addEventListener('click', () => {
        catModalTitle.textContent = 'Add New Category';
        document.getElementById('save-cat-btn').textContent = 'Save Category';
        categoryForm.reset();
        document.getElementById('cat-id').value = '';
        categoryModal.classList.add('active');
    });

    // ── Open Edit Modal ──
    async function openEditModal(catId) {
        const cat = categories.find(c => c.CategoryID == catId);
        if (!cat) return;

        catModalTitle.textContent = 'Edit Category';
        document.getElementById('save-cat-btn').textContent = 'Update Category';
        document.getElementById('cat-id').value = cat.CategoryID;
        document.getElementById('cat-name').value = cat.Name;
        document.getElementById('cat-description').value = cat.Description === 'No description' ? '' : cat.Description;
        categoryModal.classList.add('active');
    }

    // ── Save Category ──
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const catId = document.getElementById('cat-id').value;
        const isEdit = !!catId;

        const payload = {
            name: document.getElementById('cat-name').value.trim(),
            description: document.getElementById('cat-description').value.trim() || null
        };

        if (!payload.name) {
            showToast('Category name is required.', 'error');
            return;
        }

        const saveBtn = document.getElementById('save-cat-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = isEdit ? 'Updating...' : 'Saving...';

        try {
            const url = isEdit ? `/api/admin/categories/${catId}` : '/api/admin/categories';
            const method = isEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed');
            }

            closeModal(categoryModal);
            showToast(isEdit ? 'Category updated successfully!' : 'Category added successfully!', 'success');
            loadCategories();
        } catch (err) {
            showToast(err.message || 'Failed to save category.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Update Category' : 'Save Category';
        }
    });

    // ── Open Delete Modal ──
    function openDeleteModal(catId, catName, bookCount) {
        document.getElementById('delete-cat-id').value = catId;
        const msgEl = document.getElementById('delete-cat-message');
        if (bookCount > 0) {
            msgEl.innerHTML = `<strong style="color: var(--error);">"${catName}"</strong> has <strong>${bookCount}</strong> book(s). You must remove or reassign all books before deleting this category.`;
        } else {
            msgEl.innerHTML = `This will permanently delete <strong>"${catName}"</strong>. This action cannot be undone.`;
        }
        deleteCatModal.classList.add('active');
    }

    // ── Confirm Delete ──
    confirmDeleteCatBtn.addEventListener('click', async () => {
        const catId = document.getElementById('delete-cat-id').value;
        confirmDeleteCatBtn.disabled = true;
        confirmDeleteCatBtn.textContent = 'Deleting...';

        try {
            const res = await fetch(`/api/admin/categories/${catId}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed');
            }

            closeModal(deleteCatModal);
            showToast('Category deleted successfully!', 'success');
            loadCategories();
        } catch (err) {
            showToast(err.message || 'Failed to delete category.', 'error');
        } finally {
            confirmDeleteCatBtn.disabled = false;
            confirmDeleteCatBtn.textContent = 'Yes, Delete';
        }
    });

    // ── Modal Helpers ──
    function closeModal(modal) {
        modal.classList.remove('active');
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(categoryModal);
            closeModal(deleteCatModal);
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === categoryModal) closeModal(categoryModal);
        if (e.target === deleteCatModal) closeModal(deleteCatModal);
    });

    // ── Toast ──
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast-notification');
        const toastMsg = document.getElementById('toast-message');
        toastMsg.textContent = message;
        toast.className = `rh-toast rh-toast--${type} rh-toast--visible`;
        setTimeout(() => {
            toast.classList.remove('rh-toast--visible');
        }, 3500);
    }
});
