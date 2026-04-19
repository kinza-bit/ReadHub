/**
 * middleware/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Authentication & Authorization guards.
 * These middleware functions are applied per-route to protect endpoints.
 * They inspect the active session and short-circuit with an error response
 * if the caller lacks the required role — no business logic lives here.
 */

/**
 * requireUserAuth
 * Allows only authenticated Customers through.
 * Attach to any route that must be accessible to logged-in users only.
 */
const requireUserAuth = (req, res, next) => {
    if (req.session.userId && req.session.role === 'Customer') {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
};

/**
 * requireAdminAuth
 * Allows only authenticated Admins through.
 * Attach to any route that must be accessible to administrators only.
 */
const requireAdminAuth = (req, res, next) => {
    if (req.session.userId && req.session.role === 'Admin') {
        return next();
    }
    res.status(403).json({ error: 'Forbidden. Admin access required.' });
};

module.exports = { requireUserAuth, requireAdminAuth };
