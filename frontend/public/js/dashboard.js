// dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    fetchDashboardStats();
});

async function fetchDashboardStats() {
    try {
        // Fetch Profile for name
        const profileRes = await fetch('/api/profile');
        if (profileRes.ok) {
            const user = await profileRes.json();
            const nameEl = document.getElementById('user-greeting-name');
            if (nameEl) nameEl.textContent = user.FullName + ' \uD83D\uDC4B';
        }

        // Fetch Purchases for count
        const purchaseRes = await fetch('/api/user/purchases');
        if (purchaseRes.ok) {
            const purchases = await purchaseRes.json();
            const pCount = document.getElementById('dash-purchases-count');
            if (pCount) pCount.textContent = purchases.length;
        }

        // Fetch Wishlist for count
        const wishlistRes = await fetch('/api/user/wishlist');
        if (wishlistRes.ok) {
            const wishlist = await wishlistRes.json();
            const wCount = document.getElementById('dash-wishlist-count');
            if (wCount) wCount.textContent = wishlist.length;
        }

        // Active Rentals could be fetched similarly if there were an endpoint, 
        // falling back to 0 for now as it's just a placeholder in our MVP scope.

    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
    }
}
