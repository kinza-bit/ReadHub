const sql = require('mssql');
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

async function checkDb() {
    try {
        await sql.connect(config);
        console.log('Connected to DB');
        
        console.log('Checking for vw_AllUsers...');
        const result = await sql.query("SELECT * FROM sys.views WHERE name = 'vw_AllUsers'");
        if (result.recordset.length > 0) {
            console.log('SUCCESS: vw_AllUsers exists.');
        } else {
            console.log('FAIL: vw_AllUsers does NOT exist. You need to run features.sql first.');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Connection failed:', err.message);
        process.exit(1);
    }
}

checkDb();
