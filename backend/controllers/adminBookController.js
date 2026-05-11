/**
 * controllers/adminBookController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles admin-facing book CRUD operations, including:
 *   - Listing all books with full metadata (image + PDF URLs, inventory)
 *   - Single book lookup
 *   - Creating a book with optional cover image and PDF upload
 *   - Updating a book (swapping files on disk when new uploads arrive)
 *   - Deleting a book and its associated files from disk
 * File upload middleware (bookUpload) is applied at the route level.
 * unlinkOldFile / path constants are imported from middleware/upload.js.
 */

const { sql, poolPromise } = require('../db');
const { unlinkOldFile, IMGS_DIR, PDFS_DIR } = require('../middleware/upload');

const fs = require('fs');
const supabase = require('../supabaseClient');

// ── Shared SQL query for the full book + inventory join ───────────────────────
const BOOK_SELECT_QUERY = `
    SELECT b.BookID, b.ISBN, b.Title, b.Author,
           b.CategoryID,  c.Name AS CategoryName,
           b.Description,
           b.PhysicalPrice, b.EbookPrice,
           b.RentalPricePerDay, b.LateFeePerDay,
           b.AverageRating,
           b.ImageURL,
           b.PdfURL,
           b.SupabasePath,
           i.StockLevel, i.LowStockThreshold
    FROM Books b
    LEFT JOIN Categories c ON c.CategoryID = b.CategoryID
    LEFT JOIN Inventory  i ON i.BookID     = b.BookID
`;

// ─── GET /api/admin/books — all books (admin view) ────────────────────────────
const getAllBooks = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(BOOK_SELECT_QUERY + ' ORDER BY b.BookID DESC');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching admin books:', error);
        res.status(500).json({ error: 'Failed to fetch books.' });
    }
};

// ─── GET /api/admin/books/:id — single book ───────────────────────────────────
const getBookById = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('BookID', sql.INT, req.params.id)
            .query(BOOK_SELECT_QUERY + ' WHERE b.BookID = @BookID');

        if (!result.recordset.length) return res.status(404).json({ error: 'Book not found.' });
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching book:', error);
        res.status(500).json({ error: 'Failed to fetch book.' });
    }
};

// ─── POST /api/admin/books — add a new book (multipart) ──────────────────────
const addBook = async (req, res) => {
    const coverFile = req.files?.coverImage?.[0];
    const pdfFile   = req.files?.pdfFile?.[0];

    const {
        isbn, title, author, categoryId, description,
        physicalPrice, ebookPrice, rentalPricePerDay, lateFeePerDay,
        stockLevel, lowStockThreshold,
    } = req.body;

    if (!title || !author || !categoryId) {
        if (coverFile) unlinkOldFile(IMGS_DIR, '/images/' + coverFile.filename);
        if (pdfFile)   unlinkOldFile(PDFS_DIR, '/pdfs/'   + pdfFile.filename);
        return res.status(400).json({ error: 'title, author, and categoryId are required.' });
    }

    const imgUrl = coverFile ? `/images/${coverFile.filename}` : null;
    const pdfUrl = pdfFile   ? `/pdfs/${pdfFile.filename}`     : null;
    let supabasePath = null;

    try {
        // Upload to Supabase if PDF is provided
        if (pdfFile) {
            const fileBuffer = fs.readFileSync(pdfFile.path);
            supabasePath = pdfFile.filename; // Use local filename as Supabase path
            
            const { error: uploadError } = await supabase.storage
                .from('ebooks')
                .upload(supabasePath, fileBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) {
                console.error('Supabase upload error during addBook:', uploadError);
                throw new Error('Failed to upload PDF to secure storage.');
            }

            // After successful Supabase upload, we can remove the local file
            // We set pdfUrl to null because we now rely on SupabasePath
            unlinkOldFile(PDFS_DIR, '/pdfs/' + pdfFile.filename);
        }

        const pool = await poolPromise;
        await pool.request()
            .input('ISBN',              sql.NVarChar,      isbn             || null)
            .input('Title',             sql.NVarChar,      title)
            .input('Author',            sql.NVarChar,      author)
            .input('CategoryID',        sql.INT,           parseInt(categoryId))
            .input('Description',       sql.NVarChar,      description      || null)
            .input('PhysicalPrice',     sql.Decimal(10,2), physicalPrice     ? parseFloat(physicalPrice)     : null)
            .input('EbookPrice',        sql.Decimal(10,2), ebookPrice        ? parseFloat(ebookPrice)        : null)
            .input('RentalPricePerDay', sql.Decimal(10,2), rentalPricePerDay ? parseFloat(rentalPricePerDay) : null)
            .input('LateFeePerDay',     sql.Decimal(10,2), lateFeePerDay     ? parseFloat(lateFeePerDay)     : 1.00)
            .input('ImageURL',          sql.NVarChar,      imgUrl)
            .input('PdfURL',            sql.NVarChar,      null) // Set to null since we use Supabase
            .input('SupabasePath',      sql.NVarChar,      supabasePath)
            .input('StockLevel',        sql.INT,           stockLevel        ? parseInt(stockLevel)        : 0)
            .input('LowStockThreshold', sql.INT,           lowStockThreshold ? parseInt(lowStockThreshold) : 5)
            .execute('sp_AddNewBook');

        res.status(201).json({ message: 'Book added successfully.', ImageURL: imgUrl, PdfURL: null });
    } catch (error) {
        console.error('Error adding book:', error);
        if (coverFile) unlinkOldFile(IMGS_DIR, '/images/' + coverFile.filename);
        if (pdfFile)   unlinkOldFile(PDFS_DIR, '/pdfs/'   + pdfFile.filename);
        res.status(500).json({ error: 'Failed to add book. Uploaded files rolled back.' });
    }
};

