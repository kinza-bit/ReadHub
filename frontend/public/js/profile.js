// profile.js

document.addEventListener('DOMContentLoaded', () => {
    fetchProfileData();
    fetchUserLibrary();
    fetchUserWishlist();

    const form = document.getElementById('profile-form');
    if(form) {
        form.addEventListener('submit', handleProfileUpdate);
    }
});

function scrollToSection(id) {
    const el = document.getElementById(id);
    if(el) {
        window.scrollTo({
            top: el.offsetTop - 100,
            behavior: 'smooth'
        });
    }
}

async function fetchProfileData() {
    try {
        const response = await fetch('/api/profile');
        if (!response.ok) {
            console.error('Failed to fetch profile');
            return;
        }

        const user = await response.json();
        
        // Populate display
        document.getElementById('profile-display-name').textContent = user.FullName;
        document.getElementById('profile-email').textContent = user.Email;
        
        const avatarUrl = user.ProfileImageURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.FullName)}&background=7C3AED&color=fff&bold=true&size=200`;
        document.getElementById('main-avatar').src = avatarUrl;
        
        // Populate form
        document.getElementById('input-fullname').value = user.FullName || '';
        document.getElementById('input-phone').value = user.PhoneNumber || '';
        document.getElementById('input-avatar-url').value = user.ProfileImageURL || '';
        document.getElementById('input-address').value = user.AddressLine1 || '';
        document.getElementById('input-city').value = user.City || '';
        document.getElementById('input-country').value = user.Country || '';

    } catch (error) {
        console.error('Error fetching profile:', error);
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    const data = {
        fullName: document.getElementById('input-fullname').value,
        phoneNumber: document.getElementById('input-phone').value,
        profileImageUrl: document.getElementById('input-avatar-url').value,
        addressLine1: document.getElementById('input-address').value,
        city: document.getElementById('input-city').value,
        country: document.getElementById('input-country').value,
    };

    try {
        const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('Profile updated successfully!');
            fetchProfileData(); // refresh avatar and name
        } else {
            const err = await response.json();
            alert(err.error || 'Failed to update profile');
        }
    } catch (error) {
        console.error('Update error:', error);
        alert('An error occurred.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function fetchUserLibrary() {
    try {
        const response = await fetch('/api/user/purchases');
        const container = document.getElementById('purchases-container');
        const badge = document.getElementById('badge-library');
        
        if (!response.ok) {
            container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Failed to load library.</div>`;
            return;
        }

        const items = await response.json();
        badge.textContent = items.length;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <div class="empty-icon"><svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></div>
                    <h4>Your Library is Empty</h4>
                    <p>You haven't purchased any books yet. Start exploring the store!</p>
                    <a href="/browse.html" class="btn-save mt-3" style="text-decoration:none; display:inline-block;">Browse Books</a>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="book-card" onclick="window.location.href='/browse.html?bookId=${item.BookID}'" style="width: 100%;">
                <div class="book-cover">
                    <img src="${item.ImageURL || 'https://via.placeholder.com/200x300?text=No+Cover'}" alt="${item.Title}">
                </div>
                <div class="book-info">
                    <h4 class="book-title">${item.Title}</h4>
                    <p style="color:var(--color-text-muted); font-size:0.875rem;">Qty: ${item.Quantity}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error fetching library:', error);
    }
}

async function fetchUserWishlist() {
    try {
        const response = await fetch('/api/user/wishlist');
        const container = document.getElementById('wishlist-container');
        const badge = document.getElementById('badge-wishlist');
        
        if (!response.ok) {
            container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Failed to load wishlist.</div>`;
            return;
        }

        const items = await response.json();
        badge.textContent = items.length;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <div class="empty-icon"><svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" fill="none" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></div>
                    <h4>Your Wishlist is Empty</h4>
                    <p>Save books here to view them later.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="book-card" style="width: 100%;">
                <div class="book-cover" onclick="window.location.href='/browse.html?bookId=${item.BookID}'">
                    <img src="${item.ImageURL || 'https://via.placeholder.com/200x300?text=No+Cover'}" alt="${item.Title}">
                </div>
                <div class="book-info" style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="flex:1; overflow:hidden;">
                        <h4 class="book-title">${item.Title}</h4>
                        <p style="color:var(--color-text-muted); font-size:0.875rem;">${item.Author}</p>
                    </div>
                    <button class="remove-btn" onclick="removeFromWishlist('${item.BookID}')" title="Remove" style="background:none; border:none; color:#ef4444; cursor:pointer;">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error fetching wishlist:', error);
    }
}

async function removeFromWishlist(bookId) {
    if(!confirm('Remove this book from your wishlist?')) return;
    try {
        const response = await fetch('/api/user/wishlist/' + bookId, {
            method: 'DELETE'
        });
        if(response.ok) {
            fetchUserWishlist(); // refresh list
        } else {
            alert('Failed to remove from wishlist');
        }
    } catch(err) {
        console.error(err);
    }
}
