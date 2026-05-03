const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: 'c:/Users/USER/OneDrive/Desktop/ReadHub/backend/.env' });

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

async function check() {
    try {
        await sql.connect(config);
        const result = await sql.query`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'BookRating'`;
        console.log(result.recordset);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
