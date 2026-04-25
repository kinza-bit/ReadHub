const fs = require('fs');
const path = require('path');
const { sql, poolPromise } = require('../db');

async function applyMigration() {
  try {
    const pool = await poolPromise;
    const migrationPath = path.join(__dirname, 'backend', 'sql', 'ebook_supabase_migration.sql');
    let sqlFile = fs.readFileSync(migrationPath, 'utf8');

    const batches = sqlFile.split(/^GO\s*$/im).filter(b => b.trim().length > 0);

    for (let i = 0; i < batches.length; i++) {
        try {
            await pool.request().query(batches[i]);
            console.log(`Executed batch ${i + 1}/${batches.length}`);
        } catch (err) {
            console.error(`Error executing batch ${i + 1}:`, err.message);
        }
    }
    
    console.log("Supabase Migration applied successfully!");
    process.exit(0);
  } catch (e) {
    console.error("Migration failed:", e);
    process.exit(1);
  }
}

applyMigration();
