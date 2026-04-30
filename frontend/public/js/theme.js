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
            if (host.querySelector('.theme-toggle-btn')) return; // Prevent duplicate injection
            
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

// ── CONTAINED CARD GLOW (auth cards only) ───────────────────
// Each .auth-card gets an injected .inner-glow div.
// All mouse tracking is SCOPED to the card via card.addEventListener
// so the glow never bleeds outside and there is no global mousemove.
(function initCardGlow() {
    function setup(card) {
        // Inject the inner glow circle div
        const glow = document.createElement('div');
        glow.className = 'inner-glow';
        card.appendChild(glow);

        // ── mousemove: update glow position + conic angle ──
        card.addEventListener('mousemove', e => {
            const r = card.getBoundingClientRect();
            const x = e.clientX - r.left;
            const y = e.clientY - r.top;

            // Move glow circle to cursor position (centred via CSS translate)
            glow.style.left = `${x}px`;
            glow.style.top  = `${y}px`;

            // Angle from card centre → cursor, drives conic border sweep
            const angle = Math.atan2(y - r.height / 2, x - r.width / 2) * 180 / Math.PI;
            card.style.setProperty('--a',  `${angle}deg`);
            card.style.setProperty('--op', '1');
        });

        // ── mouseenter: fade in glow ──
        card.addEventListener('mouseenter', () => {
            glow.style.opacity = '1';
        });

        // ── mouseleave: fade out glow + border ──
        card.addEventListener('mouseleave', () => {
            glow.style.opacity = '0';
            card.style.setProperty('--op', '0');
        });
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () =>
            document.querySelectorAll('.auth-card').forEach(setup)
        );
    } else {
        document.querySelectorAll('.auth-card').forEach(setup);
    }
})();
