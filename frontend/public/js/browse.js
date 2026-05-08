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
    let userWishlist = [];
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
                document.getElementById('logout-btn').style.display = '';
                fetchWishlist();
            }
        } catch (err) { console.log('Not logged in'); }
    }

    async function fetchWishlist() {
        try {
            const res = await fetch('/api/user/wishlist');
            userWishlist = await res.json();
            renderBooks(); // Re-render to show hearts
        } catch (err) {}
    }

    // ── Load Categories ──
    async function loadCategories() {
        try {
            const res = await fetch('/api/categories/with-counts');
            const categories = await res.json();
            let html = '<button class="genre-pill active" data-category="all">All Books</button>';
            categories.forEach(c => {
                html += `<button class="genre-pill" data-category="${c.CategoryID}">${c.Name} <span class="rh-pill-count">${c.BookCount}</span></button>`;
            });
            categoryPills.innerHTML = html;
            categoryPills.querySelectorAll('.genre-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    categoryPills.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    currentCategory = pill.dataset.category;
                    renderBooks();
                });
            });
        } catch (err) {}
    }

    // ── Load Books ──
    async function loadBooks() {
        try {
            const res = await fetch('/api/books');
            allBooks = await res.json();
            renderBooks();
        } catch (err) {
            bookGrid.innerHTML = `<p style="color: var(--text-muted); text-align: center;">Failed to load books.</p>`;
        }
    }

    // ── Render Books ──
    function renderBooks() {
        let filtered = [...allBooks];
        const search = searchInput.value.toLowerCase().trim();
        if (search) {
            filtered = filtered.filter(b => b.Title.toLowerCase().includes(search) || b.Author.toLowerCase().includes(search));
        }
        if (currentCategory !== 'all') {
            filtered = filtered.filter(b => b.CategoryID == currentCategory);
        }

        const sortVal = sortSelect.value;
        if (sortVal === 'rating') filtered.sort((a,b) => (b.AverageRating || 0) - (a.AverageRating || 0));
        else if (sortVal === 'price-low') filtered.sort((a,b) => (a.PhysicalPrice || a.EbookPrice) - (b.PhysicalPrice || b.EbookPrice));
        else if (sortVal === 'price-high') filtered.sort((a,b) => (b.PhysicalPrice || b.EbookPrice) - (a.PhysicalPrice || a.EbookPrice));

        bookCountEl.textContent = `${filtered.length} books found`;

        if (!filtered.length) {
            bookGrid.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        bookGrid.style.display = 'grid';
        emptyState.style.display = 'none';

        bookGrid.innerHTML = filtered.map(book => {
            const isInWishlist = userWishlist.some(item => item.BookID === book.BookID);
            const price = book.PhysicalPrice ? `PKR ${book.PhysicalPrice.toLocaleString()}` : (book.EbookPrice ? `PKR ${book.EbookPrice.toLocaleString()}` : 'Free');
            const isAvailable = book.PhysicalAvailability === 'Available';
            const rating = Number.parseFloat(book.AverageRating) || 0;
            
            return `
                <div class="rh-book-card glass" onclick="window.location.href='/book-details.html?id=${book.BookID}'">
                    <div class="rh-card-cover-wrap">
                        <img src="${book.ImageURL || 'https://via.placeholder.com/300x450?text=No+Cover'}" class="rh-card-cover" loading="lazy">
                        <div class="rh-card-overlay-actions">
                            <button class="rh-action-icon-btn rh-wishlist-btn ${isInWishlist ? 'active' : ''}" 
                                    onclick="event.stopPropagation(); toggleWishlist(${book.BookID}, this)"
                                    title="Add to Wishlist">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="${isInWishlist ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.94-8.94 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                            </button>
                            <button class="rh-action-icon-btn rh-rate-btn-oncard" 
                                    onclick="event.stopPropagation(); openRateModal(${book.BookID}, '${book.Title.replace(/'/g, "\\'")}')"
                                    title="Rate this book">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="rh-card-body">
                        <h3 class="rh-card-title">${book.Title}</h3>
                        <p class="rh-card-author">by ${book.Author}</p>
                        <div class="rh-card-meta">
                            <div class="rh-card-stars" aria-label="Rating ${rating.toFixed(1)} out of 5">
                                ${renderStarRow(rating)}
                                <span class="rh-card-rating-num">${rating.toFixed(1)}</span>
                            </div>
                            <span class="rh-card-category">${book.CategoryName || 'General'}</span>
                        </div>
                        <div class="rh-card-footer">
                            <span class="rh-card-price">${price}</span>
                            <span class="rh-card-avail ${isAvailable ? 'rh-avail--yes' : 'rh-avail--no'}">${isAvailable ? 'In Stock' : 'Out of Stock'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderStarRow(rating) {
        // Round to nearest half-star for display
        const rounded = Math.round((rating || 0) * 2) / 2;
        let html = '';
        for (let i = 1; i <= 5; i++) {
            const diff = rounded - i;
            if (diff >= 0) html += '<span class="rh-star rh-star--filled">★</span>';
            else if (diff === -0.5) html += '<span class="rh-star rh-star--half">★</span>';
            else html += '<span class="rh-star rh-star--empty">★</span>';
        }
        return html;
    }

    // Wishlist logic
    window.toggleWishlist = async (id, btn) => {
        if (!currentUser) { showToast('Please log in first', 'error'); return; }
        const isActive = btn.classList.contains('active');
        try {
            const method = isActive ? 'DELETE' : 'POST';
            const url = isActive ? `/api/user/wishlist/${id}` : '/api/user/wishlist';
            const body = isActive ? null : JSON.stringify({ bookId: id });
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body });
            if (!res.ok) throw new Error('Failed');
            btn.classList.toggle('active');
            btn.querySelector('svg').setAttribute('fill', isActive ? 'none' : 'currentColor');
            showToast(isActive ? 'Removed from wishlist' : 'Added to wishlist');
            if (isActive) userWishlist = userWishlist.filter(item => item.BookID !== id);
            else userWishlist.push({ BookID: id });
        } catch (err) { showToast(err.message, 'error'); }
    };

    // Rating Modal Logic
    window.openRateModal = (bookId, title) => {
        if (!currentUser) { showToast('Please log in first', 'error'); return; }
        document.getElementById('rate-book-id').value = bookId;
        document.getElementById('rate-book-title').textContent = title;
        selectedRating = 0;
        submitRatingBtn.disabled = true;
        starInput.querySelectorAll('.rh-star-btn').forEach(s => s.style.color = 'var(--color-border)');
        rateModal.style.display = 'flex';
    };

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
        const id = document.getElementById('rate-book-id').value;
        try {
            const res = await fetch(`/api/books/${id}/rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: selectedRating })
            });
            if (!res.ok) throw new Error('Failed');
            showToast('Rating submitted!');
            rateModal.style.display = 'none';
            loadBooks();
        } catch (err) { showToast(err.message, 'error'); }
    });

    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => rateModal.style.display = 'none'));

    // Search & Filters
    searchInput.addEventListener('input', () => renderBooks());
    typeFilter.addEventListener('change', () => renderBooks());
    sortSelect.addEventListener('change', () => renderBooks());

    function showToast(msg, type = 'success') {
        const t = document.getElementById('toast-notification');
        document.getElementById('toast-message').textContent = msg;
        t.className = `rh-toast rh-toast--${type} rh-toast--visible`;
        setTimeout(() => t.classList.remove('rh-toast--visible'), 3000);
    }
});
