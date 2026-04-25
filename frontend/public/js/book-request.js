/**
 * js/book-request.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Logic for submitting a book request (US-3.4.1).
 */

document.addEventListener('DOMContentLoaded', () => {
    const requestForm = document.getElementById('book-request-form');
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');

    const showToast = (message, isError = false) => {
        toastMsg.textContent = message;
        toast.className = `rh-toast show ${isError ? 'error' : 'success'}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    };

    const myRequestsTable = document.getElementById('my-requests-table-body');

    const fetchMyRequests = async () => {
        try {
            const res = await fetch('/api/my-book-requests');
            const data = await res.json();

            if (!res.ok) {
                myRequestsTable.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--error);">${data.error || 'Failed to load requests.'}</td></tr>`;
                return;
            }

            if (data.length === 0) {
                myRequestsTable.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem;">You haven't made any requests yet.</td></tr>`;
                return;
            }

            myRequestsTable.innerHTML = data.map(req => `
                <tr>
                    <td><strong>${req.title}</strong></td>
                    <td>${req.author}</td>
                    <td>${new Date(req.created_at).toLocaleDateString()}</td>
                    <td>
                        <span class="status-badge status-${req.status.toLowerCase()}">${req.status}</span>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Fetch requests error:', error);
            myRequestsTable.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--error);">Network error.</td></tr>`;
        }
    };

    if (requestForm) {
        requestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('title').value.trim();
            const author = document.getElementById('author').value.trim();
            const notes = document.getElementById('notes').value.trim();

            if (!title || !author) {
                showToast('Please fill in all required fields.', true);
                return;
            }

            const btn = document.getElementById('submit-btn');
            const originalText = btn.textContent;
            btn.textContent = 'Submitting...';
            btn.disabled = true;

            try {
                const res = await fetch('/api/book-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, author, notes })
                });

                const data = await res.json();

                if (!res.ok) {
                    showToast(data.error || 'Failed to submit request.', true);
                    return;
                }

                showToast('Request submitted successfully!', false);
                requestForm.reset();
                
                // Refresh list
                fetchMyRequests();

            } catch (error) {
                console.error('Request error:', error);
                showToast('Network error. Please try again.', true);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    fetchMyRequests();
});
