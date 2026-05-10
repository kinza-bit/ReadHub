// profile.js

document.addEventListener('DOMContentLoaded', () => {
    fetchProfileData();
    fetchUserWishlist();

    const form = document.getElementById('profile-form');
    if(form) {
        form.addEventListener('submit', handleProfileUpdate);
        
        // Add real-time listeners and strict restrictions
        ['input-fullname', 'input-phone', 'input-address', 'input-city', 'input-country'].forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;
            
            input.addEventListener('input', () => validateProfileField(id));
            input.addEventListener('blur', () => validateProfileField(id));

            // Strict input restrictions
            if (id === 'input-fullname' || id === 'input-city' || id === 'input-country') {
                input.addEventListener('keypress', (e) => {
                    if (!/[a-zA-Z\s]/.test(e.key)) e.preventDefault();
                });
            }
            if (id === 'input-phone') {
                input.addEventListener('keypress', (e) => {
                    if (!/\d/.test(e.key)) e.preventDefault();
                });
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 11);
                });
            }
        });
    }
});

function validateProfileField(id) {
    const input = document.getElementById(id);
    const val = input.value.trim();
    const errEl = document.getElementById(id + '-error');
    
    input.classList.remove('invalid');
    if (errEl) {
        errEl.style.display = 'none';
        errEl.textContent = '';
    }

    // 1. Full Name
    if (id === 'input-fullname') {
        if (!val) {
            showFieldError(id, 'Full name is required');
            return false;
        }
        if (val.length < 3) {
            showFieldError(id, 'Name must be at least 3 characters long');
            return false;
        }
        if (!/^[a-zA-Z\s]+$/.test(val)) {
            showFieldError(id, 'Name can only contain letters and spaces');
            return false;
        }
    }

    // 2. Phone Number
    if (id === 'input-phone' && val) {
        const cleanPhone = val.replace(/\D/g, '');
        if (!/^03\d{9}$/.test(cleanPhone)) {
            showFieldError(id, 'Enter a valid 11-digit phone number starting with 03');
            return false;
        }
    }

    // 3. Address
    if (id === 'input-address' && val) {
        if (val.length < 10) {
            showFieldError(id, 'Please enter a more detailed address (min 10 characters)');
            return false;
        }
    }

    // 4. City & Country
    if (id === 'input-city' || id === 'input-country') {
        if (val) {
            if (!/^[a-zA-Z\s]+$/.test(val)) {
                showFieldError(id, 'Must contain letters and spaces only');
                return false;
            }
            if (val.length < 2) {
                showFieldError(id, 'Too short');
                return false;
            }
        }
    }

    return true;
}

function showFieldError(id, msg) {
    const el = document.getElementById(id);
    el.classList.add('invalid');
    const errEl = document.getElementById(id + '-error');
    if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
        errEl.style.color = 'var(--prism-3)';
    }
}

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
        document.getElementById('input-address').value = user.AddressLine1 || '';
        document.getElementById('input-city').value = user.City || '';
        document.getElementById('input-country').value = user.Country || '';

    } catch (error) {
        console.error('Error fetching profile:', error);
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    // Validate all fields before submitting
    const isNameValid = validateProfileField('input-fullname');
    const isPhoneValid = validateProfileField('input-phone');
    const isAddrValid = validateProfileField('input-address');
    const isCityValid = validateProfileField('input-city');
    const isCountryValid = validateProfileField('input-country');

    if (!isNameValid || !isPhoneValid || !isAddrValid || !isCityValid || !isCountryValid) {
        showToast('Please correct the errors in the form.', 'error');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    const data = {
        fullName: document.getElementById('input-fullname').value.trim(),
        phoneNumber: document.getElementById('input-phone').value.trim(),
        addressLine1: document.getElementById('input-address').value.trim(),
        city: document.getElementById('input-city').value.trim(),
        country: document.getElementById('input-country').value.trim(),
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

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    if (!toast || !toastMsg) {
        alert(message);
        return;
    }
    toastMsg.textContent = message;
    toast.style.display = 'block';
    toast.className = `rh-toast rh-toast--${type} rh-toast--visible`;
    setTimeout(() => {
        toast.classList.remove('rh-toast--visible');
        setTimeout(() => toast.style.display = 'none', 300);
    }, 3500);
}
