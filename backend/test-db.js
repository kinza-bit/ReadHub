const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });


const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: '127.0.0.1', 
    database: process.env.DB_DATABASE,
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000
    }
};

console.log('--- Attempting Direct Connection to 127.0.0.1:1433 ---');
sql.connect(config).then(() => {
    console.log('SUCCESS: Connected directly via Port 1433!');
    process.exit(0);
}).catch(err => {
    console.error('FAILED: Direct connection failed.');
    console.error('Error Code:', err.code);
    console.error('Message:', err.message);
    process.exit(1);
});
