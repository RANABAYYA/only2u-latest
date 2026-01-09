import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'products_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on('connect', () => {
  console.log('✅ Product Service Database connected');
});

db.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

process.on('SIGINT', async () => {
  await db.end();
  process.exit(0);
});

