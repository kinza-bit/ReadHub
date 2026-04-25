const { sql, poolPromise } = require('./backend/db');
async function manualLink() {
  const pool = await poolPromise;
  await pool.request().query(`
    UPDATE Books SET SupabasePath = 'Analogue and Digital Communication.pdf' WHERE Title LIKE '%Analog Communication%';
    UPDATE Books SET SupabasePath = 'Applied Thermodynamics.pdf' WHERE Title LIKE '%Thermodynamics%';
    UPDATE Books SET SupabasePath = 'Engineering Economics.pdf' WHERE Title LIKE '%Engineering Economy%';
    UPDATE Books SET SupabasePath = 'Feedback Control System.pdf' WHERE Title LIKE '%Control Systems%';
    UPDATE Books SET SupabasePath = 'Resurrection-A-Zombie-Novel.pdf' WHERE Title LIKE '%Resurrection%';
  `);
  console.log('Manual links applied.');
  process.exit(0);
}
manualLink();
