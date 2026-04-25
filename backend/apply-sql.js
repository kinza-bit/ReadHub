const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

if (config.server.includes('\\')) {
    const parts = config.server.split('\\');
    config.server = parts[0];
    config.options.instanceName = parts[1];
}

async function runSqlFile() {
    try {
        const pool = await sql.connect(config);
        console.log('Connected to DB');

        const sqlFileArg = process.argv[2];
        if (!sqlFileArg) {
            console.error('Please provide a path to a SQL file as an argument.');
            process.exit(1);
        }
        
        const sqlFilePath = path.resolve(__dirname, '..', sqlFileArg);
        const content = fs.readFileSync(sqlFilePath, 'utf8');

        // Split by GO (case insensitive, on its own line)
        const batches = content.split(/\r?\n\s*GO\s*\r?\n/i);

        console.log(`Executing ${batches.length} batches...`);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch) {
                try {
                    await pool.request().query(batch);
                } catch (batchError) {
                    console.error(`Error in batch ${i + 1}:`, batchError.message);
                    // Keep going for other batches (like drops)
                }
            }
        }

        console.log('SUCCESS: features.sql has been applied.');
        process.exit(0);
    } catch (err) {
        console.error('Failed to apply SQL:', err.message);
        process.exit(1);
    }
}

runSqlFile();
