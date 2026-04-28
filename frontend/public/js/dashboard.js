// dashboard.js — User Dashboard: stats + Popular Books section

document.addEventListener('DOMContentLoaded', () => {
    fetchDashboardStats();
    loadPopularBooks();
});

// ── Dashboard Stats ──────────────────────────────────────────────────────────
async function fetchDashboardStats() {
    try {
        // Name greeting
        const profileRes = await fetch('/api/profile');
        if (profileRes.ok) {
            const user = await profileRes.json();
            const nameEl = document.getElementById('user-greeting-name');
            if (nameEl) nameEl.textContent = user.FullName; // greeting with 👋 is already in HTML
        }

        // Purchases count
        const purchaseRes = await fetch('/api/user/purchases');
        if (purchaseRes.ok) {
            const purchases = await purchaseRes.json();
            const pCount = document.getElementById('dash-purchases-count');
            if (pCount) {
                pCount.textContent = purchases.length;
                // Update progress bar (e.g., 10% per book, capped at 100%)
                const progress = Math.min(purchases.length * 10, 100);
                const progressBar = document.getElementById('purchases-prog-fill');
                if (progressBar) progressBar.style.width = progress + '%';
            }
        }

        // Wishlist count
        const wishlistRes = await fetch('/api/user/wishlist');
        if (wishlistRes.ok) {
            const wishlist = await wishlistRes.json();
            const wCount = document.getElementById('dash-wishlist-count');
            if (wCount) wCount.textContent = wishlist.length;
        }

        // Active Rentals
        const rentalsRes = await fetch('/api/user/rentals');
        if (rentalsRes.ok) {
            const rentals = await rentalsRes.json();
            const rCount = document.getElementById('dash-rentals-count');
            if (rCount) {
                rCount.textContent = rentals.length;
            }
        }
    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
    }
}

// ── Popular Books ────────────────────────────────────────────────────────────
async function loadPopularBooks() {
    const grid = document.getElementById('popular-books-grid');
    if (!grid) return;

    try {
        const res = await fetch('/api/books/popular');
        if (!res.ok) throw new Error('API error');
        let books = await res.json();

        // Client-side sort: rating DESC, reviews_count DESC as tiebreaker
        books = books
            .sort((a, b) =>
                (b.AverageRating - a.AverageRating) ||
                (b.ReviewsCount  - a.ReviewsCount)
            )
            .slice(0, 3);

        if (!books.length) {
            grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1">No rated books yet.</p>`;
            return;
        }

        grid.innerHTML = ''; // Clear skeletons
        
        books.forEach(book => {
            const card = document.createElement('div');
            card.className = 'book-card-gem';
            card.setAttribute('data-tilt', '');

            const rating = book.AverageRating || 0;
            const reviews = book.ReviewsCount || 0;

            card.innerHTML = `
                <div class="gem-shimmer"></div>
                <div class="book-cover-wrap">
                    <img src="${book.ImageURL || '/api/placeholder/400/600'}" alt="${book.Title}">
                </div>
                <div class="book-card-info">
                    <div class="book-card-title">${book.Title}</div>
                    <div class="book-rating">
                        ★ ${Number(rating).toFixed(1)} <span class="rating-count">(${reviews})</span>
                    </div>
                </div>
            `;
            card.onclick = () => window.location.href = `/browse.html?search=${encodeURIComponent(book.Title)}`;
            grid.appendChild(card);
            
            // Re-apply tilt logic to new elements
            initTilt(card);
        });

    } catch (err) {
        console.error('Popular books error:', err);
        grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1">
            Could not load popular books right now.
        </p>`;
    }
}

// Helper to initialize tilt on dynamic elements
function initTilt(card) {
    const MAX_TILT = 12;
    card.addEventListener('mousemove', e => {
        const r   = card.getBoundingClientRect();
        const cx  = r.left + r.width  / 2;
        const cy  = r.top  + r.height / 2;
        const dx  = (e.clientX - cx) / (r.width  / 2);
        const dy  = (e.clientY - cy) / (r.height / 2);
        const rx  =  dy * MAX_TILT;
        const ry  = -dx * MAX_TILT;

        card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.03,1.03,1.03)`;
        
        const shimmer = card.querySelector('.gem-shimmer');
        if (shimmer) {
            shimmer.style.background = `linear-gradient(${105 + ry * 3}deg,transparent 25%,rgba(255,255,255,0.06) 50%,transparent 75%)`;
            shimmer.style.opacity = '1';
        }
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform  = 'perspective(700px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
        const shimmer = card.querySelector('.gem-shimmer');
        if (shimmer) shimmer.style.opacity = '0';
    });
}
