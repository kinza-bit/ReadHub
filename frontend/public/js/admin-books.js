// admin-books.js — Book CRUD management for Admin (US-01, US-02, US-03)

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const bookTableBody = document.getElementById('book-table-body');
    const bookSearch = document.getElementById('book-search');
    const categoryFilter = document.getElementById('category-filter');
    const typeFilter = document.getElementById('type-filter');
    const addBookBtn = document.getElementById('add-book-btn');
    const bookModal = document.getElementById('book-modal');
    const bookForm = document.getElementById('book-form');
    const modalTitle = document.getElementById('modal-title');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const typePhysical = document.getElementById('type-physical');
    const typeEbook = document.getElementById('type-ebook');

    // File Elements
    const coverInput = document.getElementById('cover-image-input');
    const coverPreviewContainer = document.getElementById('cover-preview-container');
    const coverPreview = document.getElementById('cover-preview');
    const clearCoverBtn = document.getElementById('clear-cover-btn');

    const pdfInput = document.getElementById('pdf-file-input');
    const pdfPreview = document.getElementById('pdf-preview');
    const pdfFileName = document.getElementById('pdf-file-name');
    const clearPdfBtn = document.getElementById('clear-pdf-btn');
    const pdfUploadGroup = document.getElementById('pdf-upload-group');

    let allBooks = [];
    let categories = [];

    // ── Initialize ──
    initSidebar();
    loadCategories();
    loadBooks();
    setupBookTypeToggle();
    setupFileInputs();

    // ── Sidebar Toggle ──
    function initSidebar() {
        const hamburger = document.getElementById('hamburger-menu');
        const closeBtn = document.getElementById('sidebar-close');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        function toggleSidebar() {
            if (sidebar) sidebar.classList.toggle('active');
            if (overlay) overlay.classList.toggle('active');
        }
        if (hamburger) hamburger.addEventListener('click', toggleSidebar);
        if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
        if (overlay) overlay.addEventListener('click', toggleSidebar);
    }

    // ── Book Type Toggle ──
    function setupBookTypeToggle() {
        const physPriceGroup = document.getElementById('physical-price-group');
        const ebookPriceGroup = document.getElementById('ebook-price-group');
        const rentalPriceGroup = document.getElementById('rental-price-group');
        const ebookPrice = document.getElementById('book-ebook-price');
        const rentalPrice = document.getElementById('book-rental-price');
        const physPrice = document.getElementById('book-physical-price');

        typePhysical.addEventListener('change', () => {
            physPriceGroup.style.opacity = typePhysical.checked ? '1' : '0.4';
            physPrice.disabled = !typePhysical.checked;
        });

        typeEbook.addEventListener('change', () => {
            const on = typeEbook.checked;
            ebookPriceGroup.style.opacity = on ? '1' : '0.4';
            rentalPriceGroup.style.opacity = on ? '1' : '0.4';
            ebookPrice.disabled = !on;
            rentalPrice.disabled = !on;
            
            pdfUploadGroup.style.opacity = on ? '1' : '0.4';
            pdfInput.disabled = !on;
            if (!on) clearPdf();
        });
    }

    // ── File Inputs Setup ──
    function setupFileInputs() {
        coverInput.addEventListener('change', () => {
            const file = coverInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = e => {
                    coverPreview.src = e.target.result;
                    coverPreviewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                clearCover();
            }
        });

        pdfInput.addEventListener('change', () => {
             const file = pdfInput.files[0];
             if (file) {
                 pdfFileName.textContent = `Selected: ${file.name}`;
                 pdfPreview.style.display = 'block';
             } else {
                 clearPdf();
             }
        });

        clearCoverBtn.addEventListener('click', clearCover);
        clearPdfBtn.addEventListener('click', clearPdf);
    }

    function clearCover() {
        coverInput.value = '';
        coverPreview.src = '';
        coverPreviewContainer.style.display = 'none';
    }

    function clearPdf() {
        pdfInput.value = '';
        pdfFileName.textContent = '';
        pdfPreview.style.display = 'none';
    }

    // ── Load Categories into filter + form select ──
    async function loadCategories() {
        try {
            const res = await fetch('/api/admin/categories');
            if (!res.ok) throw new Error('Failed');
            categories = await res.json();

            categoryFilter.innerHTML = '<option value="">All Categories</option>';
            categories.forEach(c => {
                categoryFilter.innerHTML += `<option value="${c.CategoryID}">${c.Name}</option>`;
            });

            const bookCat = document.getElementById('book-category');
            bookCat.innerHTML = '<option value="">Select category</option>';
            categories.forEach(c => {
                bookCat.innerHTML += `<option value="${c.CategoryID}">${c.Name}</option>`;
            });
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    }

    // ── Load Books ──
    async function loadBooks() {
        try {
            const res = await fetch('/api/admin/books');
            if (!res.ok) throw new Error('Failed');
            allBooks = await res.json();
            renderBooks();
        } catch (err) {
            console.error('Error loading books:', err);
            bookTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 3rem; color: var(--text-muted);">Failed to load books. Is the database running?</td></tr>`;
        }
    }

    // ── Render Book Table ──
    function renderBooks() {
        let filtered = [...allBooks];

        const search = bookSearch.value.toLowerCase().trim();
        if (search) {
            filtered = filtered.filter(b =>
                b.Title.toLowerCase().includes(search) ||
                b.Author.toLowerCase().includes(search) ||
                (b.ISBN && b.ISBN.toLowerCase().includes(search))
            );
        }

        const catId = categoryFilter.value;
        if (catId) {
            filtered = filtered.filter(b => b.CategoryID == catId);
        }

        const typeVal = typeFilter.value;
        if (typeVal === 'physical') {
            filtered = filtered.filter(b => b.PhysicalPrice > 0);
        } else if (typeVal === 'ebook') {
            filtered = filtered.filter(b => b.EbookPrice > 0);
        }

        if (!filtered.length) {
            bookTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 3rem; color: var(--text-muted);">No books found matching your criteria.</td></tr>`;
            return;
        }

        bookTableBody.innerHTML = filtered.map(book => {
            const hasPhysical = book.PhysicalPrice > 0;
            const hasEbook = book.EbookPrice > 0;
            const typeBadges = [];
            if (hasPhysical) typeBadges.push('<span class="badge badge-primary" style="font-size:0.7rem;">Physical</span>');
            if (hasEbook) typeBadges.push('<span class="badge" style="font-size:0.7rem; background: var(--color-accent); color: #fff;">eBook</span>');

            const price = hasPhysical ? `PKR ${book.PhysicalPrice.toLocaleString()}` : (hasEbook ? `PKR ${book.EbookPrice.toLocaleString()}` : '—');
            const rating = book.AverageRating ? `★ ${parseFloat(book.AverageRating).toFixed(1)}` : '—';
            const stock = book.StockLevel !== undefined ? book.StockLevel : '—';
            
            const imgSrc = book.ImageURL || null;
            const coverCell = imgSrc
                ? `<img src="${imgSrc}" alt="${book.Title}" class="rh-table-cover" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2256%22><rect width=%2240%22 height=%2256%22 fill=%22%23ddd%22 rx=%224%22/><text x=%2220%22 y=%2232%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%228%22>No img</text></svg>'">`
                : `<div class="rh-table-cover-placeholder"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path></svg></div>`;
            
            const pdfCell = book.PdfURL
                ? `<br><a href="${book.PdfURL}" target="_blank" style="font-size: 0.75rem; color: var(--color-primary);">📄 View PDF</a>`
                : '';

            return `
                <tr>
                    <td>${coverCell}</td>
                    <td><strong>${book.Title}</strong><br><small style="color: var(--text-muted);">${book.ISBN || ''}</small>${pdfCell}</td>
                    <td>${book.Author}</td>
                    <td><span class="badge badge-primary">${book.CategoryName || '—'}</span></td>
                    <td>${typeBadges.join(' ') || '—'}</td>
                    <td>${price}</td>
                    <td><span class="${stock <= 5 && stock > 0 ? 'badge badge-error' : stock == 0 ? 'badge badge-error' : ''}">${stock}</span></td>
                    <td style="color: var(--color-accent);">${rating}</td>
                    <td class="action-btns">
                        <button class="btn btn-sm btn-secondary edit-btn" data-id="${book.BookID}">Edit</button>
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${book.BookID}" data-title="${book.Title}">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.edit-btn').forEach(btn =>
            btn.addEventListener('click', () => openEditModal(btn.dataset.id))
        );
        document.querySelectorAll('.delete-btn').forEach(btn =>
            btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.title))
        );
    }

    // ── Open Add Modal ──
    addBookBtn.addEventListener('click', () => {
        modalTitle.textContent = 'Add New Book';
        document.getElementById('save-book-btn').textContent = 'Save Book';
        bookForm.reset();
        document.getElementById('book-id').value = '';
        clearCover();
        clearPdf();
        typePhysical.checked = true;
        typeEbook.checked = false;
        typePhysical.dispatchEvent(new Event('change'));
        typeEbook.dispatchEvent(new Event('change'));
        bookModal.classList.add('active');
    });

    // ── Open Edit Modal ──
    async function openEditModal(bookId) {
        try {
            const res = await fetch(`/api/admin/books/${bookId}`);
            if (!res.ok) throw new Error('Failed');
            const book = await res.json();

            modalTitle.textContent = 'Edit Book';
            document.getElementById('save-book-btn').textContent = 'Update Book';
            document.getElementById('book-id').value = book.BookID;
            document.getElementById('book-title').value = book.Title || '';
            document.getElementById('book-author').value = book.Author || '';
            document.getElementById('book-isbn').value = book.ISBN || '';
            document.getElementById('book-category').value = book.CategoryID || '';
            document.getElementById('book-physical-price').value = book.PhysicalPrice || '';
            document.getElementById('book-ebook-price').value = book.EbookPrice || '';
            document.getElementById('book-rental-price').value = book.RentalPricePerDay || '';
            document.getElementById('book-stock').value = book.StockLevel || 0;
            document.getElementById('book-description').value = book.Description || '';
            
            clearCover();
            if (book.ImageURL) {
                coverPreview.src = book.ImageURL;
                coverPreviewContainer.style.display = 'block';
            }
            
            clearPdf();
            if (book.PdfURL) {
                pdfFileName.innerHTML = `<a href="${book.PdfURL}" target="_blank">Current PDF</a> (Select new file to override)`;
                pdfPreview.style.display = 'block';
            }

            typePhysical.checked = !!book.PhysicalPrice;
            typeEbook.checked = !!book.EbookPrice;
            typePhysical.dispatchEvent(new Event('change'));
            typeEbook.dispatchEvent(new Event('change'));

            bookModal.classList.add('active');
        } catch (err) {
            console.error('Error loading book:', err);
            showToast('Failed to load book details.', 'error');
        }
    }

    // ── Save Book (Add / Update) ──
    bookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const bookId = document.getElementById('book-id').value;
        const isEdit = !!bookId;

        const title = document.getElementById('book-title').value.trim();
        const author = document.getElementById('book-author').value.trim();
        const categoryId = document.getElementById('book-category').value;

        if (!title || !author || !categoryId) {
            showToast('Title, author, and category are required.', 'error');
            return;
        }
        
        const fd = new FormData();
        fd.append('title', title);
        fd.append('author', author);
        fd.append('categoryId', categoryId);
        fd.append('isbn', document.getElementById('book-isbn').value.trim() || '');
        fd.append('description', document.getElementById('book-description').value.trim() || '');
        
        if (typePhysical.checked) {
            fd.append('physicalPrice', document.getElementById('book-physical-price').value || '');
            fd.append('stockLevel', document.getElementById('book-stock').value || '0');
            fd.append('lowStockThreshold', document.getElementById('book-threshold').value || '5');
        } else {
             fd.append('stockLevel', '0');
        }
        
        if (typeEbook.checked) {
            fd.append('ebookPrice', document.getElementById('book-ebook-price').value || '');
            fd.append('rentalPricePerDay', document.getElementById('book-rental-price').value || '');
        }

        if (coverInput.files[0]) {
             fd.append('coverImage', coverInput.files[0]);
        }
        
        if (pdfInput.files[0] && typeEbook.checked) {
             fd.append('pdfFile', pdfInput.files[0]);
        }

        const saveBtn = document.getElementById('save-book-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = isEdit ? 'Updating...' : 'Saving...';

        try {
            const url = isEdit ? `/api/admin/books/${bookId}` : '/api/admin/books';
            const method = isEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                // No Content-Type header: FormData sets it automatically with the boundary
                body: fd
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed');
            }

            closeModal(bookModal);
            showToast(isEdit ? 'Book updated successfully!' : 'Book added successfully!', 'success');
            loadBooks();
        } catch (err) {
            console.error('Save error:', err);
            showToast(err.message || 'Failed to save book.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Update Book' : 'Save Book';
        }
    });

    // ── Open Delete Modal ──
    function openDeleteModal(bookId, bookTitle) {
        document.getElementById('delete-book-id').value = bookId;
        document.getElementById('delete-book-title').textContent = bookTitle;
        deleteModal.classList.add('active');
    }

    // ── Confirm Delete ──
    confirmDeleteBtn.addEventListener('click', async () => {
        const bookId = document.getElementById('delete-book-id').value;
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Deleting...';

        try {
            const res = await fetch(`/api/admin/books/${bookId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');

            closeModal(deleteModal);
            showToast('Book deleted successfully and files removed.', 'success');
            loadBooks();
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Failed to delete book.', 'error');
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.textContent = 'Yes, Delete';
        }
    });

    function closeModal(modal) {
        modal.classList.remove('active');
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(bookModal);
            closeModal(deleteModal);
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === bookModal) closeModal(bookModal);
        if (e.target === deleteModal) closeModal(deleteModal);
    });

    let searchTimeout;
    bookSearch.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(renderBooks, 300);
    });
    categoryFilter.addEventListener('change', renderBooks);
    typeFilter.addEventListener('change', renderBooks);

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast-notification');
        const toastMsg = document.getElementById('toast-message');
        toastMsg.textContent = message;
        toast.className = `rh-toast rh-toast--${type} rh-toast--visible`;
        setTimeout(() => toast.classList.remove('rh-toast--visible'), 3500);
    }
});
