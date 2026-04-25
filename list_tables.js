const { sql, poolPromise } = require('./backend/db');
async function test() {
  const pool = await poolPromise;
  const result = await pool.request().query("SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE'");
  console.log(result.recordset);
  
  // also get formats
  try {
     const formats = await pool.request().query('SELECT * FROM PurchaseFormats');
     console.log('PurchaseFormats:', formats.recordset);
  } catch (e) {}

  try {
     const formats = await pool.request().query('SELECT * FROM DigitalFormats');
     console.log('DigitalFormats:', formats.recordset);
  } catch (e) {}
  
  process.exit(0);
}
test();
