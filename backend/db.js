const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Parse server if it's a named instance (e.g. Asus\SQLEXPRESS)
let server = process.env.DB_SERVER || 'localhost';
let instanceName = null;

if (server.includes('\\')) {
  const parts = server.split('\\');
  server = parts[0];
  instanceName = parts[1];
}

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: server,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000
  }
};

if (instanceName) {
  config.options.instanceName = instanceName;
}

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('--- Database Connected Successfully ---');
    return pool;
  })
  .catch(err => {
    console.error('--- Database Connection FAILED ---');
    console.error('Message:', err.message);
    console.error('Check if SQL Server TCP/IP is enabled and the Browser service is running.');
    // We don't throw; this allows the server to keep running for UI preview
    return null;
  });

module.exports = {
  sql, poolPromise
};
