/**
 * js/admin-book-requests.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Logic for admin book request management (US-3.4.2).
 */

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('requests-table-body');
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');

    const showToast = (message, isError = false) => {
        toastMsg.textContent = message;
        toast.className = `rh-toast show ${isError ? 'error' : 'success'}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    };

    const fetchRequests = async () => {
        try {
            const res = await fetch('/api/admin/book-requests');
            const data = await res.json();

            if (!res.ok) {
                tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444;">${data.error || 'Failed to load requests.'}</td></tr>`;
                return;
            }

            if (data.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem;">No book requests found.</td></tr>`;
                return;
            }

            renderTable(data);
        } catch (error) {
            console.error('Fetch requests error:', error);
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444;">Network error.</td></tr>`;
        }
    };

    const renderTable = (requests) => {
        tableBody.innerHTML = requests.map(req => `
            <tr>
                <td>#${req.id}</td>
                <td>
                    <div style="font-weight: 600;">${req.Username}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${req.Email}</div>
                </td>
                <td><strong>${req.title}</strong></td>
                <td>${req.author}</td>
                <td>
                    <div class="notes-cell" title="${req.notes || 'No notes'}">
                        ${req.notes || '<span style="color: var(--text-muted)">-</span>'}
                    </div>
                </td>
                <td>${new Date(req.created_at).toLocaleDateString()}</td>
                <td>
                    <span class="status-badge status-${req.status.toLowerCase()}">${req.status}</span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm ${req.status === 'Pending' ? 'btn-success' : 'btn-secondary'}" 
                                onclick="updateStatus(${req.id}, '${req.status === 'Pending' ? 'Reviewed' : 'Pending'}')">
                            ${req.status === 'Pending' ? 'Mark Reviewed' : 'Mark Pending'}
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteRequest(${req.id})">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
    };

    window.updateStatus = async (id, status) => {
        try {
            const res = await fetch(`/api/admin/book-requests/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                showToast(`Status updated to ${status}`);
                fetchRequests();
            } else {
                const data = await res.json();
                showToast(data.error || 'Update failed', true);
            }
        } catch (error) {
            showToast('Network error', true);
        }
    };

    window.deleteRequest = async (id) => {
        if (!confirm('Are you sure you want to delete this request?')) return;

        try {
            const res = await fetch(`/api/admin/book-requests/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                showToast('Request deleted');
                fetchRequests();
            } else {
                const data = await res.json();
                showToast(data.error || 'Delete failed', true);
            }
        } catch (error) {
            showToast('Network error', true);
        }
    };

    fetchRequests();
});
