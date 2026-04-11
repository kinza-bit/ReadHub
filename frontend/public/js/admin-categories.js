document.addEventListener('DOMContentLoaded', () => {
    const categoryTableBody = document.getElementById('category-table-body');
    const categoryModal = document.getElementById('category-modal');
    const categoryForm = document.getElementById('category-form');
    const btnAddCategory = document.getElementById('btn-add-category');
    const logoutBtn = document.getElementById('logout-btn');
    const alertContainer = document.getElementById('alert-container');

    let allCategories = [];

    // Initialize
    checkAuth();
    loadCategories();

    // --- Authentication ---
    async function checkAuth() {
        try {
            const response = await fetch('/api/session');
            const data = await response.json();

            if (!data.isAuthenticated || data.user.role !== 'Admin') {
                window.location.href = '/admin-login.html';
            } else {
                document.getElementById('admin-name').textContent = data.user.name;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/admin-login.html';
        }
    }

    logoutBtn.addEventListener('click', async () => {
        const response = await fetch('/api/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/index.html';
        }
    });

    // --- Loading Categories ---
    async function loadCategories() {
        try {
            // Use the with-counts endpoint for the admin view
            const response = await fetch('/api/admin/categories/with-counts');
            if (!response.ok) throw new Error('Failed to fetch categories');

            allCategories = await response.json();
            renderTable(allCategories);
        } catch (error) {
            console.error('Error loading categories:', error);
            showAlert('danger', 'Failed to load categories.');
        }
    }

    function renderTable(categories) {
        if (!categories.length) {
            categoryTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">No categories found.</td></tr>`;
            return;
        }

        categoryTableBody.innerHTML = categories.map(cat => `
            <tr>
                <td>#${cat.CategoryID}</td>
                <td style="font-weight: 600;">${cat.CategoryName}</td>
                <td style="color: var(--text-muted);">${cat.CategoryDescription || 'No description provided'}</td>
                <td><span class="badge badge-primary">${cat.BookCount} Books</span></td>
                <td class="action-btns">
                    <button class="btn btn-sm btn-secondary edit-btn" data-id="${cat.CategoryID}">Edit</button>
                    ${cat.BookCount === 0 
                        ? `<button class="btn btn-sm btn-danger delete-btn" data-id="${cat.CategoryID}">Delete</button>` 
                        : `<button class="btn btn-sm outline delete-btn disabled" disabled title="Cannot delete category with books in it.">Delete</button>`
                    }
                </td>
            </tr>
        `).join('');

        // Action Buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.id)));
        });

        document.querySelectorAll('.delete-btn:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', () => deleteCategory(parseInt(btn.dataset.id)));
        });
    }

    // --- Add / Edit Category ---
    btnAddCategory.addEventListener('click', () => {
        categoryForm.reset();
        document.getElementById('edit-category-id').value = '';
        document.getElementById('category-modal-title').textContent = 'Add New Category';
        categoryModal.classList.add('active');
    });

    function openEditModal(categoryId) {
        const cat = allCategories.find(c => c.CategoryID === categoryId);
        if (!cat) return;

        document.getElementById('edit-category-id').value = cat.CategoryID;
        document.getElementById('category-name').value = cat.CategoryName;
        document.getElementById('category-description').value = cat.CategoryDescription || '';
        
        document.getElementById('category-modal-title').textContent = 'Edit Category';
        categoryModal.classList.add('active');
    }

    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const categoryId = document.getElementById('edit-category-id').value;
        const payload = {
            name: document.getElementById('category-name').value,
            description: document.getElementById('category-description').value
        };

        try {
            let url = '/api/admin/categories';
            let method = 'POST';

            if (categoryId) {
                url = `/api/admin/categories/${categoryId}`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showAlert('success', categoryId ? 'Category updated successfully!' : 'Category added successfully!');
                closeModal();
                loadCategories();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to finish operation');
            }
        } catch (error) {
            showAlert('error', error.message);
        }
    });

    // --- Delete Category ---
    async function deleteCategory(categoryId) {
        if (!confirm('Are you sure you want to delete this category? Proceeding will permanently delete it.')) return;

        try {
            const response = await fetch(`/api/admin/categories/${categoryId}`, { method: 'DELETE' });
            if (response.ok) {
                showAlert('success', 'Category deleted successfully.');
                loadCategories();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete category');
            }
        } catch (error) {
            showAlert('error', error.message);
        }
    }

    // --- Helpers ---
    function closeModal() {
        categoryModal.classList.remove('active');
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    window.addEventListener('click', (e) => {
        if (e.target === categoryModal) closeModal();
    });

    function showAlert(type, message) {
        alertContainer.className = `alert alert-${type === 'success' ? 'success' : 'error'}`;
        alertContainer.textContent = message;
        alertContainer.style.display = 'block';
        setTimeout(() => { alertContainer.style.display = 'none'; }, 3000);
    }
});
