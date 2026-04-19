/**
 * middleware/upload.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Multer disk-storage configuration for book cover images and PDF files.
 * Exports:
 *   bookUpload    — multer .fields() middleware (use inline in POST/PUT routes)
 *   unlinkOldFile — helper to silently delete a previously stored file from disk
 */

const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');

// ── File storage paths ────────────────────────────────────────────────────────
const IMGS_DIR = path.join(__dirname, '..', '..', 'frontend', 'BooksIMG');
const PDFS_DIR = path.join(__dirname, '..', '..', 'frontend', 'BooksPDF');

// Ensure BooksPDF directory exists on startup
if (!fs.existsSync(PDFS_DIR)) fs.mkdirSync(PDFS_DIR, { recursive: true });

// ── Disk storage: route files to the correct folder with unique names ─────────
const diskStorage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, file.fieldname === 'coverImage' ? IMGS_DIR : PDFS_DIR);
    },
    filename(req, file, cb) {
        const ext  = path.extname(file.originalname).toLowerCase();
        const safe = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${uuidv4()}-${safe}${ext}`);
    },
});

// ── Multer instance: 50 MB limit, strict MIME-type validation ─────────────────
const uploadBooks = multer({
    storage: diskStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter(req, file, cb) {
        if (file.fieldname === 'coverImage') {
            const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
            return ok ? cb(null, true) : cb(new Error('Cover must be JPEG, PNG, WEBP, or GIF.'), false);
        }
        if (file.fieldname === 'pdfFile') {
            return file.mimetype === 'application/pdf'
                ? cb(null, true)
                : cb(new Error('File must be a PDF.'), false);
        }
        cb(null, true);
    },
});

/**
 * bookUpload
 * Pre-configured multer middleware that accepts up to one coverImage and one pdfFile.
 * Use as a route-level middleware: router.post('/path', bookUpload, controller.fn)
 * Call it as a wrapper so multer errors surface as 400 responses — see adminBooks route.
 */
const bookUpload = uploadBooks.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'pdfFile',    maxCount: 1 },
]);

/**
 * unlinkOldFile(dir, publicUrl)
 * Silently removes a file from disk given its public URL path.
 * Used after a successful DB update to clean up the replaced file.
 */
function unlinkOldFile(dir, publicUrl) {
    if (!publicUrl) return;
    try {
        const fullPath = path.join(dir, path.basename(publicUrl));
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (e) {
        console.warn('[unlinkOldFile]', e.message);
    }
}

module.exports = { bookUpload, unlinkOldFile, IMGS_DIR, PDFS_DIR };
