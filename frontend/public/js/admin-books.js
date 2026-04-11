/**
 * admin-books.js — Book Management Page Logic
 * Handles: Load/render books table, Add/Edit/Delete flows,
 *          Search with debounce, Form validation, Success/error feedback
 */
document.addEventListener('DOMContentLoaded', () => {
    // ─── DOM REFS ─────────────────────────────────────────────────
    const tableBody       = document.getElementById('books-table-body');
    const searchInput     = document.getElementById('book-search');
    const categoryFilter  = document.getElementById('category-filter');
    const btnAddBook      = document.getElementById('btn-add-book');

    // Modal
    const bookModal       = document.getElementById('book-modal');
    const bookModalTitle  = document.getElementById('book-modal-title');
    const bookForm        = document.getElementById('book-form');
    const bookIdField     = document.getElementById('book-id');
    const bookSubmitBtn   = document.getElementById('book-submit-btn');
    const closeModalBtns  = bookModal.querySelectorAll('.close-modal');

    // Form fields
    const fields = {
        title:        document.getElementById('book-title'),
        author:       document.getElementById('book-author'),
        isbn:         document.getElementById('book-isbn'),
        category:     document.getElementById('book-category'),
        stock:        document.getElementById('book-stock'),
        description:  document.getElementById('book-description'),
        physicalPrice:document.getElementById('book-physical-price'),
        ebookPrice:   document.getElementById('book-ebook-price'),
        rentalPrice:  document.getElementById('book-rental-price'),
        lateFee:      document.getElementById('book-late-fee'),
        imageUrl:     document.getElementById('book-image-url'),
        pdfUrl:       document.getElementById('book-pdf-url'),
    };

    // Image preview
    const imagePreview    = document.getElementById('image-preview');
    const imagePreviewImg = document.getElementById('image-preview-img');

    // Delete dialog
    const deleteConfirm   = document.getElementById('delete-confirm');
    const deleteMessage   = document.getElementById('delete-confirm-message');
    const btnConfirmDel   = document.getElementById('btn-confirm-delete');
    const btnCancelDel    = document.getElementById('btn-cancel-delete');

    // Sidebar
    const hamburger = document.getElementById('hamburger-menu');
    const closeBtn  = document.getElementById('sidebar-close');
    const sidebar   = document.getElementById('sidebar');
    const overlay   = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
    if (hamburger) hamburger.addEventListener('click', toggleSidebar);
    if (closeBtn)  closeBtn.addEventListener('click', toggleSidebar);
    if (overlay)   overlay.addEventListener('click', toggleSidebar);

    // ─── STATE ────────────────────────────────────────────────────
    let allBooks    = [];
    let categories  = [];
    let deleteBookId = null;
    let debounceTimer = null;

    // ─── TOAST HELPER ─────────────────────────────────────────────
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;
        container.appendChild(toast);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        });

        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('toast-exit');
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }

    // ─── LOAD CATEGORIES ──────────────────────────────────────────
    async function loadCategories() {
        try {
            const res = await fetch('/api/admin/categories');
            if (!res.ok) throw new Error('Failed');
            categories = await res.json();

            // Populate filter dropdown
            categoryFilter.innerHTML = '<option value="">All Categories</option>';
            categories.forEach(cat => {
                categoryFilter.innerHTML += `<option value="${cat.CategoryID}">${cat.CategoryName}</option>`;
            });

            // Populate form dropdown
            fields.category.innerHTML = '<option value="">Select category</option>';
            categories.forEach(cat => {
                fields.category.innerHTML += `<option value="${cat.CategoryID}">${cat.CategoryName}</option>`;
            });
        } catch (err) {
            console.error('Load categories error:', err);
        }
    }

    // ─── LOAD BOOKS ───────────────────────────────────────────────
    async function loadBooks() {
        try {
            const res = await fetch('/api/admin/books');
            if (!res.ok) throw new Error('Failed to load books');
            allBooks = await res.json();
            renderBooks(allBooks);
        } catch (err) {
            console.error('Load books error:', err);
            tableBody.innerHTML = `
                <tr><td colspan="9" class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-title">Failed to load books</div>
                    <p>Please check your connection and try again.</p>
                </td></tr>`;
        }
    }

    // ─── RENDER BOOKS TABLE ───────────────────────────────────────
    function renderBooks(books) {
        if (!books || books.length === 0) {
            tableBody.innerHTML = `
                <tr><td colspan="9" class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <div class="empty-state-title">No books found</div>
                    <p>Add your first book to get started.</p>
                </td></tr>`;
            return;
        }

        tableBody.innerHTML = books.map(book => {
            const coverHtml = book.ImageURL
                ? `<img src="${book.ImageURL}" alt="${book.Title}" class="book-thumb" onerror="this.outerHTML='<div class=\\'book-thumb-placeholder\\'>📖</div>'">`
                : `<div class="book-thumb-placeholder">📖</div>`;

            const catName = book.CategoryName || 'Uncategorized';

            // Determine type
            let typeHtml = '';
            const hasPhysical = book.PhysicalPrice && parseFloat(book.PhysicalPrice) > 0;
            const hasEbook = book.EbookPrice && parseFloat(book.EbookPrice) > 0;
            if (hasPhysical && hasEbook) {
                typeHtml = '<span class="badge-both">Both</span>';
            } else if (hasEbook) {
                typeHtml = '<span class="badge-ebook">eBook</span>';
            } else {
                typeHtml = '<span class="badge-physical">Physical</span>';
            }

            // Price display
            const prices = [];
            if (hasPhysical) prices.push(`$${parseFloat(book.PhysicalPrice).toFixed(2)}`);
            if (hasEbook) prices.push(`$${parseFloat(book.EbookPrice).toFixed(2)} (e)`);
            const priceDisplay = prices.length ? prices.join(' / ') : '—';

            // Stock
            const stock = book.StockLevel !== undefined && book.StockLevel !== null ? book.StockLevel : '—';
            let stockClass = 'stock-good';
            if (stock === '—' || stock <= 0) stockClass = 'stock-out';
            else if (stock <= 5) stockClass = 'stock-low';

            return `
                <tr>
                    <td>${coverHtml}</td>
                    <td><strong>${escapeHtml(book.Title)}</strong></td>
                    <td>${escapeHtml(book.Author || '—')}</td>
                    <td><code style="font-size:0.8rem;">${escapeHtml(book.ISBN || '—')}</code></td>
                    <td><span class="badge-primary">${escapeHtml(catName)}</span></td>
                    <td>${priceDisplay}</td>
                    <td><span class="${stockClass}">${stock}</span></td>
                    <td>${typeHtml}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn btn-secondary btn-sm" onclick="editBook(${book.BookID})" title="Edit">✏️</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteBook(${book.BookID}, '${escapeHtml(book.Title).replace(/'/g, "\\'")}')" title="Delete">🗑️</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    // ─── ESCAPE HTML ──────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── SEARCH WITH DEBOUNCE ─────────────────────────────────────
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            filterBooks();
        }, 300);
    });

    categoryFilter.addEventListener('change', filterBooks);

    function filterBooks() {
        const query = searchInput.value.toLowerCase().trim();
        const catId = categoryFilter.value;

        let filtered = allBooks;

        if (query) {
            filtered = filtered.filter(b =>
                (b.Title && b.Title.toLowerCase().includes(query)) ||
                (b.Author && b.Author.toLowerCase().includes(query)) ||
                (b.ISBN && b.ISBN.toLowerCase().includes(query))
            );
        }

        if (catId) {
            filtered = filtered.filter(b => String(b.CategoryID) === catId);
        }

        renderBooks(filtered);
    }

    // ─── IMAGE PREVIEW ────────────────────────────────────────────
    fields.imageUrl.addEventListener('input', () => {
        const url = fields.imageUrl.value.trim();
        if (url) {
            imagePreviewImg.src = url;
            imagePreview.classList.add('has-image');
            imagePreviewImg.onerror = () => {
                imagePreview.classList.remove('has-image');
            };
        } else {
            imagePreview.classList.remove('has-image');
        }
    });

    // ─── OPEN ADD MODAL ───────────────────────────────────────────
    btnAddBook.addEventListener('click', () => {
        bookForm.reset();
        bookIdField.value = '';
        bookModalTitle.textContent = 'Add New Book';
        bookSubmitBtn.textContent = 'Add Book';
        imagePreview.classList.remove('has-image');
        bookModal.classList.add('active');
    });

    // ─── CLOSE MODAL ──────────────────────────────────────────────
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => bookModal.classList.remove('active'));
    });
    bookModal.addEventListener('click', (e) => {
        if (e.target === bookModal) bookModal.classList.remove('active');
    });

    // ─── EDIT BOOK ────────────────────────────────────────────────
    window.editBook = function (bookId) {
        const book = allBooks.find(b => b.BookID === bookId);
        if (!book) return;

        bookIdField.value = book.BookID;
        bookModalTitle.textContent = 'Edit Book';
        bookSubmitBtn.textContent = 'Save Changes';

        fields.title.value        = book.Title || '';
        fields.author.value       = book.Author || '';
        fields.isbn.value         = book.ISBN || '';
        fields.category.value     = book.CategoryID || '';
        fields.stock.value        = book.StockLevel !== undefined ? book.StockLevel : 0;
        fields.description.value  = book.Description || '';
        fields.physicalPrice.value = book.PhysicalPrice || '';
        fields.ebookPrice.value   = book.EbookPrice || '';
        fields.rentalPrice.value  = book.RentalPricePerDay || '';
        fields.lateFee.value      = book.LateFeePerDay || '';
        fields.imageUrl.value     = book.ImageURL || '';
        fields.pdfUrl.value       = book.PdfURL || '';

        if (book.ImageURL) {
            imagePreviewImg.src = book.ImageURL;
            imagePreview.classList.add('has-image');
        } else {
            imagePreview.classList.remove('has-image');
        }

        bookModal.classList.add('active');
    };

    // ─── FORM SUBMIT (ADD / EDIT) ─────────────────────────────────
    bookForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const isEdit = !!bookIdField.value;
        const payload = {
            title:           fields.title.value.trim(),
            author:          fields.author.value.trim(),
            isbn:            fields.isbn.value.trim() || null,
            categoryId:      parseInt(fields.category.value),
            description:     fields.description.value.trim() || null,
            physicalPrice:   parseFloat(fields.physicalPrice.value) || null,
            ebookPrice:      parseFloat(fields.ebookPrice.value) || null,
            rentalPricePerDay: parseFloat(fields.rentalPrice.value) || null,
            lateFeePerDay:   parseFloat(fields.lateFee.value) || null,
            imageUrl:        fields.imageUrl.value.trim() || null,
            pdfUrl:          fields.pdfUrl.value.trim() || null,
            stockLevel:      parseInt(fields.stock.value) || 0,
        };

        // Validation
        if (!payload.title || !payload.author || !payload.categoryId) {
            showToast('Title, Author, and Category are required.', 'error');
            return;
        }

        try {
            bookSubmitBtn.disabled = true;
            bookSubmitBtn.textContent = 'Saving...';

            const url = isEdit ? `/api/admin/books/${bookIdField.value}` : '/api/admin/books';
            const method = isEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to save book.');
            }

            showToast(isEdit ? 'Book updated successfully!' : 'Book added successfully!');
            bookModal.classList.remove('active');
            await loadBooks();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            bookSubmitBtn.disabled = false;
            bookSubmitBtn.textContent = isEdit ? 'Save Changes' : 'Add Book';
        }
    });

    // ─── DELETE BOOK ──────────────────────────────────────────────
    window.deleteBook = function (bookId, bookTitle) {
        deleteBookId = bookId;
        deleteMessage.textContent = `Are you sure you want to delete "${bookTitle}"? This action cannot be undone.`;
        deleteConfirm.classList.add('active');
    };

    btnConfirmDel.addEventListener('click', async () => {
        if (!deleteBookId) return;

        try {
            btnConfirmDel.disabled = true;
            btnConfirmDel.textContent = 'Deleting...';

            const res = await fetch(`/api/admin/books/${deleteBookId}`, { method: 'DELETE' });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to delete book.');

            showToast('Book deleted successfully!');
            deleteConfirm.classList.remove('active');
            await loadBooks();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btnConfirmDel.disabled = false;
            btnConfirmDel.textContent = 'Delete';
            deleteBookId = null;
        }
    });

    btnCancelDel.addEventListener('click', () => {
        deleteConfirm.classList.remove('active');
        deleteBookId = null;
    });

    deleteConfirm.addEventListener('click', (e) => {
        if (e.target === deleteConfirm) {
            deleteConfirm.classList.remove('active');
            deleteBookId = null;
        }
    });

    // ─── INIT ─────────────────────────────────────────────────────
    loadCategories().then(() => loadBooks());
});
