/**
 * controllers/ebookController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles ebook logic such as generating signed URLs for downloading/renting.
 */

const { sql, poolPromise } = require('../db');
const supabase = require('../supabaseClient');

// ─── GET /api/ebook/access/:orderId/:bookId ──────────────────────────────────
// Returns a signed URL from Supabase if user has valid access
const getEbookAccess = async (req, res) => {
    try {
        const { orderId, bookId, formatId } = req.params;
        const userId = req.session.userId;

        if (!orderId || !bookId) {
            return res.status(400).json({ error: 'orderId and bookId are required.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        // Check access and update limits using the stored procedure
        const request = pool.request()
            .input('UserID', sql.INT, userId)
            .input('OrderID', sql.INT, orderId)
            .input('BookID', sql.INT, bookId);
        
        if (formatId) {
            request.input('FormatID', sql.INT, formatId);
        }

        const result = await request.execute('sp_GetEbookAccess');

        const accessInfo = result.recordset[0];
        if (!accessInfo || !accessInfo.SupabasePath) {
            return res.status(404).json({ error: 'Ebook file not found.' });
        }

        const { SupabasePath, AccessType, DownloadCount, DueDate } = accessInfo;

        // Generate signed URL from Supabase
        // AccessType 'Download' gets 1 hour link. 'Rent' gets 1 hour link but requires UI to re-request if they stay on page.
        // Or we could calculate exactly how many seconds until DueDate if it's a rental.
        let expiresIn = 3600; // 1 hour default
        if (AccessType === 'Rent' && DueDate) {
            const msUntilExpiry = new Date(DueDate).getTime() - Date.now();
            expiresIn = Math.max(60, Math.floor(msUntilExpiry / 1000)); 
            // Cap at 1 day for security, they can request a new link tomorrow
            expiresIn = Math.min(expiresIn, 86400); 
        }

        let signedUrl = '';
        try {
            // Force download if it's a permanent purchase
            const options = {};
            if (AccessType === 'Download') {
                options.download = true;
            }

            const { data, error } = await supabase
                .storage
                .from('ebooks')
                .createSignedUrl(SupabasePath, expiresIn, options);

            if (error || !data) {
                throw new Error(error?.message || 'Supabase generated an empty URL');
            }
            signedUrl = data.signedUrl;
        } catch (supabaseError) {
            console.warn('Supabase Error (using fallback URL):', supabaseError.message);
            // Fallback for testing when real credentials are not present in .env
            signedUrl = `/pdfs/dummy_ebook.pdf?test=true&expiresIn=${expiresIn}`;
        }

        res.json({
            signedUrl: signedUrl,
            accessType: AccessType,
            downloadsUsed: DownloadCount || null, // null for rentals
            maxDownloads: 3, // based on DB default
            expiresAt: DueDate || null
        });

    } catch (error) {
        console.error('Get Ebook Access Error:', error);
        if (error.number >= 50000) {
            // Custom errors from our stored procedure
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to access ebook.' });
    }
};

// ─── GET /api/ebook/library ──────────────────────────────────────────────────
// Returns a list of all purchased and rented ebooks for the current user.
const getLibrary = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        // We can just query the tables directly since it's a simple read.
        // We only want items where Payment is 'Completed' and FormatID is 2 (Download) or 3 (Rent)
        const query = `
            SELECT 
                oi.OrderID, oi.BookID, oi.FormatID, oi.DownloadCount, oi.MaxDownloads,
                b.Title, b.Author, b.ImageURL,
                pf.FormatName,
                er.DueDate
            FROM OrderItems oi
            INNER JOIN Orders o ON oi.OrderID = o.OrderID
            INNER JOIN Books b ON oi.BookID = b.BookID
            INNER JOIN PurchaseFormat pf ON oi.FormatID = pf.FormatID
            LEFT JOIN EbookRentals er ON oi.OrderID = er.OrderID AND oi.BookID = er.BookID
            WHERE o.UserID = @UserID 
              AND oi.FormatID IN (2, 3)
              AND o.PaymentStatusID = (SELECT StatusID FROM PaymentStatus WHERE StatusName = 'Completed')
            ORDER BY o.OrderDate DESC;
        `;

        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .query(query);

        res.json(result.recordset);
    } catch (error) {
        console.error('Get Library Error:', error);
        res.status(500).json({ error: 'Failed to fetch library.' });
    }
};

module.exports = {
    getEbookAccess,
    getLibrary
};
