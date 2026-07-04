import fs from 'fs';
import path from 'path';
import { pool } from '../src/db/config';

async function runMigrations() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');
    console.log('Migrations applied successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying migrations:', error);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

runMigrations();
