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

    let hasPhysical = false;

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

            hasPhysical = cartItems.some(item => item.FormatID === 1);
            
            cartTotal = cartItems.reduce((sum, item) => {
                return sum + (parseFloat(item.ItemPrice) || 0) * item.Quantity;
            }, 0);

            renderSidebarItems();
            
            if (hasPhysical) {
                prefillAddress();
                setStep(1);
            } else {
                // No physical books - hide address step and COD option
                document.getElementById('step-1-indicator').style.display = 'none';
                document.querySelector('.rh-checkout-steps .rh-step-line').style.display = 'none';
                document.getElementById('payment-cod-option').style.display = 'none';
                
                // Force Credit Card as only option
                document.querySelector('input[name="payment-method"][value="2"]').checked = true;
                
                setStep(2);
            }
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
            const indicatorStep = i + 1;
            ind.classList.toggle('active', indicatorStep === stepNum);
            ind.classList.toggle('completed', indicatorStep < stepNum);
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

    // ── Payment Method Toggle ──
    const ccFormContainer = document.getElementById('cc-form-container');
    const paymentMethods = document.querySelectorAll('input[name="payment-method"]');
    
    paymentMethods.forEach(input => {
        input.addEventListener('change', () => {
            if (input.value === '2') {
                ccFormContainer.classList.add('expanded');
            } else {
                ccFormContainer.classList.remove('expanded');
                clearCCErrors();
            }
        });
    });

    // Initialize state
    if (document.querySelector('input[name="payment-method"]:checked')?.value === '2') {
        ccFormContainer.classList.add('expanded');
    }

    // ── CC Input Formatting ──
    const ccNumberInput = document.getElementById('cc-number');
    const ccExpiryInput = document.getElementById('cc-expiry');
    const ccNameInput   = document.getElementById('cc-name');
    const ccCvvInput    = document.getElementById('cc-cvv');

    ccNumberInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        v = v.substring(0, 16); // Limit to 16 digits
        let parts = [];
        for (let i = 0; i < v.length; i += 4) {
            parts.push(v.substring(i, i + 4));
        }
        e.target.value = parts.join(' ');
    });

    ccExpiryInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\//g, '').replace(/[^0-9]/gi, '');
        v = v.substring(0, 4); // Limit to 4 digits (MMYY)
        
        if (v.length >= 2) {
            let month = parseInt(v.substring(0, 2));
            if (month > 12) month = 12;
            if (v.substring(0, 2) === '00') v = '01' + v.substring(2);
            else v = (month < 10 && v[0] !== '0' ? '0' + month : month.toString().padStart(2, '0')) + v.substring(2);
            
            e.target.value = v.substring(0, 2) + '/' + v.substring(2);
        } else {
            e.target.value = v;
        }
    });

    // ── Real-time Validation (Blur) ──
    ccNameInput.addEventListener('blur', () => validateField('cc-name'));
    ccNumberInput.addEventListener('blur', () => validateField('cc-number'));
    ccExpiryInput.addEventListener('blur', () => validateField('cc-expiry'));
    ccCvvInput.addEventListener('blur', () => validateField('cc-cvv'));

    function validateField(id) {
        const val = document.getElementById(id).value.trim();
        const errEl = document.getElementById(id + '-error');
        const input = document.getElementById(id);
        
        input.classList.remove('invalid');
        if (errEl) errEl.style.display = 'none';

        if (id === 'cc-name' && !val) {
            showCCError(id, 'Cardholder name is required');
            return false;
        }
        if (id === 'cc-number') {
            const digits = val.replace(/\s/g, '');
            if (digits.length !== 16) {
                showCCError(id, 'Enter a valid 16-digit card number');
                return false;
            }
        }
        if (id === 'cc-expiry') {
            if (!/^\d{2}\/\d{2}$/.test(val)) {
                showCCError(id, 'Use MM/YY format');
                return false;
            }
            const [m, y] = val.split('/').map(n => parseInt(n));
            if (m < 1 || m > 12) {
                showCCError(id, 'Month must be between 01 and 12');
                return false;
            }
            const now = new Date();
            const currentYear = now.getFullYear() % 100;
            const currentMonth = now.getMonth() + 1;
            if (y < currentYear || (y === currentYear && m < currentMonth)) {
                showCCError(id, 'Card has expired');
                return false;
            }
        }
        if (id === 'cc-cvv' && (val.length < 3 || val.length > 4)) {
            showCCError(id, '3 or 4 digits required');
            return false;
        }
        return true;
    }

    // ── CC Validation ──
    function validateCC() {
        clearCCErrors();
        let isNameValid = validateField('cc-name');
        let isNumValid  = validateField('cc-number');
        let isExpValid  = validateField('cc-expiry');
        let isCvvValid  = validateField('cc-cvv');
        return isNameValid && isNumValid && isExpValid && isCvvValid;
    }

    function showCCError(id, msg) {
        const el = document.getElementById(id);
        el.classList.add('invalid');
        const errEl = document.getElementById(id + '-error');
        if (errEl) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
            errEl.style.color = 'var(--prism-3)'; // Ensure consistent pink/red color
        }
    }

    function clearCCErrors() {
        ['cc-name', 'cc-number', 'cc-expiry', 'cc-cvv'].forEach(id => {
            document.getElementById(id).classList.remove('invalid');
            const errEl = document.getElementById(id + '-error');
            if (errEl) errEl.style.display = 'none';
        });
    }

    // ── Step 2 → 3 (with Mock Processing) ──
    document.getElementById('next-to-confirm').addEventListener('click', async () => {
        const payVal = document.querySelector('input[name="payment-method"]:checked').value;
        
        if (payVal === '2') {
            if (!validateCC()) return;
            
            // Mock Processing
            const nextBtn = document.getElementById('next-to-confirm');
            const processing = document.getElementById('cc-processing');
            const success = document.getElementById('cc-success');
            
            nextBtn.disabled = true;
            processing.style.display = 'flex';
            success.style.display = 'none';
            
            await new Promise(r => setTimeout(r, 1500)); // Simulate bank verification
            
            processing.style.display = 'none';
            success.style.display = 'flex';
            
            await new Promise(r => setTimeout(r, 1000)); // Show success checkmark
            
            success.style.display = 'none';
            nextBtn.disabled = false;
        }
        
        setStep(3);
    });

    document.getElementById('back-to-delivery').addEventListener('click', () => {
        if (hasPhysical) setStep(1);
        else window.location.href = '/cart.html';
    });
    document.getElementById('back-to-payment').addEventListener('click', () => setStep(2));

    // ── Populate review ──
    function populateReview() {
        const payVal = document.querySelector('input[name="payment-method"]:checked').value;
        const payLabel = payVal === '2' ? 'Credit / Debit Card' : 'Cash on Delivery';

        // Address Section
        const addrSection = document.getElementById('review-address').closest('.rh-review-section');
        if (hasPhysical) {
            const name = document.getElementById('shipping-name').value;
            const phone = document.getElementById('shipping-phone').value;
            const addr = document.getElementById('shipping-address').value;
            const city = document.getElementById('shipping-city').value;
            
            addrSection.style.display = 'block';
            document.getElementById('review-address').innerHTML = `
                <p><strong>${name}</strong></p>
                <p>${addr}, ${city}</p>
                <p>Phone: ${phone}</p>`;
        } else {
            addrSection.style.display = 'none';
        }

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
            const body = {
                paymentMethodId: parseInt(document.querySelector('input[name="payment-method"]:checked').value)
            };

            if (hasPhysical) {
                body.shippingName = document.getElementById('shipping-name').value.trim();
                body.shippingAddress = document.getElementById('shipping-address').value.trim();
                body.shippingCity = document.getElementById('shipping-city').value.trim();
                body.shippingPhone = document.getElementById('shipping-phone').value.trim();
            } else {
                // Mock address for digital-only orders to satisfy backend if needed, 
                // or backend should handle nulls.
                body.shippingName = "Digital Purchase";
                body.shippingAddress = "No Shipping Required";
                body.shippingCity = "Online";
                body.shippingPhone = "N/A";
            }

            const res = await fetch('/api/cart/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
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
