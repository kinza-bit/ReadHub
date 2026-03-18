document.addEventListener('DOMContentLoaded', () => {
    const userTableBody = document.getElementById('user-table-body');
    const userSearch = document.getElementById('user-search');
    const roleFilter = document.getElementById('role-filter');
    const sortBy = document.getElementById('sort-by');
    const editModal = document.getElementById('edit-user-modal');
    const editForm = document.getElementById('edit-user-form');
    const logoutBtn = document.getElementById('logout-btn');
    const alertContainer = document.getElementById('alert-container');

    let allUsers = [];

    // Initialize
    checkAuth();
    loadUsers();

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

    // --- User Loading & Rendering ---
    async function loadUsers() {
        try {
            const searchTerm = userSearch.value;
            const role = roleFilter.value;
            const sortSelection = sortBy.value;

            const url = new URL('/api/admin/users', window.location.origin);
            if (searchTerm) url.searchParams.append('search', searchTerm);
            if (role) url.searchParams.append('role', role);
            if (sortSelection) url.searchParams.append('sortBy', sortSelection);
            url.searchParams.append('sortOrder', 'ASC');

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch users');

            allUsers = await response.json();
            renderTable(allUsers);
        } catch (error) {
            console.error('Error loading users:', error);
            showAlert('danger', 'Failed to load users. Please try again.');
        }
    }

    function renderTable(users) {
        if (!users.length) {
            userTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No users found matching your criteria.</td></tr>`;
            return;
        }

        userTableBody.innerHTML = users.map(user => `
            <tr>
                <td>#${user.UserID}</td>
                <td>${user.FullName}</td>
                <td>${user.Email}</td>
                <td>${user.Username}</td>
                <td><span class="badge ${user.RoleName === 'Admin' ? 'badge-primary' : ''}">${user.RoleName}</span></td>
                <td><span class="badge ${user.IsActive ? 'badge-success' : 'badge-error'}">${user.IsActive ? 'Active' : 'Inactive'}</span></td>
                <td class="action-btns">
                    <button class="btn btn-sm btn-secondary edit-btn" data-id="${user.UserID}">Edit</button>
                    <button class="btn btn-sm ${user.IsActive ? 'btn-danger' : 'btn-primary'} toggle-btn" data-id="${user.UserID}">
                        ${user.IsActive ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            </tr>
        `).join('');

        // Attach event listeners to buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });

        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => toggleUserStatus(btn.dataset.id));
        });
    }

    // --- Actions ---
    async function openEditModal(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`);
            if (!response.ok) throw new Error('Failed to fetch user details');
            const user = await response.json();

            document.getElementById('edit-user-id').value = user.UserID;
            document.getElementById('edit-full-name').value = user.FullName;
            document.getElementById('edit-email').value = user.Email;
            document.getElementById('edit-phone').value = user.PhoneNumber || '';
            document.getElementById('edit-city').value = user.City || '';
            document.getElementById('edit-role').value = user.RoleID;
            document.getElementById('edit-is-active').checked = user.IsActive;

            editModal.classList.add('active');
        } catch (error) {
            console.error('Error fetching user for edit:', error);
            showAlert('error', 'Failed to load user details.');
        }
    }

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('edit-user-id').value;
        const payload = {
            fullName: document.getElementById('edit-full-name').value,
            email: document.getElementById('edit-email').value,
            phoneNumber: document.getElementById('edit-phone').value,
            city: document.getElementById('edit-city').value,
            roleId: parseInt(document.getElementById('edit-role').value),
            isActive: document.getElementById('edit-is-active').checked
        };

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showAlert('success', 'User updated successfully!');
                closeModal();
                loadUsers();
            } else {
                throw new Error('Update failed');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            showAlert('error', 'Failed to update user.');
        }
    });

    async function toggleUserStatus(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
            if (response.ok) {
                showAlert('success', 'User status updated successfully.');
                loadUsers();
            } else {
                throw new Error('Toggle failed');
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            showAlert('error', 'Failed to update user status.');
        }
    }

    // --- Helpers ---
    function closeModal() {
        editModal.classList.remove('active');
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === editModal) closeModal();
    });

    function showAlert(type, message) {
        alertContainer.className = `alert alert-${type === 'success' ? 'success' : 'error'}`;
        alertContainer.textContent = message;
        alertContainer.style.display = 'block';
        setTimeout(() => {
            alertContainer.style.display = 'none';
        }, 3000);
    }

    // --- Search & Filter Listeners ---
    let searchTimeout;
    userSearch.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadUsers, 500); // Debounce search
    });

    roleFilter.addEventListener('change', loadUsers);
    sortBy.addEventListener('change', loadUsers);
});
