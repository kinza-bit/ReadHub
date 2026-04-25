// admin-orders.js — Admin order management

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('orders-table-body');
    const searchInput = document.getElementById('order-search');
    const typeFilter = document.getElementById('type-filter');
    const statusFilter = document.getElementById('status-filter');
    const paymentFilter = document.getElementById('payment-filter');
    const modal = document.getElementById('order-detail-modal');
    const modalBody = document.getElementById('modal-order-body');
    const alertContainer = document.getElementById('alert-container');

    // Sidebar toggle
    const hamburger = document.getElementById('hamburger-menu');
    const closeBtn = document.getElementById('sidebar-close');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    function toggleSidebar() { sidebar.classList.toggle('active'); overlay.classList.toggle('active'); }
    if (hamburger) hamburger.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    loadOrders();

    // ── Load Orders ──
    async function loadOrders() {
        try {
            const url = new URL('/api/admin/orders', window.location.origin);
            if (searchInput.value) url.searchParams.append('search', searchInput.value);
            if (typeFilter.value) url.searchParams.append('type', typeFilter.value);
            if (statusFilter.value) url.searchParams.append('status', statusFilter.value);
            if (paymentFilter.value) url.searchParams.append('payment', paymentFilter.value);

            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed');
            const orders = await res.json();
            renderTable(orders);
        } catch (err) {
            console.error('Error loading orders:', err);
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;">Failed to load orders.</td></tr>';
        }
    }

    function renderTable(orders) {
        if (!orders.length) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;">No orders found.</td></tr>';
            return;
        }

        tableBody.innerHTML = orders.map(o => {
            const date = new Date(o.OrderDate).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
            const typeBadge = o.OrderType === 'Physical'
                ? '<span class="badge badge-success">Physical</span>'
                : o.OrderType === 'Ebook'
                    ? '<span class="badge badge-primary">Ebook</span>'
                    : '<span class="badge badge-pending">Mixed</span>';
            const statusClass = getStatusBadge(o.OrderStatus);
            const payClass = o.PaymentStatus === 'Completed' ? 'badge-success' : o.PaymentStatus === 'Failed' ? 'badge-error' : 'badge-pending';

            return `<tr>
                <td><strong>${o.OrderNumber}</strong></td>
                <td>${o.CustomerName}<br><small style="color:var(--text-muted)">${o.CustomerEmail}</small></td>
                <td>${typeBadge}</td>
                <td>${o.ItemCount}</td>
                <td>PKR ${parseFloat(o.TotalAmount).toLocaleString()}</td>
                <td><span class="badge ${statusClass}">${o.OrderStatus}</span></td>
                <td><span class="badge ${payClass}">${o.PaymentStatus}</span></td>
                <td>${date}</td>
                <td class="action-btns">
                    <button class="btn btn-sm btn-secondary view-btn" data-id="${o.OrderID}">View</button>
                </td>
            </tr>`;
        }).join('');

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => openOrderDetail(btn.dataset.id));
        });
    }

    // ── Order Detail Modal ──
    async function openOrderDetail(orderId) {
        try {
            const res = await fetch(`/api/admin/orders/${orderId}`);
            if (!res.ok) throw new Error('Failed');
            const order = await res.json();

            document.getElementById('modal-order-title').textContent = `Order: ${order.OrderNumber}`;

            const itemsHTML = (order.items || []).map(item => {
                const isRental = item.FormatID === 3;
                const dueDateHtml = isRental && item.DueDate 
                    ? `<br><small style="color:var(--color-primary)">Due: ${new Date(item.DueDate).toLocaleDateString()}</small>` 
                    : '';
                
                return `
                <tr>
                    <td>${item.Title}</td>
                    <td>${item.FormatName} ${dueDateHtml}</td>
                    <td>${item.Quantity}</td>
                    <td>PKR ${parseFloat(item.UnitPrice).toLocaleString()}</td>
                    <td>${item.CurrentStock}</td>
                </tr>`;
            }).join('');

            modalBody.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
                    <div><small style="color:var(--text-muted)">Customer</small><p><strong>${order.CustomerName}</strong><br>${order.CustomerEmail}<br>${order.CustomerPhone || 'N/A'}</p></div>
                    <div><small style="color:var(--text-muted)">Shipping</small><p>${order.ShippingAddress || 'N/A'}</p></div>
                    <div><small style="color:var(--text-muted)">Date</small><p>${new Date(order.OrderDate).toLocaleString()}</p></div>
                    <div><small style="color:var(--text-muted)">Total</small><p><strong style="color:var(--primary)">PKR ${parseFloat(order.TotalAmount).toLocaleString()}</strong></p></div>
                </div>
                <div style="display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap;">
                    <div class="form-group" style="flex:1;min-width:200px;">
                        <label>Order Status</label>
                        <select class="form-control" id="modal-order-status">
                            <option value="1" ${order.StatusID===1?'selected':''}>Pending</option>
                            <option value="2" ${order.StatusID===2?'selected':''}>Processing</option>
                            <option value="3" ${order.StatusID===3?'selected':''}>Shipped</option>
                            <option value="4" ${order.StatusID===4?'selected':''}>Delivered</option>
                            <option value="5" ${order.StatusID===5?'selected':''}>Cancelled</option>
                            <option value="6" ${order.StatusID===6?'selected':''}>Refunded</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex:1;min-width:200px;">
                        <label>Payment Status</label>
                        <select class="form-control" id="modal-payment-status">
                            <option value="1" ${order.PaymentStatusID===1?'selected':''}>Pending</option>
                            <option value="2" ${order.PaymentStatusID===2?'selected':''}>Completed</option>
                            <option value="3" ${order.PaymentStatusID===3?'selected':''}>Failed</option>
                        </select>
                    </div>
                </div>
                <div style="display:flex;gap:0.75rem;margin-bottom:1.5rem;">
                    <button class="btn btn-primary btn-sm" id="save-status-btn" style="width:auto;">Save Changes</button>
                </div>
                <h4 style="margin-bottom:0.75rem;">Order Items</h4>
                <div class="admin-table-container" style="border-radius:0.75rem;">
                    <table class="admin-table">
                        <thead><tr><th>Book</th><th>Format</th><th>Qty</th><th>Price</th><th>Stock</th></tr></thead>
                        <tbody>${itemsHTML}</tbody>
                    </table>
                </div>`;

            modal.classList.add('active');

            document.getElementById('save-status-btn').addEventListener('click', async () => {
                try {
                    const statusId = parseInt(document.getElementById('modal-order-status').value);
                    const payStatusId = parseInt(document.getElementById('modal-payment-status').value);

                    await fetch(`/api/admin/orders/${orderId}/status`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ statusId })
                    });
                    await fetch(`/api/admin/orders/${orderId}/payment`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paymentStatusId: payStatusId })
                    });

                    showAlert('success', 'Order updated successfully!');
                    closeModal();
                    loadOrders();
                } catch (err) {
                    showAlert('error', 'Failed to update order.');
                }
            });
        } catch (err) {
            console.error('Error loading order detail:', err);
            showAlert('error', 'Failed to load order details.');
        }
    }

    // ── Helpers ──
    function closeModal() { modal.classList.remove('active'); }
    document.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', closeModal));
    window.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    function getStatusBadge(status) {
        switch (status) {
            case 'Delivered': return 'badge-success';
            case 'Shipped': return 'badge-shipped';
            case 'Processing': return 'badge-pending';
            case 'Cancelled': return 'badge-error';
            case 'Refunded': return 'badge-cancelled';
            default: return 'badge-pending';
        }
    }

    function showAlert(type, message) {
        alertContainer.className = `alert alert-${type === 'success' ? 'success' : 'error'}`;
        alertContainer.textContent = message;
        alertContainer.style.display = 'block';
        setTimeout(() => alertContainer.style.display = 'none', 3000);
    }

    // ── Filter listeners ──
    let searchTimeout;
    searchInput.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(loadOrders, 500); });
    typeFilter.addEventListener('change', loadOrders);
    statusFilter.addEventListener('change', loadOrders);
    paymentFilter.addEventListener('change', loadOrders);
});
