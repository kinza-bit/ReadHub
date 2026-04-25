// checkout.js — Multi-step checkout flow

document.addEventListener('DOMContentLoaded', () => {
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');
    const confirmation = document.getElementById('order-confirmation');
    const sidebar = document.getElementById('checkout-sidebar');
    const stepIndicators = [
        document.getElementById('step-1-indicator'),
        document.getElementById('step-2-indicator'),
        document.getElementById('step-3-indicator')
    ];

    let cartItems = [];
    let cartTotal = 0;

    loadCartForCheckout();

    // ── Load Cart Items ──
    async function loadCartForCheckout() {
        try {
            const res = await fetch('/api/cart');
            if (!res.ok) throw new Error('Failed');
            cartItems = await res.json();

            if (!cartItems.length) {
                window.location.href = '/cart.html';
                return;
            }

            cartTotal = cartItems.reduce((sum, item) => {
                return sum + (parseFloat(item.ItemPrice) || 0) * item.Quantity;
            }, 0);

            renderSidebarItems();
            prefillAddress();
        } catch (err) {
            console.error('Error loading cart:', err);
        }
    }

    // ── Pre-fill address from profile ──
    async function prefillAddress() {
        try {
            const res = await fetch('/api/profile');
            if (!res.ok) return;
            const profile = await res.json();
            if (profile.FullName) document.getElementById('shipping-name').value = profile.FullName;
            if (profile.PhoneNumber) document.getElementById('shipping-phone').value = profile.PhoneNumber;
            if (profile.AddressLine1) document.getElementById('shipping-address').value = profile.AddressLine1;
            if (profile.City) document.getElementById('shipping-city').value = profile.City;
        } catch (e) { /* ignore */ }
    }

    // ── Sidebar items ──
    function renderSidebarItems() {
        const list = document.getElementById('checkout-items-list');
        list.innerHTML = cartItems.map(item => `
            <div class="rh-checkout-item">
                <span class="rh-checkout-item-title">${item.Title} <small>×${item.Quantity}</small></span>
                <span class="rh-checkout-item-price">PKR ${((parseFloat(item.ItemPrice) || 0) * item.Quantity).toLocaleString()}</span>
            </div>
        `).join('');
        document.getElementById('checkout-total').textContent = `PKR ${cartTotal.toLocaleString()}`;
    }

    // ── Step Navigation ──
    function setStep(stepNum) {
        [step1, step2, step3].forEach(s => s.style.display = 'none');
        stepIndicators.forEach((ind, i) => {
            ind.classList.toggle('active', i < stepNum);
            ind.classList.toggle('completed', i < stepNum - 1);
        });
        if (stepNum === 1) step1.style.display = 'block';
        if (stepNum === 2) step2.style.display = 'block';
        if (stepNum === 3) { step3.style.display = 'block'; populateReview(); }
    }

    // ── Step 1 → 2: Validate delivery ──
    document.getElementById('next-to-payment').addEventListener('click', () => {
        clearErrors();
        let valid = true;
        const fields = [
            { id: 'shipping-name', label: 'Full name' },
            { id: 'shipping-phone', label: 'Phone number' },
            { id: 'shipping-address', label: 'Delivery address' },
            { id: 'shipping-city', label: 'City' }
        ];
        fields.forEach(f => {
            const el = document.getElementById(f.id);
            if (!el.value.trim()) {
                el.classList.add('invalid');
                const errEl = document.getElementById(f.id + '-error');
                if (errEl) { errEl.textContent = f.label + ' is required.'; errEl.style.display = 'block'; }
                valid = false;
            }
        });
        if (valid) setStep(2);
    });

    // ── Step 2 → 3 ──
    document.getElementById('next-to-confirm').addEventListener('click', () => setStep(3));
    document.getElementById('back-to-delivery').addEventListener('click', () => setStep(1));
    document.getElementById('back-to-payment').addEventListener('click', () => setStep(2));

    // ── Populate review ──
    function populateReview() {
        const name = document.getElementById('shipping-name').value;
        const phone = document.getElementById('shipping-phone').value;
        const addr = document.getElementById('shipping-address').value;
        const city = document.getElementById('shipping-city').value;
        const payVal = document.querySelector('input[name="payment-method"]:checked').value;
        const payLabel = payVal === '2' ? 'Credit / Debit Card' : 'Cash on Delivery';

        document.getElementById('review-address').innerHTML = `
            <p><strong>${name}</strong></p>
            <p>${addr}, ${city}</p>
            <p>Phone: ${phone}</p>`;
        document.getElementById('review-payment').innerHTML = `<p><strong>${payLabel}</strong></p>`;
        document.getElementById('review-items').innerHTML = cartItems.map(item => `
            <div class="rh-review-item">
                <span>${item.Title} <small>(${item.FormatName} ×${item.Quantity})</small></span>
                <span>PKR ${((parseFloat(item.ItemPrice) || 0) * item.Quantity).toLocaleString()}</span>
            </div>`).join('');
        document.getElementById('review-total').textContent = `PKR ${cartTotal.toLocaleString()}`;
    }

    // ── Place Order ──
    document.getElementById('place-order-btn').addEventListener('click', async () => {
        const btn = document.getElementById('place-order-btn');
        btn.disabled = true;
        btn.textContent = 'Processing...';

        try {
            const res = await fetch('/api/cart/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentMethodId: parseInt(document.querySelector('input[name="payment-method"]:checked').value),
                    shippingName: document.getElementById('shipping-name').value.trim(),
                    shippingAddress: document.getElementById('shipping-address').value.trim(),
                    shippingCity: document.getElementById('shipping-city').value.trim(),
                    shippingPhone: document.getElementById('shipping-phone').value.trim()
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Checkout failed');

            // Show confirmation
            step3.style.display = 'none';
            sidebar.style.display = 'none';
            document.querySelector('.rh-checkout-steps').style.display = 'none';
            confirmation.style.display = 'block';

            document.getElementById('confirm-order-number').textContent = data.orderNumber;
            document.getElementById('confirm-total').textContent = `PKR ${parseFloat(data.totalAmount).toLocaleString()}`;
            const payVal = document.querySelector('input[name="payment-method"]:checked').value;
            document.getElementById('confirm-payment').textContent = payVal === '2' ? 'Credit / Debit Card' : 'Cash on Delivery';
        } catch (err) {
            showToast(err.message || 'Checkout failed. Please try again.', 'error');
            btn.disabled = false;
            btn.textContent = '🛒 Place Order';
        }
    });

    // ── Helpers ──
    function clearErrors() {
        document.querySelectorAll('.form-control').forEach(el => el.classList.remove('invalid'));
        document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');
    }

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast-notification');
        const toastMsg = document.getElementById('toast-message');
        toastMsg.textContent = message;
        toast.className = `rh-toast rh-toast--${type} rh-toast--visible`;
        setTimeout(() => toast.classList.remove('rh-toast--visible'), 3500);
    }
});
