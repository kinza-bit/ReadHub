// order-history.js — User order history

document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('orders-loading');
    const empty = document.getElementById('orders-empty');
    const list = document.getElementById('orders-list');

    loadOrders();

    async function loadOrders() {
        try {
            const res = await fetch('/api/cart/orders');
            if (!res.ok) throw new Error('Failed');
            const orders = await res.json();

            loading.style.display = 'none';

            if (!orders.length) {
                empty.style.display = 'flex';
                return;
            }

            list.innerHTML = orders.map(order => {
                const date = new Date(order.OrderDate).toLocaleDateString('en-PK', {
                    year: 'numeric', month: 'short', day: 'numeric'
                });
                const statusClass = getStatusClass(order.OrderStatus);
                const paymentClass = order.PaymentStatus === 'Completed' ? 'badge-success'
                    : order.PaymentStatus === 'Failed' ? 'badge-error' : 'badge-pending';

                const itemsHTML = (order.items || []).map(item => {
                    const coverImg = item.ImageURL
                        ? `<img src="${item.ImageURL}" alt="${item.Title}" class="rh-oh-item-img">`
                        : `<div class="rh-oh-item-img rh-oh-item-img--placeholder">📖</div>`;
                    return `
                        <div class="rh-oh-item">
                            ${coverImg}
                            <div class="rh-oh-item-info">
                                <strong>${item.Title}</strong>
                                <small>by ${item.Author} · ${item.FormatName} · Qty: ${item.Quantity}</small>
                            </div>
                            <div class="rh-oh-item-price">PKR ${parseFloat(item.UnitPrice).toLocaleString()}</div>
                        </div>`;
                }).join('');

                return `
                    <div class="rh-oh-card glass">
                        <div class="rh-oh-header" onclick="this.parentElement.classList.toggle('expanded')">
                            <div class="rh-oh-header-left">
                                <div class="rh-oh-order-num">${order.OrderNumber}</div>
                                <div class="rh-oh-date">${date}</div>
                            </div>
                            <div class="rh-oh-header-right">
                                <span class="badge ${statusClass}">${order.OrderStatus}</span>
                                <span class="badge ${paymentClass}">${order.PaymentStatus}</span>
                                <span class="rh-oh-total">PKR ${parseFloat(order.TotalAmount).toLocaleString()}</span>
                                <svg class="rh-oh-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                        </div>
                        <div class="rh-oh-details">
                            <div class="rh-oh-meta">
                                <div><strong>Payment:</strong> ${order.PaymentMethod}</div>
                                <div><strong>Shipping:</strong> ${order.ShippingAddress || 'N/A'}</div>
                            </div>
                            <div class="rh-oh-items">${itemsHTML}</div>
                        </div>
                    </div>`;
            }).join('');
        } catch (err) {
            console.error('Error loading orders:', err);
            loading.innerHTML = '<p style="color: var(--text-muted);">Failed to load orders.</p>';
        }
    }

    function getStatusClass(status) {
        switch (status) {
            case 'Delivered': return 'badge-success';
            case 'Shipped': return 'badge-shipped';
            case 'Processing': return 'badge-pending';
            case 'Cancelled': return 'badge-error';
            case 'Refunded': return 'badge-cancelled';
            default: return 'badge-pending';
        }
    }
});
