/**
 * controllers/bookController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles public-facing book browsing and search operations.
 * All routes in this controller are unauthenticated (no session required),
 * except rateBook which is user-protected (applied at the route level).
 */

const { sql, poolPromise } = require('../db');

function isSqlTooManyArgsError(err) {
    const msg = (err && err.message ? String(err.message) : '').toLowerCase();
    // Common SQL Server messages when the procedure signature doesn't match supplied parameters
    return (
        msg.includes('too many arguments') ||
        msg.includes('has too many arguments') ||
        msg.includes('too many parameters') ||
        msg.includes('expects parameter') ||
        msg.includes('expects the parameter') ||
        msg.includes('procedure or function') && msg.includes('has too many')
    );
}

// ─── GET /api/books — list all available books ────────────────────────────────
const getBooks = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request().execute('sp_ViewAvailableBooks');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ error: 'Failed to fetch books.' });
    }
};

// ─── GET /api/books/search?q=term — full-text book search ────────────────────
const searchBooks = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ error: 'Search term is required.' });

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('SearchTerm', sql.NVARCHAR, q)
            .execute('sp_SearchBooks');

        res.json(result.recordset);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed.' });
    }
};

// ─── GET /api/books/category/:categoryId — books filtered by category ─────────
// NOTE: This route must be registered BEFORE /api/books/:id to avoid conflicts
const getBooksByCategory = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('CategoryID', sql.INT, req.params.categoryId)
            .query('SELECT * FROM vw_AvailableBooks WHERE CategoryID = @CategoryID ORDER BY Title ASC');

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching books by category:', error);
        res.status(500).json({ error: 'Failed to fetch books by category.' });
    }
};

// ─── GET /api/books/:id — single book detail (public + user-specific status) ──
const getBookById = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('BookID', sql.INT, req.params.id)
            .query('SELECT * FROM vw_AvailableBooks WHERE BookID = @BookID');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Book not found.' });
        }

        const book = result.recordset[0];
        let userStatus = {
            activeRental: null,
            isInCart: [], // Array of format IDs
            isPurchased: false,
            userRating: null // { rating, review }
        };

        // If user is logged in, fetch their status for this book
        if (req.session && req.session.userId) {
            const userId = req.session.userId;
            
            // 1. Check for active rental
            const rentalResult = await pool.request()
                .input('UserID', sql.INT, userId)
                .input('BookID', sql.INT, req.params.id)
                .query(`
                    SELECT DueDate FROM EbookRentals 
                    WHERE UserID = @UserID AND BookID = @BookID 
                      AND ActualReturnDate IS NULL 
                      AND DueDate > SYSUTCDATETIME()
                `);
            if (rentalResult.recordset.length > 0) {
                userStatus.activeRental = {
                    expiryDate: rentalResult.recordset[0].DueDate
                };
            }

            // 2. Check if already in cart
            const cartResult = await pool.request()
                .input('UserID', sql.INT, userId)
                .input('BookID', sql.INT, req.params.id)
                .query(`
                    SELECT ci.FormatID FROM Cart c
                    INNER JOIN CartItems ci ON c.CartID = ci.CartID
                    WHERE c.UserID = @UserID AND ci.BookID = @BookID
                `);
            userStatus.isInCart = cartResult.recordset.map(row => row.FormatID);

            // 3. Check if already purchased (Ebook Buy)
            const purchaseResult = await pool.request()
                .input('UserID', sql.INT, userId)
                .input('BookID', sql.INT, req.params.id)
                .query(`
                    SELECT 1 FROM OrderItems oi
                    INNER JOIN Orders o ON oi.OrderID = o.OrderID
                    WHERE o.UserID = @UserID AND oi.BookID = @BookID AND oi.FormatID = 2
                `);
            if (purchaseResult.recordset.length > 0) {
                userStatus.isPurchased = true;
            }

            // 4. Check for existing rating
            let ratingResult;
            try {
                ratingResult = await pool.request()
                    .input('UserID', sql.INT, userId)
                    .input('BookID', sql.INT, req.params.id)
                    .query(`
                        SELECT Rating, Review FROM BookRating 
                        WHERE UserID = @UserID AND BookID = @BookID
                    `);
            } catch (err) {
                // Older schema might not have a Review column yet
                ratingResult = await pool.request()
                    .input('UserID', sql.INT, userId)
                    .input('BookID', sql.INT, req.params.id)
                    .query(`
                        SELECT Rating, NULL AS Review FROM BookRating 
                        WHERE UserID = @UserID AND BookID = @BookID
                    `);
            }
            if (ratingResult.recordset.length > 0) {
                userStatus.userRating = {
                    rating: ratingResult.recordset[0].Rating,
                    review: ratingResult.recordset[0].Review
                };
            }
        }

        res.json({ ...book, userStatus });
    } catch (error) {
        console.error('Error fetching book:', error);
        res.status(500).json({ error: 'Failed to fetch book.' });
    }
};

// ─── GET /api/books/popular — top 3 highest-rated books (public) ────────────
const getPopularBooks = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request().query(`
            SELECT TOP 3
                b.BookID, b.Title, b.Author, b.ImageURL, b.AverageRating,
                b.CategoryID,
                ISNULL(c.Name, 'General') AS CategoryName,
                COUNT(br.Rating)          AS ReviewsCount
            FROM Books b
            LEFT JOIN Categories c  ON c.CategoryID = b.CategoryID
            LEFT JOIN BookRating br ON br.BookID = b.BookID
            GROUP BY b.BookID, b.Title, b.Author, b.ImageURL,
                     b.AverageRating, b.CategoryID, c.Name
            ORDER BY b.AverageRating DESC, COUNT(br.Rating) DESC
        `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching popular books:', error);
        res.status(500).json({ error: 'Failed to fetch popular books.' });
    }
};

// ─── GET /api/categories — all categories (public) ───────────────────────────
const getCategories = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request().execute('sp_GetAllCategories');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
};

// ─── GET /api/categories/with-counts — categories with book counts ────────────
const getCategoriesWithCounts = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request().query(`
            SELECT c.CategoryID, c.Name, ISNULL(c.Description, 'No description') AS Description,
                   COUNT(b.BookID) AS BookCount
            FROM Categories c
            LEFT JOIN Books b ON b.CategoryID = c.CategoryID
            GROUP BY c.CategoryID, c.Name, c.Description
            ORDER BY c.Name ASC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching categories with counts:', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
};

// ─── POST /api/books/:id/rate — submit a 1–5 star rating (user only) ─────────
const rateBook = async (req, res) => {
    try {
        const { rating, review } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
        }

        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        await pool.request()
            .input('UserID', sql.INT, req.session.userId)
            .input('BookID', sql.INT, req.params.id)
            .input('Rating', sql.INT, rating)
            .input('Review', sql.NVarChar(sql.MAX), review || null)
            .execute('sp_RateBook');

        res.json({ message: 'Rating submitted successfully.' });
    } catch (error) {
        if (error.number === 50003) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
        }
        console.error('Rating error:', error);
        res.status(500).json({ error: 'Failed to submit rating.' });
    }
};

// ─── GET /api/books/:id/reviews — fetch all reviews for a book ───────────────
const getBookReviews = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: 'Database is offline.' });

        const result = await pool.request()
            .input('BookID', sql.INT, req.params.id)
            .execute('sp_GetBookReviews');

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Failed to fetch reviews.' });
    }
};

module.exports = { getBooks, searchBooks, getBooksByCategory, getBookById, getPopularBooks, getCategories, getCategoriesWithCounts, rateBook, getBookReviews };
