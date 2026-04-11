document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const catalogSearch = document.getElementById('catalog-search');
    const categoryFilters = document.getElementById('category-filters');
    const booksGrid = document.getElementById('books-grid');
    const noResultsMsg = document.getElementById('no-results-msg');
    const typeFilter = document.getElementById('type-filter');
    const sortFilter = document.getElementById('sort-filter');
    const alertContainer = document.getElementById('alert-container');
    
    // Rating Modal
    const ratingModal = document.getElementById('rating-modal');
    const ratingForm = document.getElementById('rating-form');
    const stars = document.querySelectorAll('#star-rating-container span');

    // State
    let allCategories = [];
    let currentBooks = [];
    let currentCategoryId = '';
    let searchQuery = '';

    // Initialize
    initDashboard();

    async function initDashboard() {
        await loadCategories();
        await fetchAndRenderBooks();
    }

    // --- Data Fetching ---

    async function loadCategories() {
        try {
            const res = await fetch('/api/categories');
            if (!res.ok) throw new Error('Failed to fetch categories');
            
            allCategories = await res.json();
            
            // Append categories to filter bar (All Categories is already hardcoded)
            allCategories.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-sm btn-secondary category-pill';
                btn.dataset.id = cat.CategoryID;
                btn.textContent = cat.Name || cat.CategoryName;
                categoryFilters.appendChild(btn);
            });

            // Add listener to category pills
            document.querySelectorAll('.category-pill').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.category-pill').forEach(b => {
                        b.classList.remove('btn-primary');
                        b.classList.add('btn-secondary');
                    });
                    e.target.classList.remove('btn-secondary');
                    e.target.classList.add('btn-primary');

                    currentCategoryId = e.target.dataset.id;
                    // Reset search if selecting category directly, or apply both. Let's reset search to make it clean.
                    catalogSearch.value = '';
                    searchQuery = '';
                    fetchAndRenderBooks();
                });
            });
        } catch (err) {
            console.error(err);
        }
    }

    async function fetchAndRenderBooks() {
        try {
            renderLoading();
            let url = '/api/books'; // Default: view available books

            if (searchQuery) {
                // If there's a search term, prioritize search
                url = `/api/books/search?q=${encodeURIComponent(searchQuery)}`;
            } else if (currentCategoryId) {
                // If a specific category is selected
                url = `/api/books/category/${currentCategoryId}`;
            }

            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch books');
            
            let data = await res.json();
            
            // Apply extra front-end filters locally (Type and Sort)
            data = applyLocalFilters(data);
            
            currentBooks = data;
            renderBooksGrid(currentBooks);

        } catch (err) {
            console.error(err);
            showAlert('error', 'Failed to load books. Please try again.');
            booksGrid.innerHTML = '';
        }
    }

    // --- Filtering and Sorting (Local) ---
    function applyLocalFilters(books) {
        // Filter by type (physical or ebook) if selected
        const format = typeFilter.value;
        if (format === 'physical') {
            books = books.filter(b => b.PhysicalPrice !== null);
        } else if (format === 'ebook') {
            books = books.filter(b => b.EbookPrice !== null || b.RentalPricePerDay !== null);
        }

        // Sort books
        const sortMode = sortFilter.value;
        if (sortMode === 'rating') {
            books.sort((a, b) => (b.AverageRating || 0) - (a.AverageRating || 0));
        } else if (sortMode === 'title') {
            books.sort((a, b) => a.Title.localeCompare(b.Title));
        } else if (sortMode === 'price') {
            // Sort by lowest available price (Physical vs Ebook)
            books.sort((a, b) => {
                const getMinPrice = book => Math.min(book.PhysicalPrice || 9999, book.EbookPrice || 9999);
                return getMinPrice(a) - getMinPrice(b);
            });
        }

        return books;
    }

    // Listener for local filters
    typeFilter.addEventListener('change', () => {
        if(currentBooks.length > 0 || searchQuery !== '' || currentCategoryId !== '') fetchAndRenderBooks();
    });
    
    sortFilter.addEventListener('change', () => {
        if(currentBooks.length > 0 || searchQuery !== '' || currentCategoryId !== '') fetchAndRenderBooks();
    });

    // --- Search ---
    let searchTimeout;
    catalogSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        if (searchQuery) {
            // Optional: reset category pill to "All Categories" to avoid confusion
            document.querySelectorAll('.category-pill').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-secondary');
            });
            document.querySelector('.category-pill[data-id=""]').classList.add('btn-primary');
            currentCategoryId = '';
        }

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(fetchAndRenderBooks, 400); // 400ms debounce
    });

    // --- Renderers ---
    function renderLoading() {
        booksGrid.style.display = 'grid';
        noResultsMsg.style.display = 'none';
        booksGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <p style="color: var(--text-muted);">Loading books...</p>
            </div>
        `;
    }

    function renderBooksGrid(books) {
        if (!books || books.length === 0) {
            booksGrid.style.display = 'none';
            noResultsMsg.style.display = 'flex';
            return;
        }

        booksGrid.style.display = 'grid';
        noResultsMsg.style.display = 'none';

        booksGrid.innerHTML = books.map(book => {
            const priceDisplay = book.PhysicalPrice 
                ? `$${book.PhysicalPrice.toFixed(2)}` 
                : (book.EbookPrice ? `$${book.EbookPrice.toFixed(2)} (eBook)` : 'N/A');
                
            const ratingDisplay = book.AverageRating > 0 
                ? generateStarsHTML(book.AverageRating)
                : '<span style="color:var(--text-muted); font-size:0.85rem;">No ratings yet</span>';

            const coverHtml = book.ImageURL
                ? `<img src="${book.ImageURL}" alt="${book.Title}" style="width: 100%; height: 300px; object-fit: cover; border-top-left-radius: 1rem; border-top-right-radius: 1rem;">`
                : `<div style="width: 100%; height: 300px; background: #2a2a2a; display:flex; align-items:center; justify-content:center; color: #777; border-top-left-radius: 1rem; border-top-right-radius: 1rem;">No Cover</div>`;

            return `
                <div class="book-card glass" style="display: flex; flex-direction: column; border-radius: 1rem; overflow: hidden; transition: transform 0.2s;">
                    ${coverHtml}
                    <div style="padding: 1.5rem; flex: 1; display: flex; flex-direction: column;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                            <h3 style="font-size: 1.1rem; margin: 0; line-height: 1.3;">${book.Title}</h3>
                        </div>
                        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.5rem;">by ${book.Author}</p>
                        
                        <div style="margin-bottom: 1rem;">
                            ${ratingDisplay} 
                            <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.25rem;">(${book.AverageRating ? book.AverageRating.toFixed(1) : '0.0'})</span>
                        </div>

                        <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 600; font-size: 1.1rem; color: var(--accent);">${priceDisplay}</span>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-sm btn-secondary rate-book-btn" data-id="${book.BookID}" data-title="${book.Title}">Rate</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach listeners for rating buttons
        document.querySelectorAll('.rate-book-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openRatingModal(e.target.dataset.id, e.target.dataset.title));
        });
    }

    function generateStarsHTML(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        
        let html = '';
        for(let i=0; i<fullStars; i++) html += '<span style="color:#ffd700;">★</span>';
        if(halfStar) html += '<span style="color:#ffd700;">✮</span>';
        for(let i=0; i<emptyStars; i++) html += '<span style="color:#555;">☆</span>';
        
        return html;
    }

    // --- Rating Feature (US-06.5) ---
    function openRatingModal(bookId, title) {
        document.getElementById('rating-book-id').value = bookId;
        document.getElementById('rating-book-title').textContent = title;
        document.getElementById('rating-value').value = '';
        
        // Reset stars
        stars.forEach(s => {
            s.textContent = '☆';
            s.style.color = '#555';
        });

        ratingModal.classList.add('active');
    }

    stars.forEach(star => {
        star.addEventListener('click', (e) => {
            const val = parseInt(e.target.dataset.val);
            document.getElementById('rating-value').value = val;
            
            stars.forEach((s, i) => {
                if (i < val) {
                    s.textContent = '★';
                    s.style.color = '#ffd700';
                } else {
                    s.textContent = '☆';
                    s.style.color = '#555';
                }
            });
        });
    });

    ratingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const bookId = document.getElementById('rating-book-id').value;
        const rating = document.getElementById('rating-value').value;

        if (!rating) {
            showAlert('error', 'Please select a star rating.');
            return;
        }

        try {
            const response = await fetch(`/api/books/${bookId}/rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: parseInt(rating) })
            });

            if (response.ok) {
                showAlert('success', 'Thank you for your rating!');
                closeModal();
                fetchAndRenderBooks(); // Refresh to show new average rating
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to submit rating. Make sure you bought this book.');
            }
        } catch (error) {
            showAlert('error', error.message);
        }
    });

    function closeModal() {
        ratingModal.classList.remove('active');
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    window.addEventListener('click', (e) => {
        if (e.target === ratingModal) closeModal();
    });

    function showAlert(type, message) {
        alertContainer.className = `alert alert-${type === 'success' ? 'success' : 'error'}`;
        alertContainer.textContent = message;
        alertContainer.style.display = 'block';
        setTimeout(() => { alertContainer.style.display = 'none'; }, 3000);
    }
});
