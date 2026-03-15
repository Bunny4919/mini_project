const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'docrule',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * Initialize the database — create the users table if it doesn't exist.
 * Also ensures the target database exists by connecting to the default
 * 'postgres' database first, creating 'docrule' if needed.
 */
async function initDatabase() {
  // First, try to create the database if it doesn't exist
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: 'postgres', // connect to default db first
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    const dbName = process.env.DB_NAME || 'docrule';
    const result = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );
    if (result.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[DB] Created database "${dbName}"`);
    }
  } catch (err) {
    console.error('[DB] Could not create database:', err.message);
  } finally {
    await adminPool.end();
  }

  // Now create the users table in the target db
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB] Users table ready');
  } catch (err) {
    console.error('[DB] Failed to initialise users table:', err.message);
    throw err;
  }
}

module.exports = { pool, initDatabase };