// ─── PUT /api/admin/books/:id — update a book (multipart, optional new files) ─
const updateBook = async (req, res) => {
    const bookId    = parseInt(req.params.id);
    const coverFile = req.files?.coverImage?.[0];
    const pdfFile   = req.files?.pdfFile?.[0];

    const {
        title, author, isbn, categoryId, description,
        physicalPrice, ebookPrice, rentalPricePerDay, lateFeePerDay,
        stockLevel, lowStockThreshold,
    } = req.body;

    // Fetch existing file paths before attempting the update
    let existing;
    try {
        const pool = await poolPromise;
        const r = await pool.request()
            .input('BookID', sql.INT, bookId)
            .query('SELECT ImageURL, PdfURL, SupabasePath FROM Books WHERE BookID = @BookID');

        if (!r.recordset.length) {
            if (coverFile) unlinkOldFile(IMGS_DIR, '/images/' + coverFile.filename);
            if (pdfFile)   unlinkOldFile(PDFS_DIR, '/pdfs/'   + pdfFile.filename);
            return res.status(404).json({ error: 'Book not found.' });
        }
        existing = r.recordset[0];
    } catch (err) {
        if (coverFile) unlinkOldFile(IMGS_DIR, '/images/' + coverFile.filename);
        if (pdfFile)   unlinkOldFile(PDFS_DIR, '/pdfs/'   + pdfFile.filename);
        return res.status(500).json({ error: 'Failed to retrieve existing book.' });
    }

    const finalImgUrl = coverFile ? `/images/${coverFile.filename}` : existing.ImageURL;
    const finalPdfUrl = pdfFile   ? `/pdfs/${pdfFile.filename}`     : existing.PdfURL;
    let finalSupabasePath = existing.SupabasePath;

    try {
        if (pdfFile) {
            const fileBuffer = fs.readFileSync(pdfFile.path);
            finalSupabasePath = pdfFile.filename;
            
            const { error: uploadError } = await supabase.storage
                .from('ebooks')
                .upload(finalSupabasePath, fileBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) {
                console.error('Supabase upload error during updateBook:', uploadError);
                throw new Error('Failed to upload updated PDF to secure storage.');
            }

            // Delete the local file after upload
            unlinkOldFile(PDFS_DIR, '/pdfs/' + pdfFile.filename);
        }

        const pool = await poolPromise;
        await pool.request()
            .input('BookID',            sql.INT,           bookId)
            .input('Title',             sql.NVarChar,      title          || null)
            .input('Author',            sql.NVarChar,      author         || null)
            .input('ISBN',              sql.NVarChar,      isbn           || null)
            .input('CategoryID',        sql.INT,           categoryId     ? parseInt(categoryId) : null)
            .input('Description',       sql.NVarChar,      description    || null)
            .input('PhysicalPrice',     sql.Decimal(10,2), physicalPrice     ? parseFloat(physicalPrice)     : null)
            .input('EbookPrice',        sql.Decimal(10,2), ebookPrice        ? parseFloat(ebookPrice)        : null)
            .input('RentalPricePerDay', sql.Decimal(10,2), rentalPricePerDay ? parseFloat(rentalPricePerDay) : null)
            .input('LateFeePerDay',     sql.Decimal(10,2), lateFeePerDay     ? parseFloat(lateFeePerDay)     : null)
            .input('ImageURL',          sql.NVarChar,      finalImgUrl)
            .input('PdfURL',            sql.NVarChar,      pdfFile ? null : existing.PdfURL) // If new upload, set local path to null
            .input('SupabasePath',      sql.NVarChar,      finalSupabasePath)
            .execute('sp_UpdateBook');

        // ── Update Inventory (stock) — sp_UpdateBook only touches Books table ──
        if (stockLevel !== undefined && stockLevel !== null && stockLevel !== '') {
            await pool.request()
                .input('BookID',            sql.INT, bookId)
                .input('StockLevel',        sql.INT, parseInt(stockLevel))
                .input('LowStockThreshold', sql.INT, lowStockThreshold ? parseInt(lowStockThreshold) : 5)
                .query(`
                    UPDATE Inventory
                    SET StockLevel        = @StockLevel,
                        LowStockThreshold = @LowStockThreshold,
                        LastRestockDate   = SYSUTCDATETIME(),
                        UpdatedAt         = SYSUTCDATETIME()
                    WHERE BookID = @BookID
                `);
        }

        // Delete replaced files from disk AFTER the DB update succeeds
        if (coverFile && existing.ImageURL) unlinkOldFile(IMGS_DIR, existing.ImageURL);
        if (pdfFile   && existing.PdfURL)   unlinkOldFile(PDFS_DIR, existing.PdfURL);

        // Optionally, we could delete the old file from Supabase here as well
        // if (pdfFile && existing.SupabasePath) await supabase.storage.from('ebooks').remove([existing.SupabasePath]);

        res.json({ message: 'Book updated successfully.', ImageURL: finalImgUrl, PdfURL: finalPdfUrl });
    } catch (error) {
        console.error('Error updating book:', error);
        if (coverFile) unlinkOldFile(IMGS_DIR, '/images/' + coverFile.filename);
        if (pdfFile)   unlinkOldFile(PDFS_DIR, '/pdfs/'   + pdfFile.filename);
        res.status(500).json({ error: 'Failed to update book. Uploaded files rolled back.' });
    }
};

// ─── DELETE /api/admin/books/:id — delete book + disk files ──────────────────
const deleteBook = async (req, res) => {
    const bookId = parseInt(req.params.id);

    // Fetch file paths first so we can clean up after a successful DB delete
    let toDelete;
    try {
        const pool = await poolPromise;
        const r = await pool.request()
            .input('BookID', sql.INT, bookId)
            .query('SELECT ImageURL, PdfURL FROM Books WHERE BookID = @BookID');

        if (!r.recordset.length) return res.status(404).json({ error: 'Book not found.' });
        toDelete = r.recordset[0];
    } catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve book.' });
    }

    // Remove the DB record
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('BookID', sql.INT, bookId)
            .execute('sp_DeleteBook');
    } catch (error) {
        console.error('Error deleting book:', error);
        return res.status(500).json({ error: 'Failed to delete book.' });
    }

    // Clean up disk files after a successful DB delete
    unlinkOldFile(IMGS_DIR, toDelete.ImageURL);
    unlinkOldFile(PDFS_DIR, toDelete.PdfURL);

    res.json({ message: 'Book and its files deleted successfully.' });
};

module.exports = { getAllBooks, getBookById, addBook, updateBook, deleteBook };
