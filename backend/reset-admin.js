const sql = require('mssql');
const bcrypt = require('bcryptjs');
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

async function resetAdmin() {
    try {
        await sql.connect(config);
        console.log('Connected to DB');

        const newPassword = 'password';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        const result = await sql.query`
            UPDATE Users 
            SET PasswordHash = ${hash} 
            WHERE Email = 'admin@gmail.com'
        `;

        if (result.rowsAffected[0] > 0) {
            console.log('SUCCESS: Admin password reset to "password"');
        } else {
            console.log('FAIL: Admin user not found.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Failed:', err.message);
        process.exit(1);
    }
}

resetAdmin();
