require('dotenv').config();
const { Pool } = require('pg');

const REQUIRED_USER_COLUMNS = [
  'name',
  'password_hash',
  'age',
  'gender',
  'address',
  'postal_code',
  'phone',
  'language',
  'google_id'
];

const REQUIRED_TABLES = [
  'users',
  'symptom_queries',
  'voice_analysis_results',
  'user_metrics',
  'chat_messages'
];

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/vitalbit'
  });

  try {
    const columnsResult = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'users'
       ORDER BY column_name`
    );

    const tablesResult = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`
    );

    const availableColumns = new Set(columnsResult.rows.map((row) => row.column_name));
    const availableTables = new Set(tablesResult.rows.map((row) => row.table_name));

    const missingColumns = REQUIRED_USER_COLUMNS.filter((column) => !availableColumns.has(column));
    const missingTables = REQUIRED_TABLES.filter((table) => !availableTables.has(table));

    console.log('Required users columns present:', REQUIRED_USER_COLUMNS.filter((column) => availableColumns.has(column)).join(', '));
    console.log('Required tables present:', REQUIRED_TABLES.filter((table) => availableTables.has(table)).join(', '));

    if (missingColumns.length || missingTables.length) {
      if (missingColumns.length) {
        console.error('Missing users columns:', missingColumns.join(', '));
      }
      if (missingTables.length) {
        console.error('Missing tables:', missingTables.join(', '));
      }
      process.exitCode = 1;
      return;
    }

    console.log('Schema verification passed.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Schema verification failed:', error.message);
  process.exit(1);
});
