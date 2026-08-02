/**
 * Chronos SaaS - Vercel Serverless API Express Backend (Neon DB Connected)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

// Neon Postgres Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Table Auto-Migration helper
let dbInitialized = false;
async function ensureDb() {
  if (dbInitialized) return;
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id VARCHAR(100) PRIMARY KEY,
        title TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'General',
        priority VARCHAR(20) DEFAULT 'Medium',
        deadline_iso VARCHAR(50) NOT NULL,
        notes TEXT,
        completed BOOLEAN DEFAULT FALSE,
        notified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
    dbInitialized = true;
  } catch (err) {
    console.error('[Vercel Neon DB] Init Error:', err.message);
  }
}

// Routes

// Health Check
app.get('/api/health', async (req, res) => {
  await ensureDb();
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'OK', database: 'Neon Postgres Connected', time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// GET all ToDos
app.get('/api/todos', async (req, res) => {
  await ensureDb();
  try {
    const result = await pool.query('SELECT id, title, category, priority, deadline_iso AS "deadlineIso", notes, completed, notified FROM todos ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create ToDo
app.post('/api/todos', async (req, res) => {
  await ensureDb();
  const { id, title, category, priority, deadlineIso, notes } = req.body;
  if (!title || !deadlineIso) {
    return res.status(400).json({ error: 'Title and Deadline are required' });
  }

  const todoId = id || ('task_' + Date.now());

  try {
    const query = `
      INSERT INTO todos (id, title, category, priority, deadline_iso, notes, completed, notified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, title, category, priority, deadline_iso AS "deadlineIso", notes, completed, notified;
    `;
    const values = [todoId, title, category || 'General', priority || 'Medium', deadlineIso, notes || '', false, false];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Bulk Create ToDos
app.post('/api/todos/bulk', async (req, res) => {
  await ensureDb();
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = [];

    for (const item of items) {
      const todoId = item.id || ('task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));
      const query = `
        INSERT INTO todos (id, title, category, priority, deadline_iso, notes, completed, notified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          category = EXCLUDED.category,
          priority = EXCLUDED.priority,
          deadline_iso = EXCLUDED.deadline_iso,
          notes = EXCLUDED.notes
        RETURNING id, title, category, priority, deadline_iso AS "deadlineIso", notes, completed, notified;
      `;
      const values = [todoId, item.title, item.category || 'General', item.priority || 'Medium', item.deadlineIso, item.notes || '', false, false];
      const result = await client.query(query, values);
      inserted.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json(inserted);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT Update ToDo
app.put('/api/todos/:id', async (req, res) => {
  await ensureDb();
  const { id } = req.params;
  const { completed, notified } = req.body;

  try {
    const query = `
      UPDATE todos
      SET completed = COALESCE($1, completed),
          notified = COALESCE($2, notified)
      WHERE id = $3
      RETURNING id, title, category, priority, deadline_iso AS "deadlineIso", notes, completed, notified;
    `;
    const result = await pool.query(query, [completed, notified, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ToDo
app.delete('/api/todos/:id', async (req, res) => {
  await ensureDb();
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM todos WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Deleted successfully', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
