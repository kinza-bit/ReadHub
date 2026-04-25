// browse.js — User book browsing, search, filter, and rating (US-05, US-06)

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const bookGrid = document.getElementById('book-grid');
    const emptyState = document.getElementById('empty-state');
    const categoryPills = document.getElementById('category-pills');
    const typeFilter = document.getElementById('type-filter');
    const sortSelect = document.getElementById('sort-select');
    const bookCountEl = document.getElementById('book-count');
    const rateModal = document.getElementById('rate-modal');
    const submitRatingBtn = document.getElementById('submit-rating-btn');
    const starInput = document.getElementById('star-input');
    const ratingLabel = document.getElementById('rating-label');

    let allBooks = [];
    let categories = [];
    let currentCategory = 'all';
    let currentUser = null;
    let selectedRating = 0;

    // ── Init ──
    checkSession();
    loadCategories();
    loadBooks();

    // ── Check Session ──
    async function checkSession() {
        try {
            const res = await fetch('/api/session');
            const data = await res.json();
            if (data.isAuthenticated) {
                currentUser = data.user;
                const greetEl = document.getElementById('user-greeting');
                const loginLink = document.getElementById('login-link');
                const logoutBtn = document.getElementById('logout-btn');
                const nameDisplay = document.getElementById('user-name-display');

                if (greetEl) greetEl.style.display = '';
                if (loginLink) loginLink.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = '';
                if (nameDisplay) nameDisplay.textContent = data.user.name;
            }
        } catch (err) {
            console.log('Not logged in');
        }
    }

    // ── Load Categories ──
    async function loadCategories() {
        try {
            const res = await fetch('/api/categories/with-counts');
            if (!res.ok) throw new Error('Failed');
            categories = await res.json();

            // Build pills
            let pillsHTML = '<button class="genre-pill active" data-category="all">All Books</button>';
            categories.forEach(c => {
                pillsHTML += `<button class="genre-pill" data-category="${c.CategoryID}">${c.Name} <span class="rh-pill-count">${c.BookCount}</span></button>`;
            });
            categoryPills.innerHTML = pillsHTML;

            // Attach events
            categoryPills.querySelectorAll('.genre-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    categoryPills.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    currentCategory = pill.dataset.category;
                    renderBooks();
                });
            });
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    }

    // ── Load Books ──
    async function loadBooks() {
        try {
            const res = await fetch('/api/books');
            if (!res.ok) throw new Error('Failed');
            allBooks = await res.json();
            renderBooks();
        } catch (err) {
            console.error('Error loading books:', err);
            bookGrid.innerHTML = `<div class="rh-loading-state"><p style="color: var(--text-muted);">Failed to load books. Please try again later.</p></div>`;
        }
    }

    // ── Render Books ──
    function renderBooks() {
        let filtered = [...allBooks];

        // Search
        const search = searchInput.value.toLowerCase().trim();
        if (search) {
            filtered = filtered.filter(b =>
                b.Title.toLowerCase().includes(search) ||
                b.Author.toLowerCase().includes(search) ||
                (b.CategoryName && b.CategoryName.toLowerCase().includes(search))
            );
        }

        // Category
        if (currentCategory !== 'all') {
            filtered = filtered.filter(b => b.CategoryID == currentCategory);
        }

        // Type
        const typeVal = typeFilter.value;
        if (typeVal === 'physical') {
            filtered = filtered.filter(b => b.PhysicalPrice > 0);
        } else if (typeVal === 'ebook') {
            filtered = filtered.filter(b => b.EbookPrice > 0);
        }

        // Sort
        const sortVal = sortSelect.value;
        switch (sortVal) {
            case 'rating':
                filtered.sort((a, b) => (b.AverageRating || 0) - (a.AverageRating || 0));
                break;
            case 'price-low':
                filtered.sort((a, b) => (a.PhysicalPrice || a.EbookPrice || 0) - (b.PhysicalPrice || b.EbookPrice || 0));
                break;
            case 'price-high':
                filtered.sort((a, b) => (b.PhysicalPrice || b.EbookPrice || 0) - (a.PhysicalPrice || a.EbookPrice || 0));
                break;
            default:
                filtered.sort((a, b) => a.Title.localeCompare(b.Title));
        }

        // Update count
        bookCountEl.textContent = `${filtered.length} book${filtered.length !== 1 ? 's' : ''} found`;

        // Empty state
        if (!filtered.length) {
            bookGrid.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        bookGrid.style.display = '';
        emptyState.style.display = 'none';

        bookGrid.innerHTML = filtered.map(book => {
            const rating = parseFloat(book.AverageRating) || 0;
            const stars = renderStars(rating);
            const price = book.PhysicalPrice
                ? `PKR ${book.PhysicalPrice.toLocaleString()}`
                : (book.EbookPrice ? `PKR ${book.EbookPrice.toLocaleString()}` : 'Free');

            const hasPhysical = book.PhysicalPrice > 0;
            const hasEbook = book.EbookPrice > 0;
            const typeBadge = hasPhysical && hasEbook
                ? '<span class="rh-type-badge">Physical + eBook</span>'
                : hasEbook
                    ? '<span class="rh-type-badge rh-type-badge--ebook">eBook</span>'
                    : '<span class="rh-type-badge">Physical</span>';

            const availability = book.PhysicalAvailability === 'Available'
                ? '<span class="rh-avail rh-avail--yes">In Stock</span>'
                : (hasEbook ? '<span class="rh-avail rh-avail--yes">eBook Available</span>'
                    : '<span class="rh-avail rh-avail--no">Out of Stock</span>');

            const coverImg = book.ImageURL
                ? `<img src="${book.ImageURL}" alt="${book.Title}" class="rh-card-cover" loading="lazy">`
                : `<div class="rh-card-cover rh-card-cover--placeholder">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                   </div>`;

            const rateBtn = currentUser
                ? `<button class="rh-rate-btn" data-id="${book.BookID}" data-title="${book.Title}" title="Rate this book">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                        Rate
                   </button>`
                : '';

            // Cart button — only for logged-in users on in-stock physical books
            const cartBtn = currentUser && hasPhysical && book.PhysicalAvailability === 'Available'
                ? `<button class="rh-cart-add-btn" data-id="${book.BookID}" data-format="1" title="Add to cart">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                        Add to Cart
                   </button>`
                : '';

            return `
                <div class="rh-book-card glass">
                    <div class="rh-card-cover-wrap">
                        ${coverImg}
                        ${typeBadge}
                    </div>
                    <div class="rh-card-body">
                        <h3 class="rh-card-title">${book.Title}</h3>
                        <p class="rh-card-author">by ${book.Author}</p>
                        <div class="rh-card-meta">
                            <div class="rh-card-stars">${stars} <span class="rh-card-rating-num">${rating > 0 ? rating.toFixed(1) : '—'}</span></div>
                            <span class="rh-card-category">${book.CategoryName || ''}</span>
                        </div>
                        <div class="rh-card-footer">
                            <span class="rh-card-price">${price}</span>
                            ${availability}
                        </div>
                        <div class="rh-card-actions">
                            ${rateBtn}
                            ${cartBtn}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach rate buttons
        document.querySelectorAll('.rh-rate-btn').forEach(btn => {
            btn.addEventListener('click', () => openRateModal(btn.dataset.id, btn.dataset.title));
        });

        // Attach cart buttons
        document.querySelectorAll('.rh-cart-add-btn').forEach(btn => {
            btn.addEventListener('click', () => addToCart(btn.dataset.id, parseInt(btn.dataset.format), btn));
        });
    }

    // ── Star Rendering ──
    function renderStars(rating) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= Math.floor(rating)) {
                html += '<span class="rh-star rh-star--filled">★</span>';
            } else if (i - 0.5 <= rating) {
                html += '<span class="rh-star rh-star--half">★</span>';
            } else {
                html += '<span class="rh-star rh-star--empty">★</span>';
            }
        }
        return html;
    }

    // ── Rating Modal ──
    function openRateModal(bookId, bookTitle) {
        document.getElementById('rate-book-id').value = bookId;
        document.getElementById('rate-book-title').textContent = bookTitle;
        selectedRating = 0;
        submitRatingBtn.disabled = true;
        ratingLabel.textContent = 'Select a rating';
        starInput.querySelectorAll('.rh-star-btn').forEach(s => s.classList.remove('rh-star-btn--active'));
        rateModal.classList.add('active');
    }

    // Star interaction
    const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    starInput.querySelectorAll('.rh-star-btn').forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.value);
            submitRatingBtn.disabled = false;
            ratingLabel.textContent = ratingLabels[selectedRating];
            starInput.querySelectorAll('.rh-star-btn').forEach(s => {
                s.classList.toggle('rh-star-btn--active', parseInt(s.dataset.value) <= selectedRating);
            });
        });

        star.addEventListener('mouseenter', () => {
            const val = parseInt(star.dataset.value);
            starInput.querySelectorAll('.rh-star-btn').forEach(s => {
                s.classList.toggle('rh-star-btn--hover', parseInt(s.dataset.value) <= val);
            });
        });

        star.addEventListener('mouseleave', () => {
            starInput.querySelectorAll('.rh-star-btn').forEach(s => {
                s.classList.remove('rh-star-btn--hover');
            });
        });
    });

    // Submit rating
    submitRatingBtn.addEventListener('click', async () => {
        if (!selectedRating) return;
        const bookId = document.getElementById('rate-book-id').value;

        submitRatingBtn.disabled = true;
        submitRatingBtn.textContent = 'Submitting...';

        try {
            const res = await fetch(`/api/books/${bookId}/rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: selectedRating })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed');
            }

            closeModal(rateModal);
            showToast('Rating submitted successfully!', 'success');
            loadBooks(); // Refresh to show updated rating
        } catch (err) {
            showToast(err.message || 'Failed to submit rating.', 'error');
        } finally {
            submitRatingBtn.disabled = false;
            submitRatingBtn.textContent = 'Submit Rating';
        }
    });

    // ── Search with debounce ──
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(renderBooks, 300);
    });

    typeFilter.addEventListener('change', renderBooks);
    sortSelect.addEventListener('change', renderBooks);

    // ── Modal Helpers ──
    function closeModal(modal) {
        modal.classList.remove('active');
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => closeModal(rateModal));
    });

    window.addEventListener('click', (e) => {
        if (e.target === rateModal) closeModal(rateModal);
    });

    // ── Toast ──
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast-notification');
        const toastMsg = document.getElementById('toast-message');
        toastMsg.textContent = message;
        toast.className = `rh-toast rh-toast--${type} rh-toast--visible`;
        setTimeout(() => toast.classList.remove('rh-toast--visible'), 3500);
    }

    // ── Add to Cart ──
    async function addToCart(bookId, formatId, btnEl) {
        if (!currentUser) {
            showToast('Please log in to add items to your cart.', 'error');
            return;
        }
        const origText = btnEl.innerHTML;
        btnEl.disabled = true;
        btnEl.innerHTML = 'Adding...';
        try {
            const res = await fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookId: parseInt(bookId), formatId, quantity: 1 })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed');
            }
            showToast('Added to cart!', 'success');
            btnEl.innerHTML = '✓ Added';
            setTimeout(() => { btnEl.innerHTML = origText; btnEl.disabled = false; }, 2000);
        } catch (err) {
            showToast(err.message || 'Failed to add to cart.', 'error');
            btnEl.innerHTML = origText;
            btnEl.disabled = false;
        }
    }
});
