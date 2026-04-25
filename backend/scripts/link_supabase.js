const supabase = require('../supabaseClient');
const { sql, poolPromise } = require('../db');

async function linkDatabaseToSupabase() {
    try {
        console.log('--- Scanning Supabase Bucket ---');
        
        // 1. Fetch the list of files from the Supabase bucket
        const { data: files, error } = await supabase.storage.from('ebooks').list();
        if (error) {
            throw error;
        }

        if (!files || files.length === 0) {
            console.log('No files found in your Supabase "ebooks" bucket.');
            console.log('Please make sure you uploaded the PDFs to the bucket named "ebooks" (with an s).');
            process.exit(0);
        }

        console.log(`Found ${files.length} files in Supabase bucket.`);
        
        const pool = await poolPromise;

        // 2. Loop through the Supabase files and update the SQL Database
        let updatedCount = 0;
        for (const file of files) {
            if (file.name === '.emptyFolderPlaceholder') continue;

            const fileName = file.name;
            
            // Try to match the filename to a book's EbookURL
            const cleanName = fileName.replace('.pdf', '').replace(/-/g, ' '); // Replace hyphens with spaces just in case
            
            // Try to match the filename to a book's Title
            const result = await pool.request()
                .input('CleanName', sql.NVarChar, `%${cleanName}%`)
                .input('SupabasePath', sql.NVarChar, fileName)
                .query(`
                    UPDATE Books 
                    SET SupabasePath = @SupabasePath 
                    WHERE Title LIKE @CleanName OR @CleanName LIKE '%' + REPLACE(Title, ' ', '%') + '%'
                `);

            if (result.rowsAffected[0] > 0) {
                console.log(`Successfully linked ${fileName} to ${result.rowsAffected[0]} book(s) in the database.`);
                updatedCount += result.rowsAffected[0];
            } else {
                console.log(`Warning: Could not find a book in the database matching the filename: ${fileName}`);
            }
        }

        console.log(`\nFinished linking database. ${updatedCount} book(s) updated.`);
        await pool.close(); // Prevent async assertion error
        process.exit(0);
    } catch (err) {
        console.error('Script failed:', err.message);
        process.exit(1);
    }
}

linkDatabaseToSupabase();
