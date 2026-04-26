const fs = require('fs');
const path = require('path');
const supabase = require('../supabaseClient');
const { sql, poolPromise } = require('../db');

async function setupSupabase() {
    try {
        console.log('--- Setting up Supabase ---');
        
        // 1. Create the 'ebooks' private bucket if it doesn't exist
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        if (bucketError) throw bucketError;
        
        let bucketExists = buckets.some(b => b.name === 'ebooks');
        if (!bucketExists) {
            const { error: createError } = await supabase.storage.createBucket('ebooks', {
                public: false, // Ensure it's private
                fileSizeLimit: 104857600, // 100MB
            });
            if (createError) throw createError;
            console.log('Created private bucket "ebooks"');
        } else {
            console.log('Bucket "ebooks" already exists');
        }

        // 2. Upload files from local BooksPDF folder
        const pdfDir = path.join(__dirname, '..', '..', 'frontend', 'BooksPDF');
        if (!fs.existsSync(pdfDir)) {
            console.log('No local BooksPDF directory found. Skipping upload.');
            const poolToClose = await poolPromise;
            if (poolToClose) await poolToClose.close();
            process.exit(0);
        }

        const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
        const pool = await poolPromise;

        for (const file of files) {
            const filePath = path.join(pdfDir, file);
            const fileBuffer = fs.readFileSync(filePath);
            
            // Supabase path convention
            const supabasePath = `${file}`;

            console.log(`Uploading ${file} to Supabase...`);
            const { error: uploadError } = await supabase.storage
                .from('ebooks')
                .upload(supabasePath, fileBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) {
                console.error(`Error uploading ${file}:`, uploadError.message);
                continue;
            }

            console.log(`Successfully uploaded ${file}`);

            // 3. Update the database record for this book to set SupabasePath
            // We assume the local filename matches the EbookURL filename previously
            await pool.request()
                .input('FileName', sql.NVarChar, `%${file}%`)
                .input('SupabasePath', sql.NVarChar, supabasePath)
                .query(`
                    UPDATE Books 
                    SET SupabasePath = @SupabasePath 
                    WHERE EbookURL LIKE @FileName
                `);
        }

        console.log('Supabase setup and upload complete.');
        const poolToClose = await poolPromise;
        if (poolToClose) await poolToClose.close();
        process.exit(0);
    } catch (err) {
        console.error('Setup failed:', err);
        const poolToClose = await poolPromise;
        if (poolToClose) await poolToClose.close();
        process.exit(1);
    }
}

setupSupabase();
