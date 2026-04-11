document.addEventListener('DOMContentLoaded', () => {
    const bookTableBody = document.getElementById('book-table-body');
    const bookSearch = document.getElementById('book-search');
    const bookModal = document.getElementById('book-modal');
    const bookForm = document.getElementById('book-form');
    const btnAddBook = document.getElementById('btn-add-book');
    const logoutBtn = document.getElementById('logout-btn');
    const alertContainer = document.getElementById('alert-container');
    const categorySelect = document.getElementById('book-category');

    // Restock Modal
    const restockModal = document.getElementById('restock-modal');
    const restockForm = document.getElementById('restock-form');

    let allBooks = [];
    let allCategories = [];

    // Initialize
    checkAuth();
    loadCategories();
    loadBooks();

    // --- Authentication ---
    async function checkAuth() {
        try {
            const response = await fetch('/api/session');
            const data = await response.json();

            if (!data.isAuthenticated || data.user.role !== 'Admin') {
                window.location.href = '/admin-login.html';
            } else {
                document.getElementById('admin-name').textContent = data.user.name;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/admin-login.html';
        }
    }

    logoutBtn.addEventListener('click', async () => {
        const response = await fetch('/api/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/index.html';
        }
    });

    // --- Data Loading ---
    async function loadCategories() {
        try {
            const response = await fetch('/api/admin/categories');
            if (response.ok) {
                allCategories = await response.json();
                categorySelect.innerHTML = '<option value="">Select a Category</option>' + 
                    allCategories.map(c => `<option value="${c.CategoryID}">${c.Name}</option>`).join('');
            }
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }

    async function loadBooks() {
        try {
            const searchTerm = bookSearch.value;
            let url = '/api/admin/books';
            
            if (searchTerm) {
                url = `/api/admin/books/search?q=${encodeURIComponent(searchTerm)}`;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch books');

            allBooks = await response.json();
            renderTable(allBooks);
        } catch (error) {
            console.error('Error loading books:', error);
            showAlert('danger', 'Failed to load books.');
        }
    }

    function getCategoryName(id) {
        const cat = allCategories.find(c => c.CategoryID === id);
        return cat ? cat.Name : 'Unknown';
    }

    function renderTable(books) {
        if (!books.length) {
            bookTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No books found.</td></tr>`;
            return;
        }

        bookTableBody.innerHTML = books.map(book => `
            <tr>
                <td>#${book.BookID}</td>
                <td>
                    ${book.ImageURL 
                        ? `<img src="${book.ImageURL}" alt="Cover" style="width: 40px; height: 60px; object-fit: cover; border-radius: 4px;">` 
                        : `<div style="width: 40px; height: 60px; background: #333; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: #888;">No IMG</div>`}
                </td>
                <td>
                    <div style="font-weight: 600;">${book.Title}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${book.Author}</div>
                </td>
                <td>${book.CategoryName || getCategoryName(book.CategoryID)}</td>
                <td>$${book.PhysicalPrice ? book.PhysicalPrice.toFixed(2) : '-'}</td>
                <td>$${book.EbookPrice ? book.EbookPrice.toFixed(2) : '-'}</td>
                <td class="action-btns">
                    <button class="btn btn-sm btn-secondary restock-btn" data-id="${book.BookID}">Restock</button>
                    <button class="btn btn-sm btn-primary edit-btn" data-id="${book.BookID}">Edit</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${book.BookID}">Delete</button>
                </td>
            </tr>
        `).join('');

        // Listeners
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.id)));
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteBook(parseInt(btn.dataset.id)));
        });

        document.querySelectorAll('.restock-btn').forEach(btn => {
            btn.addEventListener('click', () => openRestockModal(parseInt(btn.dataset.id)));
        });
    }

    // --- Search ---
    let searchTimeout;
    bookSearch.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadBooks, 500);
    });

    // --- Add / Edit Book ---
    btnAddBook.addEventListener('click', () => {
        bookForm.reset();
        document.getElementById('edit-book-id').value = '';
        document.getElementById('book-modal-title').textContent = 'Add New Book';
        bookModal.classList.add('active');
    });

    function openEditModal(bookId) {
        const book = allBooks.find(b => b.BookID === bookId);
        if (!book) return;

        document.getElementById('edit-book-id').value = book.BookID;
        document.getElementById('book-title').value = book.Title;
        document.getElementById('book-author').value = book.Author;
        document.getElementById('book-isbn').value = book.ISBN || '';
        document.getElementById('book-category').value = book.CategoryID;
        document.getElementById('book-description').value = book.Description || '';
        document.getElementById('book-physical-price').value = book.PhysicalPrice || '';
        document.getElementById('book-ebook-price').value = book.EbookPrice || '';
        
        // Disable stock field on edit (stock is managed via restock or inventory)
        document.getElementById('book-stock').value = book.StockLevel || 0;
        document.getElementById('book-stock').disabled = true;

        document.getElementById('book-image-url').value = book.ImageURL || '';
        
        document.getElementById('book-modal-title').textContent = 'Edit Book';
        bookModal.classList.add('active');
    }

    bookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const bookId = document.getElementById('edit-book-id').value;
        const payload = {
            title: document.getElementById('book-title').value,
            author: document.getElementById('book-author').value,
            isbn: document.getElementById('book-isbn').value,
            categoryId: parseInt(document.getElementById('book-category').value),
            description: document.getElementById('book-description').value,
            physicalPrice: parseFloat(document.getElementById('book-physical-price').value) || null,
            ebookPrice: parseFloat(document.getElementById('book-ebook-price').value) || null,
            stockLevel: parseInt(document.getElementById('book-stock').value) || 0,
            imageUrl: document.getElementById('book-image-url').value
        };

        try {
            let url = '/api/admin/books';
            let method = 'POST';

            if (bookId) {
                url = `/api/admin/books/${bookId}`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showAlert('success', bookId ? 'Book updated successfully!' : 'Book added successfully!');
                closeModal();
                loadBooks();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to finish operation');
            }
        } catch (error) {
            showAlert('error', error.message);
        }
    });

    // --- Delete Book ---
    async function deleteBook(bookId) {
        if (!confirm('Are you sure you want to delete this book? This action cannot be undone.')) return;

        try {
            const response = await fetch(`/api/admin/books/${bookId}`, { method: 'DELETE' });
            if (response.ok) {
                showAlert('success', 'Book deleted successfully.');
                loadBooks();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete book');
            }
        } catch (error) {
            showAlert('error', error.message);
        }
    }

    // --- Restock Modal ---
    function openRestockModal(bookId) {
        const book = allBooks.find(b => b.BookID === bookId);
        if (!book) return;

        document.getElementById('restock-book-id').value = book.BookID;
        document.getElementById('restock-book-title').textContent = book.Title;
        document.getElementById('restock-quantity').value = 10; // Default
        
        restockModal.classList.add('active');
    }

    restockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const bookId = document.getElementById('restock-book-id').value;
        const quantityToAdd = parseInt(document.getElementById('restock-quantity').value);

        try {
            const response = await fetch(`/api/admin/inventory/${bookId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantityToAdd })
            });

            if (response.ok) {
                showAlert('success', 'Stock updated successfully!');
                closeModal();
                loadBooks();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Update failed');
            }
        } catch (error) {
            showAlert('error', error.message);
        }
    });

    // --- Helpers ---
    function closeModal() {
        bookModal.classList.remove('active');
        restockModal.classList.remove('active');
        document.getElementById('book-stock').disabled = false;
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    window.addEventListener('click', (e) => {
        if (e.target === bookModal || e.target === restockModal) closeModal();
    });

    function showAlert(type, message) {
        alertContainer.className = `alert alert-${type === 'success' ? 'success' : 'error'}`;
        alertContainer.textContent = message;
        alertContainer.style.display = 'block';
        setTimeout(() => { alertContainer.style.display = 'none'; }, 3000);
    }
});
