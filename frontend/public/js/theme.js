/**
 * Theme Toggle — Light / Dark Mode
 * Reads preference from localStorage and applies data-theme to <html>.
 * Inserts the toggle button into any element with id="theme-toggle-host".
 */
(function () {
    const STORAGE_KEY = 'readhub-theme';

    // Apply theme immediately (before paint) to avoid flash
    const saved = localStorage.getItem(STORAGE_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', saved);

    document.addEventListener('DOMContentLoaded', () => {
        const hosts = document.querySelectorAll('.theme-toggle-host');
        hosts.forEach(host => {
            const btn = document.createElement('button');
            btn.id = 'theme-toggle-btn';
            btn.className = 'theme-toggle-btn';
            btn.setAttribute('aria-label', 'Toggle colour theme');
            btn.setAttribute('title', 'Toggle Light / Dark Mode');
            btn.innerHTML = `
                <span class="theme-icon theme-icon--moon">🌙</span>
                <span class="theme-icon theme-icon--sun">☀️</span>
            `;
            host.appendChild(btn);

            // Sync icon with current theme
            syncIcon();

            btn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme');
                const next = current === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem(STORAGE_KEY, next);
                syncIcon();
            });
        });

        function syncIcon() {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            document.querySelectorAll('.theme-toggle-btn').forEach(b => {
                b.classList.toggle('is-dark', isDark);
            });
        }
    });
})();
