const { poolPromise } = require('./db');
const fs = require('fs');
const path = require('path');

async function migrate() {
    try {
        const pool = await poolPromise;
        if (!pool) {
            console.error('Database connection failed.');
            process.exit(1);
        }

        console.log('Migrating database...');

        // Check if columns exist
        const checkCols = await pool.request().query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Users' AND COLUMN_NAME IN ('ResetToken', 'TokenExpiry')
        `);

        if (checkCols.recordset.length < 2) {
            console.log('Adding ResetToken and TokenExpiry columns to Users table...');
            await pool.request().query(`
                IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'ResetToken' AND Object_ID = Object_ID(N'Users'))
                BEGIN
                    ALTER TABLE Users ADD ResetToken NVARCHAR(64) NULL, TokenExpiry DATETIME2 NULL;
                END
            `);
            console.log('Columns added successfully.');
        } else {
            console.log('Columns already exist.');
        }

        // Run the entire features.sql to recreate all SPs
        console.log('Applying features.sql...');
        const sqlPath = path.join(__dirname, '..', 'sql', 'features.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        
        // Split by GO and execute each batch
        const batches = sqlContent.split(/^GO\s*$/im);
        for (const batch of batches) {
            const trimmed = batch.trim();
            if (trimmed) {
                await pool.request().query(trimmed);
            }
        }
        console.log('Features applied successfully.');

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
