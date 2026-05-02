// cart.js — Shopping cart management

document.addEventListener('DOMContentLoaded', () => {
    const cartLoading = document.getElementById('cart-loading');
    const cartEmpty = document.getElementById('cart-empty');
    const cartContent = document.getElementById('cart-content');
    const cartItemsList = document.getElementById('cart-items-list');
    const summaryCount = document.getElementById('summary-count');
    const summarySubtotal = document.getElementById('summary-subtotal');
    const summaryTotal = document.getElementById('summary-total');
    const clearCartBtn = document.getElementById('clear-cart-btn');

    loadCart();

    // ── Load Cart ──
    async function loadCart() {
        try {
            const res = await fetch('/api/cart');
            if (!res.ok) throw new Error('Failed');
            const items = await res.json();

            cartLoading.style.display = 'none';

            if (!items.length) {
                cartEmpty.style.display = 'flex';
                cartContent.style.display = 'none';
                return;
            }

            cartEmpty.style.display = 'none';
            cartContent.style.display = 'block';
            renderCart(items);
        } catch (err) {
            console.error('Error loading cart:', err);
            cartLoading.innerHTML = '<p style="color: var(--text-muted);">Failed to load cart.</p>';
        }
    }

    // ── Render Cart Items ──
    function renderCart(items) {
        let totalQty = 0;
        let totalPrice = 0;

        cartItemsList.innerHTML = items.map(item => {
            const price = parseFloat(item.ItemPrice) || 0;
            const lineTotal = price * item.Quantity;
            totalQty += item.Quantity;
            totalPrice += lineTotal;

            const coverImg = item.ImageURL
                ? `<img src="${item.ImageURL}" alt="${item.Title}" class="rh-cart-item-img">`
                : `<div class="rh-cart-item-img rh-cart-item-img--placeholder">
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                   </div>`;

            const formatBadge = item.FormatName === 'Physical'
                ? '<span class="badge badge-success">Physical</span>'
                : item.FormatName === 'Ebook Buy'
                    ? '<span class="badge badge-primary">eBook</span>'
                    : '<span class="badge badge-pending">Rental</span>';

            const stockWarning = item.FormatID === 1 && item.StockLevel < item.Quantity
                ? `<span class="rh-stock-warn">Only ${item.StockLevel} in stock</span>` : '';

            const isEbook = item.FormatID === 2 || item.FormatID === 3;
            const qtyControl = isEbook 
                ? `<div class="rh-qty-control" style="opacity: 0.6; pointer-events: none;">
                     <span class="rh-qty-value">${item.Quantity}</span>
                   </div>`
                : `<div class="rh-qty-control">
                     <button class="rh-qty-btn" onclick="updateQty(${item.CartItemID}, ${item.Quantity - 1})" ${item.Quantity <= 1 ? 'disabled' : ''}>−</button>
                     <span class="rh-qty-value">${item.Quantity}</span>
                     <button class="rh-qty-btn" onclick="updateQty(${item.CartItemID}, ${item.Quantity + 1})">+</button>
                   </div>`;

            return `
                <div class="rh-cart-item glass" data-id="${item.CartItemID}">
                    ${coverImg}
                    <div class="rh-cart-item-info">
                        <h4>${item.Title}</h4>
                        <p class="rh-cart-item-author">by ${item.Author}</p>
                        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                            ${formatBadge}
                            ${item.RentalDays ? `<span class="badge badge-pending">${item.RentalDays} days</span>` : ''}
                            ${stockWarning}
                        </div>
                    </div>
                    <div class="rh-cart-item-controls">
                        ${qtyControl}
                        <div class="rh-cart-item-price">PKR ${lineTotal.toLocaleString()}</div>
                        <button class="rh-cart-remove-btn" onclick="removeItem(${item.CartItemID})" title="Remove item">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>`;
        }).join('');

        summaryCount.textContent = totalQty;
        summarySubtotal.textContent = `PKR ${totalPrice.toLocaleString()}`;
        summaryTotal.textContent = `PKR ${totalPrice.toLocaleString()}`;
    }

    // ── Update Quantity ──
    window.updateQty = async (cartItemId, newQty) => {
        if (newQty < 1) return;
        try {
            const res = await fetch(`/api/cart/${cartItemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: newQty })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            loadCart();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // ── Remove Item ──
    window.removeItem = async (cartItemId) => {
        try {
            const res = await fetch(`/api/cart/${cartItemId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');
            showToast('Item removed from cart.', 'success');
            loadCart();
        } catch (err) {
            showToast('Failed to remove item.', 'error');
        }
    };

    // ── Clear Cart ──
    clearCartBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear your entire cart?')) return;
        try {
            const res = await fetch('/api/cart/clear', { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');
            showToast('Cart cleared.', 'success');
            loadCart();
        } catch (err) {
            showToast('Failed to clear cart.', 'error');
        }
    });

    // ── Toast ──
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast-notification');
        const toastMsg = document.getElementById('toast-message');
        toastMsg.textContent = message;
        toast.className = `rh-toast rh-toast--${type} rh-toast--visible`;
        setTimeout(() => toast.classList.remove('rh-toast--visible'), 3500);
    }
});
