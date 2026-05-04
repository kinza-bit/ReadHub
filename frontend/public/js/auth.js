// auth.js
// Handles frontend authentication logic

const API_BASE_URL = '/api';

// Utility for showing alerts
const showAlert = (message, type = 'error') => {
    const alertEl = document.getElementById('global-alert');
    if (!alertEl) return;

    alertEl.className = `alert alert-${type}`;
    alertEl.textContent = message;
    alertEl.style.display = 'block';

    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            alertEl.style.display = 'none';
        }, 3000);
    }
};

const hideAlert = () => {
    const alertEl = document.getElementById('global-alert');
    if (alertEl) alertEl.style.display = 'none';
};

const setInputError = (inputId, message) => {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(`${inputId}-error`);
    if (input) input.classList.add('invalid');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
};

const clearInputErrors = () => {
    document.querySelectorAll('.form-control').forEach(el => el.classList.remove('invalid'));
    document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');
};


// Validate email format inline
const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Handle Registration (US-01)
const handleRegister = async (e) => {
    e.preventDefault();
    clearInputErrors();
    hideAlert();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    let isValid = true;

    // Inline validation according to US-01.2
    if (!name) {
        setInputError('name', 'Name is required');
        isValid = false;
    }

    if (!email) {
        setInputError('email', 'Email is required');
        isValid = false;
    } else if (!validateEmail(email)) {
        setInputError('email', 'Please enter a valid email format');
        isValid = false;
    }

    if (!password) {
        setInputError('password', 'Password is required');
        isValid = false;
    } else if (password.length < 8) {
        setInputError('password', 'Password must be at least 8 characters long');
        isValid = false;
    }

    if (!isValid) return;

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Registering...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            // US-01.3: Duplicate email or other server error
            showAlert(data.error || 'Registration failed', 'error');
            return;
        }

        // Success
        showAlert('Registration successful! Redirecting to login...', 'success');
        e.target.reset();
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);

    } catch (err) {
        showAlert('Network error. Please try again later.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};


// Handle User/Admin Login (US-02 & US-03)
const handleLogin = async (e, type = 'user') => {
    e.preventDefault();
    clearInputErrors();
    hideAlert();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showAlert('Please enter both email and password.');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Authenticating...';
    btn.disabled = true;

    const endpoint = type === 'admin' ? '/login/admin' : '/login/user';

    try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            // US-02.2 / US-03.2: General error message to prevent credential enumeration
            showAlert(data.error || 'Incorrect email or password.', 'error');
            return;
        }

        // Redirect upon success
        const dashboardUrl = type === 'admin' ? 'admin-dashboard.html' : 'dashboard.html';
        window.location.href = dashboardUrl;

    } catch (err) {
        showAlert('Network error. Please try again later.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};

// Handle Logout (US-04)
const handleLogout = async (e) => {
    const btn = e.currentTarget;
    if (btn.classList.contains('logging-out')) return;

    btn.classList.add('logging-out');

    // Wait for the walking entry and door shut (approx 1s)
    setTimeout(async () => {
        try {
            await fetch(`${API_BASE_URL}/logout`, { method: 'POST' });
            // US-04.2 Redirect to login
            window.location.href = 'login.html';
        } catch (err) {
            console.error('Logout failed:', err);
            btn.classList.remove('logging-out');
        }
    }, 1000);
};


// Session Check for Protected Pages
const checkAuth = async (requiredRole) => {
    try {
        const res = await fetch(`${API_BASE_URL}/session`);
        const data = await res.json();

        if (!data.isAuthenticated) {
            window.location.href = 'login.html';
            return null;
        }

        // Global Logout Button Visibility
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';

        if (requiredRole && data.user.role !== requiredRole) {
            window.location.href = data.user.role === 'Admin' ? 'admin-dashboard.html' : 'dashboard.html';
            return null;
        }

        // Fetch extended profile data from userdb for Customers
        if (data.user.role === 'Customer') {
            try {
                const profileRes = await fetch(`${API_BASE_URL}/user/profile`);
                if (profileRes.ok) {
                    const profileData = await profileRes.json();

                    const userNameEl = document.getElementById('user-name-display');
                    if (userNameEl) userNameEl.textContent = profileData.FullName.includes(' ') ? profileData.FullName.split(' ')[0] : profileData.FullName;

                    const userGreetingEl = document.getElementById('user-greeting-name');
                    if (userGreetingEl) userGreetingEl.textContent = `${profileData.FullName.split(' ')[0]} 👋`;

                    const navAvatar = document.getElementById('nav-avatar');
                    if (navAvatar) {
                        navAvatar.src = profileData.ProfileImageURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.FullName)}&background=7C3AED&color=fff&bold=true`;
                    }
                }
            } catch (e) {
                console.error("Failed to fetch user profile from userdb", e);
            }
        } else {
            // Admin fallback using session data
            const userNameEl = document.getElementById('user-name-display');
            if (userNameEl && data.user) {
                userNameEl.textContent = data.user.name;
            }
        }

        return data.user;

    } catch (err) {
        console.error('Session check failed:', err);
        window.location.href = 'login.html';
    }
};

// Event Listeners Initialization based on current page
document.addEventListener('DOMContentLoaded', () => {

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        // Add real-time validation feedback UX
        document.getElementById('email').addEventListener('input', (e) => {
            if (e.target.value.length > 0 && !validateEmail(e.target.value)) {
                setInputError('email', 'Invalid email format');
            } else {
                e.target.classList.remove('invalid');
                document.getElementById('email-error').style.display = 'none';
            }
        });
        document.getElementById('password').addEventListener('input', (e) => {
            if (e.target.value.length > 0 && e.target.value.length < 8) {
                setInputError('password', 'Minimum 8 characters');
            } else {
                e.target.classList.remove('invalid');
                document.getElementById('password-error').style.display = 'none';
            }
        });
    }

    const userLoginForm = document.getElementById('user-login-form');
    if (userLoginForm) {
        userLoginForm.addEventListener('submit', (e) => handleLogin(e, 'user'));
    }

    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (e) => handleLogin(e, 'admin'));
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Check protections
    if (document.body.classList.contains('protected-user')) {
        checkAuth('Customer');
    }
    if (document.body.classList.contains('protected-admin')) {
        checkAuth('Admin');
    }
});
