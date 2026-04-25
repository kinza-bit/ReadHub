const { sql, poolPromise } = require('./backend/db');
async function check() {
  const pool = await poolPromise;
  const result = await pool.request().query("SELECT object_definition(object_id('sp_GetEbookAccess')) AS def");
  console.log(result.recordset[0].def);
  process.exit(0);
}
check();
