import { pool } from '../config/database';
import fs from 'fs';
import path from 'path';

async function createTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read SQL file
    const sqlPath = path.join(__dirname, '../../schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL
    await client.query(sql);

    await client.query('COMMIT');
    console.log('✅ Database tables created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

createTables();

