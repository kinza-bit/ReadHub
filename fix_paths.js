const { sql, poolPromise } = require('./backend/db');

async function fixPaths() {
  try {
    const pool = await poolPromise;
    await pool.request().query("UPDATE Books SET SupabasePath = 'dummy_ebook.pdf' WHERE SupabasePath IS NULL;");
    console.log('Dummy paths added to database.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
fixPaths();
