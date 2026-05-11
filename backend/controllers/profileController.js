/**
 * controllers/profileController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles the authenticated customer's personal data:
 *   - Profile read / update
 *   - Purchase history
 *   - Wishlist CRUD
 *   - Book request submission / listing
 * All routes in this controller require an active Customer session (enforced
 * at the route level via requireUserAuth).
 */

const { sql, poolPromise } = require('../db');

// ─── GET /api/profile — fetch current user's profile ─────────────────────────
const getProfile = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .query('SELECT Username, Email, FullName, PhoneNumber, AddressLine1, City, Country, ProfileImageURL FROM Users WHERE UserID = @UserID');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile.' });
    }
};

// ─── PUT /api/profile — update current user's profile fields ─────────────────
const updateProfile = async (req, res) => {
    try {
        const { fullName, phoneNumber, addressLine1, city, country } = req.body;
        const pool = await poolPromise;

        await pool.request()
            .input('UserID',          sql.INT,      req.session.userId)
            .input('FullName',        sql.NVarChar,  fullName)
            .input('PhoneNumber',     sql.NVarChar,  phoneNumber     || null)
            .input('AddressLine1',    sql.NVarChar,  addressLine1    || null)
            .input('City',            sql.NVarChar,  city            || null)
            .input('Country',         sql.NVarChar,  country         || null)
            .query(`
                UPDATE Users
                SET FullName = @FullName, PhoneNumber = @PhoneNumber, AddressLine1 = @AddressLine1,
                    City = @City, Country = @Country
                WHERE UserID = @UserID
            `);

        res.json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
};

// ─── GET /api/user/purchases — order history for current user ─────────────────
const getPurchases = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .query(`
                SELECT o.OrderDate, oi.Quantity, oi.UnitPrice, b.Title, b.Author, b.ImageURL, b.BookID
                FROM Orders o
                JOIN OrderItems oi ON o.OrderID = oi.OrderID
                JOIN Books b       ON oi.BookID  = b.BookID
                WHERE o.UserID = @UserID
                ORDER BY o.OrderDate DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Purchases fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch purchases.' });
    }
};

// ─── GET /api/user/rentals — active rentals for current user ──────────────────
const getRentals = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .query(`
                SELECT er.DueDate, b.Title, b.Author, b.ImageURL, b.BookID
                FROM EbookRentals er
                JOIN Books b ON er.BookID = b.BookID
                WHERE er.UserID = @UserID AND er.ActualReturnDate IS NULL AND er.DueDate > SYSUTCDATETIME()
                ORDER BY er.DueDate ASC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Rentals fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch rentals.' });
    }
};

// ─── GET /api/user/wishlist — wishlist for current user ──────────────────────
const getWishlist = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .query(`
                SELECT w.WishlistID, w.CreatedAt, b.Title, b.Author, b.ImageURL, b.BookID, b.AverageRating
                FROM UserWishlist w
                JOIN Books b ON w.BookID = b.BookID
                WHERE w.UserID = @UserID
                ORDER BY w.CreatedAt DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Wishlist fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch wishlist.' });
    }
};

// ─── POST /api/user/wishlist — add a book to the wishlist ────────────────────
const addToWishlist = async (req, res) => {
    try {
        const { bookId } = req.body;
        if (!bookId) return res.status(400).json({ error: 'bookId is required.' });

        const pool = await poolPromise;

        const check = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('BookID', sql.INT, bookId)
            .query('SELECT * FROM UserWishlist WHERE UserID = @UserID AND BookID = @BookID');

        if (check.recordset.length > 0) {
            return res.status(400).json({ error: 'Book already in wishlist.' });
        }

        await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('BookID', sql.INT, bookId)
            .query('INSERT INTO UserWishlist (UserID, BookID) VALUES (@UserID, @BookID)');

        res.status(201).json({ message: 'Added to wishlist.' });
    } catch (error) {
        console.error('Wishlist add error:', error);
        res.status(500).json({ error: 'Failed to add to wishlist.' });
    }
};

// ─── DELETE /api/user/wishlist/:bookId — remove a book from the wishlist ──────
const removeFromWishlist = async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('BookID', sql.INT, req.params.bookId)
            .query('DELETE FROM UserWishlist WHERE UserID = @UserID AND BookID = @BookID');

        res.json({ message: 'Removed from wishlist.' });
    } catch (error) {
        console.error('Wishlist remove error:', error);
        res.status(500).json({ error: 'Failed to remove from wishlist.' });
    }
};

// ─── POST /api/requests — submit a book request ──────────────────────────────
const submitRequest = async (req, res) => {
    try {
        const { title, author } = req.body;
        if (!title) return res.status(400).json({ error: 'Book title is required.' });

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('UserID',          sql.INT,      req.session.userId)
            .input('RequestedTitle',  sql.NVarChar,  title)
            .input('RequestedAuthor', sql.NVarChar,  author || null)
            .execute('sp_RequestBook');

        res.status(201).json({ message: 'Book request submitted successfully.' });
    } catch (error) {
        console.error('Book request error:', error);
        res.status(500).json({ error: 'Failed to submit book request.' });
    }
};

// ─── GET /api/requests — list the current user's book requests ───────────────
const getRequests = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .execute('sp_GetUserRequests');

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching user requests:', error);
        res.status(500).json({ error: 'Failed to fetch book requests.' });
    }
};

// ─── GET /api/user/recently-added — last 5 purchases/rentals ─────────────────
const getRecentlyAdded = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .query(`
                SELECT TOP 3 * FROM (
                    SELECT b.BookID, b.Title, b.Author, b.ImageURL, 
                           CASE pf.FormatName 
                                WHEN 'Physical' THEN 'Physical'
                                WHEN 'Ebook Buy' THEN 'eBook'
                                ELSE pf.FormatName 
                           END as FormatLabel,
                           o.OrderDate as AddedDate
                    FROM OrderItems oi
                    JOIN Orders o ON oi.OrderID = o.OrderID
                    JOIN Books b ON oi.BookID = b.BookID
                    JOIN PurchaseFormat pf ON oi.FormatID = pf.FormatID
                    WHERE o.UserID = @UserID AND pf.FormatID IN (1, 2)

                    UNION ALL

                    SELECT b.BookID, b.Title, b.Author, b.ImageURL, 
                           'Rented' as FormatLabel,
                           er.StartDate as AddedDate
                    FROM EbookRentals er
                    JOIN Books b ON er.BookID = b.BookID
                    WHERE er.UserID = @UserID AND er.ActualReturnDate IS NULL
                ) AS Combined
                ORDER BY AddedDate DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Recently added fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch recently added books.' });
    }
};

// ─── GET /api/user/notifications — fetch notifications (expiring rentals) ────
const getNotifications = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .query(`
                SELECT er.RentalID, er.BookID, er.DueDate, b.Title
                FROM EbookRentals er
                JOIN Books b ON er.BookID = b.BookID
                WHERE er.UserID = @UserID 
                  AND er.ActualReturnDate IS NULL
                  AND er.DueDate <= DATEADD(HOUR, 48, SYSUTCDATETIME())
                  AND er.DueDate > SYSUTCDATETIME()
                ORDER BY er.DueDate ASC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Notifications fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications.' });
    }
};

module.exports = {
    getProfile, updateProfile,
    getPurchases,
    getRentals,
    getRecentlyAdded,
    getWishlist, addToWishlist, removeFromWishlist,
    submitRequest, getRequests,
    getNotifications
};
