import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const rawUrl = process.env.DATABASE_URL || '';
const cleanUrl = rawUrl.trim().replace(/^`(.*)`$/, '$1').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

export const pool = new Pool({
  connectionString: 'postgresql://postgres:Only2usuperadmin@db.ljnheixbsweamlbntwvh.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});
