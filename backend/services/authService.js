const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const SALT_ROUNDS = 12;

/**
 * Create a new user. Throws if email already in use.
 */
async function createUser(name, email, password) {
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    const result = await pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name.trim(), email.toLowerCase().trim(), hashed]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const e = new Error('An account with this email already exists');
      e.statusCode = 409;
      throw e;
    }
    throw err;
  }
}

/**
 * Find a user by email (includes password hash for validation).
 */
async function findUserByEmail(email) {
  const result = await pool.query(
    `SELECT id, name, email, password, created_at
     FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  return result.rows[0] || null;
}

/**
 * Find a user by id (no password).
 */
async function findUserById(id) {
  const result = await pool.query(
    `SELECT id, name, email, created_at FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Validate a plain-text password against a bcrypt hash.
 */
async function validatePassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

module.exports = { createUser, findUserByEmail, findUserById, validatePassword };
