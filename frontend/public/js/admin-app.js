// admin-app.js - SPA Router for Admin Panel

// Mock DOMContentLoaded to allow dynamically loaded scripts to initialize immediately
const originalAddEventListener = document.addEventListener;
document.addEventListener = function(type, listener, options) {
    if (type === 'DOMContentLoaded' && document.readyState !== 'loading') {
        setTimeout(listener, 0);
        return;
    }
    return originalAddEventListener.call(document, type, listener, options);
};

document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.querySelector('.admin-content');
    const navLinks = document.querySelectorAll('.admin-nav-item');
    
    // Create a container for dynamic modals so we can clean them up
    const modalContainer = document.createElement('div');
    modalContainer.id = 'dynamic-modal-container';
    document.body.appendChild(modalContainer);

    async function loadPage(url) {
        // Show loader
        contentArea.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:5rem; height: 100%;">
                <div class="rh-spinner" style="width: 40px; height: 40px; border: 3px solid rgba(239, 68, 68, 0.3); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top:1rem; color:var(--text-muted); font-weight:500;">Loading Module...</p>
                <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
            </div>
        `;
        
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch page');
            const html = await res.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Extract the main content. Pages use either .admin-content (dashboard) or .dashboard-container (others)
            const newContent = doc.querySelector('.admin-content') || doc.querySelector('.dashboard-container');
            
            if (newContent) {
                contentArea.innerHTML = newContent.innerHTML;
            } else {
                throw new Error('Content container not found in fetched HTML');
            }
            
            // Clean up old dynamic modals/toasts
            modalContainer.innerHTML = '';
            
            // Extract modals and toasts from the new page and add them to the container
            const modals = doc.querySelectorAll('.modal, .rh-toast');
            modals.forEach(m => {
                modalContainer.appendChild(m.cloneNode(true));
            });
            
            // Re-evaluate scripts from the loaded page
            // Clean up old dynamically added scripts
            document.querySelectorAll('script.dynamic-script').forEach(s => s.remove());
            
            const scripts = doc.querySelectorAll('script');
            scripts.forEach(script => {
                const src = script.getAttribute('src');
                
                // Skip global scripts that are already loaded in the shell
                if (src && (
                    src.includes('theme.js') || 
                    src.includes('auth.js') || 
                    src.includes('lucide') || 
                    src.includes('admin-app.js')
                )) {
                    return;
                }
                
                const newScript = document.createElement('script');
                newScript.className = 'dynamic-script';
                
                if (src) {
                    // Add a cache buster to force the browser to re-execute the script
                    // This is essential so the DOMContentLoaded mock catches it again
                    newScript.src = src + '?t=' + Date.now();
                } else {
                    // We need to disable or patch sidebar logic in inline scripts too, but usually it's in src files
                    let code = script.textContent;
                    newScript.textContent = code;
                }
                
                document.body.appendChild(newScript);
            });
            
            // Re-initialize Lucide icons for the new content
            if (window.lucide) {
                setTimeout(() => window.lucide.createIcons(), 50);
            }
            
            // Update URL without full reload
            if (window.location.pathname !== url) {
                window.history.pushState({path: url}, '', url);
            }
            
            // Update active state in sidebar
            navLinks.forEach(l => {
                l.classList.remove('active');
                if (l.getAttribute('href') === url) {
                    l.classList.add('active');
                }
            });
            
        } catch (err) {
            console.error('SPA Load Error:', err);
            contentArea.innerHTML = `
                <div class="alert alert-error" style="margin: 2rem;">
                    <strong>Error:</strong> Failed to load module. Please check your connection and try again.
                </div>
            `;
        }
    }
    
    // Attach click listeners to sidebar links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            loadPage(link.getAttribute('href'));
        });
    });
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.path) {
            loadPage(e.state.path);
        } else {
            loadPage('/admin-dashboard.html');
        }
    });
    
    // Initialize pushState for the current page so back button works correctly
    window.history.replaceState({path: window.location.pathname}, '', window.location.pathname);
    
    // Since we are currently ON admin-dashboard.html natively, we don't need to loadPage right now,
    // but if the user navigated to a specific module (e.g. /admin-books.html) and we rewrite URLs to load the shell,
    // we would handle it here. For now, the shell has dashboard content natively.
});
