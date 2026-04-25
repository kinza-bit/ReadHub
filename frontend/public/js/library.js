// library.js — User Library for Ebooks

document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('library-loading');
    const empty = document.getElementById('library-empty');
    const grid = document.getElementById('library-grid');

    loadLibrary();

    async function loadLibrary() {
        try {
            const res = await fetch('/api/ebook/library');
            if (!res.ok) throw new Error('Failed to load library');
            const items = await res.json();

            loading.style.display = 'none';

            if (!items.length) {
                empty.style.display = 'flex';
                return;
            }

            grid.innerHTML = items.map(item => {
                const isRental = item.FormatID === 3;
                let statusHtml = '';
                let actionBtn = '';

                const coverImg = item.ImageURL
                    ? `<img src="${item.ImageURL}" alt="${item.Title}" class="rh-card-cover" loading="lazy">`
                    : `<div class="rh-card-cover rh-card-cover--placeholder">📖</div>`;

                if (isRental) {
                    const dueDate = new Date(item.DueDate);
                    const now = new Date();
                    const isExpired = now > dueDate;
                    
                    if (isExpired) {
                        statusHtml = `<span class="badge badge-error">Expired on ${dueDate.toLocaleDateString()}</span>`;
                        actionBtn = `<button class="btn btn-secondary btn-sm" disabled>Access Expired</button>`;
                    } else {
                        statusHtml = `<span class="badge badge-pending">Rented until ${dueDate.toLocaleDateString()}</span>`;
                        actionBtn = `<button class="btn btn-primary btn-sm access-btn" data-order="${item.OrderID}" data-book="${item.BookID}" data-format="${item.FormatID}">Read Now</button>`;
                    }
                } else {
                    // Permanent Download
                    const downloadsLeft = item.MaxDownloads - item.DownloadCount;
                    statusHtml = `<span class="badge badge-success">Purchased</span>
                                  <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 0.25rem;">
                                      Downloads: ${item.DownloadCount}/${item.MaxDownloads}
                                  </div>`;
                    
                    if (downloadsLeft > 0) {
                        actionBtn = `<button class="btn btn-primary btn-sm access-btn" data-order="${item.OrderID}" data-book="${item.BookID}" data-format="${item.FormatID}">Download PDF</button>`;
                    } else {
                        actionBtn = `<button class="btn btn-secondary btn-sm" disabled>Download Limit Reached</button>`;
                    }
                }

                return `
                    <div class="rh-book-card glass" style="display:flex; flex-direction:column;">
                        <div class="rh-card-cover-wrap">
                            ${coverImg}
                            <span class="rh-type-badge">${isRental ? 'Rental' : 'eBook'}</span>
                        </div>
                        <div class="rh-card-body" style="flex: 1; display: flex; flex-direction: column;">
                            <h3 class="rh-card-title">${item.Title}</h3>
                            <p class="rh-card-author">by ${item.Author}</p>
                            
                            <div style="margin: 1rem 0; flex: 1;">
                                ${statusHtml}
                            </div>
                            
                            <div style="margin-top: auto; width: 100%;">
                                ${actionBtn}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            grid.style.display = 'grid';

            // Attach access listeners
            document.querySelectorAll('.access-btn').forEach(btn => {
                btn.addEventListener('click', () => requestAccess(btn.dataset.order, btn.dataset.book, btn.dataset.format, btn));
            });

        } catch (err) {
            console.error('Error loading library:', err);
            loading.innerHTML = '<p style="color: #ef4444;">Failed to load library.</p>';
        }
    }

    async function requestAccess(orderId, bookId, formatId, btnEl) {
        const origText = btnEl.innerText;
        btnEl.disabled = true;
        btnEl.innerText = 'Requesting Access...';

        try {
            const res = await fetch(`/api/ebook/access/${orderId}/${bookId}/${formatId}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to get access.');
            }

            if (data.signedUrl) {
                // Open the secure Supabase URL
                let finalUrl = data.signedUrl;
                
                // If it's a rental, try to hide the browser PDF download toolbar
                if (data.accessType === 'Rent') {
                    finalUrl += '#toolbar=0'; 
                }

                window.open(finalUrl, '_blank');
                showToast('Access granted! Opening secure link...', 'success');
                
                // If it's a download, reload library to update download count after a short delay
                if (data.accessType === 'Download') {
                    setTimeout(loadLibrary, 2000);
                }
            } else {
                throw new Error('No URL returned.');
            }

        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btnEl.disabled = false;
            btnEl.innerText = origText;
        }
    }

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast-notification');
        const toastMsg = document.getElementById('toast-message');
        toastMsg.textContent = message;
        toast.className = `rh-toast rh-toast--${type} rh-toast--visible`;
        setTimeout(() => toast.classList.remove('rh-toast--visible'), 3500);
    }
});
