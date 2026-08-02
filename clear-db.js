/**
 * Script to truncate all records in Neon PostgreSQL todos table
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function clearDb() {
  try {
    const client = await pool.connect();
    console.log('[Neon DB] Connecting to truncate database records...');
    await client.query('TRUNCATE TABLE todos;');
    console.log('[Neon DB] SUCCESS: All task records have been deleted from Neon PostgreSQL database!');
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('[Neon DB] Truncate Error:', err.message);
    process.exit(1);
  }
}

clearDb();
