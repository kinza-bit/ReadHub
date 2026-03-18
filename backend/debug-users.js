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

const fs = require('fs');
async function listUsers() {
    try {
        await sql.connect(config);
        let output = '--- Database Check ---\n';

        const users = await sql.query(`
            SELECT u.Email, r.RoleName, u.IsActive, u.PasswordHash
            FROM Users u 
            JOIN Roles r ON u.RoleID = r.RoleID
        `);
        output += 'USERS:\n' + JSON.stringify(users.recordset, null, 2) + '\n\n';

        const roles = await sql.query("SELECT RoleID, RoleName FROM Roles");
        output += 'ROLES:\n' + JSON.stringify(roles.recordset, null, 2) + '\n';

        fs.writeFileSync(path.join(__dirname, 'db-status.txt'), output);
        console.log('Results saved to db-status.txt');
        process.exit(0);
    } catch (err) {
        console.error('Failed:', err.message);
        process.exit(1);
    }
}

listUsers();
