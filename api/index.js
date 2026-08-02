/**
 * Chronos SaaS - Vercel Serverless API Express Backend (Neon DB Connected)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static assets from public and root
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '..')));

// Neon Postgres Connection String with environment fallback
const dbUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_S6aLJchBAP8e@ep-muddy-voice-ayqa64fn.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: dbUrl,
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

// Inline Index HTML Template Failsafe
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Chronos - Immersive Enterprise Deadline SaaS (Neon DB)</title>
  <meta name="description" content="Chronos - Enterprise deadline management, Neon PostgreSQL database backend, 3D WebGL background engine, and light/dark theme system.">
  <link rel="stylesheet" href="/styles.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <div id="three-canvas-container"></div>
  <div class="app-wrapper">
    <header class="header-bar">
      <div class="brand-group">
        <div class="brand-logo-mark">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div>
          <h1 class="brand-name">Chronos</h1>
          <p class="brand-sub">Enterprise Deadline Suite</p>
        </div>
      </div>
      <div class="header-controls">
        <div class="status-pill active" id="dbStatusPill">
          <span class="status-dot"></span>
          <span class="status-text">Neon DB Connected</span>
        </div>
        <button class="btn btn-outline" id="btnNotify">Enable Push Notifications</button>
        <button class="theme-toggle-btn" id="themeToggleBtn" title="Toggle Light/Dark Theme"></button>
      </div>
    </header>
    <section class="stats-container">
      <div class="stat-tile">
        <div class="stat-label">Total Tasks</div>
        <div class="stat-number" id="countTotal">0</div>
      </div>
      <div class="stat-tile">
        <div class="stat-label">Pending</div>
        <div class="stat-number" id="countPending">0</div>
      </div>
      <div class="stat-tile">
        <div class="stat-label">Overdue</div>
        <div class="stat-number" id="countOverdue" style="color: var(--accent-high);">0</div>
      </div>
      <div class="stat-tile">
        <div class="stat-label">Completed</div>
        <div class="stat-number" id="countCompleted" style="color: var(--accent-low);">0</div>
      </div>
    </section>
    <div class="app-grid">
      <aside class="card-panel">
        <h2 class="panel-header">Create Task</h2>
        <form id="todoForm">
          <div class="form-field">
            <label class="form-label">Task Title *</label>
            <input type="text" id="todoTitle" class="input-control" placeholder="Enter task title..." required>
          </div>
          <div class="grid-2">
            <div class="form-field">
              <label class="form-label">Category</label>
              <select id="todoCategory" class="select-control">
                <option value="Work">Work</option>
                <option value="Personal">Personal</option>
                <option value="Urgent">Urgent</option>
                <option value="Health">Health</option>
                <option value="General">General</option>
              </select>
            </div>
            <div class="form-field">
              <label class="form-label">Priority</label>
              <select id="todoPriority" class="select-control">
                <option value="High">High</option>
                <option value="Medium" selected>Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
          <div class="form-field">
            <label class="form-label">Exact Deadline *</label>
            <input type="datetime-local" id="todoDeadline" class="input-control" required>
          </div>
          <div class="form-field">
            <label class="form-label">Notes</label>
            <textarea id="todoNotes" class="textarea-control" rows="3" placeholder="Additional details or instructions..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%;">Create Task</button>
        </form>
        <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 24px 0;">
        <h2 class="panel-header">Bulk Import Tasks</h2>
        <div class="dropzone-box" id="dropZoneBox">
          <div class="dropzone-title">Drop CSV or JSON File</div>
          <div class="dropzone-desc">Click to browse or drag file here</div>
          <input type="file" id="bulkFileInput" accept=".csv, .json" style="display: none;">
        </div>
        <p style="font-size: 0.76rem; color: var(--text-muted); text-align: center; margin-top: 10px;">
          Supports CSV formatted files (e.g. <code>sample-todos.csv</code>)
        </p>
      </aside>
      <main class="card-panel">
        <div class="filter-bar">
          <div class="search-field-wrapper">
            <svg class="search-icon-svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" id="searchInput" class="input-control" placeholder="Search tasks by keyword...">
          </div>
          <div class="tab-group">
            <button class="tab-btn active" data-filter="all">All</button>
            <button class="tab-btn" data-filter="today">Today</button>
            <button class="tab-btn" data-filter="upcoming">Upcoming</button>
            <button class="tab-btn" data-filter="overdue">Overdue</button>
            <button class="tab-btn" data-filter="completed">Completed</button>
          </div>
        </div>
        <div id="taskList" class="task-feed"></div>
      </main>
    </div>
  </div>
  <script type="module" src="/app.js"></script>
</body>
</html>`;

// Root Route
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(INDEX_HTML);
});

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

// SPA Catch-all Route
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(INDEX_HTML);
});

module.exports = app;
