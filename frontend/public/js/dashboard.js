// dashboard.js — User Dashboard: stats + Popular Books section

document.addEventListener('DOMContentLoaded', () => {
    fetchDashboardStats();
    loadRecentlyAdded();
    loadPopularBooks();
    fetchNotifications();
});

// ── Notifications (Expiring Rentals) ──────────────────────────────────────────
async function fetchNotifications() {
    const area = document.getElementById('notification-area');
    if (!area) return;

    try {
        const res = await fetch('/api/user/notifications');
        if (!res.ok) return;
        const notifications = await res.json();

        if (notifications.length === 0) {
            area.style.display = 'none';
            return;
        }

        area.style.display = 'block';
        area.innerHTML = notifications.map(notif => {
            const daysLeft = Math.ceil((new Date(notif.DueDate) - new Date()) / (1000 * 60 * 60 * 24));
            const hoursLeft = Math.ceil((new Date(notif.DueDate) - new Date()) / (1000 * 60 * 60));
            
            let timeText = daysLeft > 1 ? `${daysLeft} days` : `${hoursLeft} hours`;
            if (hoursLeft <= 1) timeText = 'less than an hour';

            return `
                <div class="gem-card" style="--c-accent:#f59e0b;--c-accent-bg:rgba(245,158,11,0.08);--c-accent-border:rgba(245,158,11,0.2); padding: 1rem 1.5rem; margin-bottom: 0.75rem; border-left: 4px solid #f59e0b;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div class="stat-icon-wrap" style="margin-bottom: 0; width: 32px; height: 32px; flex-shrink: 0;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text); font-size: 13px;">Rental Expiring Soon</div>
                            <div style="color: var(--text-muted); font-size: 12px;">Your rental for <strong>"${notif.Title}"</strong> expires in ${timeText}.</div>
                        </div>
                        <a href="/library.html" class="see-all" style="margin-left: auto;">Open Library →</a>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error fetching notifications:', err);
    }
}

// ── Recently Added ───────────────────────────────────────────────────────────
async function loadRecentlyAdded() {
    const container = document.getElementById('recently-added-container');
    const emptyState = document.getElementById('recent-empty-state');
    const viewAllLink = document.getElementById('library-view-all');
    if (!container || !emptyState) return;

    try {
        const res = await fetch('/api/user/recently-added');
        if (!res.ok) throw new Error('API error');
        const books = await res.json();

        if (books.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'flex';
            if (viewAllLink) viewAllLink.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        emptyState.style.display = 'none';
        if (viewAllLink) viewAllLink.style.display = 'block';

        const grid = container.querySelector('.pb-grid');
        grid.innerHTML = ''; // Clear skeletons

        books.forEach(book => {
            const card = document.createElement('div');
            card.className = 'book-card-gem';
            card.setAttribute('data-tilt', '');

            card.innerHTML = `
                <div class="gem-shimmer"></div>
                <div class="book-cover-wrap">
                    <img src="${book.ImageURL || '/api/placeholder/400/600'}" alt="${book.Title}">
                </div>
                <div class="book-card-info">
                    <div class="book-card-title">${book.Title}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem;">
                        <span style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%;">${book.Author}</span>
                        <span class="badge ${book.FormatLabel === 'Rented' ? 'badge-pending' : 'badge-success'}" style="font-size: 9px; padding: 2px 6px;">${book.FormatLabel}</span>
                    </div>
                </div>
            `;
            card.onclick = () => window.location.href = '/library.html';
            grid.appendChild(card);
            initTilt(card);
        });

    } catch (err) {
        console.error('Recently added error:', err);
        container.innerHTML = `<p style="color:var(--text-muted); padding: 2rem; text-align: center;">Could not load recent books.</p>`;
    }
}

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
