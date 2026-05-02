document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('id');

    if (!bookId) {
        showError('No book ID provided.');
        return;
    }

    const contentEl = document.getElementById('book-details-content');
    const loadingEl = document.getElementById('loading-state');
    const errorEl = document.getElementById('error-state');

    const titleEl = document.getElementById('book-title');
    const authorEl = document.getElementById('book-author');
    const coverEl = document.getElementById('book-cover');
    const categoryEl = document.getElementById('book-category');
    const statusEl = document.getElementById('book-status');
    const descriptionEl = document.getElementById('book-description');
    const ratingStarsEl = document.getElementById('book-rating-stars');
    const ratingTextEl = document.getElementById('rating-text');
    const purchaseOptionsEl = document.getElementById('purchase-options');
    const wishlistBtn = document.getElementById('wishlist-btn');
    
    // Modal elements
    const rateModal = document.getElementById('rate-modal');
    const openRateBtn = document.getElementById('open-rate-btn');
    const submitRatingBtn = document.getElementById('submit-rating-btn');
    const starInput = document.getElementById('star-input');
    const rateBookTitleModal = document.getElementById('rate-book-title-modal');

    let currentUser = null;
    let currentBook = null;
    let selectedRating = 0;

    // Initialize
    checkSession();
    fetchBookDetails();

    async function checkSession() {
        try {
            const res = await fetch('/api/session');
            const data = await res.json();
            if (data.isAuthenticated) {
                currentUser = data.user;
                document.getElementById('logout-btn').style.display = '';
                checkWishlistStatus();
            }
        } catch (err) { console.log('Not logged in'); }
    }

    async function fetchBookDetails() {
        try {
            const res = await fetch(`/api/books/${bookId}`);
            if (!res.ok) throw new Error('Book not found');
            currentBook = await res.json();
            renderBookDetails(currentBook);
        } catch (err) { showError(err.message); }
    }

    function renderBookDetails(book) {
        titleEl.textContent = book.Title;
        authorEl.textContent = `by ${book.Author}`;
        coverEl.src = book.ImageURL || 'https://via.placeholder.com/400x600?text=No+Cover';
        categoryEl.textContent = book.CategoryName || 'General';
        descriptionEl.innerHTML = book.Description || 'No description available.';

        const rating = parseFloat(book.AverageRating) || 0;
        ratingStarsEl.innerHTML = renderStarsHTML(rating);
        ratingTextEl.textContent = `${rating.toFixed(1)} (Aggregate Rating)`;

        const isAvailable = book.PhysicalAvailability === 'Available';
        statusEl.textContent = isAvailable ? 'In Stock' : 'Out of Stock';
        statusEl.className = `rh-card-avail ${isAvailable ? 'rh-avail--yes' : 'rh-avail--no'}`;

        renderPurchaseOptions(book);

        loadingEl.style.display = 'none';
        contentEl.style.display = 'grid';
    }


    function renderPurchaseOptions(book) {
        let html = '';
        const userStatus = book.userStatus || { isInCart: [], activeRental: null, isPurchased: false };

        if (book.PhysicalPrice > 0) {
            const isAvail = book.PhysicalAvailability === 'Available';
            html += `
                <div class="rh-purchase-card glass">
                    <h4>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 0.5rem;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        Physical Book
                    </h4>
                    <span class="rh-purchase-price">PKR ${book.PhysicalPrice.toLocaleString()}</span>
                    <button class="btn-primary" onclick="addToCart(${book.BookID}, 1)" ${!isAvail ? 'disabled' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                        ${isAvail ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                </div>
            `;
        }

        if (book.EbookPrice > 0) {
            const inCartBuy = userStatus.isInCart.includes(2);
            const inCartRent = userStatus.isInCart.includes(3);
            const isRented = userStatus.activeRental;
            const isPurchased = userStatus.isPurchased;

            // eBook Buy Option
            let buyBtnText = 'Buy Now';
            let buyDisabled = false;
            if (inCartBuy) { buyBtnText = 'Already in cart'; buyDisabled = true; }
            else if (isPurchased) { buyBtnText = 'Already purchased'; buyDisabled = true; }

            html += `
                <div class="rh-purchase-card glass">
                    <h4>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 0.5rem;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Digital eBook
                    </h4>
                    <span class="rh-purchase-price">PKR ${book.EbookPrice.toLocaleString()}</span>
                    <button class="btn-primary" onclick="addToCart(${book.BookID}, 2)" ${buyDisabled ? 'disabled' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                        ${buyBtnText}
                    </button>
                </div>
            `;

            // eBook Rent Option
            let rentBtnText = 'Rent Now';
            let rentDisabled = false;
            let expiryMsg = '';
            if (inCartRent) { rentBtnText = 'Already in cart'; rentDisabled = true; }
            else if (isRented) { 
                const expiry = new Date(userStatus.activeRental.expiryDate).toLocaleDateString();
                rentBtnText = 'Already rented'; 
                rentDisabled = true; 
                expiryMsg = `<p style="font-size: 0.8rem; color: var(--color-accent); margin-top: 0.5rem;">Expires on ${expiry}</p>`;
            }

            html += `
                <div class="rh-purchase-card glass">
                    <h4>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 0.5rem;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        Rent eBook
                    </h4>
                    <select id="rent-days" class="form-control" ${rentDisabled ? 'disabled' : ''} style="margin-bottom: 1rem; background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1);">
                        <option value="7">7 Days - PKR 150</option>
                        <option value="14">14 Days - PKR 250</option>
                        <option value="30">30 Days - PKR 400</option>
                    </select>
                    <button class="btn-primary" onclick="addRentalToCart(${book.BookID})" ${rentDisabled ? 'disabled' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                        ${rentBtnText}
                    </button>
                    ${expiryMsg}
                </div>
            `;
        }
        purchaseOptionsEl.innerHTML = html;
    }

    function renderStarsHTML(rating) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            const isFilled = i <= Math.floor(rating);
            html += `<svg width="16" height="16" viewBox="0 0 24 24" fill="${isFilled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" style="color: ${isFilled ? '#FFD700' : 'var(--color-border)'};">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>`;
        }
        return html;
    }

    async function checkWishlistStatus() {
        if (!currentUser) return;
        try {
            const res = await fetch('/api/user/wishlist');
            const wishlist = await res.json();
            if (wishlist.some(item => item.BookID == bookId)) {
                wishlistBtn.classList.add('active');
                wishlistBtn.querySelector('svg').setAttribute('fill', 'currentColor');
            }
        } catch (err) {}
    }

    wishlistBtn.addEventListener('click', async () => {
        if (!currentUser) { showToast('Please log in first', 'error'); return; }
        const isActive = wishlistBtn.classList.contains('active');
        try {
            const method = isActive ? 'DELETE' : 'POST';
            const url = isActive ? `/api/user/wishlist/${bookId}` : '/api/user/wishlist';
            const body = isActive ? null : JSON.stringify({ bookId });
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body });
            if (!res.ok) throw new Error('Action failed');
            wishlistBtn.classList.toggle('active');
            wishlistBtn.querySelector('svg').setAttribute('fill', isActive ? 'none' : 'currentColor');
            showToast(isActive ? 'Removed from wishlist' : 'Added to wishlist');
        } catch (err) { showToast(err.message, 'error'); }
    });

    // Rating Logic
    openRateBtn.addEventListener('click', () => {
        if (!currentUser) { showToast('Please log in to rate books', 'error'); return; }
        rateBookTitleModal.textContent = currentBook.Title;
        rateModal.style.display = 'flex';
    });

    starInput.querySelectorAll('.rh-star-btn').forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.value);
            submitRatingBtn.disabled = false;
            starInput.querySelectorAll('.rh-star-btn').forEach(s => {
                s.style.color = parseInt(s.dataset.value) <= selectedRating ? '#FFD700' : 'var(--color-border)';
            });
        });
    });

    submitRatingBtn.addEventListener('click', async () => {
        try {
            const res = await fetch(`/api/books/${bookId}/rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: selectedRating })
            });
            if (!res.ok) throw new Error('Failed to submit rating');
            showToast('Rating submitted successfully!');
            rateModal.style.display = 'none';
            fetchBookDetails();
        } catch (err) { showToast(err.message, 'error'); }
    });

    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => rateModal.style.display = 'none'));

    window.addToCart = async (id, formatId) => {
        if (!currentUser) { showToast('Please log in first', 'error'); return; }
        try {
            const res = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: id, formatId, quantity: 1 }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add to cart');
            showToast('Added to cart!');
            fetchBookDetails(); // Refresh UI to update buttons
        } catch (err) { showToast(err.message, 'error'); }
    };

    window.addRentalToCart = async (id) => {
        if (!currentUser) { showToast('Please log in first', 'error'); return; }
        const days = document.getElementById('rent-days').value;
        try {
            const res = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: id, formatId: 3, quantity: 1, rentalDays: parseInt(days) }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add rental');
            showToast('Rental added to cart!');
            fetchBookDetails(); // Refresh UI
        } catch (err) { showToast(err.message, 'error'); }
    };

    function showError(msg) {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        document.getElementById('error-message').textContent = msg;
    }

    function showToast(msg, type = 'success') {
        const t = document.getElementById('toast-notification');
        document.getElementById('toast-message').textContent = msg;
        t.className = `rh-toast rh-toast--${type} rh-toast--visible`;
        setTimeout(() => t.classList.remove('rh-toast--visible'), 3000);
    }
});
