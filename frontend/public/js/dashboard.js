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
            if (nameEl) nameEl.textContent = user.FullName + ' 👋';
        }

        // Purchases count
        const purchaseRes = await fetch('/api/user/purchases');
        if (purchaseRes.ok) {
            const purchases = await purchaseRes.json();
            const pCount = document.getElementById('dash-purchases-count');
            if (pCount) pCount.textContent = purchases.length;
        }

        // Wishlist count
        const wishlistRes = await fetch('/api/user/wishlist');
        if (wishlistRes.ok) {
            const wishlist = await wishlistRes.json();
            const wCount = document.getElementById('dash-wishlist-count');
            if (wCount) wCount.textContent = wishlist.length;
        }

        // Active Rentals — placeholder; endpoint can be wired later
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
            grid.innerHTML = `<p style="color:var(--color-text-muted);grid-column:1/-1">No rated books yet.</p>`;
            return;
        }

        const rankEmoji  = ['🥇', '🥈', '🥉'];
        const rankLabels = ['Best Rated', '2nd Place', '3rd Place'];

        grid.innerHTML = books.map((book, i) => {
            const rating  = parseFloat(book.AverageRating) || 0;
            const reviews = Number(book.ReviewsCount) || 0;
            const stars   = renderPbStars(rating);
            const cover   = book.ImageURL
                ? `<img src="${book.ImageURL}" alt="${book.Title}" class="pb-cover-img" loading="lazy">`
                : `<div class="pb-cover-placeholder">
                       <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                           stroke="var(--color-text-muted)" stroke-width="1.5">
                         <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                         <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                       </svg>
                   </div>`;

            const isBest = i === 0;
            return `
            <article class="pb-card glass${isBest ? ' pb-card--best' : ''}"
                     role="listitem" aria-label="Rank ${i + 1}: ${book.Title}">

                <!-- Rank badge -->
                <div class="pb-rank-badge">${rankEmoji[i]}</div>

                ${isBest ? `<div class="pb-best-label">${rankLabels[0]}</div>` : ''}

                <!-- Cover -->
                <div class="pb-cover-wrap">
                    ${cover}
                    <span class="pb-genre-tag">${book.CategoryName || 'General'}</span>
                </div>

                <!-- Info -->
                <div class="pb-info">
                    <h4 class="pb-title" title="${book.Title}">${book.Title}</h4>
                    <p  class="pb-author">by ${book.Author}</p>

                    <div class="pb-rating-row">
                        <div class="pb-stars">${stars}</div>
                        <span class="pb-rating-num">${rating > 0 ? rating.toFixed(1) : '—'}</span>
                    </div>

                    <p class="pb-reviews">${reviews.toLocaleString()} review${reviews !== 1 ? 's' : ''}</p>

                    <a href="/browse.html" class="pb-browse-btn">View Book</a>
                </div>
            </article>`;
        }).join('');

    } catch (err) {
        console.error('Popular books error:', err);
        grid.innerHTML = `<p style="color:var(--color-text-muted);grid-column:1/-1">
            Could not load popular books right now.
        </p>`;
    }
}

// ── Star renderer for popular-books cards ────────────────────────────────────
function renderPbStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if      (i <= Math.floor(rating))  html += '<span class="pb-star pb-star--on">★</span>';
        else if (i - 0.5 <= rating)        html += '<span class="pb-star pb-star--half">★</span>';
        else                               html += '<span class="pb-star pb-star--off">★</span>';
    }
    return html;
}


